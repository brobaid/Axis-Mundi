# Axis Mundi Adherent Figures, 2020

Destination: `/docs/sourcing/adherents-2020.md`. Authority per spec 9.2.4 is Pew;
Pew's 2025 study enumerates Christians, Muslims, Hindus, Buddhists, and Jews,
and folds Sikhs, Jains, Shintoists, Zoroastrians, and Daoists into a combined
"other religions" category. The non-Pew bases below are therefore explicitly
noted, which is the "unless explicitly noted otherwise" clause of the spec.

| Tradition | Adherents (2020) | Display | Source | Basis note |
|---|---|---|---|---|
| Christianity | 2.3 billion (28.8%) | "2.3 bn (Pew, 2020)" | `pew-grl-2025` | Enumerated by Pew |
| Islam | 2.0 billion (25.6%) | "2.0 bn (Pew, 2020)" | `pew-grl-2025` | Enumerated by Pew. Supersedes the v5 stat box's 1.9 bn |
| Hinduism | 1.2 billion (14.9%) | "1.2 bn (Pew, 2020)" | `pew-grl-2025` | Enumerated by Pew |
| Buddhism | 324 million (4.1%) | "324 m (Pew, 2020)" | `pew-grl-2025` | Enumerated by Pew; the only major group that shrank 2010-2020 |
| Judaism | 14.8 million (0.2%) | "14.8 m (Pew, 2020)" | `pew-grl-2025` | Enumerated by Pew; definitional notes on Israel vs diaspora counting in the report |
| Sikhism | approx. 26 million | "≈26 m (census + estimates)" | `india-census-2011` | 20.8 m in India per census 2011 plus diaspora estimates; not enumerated by Pew |
| Jainism | approx. 4.5 million | "≈4.5 m (census + estimates)" | `india-census-2011` | 4.45 m in India per census 2011 plus small diaspora; not enumerated by Pew |
| Shinto | contested by definition | "see note" | `japan-aca-yearbook` | Set `contested: true`. Shrine-affiliation registers count roughly 80-90 m; self-identification surveys yield a few percent of Japan's population. Both positions render, neither is "the" number |
| Zoroastrianism | approx. 110-120 thousand | "≈110-120 k (community surveys)" | `fezana-demographics` | Community demographic surveys; India census 2011 counts 57,264 Parsis; not enumerated by Pew |
| Chinese traditions | no single authoritative figure | "see note" | `pew-grl-2025` | Formal zongjiao identification in the PRC is about 10% across all religions per Pew 2025; scholarly estimates of folk religious practice run to hundreds of millions. Render the note, not a false point estimate. Taiwan is the one "other religions"-majority polity per Pew |

## Rendering rules

1. Stat boxes use the Display column verbatim.
2. Shinto and Chinese traditions render their notes with the contested or
   no-single-figure treatment; never coerce either to one number.
3. Percentages are of world population, 2020, per `pew-grl-2025`.

## Future use

Pew publishes the country-level 2010-2020 composition table and dataset
alongside this study. That table is the designated source for the map's 2020
and 1950-adjacent snapshots when M3 data work begins; note it here so the
snapshot memos start from the same authority.
