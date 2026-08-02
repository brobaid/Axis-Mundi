import { TRADITIONS } from './traditions.js';
import type { TraditionId } from '../schemas/primitives.js';

/**
 * The entrance hall's instrument: geometry.
 *
 * Part astrolabe, part orrery — concentric rings of engraved gold turning at
 * different speeds, some one way and some the other, with the ten traditions
 * riding them as jewels. Every jewel is a door to a dive.
 *
 * The arithmetic lives here rather than in the component because one property
 * is load-bearing and invisible in a diff: every jewel carries a 44px touch
 * target, and ten of them inside a 358px square must never come within that of
 * each other.
 *
 * THE INVARIANT CHANGED WITH THE DESIGN, and this is the whole reason this file
 * is worth reading. The first instrument was a single rigid wheel, so the angle
 * between any two jewels was fixed at authoring time and a separation proved
 * once was proved forever. Rings that turn at different speeds destroy that:
 * every pair of jewels on different rings passes through perfect alignment,
 * repeatedly, and no argument about their starting angles survives it.
 *
 * So the guarantee moved from angle to radius. Rings are spaced at least
 * TAP_MIN apart, which means two jewels on different rings are at least that
 * far apart *even when perfectly aligned* — the worst case, and it happens
 * constantly. Within one ring the jewels are rigid to each other, so their
 * chord separation is fixed. Both halves are asserted in
 * `scripts/check-timeline.ts`, and the second half is what fails if anyone
 * moves a ring inward.
 */

/** The instrument at 390px: the shell's inner width, and the tightest case. */
export const HERO_MIN_BOX = 358;

/** Design language: nothing interactive is smaller than this. */
export const TAP_MIN = 44;

/**
 * Ring radii in the 358-box's own pixels.
 *
 * Three rings, 46px apart — TAP_MIN plus two pixels of margin — with the
 * outermost at 138 so its jewels' targets end at 160, inside the box's 179.
 * A fourth ring does not fit: 184 + 22 is past the edge, and closing the
 * spacing to fit one would break the only guarantee that survives independent
 * rotation.
 */
export const RING_RADII = [46, 92, 138] as const;

/** Seconds per revolution, and the sign is the direction. */
export const RING_PERIODS = [420, -540, 680] as const;

/** The drawn jewel and the lamp around it. */
export const NODE_R = 4.5;
export const HALO_R = 13;

/** The halo's breath — opacity only, so it costs no geometry. */
export const BREATH_SECONDS = 31;

/** One pass of the light shaft. Slow enough to be an event, not a metronome. */
export const SWEEP_SECONDS = 17;

export interface AxisNode {
  readonly id: TraditionId;
  readonly name: string;
  readonly hueToken: `--jewel-${string}`;
  /** Which ring it rides, 0 innermost. */
  readonly ring: number;
  /** Angle from the positive x-axis, degrees, counter-clockwise. */
  readonly angle: number;
  /** Jewel centre as a percentage of the box, ready for `left` / `top`. */
  readonly left: number;
  readonly top: number;
  /** Negative delay, so no two halos share a phase. */
  readonly breathDelay: number;
}

/**
 * Three, three and four, innermost first, in the spec's own §2.1 order.
 *
 * Deliberately not ordered by founding date or size: a ring would then assert a
 * chronology or a ranking, and this museum does neither. This is the order the
 * matrix columns, the legend and the year wheel already use.
 */
const PER_RING = [3, 3, 4] as const;

export const AXIS_NODES: readonly AxisNode[] = (() => {
  const out: AxisNode[] = [];
  let i = 0;
  for (const [ring, count] of PER_RING.entries()) {
    const step = 360 / count;
    /* Each ring starts at its own offset so the instrument never reads as a
       row of spokes when the rings happen to line up. */
    const phase = ring * 37;
    for (let k = 0; k < count; k++) {
      const t = TRADITIONS[i];
      if (t === undefined) break;
      const angle = (phase + k * step) % 360;
      const radians = (angle * Math.PI) / 180;
      const orbit = (RING_RADII[ring] as number) / (HERO_MIN_BOX / 2);
      out.push({
        id: t.id,
        name: t.name,
        hueToken: `--jewel-${t.id}`,
        ring,
        angle,
        left: 50 + orbit * 50 * Math.cos(radians),
        top: 50 - orbit * 50 * Math.sin(radians),
        breathDelay: -((i * 3.7) % BREATH_SECONDS),
      });
      i += 1;
    }
  }
  return out;
})();

/**
 * The closest two jewels ever come, at a given box size.
 *
 * Two numbers, because two different things bound them. Jewels on one ring are
 * rigid to each other, so their separation is the chord at their fixed angle.
 * Jewels on different rings are not, so the only safe assumption is that they
 * are perfectly aligned — which they periodically are — and then all that
 * separates them is the gap between their rings.
 */
export function closestApproach(box: number): {
  readonly withinRing: number;
  readonly acrossRings: number;
  readonly pair: string;
} {
  const scale = box / HERO_MIN_BOX;
  let withinRing = Infinity;
  let pair = '';

  for (const ring of RING_RADII.keys()) {
    const on = AXIS_NODES.filter((n) => n.ring === ring);
    for (let a = 0; a < on.length; a++) {
      for (let b = a + 1; b < on.length; b++) {
        const p = on[a] as AxisNode;
        const q = on[b] as AxisNode;
        const dx = ((p.left - q.left) / 100) * box;
        const dy = ((p.top - q.top) / 100) * box;
        const d = Math.hypot(dx, dy);
        if (d < withinRing) {
          withinRing = d;
          pair = `${p.id}/${q.id}`;
        }
      }
    }
  }

  let acrossRings = Infinity;
  for (let i = 1; i < RING_RADII.length; i++) {
    const gap = ((RING_RADII[i] as number) - (RING_RADII[i - 1] as number)) * scale;
    if (gap < acrossRings) acrossRings = gap;
  }

  return { withinRing, acrossRings, pair };
}

/** How far the outermost jewel's target reaches from the centre. */
export const outerReach = (box: number): number =>
  ((RING_RADII[RING_RADII.length - 1] as number) * box) / HERO_MIN_BOX + TAP_MIN / 2;
