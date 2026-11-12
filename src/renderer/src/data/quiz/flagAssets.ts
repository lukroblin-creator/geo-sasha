import flagMetadata from './flagMetadata.json'
import { flagEmojiFromAlpha2 } from './flagEmoji'

const flagSvgUrls = import.meta.glob<string>(
  '../../../../../node_modules/svg-country-flags/svg/*.svg',
  { eager: true, query: '?url', import: 'default' }
)
const flagOverrideSvgUrls = import.meta.glob<string>('./flag-overrides/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
})

export type FlagAspectRatio = {
  ratio: number
  label: string
}

export type FlagOutlinePoint = [number, number]

export type FlagPolygonDrawing = {
  points: FlagOutlinePoint[]
  ratio: number
}

export type FlagRatioRange = {
  minimum: number
  maximum: number
}

type FlagMetadata = {
  alpha2: string
  ratio: number
  ratioLabel: string | null
  shape: 'rectangle' | 'polygon'
  outline?: FlagOutlinePoint[]
  colors: string[]
}

const metadataByCode = new Map<string, FlagMetadata>(
  (flagMetadata as FlagMetadata[]).map((metadata) => [metadata.alpha2, metadata])
)
const flagSvgUrlByCode = new Map<string, string>(
  [...Object.entries(flagSvgUrls), ...Object.entries(flagOverrideSvgUrls)].flatMap(
    ([path, url]) => {
      const alpha2 = path.match(/\/([a-z]{2})\.svg$/i)?.[1]?.toUpperCase()
      return alpha2 ? [[alpha2, url] as const] : []
    }
  )
)

export function getFlagAspectRatio(alpha2: string): FlagAspectRatio | null {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  if (!metadata) return null

  return {
    ratio: metadata.ratio,
    label:
      metadata.ratioLabel ??
      `${metadata.ratio.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}:1`
  }
}

export function getFlagOutline(alpha2: string): FlagOutlinePoint[] | null {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  if (!metadata || metadata.shape !== 'polygon' || !metadata.outline) return null
  return metadata.outline
}

export function flagOutlineMatches(alpha2: string, drawing: FlagPolygonDrawing): boolean {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  const reference = getFlagOutline(alpha2)
  if (!metadata || !reference || drawing.points.length !== reference.length) return false

  const ratioTolerance = Math.max(0.12, metadata.ratio * 0.25)
  if (Math.abs(metadata.ratio - drawing.ratio) > ratioTolerance) return false

  const drawnSamples = sampleClosedOutline(drawing.points)
  const referenceSamples = sampleClosedOutline(reference)
  const outlineDistance =
    (meanDistanceToOutline(drawnSamples, reference) +
      meanDistanceToOutline(referenceSamples, drawing.points)) /
    2
  return outlineDistance <= 0.18
}

function sampleClosedOutline(points: FlagOutlinePoint[], count = 64): FlagOutlinePoint[] {
  const segments = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    const length = Math.hypot(next[0] - point[0], next[1] - point[1])
    return { start: point, end: next, length }
  })
  const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0)
  if (perimeter === 0) return points

  return Array.from({ length: count }, (_, sampleIndex) => {
    let distance = (sampleIndex / count) * perimeter
    for (const segment of segments) {
      if (distance <= segment.length) {
        const progress = segment.length === 0 ? 0 : distance / segment.length
        return [
          segment.start[0] + (segment.end[0] - segment.start[0]) * progress,
          segment.start[1] + (segment.end[1] - segment.start[1]) * progress
        ]
      }
      distance -= segment.length
    }
    return segments.at(-1)!.end
  })
}

function meanDistanceToOutline(samples: FlagOutlinePoint[], outline: FlagOutlinePoint[]): number {
  if (samples.length === 0 || outline.length < 2) return Infinity
  const totalDistance = samples.reduce((sum, point) => {
    let nearest = Infinity
    for (let index = 0; index < outline.length; index += 1) {
      const start = outline[index]
      const end = outline[(index + 1) % outline.length]
      const dx = end[0] - start[0]
      const dy = end[1] - start[1]
      const segmentLengthSquared = dx * dx + dy * dy
      const progress =
        segmentLengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / segmentLengthSquared
              )
            )
      nearest = Math.min(
        nearest,
        Math.hypot(point[0] - (start[0] + progress * dx), point[1] - (start[1] + progress * dy))
      )
    }
    return sum + nearest
  }, 0)
  return totalDistance / samples.length
}

export function getFlagImageSource(alpha2: string): string {
  return (
    flagSvgUrlByCode.get(alpha2.toUpperCase()) ??
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><text y="2.5" font-size="2.5">${flagEmojiFromAlpha2(alpha2)}</text></svg>`
    )}`
  )
}

export function hasFlagImageAsset(alpha2: string): boolean {
  return flagSvgUrlByCode.has(alpha2.toUpperCase())
}

export function flagHasColorNear(alpha2: string, selectedColor: string): boolean {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  if (!metadata) return false

  const selected = rgb(selectedColor)
  return metadata.colors.some((color) => {
    const candidate = rgb(color)
    const distance = Math.sqrt(
      (selected[0] - candidate[0]) ** 2 +
        (selected[1] - candidate[1]) ** 2 +
        (selected[2] - candidate[2]) ** 2
    )
    return distance <= 95
  })
}

function rgb(color: string): [number, number, number] {
  const value = color.slice(1)
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number
  ]
}
