import type { GeographicGeometryLink } from './types'

// Registre des liens entre les géométries et les entités géographiques.
export const geographicGeometryLinks: GeographicGeometryLink[] = [
  {
    id: 'geometry:natural-earth-110m:france',
    entityId: 'country:france',
    sourceId: 'natural-earth-110m',
    sourceFeatureId: 250
  },
  {
    id: 'geometry:natural-earth-50m:france',
    entityId: 'country:france',
    sourceId: 'natural-earth-50m',
    sourceFeatureId: 250
  },
  {
    id: 'geometry:natural-earth-10m:france',
    entityId: 'country:france',
    sourceId: 'natural-earth-10m',
    sourceFeatureId: 250
  },
  ...([['110m', 0], ['50m', 0]] as const).map(([scale, sourcePolygonIndex]) => ({
    id: `geometry:natural-earth-${scale}:france:polygon-${sourcePolygonIndex}`,
    entityId: 'territory:guyane',
    sourceId: `natural-earth-${scale}`,
    sourceFeatureId: 250,
    sourcePolygonIndex
  })),
  ...([
    [0, 'territory:guyane'],
    [2, 'territory:martinique'],
    [3, 'territory:guadeloupe'],
    [4, 'territory:guadeloupe'],
    [5, 'territory:guadeloupe'],
    [6, 'territory:guadeloupe'],
    [7, 'territory:reunion'],
    [8, 'territory:mayotte'],
    [9, 'territory:mayotte'],
    [18, 'territory:guadeloupe'],
    [19, 'territory:guadeloupe']
  ] as const).map(([sourcePolygonIndex, entityId]) => ({
    id: `geometry:natural-earth-10m:france:polygon-${sourcePolygonIndex}`,
    entityId,
    sourceId: 'natural-earth-10m',
    sourceFeatureId: 250,
    sourcePolygonIndex
  })),
  ...(
    [
      ['110m', 540, 'territory:nouvelle-caledonie'],
      ['50m', 540, 'territory:nouvelle-caledonie'],
      ['10m', 540, 'territory:nouvelle-caledonie'],
      ['50m', 258, 'territory:polynesie-francaise'],
      ['10m', 258, 'territory:polynesie-francaise'],
      ['50m', 876, 'territory:wallis-et-futuna'],
      ['10m', 876, 'territory:wallis-et-futuna']
    ] as const
  ).map(([scale, sourceFeatureId, entityId]) => ({
    id: `geometry:natural-earth-${scale}:${entityId}`,
    entityId,
    sourceId: `natural-earth-${scale}`,
    sourceFeatureId
  }))
]
