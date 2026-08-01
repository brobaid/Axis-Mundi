import { esc } from './escape';
import { DAYS_IN_YEAR, MONTHS, MONTH_START, angleOf, type Placed, type Wheel } from './wheel-model';

/**
 * The year wheel's SVG — Phase 3 delighter A.
 *
 * Pure and DOM-free, like the map: this renders at build time for the first
 * paint and again in the island whenever the year changes, from the same
 * function, so the two can never drift.
 *
 * Geometry follows the greenlit reference build: one circle, twelve months
 * clockwise from Jan at twelve o'clock, festivals on a ring inside the month
 * band. Single-day feasts are dots; anything with a span is an arc, because a
 * fast of a month is not an event and should not read as one.
 */

const CX = 280;
const CY = 286;
const R = 210;
/** The month band sits between these; festivals ride the inner edge. */
const R_INNER = R - 26;
const R_FEST = R - 13;

const rad = (deg: number): number => (deg * Math.PI) / 180;
const x = (r: number, deg: number): number => CX + r * Math.cos(rad(deg));
const y = (r: number, deg: number): number => CY + r * Math.sin(rad(deg));
const n = (v: number): string => v.toFixed(1);

/** Days a span covers, wrapping the new year. */
const spanDays = (p: Placed): number =>
  p.endDay >= p.day ? p.endDay - p.day + 1 : DAYS_IN_YEAR - p.day + p.endDay + 1;

function arcPath(day: number, endDay: number, r: number): string {
  const a1 = angleOf(day);
  const a2 = angleOf(endDay);
  const sweep = (a2 - a1 + 360) % 360;
  return (
    `M${n(x(r, a1))},${n(y(r, a1))} ` +
    `A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${n(x(r, a2))},${n(y(r, a2))}`
  );
}

/** The month ring, its spokes and its lettering. Never changes with the year. */
function ring(): string {
  let out =
    `<circle class="wh-ring" cx="${CX}" cy="${CY}" r="${R}"/>` +
    `<circle class="wh-ring" cx="${CX}" cy="${CY}" r="${R_INNER}"/>`;
  for (const [i, name] of MONTHS.entries()) {
    const start = MONTH_START[i] ?? 0;
    const a = angleOf(start + 1);
    const mid = angleOf(start + 15);
    out +=
      `<line class="wh-ring" x1="${n(x(R_INNER, a))}" y1="${n(y(R_INNER, a))}" ` +
      `x2="${n(x(R, a))}" y2="${n(y(R, a))}"/>` +
      `<text class="wh-month mono" x="${n(x(R + 16, mid))}" y="${n(y(R + 16, mid) + 4)}" ` +
      `text-anchor="middle">${name}</text>`;
  }
  return out;
}

/**
 * One festival. A generous transparent disc carries the tap: the dot is 6.5px
 * because the wheel would be unreadable otherwise, and a fingertip is not.
 */
function mark(p: Placed): string {
  const hue = `var(--t-${p.tradition})`;
  const days = spanDays(p);
  const label = `${p.festival.name}, ${p.tradition}, ${p.basisNote}`;
  const body =
    days > 1
      ? `<path class="wh-arc" d="${arcPath(p.day, p.endDay, R_FEST)}" stroke="${hue}"/>` +
        `<circle class="wh-dot" cx="${n(x(R_FEST, angleOf(p.day)))}" ` +
        `cy="${n(y(R_FEST, angleOf(p.day)))}" r="5" fill="${hue}"/>`
      : `<circle class="wh-dot" cx="${n(x(R_FEST, angleOf(p.day)))}" ` +
        `cy="${n(y(R_FEST, angleOf(p.day)))}" r="6.5" fill="${hue}"/>`;
  return (
    `<g class="wh-fest" data-festival="${esc(p.festival.id)}" tabindex="0" role="button" ` +
    `aria-label="${esc(label)}">` +
    `<circle class="wh-hit" cx="${n(x(R_FEST, angleOf(p.day)))}" ` +
    `cy="${n(y(R_FEST, angleOf(p.day)))}" r="26"/>` +
    body +
    `</g>`
  );
}

export function renderWheel(wheel: Wheel): string {
  const marks = wheel.placed.map(mark).join('');
  return (
    `<svg class="wh-svg" viewBox="0 0 560 560" preserveAspectRatio="xMidYMid meet" ` +
    `role="group" aria-label="Festival year wheel for ${wheel.year}">` +
    ring() +
    `<text class="wh-year" x="${CX}" y="${CY + 8}" text-anchor="middle">${wheel.year}</text>` +
    `<text class="wh-sub mono" x="${CX}" y="${CY + 32}" text-anchor="middle">` +
    /* "16 of 33 placed" named an internal state. What a reader wants to know
       is how many festivals this year's records can actually date, and the
       list below the wheel already names the ones they cannot. */
    `${wheel.placed.length} of ${wheel.placed.length + wheel.unplaced.length} dated</text>` +
    marks +
    `</svg>`
  );
}

/** The card a tap opens, in the shared panel. */
export function festivalCard(p: Placed, traditionName: string, sourceTitles: readonly string[]): string {
  const f = p.festival;
  const days = spanDays(p);
  return (
    `<p class="eyebrow">${esc(traditionName)}</p>` +
    `<h2>${esc(f.name)}</h2>` +
    `<p class="mono caption">${esc(f.calendar)} calendar · ${days > 1 ? `${days} days` : 'one day'}</p>` +
    (f.summary === undefined ? '' : `<p>${esc(f.summary)}</p>`) +
    `<p class="caption"><b>When:</b> ${esc(f.date_rule)}</p>` +
    `<p class="caption"><b>On this wheel:</b> ${esc(p.basisNote)}</p>` +
    (sourceTitles.length === 0
      ? ''
      : `<p class="caption">Source: ${sourceTitles.map(esc).join(', ')}</p>`)
  );
}
