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
