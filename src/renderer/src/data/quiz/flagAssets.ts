import { flagEmojiFromAlpha2 } from './flagEmoji'

const rectangularSvgs = import.meta.glob<string>(
  '../../../../../node_modules/flag-icons/flags/4x3/*.svg',
  { eager: true, query: '?raw', import: 'default' }
)
const squareSvgs = import.meta.glob<string>(
  '../../../../../node_modules/flag-icons/flags/1x1/*.svg',
  { eager: true, query: '?raw', import: 'default' }
)

export type FlagShapeId = 'rectangle' | 'square' | 'pennant'

export type FlagShape = {
  id: FlagShapeId
  label: string
  exampleAlpha2: string
}

export const flagShapes: FlagShape[] = [
  { id: 'rectangle', label: 'Rectangulaire', exampleAlpha2: 'FR' },
  { id: 'square', label: 'Carré', exampleAlpha2: 'CH' },
  { id: 'pennant', label: 'À fanions', exampleAlpha2: 'NP' }
]

const squareFlagCodes = new Set(['CH', 'VA'])
const pennantFlagCodes = new Set(['NP'])
const namedFlagColors: Record<string, string> = {
  gold: '#FFD700',
  gray: '#808080',
  green: '#008000',
  purple: '#800080',
  red: '#FF0000'
}

function indexSvgs(svgs: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(svgs).flatMap(([path, svg]) => {
      const alpha2 = path.match(/\/([a-z]{2})\.svg$/i)?.[1]?.toUpperCase()
      return alpha2 ? [[alpha2, svg] as const] : []
    })
  )
}

const rectangularSvgByCode = indexSvgs(rectangularSvgs)
const squareSvgByCode = indexSvgs(squareSvgs)

export function getFlagShape(alpha2: string): FlagShapeId {
  const code = alpha2.toUpperCase()
  if (pennantFlagCodes.has(code)) return 'pennant'
  if (squareFlagCodes.has(code)) return 'square'
  return 'rectangle'
}

export function getFlagSvg(alpha2: string): string | null {
  const code = alpha2.toUpperCase()
  return (getFlagShape(code) === 'square'
    ? squareSvgByCode.get(code)
    : rectangularSvgByCode.get(code)) ?? null
}

export function getFlagImageSource(alpha2: string): string {
  const svg = getFlagSvg(alpha2)
  const content = svg ?? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><text y="2.5" font-size="2.5">${flagEmojiFromAlpha2(alpha2)}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
}

export function getFlagColors(alpha2: string): string[] {
  const svg = getFlagSvg(alpha2)
  if (!svg) return []

  const found = svg.matchAll(/(?:fill|stop-color)=["']([^"']+)["']/gi)
  const colors = [...found]
    .map((match) => match[1].toLowerCase())
    .filter((color) => color !== 'none' && !color.startsWith('url('))
    .map((color) => namedFlagColors[color] ?? color)
    .filter((color) => /^#[\da-f]{3,8}$/i.test(color))
    .map(normalizeHexColor)
  return [...new Set(colors)]
}

function normalizeHexColor(color: string): string {
  const value = color.slice(1)
  if (value.length === 3) {
    return `#${[...value].map((digit) => `${digit}${digit}`).join('')}`.toUpperCase()
  }
  return `#${value.slice(0, 6)}`.toUpperCase()
}

function rgb(color: string): [number, number, number] {
  const value = normalizeHexColor(color).slice(1)
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number
  ]
}

export function flagHasColorNear(alpha2: string, selectedColor: string): boolean {
  const selected = rgb(selectedColor)
  return getFlagColors(alpha2).some((color) => {
    const candidate = rgb(color)
    const distance = Math.sqrt(
      (selected[0] - candidate[0]) ** 2 +
      (selected[1] - candidate[1]) ** 2 +
      (selected[2] - candidate[2]) ** 2
    )
    return distance <= 95
  })
}
