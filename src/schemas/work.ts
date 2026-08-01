import { z } from 'zod';
import { slug, sourceRef, sourcingStatus, traditionId } from './primitives.js';

/**
 * Reading Room corpus schemas — Phase 5.
 *
 * Two collections, deliberately. A corpus JSON under /docs is the owner's
 * delivery format and never the client's payload, and it is not the build's
 * working set either: a work record carries only what the library and the
 * contents page need, and each division's verses live in their own record. So
 * a route loads its own division and nothing else, and the nine-megabyte
 * Tanakh file is never held whole by anything downstream of ingestion.
 *
 * `editions` maps a language code to the source record for that edition. The
 * original language is whichever key is not `en` — derived rather than
 * declared, because "the original" differs per canon and one of them arrives
 * with no English column at all.
 */

/** A language column. `en` is the English translation; anything else is an original. */
const languageCode = z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, 'a BCP-47 language subtag');

/**
 * One verse.
 *
 * `v` is the verse number and `c` the chapter, where a canon has chapters: the
 * Quran's surahs run straight to their ayat, the Tanakh's books divide into
 * chapters first, and a Pali nikaya will divide differently again. Language
 * columns are the catchall.
 */
export const verseEntry = z
  .object({
    v: z.number().int().positive(),
    c: z.number().int().positive().optional(),
  })
  .catchall(z.string());

/**
 * A division's entry in its work's index: identity and size, never text.
 *
 * `slug` is the route segment. Numbers alone were enough for surahs; books
 * want names, so a division carries both and the route uses the slug.
 */
export const divisionIndexEntry = z.object({
  n: z.number().int().positive(),
  slug,
  name: z.string().min(1).optional(),
  /** The name in the work's own script, rendered in that script's face. */
  name_original: z.string().min(1).optional(),
  transliteration: z.string().min(1).optional(),
  verses: z.number().int().nonnegative(),
  chapters: z.number().int().positive().optional(),
  /** Which of the work's sections this division belongs to. */
  section: slug.optional(),
  /** Verses whose English column is empty, counted at ingestion. */
  english_gaps: z.number().int().nonnegative().default(0),
});

/**
 * A named grouping of divisions, where a canon has one.
 *
 * The Tanakh's Torah, Nevi'im and Ketuvim are the canon's own structure, not a
 * presentation choice, so they are data. The Quran has none and declares none.
 */
export const workSection = z.object({
  id: slug,
  name: z.string().min(1),
  name_original: z.string().min(1).optional(),
  /** Inclusive division numbers. */
  from: z.number().int().positive(),
  to: z.number().int().positive(),
});

export const workSchema = z
  .object({
    /** The corpus file's own `work` field, which is this record's id. */
    id: slug,
    tradition: traditionId,
    /** Display title of the canon, e.g. "The Quran". */
    title: z.string().min(1),
    title_original: z.string().min(1).optional(),
    /** What one division is called here: surah, book, chapter, nikaya. */
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
    sections: z.array(workSection).default([]),
    divisions: z.array(divisionIndexEntry).min(1),
    /** Totals, computed at ingestion so no page counts them again. */
    total_verses: z.number().int().positive(),
    total_chapters: z.number().int().positive().optional(),
    /** Verses across the whole work whose English column is empty. */
    english_gaps: z.number().int().nonnegative().default(0),
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

    const slugs = new Set<string>();
    for (const [i, d] of value.divisions.entries()) {
      if (slugs.has(d.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['divisions', i, 'slug'],
          message: `duplicate division slug "${d.slug}" — routes would collide`,
        });
      }
      slugs.add(d.slug);
    }

    /* A section that names divisions the work does not have would leave books
       unreachable under any heading. */
    for (const [i, s] of value.sections.entries()) {
      if (s.to < s.from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sections', i],
          message: `section "${s.id}" ends before it begins`,
        });
      }
    }
    if (value.sections.length > 0) {
      const covered = new Set<number>();
      for (const s of value.sections) for (let n = s.from; n <= s.to; n++) covered.add(n);
      const orphan = value.divisions.find((d) => !covered.has(d.n));
      if (orphan !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sections'],
          message:
            `division ${orphan.n} (${orphan.slug}) falls under no section; a work that ` +
            'declares sections must place every division in one',
        });
      }
    }
  });

/**
 * One division's text, in its own record.
 *
 * This is what a route loads, and the only thing it loads. The id is
 * `<work>--<slug>` so the collection stays flat and a division can be fetched
 * without knowing anything but its route parameters.
 */
/**
 * `<work>--<division>`, with a double hyphen so the two slugs stay separable
 * when either contains a hyphen of its own — "tanakh--song-of-solomon",
 * "guru-granth-sahib--1".
 */
const divisionId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be <work>--<division>');

export const divisionSchema = z
  .object({
    id: divisionId,
    work: slug,
    n: z.number().int().positive(),
    slug,
    verses: z.array(verseEntry).min(1),
    sourcing: sourcingStatus,
  })
  .strict();

export type Work = z.infer<typeof workSchema>;
export type WorkSection = z.infer<typeof workSection>;
export type DivisionIndexEntry = z.infer<typeof divisionIndexEntry>;
export type DivisionRecord = z.infer<typeof divisionSchema>;
export type VerseEntry = z.infer<typeof verseEntry>;
