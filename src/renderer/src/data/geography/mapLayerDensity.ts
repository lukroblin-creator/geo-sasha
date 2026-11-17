import rivers from './physical/rivers.json'
import riverLabels from './physical/riverLabels.json'
import mountainPeaks from './physical/mountainPeaks.json'
import { getResourceIndustryCount } from './resources'

export type DensityLayerId = 'labels' | 'flags' | 'rivers' | 'mountains' | 'resources'

export const mapLayerDensityMaximums: Record<DensityLayerId, number> = {
  // Country plus territorial place labels in the offline Natural Earth catalog.
  labels: 300,
  flags: 300,
  rivers: Math.max(rivers.features.length, riverLabels.features.length),
  mountains: mountainPeaks.features.length,
  resources: getResourceIndustryCount()
}

export type MapLayerDensities = Record<DensityLayerId, number>

export const fullMapLayerDensities: MapLayerDensities = {
  labels: mapLayerDensityMaximums.labels,
  flags: mapLayerDensityMaximums.flags,
  rivers: mapLayerDensityMaximums.rivers,
  mountains: mapLayerDensityMaximums.mountains,
  resources: mapLayerDensityMaximums.resources
}
