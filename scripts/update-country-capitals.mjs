import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, '..')
const catalogPath = resolve(
  projectDirectory,
  'src/renderer/src/data/quiz/countryCatalog.json'
)
const outputPath = resolve(
  projectDirectory,
  'src/renderer/src/data/quiz/countryCapitals.json'
)

const citiesEndpoint =
  'https://ungegn-api.azurewebsites.net/API/GetAllCities/GetAllCapitals'
const cityDetailsEndpoint =
  'https://ungegn-api.azurewebsites.net/API/GetCitiesDetails'

// Deliberate choices where the source omits a country or lists multiple capitals.
const capitalOverrides = new Map([
  [68, 'Sucre'], // Bolivia's constitutional capital; La Paz is the seat of government.
  [275, 'East Jerusalem'], // Palestine's claimed capital; Ramallah is its administrative seat.
  [336, 'Vatican City'], // Holy See observer state, absent from the 193-member-state source.
  [376, 'Jerusalem'], // Israel's declared capital; the city's international status is disputed.
  [398, 'Astana'] // The source still uses Nur-Sultan; Kazakhstan restored Astana in 2022.
])

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JavaScript has no return type syntax.
async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`)
  }
  return response.json()
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const collection = await fetchJson(citiesEndpoint)
const capitalFeatures = collection.features.filter((feature) =>
  feature.properties.toponyms.some((toponym) => toponym.isCapital)
)
const cityIds = [
  ...new Set(
    capitalFeatures.flatMap((feature) =>
      feature.properties.toponyms
        .filter((toponym) => toponym.isCapital)
        .map((toponym) => toponym.cityID)
    )
  )
]

const cityDetails = []
let nextCityIndex = 0
const workerCount = Math.min(8, cityIds.length)

await Promise.all(
  Array.from({ length: workerCount }, async () => {
    while (nextCityIndex < cityIds.length) {
      const cityId = cityIds[nextCityIndex++]
      const details = await fetchJson(`${cityDetailsEndpoint}/${cityId}`)
      const feature = capitalFeatures.find((candidate) =>
        candidate.properties.toponyms.some(
          (toponym) => toponym.cityID === cityId && toponym.isCapital
        )
      )
      const englishName = feature?.properties.toponyms.find(
        (toponym) =>
          toponym.cityID === cityId &&
          toponym.isCapital &&
          toponym.language === 'English' &&
          toponym.toponymType === 'Variant name'
      )
      const capitalName =
        englishName?.nameShort?.trim() ?? details.details?.cityName?.trim()

      if (details.details?.crM49 && capitalName) {
        cityDetails.push({
          sourceFeatureId: Number(details.details.crM49),
          capitalName
        })
      }
    }
  })
)

const capitalsByCountryId = new Map()
for (const city of cityDetails) {
  const entries = capitalsByCountryId.get(city.sourceFeatureId) ?? []
  entries.push(city.capitalName)
  capitalsByCountryId.set(city.sourceFeatureId, entries)
}

const notes = {
  68: 'Sucre est la capitale constitutionnelle ; le gouvernement siège à La Paz.',
  275: 'Jérusalem-Est est revendiquée comme capitale ; Ramallah est le siège administratif.',
  376: 'Le statut international de Jérusalem est contesté.'
}

const capitals = catalog.map((country) => {
  const override = capitalOverrides.get(country.sourceFeatureId)
  const names = capitalsByCountryId.get(country.sourceFeatureId) ?? []
  const capitalName = override ?? names[0]

  if (!capitalName) {
    throw new Error(
      `Missing capital for ${country.countryName} (${country.sourceFeatureId})`
    )
  }

  return {
    sourceFeatureId: country.sourceFeatureId,
    capitalName,
    ...(notes[country.sourceFeatureId]
      ? { note: notes[country.sourceFeatureId] }
      : {})
  }
})

const ids = new Set(capitals.map((country) => country.sourceFeatureId))
if (capitals.length !== 195 || ids.size !== 195) {
  throw new Error(`Expected 195 distinct capital entries; found ${capitals.length}`)
}

await writeFile(outputPath, `${JSON.stringify(capitals, null, 2)}\n`)
console.log(`Wrote ${capitals.length} offline capital entries to ${outputPath}`)
