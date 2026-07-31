import { createPanel, esc } from '../lib/panel';
import { MATRIX_DIMENSION_LABELS, type MatrixDimension } from '../lib/dimensions';
import { matches, type FilterChip, type MatrixRowView } from '../lib/matrix-view';

/**
 * The matrix island.
 *
 * Interaction only: the filter algebra lives in lib/matrix-view.ts and ran at
 * build time to produce the chips, so the browser and the build agree on which
 * rows a chip keeps.
 *
 * Contract:
 *   - chips filter rows; same dimension OR'd, different dimensions AND'd
 *   - a cell opens the shared panel with its nuance and its source
 *   - filter state lives in the URL, replacing rather than pushing, so Back
 *     leaves the page instead of unwinding every chip tap
 */

interface Bootstrap {
  rows: MatrixRowView[];
  sourceTitles: Record<string, string>;
}

const root = document.querySelector<HTMLElement>('[data-matrix]');

if (root !== null) {
  const dataEl = document.getElementById('matrix-data');
  const data = JSON.parse(dataEl?.textContent ?? '{}') as Bootstrap;

  const table = root.querySelector<HTMLElement>('.mx');
  const readout = root.querySelector<HTMLElement>('[data-matrix-readout]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-chip-clear]');
  const chipButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-chip]')];

  const panel = createPanel();

  /** Every chip the page rendered, by key, so the URL can name them. */
  const known = new Map<string, FilterChip>();
  for (const btn of chipButtons) {
    const key = btn.dataset['chip'];
    if (key === undefined) continue;
    const [dimension, value] = key.split('=');
    if (dimension === undefined || value === undefined) continue;
    known.set(key, {
      dimension: dimension as MatrixDimension,
      value,
      label: btn.textContent?.trim() ?? key,
      count: 0,
    });
  }

  let active = new Set<string>();

  /* ── URL state ─────────────────────────────────────────────────────────── */

  function readUrl(): void {
    const raw = new URLSearchParams(location.search).get('filter');
    const keys = raw === null || raw === '' ? [] : raw.split(',');
    active = new Set(keys.filter((key) => known.has(key)));
  }

  /* Replace, never push: a reader toggling four chips should be able to leave
     with one Back, the same decision the timeline's filters made. */
  function writeUrl(): void {
    const q = new URLSearchParams(location.search);
    if (active.size === 0) q.delete('filter');
    else q.set('filter', [...active].join(','));
    const query = q.toString();
    history.replaceState(null, '', query === '' ? location.pathname : `${location.pathname}?${query}`);
  }

  /* ── filtering ─────────────────────────────────────────────────────────── */

  function render(): void {
    const chips = [...active]
      .map((key) => known.get(key))
      .filter((chip): chip is FilterChip => chip !== undefined);

    let shown = 0;
    for (const row of data.rows) {
      const keep = matches(row, chips);
      if (keep) shown += 1;
      const tr = table?.querySelector<HTMLElement>(`[data-row="${CSS.escape(row.id)}"]`);
      if (tr !== null && tr !== undefined) tr.hidden = !keep;
    }

    for (const btn of chipButtons) {
      const key = btn.dataset['chip'];
      btn.setAttribute('aria-pressed', String(key !== undefined && active.has(key)));
    }

    if (clearBtn !== null) clearBtn.hidden = active.size === 0;

    if (readout !== null) {
      readout.textContent =
        active.size === 0
          ? `${data.rows.length} traditions, unfiltered.`
          : shown === 0
            ? 'No tradition holds every selected position.'
            : `${shown} of ${data.rows.length} traditions match.`;
    }
  }

  root.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;

    if (target.closest('[data-chip-clear]') !== null) {
      active.clear();
      render();
      writeUrl();
      return;
    }

    const chip = target.closest<HTMLElement>('[data-chip]');
    if (chip !== null) {
      const key = chip.dataset['chip'];
      if (key === undefined) return;
      if (active.has(key)) active.delete(key);
      else active.add(key);
      render();
      writeUrl();
      return;
    }

    const cell = target.closest<HTMLElement>('[data-cell]');
    if (cell !== null && panel !== null) {
      const ref = cell.dataset['cell'];
      if (ref === undefined) return;
      const [rowId, dimension] = ref.split(':');
      const row = data.rows.find((r) => r.id === rowId);
      const view = row?.cells[dimension as MatrixDimension];
      if (row === undefined || view === undefined) return;
      panel.open(cellHtml(row, view), cell);
    }
  });

  /* ── the cell card ─────────────────────────────────────────────────────── */

  function cellHtml(row: MatrixRowView, cell: MatrixRowView['cells'][MatrixDimension]): string {
    if (cell === undefined) return '';

    const contested = cell.contested
      ? `<p class="panel__contested"><span class="contested-badge">Contested</span>` +
        `<span>${esc(cell.contestedNote ?? '')}</span></p>`
      : '';

    /* Spec §9.2.2: a published cell cites T1 or a labelled T4. A cell with no
       citation should not have been promoted, so say that rather than nothing. */
    const sources =
      cell.sources.length > 0
        ? cell.sources.map((id) => esc(data.sourceTitles[id] ?? id)).join(' · ')
        : 'Awaiting a source check.';

    return (
      `<div class="panel__meta"><span>` +
      `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"` +
      ` style="color:var(--t-${esc(row.tradition)})"><use href="#symbol-${esc(row.tradition)}"></use></svg>` +
      `${esc(row.label)}</span></div>` +
      `<h2 id="panel-title">${esc(MATRIX_DIMENSION_LABELS[cell.dimension])}</h2>` +
      `<div class="panel__rule" aria-hidden="true"><i></i><b></b><i></i></div>` +
      `<div class="panel__label"><span class="eyebrow">Position</span>` +
      `<div class="panel__row"><span>Value</span><span class="mono">${esc(cell.label)}</span></div>` +
      `</div>` +
      contested +
      /* Already escaped at build time, with glossary headwords wrapped. The
         tap-card's listener is delegated, so a term works inside the panel. */
      `<p class="panel__body">${cell.nuanceHtml}</p>` +
      `<div class="panel__sources"><span class="eyebrow">Sources</span>` +
      `<p class="caption">${sources}</p></div>`
    );
  }

  window.addEventListener('popstate', () => {
    readUrl();
    render();
  });

  readUrl();
  render();
}
