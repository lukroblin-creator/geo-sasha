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
  }
]