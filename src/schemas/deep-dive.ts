import { z } from 'zod';
import {
  contestable,
  location,
  precision,
  requireContestedNote,
  slug,
  sourceRef,
  sourcingStatus,
  traditionId,
  year,
} from './primitives.js';
import { matrixDimension } from './matrix.js';
import { scriptName } from './glossary.js';

/**
 * Deep-dive schema — Phase 0 spec §5.
 *
 * Fourteen sections, identical order for all ten traditions, because
 * "comparability is a product feature, so the template never bends per
 * tradition" (§1.3). Bracketed items in the spec are structured fields rather
 * than prose, and they are modelled as such here: the belief matrix, year
 * wheel, life-arc rites and compare mode are all extracted from these fields,
 * never rewritten (§1.2).
 *
 * Sourcing is per block, not per document. A tradition's history may be
 * source-checked while its practices are not, and the unchecked block is held
 * out of the build on its own rather than blocking the whole page.
 */

/** A block of authored prose with its own sourcing state. */
export const proseBlock = z.object({
  body: z.string().min(1),
  sources: z.array(sourceRef).default([]),
  sourcing: sourcingStatus,
});

export type ProseBlock = z.infer<typeof proseBlock>;

/** Original-script rendering of a name or title (design language §4.3). */
export const originalScript = z.object({
  text: z.string().min(1),
  script: scriptName,
  transliteration: z.string().min(1),
  lang: z.string().min(2),
});

/* ── §5.1 Overview ──────────────────────────────────────────────────────── */

/**
 * The exhibit-label stat box. `adherents` is deliberately optional and stays
 * unset until a sourced Pew file lands: spec §9.2.4 makes Pew the authority,
 * and CLAUDE.md forbids inventing the number.
 */
export const statBox = z.object({
  adherents: z
    .object({
      display: z.string().min(1),
      estimate: z.number().int().nonnegative().optional(),
      source: sourceRef.optional(),
      year: z.number().int().min(1900).max(2100).optional(),
      basis: z.string().optional(),
      note: z.string().optional(),
      ...contestable,
    })
    .superRefine(requireContestedNote)
    .optional(),
  founded: z.string().min(1),
  origin_region: slug.optional(),
  primary_texts: z.array(z.string().min(1)).default([]),
  branches_summary: z.string().optional(),
  calendar: z.string().optional(),
  symbol: slug.optional(),
});

/* ── §5.4 Sacred texts ──────────────────────────────────────────────────── */

export const canonEntry = z
  .object({
    id: slug,
    title: z.string().min(1),
    original: originalScript.optional(),
    language: z.string().min(1),
    composition: z.string().min(1),
    /** Canonical status, which genuinely differs per branch. */
    status: z.string().min(1),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
    ...contestable,
  })
  .superRefine(requireContestedNote);

/* ── §5.6 Practices and worship ─────────────────────────────────────────── */

export const practiceEntry = z
  .object({
    id: slug,
    name: z.string().min(1),
    original: originalScript.optional(),
    /** prayer, liturgy, meditation, fasting, pilgrimage, almsgiving… */
    kind: z.string().min(1),
    frequency: z.string().optional(),
    summary: z.string().min(1),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
    ...contestable,
  })
  .superRefine(requireContestedNote);

/* ── §5.13 Common misconceptions ────────────────────────────────────────── */

/**
 * Spec §9.3.5: misconception entries correct factual errors only, never
 * theological disputes. Each is sourced (§5.13).
 */
export const misconception = z.object({
  id: slug,
  claim: z.string().min(1),
  correction: z.string().min(1),
  sources: z.array(sourceRef).default([]),
  sourcing: sourcingStatus,
});

/* ── the document ───────────────────────────────────────────────────────── */

export const deepDiveSchema = z
  .object({
    id: slug,
    tradition: traditionId,
    /** Display name, and the name in its own script (design language §4.3). */
    name: z.string().min(1),
    original: originalScript.optional(),
    /** One line under the masthead. */
    subtitle: z.string().min(1),

    /* 1. Overview */
    stat_box: statBox,
    overview: proseBlock.optional(),

    /* 2. Origins and history. The timeline link is generated from `tradition`. */
    origins: proseBlock.optional(),
    /** Period headings for the history prose, e.g. "610–632 CE". */
    origins_period: z
      .object({ from: year, to: year.optional(), precision })
      .optional(),

    /* 3. Core beliefs — prose keyed to the matrix dimensions */
    core_beliefs: proseBlock.optional(),
    belief_dimensions: z.array(matrixDimension).default([]),

    /* 4. Sacred texts */
    canon: z.array(canonEntry).default([]),

    /* 5. Branches — rendered from the taxonomy, so no data lives here. */

    /* 6. Practices and worship */
    practices: z.array(practiceEntry).default([]),

    /* 7. Law and ethics — matrix cells plus optional framing prose */
    law_and_ethics: proseBlock.optional(),
    law_dimensions: z.array(matrixDimension).default([]),

    /* 8. Rites of passage — life-arc records, Phase 3. Declared so the schema
       never has to change when that phase lands. */
    rites: z
      .array(
        z.object({
          id: slug,
          stage: z.enum(['birth', 'coming-of-age', 'marriage', 'death']),
          name: z.string().min(1),
          summary: z.string().min(1),
          sources: z.array(sourceRef).default([]),
          sourcing: sourcingStatus,
        }),
      )
      .default([]),

    /* 9. Holy days — ids into the `festivals` collection (feeds the year wheel) */
    festivals: z.array(slug).default([]),

    /* 10. Sacred sites — ids into the `sites` collection (feeds the map layer) */
    sites: z.array(slug).default([]),

    /* 11. Key figures — ids into the `figures` collection (feeds the network) */
    figures: z.array(slug).default([]),

    /* 12. Demographics — Pew, pending the owner's file */
    demographics: proseBlock.optional(),

    /* 13. Common misconceptions, 3 to 5 */
    misconceptions: z.array(misconception).default([]),

    /* 14. Sources and further reading — beyond those cited inline */
    further_reading: z.array(sourceRef).default([]),

    sourcing: sourcingStatus,
  })
  .superRefine((value, ctx) => {
    if (value.misconceptions.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['misconceptions'],
        message: 'the spec caps misconceptions at five (§5.13)',
      });
    }
    if (value.id !== value.tradition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'one deep dive per tradition; id must equal tradition',
      });
    }
  });

export type DeepDive = z.infer<typeof deepDiveSchema>;

/* ── cross-module record collections (spec §11) ─────────────────────────── */

/** Festival records feed the year wheel (Phase 3). */
export const festivalSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    original: originalScript.optional(),
    traditions: z.array(traditionId).min(1),
    /** Spec §7 dimension 13 vocabulary. */
    calendar: z.enum(['solar', 'lunar', 'lunisolar']),
    /** How the date is determined, in words. Never a computed date. */
    date_rule: z.string().min(1),
    /** Observed dates by Gregorian year, where /docs supplies them. */
    observed: z.record(z.string().regex(/^\d{4}$/), z.string().regex(/^\d{2}-\d{2}$/)).default({}),
    /** Length in days, for festivals that span. */
    span_days: z.number().int().positive().optional(),
    summary: z.string().optional(),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
  })
  .strict();

/** Site records feed the map's sites layer (Phase 2). */
export const siteSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    original: originalScript.optional(),
    traditions: z.array(traditionId).min(1),
    location: location.optional(),
    region: slug.optional(),
    significance: z.string().min(1),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
  })
  .strict();

/** Figure records feed the influence network (Phase 4). */
export const figureSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    original: originalScript.optional(),
    traditions: z.array(traditionId).min(1),
    born: z.object({ year, precision }).optional(),
    died: z.object({ year, precision }).optional(),
    role: z.string().min(1),
    summary: z.string().min(1),
    /** Related event ids. */
    events: z.array(slug).default([]),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
  })
  .strict();

export type Festival = z.infer<typeof festivalSchema>;
export type Site = z.infer<typeof siteSchema>;
export type Figure = z.infer<typeof figureSchema>;
