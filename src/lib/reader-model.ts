/**
 * Reading Room model — Phase 5.
 *
 * DOM-free and canon-free. Corpora arrive at the owner's cadence and no two
 * have arrived in the same nesting yet, so nothing here may know what a surah
 * is, assume a chapter level exists, or assume a translation does.
 */

export interface VerseRow {
  readonly v: number;
  readonly c?: number | undefined;
  readonly [lang: string]: number | string | undefined;
}

export interface ChapterIndex {
  readonly c: number;
  readonly verses: number;
  readonly preview?: string | undefined;
  readonly preview_lang?: string | undefined;
  readonly english_gaps: number;
  readonly original_gaps: number;
}

export interface DivisionIndex {
  readonly n: number;
  readonly slug: string;
  readonly name?: string | undefined;
  readonly name_original?: string | undefined;
  readonly transliteration?: string | undefined;
  readonly verses: number;
  /** Present means the division is a contents page and its text is a level down. */
  readonly chapters?: readonly ChapterIndex[] | undefined;
  readonly section?: string | undefined;
  readonly english_gaps: number;
  readonly original_gaps: number;
}

export interface Section {
  readonly id: string;
  readonly name: string;
  readonly name_original?: string | undefined;
  readonly from: number;
  readonly to: number;
}

export interface WorkData {
  readonly id: string;
  readonly tradition: string;
  readonly title: string;
  readonly title_original?: string | undefined;
  readonly division_label: string;
  readonly division_label_plural: string;
  readonly chapter_label?: string | undefined;
  readonly script: string;
  readonly direction: 'ltr' | 'rtl';
  readonly editions: Readonly<Record<string, string>>;
  readonly english_pending?: string | undefined;
  readonly note?: string | undefined;
  readonly preface?: {
    readonly text: Readonly<Record<string, string>>;
    readonly omitted: readonly number[];
    readonly omitted_note?: string | undefined;
    readonly inline: readonly number[];
  } | undefined;
  readonly sections: readonly Section[];
  readonly divisions: readonly DivisionIndex[];
  readonly total_verses: number;
  readonly total_chapters?: number | undefined;
  readonly english_gaps: number;
  readonly original_gaps: number;
}

/**
 * The original's language code: whichever edition is not the English one.
 *
 * Derived rather than declared, because "the original" is Arabic here, Hebrew
 * next, and Gurmukhi for the canon that has no English at all.
 */
export function originalLang(work: Pick<WorkData, 'editions'>): string {
  return Object.keys(work.editions).find((k) => k !== 'en') ?? '';
}

export const hasEnglish = (work: Pick<WorkData, 'editions'>): boolean =>
  work.editions['en'] !== undefined;

/* ── the reading modes ──────────────────────────────────────────────────── */

export const MODES = ['english', 'original', 'both'] as const;
export type Mode = (typeof MODES)[number];

/**
 * English by default — except where there is no English.
 *
 * A canon that arrives original-only would otherwise open on a page of
 * waiting-on notes, so it opens in its own language and says why.
 */
export const defaultMode = (work: Pick<WorkData, 'editions'>): Mode =>
  hasEnglish(work) ? 'english' : 'original';

export function availableModes(work: Pick<WorkData, 'editions'>): Mode[] {
  return hasEnglish(work) ? [...MODES] : ['original'];
}

/**
 * Resolves a requested mode against what the work can do.
 *
 * A stored preference outlives the page it was set on: a reader who chose
 * English on the Quran and then opens an original-only canon must not land on
 * an empty column.
 */
export function resolveMode(requested: string | null, work: Pick<WorkData, 'editions'>): Mode {
  const allowed = availableModes(work);
  const hit = allowed.find((m) => m === requested);
  return hit ?? defaultMode(work);
}

/* ── divisions and sections ─────────────────────────────────────────────── */

/** A division's heading, from what the record actually holds. */
export function divisionHeading(
  work: Pick<WorkData, 'division_label'>,
  division: Pick<DivisionIndex, 'n' | 'name'>,
): string {
  if (division.name !== undefined) return division.name;
  const label = work.division_label.charAt(0).toUpperCase() + work.division_label.slice(1);
  return `${label} ${division.n}`;
}

export const sectionOf = (work: WorkData, n: number): Section | undefined =>
  work.sections.find((s) => n >= s.from && n <= s.to);

/** The work's divisions grouped under their sections, in the file's own order. */
export function grouped(work: WorkData): { section?: Section | undefined; divisions: DivisionIndex[] }[] {
  if (work.sections.length === 0) return [{ divisions: [...work.divisions] }];
  return work.sections.map((section) => ({
    section,
    divisions: work.divisions.filter((d) => d.n >= section.from && d.n <= section.to),
  }));
}

/* ── verses ─────────────────────────────────────────────────────────────── */

/**
 * A verse's anchor: its own number, because the page is one chapter.
 *
 * It was `20-3` while a page was a whole book. The chapter moved into the
 * route, so the fragment no longer has to carry it, and `/read/tanakh/exodus/20#3`
 * says the same thing as the old `/read/tanakh/exodus#20-3` with the part a
 * reader would read aloud in the address rather than the fragment.
 *
 * It starts with a digit, which HTML allows for an id and CSS does not allow
 * for an identifier: `#3` is a parse error as a selector, and any lookup must
 * use `getElementById` or an `[id="…"]` attribute selector. That is the price
 * of an anchor a person can type, and it is paid once, here.
 */
export const verseAnchor = (verse: Pick<VerseRow, 'v'>): string => String(verse.v);

/**
 * How a verse is cited in prose and in the copy-link: "Exodus 20:3".
 *
 * `cite` is the page's own name for itself down to the level above the verse —
 * "Exodus 20" for a chapter, "Surah 2" for a canon with no chapter level — so
 * this joins the last colon and knows nothing about either canon's shape.
 */
export const verseRef = (cite: string, verse: Pick<VerseRow, 'v'>): string =>
  `${cite}:${verse.v}`;

/* ── the opening line ───────────────────────────────────────────────────── */

export interface Preface {
  readonly text: Readonly<Record<string, string>>;
}

/**
 * What, if anything, stands above this division's first verse.
 *
 * Three answers, all of them the canon's: the line, nothing-and-here-is-why,
 * or nothing-because-it-is-already-verse-one. The last needs no note — the
 * reader is looking straight at it.
 */
export function prefaceFor(
  work: WorkData,
  division: Pick<DivisionIndex, 'n'>,
  chapter?: number,
): { line?: Preface | undefined; omittedNote?: string | undefined } {
  const p = work.preface;
  /* Only above the first verse of the division, never on chapter two. */
  if (p === undefined || (chapter !== undefined && chapter !== 1)) return {};
  if (p.inline.includes(division.n)) return {};
  if (p.omitted.includes(division.n)) return { omittedNote: p.omitted_note };
  return { line: { text: p.text } };
}

/* ── walking the canon ─────────────────────────────────────────────────── */

export interface Step {
  /** Where the step lands. */
  readonly href: string;
  /** How it is named on the control: "Exodus 20", "Joshua". */
  readonly label: string;
}

export interface Walk {
  readonly prev?: Step | undefined;
  readonly next?: Step | undefined;
  /** Set when the step stops because the canon's own section stops. */
  readonly endsSection?: Section | undefined;
}

const divisionsIn = (work: WorkData, section: Section | undefined): readonly DivisionIndex[] =>
  section === undefined
    ? work.divisions
    : work.divisions.filter((d) => d.n >= section.from && d.n <= section.to);

const stepTo = (work: WorkData, division: DivisionIndex, c?: number): Step => ({
  href:
    c === undefined
      ? `/read/${work.id}/${division.slug}`
      : `/read/${work.id}/${division.slug}/${c}`,
  label:
    c === undefined
      ? divisionHeading(work, division)
      : `${divisionHeading(work, division)} ${c}`,
});

/**
 * The pages either side of this one, at whatever level it sits.
 *
 * Reading runs on: the last chapter of Genesis steps to the first of Exodus,
 * because that is how the book is read. It stops at the section's edge —
 * Deuteronomy 34 does not step to Joshua 1 — because a section is the canon's
 * own unit and walking out of one silently would flatten a structure the canon
 * insists on. Where a work has no sections there is nothing to stop at.
 */
export function walk(work: WorkData, division: DivisionIndex, c?: number): Walk {
  const section = sectionOf(work, division.n);
  const siblings = divisionsIn(work, section);
  const at = siblings.findIndex((d) => d.n === division.n);
  const before = at > 0 ? siblings[at - 1] : undefined;
  const after = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : undefined;

  /* No chapter level: the step is division to division. */
  if (c === undefined) {
    return {
      prev: before === undefined ? undefined : stepTo(work, before),
      next: after === undefined ? undefined : stepTo(work, after),
      ...(after === undefined && section !== undefined ? { endsSection: section } : {}),
    };
  }

  const chapters = division.chapters ?? [];
  const last = chapters.length;

  const prev =
    c > 1
      ? stepTo(work, division, c - 1)
      : before === undefined
        ? undefined
        : stepTo(work, before, (before.chapters?.length ?? 1));

  const next =
    c < last
      ? stepTo(work, division, c + 1)
      : after === undefined
        ? undefined
        : stepTo(work, after, 1);

  return {
    prev,
    next,
    ...(next === undefined && section !== undefined ? { endsSection: section } : {}),
  };
}

/* ── the edition line ───────────────────────────────────────────────────── */

export interface EditionLine {
  readonly lang: string;
  readonly sourceId: string;
  readonly note?: string | undefined;
  readonly preface?: {
    readonly text: Readonly<Record<string, string>>;
    readonly omitted: readonly number[];
    readonly omitted_note?: string | undefined;
    readonly inline: readonly number[];
  } | undefined;
}

/**
 * Every edition the page shows, in reading order.
 *
 * The memo's rule: each edition is a source record and is named on every page.
 * A page that renders only English still names the original it was paired
 * from, because the pairing is the claim.
 */
export function editionLines(work: WorkData, notes: Readonly<Record<string, string>>): EditionLine[] {
  const out: EditionLine[] = [];
  const push = (lang: string): void => {
    const sourceId = work.editions[lang];
    if (sourceId === undefined) return;
    out.push({ lang, sourceId, note: notes[sourceId] });
  };
  push(originalLang(work));
  push('en');
  return out;
}
