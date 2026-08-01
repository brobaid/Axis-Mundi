/**
 * Where a reader left off, per corpus — Phase 5.
 *
 * DOM-free, so the reader island and any page that offers to resume agree on
 * one shape without either importing the other's machinery.
 *
 * This is an enhancement and never a dependency. The design language bans
 * browser storage for core reading paths, and reading is one: every route is a
 * plain address, every verse is a plain anchor, and a reader with storage
 * refused loses a convenience and nothing else. Storage failing is handled the
 * way the timeline's coach handles it — as if nothing had been remembered.
 */

export const POSITION_KEY = 'axis-mundi-reading-position';

export interface Position {
  /** Route segment of the division, not its number: books have names. */
  readonly division: string;
  /** The verse's fragment, `255` or `20-3`. */
  readonly anchor: string;
  /** How it is cited, for the resume link's own words: "Exodus 20:3". */
  readonly ref: string;
}

export type Positions = Readonly<Record<string, Position>>;

const isPosition = (value: unknown): value is Position => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['division'] === 'string' && typeof v['anchor'] === 'string' && typeof v['ref'] === 'string';
};

/**
 * Parses the stored map, discarding anything that is not one.
 *
 * Storage is shared with every other tab, extension and past version of this
 * site on the same origin. A malformed value is not an error to report, it is
 * a value to ignore — the reader gets no resume link and never knows why.
 */
export function parsePositions(raw: string | null): Positions {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, Position> = {};
    for (const [work, value] of Object.entries(parsed)) {
      if (isPosition(value)) {
        out[work] = { division: value.division, anchor: value.anchor, ref: value.ref };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** The map with one corpus's position replaced. */
export const withPosition = (all: Positions, work: string, position: Position): Positions => ({
  ...all,
  [work]: position,
});

/** The verse's fragment as it is cited: `20-3` under Exodus is "Exodus 20:3". */
export const refFor = (heading: string, anchor: string): string =>
  `${heading} ${anchor.replace('-', ':')}`;
