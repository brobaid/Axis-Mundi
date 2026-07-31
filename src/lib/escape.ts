/**
 * HTML escaping for the string-building renderers.
 *
 * The map canvas, the compare grid and the shared panel all assemble markup as
 * strings so the same function can serve the server-rendered first paint and
 * the island. That makes escaping a single shared concern rather than a habit
 * each module has to remember, so it lives in one place.
 */
export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
