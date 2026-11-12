import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { feature } = require('topojson-client')
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default
const topology = require('world-atlas/countries-10m.json')
const countryCatalog = require('../src/renderer/src/data/quiz/countryCatalog.json')
const validAlpha2 = new Set(countryCatalog.map(({ alpha2 }) => alpha2))

function parseDbf(buffer) {
  const rowCount = buffer.readUInt32LE(4)
  const headerLength = buffer.readUInt16LE(8)
  const rowLength = buffer.readUInt16LE(10)
  const fields = []

  for (let offset = 32; buffer[offset] !== 13; offset += 32) {
    fields.push({
      name: buffer.toString('ascii', offset, offset + 11).split('\0')[0],
      length: buffer[offset + 16]
    })
  }

  const rows = []
  for (let index = 0; index < rowCount; index += 1) {
    const rowOffset = headerLength + index * rowLength
    if (buffer[rowOffset] === 0x2a) continue

    let fieldOffset = rowOffset + 1
    const row = {}
    for (const field of fields) {
      row[field.name] = buffer.toString('utf8', fieldOffset, fieldOffset + field.length).trim()
      fieldOffset += field.length
    }
    rows.push(row)
  }

  return rows
}

function parsePointShapefile(buffer) {
  const points = []
  let offset = 100

  while (offset + 8 <= buffer.length) {
    const contentLength = buffer.readInt32BE(offset + 4) * 2
    const contentOffset = offset + 8
    const shapeType = buffer.readInt32LE(contentOffset)

    if (shapeType === 1) {
      points.push([buffer.readDoubleLE(contentOffset + 4), buffer.readDoubleLE(contentOffset + 12)])
    } else {
      points.push(null)
    }

    offset = contentOffset + contentLength
  }

  return points
}

function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function findCountryAlpha2(point, countryFeaturesByAlpha2) {
  const candidate = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: point }
  }
  for (const [alpha2, countries] of countryFeaturesByAlpha2) {
    if (countries.some((country) => booleanPointInPolygon(candidate, country))) return alpha2
  }
  return undefined
}

function addNamedRecord(recordsByCountry, alpha2, key, item, limit) {
  const records = recordsByCountry.get(alpha2)
  if (!records) return

  const previous = records.get(key)
  if (
    !previous ||
    (item.population ?? item.elevationMeters ?? 0) >
      (previous.population ?? previous.elevationMeters ?? 0)
  ) {
    records.set(key, item)
  }

  if (records.size > limit * 2) {
    const sorted = [...records.entries()].sort(
      (first, second) =>
        (second[1].population ?? second[1].elevationMeters ?? 0) -
        (first[1].population ?? first[1].elevationMeters ?? 0)
    )
    records.clear()
    for (const [recordKey, record] of sorted.slice(0, limit)) records.set(recordKey, record)
  }
}

const [placesPath, mountainsDbfPath, mountainsShpPath, outputPath] = process.argv.slice(2)
if (!placesPath || !mountainsDbfPath || !mountainsShpPath) {
  throw new Error(
    'Usage: node scripts/generate-country-knowledge-data.mjs <populated-places.dbf> <elevation-points.dbf> <elevation-points.shp> [output.json]'
  )
}

const countryFeatures = feature(topology, topology.objects.countries).features
const countryFeaturesBySourceId = new Map()
for (const country of countryFeatures) {
  const sourceFeatureId = Number(country.id)
  const features = countryFeaturesBySourceId.get(sourceFeatureId) ?? []
  features.push(country)
  countryFeaturesBySourceId.set(sourceFeatureId, features)
}
const countryFeaturesByAlpha2 = new Map(
  countryCatalog.map(({ alpha2, sourceFeatureId }) => [
    alpha2,
    countryFeaturesBySourceId.get(sourceFeatureId) ?? []
  ])
)
const citiesByCountry = new Map(countryCatalog.map(({ alpha2 }) => [alpha2, new Map()]))
const mountainsByCountry = new Map(countryCatalog.map(({ alpha2 }) => [alpha2, new Map()]))

const places = parseDbf(await readFile(resolve(placesPath)))
const placeClasses = new Set([
  'populated place',
  'admin-0 capital',
  'admin-0 capital alt',
  'admin-0 region capital',
  'admin-1 capital',
  'admin-1 region capital'
])

for (const row of places) {
  const alpha2 = row.ISO_A2?.toUpperCase()
  const name = row.NAME_FR || row.NAME
  if (!validAlpha2.has(alpha2) || !name || !placeClasses.has(row.FEATURECLA?.toLowerCase())) {
    continue
  }

  const parsedPopulation = Number(row.POP_MAX)
  const item = {
    name,
    population: Number.isFinite(parsedPopulation) ? Math.max(0, Math.round(parsedPopulation)) : 0
  }
  addNamedRecord(citiesByCountry, alpha2, normalizeName(name), item, 12)
}

const mountainRows = parseDbf(await readFile(resolve(mountainsDbfPath)))
const mountainPoints = parsePointShapefile(await readFile(resolve(mountainsShpPath)))
if (mountainRows.length !== mountainPoints.length) {
  throw new Error('The elevation-points DBF and SHP files contain different record counts.')
}

for (let index = 0; index < mountainRows.length; index += 1) {
  const row = mountainRows[index]
  const point = mountainPoints[index]
  const name = row.name_fr || row.name_en || row.name
  if (row.featurecla !== 'mountain' || !point || !name) continue

  const attributedAlpha2 = [row.nation1, row.nation2]
    .map((value) => value.toUpperCase())
    .find((value) => validAlpha2.has(value))
  const alpha2 = attributedAlpha2 ?? findCountryAlpha2(point, countryFeaturesByAlpha2)
  if (!alpha2) continue

  const parsedElevation = Number(row.elevation)
  const item = {
    name,
    elevationMeters: Number.isFinite(parsedElevation) ? Math.round(parsedElevation) : null
  }
  addNamedRecord(mountainsByCountry, alpha2, normalizeName(name), item, 8)
}

const output = countryCatalog.map(({ alpha2 }) => ({
  alpha2,
  cities: [...citiesByCountry.get(alpha2).values()]
    .sort(
      (first, second) =>
        second.population - first.population || first.name.localeCompare(second.name, 'fr')
    )
    .slice(0, 12),
  mountains: [...mountainsByCountry.get(alpha2).values()]
    .sort(
      (first, second) =>
        (second.elevationMeters ?? -1) - (first.elevationMeters ?? -1) ||
        first.name.localeCompare(second.name, 'fr')
    )
    .slice(0, 8)
}))

const destination = resolve(
  outputPath ??
    fileURLToPath(
      new URL('../src/renderer/src/data/quiz/countryKnowledgeData.json', import.meta.url)
    )
)
await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`)

console.log(
  `Écrit ${output.length} pays, ${output.filter((country) => country.cities.length).length} avec des villes et ${output.filter((country) => country.mountains.length).length} avec des montagnes dans ${destination}`
)
