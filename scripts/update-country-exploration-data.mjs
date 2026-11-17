import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { feature } = require('topojson-client')
const topologies = {
  '110m': require('world-atlas/countries-110m.json'),
  '50m': require('world-atlas/countries-50m.json'),
  '10m': require('world-atlas/countries-10m.json')
}
const topology = topologies['10m']
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const catalog = require('../src/renderer/src/data/quiz/countryCatalog.json')
const capitals = require('../src/renderer/src/data/quiz/countryCapitals.json')
const knowledge = require('../src/renderer/src/data/quiz/countryKnowledgeData.json')

const mapUnitsUrl =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson'
const mapUnitsResponse = await fetch(mapUnitsUrl)
if (!mapUnitsResponse.ok) {
  throw new Error(`Natural Earth map units request failed: ${mapUnitsResponse.status}`)
}
const mapUnits = (await mapUnitsResponse.json()).features

const earthRadiusKm = 6371.0088
const toRadians = (degrees) => (degrees * Math.PI) / 180
const wrapRadians = (radians) => {
  while (radians > Math.PI) radians -= Math.PI * 2
  while (radians < -Math.PI) radians += Math.PI * 2
  return radians
}

function polygonsFor(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates]
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates
  return []
}

function ringAreaKm2(ring) {
  let sum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitudeA, latitudeA] = ring[index]
    const [longitudeB, latitudeB] = ring[index + 1]
    sum +=
      wrapRadians(toRadians(longitudeB - longitudeA)) *
      (2 + Math.sin(toRadians(latitudeA)) + Math.sin(toRadians(latitudeB)))
  }
  return (sum * earthRadiusKm ** 2) / 2
}

function distanceKm(a, b) {
  const latitudeA = toRadians(a[1])
  const latitudeB = toRadians(b[1])
  const latitudeDelta = latitudeB - latitudeA
  const longitudeDelta = wrapRadians(toRadians(b[0] - a[0]))
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getMetrics(geometry) {
  const polygons = polygonsFor(geometry)
  const coordinates = polygons.flatMap((polygon) => polygon.flatMap((ring) => ring.slice(0, -1)))
  if (coordinates.length === 0) return null

  let perimeterKm = 0
  let areaKm2 = 0
  for (const polygon of polygons) {
    for (const [ringIndex, ring] of polygon.entries()) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        perimeterKm += distanceKm(ring[index], ring[index + 1])
      }
      const ringArea = Math.abs(ringAreaKm2(ring))
      areaKm2 += ringIndex === 0 ? ringArea : -ringArea
    }
  }

  let southLatitude = Infinity
  let northLatitude = -Infinity
  for (const [, latitude] of coordinates) {
    southLatitude = Math.min(southLatitude, latitude)
    northLatitude = Math.max(northLatitude, latitude)
  }
  const sortedLongitudes = coordinates
    .map(([longitude]) => ((longitude % 360) + 360) % 360)
    .sort((a, b) => a - b)
  let largestLongitudeGap = 0
  for (let index = 0; index < sortedLongitudes.length; index += 1) {
    const current = sortedLongitudes[index]
    const next = sortedLongitudes[(index + 1) % sortedLongitudes.length] +
      (index === sortedLongitudes.length - 1 ? 360 : 0)
    largestLongitudeGap = Math.max(largestLongitudeGap, next - current)
  }

  const northSouthDegrees = northLatitude - southLatitude
  const eastWestDegrees = 360 - largestLongitudeGap
  const middleLatitudeRadians = toRadians((northLatitude + southLatitude) / 2)
  const eastWestKm = earthRadiusKm * Math.cos(middleLatitudeRadians) * toRadians(eastWestDegrees)

  return {
    areaKm2: Math.round(Math.max(0, areaKm2)),
    perimeterKm: Math.round(perimeterKm),
    northSouthKm: Math.round(earthRadiusKm * toRadians(northSouthDegrees)),
    eastWestKm: Math.round(Math.abs(eastWestKm))
  }
}

function isPointInRing([pointLongitude, pointLatitude], ring) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [longitudeA, latitudeA] = ring[index]
    const [longitudeB, latitudeB] = ring[previous]
    const adjustedA = longitudeA + 360 * Math.round((pointLongitude - longitudeA) / 360)
    const adjustedB = longitudeB + 360 * Math.round((pointLongitude - longitudeB) / 360)
    const crosses =
      (latitudeA > pointLatitude) !== (latitudeB > pointLatitude) &&
      pointLongitude <
        ((adjustedB - adjustedA) * (pointLatitude - latitudeA)) /
          (latitudeB - latitudeA || Number.EPSILON) +
          adjustedA
    if (crosses) inside = !inside
  }
  return inside
}

function findContainingPolygonIndex(geometry, point) {
  return polygonsFor(geometry).findIndex((polygon) =>
    isPointInRing(point, polygon[0]) &&
    !polygon.slice(1).some((hole) => isPointInRing(point, hole))
  )
}

const populationResponse = await fetch(
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&mrnev=1'
)
if (!populationResponse.ok) {
  throw new Error(`World Bank population request failed: ${populationResponse.status}`)
}

const [worldBankMetadata, worldBankRows] = await populationResponse.json()
const populationByAlpha2 = new Map(
  worldBankRows
    .filter((row) => row.value !== null && row.country?.id)
    .map((row) => [row.country.id.toUpperCase(), { population: row.value, year: Number(row.date) }])
)

function getCoreMapUnit(alpha2) {
  return mapUnits.find((unit) => {
    const properties = unit.properties ?? {}
    const unitCodes = [properties.ISO_A2, properties.ISO_A2_EH]
    return (
      properties.ADMIN === properties.SOVEREIGNT &&
      unitCodes.includes(alpha2)
    )
  })
}

const capitalBySourceId = new Map(capitals.map((entry) => [String(entry.sourceFeatureId), entry]))
const knowledgeByAlpha2 = new Map(knowledge.map((entry) => [entry.alpha2, entry]))
const geometriesByScale = Object.fromEntries(
  Object.entries(topologies).map(([scale, sourceTopology]) => [
    scale,
    new Map(
      feature(sourceTopology, sourceTopology.objects.countries).features.map((country) => [
        String(country.id),
        country.geometry
      ])
    )
  ])
)
const geometryBySourceId = geometriesByScale['10m']
const countrySourceIdByAlpha2 = new Map(
  catalog.map((country) => [country.alpha2, country.sourceFeatureId])
)
const coreMapUnitsByAlpha2 = new Map(
  catalog.flatMap((country) => {
    const core = getCoreMapUnit(country.alpha2)
    return core ? [[country.alpha2, core]] : []
  })
)
const sovereignAlpha2ByName = new Map(
  [...coreMapUnitsByAlpha2].map(([alpha2, unit]) => [unit.properties.SOVEREIGNT, alpha2])
)
const territoryIdByAlpha2 = new Map([
  ['GF', 'territory:guyane'],
  ['GP', 'territory:guadeloupe'],
  ['MQ', 'territory:martinique'],
  ['RE', 'territory:reunion'],
  ['YT', 'territory:mayotte'],
  ['PM', 'territory:saint-pierre-et-miquelon'],
  ['BL', 'territory:saint-barthelemy'],
  ['MF', 'territory:saint-martin'],
  ['PF', 'territory:polynesie-francaise'],
  ['NC', 'territory:nouvelle-caledonie'],
  ['WF', 'territory:wallis-et-futuna'],
  ['TF', 'territory:taaf']
])
const territoryCapitalOverrides = {
  SX: 'Philipsburg',
  HK: 'Hong Kong',
  GL: 'Nuuk',
  CW: 'Willemstad',
  AW: 'Oranjestad',
  TC: 'Cockburn Town',
  PN: 'Adamstown',
  MS: 'Brades',
  VI: 'Charlotte Amalie',
  PR: 'San Juan',
  AI: 'The Valley',
  KY: 'George Town',
  SH: 'Jamestown',
  JE: 'Saint Helier',
  GG: 'Saint Peter Port',
  IM: 'Douglas',
  FO: 'Tórshavn',
  SJ: 'Longyearbyen',
  NF: 'Kingston',
  CK: 'Avarua',
  GS: 'King Edward Point',
  NU: 'Alofi',
  GU: 'Hagåtña',
  MP: 'Saipan',
  MO: 'Macao',
  GF: 'Cayenne',
  GP: 'Basse-Terre',
  MQ: 'Fort-de-France',
  RE: 'Saint-Denis',
  YT: 'Mamoudzou',
  PM: 'Saint-Pierre',
  BL: 'Gustavia',
  MF: 'Marigot',
  PF: 'Papeete',
  NC: 'Nouméa',
  WF: 'Mata-Utu'
}
const flagAssetCodes = new Set(
  require('node:fs')
    .readdirSync(resolve(root, 'node_modules/svg-country-flags/svg'))
    .filter((filename) => filename.endsWith('.svg'))
    .map((filename) => filename.slice(0, 2).toUpperCase())
)

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getTerritoryGeometryLinks(unit, sovereignAlpha2) {
  const properties = unit.properties ?? {}
  const unitSourceId = String(Number(properties.ISO_N3))
  const point = [Number(properties.LABEL_X), Number(properties.LABEL_Y)]
  const links = []

  for (const [scale, geometries] of Object.entries(geometriesByScale)) {
    if (unitSourceId !== 'NaN' && unitSourceId !== '-99' && geometries.has(unitSourceId)) {
      links.push({ sourceId: `natural-earth-${scale}`, sourceFeatureId: Number(unitSourceId) })
      continue
    }

    // At 1:110m, Hong Kong has no standalone geometry. Its label point falls
    // inside mainland China's coarse polygon, so assigning that polygon to HK
    // would replace China's flag and selection area at world scale.
    if (scale === '110m' && properties.ISO_A2_EH === 'HK') continue

    const sovereignSourceFeatureId = countrySourceIdByAlpha2.get(sovereignAlpha2)
    const sovereignGeometry = geometries.get(String(sovereignSourceFeatureId))
    if (!sovereignGeometry || !point.every(Number.isFinite)) continue
    const sourcePolygonIndex = findContainingPolygonIndex(sovereignGeometry, point)
    if (sourcePolygonIndex < 0) continue
    links.push({
      sourceId: `natural-earth-${scale}`,
      sourceFeatureId: sovereignSourceFeatureId,
      sourcePolygonIndex
    })
  }

  return links
}

const territoryRecordsById = new Map()
const territoryUnits = mapUnits.filter((unit) => {
  const properties = unit.properties ?? {}
  const sovereignAlpha2 = sovereignAlpha2ByName.get(properties.SOVEREIGNT)
  if (!sovereignAlpha2) return false
  if (properties.TYPE === 'Dependency') return true
  if (properties.TYPE === 'Country' && properties.ADMIN !== properties.SOVEREIGNT) return true
  return (
    sovereignAlpha2 === 'FR' &&
    ['Geo unit', 'Disputed'].includes(properties.TYPE) &&
    /^[A-Z]{2}$/.test(String(properties.ISO_A2_EH ?? '')) &&
    properties.ISO_A2_EH !== 'FR'
  )
})

for (const unit of territoryUnits) {
  const properties = unit.properties ?? {}
  const sovereignAlpha2 = sovereignAlpha2ByName.get(properties.SOVEREIGNT)
  if (!sovereignAlpha2) continue
  const candidateAlpha2 = String(properties.ISO_A2_EH ?? '')
  const alpha2 = /^[A-Z]{2}$/.test(candidateAlpha2) ? candidateAlpha2 : null
  const name = String(properties.NAME_FR ?? properties.NAME_EN ?? properties.ADMIN ?? 'Territoire')
  const id = (alpha2 && territoryIdByAlpha2.get(alpha2)) ??
    `territory:${alpha2?.toLowerCase() ?? slug(name)}`
  const geometryLinks = getTerritoryGeometryLinks(unit, sovereignAlpha2)
  if (geometryLinks.length === 0) continue

  const estimate = Number(properties.POP_EST)
  const estimateYear = Number(properties.POP_YEAR)
  const territoryRecord = {
    id,
    name,
    alpha2,
    flagAlpha2: alpha2 && flagAssetCodes.has(alpha2) ? alpha2 : null,
    sovereignAlpha2,
    sourceFeatureId: geometryLinks[0].sourceFeatureId,
    geometryLinks,
    capital: alpha2 ? territoryCapitalOverrides[alpha2] ?? null : null,
    population: Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : null,
    populationYear: Number.isFinite(estimateYear) && estimateYear > 0 ? estimateYear : null,
    populationSource: 'Natural Earth estimate',
    metrics: getMetrics(unit.geometry),
    metricsScope: 'Territoire distinct',
    metricsSource: 'Natural Earth 10m Admin 0 Map Units',
    cities: [],
    mountains: []
  }

  const existing = territoryRecordsById.get(id)
  if (existing) {
    existing.geometryLinks.push(...geometryLinks)
    continue
  }
  territoryRecordsById.set(id, territoryRecord)
}

const records = catalog.map((country) => {
  const population = populationByAlpha2.get(country.alpha2)
  const geometry = geometryBySourceId.get(String(country.sourceFeatureId))
  const coreMapUnit = getCoreMapUnit(country.alpha2)
  const metrics = getMetrics(coreMapUnit?.geometry ?? geometry)
  const countryKnowledge = knowledgeByAlpha2.get(country.alpha2)
  const mountains = countryKnowledge?.mountains ?? []
  const metropolitanMountains = country.alpha2 === 'FR'
    ? mountains.filter((mountain) =>
        !['Piton des Neiges', 'Soufrière', 'montagne Pelée', 'montagne Bellevue'].includes(
          mountain.name
        )
      )
    : mountains

  return {
    sourceFeatureId: country.sourceFeatureId,
    alpha2: country.alpha2,
    capital: capitalBySourceId.get(String(country.sourceFeatureId))?.capitalName ?? null,
    population: population?.population ?? null,
    populationYear: population?.year ?? null,
    metrics: metrics && metrics.areaKm2 > 0 ? metrics : null,
    metricsScope: coreMapUnit
      ? 'Territoire principal, hors dépendances et territoires éloignés.'
      : 'Contour Natural Earth disponible ; la distinction métropole / territoires associés est incomplète.',
    metricsSource: coreMapUnit ? 'Natural Earth 10m Admin 0 Map Units' : 'world-atlas 10m',
    cities: countryKnowledge?.cities ?? [],
    mountains: metropolitanMountains
  }
})

const output = {
  generatedAt: new Date().toISOString().slice(0, 10),
  populationSource: 'World Bank, Population, total (SP.POP.TOTL)',
  populationSourceUrl: 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL',
  populationLastUpdated: worldBankMetadata.lastupdated ?? null,
  geometrySource: 'Natural Earth 10m Admin 0 Map Units; fallback: world-atlas 2.0.2',
  geometrySourceUrl: mapUnitsUrl,
  geometryNote: 'Area, perimeter and spans are approximate; coastlines vary with the source scale.',
  unavailableReasons: {
    population: 'Aucun chiffre de population n’est fourni pour cette entité dans la réponse de la Banque mondiale sélectionnée.',
    metrics: 'La source cartographique ne fournit pas de contour exploitable pour calculer ces mesures.',
    capital: 'La source géographique ne fournit pas de capitale vérifiée pour ce territoire.',
    cities: 'Aucune grande ville vérifiée n’est incluse pour cette entité dans les données locales.',
    mountains: 'Aucun sommet vérifié n’est inclus pour cette entité dans les données locales.',
    lowestPoint: 'Les données Natural Earth sur les frontières terrestres ne comprennent pas de relevé vérifié des altitudes.',
    rivers: 'ND signifie qu’aucun fleuve ou cours d’eau majeur nommé n’a été identifié dans les couches mondiales et les compléments nationaux inclus; les oueds saisonniers ne sont pas recensés de manière exhaustive.',
    government: 'La fiche conserve la description gouvernementale de la source nationale. ND ne concerne que la classification V-Dem lorsqu’un territoire n’est pas codé dans cette base.',
    music: 'ND signifie qu’aucun classement national comparable du genre musical le plus écouté n’est publié dans les rapports IFPI intégrés (enquêtes 2022 et 2023).',
    funFacts: 'Les anecdotes proviennent des fiches nationales intégrées; ND ne s’affiche que si aucune anecdote exploitable n’est publiée dans la source.',
    historicalFact: 'Les repères historiques proviennent des fiches nationales intégrées; ND ne s’affiche que si aucune référence exploitable n’est publiée dans la source.'
  },
  countries: records,
  territories: [...territoryRecordsById.values()]
}

const outputPath = resolve(root, 'src/renderer/src/data/quiz/countryExplorationData.json')
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(
  `Wrote ${records.length} country records and ${territoryRecordsById.size} territory records to ${outputPath}`
)
