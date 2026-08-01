import { ERA_SNAPSHOTS } from './eras';
import { esc } from './escape';

/** A: well-documented. B: scholarly estimate. C: speculative, hatched. */
export type ConfidenceGrade = 'a' | 'b' | 'c';

/**
 * The map canvas: projection, geometry and SVG markup.
 *
 * Custom SVG rather than a tiling library. The map draws a dozen fixed
 * snapshots of hand-authored polygons, never a zoomable slippy surface, so a
 * tile engine would carry a great deal of machinery for none of the job — and
 * the antique-atlas treatment (engraved frame, cartouche, compass, curved
 * lettering with paper halos) is the point rather than a skin over someone
 * else's renderer.
 *
 * Pure and DOM-free, like the timeline model: this runs at build time for the
 * server-rendered first paint and in the island for every scrub.
 */

/* ── projection ─────────────────────────────────────────────────────────── */

export interface Frame {
  readonly width: number;
  readonly height: number;
  /** Degrees of longitude at the left edge. */
  readonly lon0: number;
  readonly lon1: number;
  readonly lat0: number;
  readonly lat1: number;
}

/**
 * Equirectangular. Chosen deliberately: it is the projection an engraved plate
 * atlas of this style actually used, it distorts predictably, and it inverts in
 * one line for hit-testing. Nothing here needs conformality.
 */
export const DEFAULT_FRAME: Frame = {
  width: 1000,
  height: 500,
  lon0: -170,
  lon1: 190,
  lat0: 83,
  lat1: -57,
};

export const project = (lon: number, lat: number, f: Frame): [number, number] => [
  ((lon - f.lon0) / (f.lon1 - f.lon0)) * f.width,
  ((f.lat0 - lat) / (f.lat0 - f.lat1)) * f.height,
];

/* ── geometry ───────────────────────────────────────────────────────────── */

type Ring = [number, number][];

/**
 * A ring that straddles the antimeridian, shifted to one side of it.
 *
 * The frame's seam sits at -170. A ring holding points at both -180 and +180 —
 * Russia's mainland and Fiji each have one — projects with one end off the left
 * edge and the other at the right, drawing the ring as a band straight across
 * the plate. Shifting its western points a full turn east makes it contiguous.
 *
 * The decision is per ring, never per point. Wrapping each coordinate on its own
 * looks equivalent and is not: Alaska's ring runs -179 to -130 without
 * straddling anything, and moving only its westernmost points would tear it
 * across the whole plate — which is exactly what a first attempt at this did.
 * A ring is either wholly shifted or wholly left alone.
 */
const unwrapRing = (ring: Ring): Ring => {
  let min = Infinity;
  let max = -Infinity;
  for (const [lon] of ring) {
    if (lon < min) min = lon;
    if (lon > max) max = lon;
  }
  if (max - min <= 180) return ring;
  return ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]);
};
export type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

const ringPath = (raw: Ring, f: Frame): string =>
  unwrapRing(raw)
    .map(([lon, lat], i) => {
      const [x, y] = project(lon, lat, f);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';

export function geometryPath(geometry: Geometry, f: Frame): string {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ringPath(ring, f)).join(' ');
  }
  return geometry.coordinates
    .map((polygon) => polygon.map((ring) => ringPath(ring, f)).join(' '))
    .join(' ');
}

/* ── the twelve detents (spec §6) ───────────────────────────────────────── */

export interface Detent {
  readonly era: number;
  readonly label: string;
  /** Whether a snapshot exists for this year in the current build. */
  readonly available: boolean;
}

export const eraLabel = (year: number): string =>
  year < 0 ? `${Math.abs(year)} BCE` : year === 1 ? '1 CE' : String(year);

export const detents = (available: ReadonlySet<number>): Detent[] =>
  ERA_SNAPSHOTS.map((era) => ({ era, label: eraLabel(era), available: available.has(era) }));

/* ── rendering ──────────────────────────────────────────────────────────── */

export interface Realm {
  readonly id: string;
  readonly name: string;
  readonly tradition: string;
  readonly grade: ConfidenceGrade;
  readonly geometry: Geometry;
  readonly labelAnchor?: [number, number] | undefined;
  readonly labelCurve: number;
  readonly contested: boolean;
}

export interface SnapshotView {
  readonly id: string;
  readonly era: number;
  readonly label: string;
  readonly fixture: boolean;
  readonly realms: readonly Realm[];
}

/** Graticule every 30° of longitude, 20° of latitude. */
export function graticule(f: Frame): string {
  const lines: string[] = [];
  for (let lon = Math.ceil(f.lon0 / 30) * 30; lon <= f.lon1; lon += 30) {
    const [x] = project(lon, 0, f);
    lines.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${f.height}"/>`);
  }
  for (let lat = Math.floor(f.lat0 / 20) * 20; lat >= f.lat1; lat -= 20) {
    const [, y] = project(0, lat, f);
    lines.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${f.width}" y2="${y.toFixed(1)}"/>`);
  }
  return `<g class="map-graticule" aria-hidden="true">${lines.join('')}</g>`;
}

/**
 * A realm's curved label. The text rides an arc so the lettering follows the
 * land the way engraved plates set their region names, and it carries a paper
 * halo — a stroke in the land tone painted behind the glyphs — so it stays
 * legible over a hatched or tinted fill.
 */
function realmLabel(realm: Realm, f: Frame, snapshotId: string): string {
  if (realm.labelAnchor === undefined) return '';
  const [lon, lat] = realm.labelAnchor;
  const [x, y] = project(lon, lat, f);

  const halfWidth = Math.max(46, realm.name.length * 4.6);
  const bend = realm.labelCurve;
  const pathId = `label-${snapshotId}-${realm.id}`;

  /* A quadratic arc through the anchor, bending by label_curve. */
  const d =
    `M${(x - halfWidth).toFixed(1)} ${y.toFixed(1)} ` +
    `Q${x.toFixed(1)} ${(y - bend).toFixed(1)} ${(x + halfWidth).toFixed(1)} ${y.toFixed(1)}`;

  return (
    `<path id="${pathId}" d="${d}" fill="none" aria-hidden="true"/>` +
    `<text class="map-label" aria-hidden="true">` +
    `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${esc(realm.name)}</textPath>` +
    `</text>`
  );
}

/**
 * Confidence grades (design language §3.3): A solid, B reduced opacity,
 * C hatched. The hatch is the same drafting convention the timeline and the
 * matrix use for contested material.
 */
const gradeClass = (grade: ConfidenceGrade): string => `map-realm--${grade}`;

export function renderSnapshot(
  snapshot: SnapshotView,
  f: Frame,
  active: boolean,
  names: Readonly<Record<string, string>> = {},
): string {
  const realms = snapshot.realms
    .map((realm) => {
      const fill = realm.grade === 'c' ? `url(#hatch-${realm.tradition})` : `var(--t-${realm.tradition})`;
      /* A realm is a control, so it is reachable and named. The label carries
         the same three facts the eye gets from the fill and the card: which
         country, which category, how confident. */
      /* The display name, not the id: the card beside this realm reads
         "Chinese traditions" where the id reads "chinese", and a label that
         disagrees with the card is a label that lied about carrying the same
         facts. */
      const category =
        realm.tradition === 'unaffiliated'
          ? 'religiously unaffiliated'
          : (names[realm.tradition] ?? realm.tradition);
      const label = `${realm.name}: ${category}, confidence ${realm.grade.toUpperCase()}`;
      return (
        `<g class="map-realm ${gradeClass(realm.grade)}" data-realm="${esc(realm.id)}"` +
        ` data-snapshot="${esc(snapshot.id)}" tabindex="${active ? 0 : -1}" role="button"` +
        ` aria-label="${esc(label)}">` +
        `<path class="map-realm__fill" d="${geometryPath(realm.geometry, f)}" fill="${fill}"` +
        ` stroke="var(--t-${realm.tradition})"/>` +
        realmLabel(realm, f, snapshot.id) +
        `</g>`
      );
    })
    .join('');

  return (
    `<g class="map-snapshot" data-era="${snapshot.era}" data-snapshot-id="${esc(snapshot.id)}"` +
    ` style="opacity:${active ? 1 : 0}" ${active ? '' : 'aria-hidden="true"'}>` +
    realms +
    `</g>`
  );
}

/** Hatch patterns, one per tradition hue, for grade C. */
function hatchDefs(traditions: readonly string[]): string {
  return traditions
    .map(
      (t) =>
        `<pattern id="hatch-${t}" patternUnits="userSpaceOnUse" width="6" height="6"` +
        ` patternTransform="rotate(45)">` +
        `<rect width="6" height="6" fill="var(--land)"/>` +
        `<line x1="0" y1="0" x2="0" y2="6" stroke="var(--t-${t})" stroke-width="2.5"/>` +
        `</pattern>`,
    )
    .join('');
}

/**
 * The cartouche: the engraved title plate an atlas carries in a corner.
 *
 * `awaiting` is the state an undelivered era carries. The map used to fill those
 * detents with fixture rectangles; it now says the snapshot has not been
 * researched yet, because scaffolding on a plate that reads as an atlas is
 * invented history whatever the label above it says.
 */
function cartouche(title: string, era: string, awaiting: boolean): string {
  return (
    `<g class="map-cartouche" transform="translate(24 24)" aria-hidden="true">` +
    `<rect class="map-cartouche__plate" x="0" y="0" width="214" height="66" rx="2"/>` +
    `<rect class="map-cartouche__inner" x="5" y="5" width="204" height="56" rx="1"/>` +
    `<text class="map-cartouche__title" x="107" y="28" text-anchor="middle">${esc(title)}</text>` +
    `<text class="map-cartouche__era" x="107" y="48" text-anchor="middle" data-cartouche-era>${esc(era)}</text>` +
    `<text class="map-cartouche__fixture" x="107" y="61" text-anchor="middle" data-cartouche-awaiting` +
    `${awaiting ? '' : ' visibility="hidden"'}>AWAITING RESEARCH MEMO</text>` +
    `</g>`
  );
}

/** A line-art compass rose on the same 1.5px stroke grid as the symbol set. */
function compass(f: Frame): string {
  const cx = f.width - 54;
  const cy = f.height - 54;
  return (
    `<g class="map-compass" aria-hidden="true" transform="translate(${cx} ${cy})">` +
    `<circle r="26" class="map-compass__ring"/>` +
    `<circle r="19" class="map-compass__ring"/>` +
    `<path class="map-compass__needle" d="M0 -24 L6 0 L0 24 L-6 0 Z"/>` +
    `<path class="map-compass__cross" d="M-24 0 H24 M0 -24 V24"/>` +
    `<text class="map-compass__n" y="-30" text-anchor="middle">N</text>` +
    `</g>`
  );
}

export interface CanvasOptions {
  readonly title: string;
  readonly activeEra: number;
  readonly traditions: readonly string[];
  /** Display names by id. The label must say what the card says. */
  readonly traditionNames: Readonly<Record<string, string>>;
  /** Sacred sites, drawn above every era fill. */
  readonly sites?: readonly SiteMark[] | undefined;
}

/** One sacred site on the plate — Phase 3 delighter B. */
export interface SiteMark {
  readonly id: string;
  readonly name: string;
  readonly place?: string | undefined;
  readonly tradition: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * The sites layer.
 *
 * Drawn once, above every snapshot, and never scrubbed. A site is a place, not
 * a claim about an era: the Western Wall stands on the 500 BCE plate and on the
 * 2020 one, and hiding it at eras before its building would be the map
 * pretending to a chronology the site records do not carry.
 *
 * The vocabulary is the plate's own: an engraved open ring with a centre point,
 * in the tradition's hue, drawn the way an atlas marks a settlement — never a
 * pin, which belongs to a different kind of map entirely.
 */
/**
 * Sites nearer than this on the plate are one mark.
 *
 * At world scale a degree of longitude is under three plate units, and the
 * Western Wall, Al-Aqsa, the Holy Sepulchre and the Mount of Olives sit within
 * two hundredths of a degree of one another: drawn separately they stack
 * exactly, and four of them become untappable. One mark carrying a count is
 * both truer to the plate and the only way each record stays reachable.
 */
const CLUSTER_UNITS = 7;

interface SiteCluster {
  readonly x: number;
  readonly y: number;
  readonly members: SiteMark[];
}

export function clusterSites(sites: readonly SiteMark[], f: Frame): SiteCluster[] {
  const out: { x: number; y: number; members: SiteMark[] }[] = [];
  for (const s of sites) {
    const [px, py] = project(s.lng, s.lat, f);
    const near = out.find((c) => Math.hypot(c.x - px, c.y - py) <= CLUSTER_UNITS);
    if (near === undefined) out.push({ x: px, y: py, members: [s] });
    else near.members.push(s);
  }
  return out;
}

function sitesLayer(sites: readonly SiteMark[], f: Frame): string {
  if (sites.length === 0) return '';
  const marks = clusterSites(sites, f)
    .map((c) => {
      const first = c.members[0];
      if (first === undefined) return '';
      const x = c.x.toFixed(1);
      const y = c.y.toFixed(1);
      const many = c.members.length > 1;
      /* A cluster takes the hue of its first member and says how many it holds;
         claiming one tradition for a shared city would be the worse lie. */
      const hue = `var(--t-${first.tradition})`;
      const label = many
        ? `${c.members.length} sacred sites: ${c.members.map((m) => m.name).join(', ')}`
        : `Sacred site: ${first.name}${first.place === undefined ? '' : `, ${first.place}`}`;
      return (
        `<g class="map-site${many ? ' map-site--many' : ''}" ` +
        `data-site="${esc(c.members.map((m) => m.id).join(','))}" tabindex="-1" role="button" ` +
        `aria-label="${esc(label)}">` +
        `<circle class="map-site__hit" cx="${x}" cy="${y}" r="14"/>` +
        `<circle class="map-site__ring" cx="${x}" cy="${y}" r="${many ? 7 : 5}" stroke="${hue}"/>` +
        (many
          ? `<text class="map-site__count" x="${x}" y="${(c.y + 2.6).toFixed(1)}" ` +
            `text-anchor="middle">${c.members.length}</text>`
          : `<circle class="map-site__pip" cx="${x}" cy="${y}" r="1.6" fill="${hue}"/>`) +
        `</g>`
      );
    })
    .join('');
  return `<g class="map-sites" data-sites hidden>${marks}</g>`;
}

/**
 * The land silhouette, beneath every snapshot layer.
 *
 * At 2020 the shaded realms cover nearly all land, so the plate reads as a
 * world map whether or not land is drawn. At 1 CE fifteen realms float in an
 * ocean, and without a coastline a reader cannot tell the Deccan from the
 * Yellow Sea. Worse, it makes the era's own note false: "the land tone is not
 * emptiness" only means something if there is a land tone.
 *
 * The geometry is the most complete delivered snapshot's, drawn as one
 * silhouette in the land tone with no internal borders and no interactivity —
 * a modern coastline under historical shading, which is what an atlas does.
 * It carries no tradition and makes no claim beyond "here was land".
 */
function landBase(snapshots: readonly SnapshotView[], f: Frame): string {
  const source = snapshots.reduce<SnapshotView | null>(
    (best, s) => (best === null || s.realms.length > best.realms.length ? s : best),
    null,
  );
  if (source === null) return '';
  return (
    `<g class="map-land" aria-hidden="true">` +
    source.realms.map((r) => `<path d="${geometryPath(r.geometry, f)}"/>`).join('') +
    `</g>`
  );
}

export function renderMap(
  snapshots: readonly SnapshotView[],
  f: Frame,
  options: CanvasOptions,
): string {
  const active = snapshots.find((s) => s.era === options.activeEra) ?? snapshots[0];
  /* The chosen era has no snapshot: the plate draws its furniture and nothing
     else, and the cartouche says why. */
  const awaiting = snapshots.every((s) => s.era !== options.activeEra);

  return (
    `<svg class="map-svg" viewBox="0 0 ${f.width} ${f.height}"` +
    ` preserveAspectRatio="xMidYMid meet" role="img"` +
    ` aria-label="Historical world map, ${esc(active?.label ?? '')}">` +
    `<defs>${hatchDefs(options.traditions)}</defs>` +
    /* Ocean first, then land, then the graticule over both: the plate order. */
    `<rect class="map-ocean" x="0" y="0" width="${f.width}" height="${f.height}"/>` +
    landBase(snapshots, f) +
    graticule(f) +
    `<g class="map-snapshots">` +
    snapshots
      .map((s) => renderSnapshot(s, f, s.era === options.activeEra, options.traditionNames))
      .join('') +
    `</g>` +
    /* Above the fills, below the plate furniture: a landmark, not a realm. */
    sitesLayer(options.sites ?? [], f) +
    cartouche(options.title, awaiting ? eraLabel(options.activeEra) : (active?.label ?? ''), awaiting) +
    compass(f) +
    /* The engraved frame sits on top, so nothing bleeds past the plate edge. */
    `<rect class="map-frame-outer" x="1" y="1" width="${f.width - 2}" height="${f.height - 2}"/>` +
    `<rect class="map-frame-inner" x="7" y="7" width="${f.width - 14}" height="${f.height - 14}"/>` +
    `</svg>`
  );
}
