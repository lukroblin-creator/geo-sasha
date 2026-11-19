import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cameraAxisQuaternion,
  cameraMapOrientation,
  mapOrientationQuaternion,
  multiplyCameraOrientations,
  normalizeCameraAngle,
  normalizeCameraLatitude
} from '../src/renderer/src/components/worldMapCamera.ts'

test('les angles affichés se replient proprement après plusieurs tours', (): void => {
  assert.equal(normalizeCameraAngle(540), -180)
  assert.equal(normalizeCameraAngle(-540), -180)
  assert.equal(normalizeCameraAngle(725), 5)
})

test('le pitch traverse les pôles sans sortir de la plage de latitude', (): void => {
  assert.equal(normalizeCameraLatitude(91), 89)
  assert.equal(normalizeCameraLatitude(100), 80)
  assert.equal(normalizeCameraLatitude(-100), -80)
  assert.equal(normalizeCameraLatitude(271), -89)
})

test('les conversions d’orientation préservent une rotation caméra ordinaire', (): void => {
  const expected = { longitude: 37.5, latitude: 24.25, bearing: -18 }
  const actual = cameraMapOrientation(
    mapOrientationQuaternion(expected.longitude, expected.latitude, expected.bearing)
  )

  assert.ok(Math.abs(actual.longitude - expected.longitude) < 1e-9)
  assert.ok(Math.abs(actual.latitude - expected.latitude) < 1e-9)
  assert.ok(Math.abs(actual.bearing - expected.bearing) < 1e-9)
})

test('les petites rotations composées restent finies en franchissant un pôle', (): void => {
  const current = mapOrientationQuaternion(12, 89, 0)
  const pitch = cameraAxisQuaternion(1, 3)
  const next = cameraMapOrientation(multiplyCameraOrientations(current, pitch))

  assert.ok(Number.isFinite(next.longitude))
  assert.ok(Number.isFinite(next.latitude))
  assert.ok(Number.isFinite(next.bearing))
  assert.ok(next.latitude <= 90 && next.latitude >= -90)
})
