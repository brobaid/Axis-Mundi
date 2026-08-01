import { ERA_SNAPSHOTS } from './eras';

/**
 * The family tree: descent, anchored to time where a record carries a date.
 *
 * Pure and DOM-free, like the timeline model and the map renderer, so the
 * server-rendered first paint and the island run the same arithmetic.
 *
 * The honest constraint this layout is built around: only the ten tradition
 * nodes carry a founding record. All sixty-one branch and denomination nodes
 * have an empty `founded`, so they cannot be placed on a time axis without
 * inventing dates for them. They are therefore placed by descent — stepped to
 * the right of their parent — and the page says so rather than implying that
 * their horizontal position means a year.
 */

export interface TreeNodeInput {
  readonly id: string;
  readonly name: string;
  /** The node's one sentence, and the museum's own note about it. */
  readonly summary?: string | undefined;
  readonly editorialNote?: string | undefined;
  readonly parent: string | null;
  readonly tradition: string;
  readonly path: string;
  readonly depth: number;
  readonly contested: boolean;
  readonly foundedYear: number | undefined;
  readonly foundedDisplay: string | undefined;
  readonly foundedContested: boolean;
  readonly adherentsDisplay: string | undefined;
  readonly adherentsContested: boolean;
  readonly order: number;
}

export interface TreeNode extends TreeNodeInput {
  readonly x: number;
  readonly y: number;
  /** True when x means a year; false when it only means "descends from". */
  readonly dated: boolean;
}

export interface TreeEdge {
  readonly from: string;
  readonly to: string;
  readonly path: string;
}

export interface AxisTick {
  readonly year: number;
  readonly x: number;
  readonly label: string;
  /** Which row of the axis label block this one sits in. 0 is nearest the axis. */
  readonly row: number;
}

export interface TreeLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  readonly ticks: readonly AxisTick[];
  readonly axisY: number;
  /** How many rows the axis labels needed. */
  readonly axisRows: number;
}

export const ROW_HEIGHT = 22;

/* ── the node row's own geometry ────────────────────────────────────────── */

/*
  Where a node's marks sit, relative to its dot.

  Named here rather than written into the template, because the invariant
  between them — the contested mark must end before the label begins — is the
  thing that broke: the mark used to be placed at a character count past the
  end of the label, which a proportional face does not have, and four of five
  landed wrong. Both numbers in one place means the check can hold them to it.
*/
export const CONTESTED_AT = 12;
export const CONTESTED_R = 3;
export const LABEL_AT = 10;
export const LABEL_AT_CONTESTED = 21;
export const TRADITION_GAP = 14;
const PAD_TOP = 18;

/* ── the axis labels ────────────────────────────────────────────────────── */

/**
 * The axis type, stated once and honoured in both places that depend on it.
 *
 * The tick labels are set in the mono face with tabular figures, which is what
 * makes this whole layout knowable rather than guessed: every glyph in "1850
 * CE" has the same advance, so a label's width is its character count times a
 * constant and no measurement is needed at build time. A proportional face
 * here would put us back to estimating, which is the bug this replaces.
 */
export const TICK_FONT_SIZE = 9;
/*
  0.62em, where IBM Plex Mono's own advance is 0.6. The extra hundredths are
  slack for the fallback stack: every face in it is monospaced, but monospace
  advances differ by face, and reserving slightly too much only ever widens the
  clear air between two labels. Reserving too little would put them back on top
  of each other, which is the failure this exists to prevent.
*/
export const TICK_ADVANCE = TICK_FONT_SIZE * 0.62;
export const TICK_ROW_HEIGHT = 12;
/** Clear air between two labels in the same row. */
const TICK_GAP = 6;

export const tickWidth = (label: string): number => label.length * TICK_ADVANCE;

/**
 * Give every axis label a row it does not collide in.
 *
 * The era detents are not evenly spaced in time and the axis is linear, so the
 * last five of them fall inside the last eighth of the axis: measured, eight of
 * eleven adjacent pairs overlapped, the worst by thirty-three units, which is
 * most of a label. Dropping labels is not available — each one is a stop the
 * slider offers, and a stop with no legend is a stop nobody can aim at.
 *
 * So they stack, on the timeline's discipline: a label takes the topmost row
 * where it clears whatever was last placed there. Greedy over a sorted list,
 * which makes "no two labels in a row overlap" true by construction rather
 * than by a check afterwards — there is no ordering of inputs that can defeat
 * it, and `axisRows` then says how much room the block actually needs.
 */
export function layoutTicks(
  ticks: readonly { year: number; x: number; label: string }[],
): AxisTick[] {
  /* Each label is centred on its tick, so its box starts half a width left. */
  const sorted = [...ticks].sort((a, b) => a.x - b.x);
  const rowEnds: number[] = [];
  return sorted.map((tick) => {
    const half = tickWidth(tick.label) / 2;
    const left = tick.x - half;
    let row = rowEnds.findIndex((end) => left >= end + TICK_GAP);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = tick.x + half;
    return { ...tick, row };
  });
}

/** The dated span the axis covers, rounded out to whole millennia. */
export const treeWindow = (
  nodes: readonly TreeNodeInput[],
): { from: number; to: number } => {
  /* The axis ends at the last era detent, not at a round 2000, or the final
     detent falls outside the window and the slider quietly loses its last stop. */
  const to = ERA_SNAPSHOTS[ERA_SNAPSHOTS.length - 1] ?? 2020;
  const years = nodes.map((n) => n.foundedYear).filter((y): y is number => y !== undefined);
  if (years.length === 0) return { from: -2000, to };
  return { from: Math.floor(Math.min(...years) / 500) * 500, to };
};

const yearLabel = (y: number): string =>
  y < 0 ? `${Math.abs(y)} BCE` : y === 0 ? '1 BCE' : `${y} CE`;

/**
 * Lay the tree out.
 *
 * `datedWidth` is the share of the canvas the time axis occupies; the remainder
 * carries the undated descent columns, so a branch can never be mistaken for a
 * point on the axis — everything to the right of the axis is explicitly off it.
 */
export function layoutTree(
  input: readonly TreeNodeInput[],
  width: number,
  traditionOrder: readonly string[],
): TreeLayout {
  const window = treeWindow(input);
  const datedWidth = Math.round(width * 0.46);
  const stepWidth = Math.round((width - datedWidth) / 3);

  const xOfYear = (year: number): number =>
    ((year - window.from) / (window.to - window.from)) * datedWidth;

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  let y = PAD_TOP;

  for (const tradition of traditionOrder) {
    const family = input.filter((n) => n.tradition === tradition);
    if (family.length === 0) continue;
    const root = family.find((n) => n.depth === 1);
    if (root === undefined) continue;

    const rootY = y;
    const rootX = root.foundedYear === undefined ? 0 : xOfYear(root.foundedYear);
    nodes.push({ ...root, x: rootX, y: rootY, dated: root.foundedYear !== undefined });

    /* Depth 2 and 3 walk down the rows in declared order, stepped right by
       depth. A child's row is its own; the parent's edge elbows down to it. */
    const walk = (parentId: string, depth: number): void => {
      const children = family
        .filter((n) => n.parent === parentId && n.depth === depth)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      for (const child of children) {
        y += ROW_HEIGHT;
        const x = datedWidth + stepWidth * (depth - 2) + 30;
        nodes.push({ ...child, x, y, dated: false });
        edges.push({
          from: parentId,
          to: child.id,
          path: '',
        });
        walk(child.id, depth + 1);
      }
    };
    walk(root.id, 2);
    y += TRADITION_GAP;
  }

  /* Elbow connectors, resolved once every node has a position. */
  const at = new Map(nodes.map((n) => [n.id, n]));
  const routed: TreeEdge[] = edges.map((e) => {
    const a = at.get(e.from);
    const b = at.get(e.to);
    if (a === undefined || b === undefined) return e;
    const mid = a.x + 14;
    return {
      ...e,
      path: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${mid.toFixed(1)} ${a.y.toFixed(1)} ` +
        `L${mid.toFixed(1)} ${b.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
    };
  });

  const ticks = layoutTicks(
    ERA_SNAPSHOTS.filter((era) => era >= window.from && era <= window.to).map((era) => ({
      year: era,
      x: xOfYear(era),
      label: yearLabel(era),
    })),
  );
  /* The axis block is as tall as the stacking actually needed, so a canvas
     never reserves room for rows that are not there or clips rows that are. */
  const axisRows = ticks.reduce((max, t) => Math.max(max, t.row + 1), 1);
  const axisY = y + 6;
  const height = axisY + 6 + axisRows * TICK_ROW_HEIGHT;

  return { width, height, nodes, edges: routed, ticks, axisY, axisRows };
}

/** The detents the era slider offers, and the window they sit in. */
export const treeDetents = (nodes: readonly TreeNodeInput[]): number[] => {
  const window = treeWindow(nodes);
  return ERA_SNAPSHOTS.filter((era) => era >= window.from && era <= window.to);
};

/**
 * Whether a node exists by a given year.
 *
 * A tradition answers from its own founding record. A branch has no date, so it
 * answers from its tradition's — the only honest claim available is that it
 * cannot predate the tradition it descends from.
 */
export function existsBy(node: TreeNode, year: number, rootYearOf: (t: string) => number | undefined): boolean {
  const own = node.foundedYear ?? rootYearOf(node.tradition);
  return own === undefined || own <= year;
}
