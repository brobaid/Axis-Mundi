import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

/**
 * Content access with the sourcing gate applied.
 *
 * CLAUDE.md hard rule 2: content that is not yet source-checked is marked
 * `sourcing: "todo"` and "excluded from builds by default". This module is the
 * single place that gate is enforced, so no page can bypass it by accident.
 *
 * Set INCLUDE_TODO_SOURCING=true to include parked records — intended for
 * `astro dev` and Vercel preview deploys, so the owner can review work in
 * progress without it reaching production.
 */

/* This module only ever runs at build time (Astro frontmatter, never shipped to
   the browser), so process.env is the honest source. Reading it through
   import.meta.env does not work here: Vite statically replaces that object, so
   an arbitrary key is simply absent. */
const flag: string | undefined =
  typeof process === 'undefined' ? undefined : process.env['INCLUDE_TODO_SOURCING'];

/** True when records awaiting a source check are visible in this build. */
export const includesUnsourced: boolean =
  flag === undefined || flag === '' ? import.meta.env.DEV === true : flag === 'true';

type Sourced = { data: { sourcing?: 'sourced' | 'todo' } };

const isPublishable = (entry: Sourced): boolean =>
  includesUnsourced || entry.data.sourcing !== 'todo';

/**
 * getCollection, minus anything still awaiting a source check.
 * Use this everywhere instead of importing getCollection directly.
 */
export async function getPublishable<K extends CollectionKey>(
  key: K,
  filter?: (entry: CollectionEntry<K>) => boolean,
): Promise<CollectionEntry<K>[]> {
  const all = await getCollection(key);
  return all.filter((entry) => {
    if (!isPublishable(entry as unknown as Sourced)) return false;
    return filter === undefined || filter(entry);
  });
}

/**
 * Records regardless of sourcing state, for STRUCTURE ONLY.
 *
 * The taxonomy is a special case. A node's shape — its id, name, parent, path
 * and contested flag — comes from Phase 0 spec §2.3, which is the product's own
 * classification decision and carries no external citation. Only the authored
 * one-sentence `summary` is unsourced prose.
 *
 * Gating the whole node on that summary was a mistake: it left the timeline
 * with no lanes at all once events promoted ahead of summaries, because lanes
 * are built from the taxonomy. Structure and prose gate separately now.
 *
 * Never use this to render an authored field. `summary`, and any prose a record
 * carries, must still come through `getPublishable`.
 */
export async function getStructural<K extends CollectionKey>(
  key: K,
): Promise<CollectionEntry<K>[]> {
  return getCollection(key);
}

export interface SourcingTally {
  readonly total: number;
  readonly sourced: number;
  readonly todo: number;
}

/**
 * Counts across a whole collection, ignoring the gate. Reporting how much
 * content is parked is itself publishable — it is the state of the pipeline
 * (spec §11), not the unsourced content.
 */
export async function tally<K extends CollectionKey>(key: K): Promise<SourcingTally> {
  const all = (await getCollection(key)) as unknown as Sourced[];
  const todo = all.filter((entry) => entry.data.sourcing === 'todo').length;
  return { total: all.length, sourced: all.length - todo, todo };
}
