export type CameraRotation = {
  yaw: number
  pitch: number
  roll: number
}

export type SavedCameraView = CameraRotation & {
  center: [number, number]
  maxPitch: number
}

type CameraQuaternion = [number, number, number, number]

export const normalizeCameraAngle = (angle: number): number =>
  ((((angle + 180) % 360) + 360) % 360) - 180

export const normalizeCameraLatitude = (latitude: number): number => {
  const wrapped = ((((latitude + 180) % 360) + 360) % 360) - 180
  if (wrapped > 90) return 180 - wrapped
  if (wrapped < -90) return -180 - wrapped
  return wrapped
}

const multiplyCameraQuaternions = (
  left: CameraQuaternion,
  right: CameraQuaternion
): CameraQuaternion => [
  left[3] * right[0] + left[0] * right[3] + left[1] * right[2] - left[2] * right[1],
  left[3] * right[1] - left[0] * right[2] + left[1] * right[3] + left[2] * right[0],
  left[3] * right[2] + left[0] * right[1] - left[1] * right[0] + left[2] * right[3],
  left[3] * right[3] - left[0] * right[0] - left[1] * right[1] - left[2] * right[2]
]

export const cameraAxisQuaternion = (axis: 0 | 1, degrees: number): CameraQuaternion => {
  const halfAngle = (degrees * Math.PI) / 360
  const result: CameraQuaternion = [0, 0, 0, Math.cos(halfAngle)]
  result[axis] = Math.sin(halfAngle)
  return result
}

export const multiplyCameraOrientations = (
  left: CameraQuaternion,
  right: CameraQuaternion
): CameraQuaternion => multiplyCameraQuaternions(left, right)

export const mapOrientationQuaternion = (
  longitude: number,
  latitude: number,
  bearing: number
): CameraQuaternion => {
  const halfAngle = Math.PI / 360
  const x = -longitude * halfAngle
  const y = -latitude * halfAngle
  const z = bearing * halfAngle
  const sx = Math.sin(x)
  const cx = Math.cos(x)
  const sy = Math.sin(y)
  const cy = Math.cos(y)
  const sz = Math.sin(z)
  const cz = Math.cos(z)
  // MapLibre's orientation uses the ZYX Euler order for longitude, latitude and bearing.
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz
  ]
}

export const cameraMapOrientation = (
  quaternion: CameraQuaternion
): { longitude: number; latitude: number; bearing: number } => {
  const [x, y, z, w] = quaternion
  return {
    longitude: normalizeCameraAngle(
      (-Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * 180) / Math.PI
    ),
    latitude: (-Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))) * 180) / Math.PI,
    bearing: normalizeCameraAngle(
      (Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180) / Math.PI
    )
  }
}
