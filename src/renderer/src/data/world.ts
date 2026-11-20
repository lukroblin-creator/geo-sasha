import world110mData from 'world-atlas/countries-110m.json'
import world50mData from 'world-atlas/countries-50m.json'
import world10mData from 'world-atlas/countries-10m.json'

import { feature } from 'topojson-client'

import { fixGeoJson } from 'antimeridian-ts'

import type { Topology, GeometryCollection } from 'topojson-specification'

import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'

import {
  getGeometryLinkBySourceFeature,
  getGeometryLinksBySourceFeature
} from './geography/registry'

// Les trois fichiers géographiques d'origine.
const worldDatasets = {
  '110m': world110mData,
  '50m': world50mData,
  '10m': world10mData
}

const vaticanTemplateGeometry = (() => {
  const topology = world50mData as unknown as Topology
  const countries = feature(topology, topology.objects.countries as GeometryCollection)
  return (countries as FeatureCollection<Geometry>).features.find(
    (country) => Number(country.id) === 336 || country.properties?.name === 'Vatican'
  )?.geometry
})()

const VATICAN_MAP_ANCHOR: [number, number] = [12.454324543245434, 41.903446293754]
const VATICAN_AREA_KM2 = 0.44

function getOuterRing(geometry: Geometry): Position[] | null {
  if (geometry.type === 'Polygon') return geometry.coordinates[0] ?? null
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0]?.[0] ?? null
  return null
}

function getRingArea(ring: Position[]): number {
  let area = 0
  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1]
    const current = ring[index]
    if (!previous || !current) continue
    area += previous[0] * current[1] - current[0] * previous[1]
  }
  return Math.abs(area / 2)
}

function createRenderableVaticanGeometry(sourceGeometry: Geometry): Geometry {
  const sourceRing = getOuterRing(sourceGeometry)
  const templateRing = vaticanTemplateGeometry ? getOuterRing(vaticanTemplateGeometry) : null
  const ring = sourceRing && getRingArea(sourceRing) > 0 ? sourceRing : templateRing
  if (!ring?.length) return sourceGeometry

  const longitudes = ring.map(([longitude]) => longitude)
  const latitudes = ring.map(([, latitude]) => latitude)
  const centerLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2
  const latitudeScale = Math.cos((VATICAN_MAP_ANCHOR[1] * Math.PI) / 180)
  const areaKm2 = getRingArea(ring) * 111.32 * 111.32 * Math.max(0.1, latitudeScale)
  const scale = areaKm2 > 0 ? Math.sqrt(VATICAN_AREA_KM2 / areaKm2) : 1

  return {
    type: 'Polygon',
    coordinates: [
      ring.map(([longitude, latitude]) => [
        VATICAN_MAP_ANCHOR[0] + (longitude - centerLongitude) * scale,
        VATICAN_MAP_ANCHOR[1] + (latitude - centerLatitude) * scale
      ])
    ]
  }
}

function prepareCountryGeometry(
  country: Feature<Geometry>,
  scale: '110m' | '50m' | '10m',
  name: string
): Geometry {
  const geometry = fixAntimeridianGeometry(country, scale, name)
  return name === 'Vatican' ? createRenderableVaticanGeometry(geometry) : geometry
}

// Création d'un identifiant interne propre à World Atlas.
function createWorldAtlasId(
  scale: string,
  name: string,
  sourceId: string | number | undefined
): string {
  if (sourceId !== undefined && sourceId !== null) {
    return `ne${scale}:${sourceId}`
  }

  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `ne${scale}:unidentified:${slug || 'unknown'}`
}

// Conversion et préparation d'un jeu de données.
function fixAntimeridianGeometry(
  country: import('geojson').Feature<Geometry>,
  scale: '110m' | '50m' | '10m',
  name: string
): Geometry {
  if (
    !['Russia', 'Fiji', 'Antarctica'].includes(name) ||
    country.geometry.type !== 'MultiPolygon'
  ) {
    return country.geometry
  }

  let candidate = country

  // Correction d'un anneau problématique de l'Antarctique en 110m.
  if (name === 'Antarctica' && scale === '110m') {
    const coordinates = country.geometry.coordinates.map((polygon, polygonIndex) =>
      polygon.map((ring, ringIndex) => {
        if (polygonIndex !== 7 || ringIndex !== 0) {
          return ring
        }

        const openRing = ring.slice(0, -1)
        const rotatedRing = [...openRing.slice(1), ...openRing.slice(0, 1)]

        rotatedRing.push(rotatedRing[0])

        return rotatedRing
      })
    )

    candidate = {
      ...country,
      geometry: {
        ...country.geometry,
        coordinates
      }
    }
  }

  const fixed = fixGeoJson(candidate, {
    fixWinding: true,
    ...(name === 'Antarctica' ? { forceSouthPole: true } : {})
  })

  return (fixed as typeof candidate).geometry
}
function prepareWorldDataset(
  scale: '110m' | '50m' | '10m',
  worldData: unknown
): FeatureCollection<Geometry> {
  const topology = worldData as Topology

  const countriesObject = topology.objects.countries as GeometryCollection

  const sourceCountries = feature(topology, countriesObject) as FeatureCollection<Geometry>
  return {
    ...sourceCountries,

    features: sourceCountries.features.map((country) => {
      const properties = country.properties ?? {}

      const name = typeof properties.name === 'string' ? properties.name : 'Unknown'

      const sourceId = country.id
      const correctedGeometry = prepareCountryGeometry(country, scale, name)

      const geometryLink = getGeometryLinkBySourceFeature(`natural-earth-${scale}`, sourceId)
      const geometryLinks = getGeometryLinksBySourceFeature(`natural-earth-${scale}`, sourceId)

      const worldAtlasId = createWorldAtlasId(scale, name, sourceId)

      return {
        ...country,
        geometry: correctedGeometry,
        id: worldAtlasId,

        properties: {
          ...properties,
          worldAtlasId,
          sourceId: sourceId ?? null,
          sourceName: name,
          entityId: geometryLink?.entityId ?? null,
          polygonEntityIds: geometryLinks.reduce<Record<string, string>>(
            (entitiesByPolygon, link) => {
              if (link.sourcePolygonIndex !== undefined) {
                entitiesByPolygon[String(link.sourcePolygonIndex)] = link.entityId
              }
              return entitiesByPolygon
            },
            {}
          ),
          resolution: scale
        }
      }
    })
  }
}

function createEntityAwareMapDataset(
  dataset: FeatureCollection<Geometry>
): FeatureCollection<Geometry> {
  return {
    ...dataset,
    features: dataset.features.flatMap((country) => {
      if (country.geometry?.type !== 'MultiPolygon') return [country]

      const properties = country.properties ?? {}
      const polygonEntityIds = properties.polygonEntityIds as Record<string, string> | undefined
      if (!polygonEntityIds || Object.keys(polygonEntityIds).length === 0) {
        return [country]
      }

      const sourcePolygons = country.geometry.coordinates
      const groups = new Map<string | null, number[]>()
      sourcePolygons.forEach((_, sourcePolygonIndex) => {
        const entityId =
          polygonEntityIds[String(sourcePolygonIndex)] ??
          (typeof properties.entityId === 'string' ? properties.entityId : null)
        const polygonIndexes = groups.get(entityId) ?? []
        polygonIndexes.push(sourcePolygonIndex)
        groups.set(entityId, polygonIndexes)
      })

      return [...groups.entries()].map(([entityId, polygonIndexes]) => {
        const polygons = polygonIndexes.map((index) => sourcePolygons[index])
        const geometry: Geometry =
          polygons.length === 1
            ? { type: 'Polygon', coordinates: polygons[0] }
            : { type: 'MultiPolygon', coordinates: polygons }
        const groupId = entityId ?? 'unassigned'
        const featureId = `${String(country.id ?? properties.worldAtlasId)}:${groupId}`
        const mapFeature: Feature<Geometry> = {
          ...country,
          id: featureId,
          geometry,
          properties: {
            ...properties,
            entityId,
            sourcePolygonIndices: polygonIndexes
          }
        }

        return mapFeature
      })
    })
  }
}

// Préparation indépendante des trois résolutions.
export const world110m = prepareWorldDataset('110m', worldDatasets['110m'])

export const world50m = prepareWorldDataset('50m', worldDatasets['50m'])

export const world10m = prepareWorldDataset('10m', worldDatasets['10m'])

// The map gets separate features for linked entities so each territory can be
// selected and highlighted independently. Labels continue using the originals.
export const world110mMap = createEntityAwareMapDataset(world110m)
export const world50mMap = createEntityAwareMapDataset(world50m)
export const world10mMap = createEntityAwareMapDataset(world10m)

// La résolution 110m reste la valeur par défaut.
export default world110m
