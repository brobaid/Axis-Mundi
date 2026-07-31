import { createPanel, esc } from '../lib/panel';

/**
 * The family-tree island.
 *
 * Interaction only: the layout is computed at build time in lib/tree-model.ts,
 * so the first paint is the real tree and this file never moves a node.
 *
 * Contract:
 *   - the era slider dims what did not exist by the chosen year
 *   - a branch answers from its tradition's founding, the only honest claim
 *     available when the branch itself carries no date
 *   - tapping a node opens the shared panel, with links into its dive and into
 *     the timeline drilled to its lane
 *   - state lives in the URL, replaced rather than pushed
 */

interface TreeNode {
  id: string;
  name: string;
  tradition: string;
  path: string;
  depth: number;
  contested: boolean;
  dated: boolean;
  foundedYear: number | null;
  foundedDisplay: string | null;
  foundedContested: boolean;
  adherentsDisplay: string | null;
  adherentsContested: boolean;
  hasDive: boolean;
}

interface Bootstrap {
  nodes: TreeNode[];
  rootYears: Record<string, number | null>;
  detents: number[];
  traditionNames: Record<string, string>;
}

const root = document.querySelector<HTMLElement>('[data-tree]');

if (root !== null) {
  const dataEl = document.getElementById('tree-data');
  const data = JSON.parse(dataEl?.textContent ?? '{}') as Bootstrap;
  const rail = root.querySelector<HTMLElement>('[data-tree-scrubber]');
  const readout = root.querySelector<HTMLElement>('[data-tree-readout]');
  const meridian = root.querySelector<HTMLElement>('[data-tree-meridian]');
  const panel = createPanel();

  if (rail !== null && data.nodes !== undefined) {
    const last = data.detents[data.detents.length - 1] ?? 2020;
    let era = last;

    const eraLabel = (y: number): string =>
      y < 0 ? `${Math.abs(y)} BCE` : y === 1 ? '1 CE' : String(y);

    /* A node exists by `year` if its own founding does, or — for a branch with
       no date — if its tradition's does. Undated and unknown means shown. */
    const existsBy = (n: TreeNode, year: number): boolean => {
      const own = n.foundedYear ?? data.rootYears[n.tradition] ?? null;
      return own === null || own <= year;
    };

    function readUrl(): void {
      const q = Number(new URLSearchParams(location.search).get('era'));
      if (Number.isFinite(q) && data.detents.includes(q)) era = q;
    }

    /* Replace, never push: the slider is a lens on one page, so Back should
       leave the room rather than unwind twelve detents. */
    function writeUrl(): void {
      const q = new URLSearchParams(location.search);
      q.set('era', String(era));
      history.replaceState(null, '', `${location.pathname}?${q.toString()}`);
    }

    function render(): void {
      let shown = 0;
      for (const node of data.nodes) {
        const el = root!.querySelector<SVGGElement>(`[data-node="${CSS.escape(node.id)}"]`);
        if (el === null) continue;
        const on = existsBy(node, era);
        if (on) shown += 1;
        if (on) el.removeAttribute('data-before');
        else el.setAttribute('data-before', '');
      }

      for (const btn of rail!.querySelectorAll<HTMLButtonElement>('[data-era]')) {
        const on = Number(btn.dataset['era']) === era;
        btn.setAttribute('aria-checked', String(on));
        btn.tabIndex = on ? 0 : -1;
        btn.classList.toggle('scrub__detent--on', on);
      }

      if (readout !== null) {
        readout.textContent = `${eraLabel(era)} · ${shown} of ${data.nodes.length} nodes in existence`;
      }
      if (meridian !== null) {
        const i = data.detents.indexOf(era);
        const f = data.detents.length > 1 ? i / (data.detents.length - 1) : 0;
        meridian.style.left = `${(f * 100).toFixed(2)}%`;
      }
    }

    rail.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-era]');
      if (btn === null) return;
      const next = Number(btn.dataset['era']);
      if (!Number.isFinite(next)) return;
      era = next;
      render();
      writeUrl();
    });

    rail.addEventListener('keydown', (ev) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(ev.key)) return;
      ev.preventDefault();
      const i = data.detents.indexOf(era);
      let next = i;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') next = Math.max(0, i - 1);
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp')
        next = Math.min(data.detents.length - 1, i + 1);
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = data.detents.length - 1;
      const target = data.detents[next];
      if (target === undefined) return;
      era = target;
      render();
      writeUrl();
      rail.querySelector<HTMLButtonElement>(`[data-era="${target}"]`)?.focus();
    });

    /* ── node tap ──────────────────────────────────────────────────────── */

    root.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const g = (ev.target as Element).closest<SVGGElement>('[data-node]');
      if (g === null) return;
      ev.preventDefault();
      g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    root.addEventListener('click', (ev) => {
      const g = (ev.target as Element).closest<SVGGElement>('[data-node]');
      if (g === null || panel === null) return;
      const node = data.nodes.find((n) => n.id === g.dataset['node']);
      if (node === undefined) return;
      panel.open(nodeHtml(node), g as unknown as HTMLElement);
    });

    function nodeHtml(n: TreeNode): string {
      const rows: [string, string][] = [
        ['Tradition', data.traditionNames[n.tradition] ?? n.tradition],
        ['Path', n.path.split('/').join(' → ')],
      ];
      if (n.foundedDisplay !== null) rows.push(['Founded', n.foundedDisplay]);
      else if (n.depth > 1) rows.push(['Founded', 'No founding record for this branch']);
      if (n.adherentsDisplay !== null) {
        rows.push([
          'Adherents',
          n.adherentsDisplay === 'see note' ? 'No single figure' : n.adherentsDisplay,
        ]);
      }

      const contested = n.contested
        ? `<p class="panel__contested"><span class="contested-badge">Contested</span>` +
          `<span>This classification is contested. The node is placed by the group's own ` +
          `self-identification, and the dispute is shown rather than resolved.</span></p>`
        : '';

      const links =
        `<div class="panel__sources"><span class="eyebrow">Go to</span><p class="caption">` +
        (n.hasDive ? `<a href="/traditions/${esc(n.tradition)}">Deep dive</a> · ` : '') +
        `<a href="/timeline?drill=${esc(n.depth === 1 ? n.tradition : n.path.split('/').slice(0, -1).join('/'))}">` +
        `Timeline lane</a></p></div>`;

      return (
        `<div class="panel__meta"><span>` +
        `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"` +
        ` style="color:var(--t-${esc(n.tradition)})"><use href="#symbol-${esc(n.tradition)}"></use></svg>` +
        `${esc(data.traditionNames[n.tradition] ?? n.tradition)}</span></div>` +
        `<h2 id="panel-title">${esc(n.name)}</h2>` +
        `<div class="panel__rule" aria-hidden="true"><i></i><b></b><i></i></div>` +
        `<div class="panel__label"><span class="eyebrow">Exhibit label</span>` +
        rows
          .map(
            ([k, v]) =>
              `<div class="panel__row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`,
          )
          .join('') +
        `</div>` +
        contested +
        links
      );
    }

    window.addEventListener('popstate', () => {
      readUrl();
      render();
    });

    readUrl();
    render();
  }
}
