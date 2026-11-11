
import type {
  FeatureCollection,
  Geometry,
  Point
} from 'geojson'

import { createVisibleCountryLabels } from '../data/geography/labels'

type LabelProperties = {
  name: string
  sourceName: string
  entityId: string | null
  resolution: string
  priority: number
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
      requestId: number
    }

type WorkerResponse = {
  type: 'ready' | 'labels'
  requestId?: number
  labels?: FeatureCollection<Point, LabelProperties>
}

let countries: FeatureCollection<Geometry> | null = null


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

    const labels = createVisibleCountryLabels(
      countries,
      message.bbox,
      message.zoom
    )

    workerScope.postMessage({
      type: 'labels',
      requestId: message.requestId,
      labels
    } satisfies WorkerResponse)
  }
}
