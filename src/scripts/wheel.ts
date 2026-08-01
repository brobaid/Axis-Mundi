import { readCursor } from '../lib/cursor';
import { createPanel } from '../lib/panel';
import { WHEEL_YEARS, yearFor, type WheelYear } from '../lib/wheel-model';

/**
 * The year wheel's island.
 *
 * Every year is rendered at build time, so stepping is a swap of pre-built
 * markup rather than a re-layout, and the SVG the reader sees first is the one
 * the server drew.
 *
 * It reads the shared cursor and does not write it. The wheel's year is a
 * Gregorian year for placing feasts, not a position in history; sending 2027
 * to the timeline because a reader wanted to see Ramadan drift would move a
 * room they were not in.
 */

interface CardData {
  readonly name: string;
  readonly tradition: string;
  readonly calendar: string;
  readonly rule: string;
  readonly summary: string;
  readonly note: string;
  readonly sources: readonly string[];
}

interface WheelData {
  readonly byYear: Record<string, { svg: string; placed: Record<string, string> }>;
  readonly cards: Record<string, CardData>;
}

const data = (window as unknown as { __wheel?: WheelData }).__wheel;
const root = document.querySelector<HTMLElement>('[data-wheel]');

if (data !== undefined && root !== null) {
  const canvas = root.querySelector<HTMLElement>('[data-wheel-canvas]');
  const readout = root.querySelector<HTMLElement>('[data-wheel-readout]');
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-wheel-year]')];
  const panel = createPanel();

  const esc = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

  let year: WheelYear = yearFor(readCursor(location.search));

  function openFestival(id: string, trigger: HTMLElement | null): void {
    const card = data?.cards[id];
    if (card === undefined || panel === null) return;
    const basis = data?.byYear[String(year)]?.placed[id];
    panel.open(
      `<p class="eyebrow">${esc(card.tradition)}</p>` +
        `<h2>${esc(card.name)}</h2>` +
        `<p class="mono caption">${esc(card.calendar)} calendar</p>` +
        (card.summary === '' ? '' : `<p>${esc(card.summary)}</p>`) +
        `<p class="caption"><b>When:</b> ${esc(card.rule)}</p>` +
        (card.note === '' ? '' : `<p class="caption">${esc(card.note)}</p>`) +
        (basis === undefined
          ? `<p class="caption">Not placed on the circle: the record gives its rule in words and no Gregorian date, and this museum carries no calendar conversion it could cite.</p>`
          : `<p class="caption"><b>On the ${year} wheel:</b> ${esc(basis)}</p>`) +
        (card.sources.length === 0
          ? ''
          : `<p class="caption">Source: ${card.sources.map(esc).join(', ')}</p>`),
      trigger,
    );
  }

  function setYear(next: WheelYear): void {
    const frame = data?.byYear[String(next)];
    if (frame === undefined || canvas === null) return;
    year = next;
    canvas.innerHTML = frame.svg;
    for (const chip of chips) {
      const on = Number(chip.dataset['wheelYear']) === next;
      chip.setAttribute('aria-checked', String(on));
      chip.tabIndex = on ? 0 : -1;
    }
    const placed = Object.keys(frame.placed).length;
    if (readout !== null) {
      readout.textContent = `${next} · ${placed} feasts placed · the lunar ones move against the solar ones from year to year`;
    }
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const y = WHEEL_YEARS.find((w) => w === Number(chip.dataset['wheelYear']));
      if (y !== undefined) setYear(y);
    });
  }

  /* Arrows step the years, matching the map scrubber's rail. */
  root.querySelector('[role="radiogroup"]')?.addEventListener('keydown', (ev) => {
    const key = (ev as KeyboardEvent).key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    ev.preventDefault();
    const i = WHEEL_YEARS.indexOf(year);
    const next =
      key === 'Home' ? 0
      : key === 'End' ? WHEEL_YEARS.length - 1
      : key === 'ArrowLeft' || key === 'ArrowDown' ? Math.max(0, i - 1)
      : Math.min(WHEEL_YEARS.length - 1, i + 1);
    const y = WHEEL_YEARS[next];
    if (y === undefined) return;
    setYear(y);
    chips.find((c) => Number(c.dataset['wheelYear']) === y)?.focus();
  });

  /**
   * The nearest mark to a tap that missed.
   *
   * A dot has to be 6.5px for thirteen of them to read on one circle, and at
   * 390px even a generous hit disc lands under the 44px floor — the same
   * problem the map solved by resolving to the nearest realm. Here the marks
   * sit on a known ring, so nearest is a distance in screen pixels, capped so
   * a tap in the middle of the circle still opens nothing.
   */
  const NEAR_PX = 44;
  function nearestMark(clientX: number, clientY: number): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    for (const g of root!.querySelectorAll<HTMLElement>('.wh-fest')) {
      const dot = g.querySelector('.wh-dot');
      if (dot === null) continue;
      const b = dot.getBoundingClientRect();
      const d = Math.hypot(clientX - (b.left + b.width / 2), clientY - (b.top + b.height / 2));
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return bestD <= NEAR_PX ? best : null;
  }

  /* One listener for both the circle and the unplaced list. */
  root.addEventListener('click', (ev) => {
    const hit = (ev.target as Element).closest<HTMLElement>('[data-festival]');
    if (hit !== null) {
      openFestival(hit.dataset['festival'] ?? '', hit);
      return;
    }
    if ((ev.target as Element).closest('.wh-svg') === null) return;
    const near = nearestMark((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
    if (near !== null) openFestival(near.dataset['festival'] ?? '', near);
  });
  root.addEventListener('keydown', (ev) => {
    const key = (ev as KeyboardEvent).key;
    if (key !== 'Enter' && key !== ' ') return;
    const hit = (ev.target as Element).closest<HTMLElement>('.wh-fest[data-festival]');
    if (hit === null) return;
    ev.preventDefault();
    openFestival(hit.dataset['festival'] ?? '', hit);
  });

  setYear(year);
}
