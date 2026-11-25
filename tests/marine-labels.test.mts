import assert from 'node:assert/strict'
import test from 'node:test'

import { createVisibleMarineLabels } from '../src/renderer/src/data/geography/marineLabelAnchors.ts'

const marineAreas = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'Test Sea', nameFr: 'Mer test', nameEs: 'Mar de prueba', minZoom: 1 },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0]
          ]
        ]
      }
    }
  ]
}

test('marine label anchor is recalculated within the visible part of its area', () => {
  const labels = createVisibleMarineLabels(marineAreas, [5, 0, 10, 10], 3)

  assert.equal(labels.features.length, 1)
  const [longitude, latitude] = labels.features[0].geometry.coordinates
  assert.ok(longitude > 5.5)
  assert.ok(longitude < 10)
  assert.ok(latitude > 0)
  assert.ok(latitude < 10)
  assert.equal(labels.features[0].properties.nameFr, 'Mer test')
})

test('marine labels respect their minimum zoom and viewport', () => {
  assert.equal(createVisibleMarineLabels(marineAreas, [0, 0, 10, 10], 0.5).features.length, 0)
  assert.equal(createVisibleMarineLabels(marineAreas, [20, 20, 30, 30], 3).features.length, 0)
})
