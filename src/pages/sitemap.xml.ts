import type { APIRoute } from 'astro';
import { getPublishable } from '../lib/content';

/**
 * The sitemap, built from the collections rather than from a list.
 *
 * Written by hand instead of pulling in @astrojs/sitemap for the same reason
 * the rest of this site has no dependencies it can do without: the route set
 * here is not "whatever Astro emitted", it is the rooms plus the dives that
 * passed their source check. A dive still awaiting one is not in the build, so
 * it must not be in the sitemap either — a sitemap that lists a 404 is a
 * sitemap that lies.
 *
 * No `lastmod`: the honest value is the record's own revision date, which the
 * schemas do not carry, and a build timestamp would tell a crawler every page
 * changed every deploy. Better silent than wrong.
 *
 * Paths carry a trailing slash because `build.format: 'directory'` emits
 * `/timeline/index.html`, so `/timeline/` is what every page declares as its
 * own canonical. A sitemap that disagreed with the canonicals would hand a
 * crawler two URLs for one page.
 */

/** The rooms, in the order the rail lists them. Priority is relative, not absolute. */
const ROOMS: readonly (readonly [string, string])[] = [
  ['/', '1.0'],
  ['/timeline', '0.9'],
  ['/map', '0.9'],
  ['/traditions', '0.9'],
  ['/matrix', '0.8'],
  ['/compare', '0.8'],
  ['/tree', '0.8'],
  ['/wheel', '0.8'],
  ['/methodology', '0.5'],
  ['/colophon', '0.4'],
];

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.href.replace(/\/$/, '') ?? '';
  const dives = await getPublishable('deepDives');

  const urls = [
    ...ROOMS,
    ...dives.map((entry) => [`/traditions/${entry.data.tradition}`, '0.7'] as const),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(([path, priority]) => {
        const loc = path === '/' ? '/' : `${path}/`;
        return `  <url>\n    <loc>${origin}${loc}</loc>\n    <priority>${priority}</priority>\n  </url>\n`;
      })
      .join('') +
    `</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
