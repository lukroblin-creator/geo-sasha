# Quiz reference data

`quizRewards.ts` derives the initial achievement catalog from retained quiz
history. It awards progress for completing a game, using three modes, earning
at least 90% of available points in one game, finishing a quiz of at least 25
questions, five clean first-try answers, improving a score for the same
configuration, and a timed game with at least 85% of points and an average of
at most 15 seconds per recorded question.
Question-based games with missing question rows, expired games, and timed-out or
not-reached questions do not count as valid performances. Estimation and Draw
Borders intentionally store no question rows, so they can contribute to score
achievements but not the 25-question badge, per-question speed achievement, or
answer streaks.

No generic difficulty achievement is defined: the current quiz model has
different modes and settings but no reliable, shared difficulty level. Older
history without timing remains useful for untimed achievements and never gets
an invented duration. Achievements are calculated in memory rather than stored
separately; they reflect the history entries currently retained by
`quizHistory.ts` (up to 500). The history module also keeps entries in memory
for the current app session when `localStorage` is unavailable.

`countryCatalog.json` is the offline 195-country catalog used by quiz modes. Its
numeric identifiers match the bundled Natural Earth country features.

`countryCapitals.json` is generated from the [UNGEGN World Geographical Names
API](https://ungegn-api.azurewebsites.net/swagger/index.html), which publishes
country capitals and city records keyed by UN M49 code. The app reads only the
checked-in JSON file at runtime; it does not contact the API.

Regenerate the capital file during development with `npm run update:capital-data`.
The generator validates that every catalog entry has exactly one capital.

The generator documents deliberate choices for data the source omits or lists
more than once: Sucre for Bolivia, East Jerusalem for Palestine, Vatican City
for the Holy See, Jerusalem for Israel, and Astana for Kazakhstan. The
Kazakhstan override follows its [current official country profile](https://www.gov.kz/article/19305?lang=en).
The Palestine entry records East Jerusalem as the claimed capital and notes
Ramallah as the administrative seat; the question of Jerusalem's status is
explained in the data note.

`countryKnowledgeData.json` contains up to twelve major cities and eight named
mountains for each quiz country. It was prepared from the [Natural Earth 10m
Populated Places dataset](https://github.com/nvkelso/natural-earth-vector/blob/master/10m_cultural/ne_10m_populated_places_simple.README.html)
(version 5.1.2) and [10m Elevation Points](https://www.naturalearthdata.com/downloads/10m-physical-vectors/)
(version 5.0.0). Natural Earth data is in the public domain. City population
figures are source estimates and are used only to make a “largest among these
choices” question; mountain questions are included only where the dataset has a
named mountain for that country. Countries without a listed mountain simply do
not receive a mountain question.

The generated file is bundled with the application, so these questions work
offline. To regenerate it, download and extract those two Natural Earth
datasets, then run:

```sh
npm run update:knowledge-data -- \
  /path/to/ne_10m_populated_places.dbf \
  /path/to/ne_10m_geography_regions_elevation_points.dbf \
  /path/to/ne_10m_geography_regions_elevation_points.shp
```

The generator associates each named mountain with the country polygon that
contains its coordinates, then writes the compact local JSON file.

## Country exploration profiles

`countryProfileFacts.json` is bundled locally and supplies bilingual profile
facts for all 195 countries and the 40 mapped territories. It includes terrain
descriptions, highest and lowest points, major river names, government type,
political-regime classifications where covered, ranked music genres where a
country ranking is published, historical notes, and checked facts. The profile
view does not request these data from the network.

The primary facts come from the 2025 CIA World Factbook archive. Named rivers
combine Natural Earth 1:10m river lines and the World Bank *Major Rivers of the
World* dataset (CC BY 4.0). Country high points also use Natural Earth 10m
elevation points where the Factbook has no value. Several previously empty river
profiles are supplemented with cited national hydrology sources (Albania, Algeria,
Andorra, Belize, Brunei, Cabo Verde, Cuba, Cyprus, Denmark, Djibouti, Dominica,
Fiji, the Federated States of Micronesia, Grenada, Haiti, Jamaica, Kuwait, Libya,
Mauritius, North Macedonia, Oman, Palau, Samoa, Saudi Arabia, Saint Kitts and Nevis,
Saint Lucia, San Marino, Seychelles, São Tomé and Príncipe, Sierra Leone, Singapore,
Solomon Islands, Somalia, Eswatini, Trinidad and Tobago, Timor-Leste, Tunisia, the
United Arab Emirates, Saint Vincent and the Grenadines, Vanuatu, and Yemen). Mapped inhabited
territories also carry locally bundled administrative centres where a capital is
not applicable or was absent from the country list. The comparable political
classification is V-Dem v16 for 2025. Music records use the stream-weighted
genre share from a dated Spotify Top country-chart snapshot where available,
then the leading genre among an Apple Music Top 100 where available, then
ranked IFPI survey results as a separately identified fallback. Each profile
states its date, measure, and source so chart shares are not confused with
survey respondent percentages. Apple genre counts are derived from Apple's
official Top Songs RSS feed where available; remaining Apple chart snapshots
come from the cited MostPops secondary source. Official Åland statistics and
government sources are linked directly in that territory's profile.

The bundled snapshot currently includes named rivers for 180 of 195 countries
and a cited music-chart or survey result for 141 of 195 countries: 69 Spotify
Top 200 chart summaries, 70 Apple Top Songs RSS summaries, one secondary Apple
Top 100 summary, and one IFPI survey result. The 70 Apple RSS summaries each
count the primary genre on each chart entry once; their percentage is not stream
time. Remaining music `ND` entries mean the integrated, comparable sources did
not return a usable result; they do not claim no local genre ranking exists.

`ND` means no usable value was found in the cited source set for that field.
River coverage includes named large and selected regional waterways from the
global-scale datasets plus the cited country-level additions. It does not attempt
to enumerate every seasonal wadi or minor stream. Political classifications
have narrower coverage than general government descriptions; their scope and
year are stated in the profile. Area, perimeter, and span values
remain approximate where they are calculated from generalized map boundaries.

Where an independent, comparable reference is available, profile values are
cross-checked before being retained. When population or area references
materially disagree, the affected value is `null` and the profile shows `ND`
with the source links.
The Colombia population and area are currently `ND`: the World Bank/UN 2025
population estimate differs from DANE's 2025 projection, and the generalized
Natural Earth area differs from the UNData reference. Colombia's highest point
is 5,775 m, supported by IDEAM (citing IGAC 2024), Colombia's Ministry of
Environment, and the bundled Natural Earth peak record. Zambia's highest-point
elevation is 2,339 m, corroborated by Mafinga Town Council and an African Union
country profile. A duplicate World Bank river entry for Colombia was removed
because it was a misspelling of the same Magdalena River already in the list.
