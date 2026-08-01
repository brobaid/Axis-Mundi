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
  /** The canon's own grouping, where the delivery states it per book. */
  section?: string;
  chapters: DeliveredVerse[][];
}

interface Delivered {
  work: string;
  editions: Record<string, string>;
  books?: DeliveredBook[];
  verses?: DeliveredVerse[];
}

interface SectionConfig {
  id: string;
  name: string;
  name_original?: string;
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
  /** The delivery's own section name mapped to how the canon names it. */
  sections?: Record<string, SectionConfig>;
  /**
   * The order divisions are read in, where the delivery does not carry it.
   * Named, never inferred: a canon's order is the canon's, not this script's.
   */
  order?: string[];
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

type Verse = Record<string, number | string>;

interface Chapter {
  c: number;
  verses: Verse[];
}

interface Division {
  n: number;
  slug: string;
  name?: string;
  name_original?: string;
  section?: string;
  /** Absent where the division runs straight to its verses. */
  chapters?: Chapter[];
  /** Every verse of the division, whatever level they are stored at. */
  all: Verse[];
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
      return {
        n: i + 1,
        slug: slugify(book.book),
        name: book.book,
        ...(book.book_he === undefined ? {} : { name_original: book.book_he }),
        ...(book.section === undefined ? {} : { section: book.section }),
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
  let recordBytes = 0;
  let largest = 0;
  let largestName = '';

  const divisions = normalise(src, config);

  const index = divisions.map((d) => {
    const missingEnglish = (rows: Verse[]): number =>
      hasEnglish ? rows.filter((r) => r['en'] === undefined).length : 0;
    const missingOriginal = (rows: Verse[]): number =>
      originalLang === undefined ? 0 : rows.filter((r) => r[originalLang] === undefined).length;

    const emit = (id: string, body: Record<string, unknown>): void => {
      const bytes = write(join(DIVISIONS, `${id}.json`), { id, work: src.work, ...body });
      recordBytes += bytes;
      if (bytes > largest) {
        largest = bytes;
        largestName = id;
      }
    };

    if (d.chapters === undefined) {
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

    totalVerses += d.all.length;
    totalChapters += d.chapters?.length ?? 0;
    englishGaps += missingEnglish(d.all);
    originalGaps += missingOriginal(d.all);

    return {
      n: d.n,
      slug: d.slug,
      ...(d.name === undefined ? {} : { name: d.name }),
      ...(d.name_original === undefined ? {} : { name_original: d.name_original }),
      verses: d.all.length,
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
              return {
                c: chapter.c,
                verses: chapter.verses.length,
                ...(typeof text === 'string' ? { preview: preview(text), preview_lang: lang } : {}),
                english_gaps: missingEnglish(chapter.verses),
                original_gaps: missingOriginal(chapter.verses),
              };
            }),
          }),
      ...(d.section === undefined || config.sections === undefined
        ? {}
        : { section: config.sections[d.section]?.id ?? slugify(d.section) }),
      english_gaps: missingEnglish(d.all),
      original_gaps: missingOriginal(d.all),
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
    editions: src.editions,
    ...(config.note === undefined ? {} : { note: config.note }),
    ...(preface === undefined ? {} : { preface }),
    ...(sections === undefined || sections.length === 0 ? {} : { sections }),
    divisions: index,
    total_verses: totalVerses,
    ...(totalChapters === 0 ? {} : { total_chapters: totalChapters }),
    english_gaps: englishGaps,
    original_gaps: originalGaps,
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
    console.log(`    single-sided   ${String(englishGaps + originalGaps).padStart(9)}  ` +
      `(${originalGaps} with no original, ${englishGaps} with no English)`);
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
console.log('\n  Run validate:content next — the schema decides what is publishable.\n');
