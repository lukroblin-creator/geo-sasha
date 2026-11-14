import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = dirname(scriptDirectory)
const flagsDirectory = join(projectDirectory, 'node_modules/svg-country-flags/svg')
const flagOverridesDirectory = join(projectDirectory, 'src/renderer/src/data/quiz/flag-overrides')
const outputPath = join(projectDirectory, 'src/renderer/src/data/quiz/flagMetadata.json')

const flagFilesByCode = new Map(
  (await readdir(flagsDirectory))
    .filter((filename) => /^[a-z]{2}\.svg$/i.test(filename))
    .map((filename) => [filename.slice(0, 2).toUpperCase(), join(flagsDirectory, filename)])
)

for (const filename of await readdir(flagOverridesDirectory)) {
  if (/^[a-z]{2}\.svg$/i.test(filename)) {
    flagFilesByCode.set(
      filename.slice(0, 2).toUpperCase(),
      join(flagOverridesDirectory, filename)
    )
  }
}

const flagFiles = [...flagFilesByCode.entries()]
  .sort(([firstCode], [secondCode]) => firstCode.localeCompare(secondCode))
const nonRectangularOutlines = {
  NP: [
    [0, 0],
    [1, 0.46967],
    [0, 0.46967],
    [1, 1],
    [0, 1]
  ]
}

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
  const colors = [...svg.matchAll(/(?:fill|stroke|stop-color)\s*(?:=|:)\s*["']?([^;"'}\s]+)["']?/gi)]
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

function parseAttributes(source) {
  return Object.fromEntries(
    [...source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [
      match[1].toLowerCase(),
      match[2]
    ])
  )
}

function normalizeColor(color) {
  if (!color) return null
  const normalized = color.trim().toLowerCase()
  if (normalized === 'none' || normalized === 'transparent' || normalized.startsWith('url(')) {
    return null
  }
  if (namedColors[normalized]) return namedColors[normalized].toUpperCase()
  if (!/^#[\da-f]{3,8}$/i.test(normalized)) return null
  const value = normalized.slice(1)
  if (value.length === 3) {
    return `#${[...value].map((digit) => `${digit}${digit}`).join('')}`.toUpperCase()
  }
  return `#${value.slice(0, 6)}`.toUpperCase()
}

function attributesWithStyle(element) {
  const attributes = parseAttributes(element)
  const styles = Object.fromEntries(
    (attributes.style ?? '')
      .split(';')
      .map((declaration) => declaration.split(':').map((part) => part.trim()))
      .filter(([property, value]) => property && value)
      .map(([property, value]) => [property.toLowerCase(), value])
  )
  return { ...styles, ...attributes }
}

const identityTransform = [1, 0, 0, 1, 0, 0]

function multiplyTransforms(first, second) {
  const [a1, b1, c1, d1, e1, f1] = first
  const [a2, b2, c2, d2, e2, f2] = second
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ]
}

function parseTransform(transform, parentTransform) {
  if (parentTransform === null) return null
  if (!transform) return parentTransform ?? identityTransform

  let localTransform = [...identityTransform]
  const transformParts = [...transform.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)]
  if (transformParts.length === 0) return null

  for (const [, operation, argumentText] of transformParts) {
    const values = argumentText.split(/[\s,]+/).filter(Boolean).map(Number)
    let nextTransform
    if (operation === 'translate') {
      nextTransform = [1, 0, 0, 1, values[0] ?? 0, values[1] ?? 0]
    } else if (operation === 'scale') {
      nextTransform = [values[0] ?? 1, 0, 0, values[1] ?? values[0] ?? 1, 0, 0]
    } else if (operation === 'matrix' && values.length === 6) {
      nextTransform = values
    } else {
      return null
    }
    if (nextTransform.some((value) => !Number.isFinite(value))) return null
    localTransform = multiplyTransforms(localTransform, nextTransform)
  }

  const combined = multiplyTransforms(parentTransform ?? identityTransform, localTransform)
  return combined[1] === 0 && combined[2] === 0 ? combined : null
}

function transformRectangle(rect, transform) {
  if (!transform) return null
  const [scaleX, , , scaleY, translateX, translateY] = transform
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height]
  ].map(([x, y]) => [scaleX * x + translateX, scaleY * y + translateY])
  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
}

function parseAxisAlignedPath(data) {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []
  const subpaths = []
  let currentSubpath = []
  let currentPoint = [0, 0]
  let startPoint = null
  let command = null
  let index = 0
  let supported = true

  const isCommand = (token) => /^[a-z]$/i.test(token)
  const readNumber = () => Number(tokens[index++])
  const finishSubpath = (closed) => {
    if (currentSubpath.length > 1) {
      subpaths.push({ points: currentSubpath, closed })
    }
    currentSubpath = []
    startPoint = null
  }

  while (index < tokens.length && supported) {
    if (isCommand(tokens[index])) {
      command = tokens[index++]
      if (command === 'Z' || command === 'z') {
        if (startPoint) currentPoint = startPoint
        finishSubpath(true)
        command = null
        continue
      }
      if (!'MmLlHhVv'.includes(command)) {
        supported = false
        break
      }
    }
    if (!command) {
      supported = false
      break
    }

    const relative = command === command.toLowerCase()
    if (command === 'M' || command === 'm' || command === 'L' || command === 'l') {
      if (index + 1 >= tokens.length || isCommand(tokens[index]) || isCommand(tokens[index + 1])) {
        supported = false
        break
      }
      const x = readNumber()
      const y = readNumber()
      currentPoint = relative
        ? [currentPoint[0] + x, currentPoint[1] + y]
        : [x, y]
      if (command === 'M' || command === 'm') {
        if (currentSubpath.length > 0) finishSubpath(false)
        startPoint = currentPoint
        command = relative ? 'l' : 'L'
      }
      currentSubpath.push(currentPoint)
    } else if (command === 'H' || command === 'h') {
      if (index >= tokens.length || isCommand(tokens[index])) {
        supported = false
        break
      }
      const x = readNumber()
      currentPoint = [relative ? currentPoint[0] + x : x, currentPoint[1]]
      currentSubpath.push(currentPoint)
    } else if (command === 'V' || command === 'v') {
      if (index >= tokens.length || isCommand(tokens[index])) {
        supported = false
        break
      }
      const y = readNumber()
      currentPoint = [currentPoint[0], relative ? currentPoint[1] + y : y]
      currentSubpath.push(currentPoint)
    }
  }

  if (!supported) return null
  finishSubpath(false)
  return subpaths
}

function rectangleFromPath(subpath) {
  if (!subpath.closed) return null
  const points = subpath.points
  const unique = points.filter(
    (point, index) => !points.slice(0, index).some(([x, y]) => x === point[0] && y === point[1])
  )
  if (unique.length !== 4) return null
  const xs = [...new Set(unique.map(([x]) => x))].sort((a, b) => a - b)
  const ys = [...new Set(unique.map(([, y]) => y))].sort((a, b) => a - b)
  if (xs.length !== 2 || ys.length !== 2) return null
  if (!unique.every(([x, y]) => xs.includes(x) && ys.includes(y))) return null
  return { x: xs[0], y: ys[0], width: xs[1] - xs[0], height: ys[1] - ys[0] }
}

function getBandGeometry(svg, width, height) {
  const shapes = []
  const groupStack = []
  const elements = /<\/g\s*>|<(g|rect|path)\b[^>]*>/gi
  for (const match of svg.matchAll(elements)) {
    const element = match[0]
    if (/^<\/g/i.test(element)) {
      groupStack.pop()
      continue
    }
    const tag = match[1].toLowerCase()
    const attributes = attributesWithStyle(element)
    const parent = groupStack.at(-1)
    const fill = normalizeColor(attributes.fill ?? parent?.fill ?? '#000000')
    const stroke = normalizeColor(attributes.stroke ?? parent?.stroke)
    const transform = parseTransform(
      attributes.transform,
      parent ? parent.transform : identityTransform
    )

    if (tag === 'g') {
      if (!/\/>$/.test(element)) {
        groupStack.push({
          fill,
          stroke,
          strokeWidth: Number.parseFloat(attributes['stroke-width'] ?? parent?.strokeWidth ?? '1'),
          transform
        })
      }
      continue
    }
    if (!transform) continue

    if (tag === 'rect' && fill) {
      const rect = transformRectangle({
        x: Number.parseFloat(attributes.x ?? '0'),
        y: Number.parseFloat(attributes.y ?? '0'),
        width: Number.parseFloat(attributes.width ?? '0'),
        height: Number.parseFloat(attributes.height ?? '0')
      }, transform)
      if (rect && rect.width > 0 && rect.height > 0) shapes.push({ ...rect, color: fill })
    }

    if (tag === 'path') {
      const subpaths = parseAxisAlignedPath(attributes.d ?? '')
      if (!subpaths) continue
      if (fill) {
        for (const subpath of subpaths) {
          const pathRectangle = rectangleFromPath(subpath)
          const rect = pathRectangle ? transformRectangle(pathRectangle, transform) : null
          if (rect && rect.width > 0 && rect.height > 0) shapes.push({ ...rect, color: fill })
        }
      }
      const strokeWidth = Number.parseFloat(attributes['stroke-width'] ?? parent?.strokeWidth ?? '1')
      const strokeColor = stroke ?? parent?.stroke
      if (strokeColor && strokeWidth > 0) {
        const [scaleX, , , scaleY, translateX, translateY] = transform
        for (const subpath of subpaths) {
          for (let pointIndex = 1; pointIndex < subpath.points.length; pointIndex += 1) {
            const first = subpath.points[pointIndex - 1].map((value, coordinate) =>
              coordinate === 0 ? scaleX * value + translateX : scaleY * value + translateY
            )
            const second = subpath.points[pointIndex].map((value, coordinate) =>
              coordinate === 0 ? scaleX * value + translateX : scaleY * value + translateY
            )
            if (first[1] === second[1] && Math.abs(second[0] - first[0]) >= width * 0.55) {
              const transformedStrokeWidth = strokeWidth * Math.abs(scaleY)
              shapes.push({
                x: Math.min(first[0], second[0]),
                y: first[1] - transformedStrokeWidth / 2,
                width: Math.abs(second[0] - first[0]),
                height: transformedStrokeWidth,
                color: strokeColor
              })
            } else if (
              first[0] === second[0] &&
              Math.abs(second[1] - first[1]) >= height * 0.55
            ) {
              const transformedStrokeWidth = strokeWidth * Math.abs(scaleX)
              shapes.push({
                x: first[0] - transformedStrokeWidth / 2,
                y: Math.min(first[1], second[1]),
                width: transformedStrokeWidth,
                height: Math.abs(second[1] - first[1]),
                color: strokeColor
              })
            }
          }
        }
      }
    }
  }
  return shapes
}

function countColorBands(shapes, viewWidth, viewHeight, orientation) {
  const sampleFractions = [0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.88]
  const sampleCount = 120
  const lineBandCounts = sampleFractions.map((fixed) => {
    let previousColor = null
    let bands = 0
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const progress = (sample + 0.5) / sampleCount
      const x = orientation === 'horizontal' ? fixed * viewWidth : progress * viewWidth
      const y = orientation === 'horizontal' ? progress * viewHeight : fixed * viewHeight
      let color = null
      for (const shape of shapes) {
        if (
          x >= shape.x &&
          x < shape.x + shape.width &&
          y >= shape.y &&
          y < shape.y + shape.height
        ) {
          color = shape.color
        }
      }
      if (color !== previousColor) {
        if (color !== null) bands += 1
        previousColor = color
      }
    }
    return Math.max(1, bands)
  })

  const frequencies = new Map()
  for (const count of lineBandCounts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1)
  const [mostFrequent, frequency] = [...frequencies.entries()].sort(
    (first, second) => second[1] - first[1] || first[0] - second[0]
  )[0]
  return mostFrequent > 1 && frequency < sampleFractions.length * 0.6 ? 1 : mostFrequent
}

function getBandCounts(svg, width, height, alpha2) {
  // Nepal's pennants are not rectangular, so give its two stacked colored fields an explicit profile.
  if (alpha2 === 'NP') return { horizontalBands: 2, verticalBands: 1, obliqueBands: 2 }
  // These flags use repeated SVG symbols or partial-width stripes that are not represented as full bands.
  const knownProfiles = {
    GR: { horizontalBands: 9, verticalBands: 1, obliqueBands: 1 },
    MY: { horizontalBands: 14, verticalBands: 1, obliqueBands: 1 },
    UY: { horizontalBands: 9, verticalBands: 1, obliqueBands: 1 }
  }
  if (knownProfiles[alpha2]) return knownProfiles[alpha2]
  const shapes = getBandGeometry(svg, width, height)
  // Curated diagonal layouts: use the number of broad color regions crossed across the diagonal.
  const obliqueBandProfiles = {
    AS: 3, AU: 3, BA: 3, BI: 3, BS: 3, BT: 2, CD: 3, CG: 3, CZ: 3,
    DJ: 3, EH: 4, GB: 3, GY: 5, HM: 3, JE: 2, JO: 4, KM: 5, KN: 5,
    MQ: 3, NZ: 3, PG: 2, PS: 4, SH: 3, TZ: 5, VU: 5, ZA: 6, ZW: 4
  }
  return {
    horizontalBands: countColorBands(shapes, width, height, 'horizontal'),
    verticalBands: countColorBands(shapes, width, height, 'vertical'),
    obliqueBands: obliqueBandProfiles[alpha2] ?? 1
  }
}

const flags = []
for (const [alpha2, svgPath] of flagFiles) {
  const svg = await readFile(svgPath, 'utf8')
  const viewBox = svg.match(/\bviewBox=["']\s*([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)\s*["']/i)

  if (!viewBox) {
    throw new Error(`Impossible de lire les proportions du drapeau ${alpha2}`)
  }

  const width = Number(viewBox[3])
  const height = Number(viewBox[4])
  const outline = nonRectangularOutlines[alpha2]
  const isPolygon = Boolean(outline)
  const bandCounts = getBandCounts(svg, width, height, alpha2)
  flags.push({
    alpha2,
    width,
    height,
    ratio: width / height,
    ratioLabel: isPolygon ? null : ratioLabel(width, height),
    shape: isPolygon ? 'polygon' : 'rectangle',
    ...(outline ? { outline } : {}),
    ...bandCounts,
    colors: parseColors(svg)
  })
}

await writeFile(outputPath, `${JSON.stringify(flags, null, 2)}\n`)
console.log(`Métadonnées des drapeaux préparées pour ${flags.length} drapeaux : ${outputPath}`)
