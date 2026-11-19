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

export const flagNamedColorOptions = [
  {
    id: 'red',
    label: 'Rouge',
    swatch: '#e53935',
    hueRanges: [
      [345, 360],
      [0, 15]
    ]
  },
  { id: 'orange', label: 'Orange', swatch: '#f28c28', hueRanges: [[15, 45]] },
  { id: 'yellow', label: 'Jaune', swatch: '#e6c229', hueRanges: [[42, 70]] },
  { id: 'green', label: 'Vert', swatch: '#45a85a', hueRanges: [[55, 165]] },
  { id: 'blue', label: 'Bleu', swatch: '#3478c8', hueRanges: [[170, 255]] },
  { id: 'purple', label: 'Violet', swatch: '#8c58b8', hueRanges: [[250, 300]] },
  { id: 'pink', label: 'Rose', swatch: '#dc72aa', hueRanges: [[300, 345]] },
  {
    id: 'brown',
    label: 'Marron',
    swatch: '#805735',
    hueRanges: [[15, 50]],
    maximumLightness: 0.55
  },
  { id: 'white', label: 'Blanc', swatch: '#ffffff', lightnessRange: [0.78, 1] },
  { id: 'gray', label: 'Gris', swatch: '#858b91', lightnessRange: [0.22, 0.78] },
  { id: 'black', label: 'Noir', swatch: '#202327', lightnessRange: [0, 0.22] }
] as const

export type FlagNamedColorFilterId = (typeof flagNamedColorOptions)[number]['id']

export type FlagColorFilter =
  { kind: 'wheel'; color: string } | { kind: 'named'; id: FlagNamedColorFilterId }

type FlagMetadata = {
  alpha2: string
  ratio: number
  ratioLabel: string | null
  shape: 'rectangle' | 'polygon'
  horizontalBands?: number
  verticalBands?: number
  obliqueBands?: number
  outline?: FlagOutlinePoint[]
  colors: string[]
}

export type FlagBandCounts = {
  horizontal: number
  vertical: number
  oblique: number
}

const metadataByCode = new Map<string, FlagMetadata>(
  (flagMetadata as FlagMetadata[]).map((metadata) => [metadata.alpha2, metadata])
)
const flagNamedColorById = new Map(
  flagNamedColorOptions.map((option) => [option.id, option] as const)
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

export function getFlagBandCounts(alpha2: string): FlagBandCounts {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  return {
    horizontal: metadata?.horizontalBands ?? 1,
    vertical: metadata?.verticalBands ?? 1,
    oblique: metadata?.obliqueBands ?? 1
  }
}

export function flagOutlineMatches(alpha2: string, drawing: FlagPolygonDrawing): boolean {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  const reference = getFlagOutline(alpha2)
  if (!metadata || !reference || drawing.points.length !== reference.length) return false

  // Compare the contour independently from the drawn size and aspect ratio so a rough sketch can match.
  const drawnSamples = sampleClosedOutline(drawing.points)
  const referenceSamples = sampleClosedOutline(reference)
  const outlineDistance =
    (meanDistanceToOutline(drawnSamples, reference) +
      meanDistanceToOutline(referenceSamples, drawing.points)) /
    2
  return outlineDistance <= 0.28
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

/* Every active color filter is required; additional flag colors remain allowed. */
export function flagHasAllColorFilters(alpha2: string, filters: FlagColorFilter[]): boolean {
  if (filters.length === 0) return true

  const metadata = metadataByCode.get(alpha2.toUpperCase())
  if (!metadata) return false

  return filters.every((filter) =>
    metadata.colors.some((flagColor) => flagColorMatchesFilter(flagColor, filter))
  )
}

function flagColorMatchesFilter(flagColor: string, filter: FlagColorFilter): boolean {
  if (filter.kind === 'wheel') return flagColorsMatchNear(flagColor, filter.color)

  const option = flagNamedColorById.get(filter.id)
  if (!option) return false

  return flagMatchesNamedColorOption(flagColor, option)
}

function flagMatchesNamedColorOption(
  flagColor: string,
  option: (typeof flagNamedColorOptions)[number]
): boolean {
  const [hue, saturation, lightness] = hsl(flagColor)
  if ('lightnessRange' in option) {
    const [minimum, maximum] = option.lightnessRange
    return saturation <= 0.14 && lightness >= minimum && lightness <= maximum
  }

  if (saturation < 0.12 || !('hueRanges' in option)) return false
  if ('maximumLightness' in option && lightness > option.maximumLightness) return false
  const hueRanges = option.hueRanges as readonly (readonly [number, number])[]
  return hueRanges.some(([minimum, maximum]) => hue >= minimum && hue <= maximum)
}

function flagColorsMatchNear(flagColor: string, selectedColor: string): boolean {
  const selected = hsl(selectedColor)
  const candidate = hsl(flagColor)
  const selectedIsNeutral = selected[1] < 0.12
  const candidateIsNeutral = candidate[1] < 0.12

  if (selectedIsNeutral || candidateIsNeutral) {
    return (
      selectedIsNeutral &&
      candidateIsNeutral &&
      Math.abs(selected[1] - candidate[1]) <= 0.1 &&
      Math.abs(selected[2] - candidate[2]) <= 0.2
    )
  }

  const hueDistance = Math.abs(selected[0] - candidate[0])
  const sameColorFamily = flagNamedColorOptions.some(
    (option) =>
      'hueRanges' in option &&
      flagMatchesNamedColorOption(flagColor, option) &&
      flagMatchesNamedColorOption(selectedColor, option)
  )
  return sameColorFamily || Math.min(hueDistance, 360 - hueDistance) <= 18
}

function hsl(color: string): [number, number, number] {
  const value = color.slice(1)
  const [red, green, blue] = [0, 2, 4].map(
    (offset) => parseInt(value.slice(offset, offset + 2), 16) / 255
  ) as [number, number, number]
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const lightness = (maximum + minimum) / 2
  const difference = maximum - minimum

  if (difference === 0) return [0, 0, lightness]

  const saturation = difference / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (maximum === red) {
    hue = ((green - blue) / difference) % 6
  } else if (maximum === green) {
    hue = (blue - red) / difference + 2
  } else {
    hue = (red - green) / difference + 4
  }

  hue = (hue * 60 + 360) % 360
  return [hue, saturation, lightness]
}
