# Claude Design Handoff: The Living Museum

Attach these three files, then paste everything below the line:
1. `living-museum-v5.html` (the greenlit reference build)
2. `religions-dashboard-design-language.md`
3. `religions-dashboard-phase0-spec.md`

If web capture is available, also capture the v5 file open in a browser so the real interface patterns import directly.

---

You are the design lead on an interactive religions dashboard called the Living Museum. A greenlit reference build is attached (`living-museum-v5.html`). Your job is refinement and extension, not reinvention: the concept, tokens, signature element, and the seven built screens are settled. Build your design system directly from the reference.

## Settled system (binding)

- **Concept:** a museum that moves. Light "Gallery" mode is the default; dark "Night Gallery" is the same rooms after hours. Never neon, never terracotta, nothing near #D97757.
- **Signature:** the Brass Meridian, one thin brass time cursor that is the same physical object on the timeline, the map scrubber, and deep-dive margins.
- **Tokens.** Light: canvas #F7F3EC, surface #FDFBF7, ink #201B16, ink-soft #5C544A, hairline #E3DCD0, brass #9C7A2F, link #6E5620, ocean #EAE0CC, land #F3ECDC. Dark: canvas #14110D, surface #1D1915, ink #EDE7DC, ink-soft #A89F92, hairline #2E2822, brass #C9A250, ocean #0F0D0A, land #241F18.
- **Tradition hues (light base):** Judaism #2B6CB0, Christianity #6B46A0, Islam #1E7A4C, Hinduism #D9740B, Buddhism #8A3033, Sikhism #2F3B7A, Chinese traditions #C9A100, Shinto #D34E3A, Jainism #147D77, Zoroastrianism #B3382C. Branches use stepped tints of the parent, never new hues. Color is never the only signal.
- **Type:** Newsreader (display), Source Serif 4 (prose, 17/1.6), Archivo (UI, small-caps eyebrows), IBM Plex Mono (dates, data). Original scripts in Noto per-script faces, slightly larger than surrounding Latin, full RTL.
- **Recurring components:** exhibit labels (small-caps eyebrow, rule, mono values), framed plates with caption and credit, contested badge with diagonal hatching, confidence grades (A solid, B 60%, C hatched), curved small-cap realm labels with paper halos on the atlas-style map.
- **Motion:** calm and physical. 280ms panels with 20% canvas dim, 600ms crossfades, eleven-day festival drift on the year wheel. Reduced motion collapses to cuts.

## Your work items, in priority order

1. **Polish loop on the seven built screens** (Home, Timeline with drill and event sheet, Map, Deep dive, Matrix, Compare, Family tree, Year wheel). Refine spacing, type rhythm, and alignment at 1440 and 390. Do not change the layout logic; make it immaculate.
2. **The tradition symbol set**, the one pending asset: ten line-art symbols (cross, crescent and star, Star of David, Om, dharmachakra, khanda, taijitu, torii, Jain hand with wheel, faravahar) on a 24px grid, 1.5px stroke, rounded caps, vetted for correct form. They live in lane headers, chips, and deep-dive mastheads only, never as decoration.
3. **Remaining modules in the same language:** demographics river (stacked area, 1900 to 2050), scrollytelling journey template (map plus timeline choreography), universal search overlay, living calendars widget (today in five calendar systems), sound library cards, architecture cutaway template, symbol explorer, life-arc rites comparison.
4. **Dark variants** of every screen not yet shown dark.
5. **Developer export pack:** tokens as JSON, a one-sheet component inventory, and redlines for the timeline canvas and event sheet.

## Hard bans

Stock religious photography, sacred symbols as decoration, AI-generated depictions of sacred figures, emoji, glassmorphism, gradient meshes, dark-mode glow, terracotta or clay accents.

## Quality floor

WCAG AA in both modes, brass focus rings, 44px touch targets, visible keyboard order, reduced motion respected. Before delivering each screen, check it against the reference build and the bans list, then remove one decorative element you don't need.
