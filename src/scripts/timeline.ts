import { scaleLinear } from 'd3-scale';
import { CURSOR_PARAM, centreOn, readCursor } from '../lib/cursor';
import { FLICK_MIN_PX_PER_MS, glide, intentOf, velocityFrom, type Intent, type Sample } from '../lib/inertia';
import { playMorph, snapshotPositions } from '../lib/morph';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';

import {
  buildLanes,
  drillParent,
  drillSegments,
  pathContains,
  zoomLevelFrom,
  type ZoomLevel,
  ghostEvents,
  layoutTimeline,
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
  threads: boolean;
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
    const threadsBtn = root.querySelector<HTMLButtonElement>('[data-threads-toggle]');
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
      threads: false,
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
      } else {
        /* Arriving from another room. The shared cursor moves where the reader
           is looking; how far they are zoomed stays theirs. */
        const year = readCursor(location.search);
        if (year !== null) {
          const view = centreOn(year, { from: state.from, to: state.to }, data.bounds);
          state.from = view.from;
          state.to = view.to;
        }
      }
      const types = q.get('types');
      state.types = new Set(types === null || types === '' ? [] : types.split(','));
      state.ghosts = q.get('ghosts') === '1';
      state.threads = q.get('threads') === '1';
      state.selected = q.get('event');
    }

    function writeUrl(replace = false): void {
      const q = new URLSearchParams();
      if (state.drill !== '') q.set('drill', state.drill);
      q.set('from', String(Math.round(state.from)));
      q.set('to', String(Math.round(state.to)));
      /* The cursor is the centre of the window — the year the meridian stands
         on. `from`/`to` are the timeline's own zoom; this is what leaves the
         room with the reader. */
      q.set(CURSOR_PARAM, String(Math.round((state.from + state.to) / 2)));
      if (state.types.size > 0) q.set('types', [...state.types].join(','));
      if (state.ghosts) q.set('ghosts', '1');
      if (state.threads) q.set('threads', '1');
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

    /**
     * The granularity currently on screen, and the view it was reached from.
     *
     * Held here rather than derived per frame so hysteresis has something to
     * remember: without it a span resting on a boundary strobes the label on
     * every frame of a drag.
     */
    let level: ZoomLevel | null = null;

    /**
     * Views the reader was moved out of, newest last.
     *
     * Opening a cluster moves the window without the reader choosing where to;
     * one tap of Back has to put them exactly where they were. Only involuntary
     * moves are pushed — a deliberate scrub or stepper press is the reader
     * navigating, and unwinding those would make Back mean two things.
     */
    const viewStack: { from: number; to: number }[] = [];

    function render(): void {
      const events = activeEvents();
      lanes = buildLanes(data.taxonomy, state.drill);

      const ghosts =
        state.ghosts && state.drill !== '' ? ghostEvents(events, lanes, state.drill) : [];

      const view: Viewport = { from: state.from, to: state.to, width: trackWidth() };
      const layouts = layoutTimeline(lanes, events, ghosts, view);

      const { title, subtitle } = currentTitle();
      const meridianYear = (state.from + state.to) / 2;

      /* A change of granularity is the one re-render worth animating: every dot
         and every tick lands somewhere else at once, and without the movement a
         reader cannot tell whether the scale changed or the data did. */
      const nextLevel = zoomLevelFrom(state.to - state.from, level);
      const levelChanged = level !== null && nextLevel !== level;
      const before = levelChanged ? snapshotPositions(canvas) : null;
      level = nextLevel;

      canvas.innerHTML = renderCanvas(layouts, view, {
        title,
        subtitle,
        meridianYear,
        meridianLabel: fmtYear(meridianYear),
        threads: state.threads,
      });

      /* Chronological order drives arrow-key walking, and matches what a reader
         sees left to right. Clusters are skipped: they are not one event. */
      ordered = layouts
        .flatMap((l) => l.placed)
        .filter((p): p is Extract<typeof p, { kind: 'event' }> => p.kind === 'event')
        .map((p) => p.event)
        .sort((a, b) => a.year_start - b.year_start || a.title.localeCompare(b.title));

      if (before !== null) playMorph(canvas, before);

      if (crumbEl) crumbEl.innerHTML = crumbHtml();
      if (zoomEl) zoomEl.textContent = level;
      const scaleEl = root!.querySelector<HTMLElement>('[data-scale-level]');
      if (scaleEl !== null) scaleEl.textContent = level;
      const scaleSpan = root!.querySelector<HTMLElement>('[data-scale-span]');
      if (scaleSpan !== null) scaleSpan.textContent = subtitle;
      /* Back is not only for drilling: opening a cluster changes the view too,
         and a reader who has been moved deserves a way out of it either way. */
      if (upBtn) {
        const canRetreat = state.drill !== '' || viewStack.length > 0;
        upBtn.hidden = !canRetreat;
        upBtn.textContent = state.drill !== '' && viewStack.length === 0 ? 'Back up' : 'Back';
      }
      /* The map, matrix and tree all announce their state; the timeline did
         not, so a screen-reader user got no confirmation that a zoom, drill or
         filter had changed anything. Same strings the eye gets. */
      const liveEl = root!.querySelector<HTMLElement>('[data-tl-readout]');
      if (liveEl !== null) {
        const drawn = layouts.reduce((n, l) => n + l.placed.length, 0);
        const demoted = layouts.reduce((n, l) => n + l.demoted, 0);
        liveEl.textContent =
          `${subtitle}. ${layouts.length} lanes, ${drawn} events drawn` +
          (demoted > 0 ? `, ${demoted} held back by the density budget` : '') +
          (state.threads ? ', influence threads on' : '') + '.';
      }

      if (threadsBtn) {
        threadsBtn.setAttribute('aria-pressed', String(state.threads));
        threadsBtn.textContent = state.threads ? 'Threads: on' : 'Influence threads';
      }
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

    /**
     * Open a cluster where it stands.
     *
     * The sheet lists every event the cluster holds, each one openable without
     * moving the canvas an inch, and offers the range as a named action rather
     * than performing it on contact.
     */
    function openCluster(el: HTMLElement): void {
      if (panelEl === null) return;
      const from = Number(el.dataset['clusterFrom']);
      const to = Number(el.dataset['clusterTo']);
      const lanePath = el.dataset['clusterLane'] ?? '';
      if (!Number.isFinite(from) || !Number.isFinite(to)) return;

      const inRange = activeEvents()
        .filter((e) => {
          const start = e.year_start;
          const end = e.year_end ?? e.year_start;
          const touches = end >= from && start <= to;
          /* The same predicate the layout used to put the event in this lane,
             so the sheet lists exactly what the cluster stands for. */
          const inLane = lanePath === '' || e.branch_path.some((b) => pathContains(lanePath, b));
          return touches && inLane;
        })
        .sort((a, b) => a.year_start - b.year_start || a.title.localeCompare(b.title));

      const esc = (t: string): string =>
        t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const range = from === to ? fmtYear(from) : `${fmtYear(from)} – ${fmtYear(to)}`;

      panelEl.innerHTML =
        `<button type="button" class="panel__close" data-panel-close aria-label="Close">` +
        `<span aria-hidden="true">&times;</span></button>` +
        `<div class="panel__meta"><span>Cluster</span></div>` +
        `<h2 id="panel-title">${inRange.length} events, tap to open this range</h2>` +
        `<div class="panel__rule" aria-hidden="true"><i></i><b></b><i></i></div>` +
        `<p class="caption">${esc(range)}</p>` +
        `<ul class="tl-cluster-list" role="list">` +
        inRange
          .map(
            (e) =>
              `<li><button type="button" class="tl-cluster-item" data-open-event="${esc(e.id)}">` +
              `<b>${esc(e.title)}</b><i class="mono">${esc(e.display_date)}</i>` +
              `</button></li>`,
          )
          .join('') +
        `</ul>` +
        `<p class="panel__sources"><button type="button" class="tl-btn" data-open-range` +
        ` data-range-from="${from}" data-range-to="${to}">Open this range on the canvas</button></p>`;

      panelEl.hidden = false;
      scrimEl?.removeAttribute('hidden');
      root?.setAttribute('data-panel-open', '');
      panelEl.querySelector<HTMLButtonElement>('[data-panel-close]')?.focus();
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
        /* Escaped at build time with glossary headwords wrapped; the
           tap-card's listener is delegated, so a term works in the panel. */
        `<p class="tl-panel__summary">${e.summary_html ?? esc(e.summary)}</p>` +
        sources
      );
    }

    /* ── interaction ──────────────────────────────────────────────────── */

    canvas.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;

      /* A thread stands for one record on two or more lanes, so tapping it
         opens that record — the same panel the dot opens. */
      const thread = target.closest<SVGPathElement>('[data-thread]');
      const threadId = thread?.dataset['thread'];
      if (threadId !== undefined && byId.has(threadId)) {
        openPanel(threadId);
        return;
      }

      const node = target.closest<HTMLElement>('[data-event-id]');
      if (node !== null) {
        const id = node.dataset['eventId'];
        if (id !== undefined && node.dataset['ghost'] !== '1') openPanel(id);
        return;
      }

      const cluster = target.closest<HTMLElement>('[data-cluster-from]');
      if (cluster !== null) {
        /* A cluster opens where it stands. It used to zoom on the first tap,
           which is how a mark that looks like a dot came to move the whole
           canvas — the reader asked to read something and the room moved. Now
           it expands in place: every event inside it is listed and reachable,
           and opening the range is a second, named choice. */
        openCluster(cluster);
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

    /* Back retreats the way the reader came: out of an opened range first,
       since that is the move they did not choose, and only then up the drill. */
    upBtn?.addEventListener('click', () => {
      const previous = viewStack.pop();
      if (previous !== undefined) {
        setView(previous.from, previous.to);
        return;
      }
      setDrill(drillParent(state.drill));
    });

    threadsBtn?.addEventListener('click', () => {
      state.threads = !state.threads;
      render();
      /* A lens on the canvas, not a destination: replace, so Back leaves the
         room rather than unwinding every toggle. */
      writeUrl(true);
    });

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
      const t = ev.target as HTMLElement;
      if (t.closest('[data-panel-close]')) {
        closePanel();
        return;
      }
      /* An event inside a cluster opens as itself, with the canvas untouched. */
      const open = t.closest<HTMLElement>('[data-open-event]');
      if (open !== null) {
        const id = open.dataset['openEvent'];
        if (id !== undefined) openPanel(id);
        return;
      }
      /* The range, only when asked for by name. The view being left is pushed
         so Back returns to it exactly. */
      const range = t.closest<HTMLElement>('[data-open-range]');
      if (range !== null) {
        const from = Number(range.dataset['rangeFrom']);
        const to = Number(range.dataset['rangeTo']);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return;
        viewStack.push({ from: state.from, to: state.to });
        closeSheet();
        const pad = Math.max(MIN_SPAN, (to - from) * 2 || MIN_SPAN);
        setView(from - pad / 2, to + pad / 2);
      }
    });

    /** Close the sheet without the event-panel bookkeeping. */
    function closeSheet(): void {
      if (panelEl === null) return;
      panelEl.hidden = true;
      scrimEl?.setAttribute('hidden', '');
      root?.removeAttribute('data-panel-open');
    }
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

    /**
     * Step the span, holding the centre — which is where the meridian stands,
     * so the cursor keeps its year while the window tightens around it.
     *
     * Clamped to the same extents d3-zoom uses, so the buttons and a desktop
     * pinch can never disagree about how far the timeline goes.
     */
    function stepZoom(factor: number): void {
      const centre = (state.from + state.to) / 2;
      const total = data.bounds.to - data.bounds.from;
      const span = Math.min(total, Math.max(MIN_SPAN, (state.to - state.from) * factor));
      let from = Math.round(centre - span / 2);
      if (from < data.bounds.from) from = data.bounds.from;
      if (from + span > data.bounds.to) from = data.bounds.to - span;
      setView(from, from + span);
    }

    root?.querySelector('[data-zoom-in]')?.addEventListener('click', () => stepZoom(0.5));
    root?.querySelector('[data-zoom-out]')?.addEventListener('click', () => stepZoom(2));

    /* The docked controls are fixed, so they float over whatever is at the
       bottom of the page — the footer, not the timeline, since the footer comes
       after it. The page reserves exactly the dock's height, measured rather
       than guessed: the dock is one row undrilled and two rows drilled, so any
       number written here would be wrong half the time. */
    const dock = root?.querySelector<HTMLElement>('.tl-bar__actions');
    if (dock !== null && dock !== undefined && window.matchMedia('(pointer: coarse)').matches) {
      const reserve = (): void => {
        const h = dock.getBoundingClientRect().height;
        document.body.style.paddingBottom = h > 0 ? `${Math.ceil(h)}px` : '';
      };
      reserve();
      new ResizeObserver(reserve).observe(dock);
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
        /* Two fingers are a pinch and stay d3's. One finger is a pan, and the
           pointer layer below owns it: d3-zoom's touch path stops the moment a
           finger lifts, and it counts single touchstarts toward its own
           double-tap-to-zoom, which readers trigger constantly while aiming at
           a dot. Refusing every single-touch start settles both. */
        if (ev.type === 'touchstart') return (ev as TouchEvent).touches.length > 1;
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

    /* ── touch panning, with momentum ─────────────────────────────────── */

    /**
     * One finger pans; the page keeps the vertical.
     *
     * Two things were wrong before. d3-zoom's touch path pans only while the
     * finger is down, so a flick stopped dead on lift and crossing a
     * millennium meant a dozen short scrubs. And nobody arbitrated: the frame
     * declared `touch-action: pan-y pinch-zoom`, so a horizontal drag was
     * claimed by the compositor after a single move event and the pan advanced
     * one frame and died.
     *
     * So: decide intent in the first few pixels, take the gesture only when it
     * is ours, and carry the release velocity into a decaying glide.
     */
    function panBy(dxScreen: number): boolean {
      const t = zoomTransform(scroller);
      const next = zoomIdentity.translate(t.x + dxScreen, t.y).scale(t.k);
      select(scroller as HTMLElement).call(zoomBehaviour.transform, next);
      /* Clamped at an extent: the glide has arrived and should stop, not spin. */
      return zoomTransform(scroller).x !== t.x;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const activeTouches = new Set<number>();
    let intent: Intent = 'undecided';
    let panPointer: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let samples: Sample[] = [];
    let stopGlide: (() => void) | null = null;

    const endPan = (): void => {
      if (panPointer !== null && scroller.hasPointerCapture(panPointer)) {
        scroller.releasePointerCapture(panPointer);
      }
      panPointer = null;
      intent = 'undecided';
      samples = [];
    };

    scroller.addEventListener(
      'pointerdown',
      (ev: PointerEvent) => {
        /* A touch landing on a moving canvas stops it where it stands. */
        stopGlide?.();
        stopGlide = null;
        if (ev.pointerType !== 'touch') return;
        activeTouches.add(ev.pointerId);
        /* Two fingers are a pinch, and a pinch is d3's. Whatever this pan had
           started, it stops now rather than dragging the canvas sideways while
           the reader changes the scale. */
        if (activeTouches.size > 1) {
          endPan();
          return;
        }
        panPointer = ev.pointerId;
        intent = 'undecided';
        startX = lastX = ev.clientX;
        startY = ev.clientY;
        samples = [{ t: ev.timeStamp, x: ev.clientX }];
      },
      { passive: true },
    );

    scroller.addEventListener('pointermove', (ev: PointerEvent) => {
      if (ev.pointerId !== panPointer || activeTouches.size > 1) return;
      if (intent === 'undecided') {
        intent = intentOf(ev.clientX - startX, ev.clientY - startY);
        if (intent === 'undecided') return;
        if (intent === 'vertical') {
          /* The page's gesture, and it stays the page's for the whole touch. */
          endPan();
          return;
        }
        scroller.setPointerCapture(ev.pointerId);
      }
      if (intent !== 'horizontal') return;
      /* Ours now, so the compositor must not also scroll with it. */
      if (ev.cancelable) ev.preventDefault();
      panBy(ev.clientX - lastX);
      lastX = ev.clientX;
      samples.push({ t: ev.timeStamp, x: ev.clientX });
      if (samples.length > 8) samples.shift();
    });

    const release = (ev: PointerEvent): void => {
      activeTouches.delete(ev.pointerId);
      if (ev.pointerId !== panPointer) return;
      const wasPanning = intent === 'horizontal';
      const v = velocityFrom(samples);
      endPan();
      if (!wasPanning || Math.abs(v) < FLICK_MIN_PX_PER_MS) return;
      stopGlide = glide({ velocity: v, step: panBy, reduced: reducedMotion.matches });
    };
    scroller.addEventListener('pointerup', release);
    scroller.addEventListener('pointercancel', release);

    /* ── first-visit coach ────────────────────────────────────────────── */

    /* Shown once, then never. Storage failing is not an error worth handling
       loudly: the coach reappears, which is a smaller cost than a room that
       will not load because a browser refused a key. */
    const COACH_KEY = 'axis-mundi-timeline-coach';
    const coach = root?.querySelector<HTMLElement>('[data-tl-coach]');
    if (coach !== null && coach !== undefined) {
      let seen = false;
      try {
        seen = localStorage.getItem(COACH_KEY) === 'seen';
      } catch {
        /* storage unavailable; show it */
      }
      if (!seen) {
        coach.hidden = false;
        coach.querySelector<HTMLButtonElement>('[data-coach-dismiss]')?.focus();
      }
      const dismiss = (): void => {
        coach.hidden = true;
        try {
          localStorage.setItem(COACH_KEY, 'seen');
        } catch {
          /* nothing to remember it with; it will greet them again */
        }
      };
      coach.addEventListener('click', (ev) => {
        const t = ev.target as HTMLElement;
        if (t.closest('[data-coach-dismiss]') || t === coach) dismiss();
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && !coach.hidden) dismiss();
      });
    }

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
