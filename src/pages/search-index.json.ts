import type { APIRoute } from 'astro';
import { getPublishable } from '../lib/content';
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
  readonly kind: 'event' | 'tradition' | 'glossary';
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
  const [events, taxonomy, glossary, dives] = await Promise.all([
    getPublishable('events'),
    getPublishable('taxonomy'),
    getPublishable('glossary'),
    getPublishable('deepDives'),
  ]);

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
  ];

  return new Response(JSON.stringify({ docs }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
