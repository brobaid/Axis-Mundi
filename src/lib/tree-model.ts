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

export interface TreeLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  readonly ticks: readonly { readonly year: number; readonly x: number; readonly label: string }[];
  readonly axisY: number;
}

export const ROW_HEIGHT = 22;
export const TRADITION_GAP = 14;
const AXIS_H = 26;
const PAD_TOP = 18;

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

  const height = y + AXIS_H;
  const ticks = ERA_SNAPSHOTS.filter((era) => era >= window.from && era <= window.to).map(
    (era) => ({ year: era, x: xOfYear(era), label: yearLabel(era) }),
  );

  return { width, height, nodes, edges: routed, ticks, axisY: y + 6 };
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
