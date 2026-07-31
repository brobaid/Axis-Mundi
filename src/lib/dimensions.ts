/**
 * The thirteen belief-matrix dimensions (Phase 0 spec §7).
 *
 * Zod-free on purpose. The matrix and compare islands both need this list in
 * the browser, and importing it from `src/schemas/matrix.ts` would drag the
 * whole schema layer into their bundles — the mistake the era list made in M3,
 * which cost 54 kB before it was caught. The schema imports from here; never
 * the other way round.
 */

export const MATRIX_DIMENSIONS = [
  'divine-concept',
  'cosmology',
  'afterlife',
  'salvation-path',
  'scripture-authority',
  'clergy-leadership',
  'worship-form',
  'dietary-law',
  'dress-modesty',
  'conversion-stance',
  'ethical-frame',
  'view-of-others',
  'calendar-system',
] as const;

export type MatrixDimension = (typeof MATRIX_DIMENSIONS)[number];

/** Human-facing headings, verbatim from spec §7. Used wherever there is room. */
export const MATRIX_DIMENSION_LABELS: Record<MatrixDimension, string> = {
  'divine-concept': 'Concept of the divine',
  cosmology: 'Cosmology and creation',
  afterlife: 'Afterlife',
  'salvation-path': 'Path to salvation or liberation',
  'scripture-authority': 'Scripture and authority structure',
  'clergy-leadership': 'Clergy and leadership',
  'worship-form': 'Worship form and frequency',
  'dietary-law': 'Dietary law',
  'dress-modesty': 'Dress and modesty codes',
  'conversion-stance': 'Conversion and missionary stance',
  'ethical-frame': 'Core ethical frame',
  'view-of-others': 'View of other religions',
  'calendar-system': 'Calendar system',
};

/**
 * Column headings for the matrix table and the compare grid's dimension rail.
 * Thirteen full headings would set a table wider than any phone; these are the
 * same names cut to the noun that identifies them. The full heading is always
 * one tap away in the cell's panel, so nothing is lost, only deferred.
 */
export const MATRIX_DIMENSION_SHORT: Record<MatrixDimension, string> = {
  'divine-concept': 'Divine concept',
  cosmology: 'Cosmology',
  afterlife: 'Afterlife',
  'salvation-path': 'Salvation path',
  'scripture-authority': 'Scripture',
  'clergy-leadership': 'Clergy',
  'worship-form': 'Worship',
  'dietary-law': 'Dietary law',
  'dress-modesty': 'Dress',
  'conversion-stance': 'Conversion',
  'ethical-frame': 'Ethical frame',
  'view-of-others': 'View of others',
  'calendar-system': 'Calendar',
};

/**
 * The three dimensions the spec closes to a fixed set. Everything else is
 * "enum-ish": a free string held to kebab-case so it still filters cleanly.
 */
export const CONSTRAINED_VALUES = {
  'divine-concept': ['monotheist', 'non-theist', 'polytheist', 'monist', 'varies'],
  afterlife: ['resurrection', 'reincarnation', 'rebirth', 'ancestral-realm', 'varies', 'none'],
  'calendar-system': ['solar', 'lunar', 'lunisolar'],
} as const satisfies Partial<Record<MatrixDimension, readonly string[]>>;

/**
 * Values whose hyphen belongs to the word rather than separating two of them.
 * Nothing distinguishes `non-theist` from `ancestral-realm` mechanically, so
 * the exceptions are named. This is display only — the stored value never
 * changes, or it would stop matching its filter.
 */
const VALUE_LABEL_EXCEPTIONS: Record<string, string> = {
  'non-theist': 'Non-theist',
};

/** Kebab-case cell value to display text: `generally-none` → `Generally none`. */
export const valueLabel = (value: string): string =>
  VALUE_LABEL_EXCEPTIONS[value] ??
  value.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
