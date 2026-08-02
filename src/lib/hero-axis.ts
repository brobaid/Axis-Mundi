import { TRADITIONS } from './traditions.js';
import type { TraditionId } from '../schemas/primitives.js';

/**
 * The entrance hall's axis: geometry.
 *
 * Ten traditions on ten engraved orbits around one centre — the museum's radial
 * identity, turning. The arithmetic lives here rather than in the component
 * because two of its properties are load-bearing and invisible in a diff:
 *
 *   1. Every node is a door to a tradition's dive, so every node must carry a
 *      44px touch target (design language, and the same rule the rooms rail
 *      follows).
 *   2. Ten 44px targets on concentric orbits inside a 358px square is not
 *      obviously possible. It is only possible because the wheel turns as one
 *      rigid instrument: the angle between any two nodes is fixed at authoring
 *      time and stays fixed for as long as the page is open, so a separation
 *      proved once is proved forever.
 *
 * Give the orbits independent speeds and property 2 evaporates — every pair of
 * nodes eventually lines up on the same ray, 10px apart, and the reader taps
 * Buddhism and lands on Sikhism. `scripts/check-timeline.ts` asserts the
 * separation so nobody can loosen the rigid turn without the gate noticing.
 */

/**
 * The wheel at 390px: the shell's inner width, 390 less two 16px gutters.
 *
 * This is the tightest case and therefore the one the gate reasons about. The
 * drawn geometry scales with the box, but the tap targets do not — they are a
 * fixed 44px at every width — so if the separations clear 44px here they clear
 * it everywhere.
 */
export const HERO_MIN_BOX = 358;

/** Design language §touch: nothing interactive is smaller than this. */
export const TAP_MIN = 44;

/** Innermost and outermost orbit, as fractions of the box's radius. */
export const ORBIT_INNER = 0.34;
export const ORBIT_OUTER = 0.85;

/**
 * The angle from one orbit to the next.
 *
 * Chosen by searching all 359 whole-degree steps that put ten nodes on ten
 * distinct rays and taking the one that maximises the smallest gap between any
 * two of them. 102° wins at 71.6px, against a 44px floor; the runners-up (101°,
 * 103°, 137°) are within a pixel, so the value is a comfortable plateau rather
 * than a knife edge. A "sensible" 36° would have given 32px and failed.
 */
export const ANGLE_STEP = 102;

/** The drawn dot and the lamp around it, in the 358-box's units. */
export const NODE_R = 5;
export const HALO_R = 13;

/** One revolution. Barely perceptible: the outermost node moves ~3px a second. */
export const TURN_SECONDS = 300;

/** The halo's breath — opacity only, so it costs no geometry. */
export const BREATH_SECONDS = 31;

export interface AxisNode {
  readonly id: TraditionId;
  readonly name: string;
  readonly hueToken: `--t-${string}`;
  /** Orbit radius as a fraction of the box's radius. */
  readonly orbit: number;
  /** Angle from the positive x-axis, degrees, counter-clockwise. */
  readonly angle: number;
  /** Node centre as a percentage of the box, ready for `left` / `top`. */
  readonly left: number;
  readonly top: number;
  /** Negative delay, so every halo starts mid-breath and none share a phase. */
  readonly breathDelay: number;
}

/**
 * The ten, innermost first, in the spec's own §2.1 order.
 *
 * Deliberately not ordered by founding date: orbit radius would then assert a
 * chronology, and several of these traditions' foundings are contested or
 * legendary. This is the same order the matrix columns, the legend and the
 * wheel already use, so it reads as the house order rather than as a claim.
 */
export const AXIS_NODES: readonly AxisNode[] = TRADITIONS.map((t, i) => {
  const orbit = ORBIT_INNER + (i * (ORBIT_OUTER - ORBIT_INNER)) / (TRADITIONS.length - 1);
  const angle = (i * ANGLE_STEP) % 360;
  const radians = (angle * Math.PI) / 180;
  return {
    id: t.id,
    name: t.name,
    hueToken: t.hueToken,
    orbit,
    angle,
    /* Percentages of the box: the centre is 50%, and the orbit is a fraction of
       the half-width, so a full radius is 50 percentage points. */
    left: 50 + orbit * 50 * Math.cos(radians),
    top: 50 - orbit * 50 * Math.sin(radians),
    breathDelay: -((i * 3.7) % BREATH_SECONDS),
  };
});

/** Every node pair with the distance between their centres, at a given box. */
export function nodeSeparations(box: number): readonly {
  readonly a: string;
  readonly b: string;
  readonly distance: number;
}[] {
  const points = AXIS_NODES.map((n) => ({
    id: n.id,
    x: (n.left / 100) * box,
    y: (n.top / 100) * box,
  }));
  const out: { a: string; b: string; distance: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i] as { id: string; x: number; y: number };
      const q = points[j] as { id: string; x: number; y: number };
      out.push({ a: p.id, b: q.id, distance: Math.hypot(p.x - q.x, p.y - q.y) });
    }
  }
  return out;
}
