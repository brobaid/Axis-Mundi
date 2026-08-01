/**
 * Tap resolution for realms smaller than a fingertip.
 *
 * A country is as big as its geography. At 390px Luxembourg is eleven pixels
 * across and Vatican City is smaller than the antialiasing, so the 44px target
 * rule cannot be met by making the target bigger — the target *is* the content.
 * What can change is how a tap is resolved: instead of demanding a direct hit,
 * find the nearest realm within a fingertip's reach and offer it.
 *
 * The search uses the browser's own hit testing rather than re-deriving the
 * projection. `elementFromPoint` already knows exactly where every path landed,
 * including the frame's scaling, so a spiral of probe points around the tap is
 * both simpler and more accurate than any geometry we could recompute here.
 *
 * Nothing is committed from a near miss. The caller shows the candidate and
 * waits for a second, deliberate tap — a map where a stray thumb opens Belgium
 * is worse than one where small countries are hard to hit.
 */

/** Rings, in CSS pixels. A fingertip is ~44px across, so 22 is its radius. */
const RADII = [0, 6, 11, 16, 22];
/** Probes per ring. Twelve is enough to catch an 11px country at r=22. */
const SPOKES = 12;

export interface NearestOptions {
  /** Only realms inside this element count — the active snapshot's layer. */
  readonly within: Element;
  /** Selector for the group that carries a realm's identity. */
  readonly selector?: string;
}

/**
 * The realm nearest to a viewport point, or null if none is within reach.
 *
 * Returns the group element and the distance in pixels at which it was found,
 * so a caller can tell a direct hit (0) from a rescued near miss.
 */
export function nearestRealm(
  x: number,
  y: number,
  options: NearestOptions,
): { group: Element; distance: number } | null {
  const selector = options.selector ?? '[data-realm]';

  for (const r of RADII) {
    /* A ring at radius 0 is the point itself; probing twelve times would ask
       the same question twelve times. */
    const probes = r === 0 ? [[x, y]] : ringProbes(x, y, r);
    let best: Element | null = null;

    for (const [px, py] of probes) {
      const el = document.elementFromPoint(px as number, py as number);
      if (el === null) continue;
      const group = el.closest(selector);
      /* A realm on an inactive layer is invisible and must not be reachable —
         `within` is the active layer, so containment is the whole test. */
      if (group === null || !options.within.contains(group)) continue;
      best = group;
      break;
    }

    if (best !== null) return { group: best, distance: r };
  }

  return null;
}

function ringProbes(x: number, y: number, r: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < SPOKES; i += 1) {
    const a = (i / SPOKES) * Math.PI * 2;
    out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return out;
}

/**
 * A viewBox that frames one realm, padded, for the magnified confirm chip.
 *
 * The chip shows the candidate's own outline at a size a thumb can judge —
 * the point is to answer "did I mean this one?" before anything opens, and a
 * name alone does not answer it when the reader is looking at a coastline.
 */
export function realmViewBox(bbox: DOMRect, padRatio = 0.35): string {
  const pad = Math.max(bbox.width, bbox.height) * padRatio;
  /* Square, so the shape is not stretched by the chip's aspect ratio. */
  const side = Math.max(bbox.width, bbox.height) + pad * 2;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
}
