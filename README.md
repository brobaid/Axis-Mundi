# Axis Mundi

An interactive comparative reference for ten religious traditions: an event-driven
timeline, an animated historical world map, structured deep dives, a belief matrix,
and companion modules. Concept name "the Living Museum"; product name Axis Mundi.

Static content site. No backend, no database, no CMS.

- **Production:** https://axis-mundi-mu.vercel.app
- **Governing documents:** [`CLAUDE.md`](./CLAUDE.md) and [`/docs`](./docs)

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server. Includes records awaiting a source check. |
| `pnpm build` | Production build. Excludes them. |
| `pnpm preview` | Serve the built output. |
| `pnpm validate:content` | Zod-validates every content file, then checks cross-file rules. |
| `pnpm validate:tokens` | Fails on raw colours outside `tokens.css`, and audits WCAG AA in both modes. |
| `pnpm validate:timeline` | Timeline layout invariants: density budget, rank gating, nothing overlaps. |
| `pnpm validate` | All three validators. |
| `pnpm lint` | `eslint` + `astro check`. |
| `pnpm check` | Everything, in the order CI runs it. |

`pnpm validate` must pass before any commit.

## Layout

```
docs/                  Governing specs. Do not edit without being asked.
src/schemas/           Zod schemas mirroring the Phase 0 spec, field for field.
src/content/           One JSON file per record, named <id>.json.
src/styles/tokens.css  THE single source of every colour in the codebase.
src/lib/               Content access, tradition metadata, timeline model + renderer.
src/scripts/           Island entry points (vanilla TS).
scripts/               The three validators CI runs.
```

## The timeline

The canvas is split three ways so the same logic runs at build time and in the
browser, and the two can never disagree:

- `src/lib/timeline-model.ts` — pure layout maths. Lanes from the taxonomy, rank
  gating, the density budget, dodge and cluster resolution, label placement.
  No DOM, no framework.
- `src/lib/timeline-render.ts` — that layout as HTML strings. Called by Astro for
  the server-rendered first paint and by the island on every interaction.
- `src/scripts/timeline.ts` — interaction only: zoom (d3-zoom), drill, filters,
  the event panel, keyboard navigation, and URL state.

Reading it needs no JavaScript: the first paint is real content, and the full
chronological list alternative is always in the DOM.

## Two rules worth knowing before you edit anything

**Colour lives in exactly one file.** `src/styles/tokens.css` defines every colour,
in both modes, via `[data-mode]`. A raw hex anywhere else in `src/` fails
`pnpm validate:tokens`. That script also asserts ~116 contrast pairs across both
modes, so a token edit that breaks WCAG AA fails CI rather than shipping.

**Unsourced content does not ship.** Every record carries a `sourcing` field.
Records marked `"todo"` are excluded from production builds — they are seeded,
validated and version-controlled, but not published. Set
`INCLUDE_TODO_SOURCING=true` to include them in a build; `pnpm dev` does this
by default so work in progress is visible locally and in Vercel previews.

To promote a record: add its citations to `src/content/sources/`, reference them
from the record, and flip `sourcing` to `"sourced"`. `validate:content` then
enforces the Phase 0 sourcing rules — importance 3+ events need a T1–T3 source,
matrix cells need T1 or a labelled T4, and contested items need a note.

## Milestones

- **M0 — foundation.** Complete. Astro 5 + TypeScript strict, the token system in
  both modes, self-hosted fonts, Zod schemas wired to content collections, seed
  content, both validators, CI, and a green production deploy.
- **M1 — the timeline engine.** Complete. Taxonomy-driven lanes, recursive drill
  with breadcrumb, semantic zoom, the density budget, dodge and cluster, the
  event panel, ghost mode, keyboard navigation, and full state in the URL.
- **M2 — deep dives, glossary, universal search.** Next.

The map, matrix and remaining modules are sequenced separately.
