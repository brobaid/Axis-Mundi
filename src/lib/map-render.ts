import { ERA_SNAPSHOTS } from './eras';

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
export type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

const ringPath = (ring: Ring, f: Frame): string =>
  ring
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

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

export function renderSnapshot(snapshot: SnapshotView, f: Frame, active: boolean): string {
  const realms = snapshot.realms
    .map((realm) => {
      const fill = realm.grade === 'c' ? `url(#hatch-${realm.tradition})` : `var(--t-${realm.tradition})`;
      return (
        `<g class="map-realm ${gradeClass(realm.grade)}" data-realm="${esc(realm.id)}"` +
        ` data-snapshot="${esc(snapshot.id)}">` +
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

/** The cartouche: the engraved title plate an atlas carries in a corner. */
function cartouche(title: string, era: string, fixture: boolean): string {
  return (
    `<g class="map-cartouche" transform="translate(24 24)" aria-hidden="true">` +
    `<rect class="map-cartouche__plate" x="0" y="0" width="214" height="66" rx="2"/>` +
    `<rect class="map-cartouche__inner" x="5" y="5" width="204" height="56" rx="1"/>` +
    `<text class="map-cartouche__title" x="107" y="28" text-anchor="middle">${esc(title)}</text>` +
    `<text class="map-cartouche__era" x="107" y="48" text-anchor="middle">${esc(era)}</text>` +
    (fixture
      ? `<text class="map-cartouche__fixture" x="107" y="61" text-anchor="middle">FIXTURE DATA</text>`
      : '') +
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
}

export function renderMap(
  snapshots: readonly SnapshotView[],
  f: Frame,
  options: CanvasOptions,
): string {
  const active = snapshots.find((s) => s.era === options.activeEra) ?? snapshots[0];
  const anyFixture = snapshots.some((s) => s.fixture);

  return (
    `<svg class="map-svg" viewBox="0 0 ${f.width} ${f.height}"` +
    ` preserveAspectRatio="xMidYMid meet" role="img"` +
    ` aria-label="Historical world map, ${esc(active?.label ?? '')}">` +
    `<defs>${hatchDefs(options.traditions)}</defs>` +
    /* Ocean first, then land, then the graticule over both: the plate order. */
    `<rect class="map-ocean" x="0" y="0" width="${f.width}" height="${f.height}"/>` +
    graticule(f) +
    `<g class="map-snapshots">` +
    snapshots.map((s) => renderSnapshot(s, f, s.era === options.activeEra)).join('') +
    `</g>` +
    cartouche(options.title, active?.label ?? '', anyFixture) +
    compass(f) +
    /* The engraved frame sits on top, so nothing bleeds past the plate edge. */
    `<rect class="map-frame-outer" x="1" y="1" width="${f.width - 2}" height="${f.height - 2}"/>` +
    `<rect class="map-frame-inner" x="7" y="7" width="${f.width - 14}" height="${f.height - 14}"/>` +
    `</svg>`
  );
}
