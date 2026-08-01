# Axis Mundi

An interactive comparative reference for ten religious traditions. Seven rooms:
an event-driven timeline of four hundred sourced events, an animated historical
world map of twelve hand-drawn plates, structured deep dives on all ten
traditions, a belief matrix, a side-by-side compare, a family tree of descent,
and a year wheel of the festival calendar. Concept name "the Living Museum";
product name Axis Mundi.

It describes what traditions hold and practise. It does not evaluate them.

**Live:** <https://axis-mundi-mu.vercel.app>

## Architecture

A static content site — no backend, no database, no CMS, and none is coming.
Astro 5 with TypeScript at `strictest` builds twenty-one pages from 732 JSON
records, each validated against a Zod schema in `src/schemas/` that mirrors the
Phase 0 spec field for field. The interactive rooms are vanilla TypeScript
islands over D3, each split so that pure model code (`src/lib/*-model.ts`) and a
DOM-free renderer (`src/lib/*-render.ts`) run at build time for the
server-rendered first paint *and* in the browser for every interaction — the two
cannot disagree because they are the same function. Islands carry no Zod, so no
schema reaches a reader's device. Every colour in the codebase lives in
`src/styles/tokens.css` and nowhere else, in both light and night modes; every
font is self-hosted. Reading the site needs no JavaScript: the first paint is
real content, and each canvas ships a full list alternative in the DOM beside
it.

## The owner-data pipeline

Content does not originate here. Owner datasets arrive as direct commits under
[`/docs/slates`](./docs/slates) — research memos, prose slates, GeoJSON plates —
and ingestion is mechanical: prose bodies are lifted out of the slate
programmatically and byte-compared back against it, never retyped, and the only
values not transcribed are the ones a schema requires and a slate has no column
for, each read off the owner's own clause and reported. Nothing is asserted that
a record does not carry. Where a record cannot answer, the site shows the gap
rather than filling it: a plate leaves a realm unshaded, a contested dating
carries both positions, a festival whose rule names only a Hijri month is listed
beneath the wheel instead of dotted somewhere plausible, and a row that cannot
be sourced is held out of the build entirely. Absence is a claim this site is
willing to make; a plausible guess is not.

## The gate

`pnpm check` runs all six, in the order CI does. It must pass before any push.

| Check | What it enforces |
| --- | --- |
| `pnpm validate:content` | Zod-validates all 732 records, then the cross-file rules: importance 3+ events need a T1–T3 source, matrix cells need T1 or a labelled T4, contested items must cite both positions, glossary references must resolve. |
| `pnpm validate:tokens` | Fails on a raw colour anywhere outside `tokens.css`, on an undefined custom property, and on any of 186 contrast pairs falling below WCAG AA across the light, night and print modes. |
| `pnpm validate:timeline` | Timeline layout invariants across six viewports: the density budget, rank gating, and that nothing overlaps. |
| `pnpm lint` | `eslint` and `astro check`, at zero errors, zero warnings, zero hints. |
| `pnpm build` | Twenty-one pages. Records marked `sourcing: "todo"` are excluded. |
| `pnpm validate:links` | Every internal link resolves against `dist/` under the rules a plain static host applies, and every built route appears in `sitemap.xml`. |

`pnpm dev` sets `INCLUDE_TODO_SOURCING=true`, so work awaiting a source check is
visible locally and in previews but never in production.

## Layout

```
docs/                  Governing specs and owner slates. Do not edit without being asked.
src/schemas/           Zod schemas mirroring the Phase 0 spec, field for field.
src/content/           One JSON file per record, named <id>.json.
src/styles/tokens.css  THE single source of every colour in the codebase.
src/lib/               Models, renderers, content access. Pure and DOM-free.
src/scripts/           Island entry points (vanilla TS).
scripts/               The four checks CI runs.
```

## Two rules worth knowing before you edit anything

**Colour lives in exactly one file.** `src/styles/tokens.css` defines every
colour, in every mode, via `[data-mode]`. A raw hex anywhere else in `src/`
fails `pnpm validate:tokens` — as does a `var()` referencing a property nobody
defined, which otherwise drops its whole declaration in silence.

**Unsourced content does not ship.** Every record carries a `sourcing` field.
`"todo"` records are seeded, validated and version-controlled, but held out of
production. To promote one: add its citations to `src/content/sources/`,
reference them from the record, and flip the field. A third value, `"editorial"`,
exists for the handful of statements that describe this site's own conventions
rather than any tradition — a scholar cannot source a rendering decision, and
citing one for it would put a historian's name behind our own choice.

## The fuller statement

The [colophon](https://axis-mundi-mu.vercel.app/colophon) is computed from these
same records at build time: the full count by collection, the source registry
with its tiers, and the twelve plates with the memos they were drawn from. The
[methodology page](https://axis-mundi-mu.vercel.app/methodology) states the
sourcing tiers, the neutrality framing, and what is still held.

Governing documents: [`CLAUDE.md`](./CLAUDE.md) and [`/docs`](./docs).
