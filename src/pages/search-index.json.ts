import type { APIRoute } from 'astro';
import { getPublishable, getStructural } from '../lib/content';
import { MATRIX_DIMENSION_LABELS } from '../lib/dimensions';
import { displayDate } from '../lib/display-date';
import { stripMarkup } from '../lib/prose';
import { traditionMeta } from '../lib/traditions';

/**
 * The universal search index (kickoff M2).
 *
 * Built as a static JSON file at build time and matched entirely in the
 * browser — there is no server, and CLAUDE.md says there never will be. The
 * corpus is small enough (a few hundred records) that a hand-rolled index is
 * lighter than pulling in a crawler like Pagefind, and it indexes the source
 * records rather than the rendered HTML, so a gated record can never leak into
 * results through the page it was excluded from.
 *
 * Everything here goes through `getPublishable`, so records awaiting a source
 * check are absent from the index in production exactly as they are from the
 * pages.
 */

export interface SearchDoc {
  /** Result kind, which drives the badge and the URL shape. */
  readonly kind: 'event' | 'tradition' | 'glossary' | 'belief' | 'region';
  readonly id: string;
  readonly title: string;
  /** Secondary line: a date, a hue name, a transliteration. */
  readonly meta: string;
  readonly body: string;
  readonly url: string;
  /** Tradition id, for the colour chip. Absent on cross-tradition records. */
  readonly tradition?: string | undefined;
}

export const GET: APIRoute = async () => {
  const [events, taxonomy, glossary, dives, matrix, regions, structural] = await Promise.all([
    getPublishable('events'),
    getPublishable('taxonomy'),
    getPublishable('glossary'),
    getPublishable('deepDives'),
    getPublishable('matrix'),
    getPublishable('regions'),
    /* Node names and hues for the belief rows, which key on a taxonomy node
       rather than on a tradition id. */
    getStructural('taxonomy'),
  ]);

  const traditionOfNode = new Map(structural.map((n) => [n.data.id, n.data.tradition]));


  const hasDive = new Set(dives.map((d) => d.data.tradition));

  const docs: SearchDoc[] = [
    ...events.map((entry) => ({
      kind: 'event' as const,
      id: entry.data.id,
      title: entry.data.title,
      meta: displayDate(entry.data),
      body: entry.data.summary,
      url: `/timeline?event=${entry.data.id}&from=${entry.data.year_start - 120}&to=${entry.data.year_start + 120}`,
      tradition: entry.data.traditions[0],
    })),

    /* Every tradition and branch that has a dive to land on. The taxonomy's own
       records gate on their authored one-line summary, so `taxonomy` is empty in
       production; a tradition is searchable because its dive exists, and the
       body is the dive's own subtitle rather than a summary no one has checked. */
    ...dives.map((entry) => {
      const node = structural.find(
        (n) => n.data.id === entry.data.tradition && n.data.depth === 1,
      );
      return {
        kind: 'tradition' as const,
        id: entry.data.tradition,
        title: entry.data.name,
        meta: node?.data.founded.display ?? traditionMeta(entry.data.tradition).hue,
        body: entry.data.subtitle ?? '',
        url: `/traditions/${entry.data.tradition}`,
        tradition: entry.data.tradition,
      };
    }),

    ...taxonomy.map((entry) => {
      const isTradition = entry.data.depth === 1;
      const url =
        isTradition && hasDive.has(entry.data.tradition)
          ? `/traditions/${entry.data.tradition}`
          : `/timeline?drill=${entry.data.depth === 1 ? entry.data.path : entry.data.path.split('/').slice(0, -1).join('/')}`;
      return {
        kind: 'tradition' as const,
        id: entry.data.id,
        title: entry.data.name,
        meta: isTradition
          ? traditionMeta(entry.data.tradition).hue
          : entry.data.path.split('/').slice(0, -1).join(' → '),
        body: entry.data.summary,
        url,
        tradition: entry.data.tradition,
      };
    }),

    ...glossary.map((entry) => {
      const primary = entry.data.traditions[0];
      /* A term links to its tradition's deep dive when that dive is in the
         build; otherwise to the methodology page, which explains the glossary. */
      const url =
        primary !== undefined && hasDive.has(primary)
          ? `/traditions/${primary}#beliefs`
          : '/methodology';
      return {
        kind: 'glossary' as const,
        id: entry.data.id,
        title: entry.data.term,
        meta: entry.data.original
          ? `${entry.data.original.transliteration} · ${entry.data.original.text}`
          : 'term',
        body: stripMarkup(entry.data.definition),
        url,
        tradition: primary,
      };
    }),

    /* Belief-matrix cells. A reader searching "halal" or "rebirth" is asking a
       question the matrix answers, and the answer is a cell rather than a page. */
    ...matrix.flatMap((row) =>
      row.data.cells.map((cell) => ({
        kind: 'belief' as const,
        id: `${row.data.id}-${cell.dimension}`,
        title: `${row.data.label}: ${cell.label ?? cell.value.replace(/-/g, ' ')}`,
        meta: MATRIX_DIMENSION_LABELS[cell.dimension],
        body: cell.nuance,
        url: `/matrix?filter=${cell.dimension}%3D${cell.value}`,
        tradition: traditionOfNode.get(row.data.node) ?? row.data.node,
      })),
    ),

    /* Regions. They carry no page of their own, so a hit filters the timeline
       to the events that name them rather than promising a room. */
    ...regions.map((entry) => ({
      kind: 'region' as const,
      id: entry.data.id,
      title: entry.data.name,
      meta: entry.data.kind === 'country' ? 'Country' : 'Historical macro-region',
      body: entry.data.note ?? '',
      url: `/timeline?region=${entry.data.id}`,
      tradition: undefined,
    })),
  ];

  return new Response(JSON.stringify({ docs }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
