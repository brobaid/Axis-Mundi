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

interface WorkIndex {
  id: string;
  title: string;
  editions: Record<string, string>;
  divisions: { n: number; slug: string; verses: number; english_gaps: number }[];
  total_verses: number;
  english_gaps: number;
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

  for (const division of work.divisions) {
    const path = join(DIST, 'read', work.id, division.slug, 'index.html');
    if (!existsSync(path)) {
      fail(`/read/${work.id}/${division.slug}`, 'no page was built');
      continue;
    }
    const html = read(path);
    pages += 1;

    /* The assertion that would have caught the empty books. */
    const rendered = count(html, 'class="rd-verse"');
    if (rendered !== division.verses) {
      fail(
        `/read/${work.id}/${division.slug}`,
        `index says ${division.verses} verses, the page renders ${rendered}`,
      );
    }
    versesOnPages += rendered;

    /* Every edition named on every page — the memo's rule, and the reason a
       text page counts as sourced content at all. */
    for (const sourceId of Object.values(work.editions)) {
      const source = join(CONTENT, 'sources', `${sourceId}.json`);
      const title = (JSON.parse(read(source)) as { title: string }).title;
      if (!html.includes(title)) {
        fail(`/read/${work.id}/${division.slug}`, `does not name its edition "${title}"`);
      }
    }

    /* A verse with no English says so, once per gap and never otherwise. */
    const gapNotes = count(html, 'rd-verse__gap');
    if (gapNotes !== division.english_gaps) {
      fail(
        `/read/${work.id}/${division.slug}`,
        `${division.english_gaps} verses lack English, ${gapNotes} say so on the page`,
      );
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

if (problems.length > 0) {
  console.error('\n  Reading Room check FAILED\n');
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
  if (problems.length > 40) console.error(`\n  …and ${problems.length - 40} more.`);
  console.error(`\n  ${problems.length} problem${problems.length === 1 ? '' : 's'}.\n`);
  process.exit(1);
}

console.log(
  `  Reading Room pages agree with their records — ` +
    `${versesOnPages.toLocaleString('en')} verses across ${pages} pages, ${anchors} verse anchors.`,
);
