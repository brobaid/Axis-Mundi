import { z } from 'zod';
import { contestable, requireContestedNote, slug, sourceRef, sourcingStatus } from './primitives.js';

/**
 * Belief matrix schema — Phase 0 spec §7.
 *
 * Thirteen columns, in the spec's order. Every cell is {value, nuance, source}
 * where `value` is enum-ish so cells stay filterable, and `nuance` is 1 to 3
 * sentences. Rows are the ten traditions plus major branches where a cell
 * genuinely differs (~15 rows at launch).
 *
 * Spec §2 principle: the matrix is EXTRACTED from deep-dive structured fields,
 * never rewritten. These records are the extraction target.
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

export const matrixDimension = z.enum(MATRIX_DIMENSIONS);
export type MatrixDimension = (typeof MATRIX_DIMENSIONS)[number];

/** Human-facing column headings, in spec §7 order. */
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
 * The three dimensions the spec enumerates explicitly. The rest are "enum-ish":
 * free strings kept in kebab-case so they still filter cleanly.
 */
export const CONSTRAINED_VALUES = {
  'divine-concept': ['monotheist', 'non-theist', 'polytheist', 'monist', 'varies'],
  afterlife: ['resurrection', 'reincarnation', 'rebirth', 'ancestral-realm', 'varies', 'none'],
  'calendar-system': ['solar', 'lunar', 'lunisolar'],
} as const satisfies Partial<Record<MatrixDimension, readonly string[]>>;

const enumish = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'cell values stay kebab-case so they remain filterable');

export const matrixCellSchema = z
  .object({
    dimension: matrixDimension,
    value: enumish,
    nuance: z.string().min(1, 'one to three sentences (spec §7)'),
    /* Spec §9.2.2: every matrix cell cites T1 or labelled T4. Tier is verified
       against the sources collection by validate-content.ts. */
    sources: z.array(sourceRef).min(1, 'every matrix cell cites a source (spec §9.2.2)'),
    ...contestable,
  })
  .superRefine((value, ctx) => {
    requireContestedNote(value, ctx);

    const allowed = (CONSTRAINED_VALUES as Record<string, readonly string[] | undefined>)[
      value.dimension
    ];
    if (allowed !== undefined && !allowed.includes(value.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `"${value.value}" is not a permitted value for ${value.dimension}; expected one of: ${allowed.join(', ')}`,
      });
    }
  });

export const matrixRowSchema = z
  .object({
    id: slug,
    /** The taxonomy node this row describes — a tradition or a major branch. */
    node: slug,
    label: z.string().min(1),
    order: z.number().int().nonnegative().default(0),
    cells: z.array(matrixCellSchema),
    sourcing: sourcingStatus,
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [i, cell] of value.cells.entries()) {
      if (seen.has(cell.dimension)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cells', i, 'dimension'],
          message: `duplicate cell for dimension "${cell.dimension}"`,
        });
      }
      seen.add(cell.dimension);
    }
  });

export type MatrixCell = z.infer<typeof matrixCellSchema>;
export type MatrixRow = z.infer<typeof matrixRowSchema>;
