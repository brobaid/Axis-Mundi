import { MATRIX_DIMENSIONS, MATRIX_DIMENSION_SHORT, type MatrixDimension } from './dimensions';
import { esc } from './escape';
import type { MatrixCellView } from './matrix-view';

/**
 * Compare mode: two traditions side by side on the shared schema.
 *
 * The schema is the belief matrix's thirteen dimensions, and the records are
 * the same matrix rows the matrix page renders — spec §1.2, "extracted from the
 * same structured fields, never rewritten." Nothing on this page is authored
 * for it. If a dimension has no record, the cell says so rather than being
 * filled in from somewhere else or quietly dropped.
 *
 * Pure and DOM-free: build time renders the first pair, the island re-renders
 * on every chip.
 */

export interface AdherentsView {
  /** The sourcing memo fixes this string; it is rendered verbatim, always. */
  readonly display: string;
  readonly contested: boolean;
  readonly contestedNote: string | undefined;
  readonly note: string | undefined;
  readonly basis: string | undefined;
  readonly sourceTitle: string | undefined;
  readonly year: number | undefined;
}

export interface CompareColumn {
  readonly tradition: string;
  readonly name: string;
  readonly adherents: AdherentsView | undefined;
  readonly cells: Partial<Record<MatrixDimension, MatrixCellView>>;
}

/**
 * A stat slot that has no record behind it yet.
 *
 * Rendered rather than hidden. The v5 stat box read "1.9 bn · 7th c. CE ·
 * Quran"; two of those three have no field in any schema the content has
 * filled, so they appear here as what they are — waiting on the owner's
 * research — instead of being written from general knowledge.
 */
export interface WaitingSlot {
  readonly label: string;
  readonly waitingOn: string;
}

export const WAITING_STATS: readonly WaitingSlot[] = [
  {
    label: 'Founded',
    waitingOn: 'no founding year on any tradition node yet',
  },
  {
    label: 'Principal scripture',
    waitingOn: 'awaiting the scripture-and-authority matrix cells',
  },
];

/* ── the adherent line ──────────────────────────────────────────────────── */

/**
 * Two traditions have no honest point estimate and the sourcing memo forbids
 * inventing one, so `display` carries the literal string "see note" and the
 * prose beside it does the work:
 *
 *   Shinto  — contested: shrine registers and self-identification disagree by
 *             an order of magnitude. Both positions render; neither wins.
 *   Chinese — not contested, simply not a single number. The note stands in
 *             place of an estimate.
 *
 * Everything else renders `display` verbatim, including its unit and its
 * parenthetical.
 */
export function adherentHtml(adherents: AdherentsView | undefined): string {
  if (adherents === undefined) {
    return `<p class="cmp-stat cmp-stat--waiting caption">Adherents — no sourced figure in this build.</p>`;
  }

  const seeNote = adherents.display === 'see note';
  const prose = adherents.contested ? adherents.contestedNote : adherents.note;

  const headline = seeNote
    ? `<span class="cmp-stat__nofigure">No single figure</span>`
    : `<span class="mono">${esc(adherents.display)}</span>`;

  const badge = adherents.contested ? `<span class="contested-badge">Contested</span>` : '';

  const body = prose === undefined ? '' : `<p class="cmp-stat__note caption">${esc(prose)}</p>`;

  const attribution = [adherents.basis, adherents.sourceTitle]
    .filter((part): part is string => part !== undefined && part !== '')
    .map(esc)
    .join(' · ');

  return (
    `<div class="cmp-stat">` +
    `<span class="eyebrow">Adherents</span>` +
    `<span class="cmp-stat__value">${headline}${badge}</span>` +
    body +
    (attribution === '' ? '' : `<p class="cmp-stat__src caption">${attribution}</p>`) +
    `</div>`
  );
}

/* ── the grid ───────────────────────────────────────────────────────────── */

function headCell(column: CompareColumn): string {
  return (
    `<div class="cmp-headcell">` +
    `<span class="cmp-name">` +
    `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"` +
    ` style="color:var(--t-${esc(column.tradition)})"><use href="#symbol-${esc(column.tradition)}"></use></svg>` +
    `${esc(column.name)}</span>` +
    adherentHtml(column.adherents) +
    WAITING_STATS.map(
      (slot) =>
        `<p class="cmp-stat cmp-stat--waiting caption">` +
        `${esc(slot.label)} — ${esc(slot.waitingOn)}.</p>`,
    ).join('') +
    `</div>`
  );
}

function bodyCell(cell: MatrixCellView | undefined): string {
  if (cell === undefined) {
    return (
      `<div class="cmp-cell cmp-cell--empty">` +
      `<span class="caption">No record yet</span></div>`
    );
  }

  return (
    `<div class="cmp-cell${cell.contested ? ' hatch' : ''}">` +
    `<span class="cmp-cell__value">${esc(cell.label)}` +
    (cell.contested ? `<span class="contested-badge">Contested</span>` : '') +
    `</span>` +
    `<span class="cmp-cell__nuance">${esc(cell.nuance)}</span>` +
    (cell.contested && cell.contestedNote !== undefined
      ? `<span class="cmp-cell__note caption">${esc(cell.contestedNote)}</span>`
      : '') +
    `</div>`
  );
}

/**
 * All thirteen rows, always, in the spec's order — including the nine that no
 * tradition has filled. A comparison that silently omitted the empty dimensions
 * would read as a complete schema and would change shape under the reader as
 * content lands.
 */
export function renderCompare(a: CompareColumn, b: CompareColumn): string {
  const header =
    `<div class="cmp-row cmp-row--head">` +
    `<div class="cmp-dim" aria-hidden="true"></div>` +
    headCell(a) +
    headCell(b) +
    `</div>`;

  const rows = MATRIX_DIMENSIONS.map(
    (dimension) =>
      `<div class="cmp-row">` +
      `<div class="cmp-dim">${esc(MATRIX_DIMENSION_SHORT[dimension])}</div>` +
      bodyCell(a.cells[dimension]) +
      bodyCell(b.cells[dimension]) +
      `</div>`,
  ).join('');

  return header + rows;
}
