/**
 * The living timeline on the home page.
 *
 * The reference build's hero strip: one thin lane per tradition, a dot per
 * event, the Brass Meridian standing across them as the shared time cursor.
 * It is a real reduction of the published events collection, not an
 * illustration — a tradition with no sourced events shows an empty lane, which
 * is the honest picture of the build.
 *
 * Pure and DOM-free. It only ever runs at build time today; keeping it here
 * rather than inside the page keeps the arithmetic testable and the page
 * readable.
 */

export interface HeroEvent {
  readonly year: number;
  readonly tradition: string;
  /** 1–5. Drives dot size and the entrance stagger. */
  readonly importance: number;
}

export interface HeroDot {
  /** Percent across the strip. */
  readonly x: number;
  readonly importance: number;
}

export interface HeroLane {
  readonly tradition: string;
  readonly name: string;
  readonly dots: readonly HeroDot[];
}

export interface HeroWindow {
  readonly from: number;
  readonly to: number;
}

/**
 * The window rounds out to whole centuries so the axis reads as an axis rather
 * than as the extremes of whatever happens to be sourced this week. It is
 * derived from the data, never fixed, so promoting an earlier event widens the
 * strip instead of pushing the event off it.
 */
export function heroWindow(events: readonly HeroEvent[]): HeroWindow {
  if (events.length === 0) return { from: 0, to: 1000 };

  const years = events.map((e) => e.year);
  const from = Math.floor(Math.min(...years) / 100) * 100;
  const to = Math.ceil(Math.max(...years) / 100) * 100;

  /* A single-century span would put every dot on one pixel column. */
  return to - from < 200 ? { from, to: from + 200 } : { from, to };
}

/** Percent across the window, clamped so a stray year cannot escape the plate. */
export const position = (year: number, window: HeroWindow): number => {
  const span = window.to - window.from;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((year - window.from) / span) * 100));
};

export function heroLanes(
  events: readonly HeroEvent[],
  traditions: readonly { readonly id: string; readonly name: string }[],
  window: HeroWindow,
): HeroLane[] {
  return traditions.map((tradition) => ({
    tradition: tradition.id,
    name: tradition.name,
    dots: events
      .filter((event) => event.tradition === tradition.id)
      .map((event) => ({ x: position(event.year, window), importance: event.importance }))
      .sort((a, b) => a.x - b.x),
  }));
}

/** Era-aware year label for the meridian and the axis ends. */
export const heroYear = (year: number): string =>
  year < 0 ? `${Math.abs(year)} BCE` : year === 0 ? '1 BCE' : `${year} CE`;
