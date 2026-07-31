import {
  MATRIX_DIMENSIONS,
  MATRIX_DIMENSION_SHORT,
  valueLabel,
  type MatrixDimension,
} from './dimensions';

/**
 * The belief matrix as a grid, and the filter chips that grid earns.
 *
 * Pure and DOM-free, like the timeline model and the map renderer: this runs at
 * build time for the server-rendered table and again in the island on every
 * filter change, so the two can never disagree about which rows match.
 *
 * Nothing here authors content. A dimension with no record is an absence the
 * grid renders as an absence — see `MatrixRowView.cells`, where a missing key
 * means "no record yet", never "not applicable".
 */

export interface MatrixCellView {
  readonly dimension: MatrixDimension;
  /** Kebab-case, as stored, so filtering compares like with like. */
  readonly value: string;
  readonly label: string;
  readonly nuance: string;
  readonly sources: readonly string[];
  readonly contested: boolean;
  readonly contestedNote: string | undefined;
}

export interface MatrixRowView {
  readonly id: string;
  /** The taxonomy node this row describes: a tradition or a major branch. */
  readonly node: string;
  /** The tradition the node belongs to, which carries the hue. */
  readonly tradition: string;
  readonly label: string;
  readonly order: number;
  /** Absent key = no record for that dimension yet. */
  readonly cells: Partial<Record<MatrixDimension, MatrixCellView>>;
}

/* ── building the grid ──────────────────────────────────────────────────── */

export interface RawCell {
  readonly dimension: string;
  readonly value: string;
  readonly nuance: string;
  readonly sources: readonly string[];
  readonly contested: boolean;
  readonly contested_note?: string | undefined;
}

export interface RawRow {
  readonly id: string;
  readonly node: string;
  readonly label: string;
  readonly order: number;
  readonly cells: readonly RawCell[];
}

/**
 * `traditionOf` resolves a taxonomy node id to its tradition. It is passed in
 * rather than looked up here so this module stays free of content imports and
 * can be exercised without a build.
 */
export function buildRows(
  rows: readonly RawRow[],
  traditionOf: (node: string) => string,
): MatrixRowView[] {
  return rows
    .map((row) => {
      const cells: Partial<Record<MatrixDimension, MatrixCellView>> = {};
      for (const cell of row.cells) {
        const dimension = cell.dimension as MatrixDimension;
        if (!MATRIX_DIMENSIONS.includes(dimension)) continue;
        cells[dimension] = {
          dimension,
          value: cell.value,
          label: valueLabel(cell.value),
          nuance: cell.nuance,
          sources: cell.sources,
          contested: cell.contested,
          contestedNote: cell.contested_note,
        };
      }
      return {
        id: row.id,
        node: row.node,
        tradition: traditionOf(row.node),
        label: row.label,
        order: row.order,
        cells,
      };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/* ── coverage ───────────────────────────────────────────────────────────── */

/** Which of the thirteen dimensions any published row actually fills. */
export const filledDimensions = (rows: readonly MatrixRowView[]): MatrixDimension[] =>
  MATRIX_DIMENSIONS.filter((d) => rows.some((row) => row.cells[d] !== undefined));

/* ── filter chips ───────────────────────────────────────────────────────── */

export interface FilterChip {
  readonly dimension: MatrixDimension;
  readonly value: string;
  /** "Afterlife: rebirth" — the dimension is part of the label, never colour. */
  readonly label: string;
  /** How many rows this chip keeps. Shown, so the rule below is visible. */
  readonly count: number;
}

/**
 * A value earns a chip when it groups two or more rows.
 *
 * Applied uniformly across all thirteen dimensions rather than only the three
 * the spec closes to an enum, because the useful question is whether a value
 * partitions the traditions, not whether its set happens to be fixed. A chip
 * that selects exactly one row is a link wearing a filter's clothes; today that
 * rule keeps the three constrained dimensions and drops dietary law, where nine
 * of ten traditions hold a distinct position.
 */
export function filterChips(rows: readonly MatrixRowView[]): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const dimension of MATRIX_DIMENSIONS) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const cell = row.cells[dimension];
      if (cell === undefined) continue;
      counts.set(cell.value, (counts.get(cell.value) ?? 0) + 1);
    }

    for (const [value, count] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      if (count < 2) continue;
      chips.push({
        dimension,
        value,
        label: `${MATRIX_DIMENSION_SHORT[dimension]}: ${valueLabel(value).toLowerCase()}`,
        count,
      });
    }
  }

  return chips;
}

/** A chip as it survives a URL: `afterlife=rebirth`. */
export const chipKey = (chip: Pick<FilterChip, 'dimension' | 'value'>): string =>
  `${chip.dimension}=${chip.value}`;

/**
 * Rows are kept only when they match every active chip.
 *
 * Two chips on the same dimension would otherwise cancel out and empty the
 * table, so chips within a dimension are OR'd and dimensions are AND'd — the
 * behaviour a reader expects from faceted filtering, and the only one where
 * "afterlife: rebirth or resurrection" is expressible.
 */
export function matches(row: MatrixRowView, active: readonly FilterChip[]): boolean {
  if (active.length === 0) return true;

  const byDimension = new Map<MatrixDimension, string[]>();
  for (const chip of active) {
    const values = byDimension.get(chip.dimension);
    if (values === undefined) byDimension.set(chip.dimension, [chip.value]);
    else values.push(chip.value);
  }

  for (const [dimension, values] of byDimension) {
    const cell = row.cells[dimension];
    /* An unfilled cell cannot satisfy a filter. Treating absence as a match
       would quietly claim the row holds the filtered position. */
    if (cell === undefined || !values.includes(cell.value)) return false;
  }

  return true;
}
