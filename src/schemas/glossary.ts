import { z } from 'zod';
import { slug, sourceRef, sourcingStatus, traditionId } from './primitives.js';

/**
 * Glossary term schema — Phase 0 spec §8.
 *
 * "term, original (script + transliteration), pronunciation (audio ref,
 *  Phase 3), definition (max 50 words), tradition(s), see_also."
 *
 * Every technical term in any prose gets wrapped at authoring time.
 */

/** Scripts with a dedicated Noto face in the type system (design language §4.3). */
export const scriptName = z.enum([
  'latin',
  'arabic',
  'hebrew',
  'devanagari',
  'gurmukhi',
  'han-simplified',
  'han-traditional',
  'japanese',
  'tamil',
  'thai',
  'sinhala',
  'avestan',
  'greek',
  'syriac',
  'pali',
]);

/** RTL scripts need mirrored layout (design language §4.3, §10). */
export const RTL_SCRIPTS = ['arabic', 'hebrew', 'syriac'] as const;

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export const glossaryTermSchema = z
  .object({
    id: slug,
    term: z.string().min(1),
    original: z
      .object({
        /** The term in its own script, e.g. "صلاة". */
        text: z.string().min(1),
        script: scriptName,
        transliteration: z.string().min(1),
        /** BCP-47 tag so the browser shapes and directs the text correctly. */
        lang: z.string().min(2),
      })
      .optional(),
    /** Audio reference, Phase 3. Declared now so the schema never has to change. */
    pronunciation: z.string().optional(),
    definition: z
      .string()
      .min(1)
      .refine((d) => wordCount(d) <= 50, 'definitions are capped at 50 words (spec §8)'),
    traditions: z.array(traditionId).min(1),
    see_also: z.array(slug).default([]),
    sources: z.array(sourceRef).default([]),
    sourcing: sourcingStatus,
  })
  .strict();

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
