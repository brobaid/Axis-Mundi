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
/*
  Two or three letters: `ar`, `he`, `en` are 639-1, and `pli` is the 639-3 tag
  for Pali, which has no two-letter form. A corpus arrives in whatever code its
  deliverer uses and the page sets `lang` from it, so this has to admit both.
*/
const languageCode = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, 'an ISO 639-1 or 639-3 language subtag');

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
 * A chapter's entry in its division's index: identity, size and a first line.
 *
 * The chapter is the leaf a reader is sent to, so it is the unit that has to be
 * small: a page is one chapter of one book, and no page anywhere in the room is
 * allowed past a hundred kilobytes. The preview is the chapter's own opening
 * words, lifted at ingestion, so a contents page of a hundred and fifty psalms
 * is navigable by what they say rather than by their numbers alone.
 */
export const chapterIndexEntry = z.object({
  c: z.number().int().positive(),
  verses: z.number().int().nonnegative(),
  /** The opening words, truncated at ingestion. Never authored here. */
  preview: z.string().min(1).optional(),
  /** Which language the preview is in, since a chapter may open English-only. */
  preview_lang: z.string().min(1).optional(),
  english_gaps: z.number().int().nonnegative().default(0),
  original_gaps: z.number().int().nonnegative().default(0),
  /**
   * Verses carrying no text in any edition — counted in both gap totals above,
   * because they are missing from both, and named here because the page says
   * so once rather than twice.
   */
  blank: z.number().int().nonnegative().default(0),
});

/**
 * A division's entry in its work's index: identity and size, never text.
 *
 * `slug` is the route segment. Numbers alone were enough for surahs; books
 * want names, so a division carries both and the route uses the slug.
 *
 * `chapters` present means the division is a contents page and its text lives
 * one level down, a record per chapter. Absent means the division *is* the
 * leaf — a surah runs straight to its ayat and has nothing to list.
 */
export const divisionIndexEntry = z.object({
  n: z.number().int().positive(),
  slug,
  name: z.string().min(1).optional(),
  /** The name in the work's own script, rendered in that script's face. */
  name_original: z.string().min(1).optional(),
  /**
   * What the division's own name means, where the canon names it in its own
   * language and the delivery carries a rendering — Yamakavagga / Pairs. Not a
   * translation this museum makes; one it was given.
   */
  name_gloss: z.string().min(1).optional(),
  /** First and last verse numbers, where a canon numbers continuously across
   *  divisions and a reader needs to know which range a division holds. */
  verse_from: z.number().int().positive().optional(),
  verse_to: z.number().int().positive().optional(),
  transliteration: z.string().min(1).optional(),
  verses: z.number().int().nonnegative(),
  chapters: z.array(chapterIndexEntry).optional(),
  /** Which of the work's sections this division belongs to. */
  section: slug.optional(),
  /** Verses whose English column is empty, counted at ingestion. */
  english_gaps: z.number().int().nonnegative().default(0),
  /** Verses whose original-language column is empty. The reverse happens too. */
  original_gaps: z.number().int().nonnegative().default(0),
  /**
   * Verses carrying no text in any edition — counted in both gap totals above,
   * because they are missing from both, and named here because the page says
   * so once rather than twice.
   */
  blank: z.number().int().nonnegative().default(0),
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
  /**
   * A line every page inside this section carries.
   *
   * The Bible's Old Testament is English-only here by ruling, because its
   * Hebrew lives in the Tanakh room in Masoretic order — a fact that belongs on
   * every one of those 929 pages, not only on a contents page nobody has to
   * pass through.
   */
  note: z.string().min(1).optional(),
  /** Inclusive division numbers. */
  from: z.number().int().positive(),
  to: z.number().int().positive(),
});

/**
 * An opening line a canon's own convention puts above its first verse.
 *
 * The Quran's mushaf opens every surah but at-Tawba with the basmala, and it
 * is not a numbered verse of those surahs. It is fidelity, not a preference:
 * a page that leaves it out is not showing the text as the tradition sets it.
 *
 * The words are lifted from the corpus at ingestion — surah 1 carries the
 * basmala as its own first verse in both columns — so nothing here is
 * authored, and both editions are the ones already named on the page.
 */
export const workPreface = z
  .object({
    /** The line, per language column. */
    text: z.record(languageCode, z.string().min(1)),
    /** Divisions whose convention omits it, and the one line saying so. */
    omitted: z.array(z.number().int().positive()).default([]),
    omitted_note: z.string().min(1).optional(),
    /** Divisions where it is already the numbered first verse. */
    inline: z.array(z.number().int().positive()).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.omitted.length > 0 && value.omitted_note === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['omitted_note'],
        message: 'a division that omits the opening line must say so; a silent gap is not fidelity',
      });
    }
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
    /** What one chapter is called, where the canon has that level. */
    chapter_label: z.string().min(1).optional(),
    /** The script the original is set in, for the font stack and `lang`. */
    script: z.enum(['arabic', 'hebrew', 'devanagari', 'gurmukhi', 'han', 'latin', 'japanese', 'greek', 'pali']),
    /** Right-to-left originals need the whole verse block reversed, not just the text. */
    direction: z.enum(['ltr', 'rtl']).default('ltr'),
    /**
     * The BCP-47 tag each edition's column is set in, where it differs from
     * the key the delivery uses.
     *
     * A column key is the deliverer's filing name; a `lang` attribute is a
     * promise to a screen reader and a font stack. The Bible arrives keyed
     * `gr` and the New Testament is Koine, which is `grc`; the Dhammapada
     * arrives keyed `pli` and BCP-47 wants the shortest code, `pi`. Both are
     * invalid as written, and a browser told to speak an invalid tag falls
     * back to the page's — which reads Greek aloud as English.
     */
    lang_tags: z.record(languageCode, z.string().min(2)).optional(),
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
    /** An unnumbered opening line the canon's own convention puts above verse 1. */
    preface: workPreface.optional(),
    /**
     * What a single-sided verse means in this canon, where the generic line is
     * not the truth.
     *
     * A Tanakh verse with no English is two versifications disagreeing. A New
     * Testament verse with no Greek is a verse the critical edition does not
     * carry — text-critical history, which the page should show rather than
     * hide behind a shrug.
     */
    gap_notes: z
      .object({ original: z.string().min(1).optional(), english: z.string().min(1).optional() })
      .strict()
      .optional(),
    sections: z.array(workSection).default([]),
    divisions: z.array(divisionIndexEntry).min(1),
    /** Totals, computed at ingestion so no page counts them again. */
    total_verses: z.number().int().positive(),
    total_chapters: z.number().int().positive().optional(),
    /** Verses across the whole work whose English column is empty. */
    english_gaps: z.number().int().nonnegative().default(0),
    /** And whose original column is empty — a versification can diverge either way. */
    original_gaps: z.number().int().nonnegative().default(0),
    /** Verses no edition here carries. Counted in both totals above. */
    blank: z.number().int().nonnegative().default(0),
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
 * `<work>--<division>`, or `<work>--<division>--<chapter>` where a canon has a
 * chapter level. Double hyphens so the parts stay separable when any of them
 * contains a hyphen of its own — "tanakh--song-of-songs--3",
 * "guru-granth-sahib--1".
 */
const segment = '[a-z0-9]+(?:-[a-z0-9]+)*';
const divisionId = z
  .string()
  .regex(
    new RegExp(`^${segment}--${segment}(?:--${segment})?$`),
    'must be <work>--<division> or <work>--<division>--<chapter>',
  );

export const divisionSchema = z
  .object({
    id: divisionId,
    work: slug,
    n: z.number().int().positive(),
    slug,
    /** Present when this record is one chapter of a division rather than all of it. */
    c: z.number().int().positive().optional(),
    verses: z.array(verseEntry).min(1),
    sourcing: sourcingStatus,
  })
  .strict();

export type Work = z.infer<typeof workSchema>;
export type WorkSection = z.infer<typeof workSection>;
export type WorkPreface = z.infer<typeof workPreface>;
export type DivisionIndexEntry = z.infer<typeof divisionIndexEntry>;
export type ChapterIndexEntry = z.infer<typeof chapterIndexEntry>;
export type DivisionRecord = z.infer<typeof divisionSchema>;
export type VerseEntry = z.infer<typeof verseEntry>;
