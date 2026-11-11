import world110mData from 'world-atlas/countries-110m.json'
import world50mData from 'world-atlas/countries-50m.json'
import world10mData from 'world-atlas/countries-10m.json'

import { feature } from 'topojson-client'

import { fixGeoJson } from 'antimeridian-ts'

import type { Topology, GeometryCollection } from 'topojson-specification'

import type { Feature, FeatureCollection, Geometry } from 'geojson'

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
      const correctedGeometry = fixAntimeridianGeometry(country, scale, name)

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
