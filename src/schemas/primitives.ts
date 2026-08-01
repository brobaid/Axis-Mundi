import { z } from 'zod';

/**
 * Shared primitives for every Axis Mundi content schema.
 *
 * Field names throughout the schemas are snake_case because the Phase 0 spec
 * (docs/religions-dashboard-phase0-spec.md §3) writes them that way, and
 * CLAUDE.md requires the schemas mirror it exactly.
 */

/** Stable, lowercase, hyphenated identifier. Never recycled once published. */
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphenated slug');

/**
 * Astronomical year. Negative = BCE, so sorting is pure integer math
 * (spec §3). There is no year zero in the historical record, but the
 * astronomical convention keeps 1 BCE = 0; we reject 0 to force authors to be
 * explicit rather than silently off by one.
 */
export const year = z
  .number()
  .int('years are integers; use `precision` to express uncertainty')
  .min(-4000, 'earlier than the content scope of the product')
  .max(2100)
  .refine((y) => y !== 0, 'there is no year 0; use -1 for 1 BCE or 1 for 1 CE');

/** Spec §3: drives rendering, e.g. "c. 563 BCE". Never silently round (§9.2.6). */
export const precision = z.enum(['exact', 'year', 'decade', 'century', 'era']);

/** Spec §2.1 — the launch ten. `chinese` is the Confucian-Taoist-folk cluster. */
export const TRADITION_IDS = [
  'christianity',
  'islam',
  'judaism',
  'hinduism',
  'buddhism',
  'sikhism',
  'chinese',
  'jainism',
  'shinto',
  'zoroastrianism',
] as const;

export const traditionId = z.enum(TRADITION_IDS);
export type TraditionId = (typeof TRADITION_IDS)[number];

/**
 * Spec §2.2: maximum drill depth is 3 (tradition, family, denomination).
 * Deeper granularity is prose inside deep dives, not lanes.
 */
export const MAX_DRILL_DEPTH = 3;

export const branchPath = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/, 'must be a slug path')
  .refine(
    (p) => p.split('/').length <= MAX_DRILL_DEPTH,
    `maximum drill depth is ${MAX_DRILL_DEPTH} (tradition/family/denomination)`,
  )
  .refine(
    (p) => (TRADITION_IDS as readonly string[]).includes(p.split('/')[0] ?? ''),
    'the first segment must be one of the ten launch traditions',
  );

/** Spec §9.1 source tiers. T4 is tradition-internal and always labelled as such. */
export const sourceTier = z.enum(['T1', 'T2', 'T3', 'T4']);

/** A reference to an entry in the `sources` collection. */
export const sourceRef = slug;

/**
 * Spec §10: `contested` is a first-class citizen across every schema and always
 * renders — badge, dashed line, or hatching, plus a note citing both positions.
 * Silence is never the treatment for a dispute, so the note is structurally
 * required whenever the flag is set. Silently dropping it is a bug (CLAUDE.md).
 */
export const contestable = {
  contested: z.boolean().default(false),
  contested_note: z.string().min(1).optional(),
};

/**
 * Applies spec §9.2.3 ("every contested item cites both positions") to any
 * object carrying the contestable fields plus a `sources` array.
 */
export function requireContestedNote<
  T extends { contested: boolean; contested_note?: string | undefined },
>(value: T, ctx: z.RefinementCtx): void {
  if (value.contested && (value.contested_note === undefined || value.contested_note.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contested_note'],
      message:
        'contested items must carry a note citing both positions (Phase 0 spec §9.2.3, §10)',
    });
  }
  if (!value.contested && value.contested_note !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contested_note'],
      message: 'contested_note is set but contested is false — set contested: true or drop the note',
    });
  }
}

/** Spec §3: precise pin where one exists. */
export const location = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Spec §3 / design language §5: every image sits on a framed plate with caption
 * and credit. The credit line is mandatory, so it is required here.
 */
export const media = z.object({
  src: z.string().min(1),
  alt: z.string().min(1, 'alt text is mandatory on all plates (design language §10)'),
  caption: z.string().optional(),
  credit: z.string().min(1, 'a credit line is mandatory on every plate'),
  license: z.string().min(1, 'media licensing is required by Phase 0'),
});

/**
 * Sourcing status. Content that is not yet source-checked is marked here and is
 * excluded from production builds by default (CLAUDE.md hard rule 2). Set
 * INCLUDE_TODO_SOURCING=true to include it in a preview build.
 */
/**
 * How a statement earns its place in a build.
 *
 * `sourced` cites the collection; `todo` is held out of production.
 *
 * `editorial` is neither. A scholar cannot source a sentence about this
 * museum's own conventions — "organised at launch into three vehicles" is a
 * rendering decision, not a claim about Buddhism, and citing Harvey for it
 * would put a historian's name behind a choice this site made. Editorial
 * statements publish without a citation and may only describe the museum's own
 * rules and rendering; a claim about a tradition is never editorial.
 */
export const sourcingStatus = z.enum(['sourced', 'todo', 'editorial']).default('sourced');

/** Era snapshots locked by Phase 0 §6. Defined in lib/eras.ts, which carries no
    Zod dependency so the map island can import it without bundling the schemas. */
export { ERA_SNAPSHOTS } from '../lib/eras.js';
