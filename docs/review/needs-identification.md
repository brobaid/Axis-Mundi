# Events needing identification

Status: awaiting external verification. Nothing here ships until it is checked.

---

## Why this file exists

The M0 seed took its timeline events from the greenlit reference build,
`docs/reference/living-museum-v5.html`. That file records six events with a
label and **twenty-seven with only a year, an importance rank and a lane**:

```js
const T=[
 ['Judaism','--jud',[[70,5,'Second Temple destroyed'],[200,4],[500,4]]],
 ...
```

`[200,4]` in the Judaism lane says *something* rank-4 happened around 200 CE. It
does not say what. Every identification below therefore started as **mine, not
the reference build's** — an inference from (lane, year, rank).

**Since first writing this file I found corroboration for most of them.** The
Claude Design export, `docs/design/living-museum-timeline.dc.html`, renders the
same lanes with *labelled* event nodes, e.g.:

```html
<button aria-label="Mishnah compiled, c. 200 CE" ...>
<button aria-label="Council of Valabhi, c. 453 CE" ...>
```

That is a second, independent `/docs` source naming the events at those years.
Twenty of the twenty-seven identifications below are corroborated by it and are
marked **Corroborated** — they still want a citation before shipping, but the
*identification* is no longer just my inference. The remaining seven are marked
**Inferred** and are the real worklist.

Note the export is a design deliverable, not a content one: CLAUDE.md scopes
`/docs/design/` as the "visual source of truth". Its labels are treated here as
corroboration, not as citations. A T1–T3 source is still required.

Each of these records sits at `sourcing: "todo"` and carries the tag
`needs-identification`, so none of them reach a production build. This file is
the worklist for clearing that tag.

**Verify against the year, not against my title.** The binding data is the
year–rank–lane triple from v5. If the year points at a different event than the
one I named, the title is wrong and should be replaced — the year stays.

## Clearing an entry

1. Confirm or correct the identification against a T1–T3 source (Phase 0 spec §9.1).
2. Add the citation to `src/content/sources/` as `<id>.json`.
3. Reference it from the event's `sources` array.
4. Remove the `needs-identification` tag and set `sourcing: "sourced"`.
5. Run `pnpm validate:content`. It enforces §9.2.1 — importance 3+ needs at
   least one T1–T3 source — so a half-cleared record fails the build.

If a date turns out to be genuinely disputed rather than merely uncertain, set
`contested: true` and write `contested_note` citing both positions. Uncertainty
about *when* is `precision`; disagreement about *what happened* is `contested`.
They are different fields and mean different things.

---

## World lanes, 0–1200 CE

| v5 datum | Event id | Proposed identification | Encoded date | Design export says | Status |
|---|---|---|---|---|---|
| Chinese, 65, r4 | `buddhism-attested-in-china-65` | Buddhism attested in China | 65 CE, `year` | "Buddhism enters China, c. 67 CE" — **but in the Buddhism lane, not Chinese, and dated 67** | Corroborated, two discrepancies |
| Judaism, 200, r4 | `redaction-of-the-mishnah-200` | Redaction of the Mishnah | c. 200 CE, `century` | "Mishnah compiled, c. 200 CE" | Corroborated |
| Zoroastrianism, 224, r4 | `sasanian-empire-founded-224` | Sasanian Empire founded | 224 CE, `exact` | "Sasanian state religion, 224 CE" — frames it as the religion's establishment, not the dynasty's | Corroborated, framing differs |
| Christianity, 313, r4 | `edict-of-milan-313` | Edict of Milan | 313 CE, `exact` | "Edict of Milan, 313 CE" — and the spec's example record links to this exact id (§3.2, `links.events`) | **Confirmed by two `/docs` sources** |
| Hinduism, 400, r3 | `puranic-compilation-400` | Puranic compilation | c. 400 CE, `century` | "Puranas take shape, c. 400 CE" | Corroborated |
| Christianity, 451, r4 | `council-of-chalcedon-451` | Council of Chalcedon | 451 CE, `exact` | "Council of Chalcedon, 451 CE" | Corroborated |
| Jainism, 453, r3 | `council-of-valabhi-453` | Council of Valabhi | c. 453 CE, `century` | "Council of Valabhi, c. 453 CE" | Corroborated |
| Judaism, 500, r4 | `babylonian-talmud-completed-500` | Babylonian Talmud completed | c. 500 CE, `century` | "Babylonian Talmud completed, c. 500 CE" | Corroborated |
| Buddhism, 552, r4 | `buddhism-transmitted-to-japan-552` | Buddhism transmitted to Japan | c. 552 CE, `year` | "Buddhism reaches Japan, 552 CE" — note the export does **not** hedge the date | Corroborated |
| Zoroastrianism, 651, r4 | `fall-of-the-sasanian-empire-651` | Fall of the Sasanian Empire | 651 CE, `exact` | "Fall of the Sasanians, 651 CE" | Corroborated |
| Islam, 680, r4 | `battle-of-karbala-680` | Battle of Karbala | 680 CE, `exact` | "Battle of Karbala, 680 CE" | Corroborated |
| Shinto, 712, r4 | `kojiki-compiled-712` | Kojiki compiled | 712 CE, `exact` | "Kojiki compiled, 712 CE" | Corroborated |
| Islam, 762, r3 | `foundation-of-baghdad-762` | Foundation of Baghdad | 762 CE, `exact` | "Baghdad founded, 762 CE" | Corroborated |
| Hinduism, 800, r4 | `advaita-vedanta-consolidated-800` | Advaita Vedanta consolidated | c. 800 CE, `century` | "Adi Shankara born, c. 788 CE" — same figure, but a birth rather than a consolidation, and dated 788 | Corroborated, framing and date differ |
| Buddhism, 800, r3 | `buddhism-established-in-tibet-800` | Buddhism established in Tibet | c. 800 CE, `century` | Nothing at 800. The export's nearest Buddhist entries are "Borobudur begun, c. 760" and "Atisha arrives in Tibet, 1042" | **Inferred** |
| Chinese, 845, r3 | `huichang-persecution-845` | Huichang persecution | 845 CE, `exact` | "Huichang persecution, 845 CE" — in the Chinese lane, so my `chinese/taoism` branch path is narrower than the export's | Corroborated, branch path differs |
| Buddhism, 1000, r3 | `later-diffusion-in-tibet-1000` | Later diffusion in Tibet | c. 1000 CE, `century` | Nothing at 1000; "Atisha arrives in Tibet, 1042" is the nearest and is a different event | **Inferred** |

## Drilled view: Protestant, 1500–1650

Every event in this block is Christianity, on `christianity/protestant/<branch>`.

| v5 datum | Event id | Proposed identification | Encoded date | Design export says | Status |
|---|---|---|---|---|---|
| Anabaptist, 1527, r3 | `schleitheim-confession-1527` | Schleitheim Confession | 1527, `exact` | Nothing at 1527; the export's Anabaptist entries are "First believers' baptism, Zurich, 1525" and "Menno Simons ordained, 1536" | **Inferred** |
| Lutheran, 1530, r4 | `augsburg-confession-1530` | Augsburg Confession | 1530, `exact` | "Augsburg Confession, 1530" | Corroborated |
| Anglican, 1534, r4 | `act-of-supremacy-1534` | Act of Supremacy | 1534, `exact` | "Act of Supremacy, 1534" | Corroborated |
| Anabaptist, 1534, r3 | `munster-rebellion-1534` | Münster rebellion | 1534–1535, `exact` | Nothing at 1534 in the Anabaptist lane | **Inferred** |
| Reformed, 1536, r4 | `institutes-of-the-christian-religion-1536` | Institutes of the Christian Religion | 1536, `exact` | "Institutes of the Christian Religion published, 1536" — settles the ambiguity with Calvin's arrival in Geneva | Corroborated |
| Reformed, 1541, r3 | `calvin-returns-to-geneva-1541` | Calvin returns to Geneva | 1541, `exact` | Nothing at 1541; the export has "Geneva Academy founded, 1559" | **Inferred** |
| Lutheran, 1546, r3 | `death-of-luther-1546` | Death of Martin Luther | 1546, `exact` | "Death of Luther, 1546" | Corroborated |
| Anglican, 1549, r3 | `book-of-common-prayer-1549` | Book of Common Prayer | 1549, `exact` | "Book of Common Prayer, 1549" | Corroborated |
| Anglican, 1611, r4 | `king-james-bible-1611` | King James Bible | 1611, `exact` | "King James Bible, 1611" | Corroborated |
| Reformed, 1646, r3 | `westminster-confession-1646` | Westminster Confession | 1646, `exact` | "Westminster Confession, 1646" | Corroborated |

---

## Priorities

**1. The five genuinely unidentified.** Nothing in `/docs` names an event at
these years, so these are inference alone:

- `buddhism-established-in-tibet-800`
- `later-diffusion-in-tibet-1000`
- `schleitheim-confession-1527`
- `munster-rebellion-1534`
- `calvin-returns-to-geneva-1541`

**2. The four where v5 and the design export disagree.** Both are `/docs`, so
one of them has to win, and that is a decision rather than a lookup:

| Event | v5 says | Export says | Question |
|---|---|---|---|
| `buddhism-attested-in-china-65` | 65, Chinese lane | c. 67, **Buddhism** lane | Which year, and whose lane? |
| `advaita-vedanta-consolidated-800` | 800, r4 | c. 788, "Adi Shankara born" | A `text` event or a `figure` event? |
| `sasanian-empire-founded-224` | 224, r4 | "Sasanian state religion" | The dynasty, or the religion's establishment? |
| `huichang-persecution-845` | Chinese lane | Chinese lane | I narrowed it to `chinese/taoism`; the export keeps it at tradition level. Mine is probably too specific. |

**3. Two dates worth checking for dispute rather than uncertainty.** Neither
`/docs` source flags them, but both are contested in the literature, and spec §10
wants disputes rendered rather than silently resolved:

- `buddhism-transmitted-to-japan-552` — 538 vs 552. The export gives a bare
  "552"; v5 gives 552. Neither hedges, but the *Nihon Shoki* and *Gangoji Engi*
  datings differ, so this may want `contested: true`.
- `council-of-valabhi-453` — 453 vs 466. Both sources say "c. 453".

## Events in the design export but not in v5

The export renders fourteen events the reference build does not carry, e.g.
"Christianization of Kievan Rus, 988", "First revelation, 610", "Fatimid
caliphate proclaimed, 909", "Way of the Celestial Masters founded, 142",
"Engishiki completed, 927", "Parsi settlement at Sanjan, c. 936", "Synod of
Dort, 1618". They are **not** seeded — M0 scoped the seed to v5, and adding
them is a content decision, not a build one. Flagging them here so the surplus
is a choice rather than an oversight.

## Not in scope here

Adherent figures are absent from every taxonomy node and stay absent until a
sourced file lands in `/docs`. Spec §9.2.4 makes Pew the authority for adherent
counts, and none of the attached documents carry those numbers, so the field is
left unset rather than estimated. This is deliberate, not an omission to fix.
