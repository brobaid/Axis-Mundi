import {
  formatTick,
  rulerTicks,
  type LaneLayout,
  type PlacedCluster,
  type PlacedEvent,
  type Viewport,
} from './timeline-model';

/**
 * Canvas markup, as HTML strings.
 *
 * Written once and used twice: Astro calls it for the server-rendered first
 * paint, and the island calls it on every zoom, pan, drill and filter. One
 * renderer means the two can never drift apart.
 *
 * Geometry is taken from docs/design/living-museum-timeline.dc.html:
 * 132px lane gutter, 46px lane height, 34px ruler, 13/9/6px rank dots with a
 * 3px halo on rank 5, and the 50% / 71% dodge pair.
 */

export const LANE_GUTTER = 132;
export const LANE_HEIGHT = 46;
export const CANVAS_MIN_WIDTH = 880;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rank → dot diameter, from the design export. */
const dotSize = (importance: number): number => {
  if (importance >= 5) return 13;
  if (importance === 4) return 9;
  return 6;
};

const pct = (x: number, width: number): string => `${((x / width) * 100).toFixed(3)}%`;

function renderEventNode(p: PlacedEvent, view: Viewport): string {
  const size = dotSize(p.event.importance);
  /* A lone node sits on the centre line. A dodged pair splits either side of it,
     far enough apart that the largest two dots cannot touch — the design export
     pairs 50%/71%, which at a 46px lane leaves 13px dots overlapping by 3px, and
     "never overlap" is the binding requirement. */
  const top = !p.dodged ? '50%' : p.row === 0 ? '30%' : '70%';
  const label = `${p.event.title}, ${p.event.display_date}`;
  const aria = p.ghost
    ? `${label}. Ghost event from another branch.`
    : `${label}. Open event.`;

  const classes = [
    'tl-node',
    `tl-node--r${p.event.importance}`,
    p.ghost ? 'tl-node--ghost' : '',
    p.event.contested ? 'tl-node--contested' : '',
    p.span > 0 ? 'tl-node--span' : '',
  ]
    .filter(Boolean)
    .join(' ');

  /* Ranged events (reigns, compilations, councils) render as a bar, per the
     design language's "spans as bars". The bar sits behind the dot. */
  const bar =
    p.span > 1
      ? `<span class="tl-span" style="width:${pct(p.span, view.width)}" aria-hidden="true"></span>`
      : '';

  const text = p.labelled
    ? `<span class="tl-node__label">${esc(p.event.title)}</span>`
    : '';

  return (
    `<button type="button" class="${classes}" data-event-id="${esc(p.event.id)}"` +
    ` style="left:${pct(p.x, view.width)};top:${top};--dot:${size}px"` +
    ` aria-label="${esc(aria)}"${p.ghost ? ' data-ghost="1"' : ''}>` +
    bar +
    `<span class="tl-dot" aria-hidden="true"></span>` +
    text +
    `</button>`
  );
}

function renderCluster(c: PlacedCluster, view: Viewport): string {
  const range = c.from === c.to ? String(c.from) : `${c.from} to ${c.to}`;
  return (
    `<button type="button" class="tl-node tl-node--cluster" data-cluster-from="${c.from}"` +
    ` data-cluster-to="${c.to}" style="left:${pct(c.x, view.width)};top:50%"` +
    ` aria-label="${c.count} events between ${range}. Zoom in to separate them.">` +
    `<span class="tl-cluster" aria-hidden="true">${c.count}</span>` +
    `</button>`
  );
}

function renderLane(layout: LaneLayout, view: Viewport, symbolFor: (id: string) => string): string {
  const { lane } = layout;
  const nodes = layout.placed
    .map((p) => (p.kind === 'cluster' ? renderCluster(p, view) : renderEventNode(p, view)))
    .join('');

  const more =
    layout.demoted > 0
      ? `<span class="tl-more" aria-label="${layout.demoted} further events hidden at this zoom">+${layout.demoted}</span>`
      : '';

  const empty =
    layout.placed.length === 0 && layout.demoted === 0
      ? `<span class="tl-empty">no events in view</span>`
      : '';

  /* No inline colour here: the swatch inherits --tradition-hue from the lane's
     tint-N class, which is what makes branch lanes stepped tints of the parent
     hue rather than all rendering the parent's. */
  const mark =
    lane.symbol === null
      ? `<span class="swatch" aria-hidden="true"></span>`
      : symbolFor(lane.symbol);

  const title = lane.drillable ? `Drill into ${lane.name}` : lane.name;
  const drill = lane.drillable ? ` data-drill="${esc(lane.path)}"` : '';

  /* Contested classification renders as the same hatched mark used everywhere
     else (spec §10). A lane header has no room for the full badge, so it wears
     the hatch swatch and names itself to assistive tech. */
  const contested = lane.contested
    ? `<span class="tl-lane__contested" role="img" aria-label="Contested classification"` +
      ` title="Contested classification"></span>`
    : '';

  return (
    `<div class="tl-lane" role="row" style="--tradition-base: var(--t-${lane.tradition});` +
    `--tradition-hue: color-mix(in srgb, var(--t-${lane.tradition}) ${lane.tintPercent.toFixed(1)}%, var(--surface))">` +
    `<${lane.drillable ? 'button type="button"' : 'div'} class="tl-lane__head"${drill}` +
    ` title="${esc(title)}" role="rowheader">` +
    mark +
    `<span class="tl-lane__name">${esc(lane.name)}</span>` +
    contested +
    `</${lane.drillable ? 'button' : 'div'}>` +
    `<div class="tl-track" role="gridcell">${nodes}${more}${empty}</div>` +
    `</div>`
  );
}

/* ── influence threads ──────────────────────────────────────────────────── */

export interface Thread {
  readonly id: string;
  readonly title: string;
  readonly traditions: readonly string[];
  readonly d: string;
  /** True when either end attaches to a cluster rather than a single node. */
  readonly clustered: boolean;
}

/**
 * Arcs joining the lanes a multi-tradition record belongs to.
 *
 * The threads feature's first pass, and it invents nothing: a thread exists
 * exactly where one record already names more than one tradition. It is drawn
 * between the positions the layout already chose, dodge rows included, so a
 * thread lands on the dot it belongs to rather than near it. Where a record's
 * lane has collapsed it into a cluster, the thread attaches to the cluster —
 * the honest anchor, since the individual dot is not on screen.
 */
export function threads(layouts: readonly LaneLayout[]): Thread[] {
  interface Anchor { x: number; y: number; lane: number; clustered: boolean }
  const byEvent = new Map<string, { title: string; traditions: string[]; anchors: Anchor[] }>();

  layouts.forEach((layout, laneIndex) => {
    const laneTop = laneIndex * LANE_HEIGHT;
    for (const p of layout.placed) {
      if ('events' in p) {
        /* A cluster stands in for each event inside it. */
        for (const e of p.events) {
          const entry = byEvent.get(e.id) ?? { title: e.title, traditions: [...e.traditions], anchors: [] };
          entry.anchors.push({ x: p.x, y: laneTop + LANE_HEIGHT / 2, lane: laneIndex, clustered: true });
          byEvent.set(e.id, entry);
        }
        continue;
      }
      if (p.ghost) continue;
      const frac = !p.dodged ? 0.5 : p.row === 0 ? 0.3 : 0.7;
      const entry = byEvent.get(p.event.id) ?? {
        title: p.event.title,
        traditions: [...p.event.traditions],
        anchors: [],
      };
      entry.anchors.push({ x: p.x, y: laneTop + LANE_HEIGHT * frac, lane: laneIndex, clustered: false });
      byEvent.set(p.event.id, entry);
    }
  });

  const out: Thread[] = [];
  for (const [id, entry] of byEvent) {
    if (entry.anchors.length < 2) continue;
    const anchors = [...entry.anchors].sort((a, b) => a.lane - b.lane);
    /* One arc per adjacent pair, so a five-tradition record threads through
       every lane it touches rather than drawing a star from the first. */
    const segments: string[] = [];
    for (let i = 0; i < anchors.length - 1; i += 1) {
      const a = anchors[i] as Anchor;
      const b = anchors[i + 1] as Anchor;
      /* Bowed toward the reader's left so a thread never hides under a lane
         rule, with the bow scaled to the vertical distance it spans. */
      const bow = Math.min(60, Math.abs(b.y - a.y) * 0.55) + 8;
      const mx = (a.x + b.x) / 2 - bow;
      const my = (a.y + b.y) / 2;
      segments.push(
        `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
      );
    }
    out.push({
      id,
      title: entry.title,
      traditions: entry.traditions,
      d: segments.join(' '),
      clustered: anchors.some((a) => a.clustered),
    });
  }
  return out;
}

export interface CanvasOptions {
  readonly title: string;
  readonly subtitle: string;
  /** Meridian year. Omitted hides it. */
  readonly meridianYear?: number | undefined;
  readonly meridianLabel?: string | undefined;
  /** Draw the influence threads over the lanes. */
  readonly threads?: boolean | undefined;
}

/** Inline `<use>` of a sprite symbol, hued by the tradition token. */
const symbolMarkup = (tradition: string): string =>
  `<svg class="tl-lane__symbol" width="15" height="15" viewBox="0 0 24 24"` +
  ` style="color: var(--t-${tradition})" aria-hidden="true"><use href="#symbol-${tradition}"></use></svg>`;

export function renderCanvas(
  layouts: readonly LaneLayout[],
  view: Viewport,
  options: CanvasOptions,
): string {
  const ticks = rulerTicks(view);
  const rulerHtml = ticks
    .map((year, i) => {
      const isEdge = i === 0 || i === ticks.length - 1;
      const left = ((year - view.from) / (view.to - view.from)) * 100;
      const align =
        left <= 0.5 ? 'translateX(0)' : left >= 99.5 ? 'translateX(-100%)' : 'translateX(-50%)';
      return (
        `<span class="tl-tick" style="left:${left.toFixed(3)}%;transform:${align}">` +
        `${esc(formatTick(year, isEdge))}</span>`
      );
    })
    .join('');

  const lanesHtml = layouts.map((l) => renderLane(l, view, symbolMarkup)).join('');

  let threadsHtml = '';
  if (options.threads === true) {
    const drawn = threads(layouts);
    const height = layouts.length * LANE_HEIGHT;
    threadsHtml =
      `<svg class="tl-threads" viewBox="0 0 ${view.width} ${height}" preserveAspectRatio="none"` +
      ` aria-hidden="true" style="left:${LANE_GUTTER}px">` +
      drawn
        .map(
          (t) =>
            /* Two paths per thread: a transparent one carrying the hit area, and
               the hairline the eye sees. A 1.25px stroke is untappable on a
               phone, and under the overlay's non-uniform scale its hit region
               collapses further — so the target is a fixed screen-width band. */
            `<path class="tl-thread__hit" d="${t.d}" data-thread="${esc(t.id)}">` +
            `<title>${esc(t.title)} — ${esc(t.traditions.join(', '))}</title></path>` +
            `<path class="tl-thread${t.clustered ? ' tl-thread--clustered' : ''}" d="${t.d}"` +
            ` aria-hidden="true"/>`,
        )
        .join('') +
      `</svg>`;
  }

  let meridian = '';
  if (options.meridianYear !== undefined) {
    const f = (options.meridianYear - view.from) / (view.to - view.from);
    if (f >= 0 && f <= 1) {
      const label =
        options.meridianLabel === undefined
          ? ''
          : `<b class="tl-meridian__label">${esc(options.meridianLabel)}</b>`;
      meridian =
        `<div class="tl-meridian" style="left:calc(${LANE_GUTTER}px + (100% - ${LANE_GUTTER}px) * ${f.toFixed(4)})"` +
        ` role="img" aria-label="Time cursor at ${esc(options.meridianLabel ?? String(options.meridianYear))}">` +
        `${label}</div>`;
    }
  }

  return (
    `<div class="tl-inner">` +
    `<div class="tl-plate-row">` +
    `<div class="tl-plate">` +
    `<div class="tl-plate__title">${esc(options.title)}</div>` +
    `<div class="tl-plate__sub">${esc(options.subtitle)}</div>` +
    `</div></div>` +
    `<div class="tl-ruler">${rulerHtml}</div>` +
    `<div class="tl-lanes" role="grid" aria-label="Timeline lanes">${lanesHtml}${threadsHtml}</div>` +
    meridian +
    `</div>`
  );
}
