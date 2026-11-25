import assert from 'node:assert/strict'
import test from 'node:test'

import { createMarineBoundaryAtProgress } from '../src/renderer/src/data/geography/marineBoundaryAnimation.ts'

const rectangle = {
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

test('marine boundary drawing progresses from its first endpoint to completion', () => {
  assert.equal(createMarineBoundaryAtProgress(rectangle, 'test-sea', 0).features.length, 0)

  const halfway = createMarineBoundaryAtProgress(rectangle, 'test-sea', 0.5)
  assert.equal(halfway.features.length, 1)
  assert.deepEqual(halfway.features[0].geometry.coordinates[0], [0, 0])
  const halfwayEndpoint = halfway.features[0].geometry.coordinates.at(-1)
  assert.ok(halfwayEndpoint)
  assert.equal(halfwayEndpoint[0], 10)
  assert.ok(halfwayEndpoint[1] > 9.9 && halfwayEndpoint[1] < 10)

  const complete = createMarineBoundaryAtProgress(rectangle, 'test-sea', 1)
  assert.equal(complete.features.length, 1)
  assert.deepEqual(complete.features[0].geometry.coordinates, rectangle.coordinates[0])
})

test('marine boundaries cross the antimeridian using the short path', () => {
  const crossing = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [179, 0],
        [-179, 0],
        [-179, 2],
        [179, 2],
        [179, 0]
      ]
    ]
  }
  const halfway = createMarineBoundaryAtProgress(crossing, 'dateline-sea', 0.25)
  const finalPoint = halfway.features[0].geometry.coordinates.at(-1)

  assert.ok(finalPoint)
  assert.ok(Math.abs(finalPoint[0]) > 179)
})
