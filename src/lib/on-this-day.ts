import { DAYS_IN_YEAR, MONTH_START, dayOfYear, fromRule, type FestivalRecord } from './wheel-model';

/**
 * On This Day — Phase 3 delighter D.
 *
 * DOM-free and clock-free: the caller supplies the date, so the resolution can
 * be checked against any day of any year without waiting for one.
 *
 * The panel speaks only when a record can answer. A festival whose rule names
 * a Hijri or Hebrew month, or whose observed dates have run out, is not
 * guessed at and not apologised for — it simply is not in the answer, and if
 * nothing is, the panel is absent. Silence is the honest state, not a state to
 * fill.
 */

/** How far ahead the panel looks. */
export const HORIZON_DAYS = 7;

export interface Today {
  readonly year: number;
  /** 1-based. */
  readonly month: number;
  readonly day: number;
}

export type Standing =
  /** Today is the day. */
  | 'today'
  /** Today falls inside a span that has begun. */
  | 'now'
  /** It is coming, within the horizon. */
  | 'soon';

export interface Occasion {
  readonly id: string;
  readonly name: string;
  readonly tradition: string;
  readonly standing: Standing;
  /** Days from today. Zero for today and for a span in progress. */
  readonly inDays: number;
  /** For a span in progress: which day of how many. */
  readonly dayOf?: number | undefined;
  readonly ofDays?: number | undefined;
  /** How the date was known, for the record's own honesty. */
  readonly basis: 'observed' | 'rule';
}

const dayOfYearFor = (t: Today): number => (MONTH_START[t.month - 1] ?? 0) + t.day;

/**
 * Where a festival falls this year, or null when the record cannot say.
 *
 * A Gregorian date written into the rule resolves every year. An observed
 * series resolves only for the years it lists, which is why the panel thins
 * out past 2027 rather than inventing a continuation.
 */
function placeIn(f: FestivalRecord, year: number): { day: number; span: number; basis: 'observed' | 'rule' } | null {
  const observed = f.observed[String(year)];
  if (observed !== undefined) {
    const day = dayOfYear(observed);
    if (day !== null) return { day, span: f.span_days ?? 1, basis: 'observed' };
  }
  const rule = fromRule(f.date_rule);
  if (rule !== null) {
    const span = rule.endDay >= rule.day ? rule.endDay - rule.day + 1 : 1;
    return { day: rule.day, span, basis: 'rule' };
  }
  return null;
}

/**
 * What the museum can say about today.
 *
 * Sorted by nearness, so "Today" leads and the horizon trails. A span in
 * progress outranks a single day the same distance away: a fast a reader is
 * living through is more present than a feast that has not arrived.
 */
export function occasionsFor(
  festivals: readonly FestivalRecord[],
  today: Today,
): Occasion[] {
  const t = dayOfYearFor(today);
  const out: Occasion[] = [];

  for (const f of festivals) {
    const tradition = f.traditions[0] ?? 'unaffiliated';
    /* This year answers most of it; next year answers a feast in the days
       across the new year, when the record carries that year too. */
    for (const year of [today.year, today.year + 1]) {
      const placed = placeIn(f, year);
      if (placed === null) continue;
      const offset = year === today.year ? 0 : DAYS_IN_YEAR;
      const start = placed.day + offset;
      const delta = start - t;

      if (placed.span > 1 && delta <= 0 && t - start < placed.span) {
        out.push({
          id: f.id, name: f.name, tradition, standing: 'now', inDays: 0,
          dayOf: t - start + 1, ofDays: placed.span, basis: placed.basis,
        });
        break;
      }
      if (delta === 0) {
        out.push({ id: f.id, name: f.name, tradition, standing: 'today', inDays: 0, basis: placed.basis });
        break;
      }
      if (delta > 0 && delta <= HORIZON_DAYS) {
        out.push({ id: f.id, name: f.name, tradition, standing: 'soon', inDays: delta, basis: placed.basis });
        break;
      }
    }
  }

  const rank: Record<Standing, number> = { today: 0, now: 1, soon: 2 };
  return out.sort((a, b) => rank[a.standing] - rank[b.standing] || a.inDays - b.inDays);
}

/** The line the panel shows, in the house voice. */
export function lineFor(o: Occasion): string {
  if (o.standing === 'today') return `Today: ${o.name}`;
  if (o.standing === 'now') return `Now: ${o.name}, day ${o.dayOf} of ${o.ofDays}`;
  return o.inDays === 1 ? `Tomorrow: ${o.name}` : `In ${o.inDays} days: ${o.name}`;
}
