/**
 * Axis Mundi — content validation.
 *
 * Zod-validates every content file and then checks the cross-file rules that a
 * per-file schema cannot see: referential integrity, and the Phase 0 sourcing
 * and neutrality rules (spec §9.2).
 *
 * Must pass before any commit (CLAUDE.md, Commands).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';

import { eventSchema } from '../src/schemas/event.js';
import { taxonomyNodeSchema } from '../src/schemas/taxonomy.js';
import { glossaryTermSchema } from '../src/schemas/glossary.js';
import { matrixRowSchema } from '../src/schemas/matrix.js';
import { sourceSchema } from '../src/schemas/source.js';
import { regionSchema } from '../src/schemas/region.js';
import {
  deepDiveSchema,
  festivalSchema,
  figureSchema,
  siteSchema,
} from '../src/schemas/deep-dive.js';
import { workSchema } from '../src/schemas/work.js';
import { snapshotSchema } from '../src/schemas/snapshot.js';
import { textSchema } from '../src/schemas/text.js';
import { glossaryRefs } from '../src/lib/prose.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'src/content');

/* -------------------------------------------------------------------------- */

interface Problem {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

const problems: Problem[] = [];
const note = (file: string, path: string, message: string): void => {
  problems.push({ file: relative(ROOT, file), path, message });
};

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

interface Collection<S extends z.ZodTypeAny> {
  readonly dir: string;
  readonly schema: S;
}

const COLLECTIONS = {
  events: { dir: 'events', schema: eventSchema },
  taxonomy: { dir: 'taxonomy', schema: taxonomyNodeSchema },
  glossary: { dir: 'glossary', schema: glossaryTermSchema },
  matrix: { dir: 'matrix', schema: matrixRowSchema },
  sources: { dir: 'sources', schema: sourceSchema },
  regions: { dir: 'regions', schema: regionSchema },
  deepDives: { dir: 'deep-dives', schema: deepDiveSchema },
  texts: { dir: 'texts', schema: textSchema },
  festivals: { dir: 'festivals', schema: festivalSchema },
  sites: { dir: 'sites', schema: siteSchema },
  figures: { dir: 'figures', schema: figureSchema },
  snapshots: { dir: 'snapshots', schema: snapshotSchema },
  works: { dir: 'works', schema: workSchema },
} satisfies Record<string, Collection<z.ZodTypeAny>>;

type CollectionName = keyof typeof COLLECTIONS;

/** Parsed, schema-valid records, keyed by id. */
const parsed: Record<CollectionName, Map<string, { file: string; data: any }>> = {
  events: new Map(),
  taxonomy: new Map(),
  glossary: new Map(),
  matrix: new Map(),
  sources: new Map(),
  regions: new Map(),
  deepDives: new Map(),
  texts: new Map(),
  festivals: new Map(),
  sites: new Map(),
  figures: new Map(),
  snapshots: new Map(),
  works: new Map(),
};

let fileCount = 0;

for (const [name, { dir, schema }] of Object.entries(COLLECTIONS) as [
  CollectionName,
  Collection<z.ZodTypeAny>,
][]) {
  for (const file of walk(resolve(CONTENT, dir))) {
    fileCount += 1;

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      note(file, '', `invalid JSON: ${(err as Error).message}`);
      continue;
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        note(file, issue.path.join('.'), issue.message);
      }
      continue;
    }

    const data = result.data as { id: string };

    /* The Astro glob loader derives entry ids from filenames, so the filename
       and the `id` field must agree or the two silently diverge. */
    const basename = file.slice(file.lastIndexOf('/') + 1).replace(/\.json$/, '');
    if (basename !== data.id) {
      note(file, 'id', `filename "${basename}.json" does not match id "${data.id}"`);
    }

    const existing = parsed[name].get(data.id);
    if (existing !== undefined) {
      note(file, 'id', `duplicate id "${data.id}", already defined in ${relative(ROOT, existing.file)}`);
      continue;
    }

    parsed[name].set(data.id, { file, data });
  }
}

/* -------------------------------------------------------------------------- */
/* Cross-file rules                                                            */
/* -------------------------------------------------------------------------- */

const sourceTierOf = (id: string): string | undefined => parsed.sources.get(id)?.data.tier;
const has = (name: CollectionName, id: string): boolean => parsed[name].has(id);

/** Every path a taxonomy node defines, for branch_path checking. */
const taxonomyPaths = new Set<string>(
  [...parsed.taxonomy.values()].map((entry) => entry.data.path as string),
);

for (const { file, data } of parsed.taxonomy.values()) {
  for (const [i, src] of ((data.founded?.sources ?? []) as string[]).entries()) {
    if (!has('sources', src)) note(file, `founded.sources.${i}`, `unknown source "${src}"`);
  }

  if (data.parent !== null && !has('taxonomy', data.parent)) {
    note(file, 'parent', `unknown parent node "${data.parent}"`);
  }
  for (const [i, src] of (data.sources as string[]).entries()) {
    if (!has('sources', src)) note(file, `sources.${i}`, `unknown source "${src}"`);
  }
  if (data.adherents !== undefined && !has('sources', data.adherents.source)) {
    note(file, 'adherents.source', `unknown source "${data.adherents.source}"`);
  }
  for (const [i, current] of (data.currents as { spans: string[] }[]).entries()) {
    for (const [j, span] of current.spans.entries()) {
      if (!has('taxonomy', span)) {
        note(file, `currents.${i}.spans.${j}`, `current spans unknown node "${span}"`);
      }
    }
  }
}

for (const { file, data } of parsed.events.values()) {
  for (const [i, path] of (data.branch_path as string[]).entries()) {
    if (!taxonomyPaths.has(path)) {
      note(file, `branch_path.${i}`, `no taxonomy node defines the path "${path}"`);
    }
  }
  for (const [i, region] of (data.region as string[]).entries()) {
    if (!has('regions', region)) note(file, `region.${i}`, `unknown region "${region}"`);
  }
  for (const [i, src] of (data.sources as string[]).entries()) {
    if (!has('sources', src)) note(file, `sources.${i}`, `unknown source "${src}"`);
  }
  for (const [i, ev] of (data.links.events as string[]).entries()) {
    if (!has('events', ev)) note(file, `links.events.${i}`, `unknown event "${ev}"`);
  }

  /* Spec §9.2.1 — every event of importance 3+ cites at least one T1–T3 source.
     Records still awaiting a source check are exempt; they are excluded from the
     default build instead. */
  if (data.importance >= 3 && data.sourcing === 'sourced') {
    const tiers = (data.sources as string[]).map(sourceTierOf);
    if (!tiers.some((t) => t === 'T1' || t === 'T2' || t === 'T3')) {
      note(
        file,
        'sources',
        'importance 3+ requires at least one T1–T3 source (spec §9.2.1); ' +
          `found [${tiers.filter(Boolean).join(', ') || 'none'}]`,
      );
    }
  }
}

for (const { file, data } of parsed.matrix.values()) {
  if (!has('taxonomy', data.node)) note(file, 'node', `unknown taxonomy node "${data.node}"`);

  for (const [i, cell] of (data.cells as { sources: string[] }[]).entries()) {
    for (const [j, src] of cell.sources.entries()) {
      if (!has('sources', src)) note(file, `cells.${i}.sources.${j}`, `unknown source "${src}"`);
    }
    /* Spec §9.2.2 — every matrix cell cites T1 or labelled T4. */
    if (data.sourcing === 'sourced') {
      const tiers = cell.sources.map(sourceTierOf);
      if (!tiers.some((t) => t === 'T1' || t === 'T4')) {
        note(
          file,
          `cells.${i}.sources`,
          'matrix cells cite T1 or labelled T4 (spec §9.2.2); ' +
            `found [${tiers.filter(Boolean).join(', ') || 'none'}]`,
        );
      }
    }
  }
}

for (const { file, data } of parsed.glossary.values()) {
  for (const [i, ref] of (data.see_also as string[]).entries()) {
    if (!has('glossary', ref)) note(file, `see_also.${i}`, `unknown glossary term "${ref}"`);
  }
  for (const [i, src] of (data.sources as string[]).entries()) {
    if (!has('sources', src)) note(file, `sources.${i}`, `unknown source "${src}"`);
  }
}

/* Deep dives (spec §5). Every id reference has to resolve, and every glossary
   term wrapped in prose has to exist, or the tap-card silently degrades to
   plain text and the reader never learns the word. */
for (const { file, data } of parsed.deepDives.values()) {
  if (!has('taxonomy', data.tradition)) {
    note(file, 'tradition', `unknown taxonomy node "${data.tradition}"`);
  }

  for (const key of ['festivals', 'sites', 'figures'] as const) {
    for (const [i, ref] of (data[key] as string[]).entries()) {
      if (!has(key, ref)) note(file, `${key}.${i}`, `unknown ${key} record "${ref}"`);
    }
  }

  const proseKeys = ['overview', 'origins', 'core_beliefs', 'law_and_ethics', 'demographics'];
  for (const key of proseKeys) {
    const block = data[key];
    if (block === undefined) continue;
    for (const [i, src] of (block.sources as string[]).entries()) {
      if (!has('sources', src)) note(file, `${key}.sources.${i}`, `unknown source "${src}"`);
    }
    for (const term of glossaryRefs(block.body as string)) {
      if (!has('glossary', term)) {
        note(file, key, `prose wraps glossary term "${term}", which has no record`);
      }
    }
  }

  for (const group of ['canon', 'practices', 'misconceptions', 'rites'] as const) {
    for (const [i, entry] of (data[group] as { sources: string[] }[]).entries()) {
      for (const [j, src] of entry.sources.entries()) {
        if (!has('sources', src)) note(file, `${group}.${i}.sources.${j}`, `unknown source "${src}"`);
      }
    }
  }

  for (const [i, src] of (data.further_reading as string[]).entries()) {
    if (!has('sources', src)) note(file, `further_reading.${i}`, `unknown source "${src}"`);
  }

  /* Spec §5: the fourteen sections are identical for every tradition, so the
     structural slots must all be present even when a section is still empty. */
  if (data.stat_box === undefined) note(file, 'stat_box', 'the Overview stat box is required');
}

/* Sacred texts: the tradition must exist, sources must resolve, and exactly one
   published text per tradition may claim to be the principal one. "The
   principal scripture" stops meaning anything the moment two records assert it,
   and a tradition whose primary is missing would silently render an empty stat
   line that looks like an absent record rather than an un-flagged one. */
{
  const primaries = new Map<string, string[]>();

  for (const { file, data } of parsed.texts.values()) {
    if (!has('taxonomy', data.tradition as string)) {
      note(file, 'tradition', `unknown tradition "${data.tradition}"`);
    }
    for (const [i, src] of (data.sources as string[]).entries()) {
      if (!has('sources', src)) note(file, `sources.${i}`, `unknown source "${src}"`);
    }
    /* Only published records compete: a text still awaiting a source check is
       held out of the build, so it cannot be the one the build names. */
    if (data.primary === true && data.sourcing !== 'todo') {
      const list = primaries.get(data.tradition as string) ?? [];
      list.push(data.id as string);
      primaries.set(data.tradition as string, list);
    }
  }

  for (const [tradition, ids] of primaries) {
    if (ids.length > 1) {
      note(
        `texts/${ids[0]}.json`,
        'primary',
        `${tradition} has ${ids.length} primary texts (${ids.join(', ')}); exactly one may be primary`,
      );
    }
  }
}

/* Festivals, sites and figures: source references must resolve. */
for (const group of ['festivals', 'sites', 'figures'] as const) {
  for (const { file, data } of parsed[group].values()) {
    for (const [i, src] of (data.sources as string[]).entries()) {
      if (!has('sources', src)) note(file, `sources.${i}`, `unknown source "${src}"`);
    }
  }
}

/* Era snapshots: every realm's sources must resolve, and a fixture must never
   be able to reach a production build. */
for (const { file, data } of parsed.snapshots.values()) {
  for (const [i, feature] of (data.features as any[]).entries()) {
    for (const [j, src] of (feature.properties.sources as string[]).entries()) {
      if (!has('sources', src)) {
        note(file, `features.${i}.properties.sources.${j}`, `unknown source "${src}"`);
      }
    }
  }
  if (data.fixture === true && data.sourcing !== 'todo') {
    note(file, 'sourcing', 'a fixture must stay gated');
  }
}

/* Spec §2.1 — all ten launch traditions must exist as depth-1 taxonomy nodes. */
const LAUNCH_TEN = [
  'christianity',
  'islam',
  'judaism',
  'hinduism',
  'buddhism',
  'sikhism',
  'chinese',
  'jainism',
  'shinto',
  'zoroastrianism',
];
for (const id of LAUNCH_TEN) {
  const entry = parsed.taxonomy.get(id);
  if (entry === undefined) {
    problems.push({
      file: 'src/content/taxonomy',
      path: id,
      message: `missing depth-1 node for launch tradition "${id}" (spec §2.1)`,
    });
  } else if (entry.data.depth !== 1) {
    note(entry.file, 'depth', `launch tradition "${id}" must be a depth-1 node`);
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

const counts = (name: CollectionName) => {
  const all = [...parsed[name].values()];
  const fixture = all.filter((e) => e.data.fixture === true).length;
  const todo = all.filter((e) => e.data.sourcing === 'todo' && e.data.fixture !== true).length;
  return { total: all.length, todo, fixture };
};

if (problems.length > 0) {
  console.error('\n  Content validation FAILED\n');
  let lastFile = '';
  for (const p of problems) {
    if (p.file !== lastFile) {
      console.error(`  ${p.file}`);
      lastFile = p.file;
    }
    console.error(`      ${p.path === '' ? '(file)' : p.path}: ${p.message}`);
  }
  console.error(`\n  ${problems.length} problem${problems.length === 1 ? '' : 's'} in ${fileCount} files.\n`);
  process.exit(1);
}

console.log(`  Content validation passed — ${fileCount} files.`);
for (const name of Object.keys(COLLECTIONS) as CollectionName[]) {
  const { total, todo, fixture } = counts(name);
  if (total === 0) continue;
  const parts: string[] = [];
  if (todo > 0) parts.push(`${todo} awaiting source check`);
  /* Fixtures are development scaffolding, never part of the published set. */
  if (fixture > 0) parts.push(`${fixture} fixture, never published`);
  const suffix = parts.length > 0 ? `  (${parts.join(', ')})` : '';
  console.log(`      ${name.padEnd(9)} ${String(total).padStart(3)}${suffix}`);
}
