# Claude Code Kickoff — Axis Mundi

Before starting: clone the repo, drop `CLAUDE.md` at the root, and place the four
package files under `/docs` plus the Claude Design exports under `/docs/design/`.
Then run `claude` in the repo directory and paste everything below the line.

---

Read CLAUDE.md and the documents it lists in `/docs` before writing any code. Work
one milestone at a time, in small PRs, and post the Vercel preview link with each.
Do not start a milestone early.

## M0 — Foundation (target: one session)

1. Initialize Astro 5 + TypeScript strict with pnpm. Base layout: top bar with the
   Axis Mundi wordmark, mode toggle (light "Gallery" default, dark "Night
   Gallery"), footer with a methodology placeholder link.
2. `src/styles/tokens.css` built from the design exports and the design language
   doc: full light and dark sets, tradition hues, ocean and land tones. Self-host
   the fonts.
3. Zod schemas in `src/schemas/` mirroring the Phase 0 event schema, taxonomy
   node, glossary term, and matrix cell exactly. Astro content collections wired
   to them.
4. Seed content: the taxonomy for all ten traditions from the spec, and the
   timeline events present in `/docs/reference/living-museum-v5.html` as proper
   event records (they are real, sourced examples).
5. `pnpm validate:content` script and a GitHub Action running validate + lint +
   build on every PR.
6. Confirm the Vercel production deploy is green before closing the milestone.

## M1 — The timeline engine (the hero; take the time it needs)

Data-driven entirely from the events collection and taxonomy. Required behavior,
all defined in the Phase 0 spec and visible in the reference build:

- Lanes generated from the taxonomy; recursive drill-down with breadcrumb
  (World → tradition → family), branch lanes as stepped tints of the parent hue.
- Semantic zoom: scroll/pinch, importance ranks gating visibility, density budget
  of ~8 events per lane per viewport; near-coincident events dodge or cluster,
  never overlap.
- Event panel (desktop side panel, mobile bottom sheet) preserving canvas
  position; Esc/tap-out closes.
- Full state in the URL: zoom, position, filters, drill path. Back button works.
- Ghost mode toggle in drilled views. Keyboard navigation: arrows walk events
  chronologically, Enter opens, Esc closes.
- The Brass Meridian as the shared time-cursor component.

Match the polished Claude Design timeline in `/docs/design/` down to spacing.

## M2 — Deep dives, glossary, search

- Deep-dive template implementing the fourteen sections from the spec, driven by
  structured fields. Build Islam as the first instance; prose sections not yet
  sourced are `TODO(sourcing)` and hidden from the build.
- Glossary tap-cards: any term wrapped at authoring time renders the card with
  original script, transliteration, and definition.
- Universal search over events, traditions, and glossary (client-side index;
  Pagefind or equivalent; no server).

Stop after M2 and wait for direction. The map, matrix, and remaining modules are
sequenced separately.
