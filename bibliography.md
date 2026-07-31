# Axis Mundi Bibliography Seed

Destination: `/docs/sourcing/bibliography.md`. Prepared and verified by the owner's
reviewer. This file authorizes the mappings below; Claude Code applies them
mechanically and does not extend them by inference.

## Source registry

Create one record per row in `src/content/sources/<id>.json`.

| id | Tier | Citation |
|---|---|---|
| `pew-grl-2025` | T2 | Hackett, Stonawski, Tong, Kramer, Shi and Fahmy. 2025. "How the Global Religious Landscape Changed From 2010 to 2020." Pew Research Center. doi:10.58094/fj71-ny11 |
| `britannica` | T3 | Encyclopaedia Britannica Online, cited per entry as s.v. "<entry title>" |
| `macculloch-christianity-2009` | T1 | MacCulloch, Diarmaid. 2009. Christianity: The First Three Thousand Years. Allen Lane |
| `oxford-early-christian-studies-2008` | T1 | Harvey, Susan Ashbrook and David G. Hunter, eds. 2008. The Oxford Handbook of Early Christian Studies. Oxford University Press |
| `macculloch-reformation-2003` | T1 | MacCulloch, Diarmaid. 2003. Reformation: Europe's House Divided 1490-1700. Allen Lane |
| `nchi-2010` | T1 | Cook, Michael, gen. ed. 2010. The New Cambridge History of Islam. 6 vols. Cambridge University Press |
| `esposito-straight-path` | T1 | Esposito, John L. Islam: The Straight Path. Oxford University Press |
| `ei3` | T1 | Fleet, Kramer, Matringe, Nawas and Stewart, eds. Encyclopaedia of Islam, THREE. Brill |
| `chj` | T1 | Davies, Finkelstein, Horbury, Sturdy and Katz, eds. The Cambridge History of Judaism. 4 vols. Cambridge University Press |
| `ej2-2007` | T1 | Berenbaum, Michael and Fred Skolnik, eds. 2007. Encyclopaedia Judaica. 2nd ed. Macmillan Reference |
| `flood-hinduism-1996` | T1 | Flood, Gavin. 1996. An Introduction to Hinduism. Cambridge University Press |
| `harvey-buddhism-2013` | T1 | Harvey, Peter. 2013. An Introduction to Buddhism. 2nd ed. Cambridge University Press |
| `princeton-dict-buddhism-2014` | T1 | Buswell, Robert E. and Donald S. Lopez. 2014. The Princeton Dictionary of Buddhism. Princeton University Press |
| `mcleod-sikhism-1997` | T1 | McLeod, W.H. 1997. Sikhism. Penguin |
| `yao-confucianism-2000` | T1 | Yao, Xinzhong. 2000. An Introduction to Confucianism. Cambridge University Press |
| `kohn-daoism-2000` | T1 | Kohn, Livia, ed. 2000. Daoism Handbook. Brill |
| `hardacre-shinto-2017` | T1 | Hardacre, Helen. 2017. Shinto: A History. Oxford University Press |
| `dundas-jains-2002` | T1 | Dundas, Paul. 2002. The Jains. 2nd ed. Routledge |
| `boyce-zoroastrians` | T1 | Boyce, Mary. Zoroastrians: Their Religious Beliefs and Practices. Routledge |
| `wiley-zoroastrianism-2015` | T1 | Stausberg, Michael and Yuhan Sohrab-Dinshaw Vevaina, eds. 2015. The Wiley Blackwell Companion to Zoroastrianism. Wiley Blackwell |
| `india-census-2011` | T2 | Government of India. 2011. Census of India, Religion tables (C-01) |
| `japan-aca-yearbook` | T2 | Agency for Cultural Affairs, Japan. Shukyo Nenkan (Religious Yearbook), annual |
| `fezana-demographics` | T3 | FEZANA Journal demographic surveys of the worldwide Zoroastrian population |

## Default event mapping rule

Every seeded event receives two sources: its tradition's T1 work from the table
below, plus `britannica` s.v. the event's title. This satisfies spec 9.2.1
(importance 3+ requires at least one T1-T3 source) with a T1 and a T3.

| Tradition | Default T1 |
|---|---|
| Christianity, pre-1500 | `oxford-early-christian-studies-2008` (to 600 CE) or `macculloch-christianity-2009` (600-1500) |
| Christianity, 1500-1700 | `macculloch-reformation-2003` |
| Islam | `nchi-2010` |
| Judaism | `ej2-2007` |
| Hinduism | `flood-hinduism-1996` |
| Buddhism | `princeton-dict-buddhism-2014` |
| Sikhism | `mcleod-sikhism-1997` |
| Chinese traditions | `kohn-daoism-2000` for Taoist entries, `yao-confucianism-2000` for Confucian entries, both for tradition-level entries |
| Shinto | `hardacre-shinto-2017` |
| Jainism | `dundas-jains-2002` |
| Zoroastrianism | `boyce-zoroastrians` |

## Explicit exceptions and confirmations

- `buddhism-attested-in-china-65` and `huichang-persecution-845` (multi-tradition): cite `princeton-dict-buddhism-2014` plus the Chinese default plus `britannica`.
- `buddhism-established-in-tibet-800` (Samye, 779), `later-diffusion-in-tibet-1000`, and the export events for Borobudur and Atisha: `princeton-dict-buddhism-2014` covers all four; keep `britannica` as second source.
- All Protestant-drill events, including the export's believers'-baptism, Menno Simons, Geneva Academy, and Synod of Dort entries: `macculloch-reformation-2003` plus `britannica`.
- Sasanian pair (224, 651) and the Sanjan settlement: `boyce-zoroastrians` plus `britannica`; Sanjan keeps its contested-date note per the earlier ruling.
- `kojiki-compiled-712` and the Engishiki export event: `hardacre-shinto-2017` plus `britannica`.
- The existing Esposito citation on the Islam misconception card stands.

## Matrix cells and glossary

Matrix cells and glossary definitions satisfy spec 9.2.2 by citing the
tradition's default T1 from the table above. Cells describing self-understood
doctrine may add a labeled T4 later; none is required for launch.

## Rule for anything unmapped

If an event, cell, or term does not fall under the default rule or an explicit
exception, it stays gated and gets flagged in the promotion report. This file
does not authorize inferred mappings.
