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
  const todo = all.filter((e) => e.data.sourcing === 'todo').length;
  return { total: all.length, todo };
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
  const { total, todo } = counts(name);
  if (total === 0) continue;
  const suffix = todo > 0 ? `  (${todo} awaiting source check)` : '';
  console.log(`      ${name.padEnd(9)} ${String(total).padStart(3)}${suffix}`);
}
