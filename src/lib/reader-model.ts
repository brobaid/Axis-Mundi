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

export interface DivisionIndex {
  readonly n: number;
  readonly slug: string;
  readonly name?: string | undefined;
  readonly name_original?: string | undefined;
  readonly transliteration?: string | undefined;
  readonly verses: number;
  readonly chapters?: number | undefined;
  readonly section?: string | undefined;
  readonly english_gaps: number;
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
  readonly script: string;
  readonly direction: 'ltr' | 'rtl';
  readonly editions: Readonly<Record<string, string>>;
  readonly english_pending?: string | undefined;
  readonly note?: string | undefined;
  readonly sections: readonly Section[];
  readonly divisions: readonly DivisionIndex[];
  readonly total_verses: number;
  readonly total_chapters?: number | undefined;
  readonly english_gaps: number;
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

export interface Neighbours {
  readonly prev?: DivisionIndex | undefined;
  readonly next?: DivisionIndex | undefined;
}

/**
 * The divisions either side, within the section when the work has them.
 *
 * Deuteronomy's next is Joshua, but the Torah ends at Deuteronomy: prev/next
 * carries a reader across book boundaries and stops at the section's edge,
 * because a section is the canon's own unit and walking out of it silently
 * would flatten a structure the canon insists on.
 */
export function neighbours(work: WorkData, n: number): Neighbours {
  const section = sectionOf(work, n);
  const within =
    section === undefined
      ? work.divisions
      : work.divisions.filter((d) => d.n >= section.from && d.n <= section.to);
  const i = within.findIndex((d) => d.n === n);
  return {
    prev: i > 0 ? within[i - 1] : undefined,
    next: i >= 0 && i < within.length - 1 ? within[i + 1] : undefined,
  };
}

/* ── verses ─────────────────────────────────────────────────────────────── */

/**
 * A verse's anchor: `255` where a canon runs straight to its verses,
 * `20-3` where it divides into chapters first.
 *
 * A colon would be cleaner to read and is legal in a fragment, but it has to
 * be escaped in a CSS selector and in `getElementById` lookups downstream,
 * and a hyphen costs the reader nothing.
 */
export const verseAnchor = (verse: Pick<VerseRow, 'v' | 'c'>): string =>
  verse.c === undefined ? String(verse.v) : `${verse.c}-${verse.v}`;

/** How a verse is cited in prose and in the copy-link: "Exodus 20:3". */
export const verseRef = (division: string, verse: Pick<VerseRow, 'v' | 'c'>): string =>
  verse.c === undefined ? `${division} ${verse.v}` : `${division} ${verse.c}:${verse.v}`;

export interface Chapter {
  /** Absent for a canon that runs straight from division to verse. */
  readonly c?: number | undefined;
  readonly verses: readonly VerseRow[];
}

/**
 * A division's verses grouped by chapter, in the file's own order.
 *
 * Grouping rather than marking boundaries, because the chapter is the unit a
 * long book is read and rendered in: Psalms is a hundred and fifty of these,
 * and the browser can skip the ones nobody has scrolled to only if each is an
 * element of its own.
 *
 * A canon with no chapter level yields one group carrying every verse.
 */
export function byChapter(verses: readonly VerseRow[]): Chapter[] {
  const out: Chapter[] = [];
  let current: VerseRow[] = [];
  let last: number | undefined;
  for (const verse of verses) {
    if (out.length === 0 || verse.c !== last) {
      current = [];
      out.push({ c: verse.c, verses: current });
      last = verse.c;
    }
    current.push(verse);
  }
  return out;
}

/* ── the edition line ───────────────────────────────────────────────────── */

export interface EditionLine {
  readonly lang: string;
  readonly sourceId: string;
  readonly note?: string | undefined;
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
