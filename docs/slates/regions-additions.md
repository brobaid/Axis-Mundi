# Region Additions and Slate Mapping

Destination: `/docs/slates/regions-additions.md`. Owner ruling: the repo's
existing macro-region vocabulary is better than the slates' ad-hoc ids, so the
slates conform to it. All five of your proposed Christianity renames are
confirmed, extended below into a complete mapping for both slates, plus nine new
records in the existing schema and style.

## New region records (match the existing schema exactly)

| id | name | kind | note |
|---|---|---|---|
| nile-valley | Nile Valley | macro-region | Historical macro-region. Borders are a scholarly convention, not a fact. |
| western-europe | Western Europe | macro-region | Historical macro-region. Borders are a scholarly convention, not a fact. |
| frankish-lands | Frankish Lands | macro-region | Historical macro-region covering Gaul and later France. Borders are a scholarly convention, not a fact. |
| russian-lands | Russian Lands | macro-region | Historical macro-region covering Muscovy and the later Russian sphere. Borders are a scholarly convention, not a fact. |
| north-america | North America | macro-region | Modern macro-region. |
| punjab | Punjab | macro-region | Historical macro-region. Borders are a scholarly convention, not a fact. |
| south-asia | South Asia | macro-region | Modern macro-region for subcontinent-wide events. |
| west-africa | West Africa | macro-region | Historical macro-region covering the Sahel and forest belt. Borders are a scholarly convention, not a fact. |
| malay-archipelago | Malay Archipelago | macro-region | Historical macro-region; the existing java record sits within it, and both may be referenced at their own granularity. |

## Slate id mapping (apply to both slates)

| Slate id | Maps to |
|---|---|
| italy | italian-peninsula |
| germany | german-lands |
| england | british-isles |
| switzerland | swiss-confederation |
| europe-east | eastern-europe |
| persia | iranian-plateau |
| iraq | mesopotamia |
| hejaz | arabia |
| egypt | nile-valley |
| europe-west | western-europe |
| france | frankish-lands |
| russia | russian-lands |
| southeast-asia | malay-archipelago |
| west-africa | west-africa (new record above) |
| north-america | north-america (new record above) |

## Per-row exceptions for `south-asia` in the Islam slate

The blanket id was too coarse; map row by row:

| Event | Region |
|---|---|
| conquest-of-sindh-711 | western-india |
| delhi-sultanate-1206 | gangetic-plain |
| mughal-empire-1526 | gangetic-plain |
| deoband-founded-1867 | gangetic-plain |
| ahmadiyya-founded-1889 | punjab |
| partition-of-india-1947 | south-asia |

Punjab is added now deliberately; the Sikhism slate will lean on it heavily.

## Standing rule for future slates

Future slates use the repo's region vocabulary as extended here. If a future
slate still introduces an unknown id, hold that row and flag it as you did;
that behavior was correct.
