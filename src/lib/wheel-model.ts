/**
 * Year-wheel placement — Phase 3 delighter A.
 *
 * DOM-free, so the same resolution runs at build time and in the island.
 *
 * The one rule that shapes everything here: the schema says `date_rule` is
 * "How the date is determined, in words. Never a computed date." A festival
 * whose record gives only a Hebrew, Hijri or Hindu month has no Gregorian day
 * on it, and the museum does not own a converter it could honestly cite. So
 * the wheel places what the record can place and says plainly what it cannot,
 * rather than putting a dot somewhere plausible.
 */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Days before the first of each month, common year. */
export const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;

export const DAYS_IN_YEAR = 365;

/** The Gregorian years the records carry observed dates for. */
export const WHEEL_YEARS = [2024, 2025, 2026, 2027] as const;
export type WheelYear = (typeof WHEEL_YEARS)[number];

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december'];

/** "03-11" → day of year, 1-based. */
export function dayOfYear(mmdd: string): number | null {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (m === null) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const start = MONTH_START[month - 1];
  if (start === undefined || day < 1 || day > 31) return null;
  return start + day;
}

/** Day of year → the angle of its point on the ring, degrees, 12 o'clock = Jan 1. */
export const angleOf = (day: number): number => ((day - 1) / DAYS_IN_YEAR) * 360 - 90;

export interface FestivalRecord {
  readonly id: string;
  readonly name: string;
  readonly traditions: readonly string[];
  readonly calendar: 'solar' | 'lunar' | 'lunisolar';
  readonly date_rule: string;
  readonly observed: Readonly<Record<string, string>>;
  readonly span_days?: number | undefined;
  readonly summary?: string | undefined;
  readonly note?: string | undefined;
  readonly sources: readonly string[];
}

/** How a placement was arrived at, which the readout tells the reader. */
export type Basis =
  /** The record's own observed date for this year. */
  | 'observed'
  /** A Gregorian date the owner wrote into the rule itself. */
  | 'rule'
  /** The owner's own arithmetic against another festival's observed date. */
  | 'derived';

export interface Placed {
  readonly festival: FestivalRecord;
  readonly tradition: string;
  /** First day, 1-based. */
  readonly day: number;
  /** Last day for a span, equal to `day` for a single-day feast. */
  readonly endDay: number;
  readonly basis: Basis;
  /** What the readout says about how this position was found. */
  readonly basisNote: string;
}

export interface Unplaced {
  readonly festival: FestivalRecord;
  readonly tradition: string;
  readonly reason: string;
}

export interface Wheel {
  readonly year: WheelYear;
  readonly placed: readonly Placed[];
  readonly unplaced: readonly Unplaced[];
}

/**
 * A Gregorian date written into the rule in the owner's own words.
 *
 * "December 25", "November 23", "January 1-3", "April 13-14", "July". Reading a
 * month name the owner typed is extraction, not conversion; a Hijri or Hebrew
 * month name is neither, and falls through to unplaced.
 */
export function fromRule(rule: string): { day: number; endDay: number } | null {
  const m = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b(?:\\s+(\\d{1,2})(?:\\s*[-–]\\s*(\\d{1,2}))?)?`, 'i').exec(rule);
  if (m === null) return null;
  const monthIndex = MONTH_NAMES.indexOf((m[1] ?? '').toLowerCase());
  const start = MONTH_START[monthIndex];
  if (start === undefined) return null;
  if (m[2] === undefined) {
    /* A bare month name is the whole month: "Gion Matsuri — July". */
    const next = MONTH_START[monthIndex + 1] ?? DAYS_IN_YEAR;
    return { day: start + 1, endDay: next };
  }
  const first = start + Number(m[2]);
  return { day: first, endDay: m[3] === undefined ? first : start + Number(m[3]) };
}

/** "…fifty days before Nowruz" — the rule names an offset from another feast. */
const OFFSET_RE = /\b(\w+(?:-\w+)?)\s+days\s+(before|after)\s+([A-Z][\w']*)/;

const WORD_NUMBERS: Record<string, number> = {
  ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

const wrap = (d: number): number => ((d - 1 + DAYS_IN_YEAR) % DAYS_IN_YEAR) + 1;

/**
 * Resolves every festival against one Gregorian year.
 *
 * Two passes: records that stand on their own first, then the ones whose rule
 * points at another feast, so an offset can find its anchor.
 */
export function buildWheel(festivals: readonly FestivalRecord[], year: WheelYear): Wheel {
  const placed: Placed[] = [];
  const pending: FestivalRecord[] = [];

  for (const f of festivals) {
    const tradition = f.traditions[0] ?? 'unaffiliated';
    const observed = f.observed[String(year)];
    if (observed !== undefined) {
      const day = dayOfYear(observed);
      if (day !== null) {
        const span = f.span_days ?? 1;
        placed.push({
          festival: f, tradition, day, endDay: wrap(day + span - 1), basis: 'observed',
          basisNote: `observed ${observed.replace('-', '/')}/${year}`,
        });
        continue;
      }
    }
    const fromWords = fromRule(f.date_rule);
    if (fromWords !== null) {
      placed.push({
        festival: f, tradition, ...fromWords, basis: 'rule',
        basisNote: 'a Gregorian date in the record’s own rule',
      });
      continue;
    }
    pending.push(f);
  }

  const unplaced: Unplaced[] = [];
  for (const f of pending) {
    const tradition = f.traditions[0] ?? 'unaffiliated';
    const m = OFFSET_RE.exec(f.date_rule);
    const n = m === undefined || m === null ? undefined : WORD_NUMBERS[(m[1] ?? '').toLowerCase()];
    const anchor = m === null ? undefined : placed.find((p) => p.festival.name === m[3]);
    if (m !== null && n !== undefined && anchor !== undefined) {
      const day = wrap(anchor.day + (m[2] === 'before' ? -n : n));
      placed.push({
        festival: f, tradition, day, endDay: day, basis: 'derived',
        basisNote: `${m[1]} days ${m[2]} ${anchor.festival.name}, by the record’s own rule`,
      });
      continue;
    }
    unplaced.push({
      festival: f, tradition,
      reason: 'the record gives its rule in words and no Gregorian date',
    });
  }

  placed.sort((a, b) => a.day - b.day);
  unplaced.sort((a, b) => a.festival.name.localeCompare(b.festival.name));
  return { year, placed, unplaced };
}

/** The wheel opens on the shared cursor's year when the records can answer it. */
export function yearFor(cursorYear: number | null): WheelYear {
  const hit = WHEEL_YEARS.find((y) => y === cursorYear);
  return hit ?? 2026;
}
