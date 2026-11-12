import flagMetadata from './flagMetadata.json'
import { flagEmojiFromAlpha2 } from './flagEmoji'
import countryCatalog from './countryCatalog.json'

const flagSvgUrls = import.meta.glob<string>(
  '../../../../../node_modules/svg-country-flags/svg/*.svg',
  { eager: true, query: '?url', import: 'default' }
)
const flagOverrideSvgUrls = import.meta.glob<string>(
  './flag-overrides/*.svg',
  { eager: true, query: '?url', import: 'default' }
)

export type FlagShapeId = string

export type FlagShape = {
  id: FlagShapeId
  label: string
  exampleAlpha2: string
  ratio: number
  kind: 'rectangle' | 'pennant'
}

type FlagMetadata = {
  alpha2: string
  width: number
  height: number
  ratio: number
  ratioLabel: string | null
  shape: 'rectangle' | 'pennant'
  colors: string[]
}

const metadataByCode = new Map<string, FlagMetadata>(
  (flagMetadata as FlagMetadata[]).map((metadata) => [metadata.alpha2, metadata])
)
const quizCountryCodes = new Set(
  (countryCatalog as { alpha2: string }[]).map(({ alpha2 }) => alpha2)
)
const flagSvgUrlByCode = new Map<string, string>(
  [
    ...Object.entries(flagSvgUrls),
    ...Object.entries(flagOverrideSvgUrls)
  ].flatMap(([path, url]) => {
    const alpha2 = path.match(/\/([a-z]{2})\.svg$/i)?.[1]?.toUpperCase()
    return alpha2 ? [[alpha2, url] as const] : []
  })
)

const rectangularRatios = [...new Map(
  (flagMetadata as FlagMetadata[])
    .filter((metadata) =>
      quizCountryCodes.has(metadata.alpha2) &&
      metadata.shape === 'rectangle' &&
      metadata.ratioLabel
    )
    .map((metadata) => [metadata.ratioLabel!, metadata] as const)
).values()].sort((first, second) => first.ratio - second.ratio)

export const flagShapes: FlagShape[] = [
  ...rectangularRatios.map((metadata) => ({
    id: `ratio:${metadata.ratioLabel}`,
    label: metadata.ratioLabel === '1:1'
      ? 'Carré · 1:1'
      : `Rectangle · ${metadata.ratioLabel}`,
    exampleAlpha2: metadata.alpha2,
    ratio: metadata.ratio,
    kind: 'rectangle' as const
  })),
  {
    id: 'pennant',
    label: 'À fanions · Népal',
    exampleAlpha2: 'NP',
    ratio: metadataByCode.get('NP')?.ratio ?? 0.82,
    kind: 'pennant'
  }
]

export function getFlagShape(alpha2: string): FlagShapeId {
  const metadata = metadataByCode.get(alpha2.toUpperCase())
  if (!metadata) return 'ratio:3:2'
  return metadata.shape === 'pennant'
    ? 'pennant'
    : `ratio:${metadata.ratioLabel ?? '3:2'}`
}

export function getFlagImageSource(alpha2: string): string {
  return flagSvgUrlByCode.get(alpha2.toUpperCase()) ??
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><text y="2.5" font-size="2.5">${flagEmojiFromAlpha2(alpha2)}</text></svg>`
    )}`
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
