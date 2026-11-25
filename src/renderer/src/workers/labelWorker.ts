import type { FeatureCollection, Geometry, Point } from 'geojson'

import marineLabelData from '../data/geography/marineLabels.json'
import { createVisibleCountryLabels } from '../data/geography/labels'
import {
  createVisibleMarineLabels,
  type MarineLabelProperties
} from '../data/geography/marineLabelAnchors'
import { prepareMarineRegions } from '../data/geography/marineRegions'

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  priority: number
  sourceFeatureId?: string | number | null
}

type WorkerMessage =
  | {
      type: 'init'
      countries: FeatureCollection<Geometry>
    }
  | {
      type: 'update'
      bbox: [number, number, number, number]
      zoom: number
      includeMarineLabels: boolean
      requestId: number
    }

type WorkerResponse = {
  type: 'ready' | 'labels'
  requestId?: number
  labels?: FeatureCollection<Point, LabelProperties>
  marineLabels?: FeatureCollection<Point, MarineLabelProperties>
}

let countries: FeatureCollection<Geometry> | null = null
const marineAreas = prepareMarineRegions(
  marineLabelData as unknown as Parameters<typeof prepareMarineRegions>[0]
)

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

workerScope.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data

  if (message.type === 'init') {
    countries = message.countries

    workerScope.postMessage({
      type: 'ready'
    } satisfies WorkerResponse)

    return
  }

  if (message.type === 'update') {
    if (!countries) return

    const labels = createVisibleCountryLabels(countries, message.bbox, message.zoom)
    const marineLabels = message.includeMarineLabels
      ? createVisibleMarineLabels(marineAreas, message.bbox, message.zoom)
      : { type: 'FeatureCollection' as const, features: [] }

    workerScope.postMessage({
      type: 'labels',
      requestId: message.requestId,
      labels,
      marineLabels
    } satisfies WorkerResponse)
  }
}
