# Quiz reference data

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
