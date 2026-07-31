import { z } from 'zod';
import {
  contestable,
  requireContestedNote,
  slug,
  sourceRef,
  sourcingStatus,
  traditionId,
} from './primitives.js';
import { originalScript } from './deep-dive.js';

/**
 * Sacred text records — spec §5.4, "canon table [text, language, composition
 * date, canonical status per branch]".
 *
 * A standalone collection rather than a field on the deep dive, for the same
 * reason festivals, sites and figures are standalone: the canon table is one
 * consumer, and the stat box (§5.1 "primary texts") and compare mode are
 * others. A text belongs to a tradition, not to a page.
 *
 * `primary` marks the one text a tradition is named by — what the stat box and
 * the compare column show when there is room for a single line. Exactly one per
 * tradition, asserted in validate-content.ts, because "the principal scripture"
 * is a claim that stops meaning anything if two records make it.
 *
 * Language, composition and canonical status are optional. The spec wants all
 * three in the canon table eventually, but a principal-scripture record can be
 * complete and useful without them, and requiring them would hold up rows that
 * are otherwise ready. A record that has them renders the fuller table; one
 * that does not renders what it has.
 */
export const textSchema = z
  .object({
    id: slug,
    tradition: traditionId,
    title: z.string().min(1),
    /** Original script and transliteration, per design language §4.3. */
    original: originalScript.optional(),
    language: z.string().min(1).optional(),
    /** Free text: composition is a span or a tradition far more often than a year. */
    composition: z.string().min(1).optional(),
    /** Canonical status, which genuinely differs per branch. */
    status: z.string().min(1).optional(),
    primary: z.boolean().default(false),
    /**
     * Where "principal scripture" is itself a simplification — no single canon,
     * an oral primacy, a corpus rather than a book. Rendered verbatim beside the
     * title so the qualification travels with the claim.
     */
    note: z.string().optional(),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
    ...contestable,
  })
  .superRefine(requireContestedNote);

export type SacredText = z.infer<typeof textSchema>;
