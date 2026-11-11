import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = dirname(scriptDirectory)
const catalogPath = join(projectDirectory, 'src/renderer/src/data/quiz/countryCatalog.json')
const flagsDirectory = join(projectDirectory, 'node_modules/svg-country-flags/svg')
const outputPath = join(projectDirectory, 'src/renderer/src/data/quiz/flagMetadata.json')

const countryCatalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const namedColors = {
  black: '#000000',
  blue: '#0000FF',
  gold: '#FFD700',
  gray: '#808080',
  green: '#008000',
  maroon: '#800000',
  navy: '#000080',
  orange: '#FFA500',
  purple: '#800080',
  red: '#FF0000',
  white: '#FFFFFF',
  yellow: '#FFFF00'
}

function gcd(first, second) {
  let a = Math.abs(first)
  let b = Math.abs(second)
  while (b !== 0) [a, b] = [b, a % b]
  return a || 1
}

function ratioLabel(width, height) {
  let bestNumerator = Math.round(width)
  let bestDenominator = Math.round(height)
  let bestError = Infinity

  for (let denominator = 1; denominator <= 100; denominator += 1) {
    const numerator = Math.max(1, Math.round((width / height) * denominator))
    const error = Math.abs(width / height - numerator / denominator)
    if (error < bestError) {
      bestNumerator = numerator
      bestDenominator = denominator
      bestError = error
    }
  }

  const divisor = gcd(bestNumerator, bestDenominator)
  return `${bestNumerator / divisor}:${bestDenominator / divisor}`
}

function parseColors(svg) {
  const colors = [...svg.matchAll(/(?:fill|stroke|stop-color)=["']([^"']+)["']/gi)]
    .map((match) => match[1].trim().toLowerCase())
    .filter((color) => color !== 'none' && color !== 'transparent' && !color.startsWith('url('))
    .map((color) => namedColors[color] ?? color)
    .filter((color) => /^#[\da-f]{3,8}$/i.test(color))
    .map((color) => {
      const value = color.slice(1)
      if (value.length === 3) {
        return `#${[...value].map((digit) => `${digit}${digit}`).join('')}`.toUpperCase()
      }
      return `#${value.slice(0, 6)}`.toUpperCase()
    })

  return [...new Set(colors)]
}

const flags = []
for (const country of countryCatalog) {
  const svgPath = join(flagsDirectory, `${country.alpha2.toLowerCase()}.svg`)
  const svg = await readFile(svgPath, 'utf8')
  const viewBox = svg.match(/\bviewBox=["']\s*([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)\s*["']/i)

  if (!viewBox) {
    throw new Error(`Impossible de lire les proportions du drapeau ${country.alpha2}`)
  }

  const width = Number(viewBox[3])
  const height = Number(viewBox[4])
  const isPennant = country.alpha2 === 'NP'
  flags.push({
    alpha2: country.alpha2,
    width,
    height,
    ratio: width / height,
    ratioLabel: isPennant ? null : ratioLabel(width, height),
    shape: isPennant ? 'pennant' : 'rectangle',
    colors: parseColors(svg)
  })
}

await writeFile(outputPath, `${JSON.stringify(flags, null, 2)}\n`)
console.log(`Ratios préparés pour ${flags.length} drapeaux : ${outputPath}`)
