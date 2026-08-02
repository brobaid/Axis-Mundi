/**
 * The Devotional frame — Phase 6.
 *
 * The museum's own voice is academic and evenhanded; that does not change and
 * is not a setting. This is a rendering preference, off by default, that adds
 * the conventions a tradition's own readers keep — an honorific after a name.
 * It adds; it never edits. No sourced fact, date, figure or word of translated
 * text differs between the two modes, and the markup makes that structurally
 * true: every devotional mark is its own element, present in the DOM either
 * way and shown by CSS, so turning the frame on cannot rewrite a sentence.
 *
 * The recitation formulas used to be here too. They are not preferences — the
 * mushaf opens and closes that way — so making them optional made the default
 * rendering less faithful rather than more neutral. They live in
 * `src/lib/recitation.ts` now, always on. This governs the honorific alone.
 *
 * DOM-free, so the build and the island agree on what a convention is.
 *
 * Conventions are the owner's to supply. Every tradition has an entry; only
 * those the owner has ruled on carry anything. An empty entry renders nothing
 * and is not a gap to be filled with a plausible guess — a convention nobody
 * has given us is one this museum does not know.
 */

export const DEVOTIONAL_KEY = 'axis-mundi-devotional';

/** A mark that follows a name wherever the name is written. */
export interface Honorific {
  /** The name as it appears in prose. Matched whole-word, case-sensitively. */
  readonly after: string;
  /** The mark itself, in its own script. */
  readonly mark: string;
  /** BCP-47 tag for the mark, so it is set in the right face. */
  readonly lang: string;
  /** What it says, for a screen reader and for a reader who does not know it. */
  readonly meaning: string;
}

export interface Convention {
  readonly honorifics: readonly Honorific[];
}

/**
 * Per tradition. Ids match the taxonomy's.
 *
 * Islam is populated from the owner's ruling. The rest are hooks: present, so
 * a convention can be added without touching any page, and empty, because
 * inventing one would be exactly the thing this museum does not do.
 */
export const CONVENTIONS: Readonly<Record<string, Convention>> = {
  islam: {
    honorifics: [
      {
        after: 'Muhammad',
        mark: 'ﷺ',
        lang: 'ar',
        meaning: 'May God bless him and grant him peace',
      },
    ],
  },
  judaism: { honorifics: [] },
  christianity: { honorifics: [] },
  hinduism: { honorifics: [] },
  buddhism: { honorifics: [] },
  sikhism: { honorifics: [] },
  chinese: { honorifics: [] },
  jainism: { honorifics: [] },
  shinto: { honorifics: [] },
  zoroastrianism: { honorifics: [] },
};

export const conventionFor = (tradition: string): Convention =>
  CONVENTIONS[tradition] ?? { honorifics: [] };

/** True when a tradition has anything to render under the frame. */
export const hasConvention = (tradition: string): boolean =>
  conventionFor(tradition).honorifics.length > 0;

/**
 * Adds honorific marks to already-rendered, already-escaped prose.
 *
 * Runs last, over HTML, which needs care: a match inside a tag's attributes
 * would corrupt the markup. So it skips anything between angle brackets and
 * only ever touches text nodes' worth of the string.
 *
 * The mark is wrapped rather than inserted bare. That is the whole design:
 * with the frame off the span renders nothing, so the sentence a scholar
 * sourced is the sentence on the page, byte for byte.
 */
export function applyHonorifics(html: string, tradition: string): string {
  const { honorifics } = conventionFor(tradition);
  if (honorifics.length === 0) return html;

  /* Split on tags so replacement only ever runs on the text between them. */
  return html
    .split(/(<[^>]*>)/)
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk; /* a tag */
      let out = chunk;
      for (const h of honorifics) {
        /* Whole word: "Muhammadan" and "Muhammad's" are different claims, and
           only the bare name takes the honorific. An apostrophe-s does. */
        const pattern = new RegExp(`\\b${h.after}\\b(?!\\w)`, 'g');
        /*
          One label, not two. A visually-hidden gloss beside a `title` gets
          announced twice; `role="img"` with a label makes the mark a single
          named object, and the title stays as the tooltip for a sighted
          reader who does not know the ligature.

          The thin space is written as an escape: a literal one is invisible
          in a diff and in review.
        */
        out = out.replace(
          pattern,
          `${h.after}<span class="dv dv-honorific" lang="${h.lang}" role="img"` +
            ` aria-label="${h.meaning}" title="${h.meaning}">\u2009${h.mark}</span>`,
        );
      }
      return out;
    })
    .join('');
}
