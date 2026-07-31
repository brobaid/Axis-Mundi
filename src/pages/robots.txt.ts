import type { APIRoute } from 'astro';

/**
 * robots.txt, generated rather than dropped in `public/`, so the sitemap's
 * absolute URL comes from the one place the origin is configured. A static file
 * would be a second copy of the domain, and second copies drift.
 *
 * Nothing is disallowed. This is a public reference work: every page is meant
 * to be found, and there is no admin surface, no user content, and no backend
 * to keep a crawler out of.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = site?.href.replace(/\/$/, '') ?? '';
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
