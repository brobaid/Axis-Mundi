import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { eventSchema } from './schemas/event.js';
import { taxonomyNodeSchema } from './schemas/taxonomy.js';
import { glossaryTermSchema } from './schemas/glossary.js';
import { matrixRowSchema } from './schemas/matrix.js';
import { sourceSchema } from './schemas/source.js';
import { regionSchema } from './schemas/region.js';
import {
  deepDiveSchema,
  festivalSchema,
  figureSchema,
  siteSchema,
} from './schemas/deep-dive.js';
import { divisionSchema, workSchema } from './schemas/work.js';
import { snapshotSchema } from './schemas/snapshot.js';
import { textSchema } from './schemas/text.js';

/**
 * Every piece of content in Axis Mundi is a collection entry validated by a Zod
 * schema in src/schemas/. There is no CMS and no database (spec §11: "Content
 * lives in a git repo; the site builds from it").
 *
 * One JSON file per record, named `<id>.json`. validate-content.ts asserts the
 * filename and the `id` field agree, so the two can never drift.
 */

/**
 * The entry id is the filename, always and only.
 *
 * Left to itself the glob loader prefers a record's own `slug` field over its
 * path, which silently gave every Reading Room division the id of its route
 * segment instead of its filename — `genesis`, not `tanakh--genesis` — so
 * `getEntry` found nothing and the pages built empty. Stating the rule here
 * makes it the same rule validate-content.ts already enforces on disk.
 */
const json = (dir: string) =>
  glob({
    pattern: '**/*.json',
    base: `./src/content/${dir}`,
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  });

const events = defineCollection({ loader: json('events'), schema: eventSchema });
const taxonomy = defineCollection({ loader: json('taxonomy'), schema: taxonomyNodeSchema });
const glossary = defineCollection({ loader: json('glossary'), schema: glossaryTermSchema });
const matrix = defineCollection({ loader: json('matrix'), schema: matrixRowSchema });
const sources = defineCollection({ loader: json('sources'), schema: sourceSchema });
const regions = defineCollection({ loader: json('regions'), schema: regionSchema });

/* Deep dives, plus the three record types the spec calls out as feeding later
   modules: festivals → year wheel, sites → map layer, figures → network. */
const deepDives = defineCollection({ loader: json('deep-dives'), schema: deepDiveSchema });
const texts = defineCollection({ loader: json('texts'), schema: textSchema });
const festivals = defineCollection({ loader: json('festivals'), schema: festivalSchema });
const sites = defineCollection({ loader: json('sites'), schema: siteSchema });
const figures = defineCollection({ loader: json('figures'), schema: figureSchema });

/* Era snapshots for the map (spec §6). One GeoJSON file per snapshot year. */
const snapshots = defineCollection({ loader: json('snapshots'), schema: snapshotSchema });

/* Reading Room corpora (Phase 5). One paired-text record per canon, in the
   shape the owner's corpora arrive in. */
const works = defineCollection({ loader: json('works'), schema: workSchema });

/* One record per surah, book or nikaya. A route loads its own and no more:
   the delivered corpus file is the owner's format, never the build's working
   set and never the client's payload. */
const divisions = defineCollection({ loader: json('divisions'), schema: divisionSchema });

export const collections = {
  events,
  taxonomy,
  glossary,
  matrix,
  sources,
  regions,
  deepDives,
  texts,
  festivals,
  sites,
  figures,
  snapshots,
  works,
  divisions,
};
