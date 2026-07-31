import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';

import {
  buildLanes,
  drillParent,
  drillSegments,
  ghostEvents,
  layoutTimeline,
  zoomLabel,
  type DrillPath,
  type Lane,
  type TaxonomyNode,
  type TimelineEvent,
  type Viewport,
} from '../lib/timeline-model';
import { LANE_GUTTER, renderCanvas } from '../lib/timeline-render';

/**
 * The timeline island.
 *
 * Owns interaction only: the layout maths lives in timeline-model.ts and the
 * markup in timeline-render.ts, both of which also run at build time. This file
 * is what turns a static canvas into a navigable one.
 *
 * Kickoff M1 contract, in order:
 *   - lanes from the taxonomy, recursive drill with breadcrumb
 *   - semantic zoom via scroll and pinch, rank gating, density budget
 *   - event panel that preserves canvas position, Esc and tap-out close
 *   - full state in the URL; the back button works
 *   - ghost mode in drilled views
 *   - arrows walk events chronologically, Enter opens, Esc closes
 *   - the Brass Meridian as the shared time cursor
 */

interface Bootstrap {
  readonly events: TimelineEvent[];
  readonly taxonomy: TaxonomyNode[];
  readonly bounds: { from: number; to: number };
  readonly defaultView: { from: number; to: number };
  readonly types: string[];
}

interface State {
  drill: DrillPath;
  from: number;
  to: number;
  types: Set<string>;
  ghosts: boolean;
  selected: string | null;
}

const MIN_SPAN = 12; // years; the deepest useful zoom
const root = document.querySelector<HTMLElement>('[data-timeline]');

if (root !== null) {
  const dataEl = document.getElementById('timeline-data');
  const data = JSON.parse(dataEl?.textContent ?? '{}') as Bootstrap;

  const canvasEl = root.querySelector<HTMLElement>('[data-canvas]');
  const scrollEl = root.querySelector<HTMLElement>('[data-scroll]');
  const crumbEl = root.querySelector<HTMLElement>('[data-crumb]');
  const zoomEl = root.querySelector<HTMLElement>('[data-zoom-label]');
  const upBtn = root.querySelector<HTMLButtonElement>('[data-up]');
  const ghostBtn = root.querySelector<HTMLButtonElement>('[data-ghost-toggle]');
  const panelEl = root.querySelector<HTMLElement>('[data-panel]');
  const scrimEl = root.querySelector<HTMLElement>('[data-scrim]');
  const filterEls = [...root.querySelectorAll<HTMLButtonElement>('[data-type]')];

  if (canvasEl && scrollEl) {
    /* Fresh non-null bindings: the narrowing above is not carried into the
       closures below, and asserting in each one would be noise. */
    const canvas: HTMLElement = canvasEl;
    const scroller: HTMLElement = scrollEl;

    /* ── state ────────────────────────────────────────────────────────── */

    const state: State = {
      drill: '',
      from: data.defaultView.from,
      to: data.defaultView.to,
      types: new Set(),
      ghosts: false,
      selected: null,
    };

    const byId = new Map(data.events.map((e) => [e.id, e]));
    let lanes: Lane[] = [];
    let ordered: TimelineEvent[] = []; // chronological, for keyboard walking
    let lastFocusedId: string | null = null;

    /* ── URL ──────────────────────────────────────────────────────────── */

    function readUrl(): void {
      const q = new URLSearchParams(location.search);
      state.drill = q.get('drill') ?? '';
      const from = Number(q.get('from'));
      const to = Number(q.get('to'));
      if (Number.isFinite(from) && Number.isFinite(to) && to - from >= MIN_SPAN) {
        state.from = from;
        state.to = to;
      }
      const types = q.get('types');
      state.types = new Set(types === null || types === '' ? [] : types.split(','));
      state.ghosts = q.get('ghosts') === '1';
      state.selected = q.get('event');
    }

    function writeUrl(replace = false): void {
      const q = new URLSearchParams();
      if (state.drill !== '') q.set('drill', state.drill);
      q.set('from', String(Math.round(state.from)));
      q.set('to', String(Math.round(state.to)));
      if (state.types.size > 0) q.set('types', [...state.types].join(','));
      if (state.ghosts) q.set('ghosts', '1');
      if (state.selected !== null) q.set('event', state.selected);
      const url = `${location.pathname}?${q.toString()}`;
      if (replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    }

    /* ── zoom ─────────────────────────────────────────────────────────── */

    const baseScale = scaleLinear().domain([data.bounds.from, data.bounds.to]);
    let zoomBehaviour: ZoomBehavior<HTMLElement, unknown>;
    let applyingProgrammatically = false;

    const trackWidth = (): number =>
      Math.max(120, (canvas.querySelector<HTMLElement>('.tl-track')?.clientWidth ?? 0) ||
        canvas.clientWidth - LANE_GUTTER);

    function transformForState(width: number): ZoomTransform {
      const full = data.bounds.to - data.bounds.from;
      const span = state.to - state.from;
      const k = full / span;
      const x = -((state.from - data.bounds.from) / full) * width * k;
      return zoomIdentity.translate(x, 0).scale(k);
    }

    function syncZoomTransform(): void {
      const width = trackWidth();
      baseScale.range([0, width]);
      applyingProgrammatically = true;
      select(scroller as HTMLElement).call(zoomBehaviour.transform, transformForState(width));
      applyingProgrammatically = false;
    }

    /* ── render ───────────────────────────────────────────────────────── */

    function activeEvents(): TimelineEvent[] {
      if (state.types.size === 0) return data.events;
      return data.events.filter((e) => state.types.has(e.type));
    }

    function currentTitle(): { title: string; subtitle: string } {
      const span = `${fmtYear(state.from)} – ${fmtYear(state.to)}`;
      if (state.drill === '') return { title: 'The World Timeline', subtitle: span };
      const node = data.taxonomy.find((n) => n.path === state.drill);
      return { title: node ? `${node.name} branches` : 'Timeline', subtitle: span };
    }

    function fmtYear(y: number): string {
      const r = Math.round(y);
      return r < 0 ? `${Math.abs(r)} BCE` : `${r} CE`;
    }

    function render(): void {
      const events = activeEvents();
      lanes = buildLanes(data.taxonomy, state.drill);

      const ghosts =
        state.ghosts && state.drill !== '' ? ghostEvents(events, lanes, state.drill) : [];

      const view: Viewport = { from: state.from, to: state.to, width: trackWidth() };
      const layouts = layoutTimeline(lanes, events, ghosts, view);

      const { title, subtitle } = currentTitle();
      const meridianYear = (state.from + state.to) / 2;

      canvas.innerHTML = renderCanvas(layouts, view, {
        title,
        subtitle,
        meridianYear,
        meridianLabel: fmtYear(meridianYear),
      });

      /* Chronological order drives arrow-key walking, and matches what a reader
         sees left to right. Clusters are skipped: they are not one event. */
      ordered = layouts
        .flatMap((l) => l.placed)
        .filter((p): p is Extract<typeof p, { kind: 'event' }> => p.kind === 'event')
        .map((p) => p.event)
        .sort((a, b) => a.year_start - b.year_start || a.title.localeCompare(b.title));

      if (crumbEl) crumbEl.innerHTML = crumbHtml();
      if (zoomEl) zoomEl.textContent = zoomLabel(state.to - state.from);
      if (upBtn) upBtn.hidden = state.drill === '';
      if (ghostBtn) {
        ghostBtn.hidden = state.drill === '';
        ghostBtn.setAttribute('aria-pressed', String(state.ghosts));
        ghostBtn.textContent = state.ghosts ? 'Ghosts: on' : 'Ghost mode';
      }
      for (const el of filterEls) {
        const t = el.dataset['type'] ?? '';
        const on = t === '' ? state.types.size === 0 : state.types.has(t);
        el.setAttribute('aria-pressed', String(on));
      }

      if (lastFocusedId !== null) {
        canvas
          .querySelector<HTMLElement>(`[data-event-id="${CSS.escape(lastFocusedId)}"]`)
          ?.focus({ preventScroll: true });
      }
    }

    function crumbHtml(): string {
      const parts = [`<button type="button" data-crumb-to="">World</button>`];
      const segs = drillSegments(state.drill);
      let acc = '';
      for (const seg of segs) {
        acc = acc === '' ? seg : `${acc}/${seg}`;
        const node = data.taxonomy.find((n) => n.path === acc);
        const name = node?.name ?? seg;
        parts.push(
          acc === state.drill
            ? `<b>${name}</b>`
            : `<button type="button" data-crumb-to="${acc}">${name}</button>`,
        );
      }
      return parts.join('<span class="tl-crumb__sep" aria-hidden="true">→</span>');
    }

    /* ── event panel ──────────────────────────────────────────────────── */

    function openPanel(id: string): void {
      const event = byId.get(id);
      if (event === undefined || panelEl === null) return;

      state.selected = id;
      lastFocusedId = id;
      panelEl.innerHTML = panelHtml(event);
      panelEl.hidden = false;
      scrimEl?.removeAttribute('hidden');
      root?.setAttribute('data-panel-open', '');
      panelEl.querySelector<HTMLButtonElement>('[data-panel-close]')?.focus();
      writeUrl();
    }

    function closePanel(): void {
      if (panelEl === null || panelEl.hidden) return;
      panelEl.hidden = true;
      scrimEl?.setAttribute('hidden', '');
      root?.removeAttribute('data-panel-open');
      const id = state.selected;
      state.selected = null;
      writeUrl();
      /* Canvas position is untouched by opening or closing; restore focus to
         the node the reader came from so their place is kept in both senses. */
      if (id !== null) {
        canvas.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`)?.focus();
      }
    }

    function panelHtml(e: TimelineEvent): string {
      const esc = (s: string): string =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const rows: [string, string][] = [
        ['Date', e.display_date],
        ['Type', e.type],
        ['Rank', String(e.importance)],
      ];
      if (e.region.length > 0) rows.push(['Region', e.region.join(', ')]);

      const contested = e.contested
        ? `<p class="tl-panel__contested"><span class="contested-badge">Contested</span>` +
          `<span>${esc(e.contested_note ?? '')}</span></p>`
        : '';

      const sources =
        e.sources.length > 0
          ? `<div class="tl-panel__sources"><span class="eyebrow">Sources</span>` +
            `<p class="caption">${esc(e.sources.join(' · '))}</p></div>`
          : `<div class="tl-panel__sources"><span class="eyebrow">Sources</span>` +
            `<p class="caption">Awaiting source check. Not published.</p></div>`;

      return (
        `<button type="button" class="tl-panel__close" data-panel-close aria-label="Close event">` +
        `<span aria-hidden="true">&times;</span></button>` +
        `<div class="tl-panel__meta">` +
        e.traditions
          .map(
            (t) =>
              `<span class="tl-panel__trad"><svg width="14" height="14" viewBox="0 0 24 24"` +
              ` style="color:var(--t-${t})" aria-hidden="true"><use href="#symbol-${t}"></use></svg>` +
              `${esc(t)}</span>`,
          )
          .join('') +
        `</div>` +
        `<h2 id="tl-panel-title">${esc(e.title)}</h2>` +
        `<div class="tl-rule" aria-hidden="true"><i></i><b></b><i></i></div>` +
        `<div class="tl-panel__label"><span class="eyebrow">Exhibit label</span>` +
        rows
          .map(
            ([k, v]) =>
              `<div class="tl-panel__row"><span>${esc(k)}</span><span class="mono">${esc(v)}</span></div>`,
          )
          .join('') +
        `</div>` +
        contested +
        `<p class="tl-panel__summary">${esc(e.summary)}</p>` +
        sources
      );
    }

    /* ── interaction ──────────────────────────────────────────────────── */

    canvas.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;

      const node = target.closest<HTMLElement>('[data-event-id]');
      if (node !== null) {
        const id = node.dataset['eventId'];
        if (id !== undefined && node.dataset['ghost'] !== '1') openPanel(id);
        return;
      }

      const cluster = target.closest<HTMLElement>('[data-cluster-from]');
      if (cluster !== null) {
        /* Zooming into a cluster is the only honest way to separate it. */
        const from = Number(cluster.dataset['clusterFrom']);
        const to = Number(cluster.dataset['clusterTo']);
        const pad = Math.max(MIN_SPAN, (to - from) * 2 || MIN_SPAN);
        setView(from - pad / 2, to + pad / 2);
        return;
      }

      const drill = target.closest<HTMLElement>('[data-drill]');
      if (drill !== null) {
        const path = drill.dataset['drill'];
        if (path !== undefined) setDrill(path);
      }
    });

    crumbEl?.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-crumb-to]');
      if (btn !== null) setDrill(btn.dataset['crumbTo'] ?? '');
    });

    upBtn?.addEventListener('click', () => setDrill(drillParent(state.drill)));

    ghostBtn?.addEventListener('click', () => {
      state.ghosts = !state.ghosts;
      render();
      writeUrl(true);
    });

    for (const el of filterEls) {
      el.addEventListener('click', () => {
        const t = el.dataset['type'] ?? '';
        if (t === '') state.types.clear();
        else if (state.types.has(t)) state.types.delete(t);
        else state.types.add(t);
        render();
        writeUrl(true);
      });
    }

    panelEl?.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('[data-panel-close]')) closePanel();
    });
    scrimEl?.addEventListener('click', closePanel);

    function setDrill(path: DrillPath): void {
      state.drill = path;
      if (path !== '') state.ghosts = state.ghosts && true;
      lastFocusedId = null;
      render();
      syncZoomTransform();
      writeUrl();
    }

    function setView(from: number, to: number): void {
      const span = Math.max(MIN_SPAN, to - from);
      state.from = from;
      state.to = from + span;
      render();
      syncZoomTransform();
      writeUrl(true);
    }

    /* Keyboard: arrows walk events chronologically, Enter opens, Esc closes
       (design language §10). Left and right move within the ordered set. */
    root?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        closePanel();
        return;
      }

      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      const focused = (ev.target as HTMLElement).closest<HTMLElement>('[data-event-id]');
      if (focused === null) return;

      ev.preventDefault();
      const id = focused.dataset['eventId'];
      const index = ordered.findIndex((e) => e.id === id);
      if (index < 0) return;

      const next = ordered[index + (ev.key === 'ArrowRight' ? 1 : -1)];
      if (next === undefined) return;

      const el = canvas.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(next.id)}"]`);
      if (el !== null) {
        lastFocusedId = next.id;
        el.focus();
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (state.selected !== null) openPanel(next.id);
      }
    });

    window.addEventListener('popstate', () => {
      readUrl();
      render();
      syncZoomTransform();
      if (state.selected !== null) openPanel(state.selected);
      else closePanel();
    });

    /* ── wire up d3-zoom ──────────────────────────────────────────────── */

    zoomBehaviour = zoom<HTMLElement, unknown>()
      .scaleExtent([1, (data.bounds.to - data.bounds.from) / MIN_SPAN])
      .translateExtent([
        [0, 0],
        [trackWidth(), 0],
      ])
      .extent([
        [0, 0],
        [trackWidth(), 0],
      ])
      .filter((ev: Event) => {
        /* Let the reader scroll the page vertically; only intercept horizontal
           intent (wheel with a modifier, pinch, or drag on the canvas). */
        if (ev.type === 'wheel') return (ev as WheelEvent).ctrlKey || (ev as WheelEvent).altKey;
        if (ev.type === 'dblclick') return false;
        return !(ev as MouseEvent).button;
      })
      .on('zoom', (ev: D3ZoomEvent<HTMLElement, unknown>) => {
        if (applyingProgrammatically) return;
        const width = trackWidth();
        baseScale.range([0, width]);
        const rescaled = ev.transform.rescaleX(baseScale);
        const [from, to] = rescaled.domain();
        if (from === undefined || to === undefined) return;
        state.from = from;
        state.to = to;
        render();
        writeUrl(true);
      });

    select(scroller as HTMLElement).call(zoomBehaviour);

    /* ── go ───────────────────────────────────────────────────────────── */

    readUrl();
    render();
    syncZoomTransform();
    writeUrl(true);
    if (state.selected !== null) openPanel(state.selected);

    let resizeTimer: number | undefined;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        render();
        syncZoomTransform();
      }, 120);
    });
  }
}
