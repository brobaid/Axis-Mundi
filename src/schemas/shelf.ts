import { z } from 'zod';
import { slug, sourcingStatus, traditionId } from './primitives.js';

/**
 * The Reading Room's acquisition plan — Phase 5.
 *
 * One record per canon the owner's scope table names, whether or not its text
 * has entered the build. A shelved canon's row points at its corpus; an
 * unshelved one says what the room is waiting on and, where no clean English
 * edition exists at all, says that instead of leaving the slot blank. The
 * memo's rule: named absence, never filler.
 *
 * `sourcing` here is `editorial` by nature. A scholar cannot source a sentence
 * about which corpus this museum has acquired next — the claim is the museum's
 * own, and citing anyone for it would be a false citation.
 *
 * A canon already on the shelves needs no record here: the work itself is the
 * row, and duplicating it would give the page two places to disagree with
 * itself about what is readable.
 */
export const shelfSchema = z
  .object({
    id: slug,
    tradition: traditionId,
    title: z.string().min(1),
    /** The scope table's own order. */
    order: z.number().int().positive(),
    /** The original-language text named in the plan. */
    original: z.string().min(1),
    /** The English edition named in the plan, where the plan names one. */
    english: z.string().min(1).optional(),
    /**
     * Named absence, for a canon with no public-domain English of quality.
     * Rendered in the English slot's place, never beside it.
     */
    english_unresolved: z.string().min(1).optional(),
    /** What the room is waiting on, and anything a reader must know first. */
    status: z.string().min(1),
    /**
     * Deep-dive canon rows that point at this shelf row.
     *
     * A dive's canon table names texts by its own ids, and they do not always
     * match one to one: Shinto's row covers the Kojiki and the Nihon Shoki
     * where the plan covers only the Kojiki, and the Chinese dive splits into
     * two rows where the plan has one. Stating the mapping here keeps the
     * link on the dive honest about which text is actually coming.
     */
    canon_ids: z.array(slug).default([]),
    sourcing: sourcingStatus,
  })
  .strict()
  .superRefine((value, ctx) => {
    const named = value.english !== undefined;
    const unresolved = value.english_unresolved !== undefined;
    if (named === unresolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['english'],
        message:
          'a shelf row names an English edition or says why it cannot — exactly one, ' +
          'because an empty English slot is the one thing the memo forbids',
      });
    }
  });

export type ShelfRow = z.infer<typeof shelfSchema>;
