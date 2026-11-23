import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

type CountryCatalogEntry = {
  sourceFeatureId: string | number
  alpha2: string
}

type CountryRecord = {
  sourceFeatureId: string | number
  alpha2: string
  metrics: Record<string, number>
  metricsSource: string
  cities: { name: string; population: number }[]
  mountains: { name: string; elevationMeters: number }[]
}

type TerritoryRecord = {
  id: string
  metrics: Record<string, number>
  metricsSource: string
}

type ProfileFacts = {
  sources: Record<string, { name: string; url: string }>
  byAlpha2: Record<string, unknown>
  byTerritoryId: Record<string, unknown>
}

type KnowledgeRecord = {
  alpha2: string
  cities: { name: string; population: number }[]
  mountains: { name: string; elevationMeters: number }[]
}

type ResourceIndustryRecord = {
  overview?: Record<'fr' | 'en' | 'es', string>
  sources?: Array<{ name: string; url: string }>
}

type ResourceIndustryData = {
  entities: Record<string, { industries: ResourceIndustryRecord[] }>
}

const readJson = async <T,>(path: string): Promise<T> =>
  JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as T

const [catalog, exploration, profileFacts, knowledge, resourceIndustries] = await Promise.all([
  readJson<CountryCatalogEntry[]>('../src/renderer/src/data/quiz/countryCatalog.json'),
  readJson<{
    countries: CountryRecord[]
    territories: TerritoryRecord[]
  }>('../src/renderer/src/data/quiz/countryExplorationData.json'),
  readJson<ProfileFacts>('../src/renderer/src/data/quiz/countryProfileFacts.json'),
  readJson<KnowledgeRecord[]>('../src/renderer/src/data/quiz/countryKnowledgeData.json'),
  readJson<ResourceIndustryData>('../src/renderer/src/data/geography/resourceIndustries.json')
])

test('les données pays et territoires gardent des identifiants reliés entre elles', (): void => {
  const catalogByCode = new Map(catalog.map((country) => [country.alpha2, country]))
  const explorationByCode = new Map(
    exploration.countries.map((country) => [country.alpha2, country])
  )

  assert.equal(catalog.length, 195)
  assert.equal(exploration.countries.length, catalog.length)
  assert.equal(new Set(catalog.map(({ alpha2 }) => alpha2)).size, catalog.length)
  assert.equal(
    new Set(exploration.countries.map(({ sourceFeatureId }) => String(sourceFeatureId))).size,
    catalog.length
  )

  for (const country of catalog) {
    const explored = explorationByCode.get(country.alpha2)
    assert.ok(explored, `Missing exploration data for ${country.alpha2}`)
    assert.equal(String(explored.sourceFeatureId), String(country.sourceFeatureId))
    assert.ok(Object.keys(explored.metrics).length >= 4)
    assert.ok(Object.values(explored.metrics).every((value) => Number.isFinite(value) && value > 0))
    assert.ok(explored.metricsSource.trim())
  }

  assert.equal(exploration.territories.length, 40)
  assert.equal(
    new Set(exploration.territories.map(({ id }) => id)).size,
    exploration.territories.length
  )
  assert.ok(
    exploration.territories.every(
      (territory) => territory.id.startsWith('territory:') && territory.metricsSource.trim()
    )
  )
  assert.ok(
    exploration.territories.every(
      ({ metrics }) =>
        Object.keys(metrics).length >= 4 &&
        Object.values(metrics).every((value) => Number.isFinite(value) && value >= 0)
    )
  )
  assert.equal(catalogByCode.size, explorationByCode.size)
})

test('les profils et données de connaissance couvrent le catalogue sans valeurs numériques incohérentes', (): void => {
  const catalogCodes = new Set(catalog.map(({ alpha2 }) => alpha2))
  const knowledgeByCode = new Map(knowledge.map((country) => [country.alpha2, country]))

  assert.deepEqual(new Set(Object.keys(profileFacts.byAlpha2)), catalogCodes)
  assert.deepEqual(
    new Set(Object.keys(profileFacts.byTerritoryId)),
    new Set(exploration.territories.map(({ id }) => id))
  )
  assert.deepEqual(new Set(knowledgeByCode.keys()), catalogCodes)
  assert.ok(
    Object.values(profileFacts.sources).every(
      ({ name, url }) => name.trim() && /^https:\/\//.test(url)
    )
  )

  for (const country of knowledge) {
    assert.ok(
      country.cities.every(
        ({ name, population }) => name.trim() && Number.isFinite(population) && population > 0
      )
    )
    assert.ok(
      country.mountains.every(
        ({ name, elevationMeters }) =>
          name.trim() && Number.isFinite(elevationMeters) && elevationMeters > 0
      )
    )
    assert.ok(
      country.cities.every(
        (city, index, cities) => index === 0 || cities[index - 1].population >= city.population
      ),
      `Cities are not ranked by population for ${country.alpha2}`
    )
  }
})

test('les territoires avec un emblème local ne réutilisent pas le drapeau de leur métropole', async (): Promise<void> => {
  const territoryFlags = [
    ['gf', 'fr'],
    ['gp', 'fr'],
    ['mf', 'fr'],
    ['mq', 'fr'],
    ['pm', 'fr'],
    ['re', 'fr'],
    ['sh', 'gb'],
    ['yt', 'fr']
  ] as const

  for (const [territoryCode, sovereignCode] of territoryFlags) {
    const [territoryFlag, sovereignFlag] = await Promise.all([
      readFile(
        new URL(
          `../src/renderer/src/data/quiz/flag-overrides/${territoryCode}.svg`,
          import.meta.url
        ),
        'utf8'
      ),
      readFile(
        new URL(`../node_modules/svg-country-flags/svg/${sovereignCode}.svg`, import.meta.url),
        'utf8'
      )
    ])
    assert.match(territoryFlag, /<svg\b/)
    assert.notEqual(territoryFlag.replace(/\s/g, ''), sovereignFlag.replace(/\s/g, ''))
  }
})

test('les synthèses industrielles éditoriales restent localisées et sourcées', (): void => {
  const enrichedIndustries = Object.values(resourceIndustries.entities)
    .flatMap(({ industries }) => industries)
    .filter(({ overview }) => overview)

  assert.ok(enrichedIndustries.length > 0)
  for (const industry of enrichedIndustries) {
    assert.ok(industry.overview?.fr.trim())
    assert.ok(industry.overview?.en.trim())
    assert.ok(industry.overview?.es.trim())
    assert.ok(industry.sources?.length)
    assert.ok(
      industry.sources?.every(({ name, url }) => name.trim().length > 0 && /^https:\/\//.test(url))
    )
  }

  const moroccoLeather = resourceIndustries.entities['country:ma'].industries.find(({ overview }) =>
    overview?.fr.includes('tanneries')
  )
  assert.ok(moroccoLeather)
  assert.match(moroccoLeather.overview?.fr ?? '', /maroquinerie/)
  assert.match(moroccoLeather.sources?.[0]?.url ?? '', /mcinet\.gov\.ma/)
})
