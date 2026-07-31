import { z } from 'zod';
import {
  MAX_DRILL_DEPTH,
  contestable,
  precision,
  requireContestedNote,
  slug,
  sourceRef,
  sourcingStatus,
  traditionId,
  year,
} from './primitives.js';

/**
 * Taxonomy node schema — Phase 0 spec §2.2.
 *
 * "Every node carries: id, name, parent, founded (year + precision), status
 *  (living | historical), adherents (estimate + source + year), contested
 *  (bool + note), summary (1 sentence)."
 */

export const nodeStatus = z.enum(['living', 'historical']);

/**
 * Spec §9.2.4 — adherent counts are Pew unless explicitly noted otherwise.
 *
 * `display` is the authoritative rendering and is used verbatim: the sourcing
 * memo fixes the exact string, including its unit and its parenthetical. Two
 * traditions have no honest point estimate at all — Shinto, where shrine
 * registers and self-identification disagree by an order of magnitude, and the
 * Chinese cluster, where formal affiliation and folk practice are different
 * questions. Neither is coerced to a number, so `estimate` is optional and
 * `contested` carries the dispute.
 */
export const adherents = z
  .object({
    display: z.string().min(1),
    estimate: z.number().int().nonnegative().optional(),
    source: sourceRef,
    year: z.number().int().min(1900).max(2100).optional(),
    /** Why this basis, when it is not a Pew enumeration. */
    basis: z.string().optional(),
    note: z.string().optional(),
    ...contestable,
  })
  .superRefine(requireContestedNote);

/**
 * Spec §2.2 — "Currents vs branches." Movements that cut across branches
 * (Sufism, Kabbalah, bhakti, charismatic renewal) are modelled as currents:
 * tags that span nodes, NEVER lanes. This is a hard rule; Sufism is not a lane
 * under Islam. Currents therefore live as a field on the node, and nothing in
 * the timeline may render them as lanes.
 */
export const current = z.object({
  id: slug,
  name: z.string().min(1),
  summary: z.string().min(1),
  /** Node ids this current cuts across. */
  spans: z.array(slug).default([]),
  sources: z.array(sourceRef).default([]),
  ...contestable,
});

export const taxonomyNodeSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    /** Null at the tradition level; a node id otherwise. */
    parent: slug.nullable(),
    tradition: traditionId,
    /** Full slug path, e.g. "christianity/protestant/lutheran". Depth <= 3. */
    path: z.string().min(1),
    depth: z.number().int().min(1).max(MAX_DRILL_DEPTH),
    founded: z
      .object({
        year: year.optional(),
        precision: precision.optional(),
      })
      .default({}),
    status: nodeStatus,
    adherents: adherents.optional(),
    ...contestable,
    summary: z.string().min(1, 'one sentence, per spec §2.2'),
    /** Tradition-level nodes may declare currents; branches inherit them. */
    currents: z.array(current).default([]),
    /** Line-art identifier, drawn on the 24px grid. Identifiers only, never decoration. */
    symbol: slug.optional(),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
    /** Display order within the parent. */
    order: z.number().int().nonnegative().default(0),
  })
  .superRefine((value, ctx) => {
    requireContestedNote(value, ctx);

    const segments = value.path.split('/');

    if (segments.length !== value.depth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depth'],
        message: `depth ${value.depth} does not match path "${value.path}" (${segments.length} segments)`,
      });
    }

    if (segments[0] !== value.tradition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: `path must start with the tradition id "${value.tradition}"`,
      });
    }

    if (segments.at(-1) !== value.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: `path must end with the node id "${value.id}"`,
      });
    }

    if (value.depth === 1 && value.parent !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent'],
        message: 'tradition-level nodes have no parent',
      });
    }

    if (value.depth > 1 && value.parent === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent'],
        message: 'only tradition-level nodes may have a null parent',
      });
    }

    if (value.depth > 1 && value.currents.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currents'],
        message: 'currents are declared at the tradition level and span nodes (spec §2.2)',
      });
    }
  });

export type TaxonomyNode = z.infer<typeof taxonomyNodeSchema>;
