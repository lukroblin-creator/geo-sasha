
import world110mData from 'world-atlas/countries-110m.json'
import world50mData from 'world-atlas/countries-50m.json'
import world10mData from 'world-atlas/countries-10m.json'

import { feature } from 'topojson-client'

import type {
  Topology,
  GeometryCollection
} from 'topojson-specification'

import type {
  FeatureCollection,
  Geometry
} from 'geojson'

import { getGeometryLinkBySourceFeature } from './geography/registry'

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
function prepareWorldDataset(
  scale: '110m' | '50m' | '10m',
  worldData: unknown
): FeatureCollection<Geometry> {
  const topology = worldData as Topology

  const countriesObject =
    topology.objects.countries as GeometryCollection

  const sourceCountries = feature(
    topology,
    countriesObject
  ) as FeatureCollection<Geometry>

  return {
    ...sourceCountries,

    features: sourceCountries.features.map((country) => {
      const properties = country.properties ?? {}

      const name =
        typeof properties.name === 'string'
          ? properties.name
          : 'Unknown'

      const sourceId = country.id

      const geometryLink = getGeometryLinkBySourceFeature(
        `natural-earth-${scale}`,
        sourceId
      )

      const worldAtlasId = createWorldAtlasId(
        scale,
        name,
        sourceId
      )

      return {
        ...country,
        id: worldAtlasId,

        properties: {
          ...properties,
          worldAtlasId,
          sourceId: sourceId ?? null,
          sourceName: name,
          entityId: geometryLink?.entityId ?? null,
          resolution: scale
        }
      }
    })
  }
}

// Préparation indépendante des trois résolutions.
export const world110m = prepareWorldDataset(
  '110m',
  worldDatasets['110m']
)

export const world50m = prepareWorldDataset(
  '50m',
  worldDatasets['50m']
)

export const world10m = prepareWorldDataset(
  '10m',
  worldDatasets['10m']
)

// La résolution 110m reste la valeur par défaut.
export default world110m
