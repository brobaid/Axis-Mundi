# Map Snapshot Memo: 2020

Destination: `/docs/slates/snapshot-2020-memo.md`, with the generated
`/docs/slates/ce-2020.geojson` as its output. Authored by the owner's reviewer.
This is the first real era snapshot; it replaces the corresponding fixture.

## Method and rulings

1. Source: the entire snapshot rests on one authority, Pew's "How the Global
   Religious Landscape Changed From 2010 to 2020" (Hackett et al. 2025,
   doi:10.58094/fj71-ny11) and its country-level composition table. Every
   feature cites `pew-grl-2025`.
2. Category mapping: Pew's Christians, Muslims, Hindus, Buddhists, and Jews map
   to their traditions; Pew's "other religions" majority exists only in Taiwan
   and maps to chinese-traditions per Pew's own note; Pew's religiously
   unaffiliated majority maps to a NEW renderable category, `unaffiliated`,
   distinct from outside-scope: neutral tone, its own legend entry, never
   hatched for being secular.
3. Grades: A for clear majorities, B for pluralities and sub-55% majorities
   documented in the report (the UK at 49%, France at 46%, Australia at 47%,
   and the unaffiliated majorities of the Netherlands, Uruguay, and New
   Zealand among them), C only for Nigeria, where the Christian-Muslim balance
   is genuinely disputed across sources.
4. Consequence worth stating on the methodology page: five of the ten launch
   traditions are a majority nowhere on Earth in 2020. Shinto's own homeland
   renders unaffiliated, because Pew's affiliation measure and Japanese
   practice diverge, and the map honestly shows the measure it cites.
5. Geometry: Natural Earth 110m country polygons, unprojected; the engine
   projects. 175 features; the French Southern Territories are omitted.

## Assignments by tradition (grade in parentheses)

**christianity** (103): Angola (A), Argentina (A), Armenia (A), Australia (B), Austria (A), Bahamas (A), Belarus (A), Belgium (A), Belize (A), Benin (B), Bolivia (A), Botswana (A), Brazil (A), Bulgaria (A), Burundi (A), Cameroon (A), Canada (A), Central African Rep. (A), Chile (A), Colombia (A), Congo (A), Costa Rica (A), Croatia (A), Cuba (B), Cyprus (A), Dem. Rep. Congo (A), Denmark (A), Dominican Rep. (A), Ecuador (A), El Salvador (A), Eq. Guinea (A), Eritrea (C), Ethiopia (B), Falkland Is. (A), Fiji (A), Finland (A), France (B), Gabon (A), Georgia (A), Germany (B), Ghana (A), Greece (A), Greenland (A), Guatemala (A), Guyana (B), Haiti (A), Honduras (A), Hungary (A), Iceland (A), Ireland (A), Italy (A), Jamaica (A), Kenya (A), Latvia (B), Lesotho (A), Liberia (A), Lithuania (A), Luxembourg (A), Macedonia (A), Madagascar (A), Malawi (A), Mexico (A), Moldova (A), Montenegro (A), Mozambique (A), Namibia (A), New Caledonia (A), Nicaragua (A), Norway (A), Panama (A), Papua New Guinea (A), Paraguay (A), Peru (A), Philippines (A), Poland (A), Portugal (A), Puerto Rico (A), Romania (A), Russia (A), Rwanda (A), S. Sudan (A), Serbia (A), Slovakia (A), Slovenia (A), Solomon Is. (A), South Africa (A), Spain (A), Suriname (C), Sweden (A), Switzerland (A), Tanzania (B), Timor-Leste (A), Togo (C), Trinidad and Tobago (A), Uganda (A), Ukraine (A), United Kingdom (B), United States of America (A), Vanuatu (A), Venezuela (A), Zambia (A), Zimbabwe (A), eSwatini (A)

**islam** (51): Afghanistan (A), Albania (B), Algeria (A), Azerbaijan (A), Bangladesh (A), Bosnia and Herz. (B), Brunei (A), Burkina Faso (B), Chad (B), Côte d'Ivoire (B), Djibouti (A), Egypt (A), Gambia (A), Guinea (A), Guinea-Bissau (B), Indonesia (A), Iran (A), Iraq (A), Jordan (A), Kazakhstan (B), Kosovo (A), Kuwait (A), Kyrgyzstan (A), Lebanon (B), Libya (A), Malaysia (A), Mali (A), Mauritania (A), Morocco (A), N. Cyprus (A), Niger (A), Nigeria (C), Oman (A), Pakistan (A), Palestine (A), Qatar (A), Saudi Arabia (A), Senegal (A), Sierra Leone (A), Somalia (A), Somaliland (A), Sudan (A), Syria (A), Tajikistan (A), Tunisia (A), Turkey (A), Turkmenistan (A), United Arab Emirates (A), Uzbekistan (A), W. Sahara (A), Yemen (A)

**unaffiliated** (10): China (A), Czechia (A), Estonia (B), Japan (A), Netherlands (A), New Zealand (B), North Korea (A), South Korea (B), Uruguay (B), Vietnam (A)

**buddhism** (7): Bhutan (A), Cambodia (A), Laos (A), Mongolia (B), Myanmar (A), Sri Lanka (A), Thailand (A)

**hinduism** (2): India (A), Nepal (A)

**judaism** (1): Israel (A)

**chinese-traditions** (1): Taiwan (A)
