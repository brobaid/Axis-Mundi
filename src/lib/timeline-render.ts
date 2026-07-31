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

export interface CanvasOptions {
  readonly title: string;
  readonly subtitle: string;
  /** Meridian year. Omitted hides it. */
  readonly meridianYear?: number | undefined;
  readonly meridianLabel?: string | undefined;
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
    `<div class="tl-lanes" role="grid" aria-label="Timeline lanes">${lanesHtml}</div>` +
    meridian +
    `</div>`
  );
}
