import { z } from 'zod';
import { contestable, requireContestedNote, slug, sourceRef, sourcingStatus } from './primitives.js';
import { CONSTRAINED_VALUES, MATRIX_DIMENSIONS } from '../lib/dimensions.js';

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
 *
 * The dimension list and the constrained value sets live in lib/dimensions.ts,
 * which carries no Zod, because the matrix and compare islands need them in the
 * browser and must not ship the schema layer to get them.
 */

export const matrixDimension = z.enum(MATRIX_DIMENSIONS);

export { MATRIX_DIMENSIONS, MATRIX_DIMENSION_LABELS, CONSTRAINED_VALUES } from '../lib/dimensions.js';
export type { MatrixDimension } from '../lib/dimensions.js';

const enumish = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'cell values stay kebab-case so they remain filterable');

export const matrixCellSchema = z
  .object({
    dimension: matrixDimension,
    value: enumish,
    /**
     * The authoritative rendering, used verbatim, on the same contract as
     * `adherents.display` and `founded.display`. `value` is the filter key and
     * stays kebab-case so chips keep working; the label carries the punctuation
     * and capitalisation the author wrote, which the kebab form cannot — "Cyclical,
     * no creator" and "Bible; authority varies" do not survive a round trip.
     * Absent when the mechanical transform already reproduces the authored text.
     */
    label: z.string().min(1).optional(),
    nuance: z.string().min(1, 'one to three sentences (spec §7)'),
    /* Spec §9.2.2: every matrix cell cites T1 or labelled T4. The tier check
       lives in validate-content.ts and applies once the row is source-checked;
       a row still at sourcing:"todo" may carry none, and is excluded from the
       build rather than published unsourced. */
    sources: z.array(sourceRef).default([]),
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
