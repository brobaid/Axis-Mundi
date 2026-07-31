// @ts-check
import { defineConfig } from 'astro/config';

// Axis Mundi is a static content site: no adapter, no SSR, no backend.
// Vercel's Astro preset builds `dist/` and serves it from the edge.
export default defineConfig({
  site: 'https://axis-mundi-mu.vercel.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // Emit `/methodology.html` style pages rather than nested index files so the
    // static host does not depend on directory-index resolution.
    format: 'file',
  },
  compressHTML: true,
});
