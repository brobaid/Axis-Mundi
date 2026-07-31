import { createPanel, esc } from '../lib/panel';
import { eraLabel } from '../lib/map-render';

/**
 * The map island.
 *
 * Owns interaction only: projection and markup live in lib/map-render.ts and
 * run at build time too.
 *
 * Contract:
 *   - twelve snapshot detents on the scrubber, synced to the global time cursor
 *   - opacity-only crossfade between snapshots, never shape-tweening, because
 *     inventing intermediate borders would be a claim we cannot source
 *   - realm tap opens the shared panel component
 *   - keyboard access to the scrubber: arrows, Home and End
 */

interface RealmData {
  id: string;
  name: string;
  tradition: string;
  grade: 'a' | 'b' | 'c';
  minorities: string[];
  sources: string[];
  note?: string;
  contested: boolean;
  contested_note?: string;
}

interface SnapshotData {
  id: string;
  era: number;
  label: string;
  fixture: boolean;
  realms: RealmData[];
}

interface Bootstrap {
  snapshots: SnapshotData[];
  detents: { era: number; label: string; available: boolean }[];
  sourceTitles: Record<string, string>;
}

const GRADE_LABEL: Record<'a' | 'b' | 'c', string> = {
  a: 'A · documented',
  b: 'B · scholarly estimate',
  c: 'C · speculative',
};

const root = document.querySelector<HTMLElement>('[data-map]');

if (root !== null) {
  const dataEl = document.getElementById('map-data');
  const data = JSON.parse(dataEl?.textContent ?? '{}') as Bootstrap;

  const canvas = root.querySelector<HTMLElement>('[data-map-canvas]');
  const rail = root.querySelector<HTMLElement>('[data-scrubber]');
  const readout = root.querySelector<HTMLElement>('[data-map-readout]');

  if (canvas !== null && rail !== null) {
    const withData = data.detents.filter((d) => d.available);
    let activeEra = withData[0]?.era ?? data.detents[0]?.era ?? 1;

    const panel = createPanel();

    /* ── URL state, shared with the rest of the site ─────────────────── */

    function readUrl(): void {
      const era = Number(new URLSearchParams(location.search).get('era'));
      if (Number.isFinite(era) && data.detents.some((d) => d.era === era && d.available)) {
        activeEra = era;
      }
    }

    function writeUrl(replace = false): void {
      const q = new URLSearchParams(location.search);
      q.set('era', String(activeEra));
      const url = `${location.pathname}?${q.toString()}`;
      if (replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    }

    /* ── crossfade ───────────────────────────────────────────────────── */

    /**
     * Opacity only. Design language §7 forbids shape-tweening between
     * snapshots: intermediate borders would be invented, and the map does not
     * invent. Layers are all in the DOM; only their opacity moves.
     */
    function render(): void {
      for (const layer of canvas!.querySelectorAll<SVGGElement>('.map-snapshot')) {
        const era = Number(layer.dataset['era']);
        const on = era === activeEra;
        layer.style.opacity = on ? '1' : '0';
        if (on) layer.removeAttribute('aria-hidden');
        else layer.setAttribute('aria-hidden', 'true');
      }

      for (const btn of rail!.querySelectorAll<HTMLButtonElement>('[data-era]')) {
        const era = Number(btn.dataset['era']);
        const on = era === activeEra;
        btn.setAttribute('aria-checked', String(on));
        btn.tabIndex = on ? 0 : -1;
        btn.classList.toggle('scrub__detent--on', on);
      }

      const snapshot = data.snapshots.find((s) => s.era === activeEra);
      if (readout !== null) {
        readout.textContent =
          snapshot === undefined
            ? `${eraLabel(activeEra)} · no snapshot in this build`
            : `${snapshot.label} · ${snapshot.realms.length} realms${snapshot.fixture ? ' · fixture data' : ''}`;
      }

      const meridian = root!.querySelector<HTMLElement>('[data-map-meridian]');
      if (meridian !== null) {
        const index = data.detents.findIndex((d) => d.era === activeEra);
        const fraction = data.detents.length > 1 ? index / (data.detents.length - 1) : 0;
        meridian.style.left = `${(fraction * 100).toFixed(2)}%`;
      }
    }

    function setEra(era: number, push = true): void {
      if (!data.detents.some((d) => d.era === era && d.available)) return;
      activeEra = era;
      render();
      writeUrl(!push);
    }

    /* ── the scrubber ────────────────────────────────────────────────── */

    rail.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-era]');
      if (btn === null) return;
      const era = Number(btn.dataset['era']);
      if (Number.isFinite(era)) setEra(era);
    });

    /* Arrows step between snapshots that exist; Home and End jump to the ends.
       Only available detents are reachable, so the cursor never lands on a year
       with nothing behind it. */
    rail.addEventListener('keydown', (ev) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(ev.key)) return;
      ev.preventDefault();

      const index = withData.findIndex((d) => d.era === activeEra);
      let next = index;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') next = Math.max(0, index - 1);
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp')
        next = Math.min(withData.length - 1, index + 1);
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = withData.length - 1;

      const target = withData[next];
      if (target === undefined) return;
      setEra(target.era);
      rail.querySelector<HTMLButtonElement>(`[data-era="${target.era}"]`)?.focus();
    });

    /* ── realm tap → the shared panel ────────────────────────────────── */

    canvas.addEventListener('click', (ev) => {
      const group = (ev.target as Element).closest<SVGGElement>('[data-realm]');
      if (group === null || panel === null) return;

      const realmId = group.dataset['realm'];
      const snapshotId = group.dataset['snapshot'];
      const snapshot = data.snapshots.find((s) => s.id === snapshotId);
      const realm = snapshot?.realms.find((r) => r.id === realmId);
      if (realm === undefined || snapshot === undefined) return;

      panel.open(realmHtml(realm, snapshot), group as unknown as HTMLElement);
    });

    function realmHtml(realm: RealmData, snapshot: SnapshotData): string {
      const rows: [string, string][] = [
        ['Era', snapshot.label],
        ['Dominant', realm.tradition],
        ['Confidence', GRADE_LABEL[realm.grade]],
      ];
      if (realm.minorities.length > 0) rows.push(['Significant minorities', realm.minorities.join(', ')]);

      const contested = realm.contested
        ? `<p class="panel__contested"><span class="contested-badge">Contested</span>` +
          `<span>${esc(realm.contested_note ?? '')}</span></p>`
        : '';

      const sources =
        realm.sources.length > 0
          ? realm.sources.map((s) => esc(data.sourceTitles[s] ?? s)).join(' · ')
          : snapshot.fixture
            ? 'Development fixture. Not a historical claim, and not published.'
            : 'Awaiting a source check.';

      return (
        `<div class="panel__meta"><span>` +
        `<svg width="14" height="14" viewBox="0 0 24 24" style="color:var(--t-${realm.tradition})"` +
        ` aria-hidden="true"><use href="#symbol-${realm.tradition}"></use></svg>` +
        `${esc(realm.tradition)}</span></div>` +
        `<h2 id="panel-title">${esc(realm.name)}</h2>` +
        `<div class="panel__rule" aria-hidden="true"><i></i><b></b><i></i></div>` +
        `<div class="panel__label"><span class="eyebrow">Exhibit label</span>` +
        rows
          .map(
            ([k, v]) =>
              `<div class="panel__row"><span>${esc(k)}</span><span class="mono">${esc(v)}</span></div>`,
          )
          .join('') +
        `</div>` +
        contested +
        (realm.note ? `<p class="panel__body">${esc(realm.note)}</p>` : '') +
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
    writeUrl(true);
  }
}
