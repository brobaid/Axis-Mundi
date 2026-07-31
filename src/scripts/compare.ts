import { renderCompare, type CompareColumn } from '../lib/compare-render';

/**
 * The compare island.
 *
 * Interaction only. The grid itself comes from lib/compare-render.ts, which
 * rendered the opening pair at build time, so the first paint is real content
 * and switching traditions runs exactly the same function.
 *
 * Contract:
 *   - two rails of selector chips, one per column
 *   - the tradition held by the other column is disabled, never silently
 *     swapped out from under the reader
 *   - the pair lives in the URL, so a comparison can be linked to
 */

interface Bootstrap {
  columns: CompareColumn[];
}

const root = document.querySelector<HTMLElement>('[data-compare]');

if (root !== null) {
  const dataEl = document.getElementById('compare-data');
  const data = JSON.parse(dataEl?.textContent ?? '{}') as Bootstrap;
  const grid = root.querySelector<HTMLElement>('[data-compare-grid]');

  if (grid !== null && data.columns.length >= 2) {
    const byId = new Map(data.columns.map((column) => [column.tradition, column]));

    let a = data.columns[0]!.tradition;
    let b = data.columns[1]!.tradition;

    /* ── URL state ───────────────────────────────────────────────────────── */

    function readUrl(): void {
      const q = new URLSearchParams(location.search);
      const wantA = q.get('a');
      const wantB = q.get('b');
      if (wantA !== null && byId.has(wantA)) a = wantA;
      if (wantB !== null && byId.has(wantB) && wantB !== a) b = wantB;
    }

    /* A comparison is a destination, so choosing one pushes history and Back
       returns to the previous pair — unlike the matrix's chips, which are a
       lens on one page. */
    function writeUrl(replace = false): void {
      const q = new URLSearchParams(location.search);
      q.set('a', a);
      q.set('b', b);
      const url = `${location.pathname}?${q.toString()}`;
      if (replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    }

    /* ── render ──────────────────────────────────────────────────────────── */

    function render(): void {
      const left = byId.get(a);
      const right = byId.get(b);
      if (left === undefined || right === undefined) return;

      grid!.innerHTML = renderCompare(left, right);

      for (const rail of root!.querySelectorAll<HTMLElement>('[data-pick]')) {
        const side = rail.dataset['pick'];
        const mine = side === 'a' ? a : b;
        const theirs = side === 'a' ? b : a;

        for (const chip of rail.querySelectorAll<HTMLButtonElement>('[data-tradition]')) {
          const id = chip.dataset['tradition'];
          chip.setAttribute('aria-pressed', String(id === mine));
          chip.disabled = id === theirs;
        }
      }
    }

    root.addEventListener('click', (ev) => {
      const chip = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-tradition]');
      if (chip === null || chip.disabled) return;

      const rail = chip.closest<HTMLElement>('[data-pick]');
      const id = chip.dataset['tradition'];
      if (rail === null || id === undefined || !byId.has(id)) return;

      if (rail.dataset['pick'] === 'a') {
        if (id === a) return;
        a = id;
      } else {
        if (id === b) return;
        b = id;
      }

      render();
      writeUrl();
    });

    window.addEventListener('popstate', () => {
      readUrl();
      render();
    });

    readUrl();
    render();
    writeUrl(true);
  }
}
