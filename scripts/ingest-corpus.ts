/**
 * Axis Mundi — Reading Room corpus ingestion.
 *
 * Turns an owner-delivered corpus under /docs into content records: one work
 * index carrying no text, and one record per division carrying only its own.
 *
 * The delivery format is the owner's and is never the build's working set: the
 * Tanakh arrives as nine megabytes in a single file, and nothing downstream of
 * this script ever holds it whole. Run it, then run validate:content — the
 * schema, not this file, decides whether what came out is publishable.
 *
 *   pnpm ingest:corpus tanakh
 *   pnpm ingest:corpus            # every configured corpus
 *
 * Deliveries have not arrived in one shape and will not: the Quran came as a
 * flat verse list keyed by surah and ayah, the Tanakh as books of chapters of
 * verses. Both normalise here, which is the point of having one entry.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  [lang: string]: number | string | undefined;
}

interface DeliveredBook {
  book: string;
  chapters: DeliveredVerse[][];
}

interface Delivered {
  work: string;
  editions: Record<string, string>;
  books?: DeliveredBook[];
  verses?: DeliveredVerse[];
}

interface Section {
  id: string;
  name: string;
  from: number;
  to: number;
}

interface Config {
  file: string;
  tradition: string;
  title: string;
  title_original?: string;
  division_label: string;
  division_label_plural: string;
  script: string;
  direction: 'ltr' | 'rtl';
  /** Stated on every page of the work; for anything a reader must be told. */
  note?: string;
  sections?: Section[];
}

/* ── the corpora ────────────────────────────────────────────────────────── */

const CONFIGS: Record<string, Config> = {
  quran: {
    file: 'docs/corpora/quran/quran-paired.json',
    tradition: 'islam',
    title: 'The Quran',
    division_label: 'surah',
    division_label_plural: 'surahs',
    script: 'arabic',
    direction: 'rtl',
  },
  tanakh: {
    file: 'docs/corpora/tanakh/tanakh-paired.json',
    tradition: 'judaism',
    title: 'Tanakh',
    division_label: 'book',
    division_label_plural: 'books',
    script: 'hebrew',
    direction: 'rtl',
    /* Measured across all 23,194 English verses, not asserted: HaShem in
       5,545, G-d in 2,345, L-rd in 442, and no unhyphenated God, Lord or LORD
       anywhere. The page names an edition, so it says how the text it actually
       shows differs from what that name alone would imply. */
    note:
      "The books stand in the Tanakh's own order, under its own three divisions, " +
      'not the Christian Old Testament\'s. In this English text as delivered the ' +
      'divine name is written HaShem, and God and Lord appear as G-d and L-rd.',
    /* The canon's own grouping, by the delivered file's own book order. */
    sections: [
      { id: 'torah', name: 'Torah', from: 1, to: 5 },
      { id: 'neviim', name: "Nevi'im", from: 6, to: 26 },
      { id: 'ketuvim', name: 'Ketuvim', from: 27, to: 39 },
    ],
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

interface NormalisedDivision {
  n: number;
  slug: string;
  name?: string;
  verses: Record<string, number | string>[];
  chapters?: number;
}

/** Both delivered shapes, flattened to the same thing. */
function normalise(src: Delivered): NormalisedDivision[] {
  const langs = Object.keys(src.editions);
  const columns = (v: DeliveredVerse): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const lang of langs) {
      const text = v[lang];
      /* An empty column is an absent column: a verse with no English is a fact
         the page states, not an empty string it renders. */
      if (typeof text === 'string' && text !== '') out[lang] = text;
    }
    return out;
  };

  if (src.books !== undefined) {
    return src.books.map((book, i) => ({
      n: i + 1,
      slug: slugify(book.book),
      name: book.book,
      chapters: book.chapters.length,
      verses: book.chapters.flatMap((chapter, ci) =>
        chapter.map((v) => ({ c: ci + 1, v: v.v as number, ...columns(v) })),
      ),
    }));
  }

  const byDivision = new Map<number, Record<string, number | string>[]>();
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
    .map(([n, verses]) => ({ n, slug: String(n), verses }));
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
  const hasEnglish = src.editions['en'] !== undefined;

  let totalVerses = 0;
  let totalChapters = 0;
  let gaps = 0;
  let divisionBytes = 0;
  let largest = 0;

  const index = normalise(src).map((d) => {
    const missing = hasEnglish ? d.verses.filter((r) => r['en'] === undefined).length : 0;
    totalVerses += d.verses.length;
    totalChapters += d.chapters ?? 0;
    gaps += missing;

    const bytes = write(join(DIVISIONS, `${src.work}--${d.slug}.json`), {
      id: `${src.work}--${d.slug}`,
      work: src.work,
      n: d.n,
      slug: d.slug,
      verses: d.verses,
      sourcing: 'sourced',
    });
    divisionBytes += bytes;
    largest = Math.max(largest, bytes);

    return {
      n: d.n,
      slug: d.slug,
      ...(d.name === undefined ? {} : { name: d.name }),
      verses: d.verses.length,
      ...(d.chapters === undefined ? {} : { chapters: d.chapters }),
      ...(() => {
        const section = config.sections?.find((s) => d.n >= s.from && d.n <= s.to);
        return section === undefined ? {} : { section: section.id };
      })(),
      english_gaps: missing,
    };
  });

  const workBytes = write(join(WORKS, `${src.work}.json`), {
    id: src.work,
    tradition: config.tradition,
    title: config.title,
    ...(config.title_original === undefined ? {} : { title_original: config.title_original }),
    division_label: config.division_label,
    division_label_plural: config.division_label_plural,
    script: config.script,
    direction: config.direction,
    editions: src.editions,
    ...(config.note === undefined ? {} : { note: config.note }),
    ...(config.sections === undefined ? {} : { sections: config.sections }),
    divisions: index,
    total_verses: totalVerses,
    ...(totalChapters === 0 ? {} : { total_chapters: totalChapters }),
    english_gaps: gaps,
    sourcing: 'sourced',
  });

  const kb = (n: number): string => `${(n / 1024).toFixed(0)} KB`;
  console.log(`\n  ${name} — ${index.length} divisions, ${totalVerses.toLocaleString('en')} verses`);
  console.log(`    delivered        ${kb(statSync(delivered).size).padStart(9)}  (stays in /docs)`);
  console.log(`    work index       ${kb(workBytes).padStart(9)}  (no text)`);
  console.log(`    divisions        ${kb(divisionBytes).padStart(9)}  across ${index.length} files`);
  console.log(`    largest division ${kb(largest).padStart(9)}`);
  if (gaps > 0) {
    console.log(`    english gaps     ${String(gaps).padStart(9)}  verses with no English column`);
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
