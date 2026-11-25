import assert from 'node:assert/strict'
import test from 'node:test'
import type { FeatureCollection, Geometry, Position } from 'geojson'

import {
  chooseCountryFeatureAtPoint,
  chooseDirectionalCountryFeature,
  getCountryFeatureHit,
  getLandNeighborHitRadius,
  getCountryFeatureIdentity,
  hasOnlyLargeLandNeighbors,
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
import {
  getMapMagnifierZoom,
  moveMapMagnifier,
  scaleMapMagnifierSize,
  MAP_MAGNIFIER_BASE_SIZE,
  type MapMagnifierPoint
} from '../src/renderer/src/components/mapMagnifierUtils.ts'
import { createPolarBlendPixels } from '../src/renderer/src/components/polarTextureBlend.ts'

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

test('la loupe grossit la carte par huit et ralentit le mouvement au huitième', (): void => {
  assert.equal(getMapMagnifierZoom(1.5), 4.5)
  assert.equal(getMapMagnifierZoom(11), 14)

  const position: MapMagnifierPoint = { x: 500, y: 300 }
  const moved = moveMapMagnifier(
    position,
    { x: 100, y: 100 },
    { x: 180, y: 20 },
    MAP_MAGNIFIER_BASE_SIZE,
    { width: 1_000, height: 800 }
  )
  assert.deepEqual(moved, { x: 510, y: 290 })
})

test('le pavé tactile redimensionne le rectangle sans changer ses proportions', (): void => {
  const enlarged = scaleMapMagnifierSize(MAP_MAGNIFIER_BASE_SIZE, -100)
  const reduced = scaleMapMagnifierSize(MAP_MAGNIFIER_BASE_SIZE, 100)

  assert.ok(enlarged.width > MAP_MAGNIFIER_BASE_SIZE.width)
  assert.ok(reduced.width < MAP_MAGNIFIER_BASE_SIZE.width)
  assert.equal(enlarged.width / enlarged.height, MAP_MAGNIFIER_BASE_SIZE.width / MAP_MAGNIFIER_BASE_SIZE.height)
  assert.equal(scaleMapMagnifierSize(MAP_MAGNIFIER_BASE_SIZE, 10_000).width, 220)
  assert.equal(scaleMapMagnifierSize(MAP_MAGNIFIER_BASE_SIZE, -10_000).width, 560)
})

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

test('le Royaume-Uni ne reçoit pas le halo malgré la surface réduite de son territoire principal', (): void => {
  const unitedKingdom = squareFeature(826, [0, 0, 2, 2])
  assert.equal(getCountryFeatureHit(screenMap, unitedKingdom, { x: 10, y: 1 }, 14_188), null)
})

test('la hitzone des petits pays suit un fantôme de même forme agrandi de moitié', (): void => {
  const tinyCountry = squareFeature(480, [0, 0, 1, 1])
  assert.equal(getTinyTerritoryHitRadius(0), 14)
  assert.equal(getTinyTerritoryHitRadius(6), 4)
  const ghostHit = getCountryFeatureHit(screenMap, tinyCountry, { x: 1.2, y: 0.5 }, 1_000)
  assert.equal(ghostHit?.isGhostHit, true)
  assert.equal(getCountryFeatureHit(screenMap, tinyCountry, { x: 1.3, y: 0.5 }, 1_000), null)
})

test('la hitzone maritime peut dépasser le fantôme sans voler le clic dans un grand pays', (): void => {
  const island = squareFeature(833, [5, 5, 6, 6])
  const largeNeighbor = squareFeature(826, [0, 0, 20, 20])
  const seaHit = getCountryFeatureHit(screenMap, island, { x: 2, y: 5.5 }, 1_000, 24)
  assert.equal(seaHit?.isGhostHit, true)

  const selected = chooseCountryFeatureAtPoint(
    screenMap,
    { x: 4, y: 5.5 },
    [island, largeNeighbor],
    largeNeighbor,
    (feature) => (feature === largeNeighbor ? 1_000_000 : 1_000),
    (feature) => (feature === island ? 24 : 0)
  )
  assert.equal(selected, largeNeighbor)
})

test('une hitzone insulaire ne se fait pas bloquer par un ancien contour côtier trop large', (): void => {
  const island = squareFeature(833, [5, 5, 6, 6])
  const coarseNeighbor = squareFeature(826, [0, 0, 20, 20])
  const preciseNeighbor = squareFeature(826, [0, 0, 3, 20])
  preciseNeighbor.properties = { ...preciseNeighbor.properties, hitTestResolution: '10m' }

  const selected = chooseCountryFeatureAtPoint(
    screenMap,
    { x: 4, y: 5.5 },
    [coarseNeighbor, preciseNeighbor, island],
    coarseNeighbor,
    (feature) => (feature === island ? 1_000 : 1_000_000),
    (feature) => (feature === island ? 24 : 0)
  )
  assert.equal(selected, island)
})

test('les îles du territoire britannique de l’océan Indien gardent une hitzone maritime sans métrique locale', (): void => {
  const biotIsland = squareFeature('086', [0, 0, 1, 1])
  const hit = getCountryFeatureHit(screenMap, biotIsland, { x: 20, y: 0.5 }, null, 24)
  assert.equal(hit?.isGhostHit, true)
})

test('un petit îlot reste ciblable en mer même si la superficie totale du pays est grande', (): void => {
  const archipelago: CountryHitFeature = {
    properties: { sourceId: 581 },
    layer: { id: 'countries-fill-10m' },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ],
        [
          [
            [100, 100],
            [200, 100],
            [200, 200],
            [100, 200],
            [100, 100]
          ]
        ]
      ]
    }
  }

  const marineHit = getCountryFeatureHit(screenMap, archipelago, { x: 3, y: 0.5 }, 900_000, 24)
  assert.equal(marineHit?.isGhostHit, true)

  const landHit = getCountryFeatureHit(screenMap, archipelago, { x: 150, y: 150 }, 900_000, 24)
  assert.equal(landHit?.distance, 0)
  assert.equal(landHit?.isGhostHit, undefined)
})

test('Liechtenstein peut avoir un fantôme quatre fois plus grand en gardant sa forme', (): void => {
  const liechtenstein = squareFeature(438, [0, 0, 1, 1])
  const farEdgeHit = getCountryFeatureHit(screenMap, liechtenstein, { x: 2.2, y: 0.5 }, 137, 0, 4)
  assert.equal(farEdgeHit?.isGhostHit, true)
  assert.equal(getCountryFeatureHit(screenMap, liechtenstein, { x: 2.6, y: 0.5 }, 137, 0, 4), null)
})

test('la hitzone terrestre augmente avec la taille des voisins et diminue au zoom', (): void => {
  assert.equal(getLandNeighborHitRadius(0, [1_000_000, 400_000]), 40)
  assert.equal(getLandNeighborHitRadius(0, [80_000, 60_000]), 30)
  assert.equal(getLandNeighborHitRadius(0, [8_000, 4_000]), 14)
  assert.equal(getLandNeighborHitRadius(8, [1_000_000]), 10)
  assert.equal(getLandNeighborHitRadius(0, []), 0)
})

test('les très petits pays bordés uniquement par de grands pays gardent une hitzone élargie hors du voisin', (): void => {
  const largeNeighbor = squareFeature(380, [0, 0, 4.6, 20])
  const enclave = squareFeature(674, [5, 5, 6, 6])
  const candidates = [largeNeighbor, enclave]

  assert.equal(getTinyTerritoryHitRadius(0, true), 24)
  assert.equal(getTinyTerritoryHitRadius(6, true), 12)
  assert.equal(hasOnlyLargeLandNeighbors([1_000_000, 41_000]), true)
  assert.equal(hasOnlyLargeLandNeighbors([1_000_000, 12_000]), false)
  assert.equal(hasOnlyLargeLandNeighbors([]), false)

  const selected = chooseCountryFeatureAtPoint(
    screenMap,
    { x: 4.8, y: 5.5 },
    candidates,
    largeNeighbor,
    (feature) => (feature === largeNeighbor ? 1_000_000 : 1_000)
  )

  assert.equal(selected, enclave)
})

test('un pays voisin reste sélectionnable dans sa géométrie malgré le halo du micro-État', (): void => {
  const largeNeighbor = squareFeature(380, [0, 0, 20, 20])
  const enclave = squareFeature(674, [5, 5, 6, 6])

  const selected = chooseCountryFeatureAtPoint(
    screenMap,
    { x: 4, y: 5.5 },
    [largeNeighbor, enclave],
    largeNeighbor,
    (feature) => (feature === largeNeighbor ? 1_000_000 : 1_000)
  )

  assert.equal(selected, largeNeighbor)
})

test('le parcours des petits territoires reboucle sur le premier', (): void => {
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

test('la texture polaire conserve son bord et se fond vers une couleur commune au pôle', (): void => {
  const edge = new Uint8ClampedArray([200, 20, 40, 255, 20, 60, 220, 255])
  const north = createPolarBlendPixels(edge, 3, true)
  const south = createPolarBlendPixels(edge, 3, false)

  assert.deepEqual([...north.slice(-8)], [...edge])
  assert.deepEqual([...south.slice(0, 8)], [...edge])
  assert.deepEqual([...north.slice(0, 4)], [...north.slice(4, 8)])
  assert.deepEqual([...south.slice(-8, -4)], [...south.slice(-4)])
  assert.notDeepEqual([...north.slice(8, 16)], [...edge])
})
