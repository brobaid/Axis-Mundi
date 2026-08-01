/**
 * Axis Mundi — Reading Room check against the built output.
 *
 * Content validation proves the records agree with each other. This proves the
 * pages agree with the records, which is a different claim and the one that
 * failed: a work index and its division records were correct on disk while
 * every division page shipped empty, because the loader resolved entry ids
 * from a record's `slug` field rather than its filename and `getEntry` found
 * nothing. Thirty-nine books of scripture built at sixteen kilobytes each and
 * the build was green.
 *
 * So the assertions here are deliberately dumb and about the artefact: the
 * verses are on the page, the anchor a reader would share is an element that
 * exists, and the editions are named. Nothing here trusts the build.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const CONTENT = resolve(ROOT, 'src/content');

if (!existsSync(DIST)) {
  console.error('\n  No dist/ directory. Run `pnpm build` first.\n');
  process.exit(1);
}

interface ChapterIndex {
  c: number;
  verses: number;
  preview?: string;
  english_gaps: number;
  original_gaps: number;
  blank: number;
}

/* A verse missing from both editions is counted in both totals and stated on
   the page once, so the note count is the union rather than the sum. */
const notesFor = (g: { english_gaps: number; original_gaps: number; blank: number }): number =>
  g.english_gaps + g.original_gaps - g.blank;

interface WorkIndex {
  id: string;
  title: string;
  editions: Record<string, string>;
  divisions: {
    n: number;
    slug: string;
    verses: number;
    chapters?: ChapterIndex[];
    english_gaps: number;
    original_gaps: number;
    blank: number;
  }[];
  total_verses: number;
  english_gaps: number;
  original_gaps: number;
}

const problems: string[] = [];
const fail = (where: string, message: string): void => {
  problems.push(`${where}\n      ${message}`);
};

const read = (path: string): string => readFileSync(path, 'utf8');
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

const worksDir = join(CONTENT, 'works');
const works = readdirSync(worksDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(read(join(worksDir, f))) as WorkIndex);

let pages = 0;
let versesOnPages = 0;

/*
  The page budget.

  A hundred kilobytes, on the artefact rather than on the wire, because that is
  the number the owner set and gzip's help varies by script. It is enforced
  where it can be met: a canon with a chapter level can always be cut to one,
  so a chapter page over budget is a bug in this build. A canon whose division
  IS its leaf — a surah runs straight to its ayat — is as small as the canon
  allows, and cutting it further would mean inventing an address the tradition
  does not cite. Those are reported at every run and never silently.
*/
const BUDGET = 100_000;
const overBudget: { route: string; bytes: number; splittable: boolean }[] = [];
const weigh = (route: string, path: string, splittable: boolean): void => {
  const bytes = statSync(path).size;
  if (bytes > BUDGET) overBudget.push({ route, bytes, splittable });
};

for (const work of works) {
  /* The contents page must offer every division, or a book is unreachable by
     any route a reader can find. */
  const contentsPath = join(DIST, 'read', work.id, 'index.html');
  if (!existsSync(contentsPath)) {
    fail(`/read/${work.id}`, 'no contents page was built');
    continue;
  }
  const contents = read(contentsPath);
  for (const division of work.divisions) {
    if (!contents.includes(`/read/${work.id}/${division.slug}"`)) {
      fail(`/read/${work.id}`, `contents page does not link to "${division.slug}"`);
    }
  }

  /* Every page names its editions — the memo's rule, and the reason a text
     page counts as sourced content at all. */
  const editionTitles = Object.values(work.editions).map(
    (id) => (JSON.parse(read(join(CONTENT, 'sources', `${id}.json`))) as { title: string }).title,
  );
  const namesEditions = (where: string, html: string): void => {
    for (const title of editionTitles) {
      if (!html.includes(title)) fail(where, `does not name its edition "${title}"`);
    }
  };

  const chaptered = work.divisions.some((d) => d.chapters !== undefined);

  /** A text page: exactly the verses claimed, and every one-sided verse marked. */
  const checkText = (where: string, path: string, verses: number, gaps: number): void => {
    if (!existsSync(path)) {
      fail(where, 'no page was built');
      return;
    }
    const html = read(path);
    pages += 1;
    weigh(where, path, chaptered);

    /* The assertion that would have caught the empty books. */
    const rendered = count(html, 'class="rd-verse"');
    if (rendered !== verses) {
      fail(where, `index says ${verses} verses, the page renders ${rendered}`);
    }
    versesOnPages += rendered;
    namesEditions(where, html);

    const gapNotes = count(html, 'rd-verse__gap ');
    if (gapNotes !== gaps) {
      fail(where, `${gaps} verses stand on one side only, ${gapNotes} say so on the page`);
    }
  };

  for (const division of work.divisions) {
    const at = `/read/${work.id}/${division.slug}`;

    if (division.chapters === undefined) {
      checkText(at, join(DIST, 'read', work.id, division.slug, 'index.html'),
        division.verses, notesFor(division));
      continue;
    }

    /* A chaptered division is a contents page: it must list every chapter and
       carry no verses of its own. */
    const path = join(DIST, 'read', work.id, division.slug, 'index.html');
    if (!existsSync(path)) {
      fail(at, 'no contents page was built');
      continue;
    }
    const html = read(path);
    weigh(at, path, true);
    namesEditions(at, html);
    if (count(html, 'class="rd-verse"') > 0) {
      fail(at, 'a chaptered division must be a contents page, not a text page');
    }
    for (const chapter of division.chapters) {
      if (!html.includes(`${at}/${chapter.c}"`)) {
        fail(at, `contents page does not link to chapter ${chapter.c}`);
      }
      checkText(`${at}/${chapter.c}`, join(DIST, 'read', work.id, division.slug, String(chapter.c), 'index.html'),
        chapter.verses, notesFor(chapter));
    }
  }
}

/* Anchors: every fragment the site links to inside the Reading Room must be an
   id that exists on the page it points at. A shared verse link that lands at
   the top of a book is the same bug as a broken link, and resolves as fine. */
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

let anchors = 0;
for (const file of walk(DIST)) {
  const html = read(file);
  const from = file.replace(DIST, '').replace(/\/index\.html$/, '') || '/';
  for (const match of html.matchAll(/href="(\/read\/[^"#]*)#([^"]+)"/g)) {
    const [, path, fragment] = match;
    if (path === undefined || fragment === undefined) continue;
    const target = join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(target)) continue; /* the link check owns this failure */
    if (!read(target).includes(`id="${fragment}"`)) {
      fail(from, `links to ${path}#${fragment}, which has no such id`);
    }
    anchors += 1;
  }
}

for (const { route, bytes, splittable } of overBudget) {
  if (splittable) {
    fail(route, `${bytes.toLocaleString('en')} bytes, past the ${BUDGET.toLocaleString('en')}-byte budget`);
  }
}

if (problems.length > 0) {
  console.error('\n  Reading Room check FAILED\n');
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
  if (problems.length > 40) console.error(`\n  …and ${problems.length - 40} more.`);
  console.error(`\n  ${problems.length} problem${problems.length === 1 ? '' : 's'}.\n`);
  process.exit(1);
}

const unsplittable = overBudget.filter((o) => !o.splittable);
if (unsplittable.length > 0) {
  console.log(
    `\n  ${unsplittable.length} route${unsplittable.length === 1 ? '' : 's'} past the ` +
      `${(BUDGET / 1000).toFixed(0)} KB budget, in a canon with no level below the one it ships:`,
  );
  for (const { route, bytes } of unsplittable.sort((a, b) => b.bytes - a.bytes)) {
    console.log(`      ${route.padEnd(24)} ${bytes.toLocaleString('en').padStart(9)} B`);
  }
}

console.log(
  `  Reading Room pages agree with their records — ` +
    `${versesOnPages.toLocaleString('en')} verses across ${pages} pages, ${anchors} verse anchors.`,
);
