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
  /** Footnote references the translator left in this passage; his notes are not here. */
  readonly marks?: readonly number[] | undefined;
  readonly [lang: string]: number | string | readonly number[] | undefined;
}

export interface ChapterIndex {
  readonly c: number;
  readonly verses: number;
  /** A stratum mark, where this chapter belongs to one. */
  readonly badge?: { readonly label: string; readonly title: string } | undefined;
  /** Who or what the chapter is addressed to, where the canon names one. */
  readonly dedication?: string | undefined;
  readonly preview?: string | undefined;
  readonly preview_lang?: string | undefined;
  readonly english_gaps: number;
  readonly original_gaps: number;
  readonly blank: number;
}

export interface DivisionIndex {
  readonly n: number;
  readonly slug: string;
  readonly name?: string | undefined;
  readonly name_original?: string | undefined;
  readonly name_gloss?: string | undefined;
  readonly verse_from?: number | undefined;
  readonly verse_to?: number | undefined;
  readonly transliteration?: string | undefined;
  readonly verses: number;
  /** Present means the division is a contents page and its text is a level down. */
  readonly chapters?: readonly ChapterIndex[] | undefined;
  /** A line this division's contents page carries, and only this one. */
  readonly note?: string | undefined;
  /** What one of this division's chapters is called, where the work's is not it. */
  readonly chapter_label?: string | undefined;
  /** Present where the editions do not align: one entry per column. */
  readonly parallel?: readonly ParallelCount[] | undefined;
  readonly section?: string | undefined;
  readonly english_gaps: number;
  readonly original_gaps: number;
  readonly blank: number;
}

export interface Section {
  readonly id: string;
  readonly name: string;
  readonly name_original?: string | undefined;
  /** A line every page inside this section carries. */
  readonly note?: string | undefined;
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
  readonly lang_tags?: Readonly<Record<string, string>> | undefined;
  readonly english_pending?: string | undefined;
  /** And the mirror, for a canon with no public-domain original to pair with. */
  readonly original_pending?: string | undefined;
  /** Divisions the canon numbers that this corpus does not carry. */
  readonly absent?: { readonly divisions: readonly number[]; readonly note: string } | undefined;
  /** False where the canon's divisions carry no verse level of their own. */
  readonly versified?: boolean | undefined;
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
  /** Verses no edition carries. Counted in both totals above; stated once. */
  readonly blank: number;
  readonly gap_notes?: {
    readonly original?: string | undefined;
    readonly english?: string | undefined;
  } | undefined;
}

/* ── divisions that do not pair ─────────────────────────────────────────── */

export interface ParallelSide {
  readonly lang: string;
  readonly numbering: string;
  readonly label: string;
  readonly unit: string;
  readonly entries: readonly { readonly n: number; readonly text: string }[];
}

export interface ParallelBlock {
  readonly note: string;
  readonly columns: readonly ParallelSide[];
}

/**
 * A parallel entry's anchor: the numbering it belongs to, then its number.
 *
 * `zh-3` and `en-3` are not the same passage in a book where the two editions
 * divide differently, and that is exactly when this shape is used — so the
 * anchor has to say which sequence it counts in. A bare `#3` would be a link
 * that means two things.
 */
export const parallelAnchor = (side: Pick<ParallelSide, 'numbering'>, n: number): string =>
  `${side.numbering}-${n}`;

/** How a parallel entry is cited: "Analects X · received text 12". */
export const parallelRef = (heading: string, side: ParallelSide, n: number): string =>
  `${heading} · ${side.label} ${n}`;

/** One column's size, as the work index carries it. */
export interface ParallelCount {
  readonly unit: string;
  readonly n: number;
}

/**
 * How much text a parallel division holds — which is two answers, not one.
 *
 * "27 sayings · 17 chapters", never "27 verses" and never one of the two on
 * its own. The head of every other page states a single count because every
 * other page has one; this is the one shape where a single number would be
 * the same claim the columns exist to refuse.
 */
export const parallelCounts = (counts: readonly ParallelCount[]): string =>
  counts.map((c) => `${c.n} ${c.unit}${c.n === 1 ? '' : 's'}`).join(' · ');

/* ── one-sided verses ───────────────────────────────────────────────────── */

/** Which columns a verse actually carries. */
export type VerseSides = 'both' | 'english-only' | 'original-only' | 'neither';

export function sidesOf(verse: VerseRow, orig: string, english: boolean): VerseSides {
  const hasOrig = typeof verse[orig] === 'string';
  const hasEn = !english || typeof verse['en'] === 'string';
  if (hasOrig && hasEn) return 'both';
  if (hasEn) return 'english-only';
  if (hasOrig) return 'original-only';
  return 'neither';
}

/** Whether these verses carry a column at all, as opposed to having holes in it. */
export const carries = (verses: readonly VerseRow[], lang: string): boolean =>
  verses.some((v) => typeof v[lang] === 'string');

/**
 * What a page can actually show, which is not always what the work offers.
 *
 * The Bible carries a Greek edition and its Old Testament does not use it: the
 * Hebrew of those books is in the Tanakh room, by ruling. So an Old Testament
 * page offers English alone — a toggle promising a column this page has none
 * of would open on nothing, and the reader would be right to think it broken.
 */
export function pageModes(work: Pick<WorkData, 'editions'>, verses: readonly VerseRow[]): Mode[] {
  const orig = originalLang(work);
  const hasOrig = orig !== '' && carries(verses, orig);
  const hasEn = hasEnglish(work) && carries(verses, 'en');
  if (hasOrig && hasEn) return [...MODES];
  if (hasOrig) return ['original'];
  return ['english'];
}

/**
 * What to say where a verse stands on one side, or on none.
 *
 * The generic lines state the fact and nothing more, because for most canons
 * that is all anyone can honestly say: two versifications disagree. A canon
 * whose gaps mean something specific says so instead — a New Testament verse
 * with no Greek is a verse the critical edition does not carry, which is
 * text-critical history and worth showing rather than shrugging at.
 *
 * A verse with neither column is its own case: the number exists in the
 * numbering this text is cited by, and no edition here carries words for it.
 */
export function gapNote(work: WorkData, sides: VerseSides): string | undefined {
  switch (sides) {
    case 'both':
      return undefined;
    case 'english-only':
      return (
        work.gap_notes?.original ?? 'No verse at this number in the original edition.'
      );
    case 'original-only':
      return work.gap_notes?.english ?? 'No English at this verse number in this edition.';
    case 'neither':
      return 'Neither edition carries a verse at this number.';
  }
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

/**
 * The BCP-47 tag for an edition's column.
 *
 * The key the delivery files a column under is not always a language tag —
 * `gr` is not one at all, and `pli` is not the one BCP-47 asks for. This is
 * the only place the two are allowed to differ.
 */
export const langTag = (work: Pick<WorkData, 'lang_tags'>, column: string): string =>
  work.lang_tags?.[column] ?? column;

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
  if (!hasEnglish(work)) return ['original'];
  return originalLang(work) === '' ? ['english'] : [...MODES];
}

/**
 * The modes this work cannot offer, and the one sentence that says why.
 *
 * A room with only one column could simply not draw the toggle, and that is
 * what it used to do. But a reader who has met the Quran's three buttons and
 * then opens the Avesta learns nothing from their absence — a control that
 * vanishes reads as a page that forgot it, not as a canon whose other half
 * does not exist in any edition anyone may publish. So the buttons stay,
 * disabled, carrying the reason.
 */
export function unavailableModes(
  work: Pick<WorkData, 'editions' | 'english_pending' | 'original_pending'>,
): { modes: Mode[]; reason: string } | undefined {
  if (!hasEnglish(work) && work.english_pending !== undefined) {
    return { modes: ['english', 'both'], reason: work.english_pending };
  }
  if (originalLang(work) === '' && work.original_pending !== undefined) {
    return { modes: ['original', 'both'], reason: work.original_pending };
  }
  return undefined;
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
/**
 * What a chapter of a division is called.
 *
 * "Genesis 1" reads correctly because the book has a name. A division named by
 * its own number does not: "Mandala 1" plus hymn 1 gave "Mandala 1 1", two
 * numbers with nothing between them. Where the division's heading already ends
 * in a numeral, the chapter's own label separates them — "Mandala 1, Hymn 1".
 */
export function chapterHeading(
  work: Pick<WorkData, 'division_label' | 'chapter_label'>,
  division: Pick<DivisionIndex, 'n' | 'name' | 'chapter_label'>,
  c: number,
): string {
  const head = divisionHeading(work, division);
  if (!/\d$/.test(head)) return `${head} ${c}`;
  const label = division.chapter_label ?? work.chapter_label ?? 'chapter';
  return `${head}, ${label.charAt(0).toUpperCase() + label.slice(1)} ${c}`;
}

export function divisionHeading(
  work: Pick<WorkData, 'division_label'>,
  division: Pick<DivisionIndex, 'n' | 'name'>,
): string {
  if (division.name !== undefined) return division.name;
  const label = work.division_label.charAt(0).toUpperCase() + work.division_label.slice(1);
  return `${label} ${division.n}`;
}

/**
 * The gloss beside a division's own name — "Yamakavagga / Pairs".
 *
 * The canon's name leads and the rendering follows it, because the name is
 * what the tradition calls the thing and the gloss is what it means. Given by
 * the delivery, never translated here.
 */
export const divisionGloss = (division: Pick<DivisionIndex, 'name_gloss'>): string | undefined =>
  division.name_gloss;

/**
 * The verse numbers a division holds, where a canon numbers continuously
 * across its divisions and a reader has to know which range they are in.
 *
 * The Dhammapada is cited as Dhp 1 to Dhp 423 whatever vagga a verse falls in,
 * so a vagga that did not say "1–20" would be a page whose numbers start at
 * twenty-one for no reason a reader can see.
 */
export function verseRange(division: Pick<DivisionIndex, 'verse_from' | 'verse_to'>): string | undefined {
  const { verse_from: from, verse_to: to } = division;
  if (from === undefined || to === undefined) return undefined;
  return from === to ? String(from) : `${from}–${to}`;
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
      : chapterHeading(work, division, c),
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
