import type { z } from 'zod';
import type { precision as precisionSchema } from '../schemas/primitives.js';

type Precision = z.infer<typeof precisionSchema>;

/**
 * Renders an event's date from `year_start`, `year_end` and `precision`.
 *
 * Phase 0 spec §9.2.6: "Dates follow academic consensus; uncertainty renders as
 * 'c.' via `precision`, never silently rounded." So the precision field, not the
 * author, decides whether a date is hedged — and a hedge is never dropped.
 *
 * Years are astronomical integers: negative = BCE (spec §3).
 */

const ordinal = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

const era = (year: number): 'BCE' | 'CE' => (year < 0 ? 'BCE' : 'CE');

/** Plain year, e.g. 325 -> "325 CE", -586 -> "586 BCE". */
export const formatYear = (year: number): string => `${Math.abs(year)} ${era(year)}`;

const centuryOf = (year: number): number => Math.ceil(Math.abs(year) / 100);
const decadeOf = (year: number): number => Math.floor(Math.abs(year) / 10) * 10;

function formatSingle(year: number, precision: Precision): string {
  switch (precision) {
    case 'exact':
      return formatYear(year);
    case 'year':
      return `c. ${formatYear(year)}`;
    case 'decade':
      return `c. ${decadeOf(year)}s ${era(year)}`;
    case 'century':
      return `${ordinal(centuryOf(year))} century ${era(year)}`;
    case 'era': {
      const millennium = Math.ceil(Math.abs(year) / 1000);
      return `${ordinal(millennium)} millennium ${era(year)}`;
    }
  }
}

export interface DatedEvent {
  readonly year_start: number;
  readonly year_end?: number | undefined;
  readonly precision: Precision;
  readonly display_date?: string | undefined;
}

export function displayDate(event: DatedEvent): string {
  /* An explicit override always wins (spec §3: "Human-readable override"). */
  if (event.display_date !== undefined && event.display_date !== '') return event.display_date;

  const { year_start, year_end, precision } = event;

  if (year_end === undefined || year_end === year_start) {
    return formatSingle(year_start, precision);
  }

  /* Ranges: hedge once, and keep the era marker only where it changes. */
  const hedge = precision === 'exact' ? '' : 'c. ';
  const sameEra = era(year_start) === era(year_end);
  const start = sameEra ? String(Math.abs(year_start)) : formatYear(year_start);
  return `${hedge}${start}–${formatYear(year_end)}`;
}
