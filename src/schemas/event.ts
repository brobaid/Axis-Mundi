import { z } from 'zod';
import {
  branchPath,
  contestable,
  location,
  media,
  precision,
  requireContestedNote,
  slug,
  sourceRef,
  sourcingStatus,
  traditionId,
  year,
} from './primitives.js';

/**
 * The event schema — "the single most load-bearing structure in the product"
 * (Phase 0 spec §3). Every timeline, filter, map pin, and influence thread
 * hangs off this. Fields and order mirror the spec table exactly.
 */

/** Spec §3.1 — event type enum. */
export const eventType = z.enum([
  'founding',
  'schism',
  'text', // composition or canonization
  'figure', // birth, death, ministry
  'council',
  'political', // conquest, adoption, edict
  'reform',
  'expansion', // migration, mission
  'persecution',
  'construction', // temple, site
  'encounter', // interfaith contact
  'modern', // movement, event post-1800
]);

/** Spec §4 — importance rubric. Controls zoom-level visibility. */
export const importance = z
  .number()
  .int()
  .min(1, 'importance runs 1 (texture) to 5 (civilization-scale)')
  .max(5);

/** Spec §3 — influence edges feeding the Phase 3 influence threads. */
export const influenceEdge = z.object({
  target: slug,
  relation: z.string().min(1),
  contested: z.boolean().default(false),
});

export const eventSchema = z
  .object({
    id: slug,
    title: z.string().min(1).max(60, 'display titles are capped at 60 characters (spec §3)'),
    year_start: year,
    year_end: year.optional(),
    precision,
    /** Generated from year + precision when omitted; see src/lib/display-date.ts. */
    display_date: z.string().optional(),
    traditions: z
      .array(traditionId)
      .min(1, 'every event names at least one tradition')
      /* Spec §3: "Multi-tradition events are one record, never duplicated." */
      .refine((t) => new Set(t).size === t.length, 'duplicate tradition ids'),
    branch_path: z.array(branchPath).min(1, 'lane placement requires at least one branch path'),
    type: eventType,
    importance,
    region: z.array(slug).default([]),
    location: location.optional(),
    summary: z.string().min(1).max(400, 'the card summary is 1 to 2 sentences'),
    body: z.string().optional(),
    media: z.array(media).default([]),
    sources: z.array(sourceRef).default([]),
    ...contestable,
    links: z
      .object({
        events: z.array(slug).default([]),
        figures: z.array(slug).default([]),
        deep_dive: z.string().optional(),
      })
      .default({ events: [], figures: [] }),
    influence: z.array(influenceEdge).default([]),
    tags: z.array(slug).default([]),
    sourcing: sourcingStatus,
  })
  .superRefine((value, ctx) => {
    requireContestedNote(value, ctx);

    if (value.year_end !== undefined && value.year_end < value.year_start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['year_end'],
        message: 'year_end precedes year_start',
      });
    }

    /* Spec §9.2.1 — every event of importance 3+ cites at least one source.
       Tier is checked against the sources collection in validate-content.ts,
       which is where cross-file referential integrity lives. */
    if (value.importance >= 3 && value.sources.length === 0 && value.sourcing === 'sourced') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sources'],
        message:
          'events of importance 3+ must cite at least one T1–T3 source (spec §9.2.1); ' +
          'set sourcing: "todo" to park it out of the build instead',
      });
    }

    /* Spec §3: branch_path determines lane placement, so each path must belong
       to a tradition the event actually names. */
    for (const [i, path] of value.branch_path.entries()) {
      const root = path.split('/')[0];
      if (root !== undefined && !(value.traditions as readonly string[]).includes(root)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branch_path', i],
          message: `"${root}" is not in this event's traditions list`,
        });
      }
    }
  });

export type AxisEvent = z.infer<typeof eventSchema>;
