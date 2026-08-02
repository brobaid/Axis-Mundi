/**
 * The recitation frame — the room's standing dress, not a preference.
 *
 * Two lines that open and close a reading. They are not the text: no verse
 * carries them, no numbering counts them, and no translation column renders
 * them as translated words. They are what a reciter says before the first
 * ayah and after the last, and the page sets them as frame — centred, apart,
 * in the room's accent — so a reader can never mistake one for scripture.
 *
 * They were briefly under the Devotional frame's toggle, alongside the
 * honorific. That was wrong for the same reason the basmala was never under
 * it: the mushaf itself opens and closes this way, so making it optional made
 * the default rendering less faithful, not more neutral. The toggle now
 * governs the honorific and nothing else.
 *
 * The opener lives in the work record, because it varies by division — the
 * mushaf omits it at at-Tawba and numbers it as a verse at al-Fatiha. The
 * closer lives here, because it is the same line on all 114.
 *
 * DOM-free. Conventions are the owner's to supply; a tradition with no entry
 * renders no frame, and that absence is not a gap to be filled with a
 * plausible guess.
 */

export interface RecitationLine {
  /** The line, in its own script. Never translated into a column. */
  readonly text: string;
  readonly lang: string;
  readonly direction: 'ltr' | 'rtl';
  /**
   * What it says, carried as a `title` for a reader who does not read the
   * script — never rendered as a second line, because a translation set
   * beneath it would read as the text having two halves.
   */
  readonly translation: string;
}

export interface RecitationFrame {
  /** Said after the final verse, on every division of the work. */
  readonly closer?: RecitationLine | undefined;
}

/**
 * Per tradition, ids matching the taxonomy's.
 *
 * Islam is populated from the owner's ruling. Nothing else has one, and an
 * empty entry is the honest state rather than an oversight.
 */
export const FRAMES: Readonly<Record<string, RecitationFrame>> = {
  islam: {
    closer: {
      text: 'صَدَقَ اللهُ العَظِيم',
      lang: 'ar',
      direction: 'rtl',
      translation: 'God Almighty has spoken the truth',
    },
  },
};

export const frameFor = (tradition: string): RecitationFrame => FRAMES[tradition] ?? {};

/** The opener's translation, for the `title` on the basmala. */
export const OPENER_TRANSLATIONS: Readonly<Record<string, string>> = {
  quran: 'In the name of God, the Most Gracious, the Most Merciful',
};
