import type { ContinentId } from '../quiz/countryContinents'

export type ManagedMapLayerId =
  | 'texture'
  | 'topography'
  | 'territories'
  | 'borders'
  | 'labels'
  | 'rivers'
  | 'mountains'
  | 'summits'
  | 'flags'
  | 'resources'

export type MapLayerStackId = ManagedMapLayerId | `mask:${string}`

export type MapOpacityMask = {
  id: string
  name: string
  kind: 'circle' | 'rectangle' | 'country' | 'continent'
  opacity: number
  enabled?: boolean
  targetLayerId?: ManagedMapLayerId | null
  center?: [number, number]
  radiusKm?: number
  widthKm?: number
  heightKm?: number
  sourceFeatureId?: string | number
  sourceFeatureIds?: Array<string | number>
  continent?: ContinentId
  continents?: ContinentId[]
}

export type MapOpacityMaskDraft = Omit<MapOpacityMask, 'id' | 'center'>

export type MapLayerOpacityValues = Record<ManagedMapLayerId, number>

export const defaultMapLayerOrder: MapLayerStackId[] = [
  'resources',
  'flags',
  'labels',
  'rivers',
  'summits',
  'mountains',
  'borders',
  'topography',
  'texture',
  'territories'
]

export const defaultMapLayerOpacities: MapLayerOpacityValues = {
  texture: 100,
  topography: 100,
  territories: 100,
  borders: 100,
  labels: 100,
  rivers: 100,
  mountains: 100,
  summits: 100,
  flags: 100,
  resources: 100
}
