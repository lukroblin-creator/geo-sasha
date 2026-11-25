import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { prepareMarineRegions } from '../src/renderer/src/data/geography/marineRegions.ts'

test('north and south ocean entries with the same localized name form one continuous region', () => {
  const regions = prepareMarineRegions([
    {
      name: 'North Atlantic Ocean',
      nameFr: 'océan Atlantique',
      nameEs: 'océano Atlántico',
      kind: 'ocean',
      minZoom: 0.5,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-10, 0],
            [10, 0],
            [10, 10],
            [-10, 10],
            [-10, 0]
          ]
        ]
      }
    },
    {
      name: 'South Atlantic Ocean',
      nameFr: 'océan Atlantique',
      nameEs: 'océano Atlántico',
      kind: 'ocean',
      minZoom: 1,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-10, -10],
            [10, -10],
            [10, 0],
            [-10, 0],
            [-10, -10]
          ]
        ]
      }
    }
  ])

  assert.equal(regions.features.length, 1)
  assert.equal(regions.features[0].properties.name, 'Atlantic Ocean')
  assert.equal(regions.features[0].properties.minZoom, 0.5)

  const geometry = regions.features[0].geometry
  assert.equal(geometry.type, 'Polygon')
  const equatorialInteriorSegments = geometry.coordinates[0].filter(
    (coordinate, index, ring) => index > 0 && coordinate[1] === 0 && ring[index - 1][1] === 0
  )
  assert.equal(equatorialInteriorSegments.length, 0)
})

test('Natural Earth Atlantic and Pacific remove their duplicated equatorial borders', async () => {
  const source = JSON.parse(
    await readFile(
      new URL('../src/renderer/src/data/geography/marineLabels.json', import.meta.url),
      'utf8'
    )
  ) as Parameters<typeof prepareMarineRegions>[0]

  const getEdgeKeys = (geometry: (typeof source)[number]['geometry']): Set<string> => {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.type === 'MultiPolygon'
          ? geometry.coordinates
          : []
    const edges = new Set<string>()
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let index = 1; index < ring.length; index += 1) {
          const first = ring[index - 1]
          const second = ring[index]
          const ordered =
            first[0] < second[0] || (first[0] === second[0] && first[1] <= second[1])
              ? [first, second]
              : [second, first]
          edges.add(JSON.stringify(ordered))
        }
      }
    }
    return edges
  }

  for (const names of [
    ['North Atlantic Ocean', 'South Atlantic Ocean'],
    ['North Pacific Ocean', 'South Pacific Ocean']
  ]) {
    const sourceAreas = source.filter((area) => names.includes(area.name))
    const sourceEdges = sourceAreas.map((area) => getEdgeKeys(area.geometry))
    const sharedEdges = [...sourceEdges[0]].filter((edge) => sourceEdges[1].has(edge))
    assert.ok(
      sharedEdges.length > 0,
      `${names[0]} and ${names[1]} should share the equatorial seam`
    )

    const merged = prepareMarineRegions(sourceAreas)
    assert.equal(merged.features.length, 1)
    const mergedEdges = getEdgeKeys(merged.features[0].geometry)
    assert.ok(sharedEdges.every((edge) => !mergedEdges.has(edge)))
  }
})
