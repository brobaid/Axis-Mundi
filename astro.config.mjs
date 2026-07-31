// @ts-check
import { defineConfig } from 'astro/config';

// Axis Mundi is a static content site: no adapter, no SSR, no backend.
// Vercel's Astro preset builds `dist/` and serves it from the edge.
export default defineConfig({
  site: 'https://axis-mundi-mu.vercel.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // Emit `/timeline/index.html`, so `/timeline` resolves by ordinary
    // directory-index lookup — the one thing every static host does.
    //
    // This was `'file'` until it 404'd in production. That form emits
    // `/timeline.html`, which only works if the host rewrites extensionless
    // paths to `.html`. `astro preview` does that rewrite and Vercel does not,
    // so the bug could not reproduce locally.
    format: 'directory',
  },
  compressHTML: true,
});
