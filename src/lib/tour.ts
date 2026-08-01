/**
 * The Grand Tour's timing — Phase 3 delighter C.
 *
 * DOM-free, so the pacing can be reasoned about and checked without a browser.
 *
 * The tour is the twelve era notes read in order. It writes no copy of its own:
 * every word a reader sees during it was already on the plate it belongs to.
 */

/** Matches `--dur-scrub`, the map's own crossfade. */
export const CROSSFADE_MS = 600;

/**
 * Reduced motion steps rather than fades, so the plate changes at once.
 *
 * The transition is what shortens, never the caption: a reader who asked for
 * less movement did not ask for less time to read.
 */
export const CROSSFADE_REDUCED_MS = 0;

/** Long enough to take the plate in before its note arrives. */
const SETTLE_MS = 400;

/** A calm two hundred words a minute, plus a beat at each end. */
const MS_PER_WORD = 300;
const BASE_DWELL_MS = 2500;

export const wordCount = (note: string): number => note.trim().split(/\s+/).filter(Boolean).length;

/** How long a caption stays up, given its own length. */
export const dwellFor = (note: string): number => BASE_DWELL_MS + wordCount(note) * MS_PER_WORD;

/** When the caption appears, measured from the moment the plate starts changing. */
export const captionAt = (reduced: boolean): number =>
  (reduced ? CROSSFADE_REDUCED_MS : CROSSFADE_MS) + SETTLE_MS;

/** The whole step: plate changes, settles, caption shows, caption is read. */
export const stepDuration = (note: string, reduced: boolean): number =>
  captionAt(reduced) + dwellFor(note);

/** Total running time, for the control's own label. */
export function tourLength(notes: readonly string[], reduced: boolean): number {
  return notes.reduce((sum, n) => sum + stepDuration(n, reduced), 0);
}

/** "about 5 minutes", for a reader deciding whether to start. */
export function roughMinutes(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes <= 1 ? 'about a minute' : `about ${minutes} minutes`;
}
