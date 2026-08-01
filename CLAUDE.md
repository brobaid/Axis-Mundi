# CLAUDE.md — Axis Mundi

Axis Mundi is an interactive comparative reference for ten religious traditions: an
event-driven timeline, an animated historical world map, structured deep dives, a
belief matrix, and companion modules. Concept name "the Living Museum"; product
name Axis Mundi. It is a static content site. There is no backend, no database,
no CMS, and none should ever be added.

## Read these before any significant work

- `/docs/religions-dashboard-phase0-spec.md` — content schemas, taxonomy, sourcing and neutrality rules. This is law for anything content-shaped.
- `/docs/religions-dashboard-design-language.md` — tokens, type, components, motion, hard bans. This is law for anything visual.
- `/docs/reference/living-museum-v5.html` — the greenlit interactive reference build.
- `/docs/design/` — Claude Design exports (polished screens, tokens JSON, symbol set). Visual source of truth where it goes beyond v5.

## Stack

- Astro 5, TypeScript strict, pnpm.
- Astro content collections for ALL content; Zod schemas in `src/schemas/` mirroring the Phase 0 event schema exactly (integer years, negative = BCE, `precision` enum, `contested`, `sources`, `importance` 1–5).
- Islands: vanilla TypeScript + D3 for the timeline, tree, and wheel canvases. No React/Vue/Svelte unless a specific island justifies it in the PR description.
- Styling: plain CSS with custom properties. `src/styles/tokens.css` is the single source of every color, both modes via `[data-mode]`. Raw hex values anywhere else in the codebase are a bug.
- Fonts self-hosted: Newsreader, Source Serif 4, Archivo, IBM Plex Mono, plus Noto per-script faces (Naskh Arabic, Serif Hebrew, Serif Devanagari, Sans Gurmukhi, Serif SC/JP).

## Commands

- `pnpm dev` / `pnpm build` / `pnpm preview`
- `pnpm validate:content` — Zod-validates every content file. Must exist from M0 and must pass before any commit.
- `pnpm lint` — eslint + astro check.
- `pnpm validate:install` — proves the tree can be installed, not just built. See the dependency rule below.

## Hard rules

1. **Design:** tokens only; both modes must work for every component; the Brass Meridian is one shared component with one color, weight, and easing; WCAG AA, visible brass focus rings, 44px touch targets, `prefers-reduced-motion` collapses transitions to cuts.
2. **Content:** never invent religious content, dates, or adherent figures. Seed data comes from `/docs` or is marked `TODO(sourcing)` and excluded from builds by default. Neutrality framing is uniform ("according to [tradition]") per the spec. `contested: true` must always render its badge or hatching; silently dropping it is a bug.
3. **Bans (from the design doc):** no stock religious photography, no sacred symbols as decoration, no AI-generated depictions of sacred figures, no emoji, no glassmorphism or gradient meshes, no terracotta accents, no new tradition hues, no browser-storage dependencies for core reading paths.
4. **Scope:** do not add analytics, auth, comments, or any feature not in the Phase 0 spec without being asked first. Do not edit anything in `/docs` unless explicitly asked.

## Workflow

- Push directly to `main`. No pull requests, no preview review step.
- **Work is delivered only when it is on `main`.** A push that lands anywhere else — a
  working branch a harness assigned, a fork, a tag — is not a delivery, and reporting it
  as done is a false report. An entire run once landed on a side branch while production
  served the previous build and the report said "pushed".
- **Every run ends by verifying delivery.** Fetch `origin/main`, confirm it contains the
  run's final commit, and state it in the report on its own line: `main head: <sha>,
  verified`. Anything that did not reach `main` is reported as UNDELIVERED, never as done.
- If the git relay refuses `main` the way it refuses tag refs and branch deletions —
  HTTP 403 from the relay, not from GitHub — that is a blocking flag for the owner, not a
  reason to fall back to a branch.
- **Local gate before every push, non-negotiable:** `pnpm validate:content`, `pnpm lint` and `pnpm build` must all pass locally. Never push with any of them failing.
- Conventional commit messages, one concern each.
- CI runs on every push and is the sourcing gate. It must stay green on `main`. It additionally runs `validate:install`, `validate:tokens`, `validate:timeline` and `validate:links`; `pnpm check` runs the whole set locally.
- **Dependencies: the tree must install two ways, and both lockfiles are load-bearing.**
  A build that passes every check is still undeliverable if the deploy cannot install it —
  `@eslint/js@^10` against `eslint@^9` once shipped a fully verified commit that production
  never got past `npm install`, because pnpm resolves a conflicting peer with a warning and
  npm refuses outright. So: `package-lock.json` and `pnpm-lock.yaml` are both committed and
  both must match `package.json`; CI installs with `npm ci` and no cache, the way a deploy
  does; and `validate:install` asserts both. Never add `--legacy-peer-deps`, `--force`, or an
  `.npmrc` that relaxes peer resolution — those make the gate pass and the deploy fail, which
  is the failure this rule exists to prevent. Regenerate **both** lockfiles whenever
  `package.json` changes, and do not delete either without settling which manager the deploy
  actually uses.
- The owner reviews from a phone, so check mobile (390px) before pushing anything visual.
- When a spec and an implementation convenience conflict, the spec wins; if the spec seems wrong, stop and ask instead of deviating.
