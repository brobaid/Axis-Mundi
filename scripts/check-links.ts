/**
 * Axis Mundi — internal link check against the built output.
 *
 * Every internal href in `dist/` must resolve to a real file, using the rules a
 * plain static host applies: a directory-index lookup, and nothing else. No
 * extensionless-to-`.html` rewriting, because Vercel does not do that by
 * default even though `astro preview` does.
 *
 * This exists because that exact divergence shipped a 404: the build emitted
 * `/timeline.html`, the nav linked to `/timeline`, the preview server rewrote
 * it and production did not. A local pass has to mean a production pass, so the
 * check runs against `dist/` after every build.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

if (!existsSync(DIST)) {
  console.error('\n  No dist/ directory. Run `pnpm build` first.\n');
  process.exit(1);
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Resolve a URL path the way a plain static host would. */
function resolves(urlPath: string): boolean {
  const clean = urlPath.split('#')[0]?.split('?')[0] ?? '';
  if (clean === '' || clean === '/') return existsSync(join(DIST, 'index.html'));

  const rel = clean.replace(/^\//, '').replace(/\/$/, '');
  const asFile = join(DIST, rel);
  const asIndex = join(DIST, rel, 'index.html');

  if (existsSync(asIndex)) return true;
  if (existsSync(asFile) && statSync(asFile).isFile()) return true;
  return false;
}

const HREF = /(?:href|src)="([^"]+)"/g;

interface Miss {
  readonly page: string;
  readonly href: string;
}

const misses: Miss[] = [];
let checked = 0;
const pages = walk(DIST);

for (const page of pages) {
  /* Script and style bodies are not markup. Scanning them turns any JS template
     literal that builds an anchor — `href="${doc.url}"` — into a phantom
     broken link. Strip them before looking for hrefs. */
  const html = readFileSync(page, 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const from = page.slice(DIST.length) || '/';

  for (const match of html.matchAll(HREF)) {
    const href = match[1];
    if (href === undefined) continue;

    /* External, protocol-relative, in-page and non-navigational targets. */
    if (
      href === '' ||
      href.startsWith('#') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('//') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('data:')
    ) {
      continue;
    }

    /* Relative hrefs are resolved against the page's own directory. */
    const target = href.startsWith('/')
      ? href
      : join(dirname(from), href).replace(/\\/g, '/');

    checked += 1;
    if (!resolves(target)) misses.push({ page: from, href });
  }
}

/* The search index is fetched at runtime rather than linked, so it never
   appears in an href. Check it explicitly. */
const RUNTIME_FETCHES = ['/search-index.json'];
for (const path of RUNTIME_FETCHES) {
  checked += 1;
  if (!resolves(path)) misses.push({ page: '(runtime fetch)', href: path });
}

/**
 * Every built page must appear in the sitemap.
 *
 * The room list is written by hand, deliberately — the sitemap is the rooms
 * plus the dives that passed their check, not "whatever Astro emitted". But a
 * hand-kept list drifts, and it did: the colophon and the year wheel shipped
 * for a build without ever entering the sitemap. So the list stays hand-kept
 * and this asserts it stayed complete.
 */
const sitemapPath = join(DIST, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const listed = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? '').pathname),
  );
  const routes = pages
    .filter((f) => f.endsWith('/index.html'))
    .map((f) => f.slice(DIST.length).replace(/index\.html$/, ''));
  const unlisted = routes.filter((r) => !listed.has(r));
  if (unlisted.length > 0) {
    console.error('\n  Sitemap check FAILED\n');
    for (const r of unlisted) console.error(`      ${r}  →  built but not in sitemap.xml`);
    console.error(`\n  ${unlisted.length} of ${routes.length} routes missing.\n`);
    process.exit(1);
  }
}

if (misses.length > 0) {
  console.error('\n  Internal link check FAILED\n');
  let last = '';
  for (const miss of misses) {
    if (miss.page !== last) {
      console.error(`  ${miss.page}`);
      last = miss.page;
    }
    console.error(`      ${miss.href}  →  no such file in dist/`);
  }
  console.error(
    `\n  ${misses.length} broken, ${checked} checked across ${pages.length} pages.` +
      '\n  A plain static host resolves a directory index and nothing else.\n',
  );
  process.exit(1);
}

console.log(`  Internal links resolve — ${checked} across ${pages.length} pages.`);
