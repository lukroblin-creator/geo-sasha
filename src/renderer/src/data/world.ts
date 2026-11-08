
import worldData from 'world-atlas/countries-110m.json'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'

// Chargement des données géographiques d'origine.
const topology = worldData as unknown as Topology

const countriesObject = topology.objects.countries as GeometryCollection

// Conversion du TopoJSON en GeoJSON.
const sourceCountries = feature(
  topology,
  countriesObject
) as FeatureCollection<Geometry>

// Création d'un identifiant interne propre à World Atlas.
function createWorldAtlasId(
  name: string,
  sourceId: string | number | undefined
): string {
  // Si la source possède un identifiant, on le conserve
  // en le plaçant dans notre propre espace d'identification.
  if (sourceId !== undefined && sourceId !== null) {
    return `ne110m:${sourceId}`
  }

  // Sinon, on construit un identifiant à partir du nom.
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `ne110m:unidentified:${slug || 'unknown'}`
}

// Chaque géométrie reçoit son identifiant interne.
const countries: FeatureCollection<Geometry> = {
  ...sourceCountries,

  features: sourceCountries.features.map((country) => {
    const properties = country.properties ?? {}

    const name =
      typeof properties.name === 'string'
        ? properties.name
        : 'Unknown'

    const sourceId = country.id

    const worldAtlasId = createWorldAtlasId(name, sourceId)

    return {
      ...country,

      // Identifiant utilisé par World Atlas et MapLibre.
      id: worldAtlasId,

      properties: {
        ...properties,

        // Informations conservées pour retrouver la source.
        worldAtlasId,
        sourceId: sourceId ?? null
      }
    }
  })
}

export default countries
