import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { eventSchema } from './schemas/event.js';
import { taxonomyNodeSchema } from './schemas/taxonomy.js';
import { glossaryTermSchema } from './schemas/glossary.js';
import { matrixRowSchema } from './schemas/matrix.js';
import { sourceSchema } from './schemas/source.js';
import { regionSchema } from './schemas/region.js';

/**
 * Every piece of content in Axis Mundi is a collection entry validated by a Zod
 * schema in src/schemas/. There is no CMS and no database (spec §11: "Content
 * lives in a git repo; the site builds from it").
 *
 * One JSON file per record, named `<id>.json`. validate-content.ts asserts the
 * filename and the `id` field agree, so the two can never drift.
 */

const json = (dir: string) => glob({ pattern: '**/*.json', base: `./src/content/${dir}` });

const events = defineCollection({ loader: json('events'), schema: eventSchema });
const taxonomy = defineCollection({ loader: json('taxonomy'), schema: taxonomyNodeSchema });
const glossary = defineCollection({ loader: json('glossary'), schema: glossaryTermSchema });
const matrix = defineCollection({ loader: json('matrix'), schema: matrixRowSchema });
const sources = defineCollection({ loader: json('sources'), schema: sourceSchema });
const regions = defineCollection({ loader: json('regions'), schema: regionSchema });

export const collections = { events, taxonomy, glossary, matrix, sources, regions };
