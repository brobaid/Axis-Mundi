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
does not say what. Every identification below is therefore **mine, not the
reference build's** — an inference from (lane, year, rank), not a datum from
`/docs`.

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

| v5 datum | Event id | Proposed identification | Encoded date | Reasoning | Confidence |
|---|---|---|---|---|---|
| Chinese, 65, r4 | `buddhism-attested-in-china-65` | Buddhism attested in China | 65 CE, `year` | 65 CE is the edict concerning Liu Ying, Prince of Chu — the earliest secure documentary reference to a Buddhist community in China. | Medium |
| Judaism, 200, r4 | `redaction-of-the-mishnah-200` | Redaction of the Mishnah | c. 200 CE, `century` | The redaction of the Mishnah under Judah ha-Nasi is conventionally dated c. 200 and is the standard tradition-defining text event for the period. | High |
| Zoroastrianism, 224, r4 | `sasanian-empire-founded-224` | Sasanian Empire founded | 224 CE, `exact` | 224 is Ardashir I's defeat of Artabanus IV, after which Zoroastrianism became the imperial religion of Iran. | High |
| Christianity, 313, r4 | `edict-of-milan-313` | Edict of Milan | 313 CE, `exact` | **Confirmed by `/docs`:** the spec's own example record links to event id `edict-of-milan-313` (§3.2, `links.events`). This one is not an inference. | Confirmed |
| Hinduism, 400, r3 | `puranic-compilation-400` | Puranic compilation | c. 400 CE, `century` | Gupta-era compilation of the major Puranas is the usual rank-3 entry here, but the century is broad and several candidates fit equally well. | **Low** |
| Christianity, 451, r4 | `council-of-chalcedon-451` | Council of Chalcedon | 451 CE, `exact` | 451 is Chalcedon. The taxonomy already presupposes it: spec §2.3 distinguishes Eastern from Oriental Orthodox precisely by its reception. | High |
| Jainism, 453, r3 | `council-of-valabhi-453` | Council of Valabhi | c. 453 CE, `century` | The Valabhi council redacted the Svetambara Agama canon. **Dated 453 or 466 depending on the reckoning** — a contested-date candidate. | Medium |
| Judaism, 500, r4 | `babylonian-talmud-completed-500` | Babylonian Talmud completed | c. 500 CE, `century` | c. 500 is the conventional date for the Bavli reaching substantially its final form in the Mesopotamian academies. | High |
| Buddhism, 552, r4 | `buddhism-transmitted-to-japan-552` | Buddhism transmitted to Japan | c. 552 CE, `year` | 552 is the *Nihon Shoki* date for Buddhist images and texts reaching the Japanese court from Baekje. **538 is the competing date** — a contested-date candidate. | Medium |
| Zoroastrianism, 651, r4 | `fall-of-the-sasanian-empire-651` | Fall of the Sasanian Empire | 651 CE, `exact` | 651 is the death of Yazdegerd III, conventionally marking the end of the Sasanian state and of Zoroastrianism's imperial position. | High |
| Islam, 680, r4 | `battle-of-karbala-680` | Battle of Karbala | 680 CE, `exact` | 680 is Karbala. Placed on `islam/shia` because of its centrality to Shia memory and ritual. | High |
| Shinto, 712, r4 | `kojiki-compiled-712` | Kojiki compiled | 712 CE, `exact` | 712 is the presentation of the Kojiki to the court; the only rank-4 Shinto entry in the window. | High |
| Islam, 762, r3 | `foundation-of-baghdad-762` | Foundation of Baghdad | 762 CE, `exact` | 762 is al-Mansur's founding of Baghdad as the Abbasid capital. | High |
| Hinduism, 800, r4 | `advaita-vedanta-consolidated-800` | Advaita Vedanta consolidated | c. 800 CE, `century` | c. 800 is the conventional floruit of Shankara, whose Advaita commentaries are the standard rank-4 Hindu entry for the period. | Medium |
| Buddhism, 800, r3 | `buddhism-established-in-tibet-800` | Buddhism established in Tibet | c. 800 CE, `century` | Fits the first diffusion under royal patronage (Samye, c. 779), but Nalanda-period or Southeast Asian developments fit the slot too. | **Low** |
| Chinese, 845, r3 | `huichang-persecution-845` | Huichang persecution | 845 CE, `exact` | 845 is Emperor Wuzong's suppression of Buddhist institutions. Note the branch path I chose (`chinese/taoism`) encodes the Taoist court influence usually cited — that attribution also wants review. | Medium |
| Buddhism, 1000, r3 | `later-diffusion-in-tibet-1000` | Later diffusion in Tibet | c. 1000 CE, `century` | Fits the *phyi dar* later diffusion, but Song-dynasty Chan and Pure Land lineage developments fit equally well. | **Low** |

## Drilled view: Protestant, 1500–1650

Every event in this block is Christianity, on `christianity/protestant/<branch>`.

| v5 datum | Event id | Proposed identification | Encoded date | Reasoning | Confidence |
|---|---|---|---|---|---|
| Anabaptist, 1527, r3 | `schleitheim-confession-1527` | Schleitheim Confession | 1527, `exact` | The Schleitheim Articles are the earliest widely received Anabaptist confession. | High |
| Lutheran, 1530, r4 | `augsburg-confession-1530` | Augsburg Confession | 1530, `exact` | 1530 is its presentation to the Diet of Augsburg; the primary Lutheran confessional document. | High |
| Anglican, 1534, r4 | `act-of-supremacy-1534` | Act of Supremacy | 1534, `exact` | 1534 severed papal jurisdiction over the Church of England. | High |
| Anabaptist, 1534, r3 | `munster-rebellion-1534` | Münster rebellion | 1534–1535, `exact` | 1534 is the start of the Anabaptist regime at Münster, suppressed in 1535. Encoded as a range. | High |
| Reformed, 1536, r4 | `institutes-of-the-christian-religion-1536` | Institutes of the Christian Religion | 1536, `exact` | **Ambiguous:** 1536 is both the first edition of Calvin's *Institutes* and his first arrival in Geneva. The rank-4 weighting favours the *Institutes*, but 1541 already covers Geneva, which supports the reading. | Medium |
| Reformed, 1541, r3 | `calvin-returns-to-geneva-1541` | Calvin returns to Geneva | 1541, `exact` | 1541 is Calvin's return and the Ecclesiastical Ordinances. | High |
| Lutheran, 1546, r3 | `death-of-luther-1546` | Death of Martin Luther | 1546, `exact` | 1546 is Luther's death at Eisleben; the only rank-3 Lutheran entry in the window. | High |
| Anglican, 1549, r3 | `book-of-common-prayer-1549` | Book of Common Prayer | 1549, `exact` | 1549 is the first Book of Common Prayer, establishing a vernacular liturgy. | High |
| Anglican, 1611, r4 | `king-james-bible-1611` | King James Bible | 1611, `exact` | 1611 is the publication of the Authorised Version. | High |
| Reformed, 1646, r3 | `westminster-confession-1646` | Westminster Confession | 1646, `exact` | 1646 is the Assembly's completion of the Confession; it was adopted in 1647, so the encoded year may want revisiting. | Medium |

---

## Priorities

**Check these four first.** They are the ones where I would not be surprised to
be wrong, and three of them carry rank 3–4, so they will be visible early on the
timeline:

- `puranic-compilation-400` — broad century, several plausible candidates.
- `buddhism-established-in-tibet-800` — plausible but not the only reading.
- `later-diffusion-in-tibet-1000` — same.
- `institutes-of-the-christian-religion-1536` — two real events share the year.

**Then settle the two disputed dates**, which may need `contested: true` rather
than a corrected year:

- `buddhism-transmitted-to-japan-552` — 538 vs 552.
- `council-of-valabhi-453` — 453 vs 466.

## Not in scope here

Adherent figures are absent from every taxonomy node and stay absent until a
sourced file lands in `/docs`. Spec §9.2.4 makes Pew the authority for adherent
counts, and none of the attached documents carry those numbers, so the field is
left unset rather than estimated. This is deliberate, not an omission to fix.
