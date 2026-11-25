import { union } from '@turf/union'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'

export type MarineAreaProperties = {
  name: string
  nameFr: string
  nameEs: string
  minZoom: number
  kind?: string
  marineId?: string
}

function getEnglishRegionName(areas: Feature<Geometry, MarineAreaProperties>[]): string {
  if (areas.length < 2) return areas[0].properties.name
  const suffixes = areas.map((area) => area.properties.name.match(/^(?:North|South) (.+)$/)?.[1])
  if (suffixes[0] && suffixes.every((suffix) => suffix === suffixes[0])) return suffixes[0]
  return areas[0].properties.name
}

function combineGeometries(geometries: Geometry[]): Geometry {
  const polygons = geometries.flatMap((geometry) =>
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  )
  if (polygons.length === 1) return { type: 'Polygon', coordinates: polygons[0] }
  return { type: 'MultiPolygon', coordinates: polygons } satisfies MultiPolygon
}

/** Joins Natural Earth north/south entries that share one localized ocean name. */
export function prepareMarineRegions(
  areas: readonly {
    name: string
    nameFr: string
    nameEs: string
    kind: string
    minZoom: number
    geometry: Geometry
  }[]
): FeatureCollection<Geometry, MarineAreaProperties> {
  const groupedAreas = new globalThis.Map<string, Feature<Geometry, MarineAreaProperties>[]>()

  for (const area of areas) {
    const key = `${area.kind}:${area.nameFr}:${area.nameEs}`
    const group = groupedAreas.get(key) ?? []
    group.push({
      type: 'Feature',
      geometry: area.geometry,
      properties: {
        name: area.name,
        nameFr: area.nameFr,
        nameEs: area.nameEs,
        kind: area.kind,
        minZoom: area.minZoom
      }
    })
    groupedAreas.set(key, group)
  }

  return {
    type: 'FeatureCollection',
    features: [...groupedAreas.entries()].map(([key, group]) => {
      const geometries = group.map((area) => area.geometry)
      let geometry = geometries[0]
      if (geometries.length > 1) {
        try {
          const merged = union({
            type: 'FeatureCollection',
            features: group as Feature<Polygon | MultiPolygon>[]
          })
          geometry = merged?.geometry ?? combineGeometries(geometries)
        } catch {
          geometry = combineGeometries(geometries)
        }
      }

      return {
        type: 'Feature',
        geometry,
        properties: {
          name: getEnglishRegionName(group),
          nameFr: group[0].properties.nameFr,
          nameEs: group[0].properties.nameEs,
          kind: group[0].properties.kind,
          minZoom: Math.min(...group.map((area) => area.properties.minZoom)),
          marineId: key
        }
      }
    })
  }
}
