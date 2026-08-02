/**
 * Axis Mundi — canvas layout invariants.
 *
 * The canvas has a handful of rules that are easy to break silently and hard to
 * spot by eye. They are asserted here against the real seeded content, with no
 * browser and no test framework, so they run in CI alongside the other checks.
 *
 * The invariants come straight from the governing docs:
 *   spec §4        importance rubric, ~8 events per lane per viewport
 *   kickoff M1     near-coincident events dodge or cluster, never overlap
 *   design lang §3.2  branch lanes are stepped tints of the parent, never new hues
 *
 * The family tree is here too, and for the same reason. Its era labels overlap
 * by construction if nothing stops them — the detents are not evenly spaced in
 * time and the axis is linear, so the last five fall inside the last eighth of
 * it — and that is exactly a thing you cannot see in a diff.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DENSITY_BUDGET,
  buildLanes,
  ghostEvents,
  layoutTimeline,
  minimumRank,
  rulerTicks,
  type TaxonomyNode,
  type TimelineEvent,
  type Viewport,
} from '../src/lib/timeline-model.js';
import { displayDate } from '../src/lib/display-date.js';
import {
  AXIS_NODES,
  HERO_MIN_BOX,
  ORBIT_INNER,
  ORBIT_OUTER,
  TAP_MIN,
  nodeSeparations,
} from '../src/lib/hero-axis.js';
import {
  CONTESTED_AT,
  CONTESTED_R,
  LABEL_AT,
  LABEL_AT_CONTESTED,
  TICK_ADVANCE,
  TICK_FONT_SIZE,
  TICK_ROW_HEIGHT,
  layoutTicks,
  tickWidth,
} from '../src/lib/tree-model.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readAll(dir: string): any[] {
  const base = resolve(ROOT, 'src/content', dir);
  const out: any[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.json')) out.push(JSON.parse(readFileSync(full, 'utf8')));
    }
  };
  walk(base);
  return out;
}

const events: TimelineEvent[] = readAll('events').map((e) => ({
  ...e,
  display_date: displayDate(e),
}));
const taxonomy: TaxonomyNode[] = readAll('taxonomy');

const failures: string[] = [];
const fail = (msg: string): void => {
  failures.push(msg);
};
let checks = 0;
const ok = (): void => {
  checks += 1;
};

/** Dot diameter by rank, mirroring timeline-render.ts. */
const dot = (importance: number): number => (importance >= 5 ? 13 : importance === 4 ? 9 : 6);

/* The viewports a reader actually lands on, plus a couple of extremes. */
const SCENARIOS: { name: string; drill: string; view: Viewport }[] = [
  { name: 'World 0–1200 desktop', drill: '', view: { from: 0, to: 1200, width: 748 } },
  { name: 'World 0–1200 mobile', drill: '', view: { from: 0, to: 1200, width: 260 } },
  { name: 'World -500–2020 wide', drill: '', view: { from: -500, to: 2020, width: 1000 } },
  { name: 'Christianity 0–1200', drill: 'christianity', view: { from: 0, to: 1200, width: 748 } },
  {
    name: 'Protestant 1500–1650',
    drill: 'christianity/protestant',
    view: { from: 1500, to: 1650, width: 748 },
  },
  { name: 'Close zoom 1510–1550', drill: '', view: { from: 1510, to: 1550, width: 748 } },
];

for (const { name, drill, view } of SCENARIOS) {
  const lanes = buildLanes(taxonomy, drill);

  if (lanes.length === 0) fail(`${name}: no lanes built`);
  else ok();

  /* Branch lanes are tints of the parent, never new hues: every lane in a drill
     must belong to the tradition being drilled into. */
  if (drill !== '') {
    const root = drill.split('/')[0];
    for (const lane of lanes) {
      if (lane.tradition !== root) {
        fail(`${name}: lane "${lane.id}" has tradition ${lane.tradition}, expected ${root}`);
      }
    }
    ok();

    /* Tints must be monotonically decreasing and stay legible. */
    const tints = lanes.map((l) => l.tintPercent);
    for (let i = 1; i < tints.length; i += 1) {
      if ((tints[i] as number) >= (tints[i - 1] as number)) {
        fail(`${name}: tint did not step down at lane ${i} (${tints.join(', ')})`);
        break;
      }
    }
    if (tints.some((t) => t < 44 || t > 100)) {
      fail(`${name}: tint out of the 44–100% range (${tints.join(', ')})`);
    }
    ok();
  }

  const ghosts = drill === '' ? [] : ghostEvents(events, lanes, drill);
  const layouts = layoutTimeline(lanes, events, ghosts, view);

  for (const layout of layouts) {
    const label = `${name} / ${layout.lane.id}`;

    /* Density budget: never more than ~8 real events in a lane per viewport. */
    const realEvents = layout.placed.filter((p) => p.kind === 'event' && !p.ghost);
    const clustered = layout.placed
      .filter((p): p is Extract<typeof p, { kind: 'cluster' }> => p.kind === 'cluster')
      .reduce((sum, c) => sum + c.count, 0);
    if (realEvents.length + clustered > DENSITY_BUDGET + ghosts.length) {
      fail(`${label}: ${realEvents.length + clustered} placed, budget is ${DENSITY_BUDGET}`);
    }

    /* Rank gating: nothing below the floor for this span may be visible. */
    const floor = minimumRank(view.to - view.from);
    for (const p of layout.placed) {
      if (p.kind === 'event' && p.event.importance < floor) {
        fail(`${label}: ${p.event.id} is rank ${p.event.importance}, below floor ${floor}`);
      }
    }

    /* Nothing overlaps. Two nodes may share horizontal space only if they were
       dodged onto different rows; three or more must have become a cluster. */
    const nodes = layout.placed.filter(
      (p): p is Extract<typeof p, { kind: 'event' }> => p.kind === 'event',
    );
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i] as (typeof nodes)[number];
        const b = nodes[j] as (typeof nodes)[number];
        const halfWidths = (dot(a.event.importance) + dot(b.event.importance)) / 2;
        const dx = Math.abs(a.x - b.x);
        if (dx >= halfWidths) continue; // clear horizontally

        if (!a.dodged || !b.dodged) {
          fail(`${label}: ${a.event.id} and ${b.event.id} are ${dx.toFixed(1)}px apart, not dodged`);
          continue;
        }
        if (a.row === b.row) {
          fail(`${label}: ${a.event.id} and ${b.event.id} dodged onto the same row`);
          continue;
        }
        /* Dodged rows sit at 30% and 70% of a 46px lane = 18.4px apart. */
        const rowGap = 0.4 * 46;
        if (rowGap < halfWidths) {
          fail(`${label}: dodge gap ${rowGap}px cannot clear ${halfWidths}px of dot`);
        }
      }
    }

    /* Labels never collide within a lane. */
    const labelled = nodes.filter((p) => p.labelled);
    const width = (t: string): number => t.length * 5.4 + 14;
    for (let i = 0; i < labelled.length; i += 1) {
      for (let j = i + 1; j < labelled.length; j += 1) {
        const a = labelled[i] as (typeof labelled)[number];
        const b = labelled[j] as (typeof labelled)[number];
        const aStart = a.x - width(a.event.title) / 2;
        const aEnd = a.x + width(a.event.title) / 2;
        const bStart = b.x - width(b.event.title) / 2;
        const bEnd = b.x + width(b.event.title) / 2;
        if (aStart < bEnd && bStart < aEnd) {
          fail(`${label}: labels "${a.event.title}" and "${b.event.title}" overlap`);
        }
      }
    }

    /* Every placed event genuinely belongs to its lane. */
    for (const p of nodes) {
      if (p.ghost) continue;
      const belongs = p.event.branch_path.some(
        (bp) => bp === layout.lane.path || bp.startsWith(`${layout.lane.path}/`),
      );
      if (!belongs) fail(`${label}: ${p.event.id} does not belong to this lane`);
    }
  }
  ok();

  /* Ruler ticks stay inside the viewport and stay ordered. */
  const ticks = rulerTicks(view);
  if (ticks.length < 2) fail(`${name}: ruler produced ${ticks.length} ticks`);
  for (let i = 1; i < ticks.length; i += 1) {
    if ((ticks[i] as number) <= (ticks[i - 1] as number)) fail(`${name}: ruler ticks out of order`);
  }
  if (ticks.some((t) => t < view.from - 1 || t > view.to + 1)) {
    fail(`${name}: ruler tick outside the viewport`);
  }
  ok();
}

/* Ghosts belong to the drilled tradition but never to a visible lane. */
{
  const drill = 'christianity/protestant';
  const lanes = buildLanes(taxonomy, drill);
  const ghosts = ghostEvents(events, lanes, drill);
  if (ghosts.length === 0) fail('Protestant drill produced no ghost events');
  for (const g of ghosts) {
    if (!g.branch_path.some((p) => p === 'christianity' || p.startsWith('christianity/'))) {
      fail(`ghost ${g.id} is not a Christianity event`);
    }
    const inLane = lanes.some((l) =>
      g.branch_path.some((p) => p === l.path || p.startsWith(`${l.path}/`)),
    );
    if (inLane) fail(`ghost ${g.id} is actually inside a visible lane`);
  }
  ok();
}

/* The rank floor must be monotone: zooming in never hides what was visible. */
{
  let previous = minimumRank(10_000);
  for (const span of [5000, 3000, 1500, 800, 400, 200, 100, 50, 20]) {
    const floor = minimumRank(span);
    if (floor > previous) fail(`rank floor rose from ${previous} to ${floor} at span ${span}`);
    previous = floor;
  }
  ok();
}

/* ── the family tree's axis ─────────────────────────────────────────────── */

/*
  No two era labels may overlap, at any axis width.

  Asserted across a range of widths rather than the one the page ships, so the
  invariant belongs to the layout rather than to a lucky number: the labels are
  centred on their ticks and the ticks crowd as the axis narrows, which is when
  stacking has to do the most work.
*/
{
  /*
    First, the assumption the rest of this rests on.

    Everything below computes a label's width from its character count, which
    is only sound if the reserved advance is at least the face's real one.
    IBM Plex Mono advances at 0.6em and the fallbacks are all monospaced; the
    layout reserves 0.62em for slack. Asserting the floor here matters because
    the overlap checks that follow use tickWidth() on both sides and would stay
    happily self-consistent while every label on the page overlapped — measured
    in Chromium, the reserved width is at or above the real ink for all twelve.
  */
  if (TICK_ADVANCE < TICK_FONT_SIZE * 0.6) {
    fail(
      `tree axis reserves ${(TICK_ADVANCE / TICK_FONT_SIZE).toFixed(3)}em per character, ` +
        'below the 0.6em the mono face actually advances',
    );
  }
  ok();

  const ERAS = [-500, 1, 300, 600, 750, 1000, 1200, 1500, 1700, 1850, 1950, 2020];
  const label = (y: number): string => (y < 0 ? `${Math.abs(y)} BCE` : y === 0 ? '1 BCE' : `${y} CE`);
  for (const datedWidth of [200, 300, 451, 600, 900]) {
    const ticks = layoutTicks(
      ERAS.map((era) => ({
        year: era,
        x: ((era + 2000) / 4020) * datedWidth,
        label: label(era),
      })),
    );
    if (ticks.length !== ERAS.length) fail(`tree axis at ${datedWidth}px dropped a label`);

    const byRow = new Map<number, { x: number; label: string }[]>();
    for (const t of ticks) {
      const row = byRow.get(t.row) ?? [];
      row.push(t);
      byRow.set(t.row, row);
    }
    for (const [row, list] of byRow) {
      list.sort((a, b) => a.x - b.x);
      for (let i = 1; i < list.length; i++) {
        const before = list[i - 1] as { x: number; label: string };
        const here = list[i] as { x: number; label: string };
        const gap = here.x - tickWidth(here.label) / 2 - (before.x + tickWidth(before.label) / 2);
        if (gap < 0) {
          fail(
            `tree axis at ${datedWidth}px: "${before.label}" and "${here.label}" overlap by ` +
              `${(-gap).toFixed(1)}px in row ${row}`,
          );
        }
      }
    }
    /* A block that needs more rows than the canvas reserves would clip. */
    const rows = ticks.reduce((max, t) => Math.max(max, t.row + 1), 1);
    if (rows * TICK_ROW_HEIGHT > 80) {
      fail(`tree axis at ${datedWidth}px needs ${rows} label rows, which will not fit`);
    }
    ok();
  }
}

/*
  The contested mark must clear the label it stands beside.

  Its position used to be guessed from a character count — a proportional face
  has no such thing — and four of the five marks landed wrong, two of them
  inside their own label. It is a fixed offset from the node dot now, and the
  arithmetic that keeps it clear of the text is asserted rather than assumed.
*/
{
  const markEnds = CONTESTED_AT + CONTESTED_R;
  if (markEnds >= LABEL_AT_CONTESTED) {
    fail(
      `tree: the contested mark ends at ${markEnds} and a contested node's label ` +
        `starts at ${LABEL_AT_CONTESTED} — the mark would sit inside the text`,
    );
  }
  /* And a node without one must not leave a gap where a mark would have been. */
  if (LABEL_AT >= LABEL_AT_CONTESTED) {
    fail(`tree: an unmarked label starts at ${LABEL_AT}, no closer than a marked one`);
  }
  ok();
}

/* ── the entrance hall's axis ───────────────────────────────────────────── */

/*
  Ten doors on ten orbits, none of them within a thumb of another.

  The hero's nodes are links to the dives, so each carries a 44px target, and
  ten of those inside a 358px square only works because the wheel turns rigidly
  — the angle between any two nodes is fixed at authoring time. Break that (give
  the orbits their own speeds, or nudge the angular step to something rounder)
  and pairs of nodes drift into each other until a reader aiming at Buddhism
  lands on Sikhism. That failure appears minutes after load, on a phone, and
  never in a diff. So the arithmetic is asserted here instead.
*/
{
  if (AXIS_NODES.length !== 10) {
    fail(`hero axis carries ${AXIS_NODES.length} nodes, not the launch ten`);
  }
  ok();

  /* Every node on its own ray and its own orbit: two on one ray would sit on
     the same line through the centre and read as one tradition eclipsing
     another. */
  const rays = new Set(AXIS_NODES.map((n) => n.angle));
  if (rays.size !== AXIS_NODES.length) fail('hero axis puts two traditions on one ray');
  const orbits = new Set(AXIS_NODES.map((n) => n.orbit.toFixed(6)));
  if (orbits.size !== AXIS_NODES.length) fail('hero axis puts two traditions on one orbit');
  ok();

  /* The binding case is the narrowest box, because the targets are a fixed
     44px at every width while the geometry scales with it. */
  const separations = nodeSeparations(HERO_MIN_BOX);
  const tightest = separations.reduce((a, b) => (b.distance < a.distance ? b : a));
  if (tightest.distance < TAP_MIN) {
    fail(
      `hero axis at ${HERO_MIN_BOX}px: ${tightest.a} and ${tightest.b} sit ` +
        `${tightest.distance.toFixed(1)}px apart, inside the ${TAP_MIN}px touch minimum`,
    );
  }
  ok();

  /* And the whole target has to be inside the box, not just its centre. */
  const reach = ORBIT_OUTER * (HERO_MIN_BOX / 2) + TAP_MIN / 2;
  if (reach > HERO_MIN_BOX / 2) {
    fail(
      `hero axis: the outermost node's target reaches ${reach.toFixed(1)}px from centre, ` +
        `past the ${(HERO_MIN_BOX / 2).toFixed(1)}px edge of the box`,
    );
  }
  if (ORBIT_INNER >= ORBIT_OUTER) fail('hero axis: the innermost orbit is not inside the outermost');
  ok();
}

if (failures.length > 0) {
  console.error('\n  Canvas layout invariants FAILED\n');
  for (const f of failures) console.error(`      ${f}`);
  console.error(`\n  ${failures.length} failing.\n`);
  process.exit(1);
}

const tightestNode = nodeSeparations(HERO_MIN_BOX).reduce((a, b) =>
  b.distance < a.distance ? b : a,
);

console.log(
  `  Canvas layout invariants passed — ${checks} groups across ${SCENARIOS.length} viewports, ` +
    'tree axis labels clear at five widths, ' +
    `hero nodes ${tightestNode.distance.toFixed(1)}px apart at ${HERO_MIN_BOX}px ` +
    `against a ${TAP_MIN}px floor.`,
);
