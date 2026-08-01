import { createPanel, esc } from '../lib/panel';
import { eraLabel } from '../lib/map-render';
import { revealDetent, standMeridian } from '../lib/scrubber';
import { CURSOR_PARAM, readCursor, snapToDetent } from '../lib/cursor';
import { nearestRealm, realmViewBox } from '../lib/nearest-realm';

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

interface SiteData {
  name: string;
  place?: string;
  tradition: string;
  significance: string;
  sources: string[];
}

interface Bootstrap {
  snapshots: SnapshotData[];
  detents: { era: number; label: string; available: boolean }[];
  sourceTitles: Record<string, string>;
  traditionNames: Record<string, string>;
  sites: Record<string, SiteData>;
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
    /* Every detent is reachable: an undelivered era draws the plate's furniture
       and says what it awaits, which beats a dead stop with no explanation. */
    const withData = data.detents;
    /* The last delivered era, matching what the page server-rendered. Taking
       the first would have the island snap the room back to antiquity on load
       the moment a second snapshot landed. */
    const delivered = data.detents.filter((d) => d.available);
    let activeEra =
      delivered[delivered.length - 1]?.era ?? data.detents[data.detents.length - 1]?.era ?? 2020;

    const panel = createPanel();

    /* ── URL state, shared with the rest of the site ─────────────────── */

    function readUrl(): void {
      const year = readCursor(location.search);
      if (year === null) return;
      /* An exact detent is taken as given; anything else snaps back to the
         plate that covers it, because the map has twelve and not five
         thousand. */
      const snapped = data.detents.some((d) => d.era === year)
        ? year
        : snapToDetent(year, data.detents.map((d) => d.era));
      if (snapped !== null) activeEra = snapped;
    }

    function writeUrl(replace = false): void {
      const q = new URLSearchParams(location.search);
      /* The snapped detent, so the cursor round-trips: a reader who arrives on
         1100 and leaves for the tree takes 1000, the plate they actually saw. */
      q.delete('era');
      q.set(CURSOR_PARAM, String(activeEra));
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
        /* A hidden layer's realms must leave the tab order too, or a reader
           tabs through 175 invisible controls. */
        for (const realm of layer.querySelectorAll<SVGGElement>('[data-realm]')) {
          realm.setAttribute('tabindex', on ? '0' : '-1');
        }
      }

      for (const btn of rail!.querySelectorAll<HTMLButtonElement>('[data-era]')) {
        const era = Number(btn.dataset['era']);
        const on = era === activeEra;
        btn.setAttribute('aria-checked', String(on));
        btn.tabIndex = on ? 0 : -1;
        btn.classList.toggle('scrub__detent--on', on);
        if (on) revealDetent(rail!, btn);
      }

      const snapshot = data.snapshots.find((s) => s.era === activeEra);
      if (readout !== null) {
        readout.textContent =
          snapshot === undefined
            ? `${eraLabel(activeEra)} · awaiting the owner's research memo`
            : `${snapshot.label} · ${snapshot.realms.length} realms`;
      }
      const awaiting = root!.querySelector<HTMLElement>('[data-map-awaiting]');
      if (awaiting !== null) awaiting.hidden = snapshot !== undefined;

      /* The era note belongs to its plate, so it scrubs with it. An era with no
         note shows none rather than the previous era's. */
      for (const note of root!.querySelectorAll<HTMLElement>('[data-era-note]')) {
        note.hidden = Number(note.dataset['eraNote']) !== activeEra;
      }

      /* The cartouche is the plate's own label, so it has to follow the scrub —
         otherwise an undelivered era sits under the title of a delivered one. */
      const cartoucheEra = canvas!.querySelector<SVGTextElement>('[data-cartouche-era]');
      if (cartoucheEra !== null) {
        cartoucheEra.textContent = snapshot?.label ?? eraLabel(activeEra);
      }
      const cartoucheNote = canvas!.querySelector<SVGTextElement>('[data-cartouche-awaiting]');
      if (cartoucheNote !== null) {
        if (snapshot === undefined) cartoucheNote.removeAttribute('visibility');
        else cartoucheNote.setAttribute('visibility', 'hidden');
      }

      standMeridian(
        root!.querySelector<HTMLElement>('[data-map-meridian]'),
        rail!.querySelector<HTMLElement>(`[data-era="${activeEra}"]`),
      );
    }

    function setEra(era: number, push = true): void {
      /* Every detent is selectable now that fixtures are gone: choosing an
         undelivered era shows an empty plate that says what it awaits, which is
         more honest than a stop the reader cannot reach and no explanation. */
      if (!data.detents.some((d) => d.era === era)) return;
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
       An undelivered era is reachable and states what it awaits. */
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

    canvas.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const group = (ev.target as Element).closest<SVGGElement>('[data-realm]');
      if (group === null) return;
      ev.preventDefault();
      group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    /** Open a realm's sheet from its group element. */
    function openRealm(group: SVGGElement): void {
      if (panel === null) return;
      const realmId = group.dataset['realm'];
      const snapshotId = group.dataset['snapshot'];
      const snapshot = data.snapshots.find((s) => s.id === snapshotId);
      const realm = snapshot?.realms.find((r) => r.id === realmId);
      if (realm === undefined || snapshot === undefined) return;
      panel.open(realmHtml(realm, snapshot), group as unknown as HTMLElement);
    }

    /* Coarse pointers get tap resolution; a mouse is precise enough already,
       and putting a confirm step in front of a click that already landed would
       be an extra tap for nothing. */
    const coarse = window.matchMedia('(pointer: coarse)');

    canvas.addEventListener('click', (ev) => {
      const direct = (ev.target as Element).closest<SVGGElement>('[data-realm]');

      if (!coarse.matches) {
        if (direct !== null) openRealm(direct);
        return;
      }

      /* On touch the tap point is a fingertip, not a pixel. Search outward for
         the realm the reader most likely meant. */
      const layer = canvas!.querySelector<SVGGElement>('.map-snapshot:not([aria-hidden])');
      if (layer === null) {
        if (direct !== null) openRealm(direct);
        return;
      }

      const hit = nearestRealm((ev as MouseEvent).clientX, (ev as MouseEvent).clientY, {
        within: layer,
      });
      if (hit === null) {
        dismissChip();
        return;
      }

      const group = hit.group as SVGGElement;

      /* A second tap on the same candidate commits. Anything else re-aims. */
      if (chipFor === group.dataset['realm']) {
        dismissChip();
        openRealm(group);
        return;
      }
      showChip(group, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
    });

    /* ── the sacred sites layer ──────────────────────────────────────── */

    /**
     * Off by default, and never scrubbed.
     *
     * The plate answers "what did this realm practise in this era". A site
     * answers "where does this tradition stand", which has no era: the Western
     * Wall is on the 500 BCE plate and the 2020 one. Showing it always is the
     * honest reading; showing it only after its building would invent a
     * chronology the site records do not carry.
     */
    const sitesLayerEl = canvas.querySelector<SVGGElement>('[data-sites]');
    const sitesBtn = root.querySelector<HTMLButtonElement>('[data-sites-toggle]');

    /** One site's card. */
    function siteCard(id: string): string {
      const site = data.sites[id];
      if (site === undefined) return '';
      const tradition = data.traditionNames[site.tradition] ?? site.tradition;
      const sources =
        site.sources.length > 0
          ? site.sources.map((x) => esc(data.sourceTitles[x] ?? x)).join(' · ')
          : 'Awaiting a source check.';
      return (
        `<p class="eyebrow">Sacred site · ${esc(tradition)}</p>` +
        `<h2>${esc(site.name)}</h2>` +
        (site.place === undefined ? '' : `<p class="mono caption">${esc(site.place)}</p>`) +
        `<p>${esc(site.significance)}</p>` +
        `<p class="caption">Source: ${sources}</p>` +
        `<p><a class="tap" href="/traditions/${esc(site.tradition)}">` +
        `Open the ${esc(tradition)} dive &rarr;</a></p>`
      );
    }

    /**
     * A mark that stands for several sites opens the list, not a guess.
     *
     * Jerusalem carries four of these within a few hundred metres. Picking one
     * for the reader would make the other three unreachable, which is exactly
     * what stacking them did.
     */
    function openSite(group: SVGGElement): void {
      if (panel === null) return;
      const ids = (group.dataset['site'] ?? '').split(',').filter((x) => x !== '');
      const first = ids[0];
      if (first === undefined) return;
      if (ids.length === 1) {
        panel.open(siteCard(first), group as unknown as HTMLElement);
        return;
      }
      const rows = ids
        .map((id) => {
          const s = data.sites[id];
          if (s === undefined) return '';
          return (
            `<li><button type="button" class="map-site-row" data-site-pick="${esc(id)}">` +
            `<b>${esc(s.name)}</b>` +
            (s.place === undefined ? '' : `<span class="caption"> · ${esc(s.place)}</span>`) +
            `</button></li>`
          );
        })
        .join('');
      /* Only name a place all of them share. Masada is an hour from Jerusalem
         and half a plate unit away; heading its card "Jerusalem" would be the
         map inventing a geography to tidy its own clustering. */
      const places = new Set(ids.map((id) => data.sites[id]?.place).filter((x) => x !== undefined));
      const heading = places.size === 1 ? [...places][0] : 'Too close to draw apart';
      panel.open(
        `<p class="eyebrow">${ids.length} sacred sites here</p>` +
          `<h2>${esc(heading ?? '')}</h2>` +
          `<p class="caption">The plate cannot separate them at this scale; each is its own record.</p>` +
          `<ul class="map-site-list" role="list">${rows}</ul>`,
        group as unknown as HTMLElement,
      );
    }

    /* Choosing a site from the cluster list swaps the card in place. */
    document.addEventListener('click', (ev) => {
      const pick = (ev.target as Element).closest<HTMLElement>('[data-site-pick]');
      if (pick === null || panel === null) return;
      panel.open(siteCard(pick.dataset['sitePick'] ?? ''), null);
    });

    if (sitesLayerEl !== null && sitesBtn !== null) {
      sitesBtn.addEventListener('click', () => {
        const on = sitesBtn.getAttribute('aria-pressed') === 'true';
        sitesBtn.setAttribute('aria-pressed', String(!on));
        /* SVGGElement has no `hidden` IDL property; the attribute still works. */
        if (on) sitesLayerEl.setAttribute('hidden', '');
        else sitesLayerEl.removeAttribute('hidden');
        /* Hidden marks must leave the tab order, not merely the eye. */
        for (const g of sitesLayerEl.querySelectorAll<SVGGElement>('[data-site]')) {
          g.tabIndex = on ? -1 : 0;
        }
      });

      /**
       * The nearest mark to a tap that missed.
       *
       * At 390px the whole plate is 358px wide, so a site ring is under four
       * pixels across — smaller than any fingertip and smaller than the realms
       * the map already resolves by proximity. Same rule as the realms and the
       * year wheel: within 44px, the reader meant it.
       */
      const NEAR_PX = 44;
      function nearestSite(cx: number, cy: number): SVGGElement | null {
        let best: SVGGElement | null = null;
        let bestD = Infinity;
        for (const g of sitesLayerEl!.querySelectorAll<SVGGElement>('[data-site]')) {
          const r = g.querySelector('.map-site__ring')?.getBoundingClientRect();
          if (r === undefined) continue;
          const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
          if (d < bestD) {
            bestD = d;
            best = g;
          }
        }
        return bestD <= NEAR_PX ? best : null;
      }

      /* Sites sit above the realms, so their taps are caught first and never
         reach the realm handler's nearest-realm search. */
      canvas.addEventListener(
        'click',
        (ev) => {
          if (sitesLayerEl.hasAttribute('hidden')) return;
          const direct = (ev.target as Element).closest<SVGGElement>('[data-site]');
          const g = direct ?? nearestSite((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
          if (g === null) return;
          ev.stopPropagation();
          openSite(g);
        },
        true,
      );
      sitesLayerEl.addEventListener('keydown', (ev) => {
        const key = (ev as KeyboardEvent).key;
        if (key !== 'Enter' && key !== ' ') return;
        const g = (ev.target as Element).closest<SVGGElement>('[data-site]');
        if (g === null) return;
        ev.preventDefault();
        openSite(g);
      });
    }

    /* ── the confirm chip ────────────────────────────────────────────── */

    let chipEl: HTMLElement | null = null;
    let chipFor: string | undefined;

    function dismissChip(): void {
      chipEl?.remove();
      chipEl = null;
      chipFor = undefined;
    }

    /**
     * Offer a candidate before opening it.
     *
     * The chip carries the realm's own outline, magnified — a name is not
     * enough to answer "did I mean that one?" when the reader is looking at a
     * coastline of eleven-pixel countries. Tapping it opens the sheet; tapping
     * anywhere else re-aims, and nothing has been committed in between.
     */
    function showChip(group: SVGGElement, x: number, y: number): void {
      dismissChip();
      const realmId = group.dataset['realm'];
      const snapshot = data.snapshots.find((s) => s.id === group.dataset['snapshot']);
      const realm = snapshot?.realms.find((r) => r.id === realmId);
      const path = group.querySelector<SVGPathElement>('.map-realm__fill');
      if (realm === undefined || path === null) return;

      const name = data.traditionNames[realm.tradition] ?? realm.tradition;
      const category = realm.tradition === 'unaffiliated' ? 'Religiously unaffiliated' : name;
      const fill =
        realm.grade === 'c' ? `url(#hatch-${realm.tradition})` : `var(--t-${realm.tradition})`;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'map-chip';
      chip.setAttribute('data-map-chip', '');
      chip.setAttribute(
        'aria-label',
        `${realm.name}: ${category}, confidence ${realm.grade.toUpperCase()}. Tap again to open.`,
      );
      chip.innerHTML =
        `<svg class="map-chip__shape" viewBox="${realmViewBox(path.getBBox())}" aria-hidden="true">` +
        `<path d="${path.getAttribute('d') ?? ''}" fill="${fill}"` +
        ` stroke="var(--t-${esc(realm.tradition)})" stroke-width="0.6"` +
        ` vector-effect="non-scaling-stroke"/></svg>` +
        `<span class="map-chip__text"><b>${esc(realm.name)}</b>` +
        `<i>${esc(category)} · ${realm.grade.toUpperCase()}</i></span>`;

      /* The chip lives beside the plate rather than inside it, so it needs its
         own commit handler — a tap here never reaches the canvas listener. */
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissChip();
        openRealm(group);
      });

      root!.appendChild(chip);
      chipEl = chip;
      chipFor = realmId;

      /* Above the finger, so the chip is not under the hand that summoned it,
         and clamped to the plate so it never leaves the room. */
      const frame = canvas!.getBoundingClientRect();
      const box = chip.getBoundingClientRect();
      const left = Math.min(
        Math.max(x - box.width / 2, frame.left + 4),
        frame.right - box.width - 4,
      );
      const above = y - box.height - 16;
      const top = above > frame.top + 4 ? above : y + 24;
      chip.style.left = `${left - frame.left + canvas!.offsetLeft}px`;
      chip.style.top = `${top - frame.top + canvas!.offsetTop}px`;
      /* preventScroll, or focusing a chip that is already under the reader's
         thumb yanks the page to it. */
      chip.focus({ preventScroll: true });
    }

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') dismissChip();
    });

    /* No scroll listener: the chip is positioned inside the room, so it travels
       with the plate and stays on its realm. Dismissal is Escape, a tap
       elsewhere, or the tap that commits. */

    function realmHtml(realm: RealmData, snapshot: SnapshotData): string {
      /* "Dominant: unaffiliated" would read as a tradition named Unaffiliated.
         The label says what the category actually asserts. */
      const isUnaffiliated = realm.tradition === 'unaffiliated';
      const rows: [string, string][] = [
        ['Era', snapshot.label],
        [isUnaffiliated ? 'Largest group' : 'Dominant',
         isUnaffiliated
           ? 'Religiously unaffiliated'
           : (data.traditionNames[realm.tradition] ?? realm.tradition)],
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

      /* There is no symbol for unaffiliated, and inventing one would make a
         category into an identity. A plain swatch carries the tone instead. */
      const mark = isUnaffiliated
        ? `<span class="swatch" style="--tradition-hue:var(--t-unaffiliated)"></span>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" style="color:var(--t-${realm.tradition})"` +
          ` aria-hidden="true"><use href="#symbol-${realm.tradition}"></use></svg>`;

      return (
        `<div class="panel__meta"><span>` + mark +
        `${esc(isUnaffiliated ? 'Unaffiliated' : (data.traditionNames[realm.tradition] ?? realm.tradition))}</span></div>` +
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
