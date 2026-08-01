/**
 * A brief, legible morph between two renders of the same canvas.
 *
 * The timeline re-renders wholesale — the model runs, the renderer returns
 * markup, innerHTML replaces the lot. That is the right shape for a canvas
 * whose layout is a pure function of its viewport, but it means a change of
 * granularity arrives as a snap: every dot and every axis label is somewhere
 * else, instantly, and a first-time reader cannot tell whether the scale
 * changed or the data did.
 *
 * So: measure where the keyed elements were before the re-render, find the
 * same keys after it, and play them from their old positions to their new ones
 * in one movement. FLIP — First, Last, Invert, Play — because animating
 * `transform` costs no layout, where animating `left` would relayout the whole
 * track on every frame.
 *
 * Only for granularity changes. A continuous zoom is already legible frame by
 * frame, and animating it would fight the reader's own gesture.
 */

/** Elements are matched across renders by this attribute. */
const KEY = 'data-morph-key';

export interface MorphOptions {
  /** Milliseconds. Long enough to read as movement, short enough not to wait. */
  readonly duration?: number;
  readonly easing?: string;
}

export type MorphSnapshot = Map<string, { x: number; y: number }>;

/** Where every keyed element sits right now, relative to the container. */
export function snapshotPositions(root: ParentNode): MorphSnapshot {
  const out: MorphSnapshot = new Map();
  for (const el of root.querySelectorAll<HTMLElement>(`[${KEY}]`)) {
    const key = el.getAttribute(KEY);
    if (key === null) continue;
    out.set(key, { x: el.offsetLeft, y: el.offsetTop });
  }
  return out;
}

/**
 * Play the keyed elements from where they were to where they are.
 *
 * An element with no previous position is new to this granularity — it fades up
 * in place rather than flying in from nowhere, because it did not come from
 * anywhere. One that has moved less than a pixel is left alone: a transition
 * that does not move is a frame the browser spends for no reason.
 */
export function playMorph(
  root: ParentNode,
  before: MorphSnapshot,
  options: MorphOptions = {},
): void {
  const duration = options.duration ?? 260;
  const easing = options.easing ?? 'cubic-bezier(0.2, 0, 0, 1)';

  /* Reduced motion asks for cuts, not transitions (design language §7). The
     scale still changes; the reader is simply not made to watch it move. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const moves: { el: HTMLElement; dx: number; dy: number }[] = [];
  const entries: HTMLElement[] = [];

  for (const el of root.querySelectorAll<HTMLElement>(`[${KEY}]`)) {
    const key = el.getAttribute(KEY);
    if (key === null) continue;
    const prev = before.get(key);
    if (prev === undefined) {
      entries.push(el);
      continue;
    }
    const dx = prev.x - el.offsetLeft;
    const dy = prev.y - el.offsetTop;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    moves.push({ el, dx, dy });
  }

  for (const { el, dx, dy } of moves) {
    el.style.transition = 'none';
    /* A custom property, not `transform`: a tick already carries an alignment
       transform and the two compose in CSS instead of overwriting each other. */
    el.style.setProperty('--morph-shift', `translate(${dx}px, ${dy}px)`);
  }
  for (const el of entries) {
    el.style.transition = 'none';
    el.style.opacity = '0';
  }

  /* Two frames: one to let the inverted position paint, one to start from it.
     A single frame is enough in Chromium and not in every engine. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const { el } of moves) {
        el.style.transition = `transform ${duration}ms ${easing}`;
        el.style.removeProperty('--morph-shift');
      }
      for (const el of entries) {
        el.style.transition = `opacity ${duration}ms ${easing}`;
        el.style.opacity = '';
      }
      window.setTimeout(() => {
        for (const { el } of moves) el.style.transition = '';
        for (const el of entries) el.style.transition = '';
      }, duration + 40);
    });
  });
}
