import type { TraditionId } from '../schemas/primitives';

/**
 * The timeline's layout logic, as pure functions.
 *
 * No DOM, no Astro, no D3 — this module runs identically during the static
 * build (for the server-rendered first paint and the accessible list) and
 * inside the island (on every zoom, pan and drill). Keeping it isomorphic is
 * what stops the two renders from disagreeing.
 *
 * Governing rules:
 *   Phase 0 spec §4  — importance rubric and the ~8-per-lane density budget
 *   Design language §3.2 — branch lanes are stepped tints, never new hues
 *   Kickoff M1 — near-coincident events dodge or cluster, never overlap
 */

/* ── data shapes, narrowed to what layout needs ─────────────────────────── */

export interface TimelineEvent {
  readonly id: string;
  readonly title: string;
  readonly year_start: number;
  readonly year_end?: number | undefined;
  readonly display_date: string;
  readonly traditions: readonly TraditionId[];
  readonly branch_path: readonly string[];
  readonly type: string;
  readonly importance: number;
  readonly summary: string;
  /** The summary with glossary headwords wrapped; absent means none matched. */
  readonly summary_html?: string | undefined;
  readonly contested: boolean;
  readonly contested_note?: string | undefined;
  readonly sources: readonly string[];
  readonly region: readonly string[];
}

export interface TaxonomyNode {
  readonly id: string;
  readonly name: string;
  readonly parent: string | null;
  readonly path: string;
  readonly depth: number;
  readonly tradition: TraditionId;
  readonly order: number;
  readonly contested: boolean;
}

/** A row on the canvas. */
export interface Lane {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly tradition: TraditionId;
  /**
   * How much of the parent hue this lane keeps, as a percentage mixed against
   * the surface. 100 at tradition level; branch lanes step down (§3.2 rule 3:
   * stepped tints of the parent, never new hues).
   */
  readonly tintPercent: number;
  /** Only tradition-level lanes carry a symbol (design language §6). */
  readonly symbol: TraditionId | null;
  readonly contested: boolean;
  /** Whether drilling into this lane would reveal anything. */
  readonly drillable: boolean;
}

export interface Viewport {
  /** Inclusive year at the left edge. Negative = BCE. */
  readonly from: number;
  /** Inclusive year at the right edge. */
  readonly to: number;
  /** Pixel width of the track area (excludes the lane header gutter). */
  readonly width: number;
}

/* ── drill paths ────────────────────────────────────────────────────────── */

/** "" = World. Otherwise a slug path, e.g. "christianity/protestant". */
export type DrillPath = string;

export const drillSegments = (path: DrillPath): string[] =>
  path === '' ? [] : path.split('/');

export const drillParent = (path: DrillPath): DrillPath => {
  const parts = drillSegments(path);
  parts.pop();
  return parts.join('/');
};

/* ── lane construction ──────────────────────────────────────────────────── */

const TRADITION_ORDER: readonly TraditionId[] = [
  'judaism',
  'christianity',
  'islam',
  'hinduism',
  'buddhism',
  'sikhism',
  'chinese',
  'shinto',
  'jainism',
  'zoroastrianism',
];

/**
 * Lanes for a drill path.
 *
 * World shows the ten traditions. Drilling shows the children of the drilled
 * node — so `christianity` yields Catholic, Orthodox, Protestant and so on.
 * A node with no children yields itself, so drilling never lands on emptiness.
 */
export function buildLanes(nodes: readonly TaxonomyNode[], drill: DrillPath): Lane[] {
  const byPath = new Map(nodes.map((n) => [n.path, n]));

  if (drill === '') {
    return TRADITION_ORDER.flatMap((id) => {
      const node = byPath.get(id);
      if (node === undefined) return [];
      return [
        {
          id: node.id,
          name: node.name,
          path: node.path,
          tradition: node.tradition,
          /* Tradition lanes carry the hue at full strength. */
          tintPercent: 100,
          symbol: node.tradition,
          contested: node.contested,
          drillable: nodes.some((n) => n.parent === node.id),
        },
      ];
    });
  }

  const parent = byPath.get(drill);
  if (parent === undefined) return buildLanes(nodes, '');

  const children = nodes
    .filter((n) => n.parent === parent.id)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const source = children.length > 0 ? children : [parent];

  /* 16% per step, which reproduces the design export's four Protestant lanes
     exactly (100 / 84 / 68 / 52). A wider family compresses the step so the
     faintest lane never drops below 44% and vanishes into the canvas — an
     eight-branch family reads as a gradient rather than four repeated pairs. */
  const n = source.length;
  const total = Math.min(16 * (n - 1), 56);
  const tint = (i: number): number => (n <= 1 ? 100 : 100 - (i / (n - 1)) * total);

  return source.map((node, i) => ({
    id: node.id,
    name: node.name,
    path: node.path,
    tradition: node.tradition,
    tintPercent: children.length > 0 ? tint(i) : 100,
    symbol: node.depth === 1 ? node.tradition : null,
    contested: node.contested,
    drillable: nodes.some((n) => n.parent === node.id),
  }));
}

/** True when `eventPath` sits at or below `lanePath`. */
export const pathContains = (lanePath: string, eventPath: string): boolean =>
  eventPath === lanePath || eventPath.startsWith(`${lanePath}/`);

export const eventInLane = (event: TimelineEvent, lane: Lane): boolean =>
  event.branch_path.some((p) => pathContains(lane.path, p));

/**
 * Ghost events: real events from the drilled tradition that belong to a sibling
 * branch outside the current lanes. Shown dashed so a drilled view does not
 * imply its branch was the only thing happening (kickoff M1, v5's Trent ghost).
 */
export function ghostEvents(
  events: readonly TimelineEvent[],
  lanes: readonly Lane[],
  drill: DrillPath,
): TimelineEvent[] {
  if (drill === '') return [];
  const root = drillSegments(drill)[0];
  if (root === undefined) return [];

  return events.filter((event) => {
    const inTradition = event.branch_path.some((p) => pathContains(root, p));
    if (!inTradition) return false;
    return !lanes.some((lane) => eventInLane(event, lane));
  });
}

/* ── semantic zoom ──────────────────────────────────────────────────────── */

/**
 * Importance floor for a given span, per the spec §4 rubric: rank 5 at
 * millennia view down to rank 1 at maximum zoom. Calibrated so the reference
 * build's World view (0–1200 CE) admits ranks 3 and up, which is what both v5
 * and the design export render.
 */
export function minimumRank(span: number): number {
  if (span > 3000) return 5;
  if (span > 1500) return 4;
  if (span > 400) return 3;
  if (span > 100) return 2;
  return 1;
}

/** Human name for the current zoom, for the breadcrumb and screen readers. */
/**
 * The four granularities the timeline reads at, in the museum's voice.
 *
 * Named for what the axis is counting in, not for how far the reader has
 * zoomed: a scale bar that says "Centuries" tells you what a tick means, and a
 * scale bar that says "Close" tells you nothing.
 */
export const ZOOM_LEVELS = ['Millennia', 'Centuries', 'Decades', 'Years'] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/**
 * Span thresholds, widest first. A span at or above the threshold reads at that
 * granularity.
 */
const LEVEL_FLOOR: readonly (readonly [ZoomLevel, number])[] = [
  ['Millennia', 3000],
  ['Centuries', 400],
  ['Decades', 60],
  ['Years', 0],
];

/**
 * Hysteresis, as a fraction of the threshold.
 *
 * Without it a span resting on a boundary flips the label on every frame of a
 * drag — the reader sees "Centuries/Decades/Centuries" strobe while they are
 * trying to read a date. A move has to cross the boundary by this much before
 * the name changes, so small movements never flip it and a deliberate one
 * always does.
 */
const HYSTERESIS = 0.12;

/** The granularity a span reads at, with no memory of where it came from. */
export function zoomLevel(span: number): ZoomLevel {
  for (const [level, floor] of LEVEL_FLOOR) {
    if (span >= floor) return level;
  }
  return 'Years';
}

/**
 * The granularity a span reads at, given the one it is already showing.
 *
 * Keeps `previous` until the span clears its boundary by the hysteresis margin,
 * in whichever direction the reader is moving.
 */
export function zoomLevelFrom(span: number, previous: ZoomLevel | null): ZoomLevel {
  const next = zoomLevel(span);
  if (previous === null || next === previous) return next;

  const prevIndex = ZOOM_LEVELS.indexOf(previous);
  const nextIndex = ZOOM_LEVELS.indexOf(next);
  /* Zooming in crosses the floor of the level being left; zooming out crosses
     the floor of the level being entered. Either way, one boundary decides. */
  const boundary =
    LEVEL_FLOOR[nextIndex > prevIndex ? prevIndex : nextIndex]?.[1] ?? 0;
  if (boundary === 0) return next;

  const margin = boundary * HYSTERESIS;
  if (nextIndex > prevIndex && span > boundary - margin) return previous;
  if (nextIndex < prevIndex && span < boundary + margin) return previous;
  return next;
}

/** Back-compatible name used by the server render and the zoom readout. */
export const zoomLabel = (span: number): string => zoomLevel(span);

/**
 * What "Centuries" means, in a sentence.
 *
 * The word alone names the granularity to someone who already knows the axis
 * has one. A first-time reader sees a noun with no verb — this gives it one,
 * on hover or focus, without putting a permanent paragraph beside a two-word
 * indicator.
 */
export function zoomExplainer(span: number): string {
  const level = zoomLevel(span).toLowerCase();
  return `The axis counts in ${level} at this zoom. Fewer, larger events show as you widen it.`;
}

/** Spec §4: no more than ~8 visible events per lane per viewport width. */
export const DENSITY_BUDGET = 8;

/** Minimum horizontal gap, in px, before two nodes are considered coincident. */
const MIN_GAP = 22;

/** Rough label width in px, used to decide whether a label fits without overlap. */
const labelWidth = (title: string): number => title.length * 5.4 + 14;

/* ── layout ─────────────────────────────────────────────────────────────── */

export interface PlacedEvent {
  readonly kind: 'event';
  readonly event: TimelineEvent;
  /** Pixel offset within the track. */
  readonly x: number;
  /** Width in px for ranged events; 0 for instants. */
  readonly span: number;
  /** 0 or 1. Only meaningful when `dodged`. */
  readonly row: number;
  /** True when this node shares its horizontal space with another and the two
      have been pushed apart vertically. A lone node always sits centred. */
  readonly dodged: boolean;
  readonly labelled: boolean;
  readonly ghost: boolean;
}

export interface PlacedCluster {
  readonly kind: 'cluster';
  readonly x: number;
  readonly count: number;
  readonly from: number;
  readonly to: number;
  readonly events: readonly TimelineEvent[];
}

export type Placed = PlacedEvent | PlacedCluster;

export interface LaneLayout {
  readonly lane: Lane;
  readonly placed: readonly Placed[];
  /** Events dropped by the density budget, for the honest "+N more" readout. */
  readonly demoted: number;
}

const yearToX = (year: number, view: Viewport): number =>
  ((year - view.from) / (view.to - view.from)) * view.width;

/**
 * Place one lane's events.
 *
 * Order of operations matters and follows the spec: gate by rank first, then
 * apply the density budget by demoting the least important ("events get
 * demoted, not crowded"), then resolve what is left so nothing overlaps.
 */
export function layoutLane(
  lane: Lane,
  events: readonly TimelineEvent[],
  ghosts: readonly TimelineEvent[],
  view: Viewport,
): LaneLayout {
  const span = view.to - view.from;
  const floor = minimumRank(span);

  const inView = (e: TimelineEvent): boolean => {
    const end = e.year_end ?? e.year_start;
    return end >= view.from && e.year_start <= view.to;
  };

  const candidates = events.filter((e) => eventInLane(e, lane) && inView(e) && e.importance >= floor);

  /* Density budget. Keep the most important; break ties by earliest, so the
     survivors are stable as the viewport pans. */
  const ranked = [...candidates].sort(
    (a, b) => b.importance - a.importance || a.year_start - b.year_start,
  );
  const kept = ranked.slice(0, DENSITY_BUDGET);
  const demoted = ranked.length - kept.length;

  const laneGhosts = ghosts.filter((e) => inView(e) && e.importance >= floor);

  interface Candidate {
    event: TimelineEvent;
    x: number;
    span: number;
    ghost: boolean;
  }

  const all: Candidate[] = [
    ...kept.map((event) => ({ event, ghost: false })),
    ...laneGhosts.map((event) => ({ event, ghost: true })),
  ]
    .map(({ event, ghost }) => {
      const x = yearToX(event.year_start, view);
      const endX = event.year_end === undefined ? x : yearToX(event.year_end, view);
      return { event, x, span: Math.max(0, endX - x), ghost };
    })
    .sort((a, b) => a.x - b.x || b.event.importance - a.event.importance);

  /* Resolve collisions. Two coincident nodes dodge to a second row, matching
     the design export's 50% / 71% pair. Three or more within one gap cluster
     into a single node rather than stacking into illegibility.

     A group chains: each candidate joins if it is within MIN_GAP of the one
     before it, not of the group's first member. Measuring from the anchor looks
     equivalent and is not — a run of events spaced just under a gap apart
     splits into groups whose facing pair is still only a few pixels apart, and
     each of them, alone in its group, is drawn undodged and overlapping.
     Christianity's Rule of Benedict and Hagia Sophia, seven years apart in the
     drilled Catholic lane, are what surfaced it. Chaining makes the invariant
     hold by construction: two nodes in different groups are at least MIN_GAP
     apart, which is wider than the largest dot. */
  const placed: Placed[] = [];
  let i = 0;
  while (i < all.length) {
    const group: Candidate[] = [all[i] as Candidate];
    let j = i + 1;
    while (j < all.length && (all[j] as Candidate).x - (all[j - 1] as Candidate).x < MIN_GAP) {
      group.push(all[j] as Candidate);
      j += 1;
    }

    if (group.length >= 3) {
      const events = group.map((g) => g.event);
      const years = events.map((e) => e.year_start);
      placed.push({
        kind: 'cluster',
        x: group.reduce((sum, g) => sum + g.x, 0) / group.length,
        count: group.length,
        from: Math.min(...years),
        to: Math.max(...years),
        events,
      });
    } else {
      const dodged = group.length > 1;
      group.forEach((g, k) => {
        placed.push({
          kind: 'event',
          event: g.event,
          x: g.x,
          span: g.span,
          row: k,
          dodged,
          labelled: false,
          ghost: g.ghost,
        });
      });
    }
    i = j;
  }

  /* Labels, assigned greedily by importance so the most significant events keep
     theirs. A label is shown only if it clears every label already placed —
     "rank-aware labels" in practice means labels never collide. */
  const labelSlots: { start: number; end: number }[] = [];
  const eventsByImportance = placed
    .map((p, index) => ({ p, index }))
    .filter((x): x is { p: PlacedEvent; index: number } => x.p.kind === 'event')
    .sort((a, b) => b.p.event.importance - a.p.event.importance);

  const withLabels: Placed[] = [...placed];
  for (const { p, index } of eventsByImportance) {
    const w = labelWidth(p.event.title);
    const start = p.x - w / 2;
    const end = p.x + w / 2;
    if (start < -8 || end > view.width + 8) continue;
    if (labelSlots.some((slot) => start < slot.end && end > slot.start)) continue;
    labelSlots.push({ start, end });
    withLabels[index] = { ...p, labelled: true };
  }

  return { lane, placed: withLabels, demoted };
}

export function layoutTimeline(
  lanes: readonly Lane[],
  events: readonly TimelineEvent[],
  ghosts: readonly TimelineEvent[],
  view: Viewport,
): LaneLayout[] {
  /* Ghosts belong to a branch that is not on screen, so they belong to no lane
     in particular. They are drawn once, on the first lane — as the reference
     build does with the Council of Trent — rather than repeated down the canvas,
     which would misread as the same event happening in every branch. */
  return lanes.map((lane, i) => layoutLane(lane, events, i === 0 ? ghosts : [], view));
}

/* ── ruler ──────────────────────────────────────────────────────────────── */

const NICE_STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];

/** Tick years for the ruler, at a round step giving roughly `target` ticks. */
export function rulerTicks(view: Viewport, target = 7): number[] {
  const span = view.to - view.from;
  const raw = span / target;
  const step = NICE_STEPS.find((s) => s >= raw) ?? NICE_STEPS[NICE_STEPS.length - 1] ?? 1000;

  const first = Math.ceil(view.from / step) * step;
  const ticks: number[] = [];
  for (let y = first; y <= view.to; y += step) ticks.push(y);
  return ticks;
}

/**
 * Tick labels.
 *
 * Every BCE year says BCE — a bare "1500" on an axis that runs from the
 * fifteenth century BCE to the twenty-first CE is a coin toss, and it was one:
 * only the edges used to carry an era, so a reader looking at the middle of the
 * ruler had nothing to tell them which side of the turn they were on.
 *
 * CE is stated at the edges, at the turn, and at the first CE tick after any
 * BCE tick, which is where the axis actually changes era. Between those it is
 * dropped, because seven ticks all reading "CE" is noise and the era is not in
 * question once it has been established to the left.
 */
export function formatTick(year: number, isEdge: boolean, previous?: number): string {
  if (year === 0 || year === 1) return '1 CE';
  const abs = Math.abs(year);
  if (year < 0) return `${abs} BCE`;
  const crossesEra = previous !== undefined && previous < 0;
  return isEdge || crossesEra ? `${abs} CE` : String(abs);
}

/* ── the travel bar ─────────────────────────────────────────────────────── */

/** A stretch of years. The travel bar has no pixels of its own. */
export type Span = Pick<Viewport, 'from' | 'to'>;

export interface TravelBar {
  /** Where the visible window starts, as a fraction of the full span. */
  readonly left: number;
  /** How much of the full span is visible, as a fraction. */
  readonly width: number;
}

/**
 * The visible window as a fraction of everything there is.
 *
 * Pure, so the bar the reader drags and the canvas it drags cannot disagree
 * about where they are. Clamped rather than trusted: a view can sit slightly
 * outside bounds mid-gesture, and a thumb that renders at a negative offset
 * escapes its rail.
 */
export function travelBar(view: Span, bounds: Span): TravelBar {
  const full = bounds.to - bounds.from;
  if (full <= 0) return { left: 0, width: 1 };
  const width = Math.min(1, Math.max((view.to - view.from) / full, MIN_THUMB));
  const left = Math.min(1 - width, Math.max(0, (view.from - bounds.from) / full));
  return { left, width };
}

/**
 * The thumb never shrinks below this share of the rail.
 *
 * At the deepest zoom the window is twelve years of five and a half thousand,
 * which is two parts in a thousand — a thumb nobody can grab and nobody can
 * see. It stops being to scale before it stops being usable.
 */
const MIN_THUMB = 0.04;

/** Where a click at fraction `f` of the rail puts the window's start. */
export function travelTo(f: number, span: number, bounds: Span): Span {
  const full = bounds.to - bounds.from;
  /* The click names the centre, not the edge: a reader aiming at a year wants
     that year in front of them, not at the left margin. */
  let from = bounds.from + f * full - span / 2;
  if (from < bounds.from) from = bounds.from;
  if (from + span > bounds.to) from = bounds.to - span;
  return { from, to: from + span };
}
