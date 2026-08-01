/**
 * Momentum for a dragged canvas, and the intent test that decides who owns a
 * touch.
 *
 * DOM-free arithmetic on one side, one rAF loop on the other, so the model can
 * be reasoned about without a browser and the island stays thin.
 *
 * Why this exists: d3-zoom's touch path pans while a finger is down and stops
 * the instant it lifts. On a phone that turns two thousand years into a series
 * of short scrubs. Time travel should feel like a flick sends you down the
 * centuries.
 */

export interface Sample {
  readonly t: number;
  readonly x: number;
}

/** How far back a release velocity looks. Older samples are stale intent. */
const VELOCITY_WINDOW_MS = 90;

/**
 * Release velocity in px/ms, from the samples inside the trailing window.
 *
 * The oldest sample still inside the window is the baseline, not the whole
 * gesture: a reader who drags slowly, pauses, then flicks has flicked.
 */
export function velocityFrom(samples: readonly Sample[]): number {
  const last = samples[samples.length - 1];
  if (last === undefined) return 0;
  let first = last;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (s === undefined) break;
    if (last.t - s.t > VELOCITY_WINDOW_MS) break;
    first = s;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.x - first.x) / dt;
}

/* Exponential decay, the model every touch platform uses. Distance travelled
   is v0 * TAU, so a hard flick of 3 px/ms carries about a thousand pixels. */
const TAU_MS = 330;
/* Reduced motion shortens the glide; it does not remove it. A cut would put
   the reader somewhere they did not choose. */
const TAU_REDUCED_MS = 90;
/** Below this the glide is no longer motion, only jitter. */
const STOP_PX_PER_MS = 0.015;
/** A flick slower than this was a drag, and a drag ends where it ends. */
export const FLICK_MIN_PX_PER_MS = 0.12;

export interface GlideOptions {
  /** px/ms at release. Sign carries direction. */
  readonly velocity: number;
  /** Applies one frame's movement. Returns false to end the glide early. */
  readonly step: (dx: number) => boolean;
  readonly reduced: boolean;
  readonly now?: () => number;
  readonly frame?: (cb: (t: number) => void) => number;
  readonly cancelFrame?: (h: number) => void;
}

/**
 * Runs a decaying glide. Returns a cancel function, which is what makes the
 * glide interruptible: touching down again stops it where it stands rather
 * than queueing behind it.
 */
export function glide(opts: GlideOptions): () => void {
  const now = opts.now ?? (() => performance.now());
  const frame = opts.frame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = opts.cancelFrame ?? ((h) => cancelAnimationFrame(h));
  const tau = opts.reduced ? TAU_REDUCED_MS : TAU_MS;

  let v = opts.velocity;
  let last = now();
  let handle = 0;
  let live = true;

  const tick = (): void => {
    if (!live) return;
    const t = now();
    const dt = Math.min(t - last, 64); /* a backgrounded tab must not lurch */
    last = t;
    const dx = v * dt;
    v *= Math.exp(-dt / tau);
    if (!opts.step(dx) || Math.abs(v) < STOP_PX_PER_MS) {
      live = false;
      return;
    }
    handle = frame(tick);
  };

  handle = frame(tick);
  return () => {
    live = false;
    cancelFrame(handle);
  };
}

/** What a touch turned out to be, decided in its first few pixels. */
export type Intent = 'undecided' | 'horizontal' | 'vertical';

/** Movement below this is noise; nothing is decided yet. */
const INTENT_SLOP_PX = 6;

/**
 * Decides who owns the gesture.
 *
 * Ties go to the page. A reader scrolling past a canvas is the common case and
 * a canvas that grabs an ambiguous swipe is a canvas that fights its reader.
 */
export function intentOf(dx: number, dy: number): Intent {
  if (Math.hypot(dx, dy) < INTENT_SLOP_PX) return 'undecided';
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}
