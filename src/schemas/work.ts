import { z } from 'zod';
import { slug, sourceRef, sourcingStatus, traditionId } from './primitives.js';

/**
 * Reading Room corpus schema — Phase 5.
 *
 * One record per canon, in the paired shape the owner's corpora arrive in:
 * a flat verse list keyed by division and verse number, with one column per
 * edition. Nine more canons land in this shape, so nothing here may know what
 * a surah is.
 *
 * `editions` maps a language code to the source record for that edition. The
 * original language is whichever key is not `en` — the reader derives it
 * rather than being told, because "the original" differs per canon and one of
 * them (the Guru Granth Sahib) arrives with no English column at all.
 *
 * The licensing reality the memo states once: original-language scripture is
 * public domain, modern English translation mostly is not, so these editions
 * are public-domain or CC0 and named on every page. That is why a text page is
 * sourced content like any other record and passes the same gate.
 */

/** A language column. `en` is the English translation; anything else is an original. */
const languageCode = z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, 'a BCP-47 language subtag');

/**
 * One verse.
 *
 * `s` is the division (surah, chapter, book) and `a` the verse within it —
 * the corpus's own field names, kept rather than renamed so a delivered file
 * needs no transformation to enter the build.
 */
export const verseEntry = z
  .object({
    s: z.number().int().positive(),
    a: z.number().int().positive(),
  })
  .catchall(z.string());

/**
 * A division's own identity, when the corpus can supply it.
 *
 * The Quran pilot cannot: the paired file carries numbers and text and no
 * surah names in either script. Rather than invent a hundred and fourteen of
 * them, the heading renders what the record holds, and this field waits for a
 * names file that would close the gap without touching the engine.
 */
export const divisionMeta = z.object({
  n: z.number().int().positive(),
  name: z.string().min(1).optional(),
  /** The name in the work's own script, rendered in that script's face. */
  name_original: z.string().min(1).optional(),
  transliteration: z.string().min(1).optional(),
});

export const workSchema = z
  .object({
    /** The corpus file's own `work` field, which is this record's id. */
    id: slug,
    tradition: traditionId,
    /** Display title of the canon, e.g. "The Quran". */
    title: z.string().min(1),
    title_original: z.string().min(1).optional(),
    /** What one division is called here: surah, chapter, book, nikaya. */
    division_label: z.string().min(1),
    division_label_plural: z.string().min(1),
    /** The script the original is set in, for the font stack and `lang`. */
    script: z.enum(['arabic', 'hebrew', 'devanagari', 'gurmukhi', 'han', 'latin', 'japanese']),
    /** Right-to-left originals need the whole verse block reversed, not just the text. */
    direction: z.enum(['ltr', 'rtl']).default('ltr'),
    editions: z.record(languageCode, sourceRef).refine(
      (e) => Object.keys(e).some((k) => k !== 'en'),
      'a work needs an original-language edition; English alone is not a corpus',
    ),
    /**
     * The English slot's honest waiting-on note, for a canon that arrives
     * original-only. Required exactly when there is no English edition, so the
     * gap is always named rather than silently empty.
     */
    english_pending: z.string().min(1).optional(),
    /** Anything the reader must state on the page, e.g. a survival fraction. */
    note: z.string().min(1).optional(),
    divisions: z.array(divisionMeta).default([]),
    verses: z.array(verseEntry).min(1),
    sourcing: sourcingStatus,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasEnglish = value.editions['en'] !== undefined;
    if (!hasEnglish && value.english_pending === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['english_pending'],
        message:
          'a work with no English edition must say what its English slot is waiting on ' +
          '(named absence, never filler)',
      });
    }
    if (hasEnglish && value.english_pending !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['english_pending'],
        message: 'english_pending is for works that have no English edition',
      });
    }

    /* Every verse must carry text in every edition the work declares, or the
       page would cite an edition for a blank. A per-verse gap is legitimate
       only in the language whose whole column is pending. */
    const langs = Object.keys(value.editions);
    for (const [i, verse] of value.verses.entries()) {
      for (const lang of langs) {
        const text = (verse as Record<string, unknown>)[lang];
        if (typeof text !== 'string' || text.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['verses', i, lang],
            message: `verse ${verse.s}:${verse.a} has no ${lang} text, but the work cites an ${lang} edition`,
          });
          return; /* one is enough; a systematic gap would print thousands */
        }
      }
    }
  });

export type Work = z.infer<typeof workSchema>;
export type VerseEntry = z.infer<typeof verseEntry>;
export type DivisionMeta = z.infer<typeof divisionMeta>;
