# Religions Dashboard: Design Language Document

Version 0.1. Companion to the Phase 0 Foundation Spec. This document defines how the product looks, moves, and speaks. The spec defines what it says.

---

## 1. Concept: The Living Museum

The site is a museum that moves. Default mode is a **light gallery**: warm paper walls, generous air, artifacts presented on plates with exhibit labels, a curator's voice. Dark mode is the **night gallery**: same rooms after hours, spot-lit, hushed, never neon.

**Personality words:** scholarly, calm, precise, curious, reverent-in-craft but secular-in-voice.

**Not:** corporate, playful-cartoonish, mystical, techy, gamified, devotional.

**Reference points:** museum exhibition graphics (label plates, object numbering, vitrine brass), illuminated-manuscript margins, high-end data journalism. The subject's own materials, manuscript, stone, brass, textile, drive the aesthetic. Not the subject's stock photography.

---

## 2. The signature: the Brass Meridian

Every product needs one memorable element. Ours is the **Brass Meridian**: a single thin brass vertical rule representing the global time cursor.

- On the timeline it is the playhead.
- On the map it lives inside the era scrubber.
- On a deep dive it appears in the margin beside history sections, marking the years the current passage covers.
- It is always the same color, weight, and behavior. It is the visible form of "one time cursor, many lenses."

Secondary signatures, used with discipline:

1. **Exhibit labels**: stat boxes and metadata rendered like museum object labels (small caps eyebrow, rule, dense factual lines).
2. **Plates**: every image sits on a framed plate with caption and credit, like a catalogue figure. No naked images.
3. **Hatching**: uncertainty and contested status render as diagonal hatching, a drafting convention, applied identically on map polygons, timeline spans, and matrix cells.

Everything else stays quiet so these carry the identity.

---

## 3. Color

### 3.1 Neutrals and accent

| Token | Light (Gallery) | Dark (Night Gallery) | Use |
|---|---|---|---|
| `canvas` | #F7F3EC warm paper | #14110D deep umber-black | Page background |
| `surface` | #FDFBF7 | #1D1915 | Cards, panels |
| `ink` | #201B16 | #EDE7DC | Primary text |
| `ink-soft` | #5C544A | #A89F92 | Secondary text |
| `hairline` | #E3DCD0 | #2E2822 | Rules, dividers |
| `brass` | #9C7A2F | #C9A250 | Meridian, focus, interactive accents |
| `brass-ink` | #6E5620 | #E2C77E | Links, active states on text |

Rules: brass is the only interface accent. It is metallic ochre, deliberately not terracotta, not clay, not orange. Focus rings, the meridian, active filters, and links use it; nothing else does.

### 3.2 Tradition hues

Identity colors for lanes, chips, map fills, and chart series. Assigned from strong traditional or liturgical associations where one exists, pragmatically where none does. Each hue ships as a ramp (fill, line, text-safe) tuned per mode for WCAG AA against both canvases.

| Tradition | Hue | Light base | Rationale |
|---|---|---|---|
| Judaism | Tekhelet azure | #2B6CB0 | The tekhelet dye of tzitzit |
| Christianity | Byzantine violet | #6B46A0 | Liturgical purple |
| Islam | Emerald | #1E7A4C | Longstanding association with green |
| Hinduism | Saffron | #D9740B | Bhagwa saffron |
| Buddhism | Maroon | #8A3033 | Monastic robe maroon |
| Sikhism | Indigo navy | #2F3B7A | Nihang blue |
| Chinese traditions | Imperial yellow | #C9A100 | Imperial and temple gold |
| Shinto | Vermilion | #D34E3A | Torii vermilion |
| Jainism | Teal | #147D77 | Pragmatic assignment; white (their true color) is reserved for canvas |
| Zoroastrianism | Flame crimson | #B3382C | The sacred fire |

Rules:

1. Color never carries meaning alone. Every colored element pairs with a text label or icon.
2. Shinto vermilion and Zoroastrian crimson, and Hinduism saffron and Chinese yellow, are the two nearest pairs; they never appear adjacent without labels, and their dark-mode ramps push further apart.
3. Branch lanes inherit the parent hue at stepped tints, never new hues.
4. The set is reviewable; associations are conventional, not official, and the doc says so on the site's methodology page.

### 3.3 Semantic

Contested = neutral badge + hatching, never a warning red (a dispute is not an error). Confidence grades on the map: A solid, B 60% opacity, C hatched.

---

## 4. Typography

### 4.1 Roles

| Role | Face | Why |
|---|---|---|
| Display and headings | Newsreader | Editorial serif with genuine character; museum wall-text register without Playfair/Fraunces fatigue |
| Prose | Source Serif 4 | Reading-optimized serif; keeps the catalogue feel at 17px body |
| UI, labels, data | Archivo | Grotesque with enough personality to not read as default; excellent at small sizes and in all-caps eyebrows |
| Dates, ticks, coordinates | IBM Plex Mono | Tabular figures for the timeline ruler and data readouts |

All available on Google Fonts; self-host at build.

### 4.2 Scale

Display 44/1.1, H1 34/1.15, H2 26/1.2, H3 21/1.3, body 17/1.6, small 15/1.5, caption 13/1.4, eyebrow 12/1.2 tracked +8% small caps. Spacing on a 4px base, section rhythm on 8px multiples.

### 4.3 Multi-script system

Original scripts appear throughout (names of God, text titles, glossary originals). The backbone is the Noto family with per-script stacks:

| Script | Face |
|---|---|
| Arabic | Noto Naskh Arabic (display: Noto Nastaliq Urdu where appropriate) |
| Hebrew | Noto Serif Hebrew |
| Devanagari | Noto Serif Devanagari |
| Gurmukhi | Noto Sans Gurmukhi |
| CJK | Noto Serif SC / TC / JP |
| Tamil, Thai, Sinhala | Noto Serif equivalents |
| Avestan, historical scripts | Noto Sans Avestan and Noto historical set |

Rules: proper shaping and full RTL layout support (Arabic, Hebrew) including mirrored components; original-script terms render 5 to 10% larger than surrounding Latin to equalize perceived x-height; every original term pairs as original + transliteration + gloss on first use, matching the glossary schema.

---

## 5. Layout

- 12-column grid, 1280 max content width; prose measures capped at 72ch.
- Canvases (timeline, map, matrix) are full-bleed with a fixed control rail; prose pages are centered gallery pages with wide margins.
- Hairline rules (1px `hairline`) structure sections; no boxed cards where a rule will do.
- Exhibit-label component: eyebrow (Archivo small caps), rule, label/value lines (Plex Mono values), used for stat boxes, event metadata, map readouts.
- Plates: image, 1px hairline frame, 12px mat of `surface`, caption + credit in caption size. Mandatory credit line, per Phase 0 media licensing.
- Elevation: light mode uses 1px hairline + 2% shadow; dark mode uses lighter surface steps, no glow.

---

## 6. Iconography and symbols

- Line icons, 1.5px stroke, 24px grid, rounded caps, drawn or chosen to match Archivo's tone.
- Religious symbols (cross, crescent and star, Star of David, Om, dharmachakra, khanda, torii, taijitu, Jain hand with wheel, faravahar) are drawn as careful line art on the same grid, vetted for correct form, and used only as identifiers (lane headers, chips, deep-dive mastheads). Never as decoration, texture, or bullet points. Never emoji.

---

## 7. Motion

Principles: calm, physical, purposeful. Motion explains state change; it never performs.

| Context | Behavior | Duration / easing |
|---|---|---|
| UI micro (hover, chips, toggles) | Opacity and 2px translate | 150 to 200ms, ease-out |
| Panel / bottom sheet | Slide over canvas, canvas dims 20%, position preserved | 280ms, standard ease |
| Timeline semantic zoom | Crossfade + scale; events enter by importance rank, staggered 30ms | 500 to 700ms |
| Map era scrub | Polygon opacity crossfade between snapshots, never shape-tweening (honesty rule: we do not invent intermediate borders) | 600ms |
| Meridian | Moves as a physical object: eased, slightly weighted, identical everywhere | 400ms |
| Page transitions | Fade through `canvas`, 200ms | |

`prefers-reduced-motion`: all crossfades become cuts, meridian snaps, stagger removed.

---

## 8. Component inventory

**Global:** top bar (wordmark, search, mode toggle), universal search overlay, Brass Meridian, footer with methodology link.

**Timeline:** lane headers with symbol + hue chip, event nodes (dot scaled by rank; spans as bars), rank-aware labels, filter rail (traditions, types, regions, era), zoom control, ghost-mode toggle, drill-down breadcrumb (World → Christianity → Protestant), event side panel / bottom sheet (title, exhibit label, contested badge, body, plate, sources, related links).

**Map:** era scrubber with snapshot detents and meridian, legend with confidence key, sites layer toggle, region tap-card.

**Deep dive:** masthead (symbol, name in original script + Latin, exhibit-label stat box), sticky section nav, canon table, branch-tree snippet, misconception cards, source footnote popovers.

**Matrix:** sticky first column and header row, enum filter chips, cell popover with nuance + source, hatched contested cells.

**Everywhere:** glossary tap-cards, contested badge, source popover.

---

## 9. Modes

- **Default is light**, as a product decision, regardless of OS preference on first visit. The toggle sits in the top bar; the choice persists.
- Dark mode is a full token swap per the tables above, with tradition ramps luminance-boosted and saturation eased so hues read on umber-black without vibrating.
- No mixed mode, no auto-switching mid-session.

---

## 10. Accessibility and internationalization floor

WCAG AA contrast in both modes for all text and UI. Color never the sole information carrier. Full keyboard navigation of canvases (arrow keys walk events chronologically, Enter opens the panel, Esc closes). Focus visible (brass ring). Touch targets 44px minimum. Alt text mandatory on all plates. RTL-safe components. Reduced motion honored. Semantic HTML with the timeline exposed as an accessible list alternative.

---

## 11. Voice and microcopy

The curator's voice: precise, warm, unhurried. Sentence case everywhere, no exclamation marks, no gamification vocabulary (no streaks, unlocks, journeys-as-badges). Attribution framing from the Phase 0 neutrality rules is UI law: interface copy says "according to Sunni tradition" with the same temperature as "according to Theravada accounts." Buttons say what they do: "Open deep dive," "Show all schisms," "Compare traditions."

---

## 12. Anti-patterns (hard bans)

1. No stock religious photography clichés: praying hands, sunbeam temples, lens flares.
2. No terracotta or clay accent colors anywhere near #D97757; brass is the only accent.
3. No neon, glassmorphism, gradient meshes, or dark-mode glow.
4. No emoji in content or UI.
5. No decorative use of sacred symbols, and no AI-generated imagery of sacred figures or scenes anywhere in the product.
6. No parallax scroll-jacking outside the two canvases; prose pages scroll like paper.
