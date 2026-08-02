/**
 * Axis Mundi — Reading Room corpus ingestion.
 *
 * Turns an owner-delivered corpus under /docs into content records: a work
 * index carrying no text, and one record per *chapter* carrying only its own.
 *
 * The chapter is the leaf because it is the unit a canon is cited in and the
 * only unit small enough to ship. A book route is a contents page; nothing
 * anywhere in the room is allowed past a hundred kilobytes, which a book of
 * Psalms is by a factor of eleven and a chapter of it never is. Where a canon
 * has no chapter level — a surah runs straight to its ayat — the division is
 * itself the leaf and nothing changes.
 *
 * The delivered file is the owner's format and is never the build's working
 * set: the Tanakh arrives as nine megabytes in one file and nothing downstream
 * of this script ever holds it whole.
 *
 *   pnpm ingest:corpus tanakh
 *   pnpm ingest:corpus            # every configured corpus
 *
 * Run it, then run validate:content — the schema, not this file, decides
 * whether what came out is publishable.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKS = join(ROOT, 'src/content/works');
const DIVISIONS = join(ROOT, 'src/content/divisions');

/* ── the delivered shapes ───────────────────────────────────────────────── */

interface DeliveredVerse {
  /** Surah and ayah, in the flat shape. */
  s?: number;
  a?: number;
  /** Verse number, in the nested shape. */
  v?: number;
  [lang: string]: number | string | null | undefined;
}

interface DeliveredBook {
  book: string;
  /** The book's title in its own script, where the delivery carries one. */
  book_he?: string;
  /** A route segment the delivery has already chosen. Preferred over ours. */
  slug?: string;
  /** The canon's own grouping, however the delivery names the field. */
  section?: string;
  testament?: string;
  chapters: DeliveredVerse[][];
}

/** A division delivered flat, with its verses and its own two names. */
interface DeliveredChapter {
  n: number;
  name_pli?: string;
  name_en?: string;
  range?: string;
  verses?: DeliveredVerse[];
  /** A whole chapter as one block per column, for a text with no verse level. */
  c?: number;
  [lang: string]: unknown;
}

/**
 * A book whose two editions divide it differently.
 *
 * `aligned: false` means exactly what it says, and the delivery then carries
 * each side's own sequence rather than a paired one. Forcing an index pairing
 * here would silently mismatch every row after the first divergence.
 */
interface DeliveredBookPair {
  n: number;
  name_zh?: string;
  aligned: boolean;
  note?: string;
  /** Present when aligned. */
  chapters?: DeliveredVerse[];
  /** Present when not. */
  zh_sayings?: string[];
  en_chapters?: string[];
}

/** A named division of scanned prose — the Yasna, the Vendidad. */
interface DeliveredScanDivision {
  division: string;
  note?: string;
  chapters: { n: number; en?: string }[];
}

/** An ang and its lines, kept as lines — the Guru Granth Sahib. */
interface DeliveredAng {
  ang: number;
  lines: string[];
}

/** A mandala of hymns, each hymn one block per column — the Rigveda. */
interface DeliveredMandala {
  mandala: number;
  hymns: { n: number; deity?: string | null; sa?: string | null; en?: string | null }[];
  sa_count?: number;
  en_count?: number;
}

/** A flat section of scanned prose, titled — Chamberlain's Kojiki. */
interface DeliveredSection {
  n: number;
  title?: string;
  en?: string;
}

interface Delivered {
  work: string;
  editions: Record<string, string>;
  /**
   * `"unavailable"` where no public-domain original exists to pair with.
   * The reason is the config's; the delivery only states the fact.
   */
  original?: string;
  /** Books of chapters of verses — the Tanakh and the Bible. */
  books?: DeliveredBook[];
  /** A flat verse list keyed by division and verse — the Quran. */
  verses?: DeliveredVerse[];
  /** Divisions of verses, named — the Dhammapada, and the nikayas after it. */
  chapters?: DeliveredChapter[];
  /** Named divisions of scanned prose — the Avesta. */
  divisions?: DeliveredScanDivision[];
  /** Flat numbered sections of scanned prose — the Kojiki. */
  sections?: DeliveredSection[];
  /** Mandalas of hymns, paired at hymn level — the Rigveda. */
  mandalas?: DeliveredMandala[];
  /** Angs of lines, original-only — the Guru Granth Sahib. */
  angs?: DeliveredAng[];
  /** `"unresolved"` where no English edition of quality exists to pair with. */
  english?: string;
}

interface SectionConfig {
  id: string;
  name: string;
  name_original?: string;
  /** A line every page inside the section carries. */
  note?: string;
}

interface PrefaceConfig {
  /**
   * Where the opening line's own words already sit in the corpus, as
   * `[division, verse]`. Lifted, never authored: the mushaf's basmala is
   * surah 1's first verse, in both columns, in the editions already named.
   */
  from: [number, number];
  /** Divisions whose convention omits it. The owner's ruling, not a guess. */
  omitted: number[];
  omitted_note: string;
}

interface Config {
  file: string;
  tradition: string;
  title: string;
  title_original?: string;
  division_label: string;
  division_label_plural: string;
  /** What one chapter is called, where the canon has that level. */
  chapter_label?: string;
  script: string;
  direction: 'ltr' | 'rtl';
  /** Stated on every page of the work; for anything a reader must be told. */
  note?: string;
  /** An unnumbered opening line the canon's own convention puts above verse 1. */
  preface?: PrefaceConfig;
  /**
   * Source-record ids for the editions, where the delivery's own key is not
   * the id the museum files it under. The delivered file is the owner's and is
   * never edited; the mapping lives here, in the open.
   */
  edition_sources?: Record<string, string>;
  /** What a one-sided verse means in this canon, where the generic line is not it. */
  gap_notes?: { original?: string; english?: string };
  /** BCP-47 tags, where a column's key is not one. */
  lang_tags?: Record<string, string>;
  /** False where the canon's divisions carry no verse level of their own. */
  versified?: boolean;
  /** The delivery's own section name mapped to how the canon names it. */
  sections?: Record<string, SectionConfig>;
  /**
   * The order divisions are read in, where the delivery does not carry it.
   * Named, never inferred: a canon's order is the canon's, not this script's.
   */
  order?: string[];
  /** The original slot's honest waiting-on note, for an English-only canon. */
  original_pending?: string;
  /** And the English slot's, for a canon that arrives original-only. */
  english_pending?: string;
  /** Per-division chapter names, where the work's own is not it: fargard. */
  chapter_labels?: Record<string, string>;
  /** A stratum a reader meets inside a division, badged where they meet it. */
  badges?: Record<string, { chapters: number[]; label: string; title: string }>;
  /** Divisions the canon numbers and this corpus does not carry. */
  absent?: { divisions: number[]; note: string };
  /** A line one division's contents page carries, keyed by its slug. */
  division_notes?: Record<string, string>;
}

/* ── the corpora ────────────────────────────────────────────────────────── */

/*
  The Tanakh's book order.

  Taken verbatim from the v1 delivery, whose memo stated it as "the Tanakh's
  own": the v2 file re-sorted its books alphabetically inside each section, and
  alphabetical is not an order this canon has ever been read in. "Song of
  Solomon" is v2's "Song of Songs"; that rename is the only difference between
  this list and the one v1 shipped.
*/
const TANAKH_ORDER = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings',
  'Isaiah', 'Jeremiah', 'Ezekiel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Ruth', 'Lamentations',
  'Ecclesiastes', 'Esther', 'Daniel', 'Ezra', 'Nehemiah',
  'I Chronicles', 'II Chronicles',
];

const CONFIGS: Record<string, Config> = {
  quran: {
    file: 'docs/corpora/quran/quran-paired.json',
    tradition: 'islam',
    title: 'The Quran',
    division_label: 'surah',
    division_label_plural: 'surahs',
    script: 'arabic',
    direction: 'rtl',
    /*
      The basmala. Every surah of the mushaf opens with it but at-Tawba, and
      in every surah but al-Fatiha it stands above the numbering rather than
      inside it — which is why the corpus carries it exactly once, as surah
      1's first verse, and why a page that renders only numbered verses was
      showing 112 surahs without their opening line.

      Taken from where it already is. The omission is the owner's ruling.
    */
    preface: {
      from: [1, 1],
      omitted: [9],
      omitted_note: 'At-Tawba is the one surah the mushaf does not open with the basmala.',
    },
  },
  bible: {
    file: 'docs/corpora/bible/bible-paired.json',
    tradition: 'christianity',
    title: 'The Bible',
    division_label: 'book',
    division_label_plural: 'books',
    chapter_label: 'chapter',
    /* The Greek is the paired original; the Old Testament stands English-only
       here by ruling and its section says why on every page. */
    script: 'greek',
    direction: 'ltr',
    /* A pointer, not the record of the absence itself: the deuterocanon has a
       row of its own among the canons still being acquired, and a fact stated
       in two places is a fact that can end up disagreeing with itself. */
    note:
      'Sixty-six books in the Protestant canon and order. The deuterocanon has its own ' +
      'row among the canons this room is still acquiring.',
    /* The memo names the record `web-bible`; the delivery keys it `web`. The
       file is the owner's and is not edited, so the mapping is stated here. */
    edition_sources: { en: 'web-bible' },
    /* The delivery keys the Greek `gr`, which is not a language tag; the New
       Testament here is Koine, which is `grc`. */
    lang_tags: { gr: 'grc' },
    gap_notes: {
      original:
        'This verse appears in the traditional text; the critical Greek edition does not carry it.',
    },
    sections: {
      OT: {
        id: 'old-testament',
        name: 'Old Testament',
        note:
          'English only here. The Hebrew of these books is in the Tanakh reading room, ' +
          "in the Tanakh's own Masoretic order.",
      },
      NT: { id: 'new-testament', name: 'New Testament' },
    },
  },
  dhammapada: {
    file: 'docs/corpora/dhammapada/dhammapada-paired.json',
    tradition: 'buddhism',
    title: 'The Dhammapada',
    /* Keyed `pli`; BCP-47 asks for the shortest code, which for Pali is `pi`. */
    lang_tags: { pli: 'pi' },
    division_label: 'vagga',
    division_label_plural: 'vaggas',
    script: 'pali',
    direction: 'ltr',
    note:
      'One book of the Khuddaka Nikaya, numbered continuously: a verse is cited as ' +
      'Dhp 1 to Dhp 423 whatever vagga it falls in.',
  },
  'guru-granth-sahib': {
    file: 'docs/corpora/ggs/ggs-corpus.json',
    tradition: 'sikhism',
    title: 'The Guru Granth Sahib',
    title_original: 'ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ',
    division_label: 'ang',
    division_label_plural: 'angs',
    script: 'gurmukhi',
    direction: 'ltr',
    /* The ang is the citation unit and the lines are what it is made of; the
       tradition numbers angs, not lines within them, so nothing here does. */
    versified: false,
    english_pending:
      'An open English translation is not yet available to this museum; the Gurmukhi ' +
      'stands alone until one is.',
    note:
      'The only room in this library whose scripture is present whole in its original and ' +
      'absent whole in translation — itself a fact about the state of open scholarship.',
    lang_tags: { pa: 'pa' },
  },
  rigveda: {
    file: 'docs/corpora/rigveda/rigveda-paired.json',
    tradition: 'hinduism',
    title: 'The Rigveda',
    title_original: 'ऋग्वेद',
    division_label: 'mandala',
    division_label_plural: 'mandalas',
    chapter_label: 'hymn',
    script: 'devanagari',
    direction: 'ltr',
    /* The hymn is the citable unit and one block per column; Griffith's
       stanzas and the samhita's rc divisions do not map, so nothing here
       numbers a verse. */
    versified: false,
    /* The delivery keys its Sanskrit `dharmic-data-samhita`; the museum files
       that edition under the id the memo names. */
    edition_sources: { sa: 'rigveda-samhita-digital' },
    note: 'Pairing is at hymn level: each side is a whole text, not a matched stanza.',
    gap_notes: {
      english: 'Griffith left this hymn untranslated; it stands in Sanskrit alone.',
      original: 'The samhita text of this hymn is not in the digitisation used here.',
    },
    division_notes: {
      '8': 'The Valakhilya hymns are absent from the English digitisation, so eleven hymns of this mandala stand in Sanskrit alone. A future English source may patch them.',
    },
  },
  avesta: {
    file: 'docs/corpora/avesta/avesta-corpus.json',
    tradition: 'zoroastrianism',
    title: 'The Avesta',
    division_label: 'division',
    division_label_plural: 'divisions',
    chapter_label: 'chapter',
    script: 'latin',
    direction: 'ltr',
    /* Passages are numbered in the printing but not reliably enough to anchor;
       the chapter is the citable unit here. */
    versified: false,
    edition_sources: { en: 'sbe-avesta' },
    original_pending:
      'The Avestan text is not yet available from a public-domain source; this room is ' +
      'English-only for now.',
    note: 'Roughly a quarter of the Sasanian Avesta survives; this room is a remnant by history, not by editing.',
    /* The Vendidad's divisions are fargards, and the museum does not rename
       them for the convenience of one field. */
    chapter_labels: { vendidad: 'fargard' },
    /* The Gathas, per the corpus's own division note: "chapters 28-34, 43-51
       and 53 are the Gathas, the oldest stratum, attributed to Zarathustra
       himself". Listed rather than parsed out of prose, and listed once. */
    badges: {
      yasna: {
        chapters: [28, 29, 30, 31, 32, 33, 34, 43, 44, 45, 46, 47, 48, 49, 50, 51, 53],
        label: 'Gatha',
        title: 'the oldest stratum, attributed to Zarathustra',
      },
    },
  },
  kojiki: {
    file: 'docs/corpora/kojiki/kojiki-corpus.json',
    tradition: 'shinto',
    title: 'The Kojiki',
    division_label: 'section',
    division_label_plural: 'sections',
    script: 'latin',
    direction: 'ltr',
    versified: false,
    edition_sources: { en: 'chamberlain-1882' },
    original_pending:
      'The Old Japanese text is not yet available from a public-domain source; this room is ' +
      'English-only for now.',
    note: 'A chronicle revered, not a scripture revealed.',
    absent: {
      divisions: [15, 18, 61, 122, 136, 140, 141, 152, 159, 174],
      note: 'These sections are absent from the source digitisation: gaps in the source, not in the work.',
    },
  },
  daodejing: {
    file: 'docs/corpora/chinese/daodejing-paired.json',
    tradition: 'chinese',
    title: 'The Daodejing',
    title_original: '道德经',
    division_label: 'chapter',
    division_label_plural: 'chapters',
    script: 'han',
    direction: 'ltr',
    /* One block per chapter, and the chapter is what anyone cites. */
    versified: false,
    /* Both files key their Chinese `received-text`; they are two different
       received texts and get two records. */
    edition_sources: { zh: 'ddj-received-text', en: 'legge-sbe-39' },
    lang_tags: { zh: 'zh-Hans' },
  },
  analects: {
    file: 'docs/corpora/chinese/analects-paired.json',
    tradition: 'chinese',
    title: 'The Analects',
    title_original: '论语',
    division_label: 'book',
    division_label_plural: 'books',
    script: 'han',
    direction: 'ltr',
    edition_sources: { zh: 'analects-received-text', en: 'legge-classics-1' },
    lang_tags: { zh: 'zh-Hans' },
  },
  tanakh: {
    file: 'docs/corpora/tanakh/tanakh-paired-v2.json',
    tradition: 'judaism',
    title: 'Tanakh',
    division_label: 'book',
    division_label_plural: 'books',
    chapter_label: 'chapter',
    script: 'hebrew',
    direction: 'rtl',
    note: "The books stand in the Tanakh's own order, under its own three divisions, not the Christian Old Testament's.",
    /* The delivery names its sections in English; the canon names them in
       Hebrew and the note transliterates them. Both go on the page. */
    sections: {
      Torah: { id: 'torah', name: 'Torah', name_original: 'תורה' },
      Prophets: { id: 'neviim', name: "Nevi'im", name_original: 'נביאים' },
      Writings: { id: 'ketuvim', name: 'Ketuvim', name_original: 'כתובים' },
    },
    order: TANAKH_ORDER,
  },
};

/* ── ingestion ──────────────────────────────────────────────────────────── */

/**
 * A book name to a route segment.
 *
 * Roman numerals become digits — a reader typing a URL types 1, and
 * "i-chronicles" reads as a typo rather than as First Chronicles.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/^(I{1,3})\s+/, (_, n: string) => `${n.length}-`)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * A chapter's opening words, for its line on a contents page.
 *
 * Cut at a word boundary and never mid-word, because a preview is a quotation
 * and a quotation broken mid-word reads as a rendering fault rather than as an
 * ellipsis. Long enough to recognise a psalm by, short enough for a phone.
 */
export function preview(text: string, limit = 76): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

type Verse = Record<string, number | string | number[]>;

/* ── scanned prose ──────────────────────────────────────────────────────────
   Two corpora arrive as page scans of nineteenth-century printings rather than
   as structured text, and they carry the printing along with the words: rules
   between sections, running page numbers, a stray bracket where a page marker
   was cut, and — in Chamberlain — footnote reference numerals sitting between
   blank lines in the middle of sentences.

   The rule for all of it is one rule: never a word. Furniture is dropped,
   references are kept and carried as references, and everything else is the
   translator's, spelling and register and parenthetical hedges included. The
   ingest reports the counts, and `validate:content` re-derives them, so the
   claim is auditable rather than trusted.
*/

/** A marker placeholder that cannot occur in the text it passes through. */
const MARKER = ' ';

interface ScanOptions {
  /** Chamberlain's footnote references: a numeral alone between blank lines. */
  footnotes?: boolean;
  /** A numbered passage that opens a line starts a new paragraph. */
  numbered?: boolean;
}

interface ScanParagraph {
  text: string;
  marks: number[];
}

/**
 * A scanned chapter, as paragraphs.
 *
 * Order is the whole trick. A footnote reference sits *between* blank lines but
 * *inside* a sentence, so it has to be lifted out before the text is split on
 * blank lines — split first and every sentence it interrupts comes apart into
 * fragments ("The names of the Deities" / "that were born" / "in the Plain of
 * High Heaven"). Measured on the delivery: 1,495 of 2,065 references fall
 * mid-sentence.
 */
function scanned(raw: string, options: ScanOptions = {}): { paragraphs: ScanParagraph[]; dropped: Dropped } {
  const dropped: Dropped = { rules: 0, pages: 0, brackets: 0, marks: 0, headers: 0, anchors: 0 };
  let src = raw.replace(/\r/g, '');
  /* The tail of a page marker whose head fell off the top of the scan. */
  if (/^\s*\]/.test(src)) {
    src = src.replace(/^\s*\]/, '');
    dropped.brackets += 1;
  }
  src = src.replace(/(?:^|\n)[ \t]*p\.\s*\d+[ \t]*(?=\n|$)/gi, () => {
    dropped.pages += 1;
    return '\n';
  });
  src = src.replace(/(?:^|\n)[ \t]*-{3,}[ \t]*(?=\n|$)/g, () => {
    dropped.rules += 1;
    return '\n';
  });
  if (options.footnotes === true) {
    src = src.replace(/\n[ \t]*\n[ \t]*(\d+)[ \t]*\n[ \t]*\n/g, (_m, n: string) => {
      dropped.marks += 1;
      return ` ${MARKER}${n}${MARKER} `;
    });
  }
  /* The Avesta's numbered passages break where the printing breaks them. The
     same numerals also appear mid-line, so they are not trustworthy verse ids
     and nothing here treats them as ones: this moves no number and claims no
     anchor, it only starts a paragraph where the page starts one. */
  if (options.numbered === true) src = src.replace(/\n[ \t]*(\d+\.[ \t])/g, '\n\n$1');

  const out: ScanParagraph[] = [];
  for (const block of src.split(/\n[ \t]*\n/)) {
    /* A hard wrap inside a paragraph is where the column ended, not a break. */
    const flat = block.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    if (flat === '') continue;
    const marks = [...flat.matchAll(new RegExp(`${MARKER}(\\d+)${MARKER}`, 'g'))].map((m) =>
      Number(m[1]),
    );
    const text = flat
      .replace(new RegExp(`\\s*${MARKER}\\d+${MARKER}\\s*`, 'g'), ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (text === '') continue;
    out.push({ text, marks });
  }
  return { paragraphs: out, dropped };
}

interface Dropped {
  rules: number;
  pages: number;
  brackets: number;
  marks: number;
  headers: number;
  anchors: number;
}

const furniture: Dropped = { rules: 0, pages: 0, brackets: 0, marks: 0, headers: 0, anchors: 0 };
const tallyDropped = (d: Dropped): void => {
  furniture.rules += d.rules;
  furniture.pages += d.pages;
  furniture.brackets += d.brackets;
  furniture.marks += d.marks;
};

const FARGARD = /(?:^|\n)-*\s*FARGARD\s+(\d+)\s*\.?\s*\n/gi;

/**
 * A division whose delivery lost its own segmentation.
 *
 * The Avesta's Vendidad arrived with all twenty-two fargards' text inside the
 * twenty-second, fargards two through twenty-one empty, and fargard one holding
 * a forty-three-byte fragment. This is a defect in the delivered file and is
 * flagged as one; it is repaired here rather than in `/docs`, which is the
 * owner's and is never edited.
 *
 * The repair authors nothing. The blob carries `FARGARD n.` headings for all
 * twenty-two, in order, and the split is on those — the corpus's own statement
 * of where its divisions begin. Audited: every word of the blob lands in a
 * fargard except the twenty-two heading words themselves and a seven-word
 * subtitle fragment that is duplicated inside fargard 22 anyway, and the same
 * is true of the fragment left in fargard 1.
 */
function repairSegmentation(
  chapters: { n: number; en?: string }[],
  division: string,
): { n: number; en?: string }[] {
  const empty = chapters.filter((c) => (c.en ?? '').trim() === '');
  if (empty.length === 0) return chapters;

  const carrier = chapters.find((c) => [...(c.en ?? '').matchAll(FARGARD)].length >= chapters.length);
  if (carrier === undefined) {
    throw new Error(
      `${division}: ${empty.length} of ${chapters.length} chapters are empty and no chapter ` +
        'carries headings for the rest — the delivery cannot be read',
    );
  }
  const blob = carrier.en ?? '';
  const hits = [...blob.matchAll(FARGARD)];
  const parts = hits.map((h, i) => ({
    n: Number(h[1]),
    en: blob.slice(
      (h.index ?? 0) + h[0].length,
      i + 1 < hits.length ? (hits[i + 1]?.index ?? blob.length) : blob.length,
    ),
  }));
  const expected = chapters.map((c) => c.n).join(',');
  if (parts.map((p) => p.n).join(',') !== expected) {
    throw new Error(`${division}: recovered ${parts.map((p) => p.n).join(',')}, expected ${expected}`);
  }
  console.log(
    `    repaired           ${parts.length} ${division.toLowerCase()} divisions recovered from ` +
      `the delivery's chapter ${carrier.n}, which held them all`,
  );
  return parts;
}

interface Chapter {
  c: number;
  /** Who or what the chapter is addressed to, where the delivery names one. */
  dedication?: string;
  verses: Verse[];
}

/** One column of a division that does not pair. */
interface ParallelSide {
  lang: string;
  numbering: string;
  label: string;
  /** What one entry here is called, singular: "saying", "chapter". */
  unit: string;
  entries: { n: number; text: string }[];
}

interface Division {
  n: number;
  slug: string;
  name?: string;
  /** A line this division's contents page carries, from the delivery. */
  note?: string;
  name_original?: string;
  name_gloss?: string;
  verse_from?: number;
  verse_to?: number;
  section?: string;
  /** Absent where the division runs straight to its verses. */
  chapters?: Chapter[];
  /** Every verse of the division, whatever level they are stored at. */
  all: Verse[];
  /** Present instead of verses where the editions do not align. */
  parallel?: { note: string; columns: ParallelSide[] };
}

/** Both delivered shapes, flattened to the same thing. */
function normalise(src: Delivered, config: Config): Division[] {
  const langs = Object.keys(src.editions);
  /* An empty column is an absent column, whether the delivery writes it as ""
     or as null. A verse with no English is a fact the page states, not an
     empty string it renders. */
  const columns = (v: DeliveredVerse): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const lang of langs) {
      const text = v[lang];
      if (typeof text === 'string' && text.trim() !== '') out[lang] = text;
    }
    return out;
  };

  /*
    Books that pair, and books that do not.

    The Analects is ten of each. Where Legge's chapter divisions match the
    received text the book renders paired; where they do not — most sharply in
    Book X, seventeen chapters against twenty-seven sayings — each column keeps
    its own sequence and its own numbering, and the note says why.

    Detected by the field that states it rather than by a container name: this
    delivery files its books under `books` exactly as the Tanakh and the Bible
    do, and only `aligned` tells the three apart.
  */
  if (src.books !== undefined && (src.books[0] as unknown as DeliveredBookPair)?.aligned !== undefined) {
    const books = src.books as unknown as DeliveredBookPair[];
    const langs = Object.keys(src.editions);
    const orig = langs.find((k) => k !== 'en') ?? 'zh';
    return books.map((book) => {
      const base = {
        n: book.n,
        slug: String(book.n),
        ...(book.name_zh === undefined ? {} : { name: book.name_zh }),
      };
      if (book.aligned) {
        return { ...base, all: (book.chapters ?? []).map((v) => ({ v: v.v as number, ...columns(v) })) };
      }
      if (book.note === undefined) {
        throw new Error(`book ${book.n}: aligned is false and no note says why`);
      }
      const side = (lang: string, label: string, unit: string, texts: string[]): ParallelSide => ({
        lang,
        /* The anchor names the numbering, so a link says which column it
           means: #zh-3 is the third saying, #en-3 is Legge's third chapter,
           and on an unaligned book those are not the same passage. */
        numbering: lang,
        label,
        unit,
        entries: texts.map((text, i) => ({ n: i + 1, text })),
      });
      return {
        ...base,
        all: [],
        parallel: {
          note: book.note,
          columns: [
            side(orig, 'The received text, by saying', 'saying', book.zh_sayings ?? []),
            side('en', "Legge's translation, by his chapters", 'chapter', book.en_chapters ?? []),
          ],
        },
      };
    });
  }

  /*
    Named divisions of scanned prose — the Avesta's Yasna and Vendidad.

    Each chapter enters as paragraphs, not verses. The printing numbers its
    passages and those numbers stay exactly where the printing put them, but
    they are not offered as anchors: measured across the Yasna, some open a
    line and some sit mid-sentence, so numbering by them would give Yasna 14
    the verses 1, 2, 3, 5 with the real 4 buried inside 3. The chapter is the
    unit, and the unit is honest.
  */
  if (src.divisions !== undefined) {
    return src.divisions.map((division, index) => {
      const slug = division.division.toLowerCase();
      const chapters = repairSegmentation(division.chapters, division.division).map((chapter) => {
        const { paragraphs, dropped } = scanned(chapter.en ?? '', { numbered: true });
        tallyDropped(dropped);
        return {
          c: chapter.n,
          verses: paragraphs.map((p, i) => ({ v: i + 1, c: chapter.n, en: p.text })),
        };
      });
      return {
        n: index + 1,
        slug,
        name: division.division,
        ...(division.note === undefined ? {} : { note: division.note }),
        /* A chaptered division's `all` is its chapters, flattened: the totals
           and the gap counts are taken from it, not from the chapter list. */
        all: chapters.flatMap((c) => c.verses),
        chapters,
      };
    });
  }

  /*
    Angs of lines — the Guru Granth Sahib.

    One row per source line, and that is the whole point: lineation is part of
    how this scripture is read and cited, so the lines are never re-flowed into
    paragraphs and never given numbers of their own. The ang is the citation
    unit; the line is what the ang is made of.
  */
  if (src.angs !== undefined) {
    return src.angs.map((ang) => ({
      n: ang.ang,
      slug: String(ang.ang),
      all: ang.lines.map((line, i) => ({ v: i + 1, [langs[0] ?? 'pa']: line })),
    }));
  }

  /*
    Mandalas of hymns, paired at hymn level — the Rigveda.

    Not at verse level, and that is the corpus's own ruling: Griffith's stanzas
    and the samhita's rc divisions do not map mechanically, so each hymn enters
    as one block per column and the Both view stacks two whole texts. Numbering
    them as a verse each would be the concordance nobody has made.
  */
  if (src.mandalas !== undefined) {
    /*
      Griffith's text arrives with the digitiser's markup on it: every hymn
      opens with a `## HYMN I. Agni.` header and carries `{#1:1}` stanza
      anchors, 10,400 of them. Both are machine furniture, not Griffith — the
      header's hymn number and deity are already carried structurally — and the
      same rule applies as to the scanned corpora: furniture goes, never a word.
    */
    const clean = (text: string): string => {
      const before = text;
      const out = text
        .replace(/^\s*#{1,6}\s*HYMN[^\n]*\n+/i, () => { furniture.headers += 1; return ''; })
        .replace(/\s*\{#\d+:\d+\}/g, () => { furniture.anchors += 1; return ''; })
        /* And the end-of-hymn rule the digitiser set below every one of them. */
        .replace(/\n*\s*\*\s*\*\s*\*\s*$/, () => { furniture.rules += 1; return ''; })
        .trim();
      return out === '' ? before : out;
    };
    return src.mandalas.map((mandala) => {
      const chapters = mandala.hymns.map((hymn) => ({
        c: hymn.n,
        /* Null where Griffith's header names no deity — fifteen of them. */
        ...(typeof hymn.deity !== 'string' || hymn.deity.trim() === ''
          ? {}
          : { dedication: hymn.deity.trim() }),
        verses: [
          {
            v: 1,
            c: hymn.n,
            ...columns({
              ...hymn,
              ...(typeof hymn.en === 'string' ? { en: clean(hymn.en) } : {}),
            } as unknown as DeliveredVerse),
          },
        ],
      }));
      return {
        n: mandala.mandala,
        slug: String(mandala.mandala),
        all: chapters.flatMap((c) => c.verses),
        chapters,
      };
    });
  }

  /* Flat numbered sections of scanned prose, titled — the Kojiki. */
  if (src.sections !== undefined) {
    return src.sections.map((section) => {
      const { paragraphs, dropped } = scanned(section.en ?? '', { footnotes: true });
      tallyDropped(dropped);
      return {
        n: section.n,
        slug: String(section.n),
        ...(section.title === undefined ? {} : { name: section.title }),
        all: paragraphs.map((p, i) => ({
          v: i + 1,
          en: p.text,
          ...(p.marks.length === 0 ? {} : { marks: p.marks }),
        })),
      };
    });
  }

  /* Divisions delivered flat, each with its own names and its own verses. */
  if (src.chapters !== undefined) {
    return src.chapters.map((chapter) => {
      /*
        A chapter that is itself one block of text, not a list of verses.

        The Daodejing is eighty-one of these: the chapter is the citable unit
        and there is no level beneath it, so it enters as a single unnumbered
        block rather than as a verse one that would be numbered "1".
      */
      if (chapter.verses === undefined) {
        const n = chapter.c ?? chapter.n;
        return {
          n,
          slug: String(n),
          all: [{ v: 1, ...columns(chapter as DeliveredVerse) }],
        };
      }
      const verses = chapter.verses.map((v) => ({ v: v.v as number, ...columns(v) }));
      /* The delivery states the range and the verses carry it; if the two ever
         disagree, the file is telling us two different things and one of them
         is wrong, so neither gets published. */
      const from = verses[0]?.['v'] as number | undefined;
      const to = verses[verses.length - 1]?.['v'] as number | undefined;
      if (chapter.range !== undefined && `${from}-${to}` !== chapter.range) {
        throw new Error(
          `division ${chapter.n}: delivered range "${chapter.range}" but the verses run ${from}-${to}`,
        );
      }
      return {
        n: chapter.n,
        slug: String(chapter.n),
        ...(chapter.name_pli === undefined ? {} : { name: chapter.name_pli }),
        ...(chapter.name_en === undefined ? {} : { name_gloss: chapter.name_en }),
        ...(from === undefined ? {} : { verse_from: from }),
        ...(to === undefined ? {} : { verse_to: to }),
        all: verses,
      };
    });
  }

  if (src.books !== undefined) {
    const order = config.order;
    const books = [...src.books];
    if (order !== undefined) {
      const rank = new Map(order.map((name, i) => [name, i]));
      const unknown = books.filter((b) => !rank.has(b.book)).map((b) => b.book);
      if (unknown.length > 0) {
        throw new Error(
          `the delivery has books the configured order does not name: ${unknown.join(', ')}. ` +
            "A canon's order is the canon's — add them to the order rather than letting the " +
            'file\'s sequence decide.',
        );
      }
      books.sort((a, b) => (rank.get(a.book) ?? 0) - (rank.get(b.book) ?? 0));
    }

    return books.map((book, i) => {
      const chapters = book.chapters.map((chapter, ci) => ({
        c: ci + 1,
        verses: chapter.map((v) => ({ v: v.v as number, ...columns(v) })),
      }));
      const section = book.section ?? book.testament;
      return {
        n: i + 1,
        /* The delivery's own slug wins: it chose the address, and a route it
           picked is one it can link to from anywhere else it publishes. */
        slug: book.slug ?? slugify(book.book),
        name: book.book,
        ...(book.book_he === undefined ? {} : { name_original: book.book_he }),
        ...(section === undefined ? {} : { section }),
        chapters,
        all: chapters.flatMap((c) => c.verses.map((v) => ({ c: c.c, ...v }))),
      };
    });
  }

  const byDivision = new Map<number, Verse[]>();
  for (const v of src.verses ?? []) {
    const n = v.s as number;
    let rows = byDivision.get(n);
    if (rows === undefined) {
      rows = [];
      byDivision.set(n, rows);
    }
    rows.push({ v: v.a as number, ...columns(v) });
  }
  return [...byDivision.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, verses]) => ({ n, slug: String(n), all: verses }));
}

function write(path: string, value: unknown): number {
  mkdirSync(dirname(path), { recursive: true });
  const text = `${JSON.stringify(value, null, 1)}\n`;
  writeFileSync(path, text);
  return Buffer.byteLength(text);
}

function ingest(name: string, config: Config): void {
  const delivered = join(ROOT, config.file);
  const src = JSON.parse(readFileSync(delivered, 'utf8')) as Delivered;
  const originalLang = Object.keys(src.editions).find((k) => k !== 'en');
  const hasEnglish = src.editions['en'] !== undefined;

  /* Every record this corpus owns is rewritten, so any left over from a
     previous delivery is stale — a book v2 renamed would otherwise keep its
     v1 route alive, serving text no index points at. */
  for (const file of readdirSync(DIVISIONS)) {
    if (file.startsWith(`${src.work}--`)) rmSync(join(DIVISIONS, file));
  }

  let totalVerses = 0;
  let totalChapters = 0;
  let englishGaps = 0;
  let originalGaps = 0;
  let blankVerses = 0;
  let recordBytes = 0;
  let largest = 0;
  let largestName = '';

  const divisions = normalise(src, config);

  const index = divisions.map((d) => {
    /*
      A gap is a hole in a column this division otherwise carries.

      The Bible's Old Testament has no Greek at all — by ruling, because its
      Hebrew is in the Tanakh room — and calling twenty-three thousand verses
      "single-sided" would be counting a decision as damage. A New Testament
      book that carries Greek everywhere but eight verses has eight gaps, and
      those are the ones worth naming.
    */
    const carries = (rows: Verse[], lang: string): boolean =>
      rows.some((r) => r[lang] !== undefined);
    const holes = (rows: Verse[], all: Verse[], lang: string | undefined): number =>
      lang === undefined || !carries(all, lang)
        ? 0
        : rows.filter((r) => r[lang] === undefined).length;
    const missingEnglish = (rows: Verse[]): number =>
      hasEnglish ? holes(rows, d.all, 'en') : 0;
    const missingOriginal = (rows: Verse[]): number => holes(rows, d.all, originalLang);
    /* A verse the numbering has and no edition carries. In both totals, and
       counted here too, because the page states it once and a check that
       expected two notes would fail on a page that is right. */
    const blank = (rows: Verse[]): number =>
      originalLang === undefined || !hasEnglish
        ? 0
        : rows.filter(
            (r) =>
              r['en'] === undefined &&
              r[originalLang] === undefined &&
              carries(d.all, 'en') &&
              carries(d.all, originalLang),
          ).length;

    const emit = (id: string, body: Record<string, unknown>): void => {
      const bytes = write(join(DIVISIONS, `${id}.json`), { id, work: src.work, ...body });
      recordBytes += bytes;
      if (bytes > largest) {
        largest = bytes;
        largestName = id;
      }
    };

    if (d.parallel !== undefined) {
      emit(`${src.work}--${d.slug}`, {
        n: d.n,
        slug: d.slug,
        parallel: d.parallel,
        sourcing: 'sourced',
      });
    } else if (d.chapters === undefined) {
      emit(`${src.work}--${d.slug}`, {
        n: d.n,
        slug: d.slug,
        verses: d.all,
        sourcing: 'sourced',
      });
    } else {
      for (const chapter of d.chapters) {
        emit(`${src.work}--${d.slug}--${chapter.c}`, {
          n: d.n,
          slug: d.slug,
          c: chapter.c,
          verses: chapter.verses,
          sourcing: 'sourced',
        });
      }
    }

    /*
      A parallel division counts in the original's own divisions.

      Not the sum of both columns, which would count one book twice and inflate
      the room's verse tally with a number no edition holds; and not the longer
      of the two, which is arbitrary. Every other division of the Analects is
      counted in received-text sayings — an aligned book's paired entries are
      exactly its sayings — so the unaligned ones are counted the same way, and
      the work's total stays one unit throughout.
    */
    const originalColumn = d.parallel?.columns.find((c) => c.lang === originalLang);
    if (d.parallel !== undefined && originalColumn === undefined) {
      throw new Error(
        `division ${d.slug}: parallel columns carry no ${originalLang ?? 'original'} side to count in`,
      );
    }
    totalVerses += originalColumn === undefined ? d.all.length : originalColumn.entries.length;
    totalChapters += d.chapters?.length ?? 0;
    englishGaps += missingEnglish(d.all);
    originalGaps += missingOriginal(d.all);
    blankVerses += blank(d.all);

    return {
      n: d.n,
      slug: d.slug,
      ...(d.name === undefined ? {} : { name: d.name }),
      ...(d.name_original === undefined ? {} : { name_original: d.name_original }),
      ...(d.name_gloss === undefined ? {} : { name_gloss: d.name_gloss }),
      ...(d.verse_from === undefined ? {} : { verse_from: d.verse_from }),
      ...(d.verse_to === undefined ? {} : { verse_to: d.verse_to }),
      /* A parallel division has no single verse count, so the index carries
         both columns' — every page that lists divisions has to say how much
         text each holds, and here that is two numbers in two units. */
      ...(d.parallel === undefined
        ? {}
        : {
            parallel: d.parallel.columns.map((c) => ({ unit: c.unit, n: c.entries.length })),
          }),
      verses: originalColumn === undefined ? d.all.length : originalColumn.entries.length,
      ...(d.chapters === undefined
        ? {}
        : {
            chapters: d.chapters.map((chapter) => {
              const first = chapter.verses[0];
              /* The preview is whichever column the chapter actually opens in.
                 Four of this canon's chapters open on a verse the Hebrew does
                 not carry, and one on a verse the English does not. */
              const lang =
                first === undefined ? undefined
                : typeof first['en'] === 'string' ? 'en'
                : originalLang !== undefined && typeof first[originalLang] === 'string' ? originalLang
                : undefined;
              const text = lang === undefined || first === undefined ? undefined : first[lang];
              /* A stratum inside a division, badged where a reader meets it. */
              const badge = config.badges?.[d.slug];
              return {
                c: chapter.c,
                verses: chapter.verses.length,
                ...(badge !== undefined && badge.chapters.includes(chapter.c)
                  ? { badge: { label: badge.label, title: badge.title } }
                  : {}),
                ...(chapter.dedication === undefined ? {} : { dedication: chapter.dedication }),
                ...(typeof text === 'string' ? { preview: preview(text), preview_lang: lang } : {}),
                english_gaps: missingEnglish(chapter.verses),
                original_gaps: missingOriginal(chapter.verses),
                blank: blank(chapter.verses),
              };
            }),
          }),
      ...(config.chapter_labels?.[d.slug] === undefined
        ? {}
        : { chapter_label: config.chapter_labels[d.slug] }),
      /* A line this division's contents page carries. Delivered by the corpus
         where it states one, otherwise named in the config from the memo. */
      ...((d.note ?? config.division_notes?.[d.slug]) === undefined
        ? {}
        : { note: d.note ?? config.division_notes?.[d.slug] }),
      ...(d.section === undefined || config.sections === undefined
        ? {}
        : { section: config.sections[d.section]?.id ?? slugify(d.section) }),
      english_gaps: missingEnglish(d.all),
      original_gaps: missingOriginal(d.all),
      blank: blank(d.all),
    };
  });

  /* Section spans are derived from where the ordered divisions actually fall,
     so a section can never claim a book the index does not put in it. */
  const sections =
    config.sections === undefined
      ? undefined
      : Object.entries(config.sections)
          .map(([delivered, section]) => {
            const members = divisions.filter((d) => d.section === delivered).map((d) => d.n);
            return {
              ...section,
              from: Math.min(...members),
              to: Math.max(...members),
            };
          })
          .filter((s) => Number.isFinite(s.from))
          .sort((a, b) => a.from - b.from);

  /* The preface's words come from the corpus, so it is built after the
     divisions are normalised and from the same rows the pages will render. */
  let preface: Record<string, unknown> | undefined;
  if (config.preface !== undefined) {
    const [dn, vn] = config.preface.from;
    const source = divisions.find((d) => d.n === dn)?.all.find((v) => v['v'] === vn);
    if (source === undefined) {
      throw new Error(`preface: no verse ${dn}:${vn} to lift the opening line from`);
    }
    const text = Object.fromEntries(
      Object.entries(source).filter(([k, v]) => k !== 'v' && k !== 'c' && typeof v === 'string'),
    );
    /* Where the line is already a numbered verse it must not also be printed
       above itself: al-Fatiha opens with the basmala as its own verse 1. */
    const inline = divisions
      .filter((d) => {
        const first = d.all[0];
        return first !== undefined && Object.entries(text).every(([k, v]) => first[k] === v);
      })
      .map((d) => d.n);
    preface = {
      text,
      omitted: config.preface.omitted,
      omitted_note: config.preface.omitted_note,
      inline,
    };
    console.log(`    preface       lifted from ${dn}:${vn}; already a verse in ${inline.join(', ')}; ` +
      `omitted from ${config.preface.omitted.join(', ')}`);
  }

  /* The delivery's edition keys map to the ids the museum files them under. */
  const editions = Object.fromEntries(
    Object.entries(src.editions).map(([lang, id]) => [lang, config.edition_sources?.[lang] ?? id]),
  );

  const workBytes = write(join(WORKS, `${src.work}.json`), {
    id: src.work,
    tradition: config.tradition,
    title: config.title,
    ...(config.title_original === undefined ? {} : { title_original: config.title_original }),
    division_label: config.division_label,
    division_label_plural: config.division_label_plural,
    ...(config.chapter_label === undefined ? {} : { chapter_label: config.chapter_label }),
    script: config.script,
    direction: config.direction,
    editions,
    ...(config.lang_tags === undefined ? {} : { lang_tags: config.lang_tags }),
    ...(config.versified === false ? { versified: false } : {}),
    ...(config.original_pending === undefined
      ? {}
      : { original_pending: config.original_pending }),
    ...(config.english_pending === undefined ? {} : { english_pending: config.english_pending }),
    ...(config.note === undefined ? {} : { note: config.note }),
    ...(preface === undefined ? {} : { preface }),
    ...(config.gap_notes === undefined ? {} : { gap_notes: config.gap_notes }),
    ...(config.absent === undefined ? {} : { absent: config.absent }),
    ...(sections === undefined || sections.length === 0 ? {} : { sections }),
    divisions: index,
    total_verses: totalVerses,
    ...(totalChapters === 0 ? {} : { total_chapters: totalChapters }),
    english_gaps: englishGaps,
    original_gaps: originalGaps,
    blank: blankVerses,
    sourcing: 'sourced',
  });

  const kb = (n: number): string => `${(n / 1024).toFixed(0)} KB`;
  const leaves = totalChapters === 0 ? index.length : totalChapters;
  console.log(`\n  ${name} — ${index.length} divisions, ${totalVerses.toLocaleString('en')} verses`);
  console.log(`    delivered      ${kb(statSync(delivered).size).padStart(9)}  (stays in /docs)`);
  console.log(`    work index     ${kb(workBytes).padStart(9)}  (no text)`);
  console.log(`    text records   ${kb(recordBytes).padStart(9)}  across ${leaves} files`);
  console.log(`    largest        ${kb(largest).padStart(9)}  ${largestName}`);
  if (englishGaps > 0 || originalGaps > 0) {
    console.log(
      `    single-sided   ${String(englishGaps + originalGaps - blankVerses).padStart(9)}  ` +
        `(${originalGaps - blankVerses} with no original, ${englishGaps - blankVerses} with no ` +
        `English, ${blankVerses} with neither)`,
    );
  }
}

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(CONFIGS);
for (const name of names) {
  const config = CONFIGS[name];
  if (config === undefined) {
    console.error(`\n  Unknown corpus "${name}". Known: ${Object.keys(CONFIGS).join(', ')}\n`);
    process.exit(1);
  }
  ingest(name, config);
}
if (furniture.rules + furniture.pages + furniture.brackets + furniture.marks > 0) {
  console.log(
    `\n  Scan furniture: ${furniture.rules} rules, ${furniture.pages} page numbers and ` +
      `${furniture.brackets} stray brackets dropped; ${furniture.marks} footnote references ` +
      'kept and carried. No word of any translation was touched.',
  );
}
console.log('\n  Run validate:content next — the schema decides what is publishable.\n');
