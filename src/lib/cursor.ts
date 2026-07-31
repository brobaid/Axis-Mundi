/**
 * The shared time cursor.
 *
 * The Brass Meridian is one object standing in four rooms — the timeline's
 * playhead, the map's scrubber, the tree's slider, and the strip on the home
 * page. If each room kept its own idea of "now" the meridian would be four
 * unrelated ornaments that happen to look alike.
 *
 * So there is one parameter, `year`, and every room reads and writes it in the
 * same integer vocabulary the content collections use: negative is BCE, and 1
 * is 1 CE because there is no year zero.
 *
 * A room may still keep private state in the URL — the timeline's `from`/`to`
 * zoom, the matrix's `filter` — but that state is the room's own. `year` is the
 * only value that crosses a doorway.
 *
 * Pure and DOM-free: the same functions run at build time and in each island.
 */

export const CURSOR_PARAM = 'year';

/** What the map and tree called their detent before the cursor was shared. */
const LEGACY_PARAM = 'era';

/**
 * The cursor carried by a query string, or null if it carries none.
 *
 * `era` is still accepted so links written before the rooms shared a parameter
 * keep working. A reader's bookmark is not a migration problem to be pushed
 * onto the reader.
 */
export function readCursor(search: string): number | null {
  const q = new URLSearchParams(search);
  for (const key of [CURSOR_PARAM, LEGACY_PARAM]) {
    const raw = q.get(key);
    if (raw === null || raw === '') continue;
    const year = Number(raw);
    if (Number.isFinite(year) && Number.isInteger(year)) return year;
  }
  return null;
}

/**
 * The detent a year belongs to: the latest one at or before it.
 *
 * Not the nearest. A snapshot is a claim about a moment, and rounding 1499
 * forward to 1500 would show a reader the Reformation's century when they
 * asked for the one before it. Before the first detent, the first is all there
 * is — the map does not cover deep antiquity and says so.
 */
export function snapToDetent(year: number, detents: readonly number[]): number | null {
  if (detents.length === 0) return null;
  let best = detents[0] as number;
  for (const d of detents) {
    if (d <= year && d > best) best = d;
  }
  return best;
}

/**
 * A window of the same width, centred on `year` and kept inside the bounds.
 *
 * The timeline's zoom is the reader's, not the cursor's: arriving from another
 * room moves where they are looking without changing how far.
 */
export function centreOn(
  year: number,
  view: { readonly from: number; readonly to: number },
  bounds: { readonly from: number; readonly to: number },
): { from: number; to: number } {
  const span = view.to - view.from;
  const total = bounds.to - bounds.from;
  if (span >= total) return { from: bounds.from, to: bounds.to };

  let from = Math.round(year - span / 2);
  if (from < bounds.from) from = bounds.from;
  if (from + span > bounds.to) from = bounds.to - span;
  return { from, to: from + span };
}
