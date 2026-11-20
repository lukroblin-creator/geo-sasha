import assert from 'node:assert/strict'
import test from 'node:test'
import type { FeatureCollection, Geometry, Position } from 'geojson'

import {
  chooseCountryFeatureAtPoint,
  chooseDirectionalCountryFeature,
  getCountryFeatureHit,
  getCountryFeatureIdentity,
  getKeyboardActivationFeature,
  getNextCountryFeature,
  getTinyTerritoryHitRadius,
  type CountryHitFeature
} from '../src/renderer/src/data/geography/countryHitTesting.ts'
import {
  applyResolvedTerritoryOpacityMasks,
  getOpacityMaskTarget,
  type ResolvedTerritoryOpacityMask
} from '../src/renderer/src/data/geography/opacityMaskLogic.ts'
import {
  createCircleMaskGeometry,
  createRectangleMaskGeometry,
  getOpacityMaskHandlePatch,
  getOpacityMaskHandles
} from '../src/renderer/src/components/worldMapMaskGeometry.ts'

const screenMap = {
  getZoom: () => 0,
  project: ([longitude, latitude]: [number, number]) => ({ x: longitude, y: latitude })
}

function squareFeature(
  sourceId: string | number,
  bounds: [number, number, number, number]
): CountryHitFeature {
  const [west, south, east, north] = bounds
  const ring: Position[] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south]
  ]
  return {
    properties: { sourceId },
    geometry: { type: 'Polygon', coordinates: [ring] },
    layer: { id: 'countries-fill-10m' }
  }
}

function featureCollection(
  features: Array<{ properties?: Record<string, unknown> | null; geometry: Geometry }>
): FeatureCollection<Geometry> {
  return {
    type: 'FeatureCollection' as const,
    features: features.map((feature, index) => ({
      type: 'Feature' as const,
      id: `fixture-${index}`,
      properties: feature.properties ?? {},
      geometry: feature.geometry
    }))
  }
}

function pointInRing(point: [number, number], ring: Position[]): boolean {
  let inside = false
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const first = ring[index]
    const second = ring[previous]
    if (!first || !second) continue
    const crossesRay = first[1] > point[1] !== second[1] > point[1]
    if (
      crossesRay &&
      point[0] <
        ((second[0] - first[0]) * (point[1] - first[1])) / (second[1] - first[1]) + first[0]
    ) {
      inside = !inside
    }
  }
  return inside
}

function geometryContainsPoint(geometry: Geometry, point: [number, number]): boolean {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  return polygons.some((polygon) => {
    const outerRing = polygon[0]
    if (!outerRing || !pointInRing(point, outerRing)) return false
    return !polygon.slice(1).some((hole) => pointInRing(point, hole))
  })
}

function projectedGeometrySize(geometry: Geometry): [number, number] {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  const positions = polygons.flatMap((polygon) => polygon.flat())
  const projected = positions.map(([longitude, latitude]) => [
    (longitude * Math.PI * 6371) / 180,
    6371 * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))
  ])
  const xs = projected.map(([x]) => x)
  const ys = projected.map(([, y]) => y)
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
}

test('la sélection exacte d’un petit territoire passe avant le pays affiché dessous', (): void => {
  const algeria = squareFeature(12, [0, 0, 100, 100])
  const gabon = squareFeature(266, [4, 4, 6, 6])
  const selected = chooseCountryFeatureAtPoint(
    screenMap,
    { x: 5, y: 5 },
    [algeria, gabon],
    algeria,
    (feature) => (feature.properties?.sourceId === 12 ? 2_381_741 : 26_767)
  )

  assert.equal(selected, gabon)
})

test('un grand pays reste précis et ne reçoit pas de hitzone élargie', (): void => {
  const algeria = squareFeature(12, [0, 0, 100, 100])
  assert.equal(getCountryFeatureHit(screenMap, algeria, { x: 102, y: 50 }, 2_381_741), null)
  assert.equal(getCountryFeatureHit(screenMap, algeria, { x: 50, y: 50 }, 2_381_741)?.distance, 0)
})

test('la hitzone des petits pays s’élargit au dézoom et suit la distance au contour', (): void => {
  const tinyCountry = squareFeature(480, [0, 0, 1, 1])
  assert.equal(getTinyTerritoryHitRadius(0), 14)
  assert.equal(getTinyTerritoryHitRadius(6), 4)
  assert.equal(getCountryFeatureHit(screenMap, tinyCountry, { x: 5, y: 0.5 }, 1_000)?.distance, 4)
  assert.equal(
    getCountryFeatureHit(
      { ...screenMap, getZoom: () => 6 },
      tinyCountry,
      { x: 5.5, y: 0.5 },
      1_000
    ),
    null
  )
})

test('Maj parcourt les petits territoires et reboucle sur le premier', (): void => {
  const guyana = squareFeature(254, [0, 0, 1, 1])
  const gabon = squareFeature(266, [2, 0, 3, 1])
  const ghana = squareFeature(288, [4, 0, 5, 1])
  const candidates = [guyana, gabon, ghana]

  assert.equal(getNextCountryFeature(candidates, getCountryFeatureIdentity(guyana)), gabon)
  assert.equal(getNextCountryFeature(candidates, getCountryFeatureIdentity(ghana)), guyana)
  assert.equal(getNextCountryFeature(candidates, null), guyana)
})

test('les flèches préselectionnent le meilleur pays dans la direction demandée', (): void => {
  const east = { name: 'est' }
  const diagonal = { name: 'diagonale' }
  const west = { name: 'ouest' }
  const candidates = [
    { feature: east, point: { x: 10, y: 0 } },
    { feature: diagonal, point: { x: 7, y: 7 } },
    { feature: west, point: { x: -5, y: 0 } }
  ]

  assert.equal(chooseDirectionalCountryFeature({ x: 0, y: 0 }, candidates, 'ArrowRight', 100), east)
  assert.equal(chooseDirectionalCountryFeature({ x: 0, y: 0 }, candidates, 'ArrowLeft', 100), west)
  assert.equal(chooseDirectionalCountryFeature({ x: 0, y: 0 }, candidates, 'ArrowRight', 4), null)
})

test('Entrée valide la présélection, mais ne détourne pas la validation de la recherche', (): void => {
  const preselected = squareFeature(266, [0, 0, 1, 1])
  assert.equal(getKeyboardActivationFeature(preselected, false), preselected)
  assert.equal(getKeyboardActivationFeature(preselected, true), null)
})

test('le masque respecte sa cible et laisse une zone transparente sur le calque visé', (): void => {
  assert.equal(
    getOpacityMaskTarget({ id: 'default', name: 'Défaut', kind: 'circle', opacity: 0 }),
    'texture'
  )
  assert.equal(
    getOpacityMaskTarget({
      id: 'territories',
      name: 'Territoires',
      kind: 'country',
      opacity: 0,
      targetLayerId: 'territories'
    }),
    'territories'
  )
  assert.equal(
    getOpacityMaskTarget({
      id: 'unassigned',
      name: 'Sans cible',
      kind: 'circle',
      opacity: 0,
      targetLayerId: null
    }),
    null
  )

  const source = featureCollection([
    squareFeature(1, [0, 0, 10, 10]),
    squareFeature(2, [20, 0, 30, 10])
  ])
  const mask: ResolvedTerritoryOpacityMask = {
    kind: 'country',
    opacity: 0,
    territoryIds: new Set(['1']),
    geometryFeatures: []
  }
  const result = applyResolvedTerritoryOpacityMasks(source, [mask])

  assert.equal(
    result.features.find((feature) => feature.properties?.sourceId === 1)?.properties
      ?.opacityMaskMultiplier,
    0
  )
  assert.equal(
    result.features.find((feature) => feature.properties?.sourceId === 2)?.properties
      ?.opacityMaskMultiplier,
    1
  )
})

test('un masque désactivé ou à opacité totale ne modifie pas la carte', (): void => {
  const source = featureCollection([squareFeature(1, [0, 0, 10, 10])])
  const mask: ResolvedTerritoryOpacityMask = {
    kind: 'country',
    opacity: 0,
    territoryIds: new Set(['1']),
    geometryFeatures: []
  }
  assert.equal(applyResolvedTerritoryOpacityMasks(source, [{ ...mask, enabled: false }]), source)
  assert.equal(applyResolvedTerritoryOpacityMasks(source, [{ ...mask, opacity: 1 }]), source)
})

test('un masque géométrique à zéro ouvre bien un trou vers le calque inférieur', (): void => {
  const subject = squareFeature(1, [0, 0, 10, 10])
  const maskShape = squareFeature('mask', [4, 4, 6, 6])
  const source = featureCollection([subject])
  const result = applyResolvedTerritoryOpacityMasks(source, [
    {
      kind: 'circle',
      opacity: 0,
      territoryIds: new Set(),
      geometryFeatures: [
        {
          type: 'Feature',
          properties: {},
          geometry: maskShape.geometry as Extract<Geometry, { type: 'Polygon' }>
        }
      ]
    }
  ])

  assert.ok(result.features.length > 0)
  assert.equal(
    result.features.some((feature) => geometryContainsPoint(feature.geometry, [5, 5])),
    false
  )
  assert.equal(
    result.features.some((feature) => geometryContainsPoint(feature.geometry, [1, 1])),
    true
  )
})

test('les masques cercle et rectangle gardent leur forme quand ils sont déplacés en latitude', (): void => {
  const circleAtEquator = createCircleMaskGeometry([15, 0], 700)
  const circleNorth = createCircleMaskGeometry([15, 68], 700)
  const rectangleAtEquator = createRectangleMaskGeometry([15, 0], 1200, 800)
  const rectangleNorth = createRectangleMaskGeometry([15, 68], 1200, 800)

  const circleSize = projectedGeometrySize(circleAtEquator)
  const northernCircleSize = projectedGeometrySize(circleNorth)
  const rectangleSize = projectedGeometrySize(rectangleAtEquator)
  const northernRectangleSize = projectedGeometrySize(rectangleNorth)
  assert.ok(Math.abs(circleSize[0] - northernCircleSize[0]) < 1)
  assert.ok(Math.abs(circleSize[1] - northernCircleSize[1]) < 1)
  assert.ok(Math.abs(rectangleSize[0] - northernRectangleSize[0]) < 1)
  assert.ok(Math.abs(rectangleSize[1] - northernRectangleSize[1]) < 1)
})

test('les poignées redimensionnent les masques dans le même espace que leur tracé', (): void => {
  const mask = {
    id: 'handle-check',
    name: 'Cercle',
    kind: 'circle' as const,
    opacity: 0,
    center: [15, 68] as [number, number],
    radiusKm: 700
  }
  const radiusHandle = getOpacityMaskHandles(mask).find(({ kind }) => kind === 'radius')
  assert.ok(radiusHandle)
  const patch = getOpacityMaskHandlePatch(mask, radiusHandle, [
    radiusHandle.longitude,
    radiusHandle.latitude
  ])
  assert.equal(patch?.radiusKm, 700)
})
