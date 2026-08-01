/**
 * Reading Room model — Phase 5.
 *
 * DOM-free and canon-free. Nine more corpora arrive in the paired shape the
 * Quran pilot defines, one of them with no English column at all, so nothing
 * here may know what a surah is or assume a translation exists.
 */

export interface VerseRow {
  readonly s: number;
  readonly a: number;
  readonly [lang: string]: number | string | undefined;
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
  readonly divisions: readonly { n: number; name?: string | undefined;
                                 name_original?: string | undefined;
                                 transliteration?: string | undefined }[];
  readonly verses: readonly VerseRow[];
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
 * The Guru Granth Sahib arrives Gurmukhi-only, and defaulting it to a column
 * that does not exist would open the reader on a page of waiting-on notes.
 * A work without a translation opens in its own language and says why the
 * other column is empty.
 */
export const defaultMode = (work: Pick<WorkData, 'editions'>): Mode =>
  hasEnglish(work) ? 'english' : 'original';

/** Which modes a work can actually offer. */
export function availableModes(work: Pick<WorkData, 'editions'>): Mode[] {
  return hasEnglish(work) ? [...MODES] : ['original'];
}

/**
 * Resolves a requested mode against what the work can do.
 *
 * A stored preference outlives the page it was set on: a reader who chose
 * English on the Quran and then opens the Guru Granth Sahib must not land on
 * an empty column.
 */
export function resolveMode(requested: string | null, work: Pick<WorkData, 'editions'>): Mode {
  const allowed = availableModes(work);
  const hit = allowed.find((m) => m === requested);
  return hit ?? defaultMode(work);
}

/* ── divisions ──────────────────────────────────────────────────────────── */

export interface Division {
  readonly n: number;
  readonly verses: readonly VerseRow[];
  readonly name?: string | undefined;
  readonly name_original?: string | undefined;
  readonly transliteration?: string | undefined;
}

/** Groups the flat verse list into its divisions, in numeric order. */
export function divisionsOf(work: WorkData): Division[] {
  const byNumber = new Map<number, VerseRow[]>();
  for (const verse of work.verses) {
    const bucket = byNumber.get(verse.s);
    if (bucket === undefined) byNumber.set(verse.s, [verse]);
    else bucket.push(verse);
  }
  const meta = new Map(work.divisions.map((d) => [d.n, d]));
  return [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, verses]) => {
      const m = meta.get(n);
      return {
        n,
        verses: [...verses].sort((x, y) => x.a - y.a),
        name: m?.name,
        name_original: m?.name_original,
        transliteration: m?.transliteration,
      };
    });
}

/**
 * A division's heading, from what the record actually holds.
 *
 * The Quran corpus carries no surah names in either script, so the heading is
 * "Surah 2" until a names file lands. Numbering a division the reader can
 * count to is honest; naming one the record cannot name is not.
 */
export function divisionHeading(work: WorkData, division: Pick<Division, 'n' | 'name'>): string {
  const label = work.division_label.charAt(0).toUpperCase() + work.division_label.slice(1);
  return division.name === undefined ? `${label} ${division.n}` : `${label} ${division.n} · ${division.name}`;
}

export interface Neighbours {
  readonly prev?: number | undefined;
  readonly next?: number | undefined;
}

export function neighbours(numbers: readonly number[], current: number): Neighbours {
  const i = numbers.indexOf(current);
  return { prev: i > 0 ? numbers[i - 1] : undefined,
           next: i >= 0 && i < numbers.length - 1 ? numbers[i + 1] : undefined };
}

/* ── the edition line ───────────────────────────────────────────────────── */

export interface EditionLine {
  readonly lang: string;
  readonly sourceId: string;
  /** The on-page note this edition must always carry, if it has one. */
  readonly note?: string | undefined;
}

/**
 * Every edition the page shows, in reading order.
 *
 * The memo's rule: each edition is a source record and is named on every page.
 * A page that renders only English still names the Arabic it was paired from,
 * because the pairing is the claim.
 */
export function editionLines(work: WorkData, notes: Readonly<Record<string, string>>): EditionLine[] {
  const orig = originalLang(work);
  const out: EditionLine[] = [];
  const push = (lang: string): void => {
    const sourceId = work.editions[lang];
    if (sourceId === undefined) return;
    out.push({ lang, sourceId, note: notes[sourceId] });
  };
  push(orig);
  push('en');
  return out;
}

/** A stable anchor id for a verse, so /read/quran/2#255 lands on the ayah. */
export const verseAnchor = (verse: Pick<VerseRow, 'a'>): string => String(verse.a);
