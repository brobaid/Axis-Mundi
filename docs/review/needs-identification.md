# Events needing identification

**Status: resolved.** All twenty-seven identifications were reviewed and ruled on
by the owner. The `needs-identification` tag has been cleared from every event.
This file is kept as the record of what was decided and why.

Records remain gated at `sourcing: "todo"` — identification is settled, sourcing
is not. Promotion is on hold until a bibliography and a Pew adherent file land
in `/docs`.

---

## What this was

The M0 seed took its timeline events from the greenlit reference build,
`docs/reference/living-museum-v5.html`. That file records six events with a
label and twenty-seven with only a year, an importance rank and a lane:

```js
const T=[
 ['Judaism','--jud',[[70,5,'Second Temple destroyed'],[200,4],[500,4]]],
 ...
```

`[200,4]` says *something* rank-4 happened around 200 CE in the Judaism lane. It
does not say what. The twenty-seven identifications below were inferences from
(lane, year, rank).

Twenty were then corroborated by a second `/docs` source: the Claude Design
export, `docs/design/living-museum-timeline.dc.html`, renders the same lanes
with labelled nodes (`aria-label="Mishnah compiled, c. 200 CE"`). The owner
reviewed the remainder directly.

---

## Rulings applied

### 1. The five genuinely unidentified — all confirmed

| Event | Ruling | Applied |
|---|---|---|
| `buddhism-established-in-tibet-800` | Confirmed; retitle and redate | Title "Buddhism established in Tibet (Samye Monastery founded)", **779**, `precision: year` |
| `later-diffusion-in-tibet-1000` | Confirmed; retitle | Title "Later diffusion of Buddhism in Tibet (phyi dar) begins", c. 1000, `precision: century` |
| `munster-rebellion-1534` | Confirmed | 1534–1535, `type: political` |
| `schleitheim-confession-1527` | Confirmed | unchanged |
| `calvin-returns-to-geneva-1541` | Confirmed | unchanged |

The two Tibet ids keep their original `-800` and `-1000` suffixes. Spec §3 makes
ids "unique, stable, never recycled"; the suffix is a slug convenience, not data,
and renaming a published id costs more than the mild mismatch.

### 2. Where v5 and the design export disagreed

| Event | Ruling | Applied |
|---|---|---|
| `buddhism-attested-in-china-65` | Keep 65; note c. 67 in the body; one multi-tradition record | `traditions: [buddhism, chinese]`, `branch_path: [buddhism, chinese]`, body records both datings and why 65 was kept |
| `advaita-vedanta-consolidated-800` | Becomes a figure event | Title "Adi Shankara", **788–820**, `precision: century`, `type: figure` |
| `sasanian-empire-founded-224` | Adopt the export's framing | Title "Zoroastrianism established as Sasanian state religion", `type: political` |
| `huichang-persecution-845` | Reverse the branch narrowing | `branch_path: [chinese, buddhism]` at tradition level, `traditions: [chinese, buddhism]`, `type: persecution` |

Per Phase 0 §3, multi-tradition events are one record and never duplicated, so
China-65 and Huichang-845 each stay a single record naming both traditions.

### 3. Disputed dates, now rendered as disputes

Both carry `contested: true` with a note citing both positions, per spec §9.2.3
and §10. Neither is silently resolved.

- `buddhism-transmitted-to-japan-552` — the *Nihon Shoki* gives 552, which the
  record follows; the *Gangoji Garan Engi* and the *Jogu Shotoku Hoo Teisetsu*
  give 538, which much modern scholarship prefers.
- `council-of-valabhi-453` — 453 on one reckoning of the traditional chronology,
  466 on another, the two differing by the interval taken from the death of
  Mahavira. The record follows 453.

`parsi-settlement-at-sanjan-936` is tagged `contested-date-candidate` rather than
set contested: the ruling flagged it as a candidate, and asserting a dispute
means citing both positions, which no source in `/docs` yet supports.

### 4. Export-only events, seeded and gated

Fifteen — not fourteen, as an earlier draft of this file said. The full
enumeration is: the export renders 43 event nodes, 28 of which match a v5
record, leaving 15.

All are seeded with `sourcing: "todo"` and tagged `from-design-export`. Ranks are
the export's own, read from its dot geometry (13px = rank 5, 9px = 4, 6px = 3).
Lane placement follows the export's lanes, which keeps world-lane events at
tradition level — the same correction ruling 5 applied to Huichang.

| Event | Year | Rank | Tradition |
|---|---|---|---|
| `christianization-of-kievan-rus-988` | 988 | 3 | Christianity |
| `first-revelation-610` | 610 | 4 (per ruling) | Islam |
| `fatimid-caliphate-proclaimed-909` | 909 | 3 | Islam |
| `ramanuja-teaches-1100` | c. 1100 | 3 | Hinduism |
| `borobudur-begun-760` | c. 760 | 3 | Buddhism |
| `atisha-arrives-in-tibet-1042` | 1042 | 3 | Buddhism |
| `way-of-the-celestial-masters-founded-142` | 142 | 4 | Chinese traditions |
| `neo-confucian-revival-1070` | c. 1070 | 3 | Chinese traditions |
| `engishiki-completed-927` | 927 | 3 | Shinto |
| `gommateshwara-consecrated-981` | 981 | 3 | Jainism |
| `parsi-settlement-at-sanjan-936` | c. 936 | 3 | Zoroastrianism |
| `geneva-academy-founded-1559` | 1559 | 3 | Christianity / Reformed |
| `synod-of-dort-1618` | 1618–1619 | 3 | Christianity / Reformed |
| `first-believers-baptism-zurich-1525` | 1525 | 3 | Christianity / Anabaptist |
| `menno-simons-ordained-1536` | 1536 | 3 | Christianity / Anabaptist |

`way-of-the-celestial-masters-founded-142` carries no `region`: the movement
began in Sichuan, which is not among the seeded macro-regions, and guessing a
region would be inventing geography. Two regions were added for the rest:
`eastern-europe` and `java`.

---

## Still open

**Sourcing.** Every event except `council-of-nicaea-325` sits at
`sourcing: "todo"` and is excluded from production builds. Promotion needs a
bibliography in `/docs`; then each record takes its citations, flips to
`"sourced"`, and `pnpm validate:content` enforces spec §9.2.1 — importance 3+
requires at least one T1–T3 source.

**Adherent figures.** Still unset on every taxonomy node, and staying that way
until a sourced Pew file lands in `/docs`. Spec §9.2.4 makes Pew the authority;
none of the attached documents carry the numbers.

**A rendering note, for whenever the above lands.** `precision: century` renders
as the century containing the year — `453` becomes "5th century CE" — whereas
the design export writes the same dates as "c. 453 CE". Both are honest; they
are different idioms. If the export's idiom is preferred on the canvas, the
affected records want `precision: year` instead, which renders "c. 453 CE". This
is a rendering decision, not a data one, and nothing depends on it yet.

**The `chinese` tradition id.** The rulings refer to this tradition as
`chinese-traditions`. The id in the codebase is `chinese` (display name "Chinese
traditions"), set in `src/schemas/primitives.ts` and used by the hue token,
the symbol sprite and every taxonomy path. It has been left alone: renaming an
id touches the token set, the taxonomy and every event that references it, and
reads as a naming preference rather than a ruling. Say the word and it is a
contained rename.
