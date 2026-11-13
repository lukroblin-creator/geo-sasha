import { getFlagAspectRatio, getFlagImageSource } from '../data/quiz/flagAssets'

type FlagImageEntry = {
  image: HTMLImageElement
  loaded: boolean
  listeners: Set<() => void>
}

export type FlagEdgeImages = {
  left: string
  right: string
  top: string
  bottom: string
}

export type FlagImageLayer = {
  key: string
  href: string
  x: number
  y: number
  width: number
  height: number
}

const flagImages = new Map<string, FlagImageEntry>()
const edgeImages = new Map<string, FlagEdgeImages | null>()
const edgeImageListeners = new Map<string, Set<() => void>>()
const queuedEdgeImageCodes = new Set<string>()
const edgeImageQueue: string[] = []
let edgeImageWorkScheduled = false

type IdleDeadline = {
  didTimeout: boolean
  timeRemaining: () => number
}

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadline) => void,
    options?: { timeout: number }
  ) => number
}

function getFlagImageEntry(alpha2: string): FlagImageEntry | null {
  if (typeof Image === 'undefined') return null

  const code = alpha2.toUpperCase()
  const cached = flagImages.get(code)
  if (cached) return cached

  const image = new Image()
  const entry: FlagImageEntry = {
    image,
    loaded: false,
    listeners: new Set()
  }
  flagImages.set(code, entry)

  image.onload = () => {
    entry.loaded = true
    entry.listeners.forEach((listener) => listener())
    entry.listeners.clear()
  }
  image.onerror = () => entry.listeners.clear()
  image.src = getFlagImageSource(code)

  return entry
}

export function subscribeToFlagImage(alpha2: string, listener: () => void): () => void {
  const code = alpha2.toUpperCase()
  const entry = getFlagImageEntry(code)
  if (!entry) return () => {}

  if (!edgeImages.has(code)) {
    const listeners = edgeImageListeners.get(code) ?? new Set<() => void>()
    listeners.add(listener)
    edgeImageListeners.set(code, listeners)
  }

  if (!entry.loaded) entry.listeners.add(listener)
  else if (!edgeImages.has(code)) listener()

  return () => {
    entry.listeners.delete(listener)
    edgeImageListeners.get(code)?.delete(listener)
  }
}

type Color = [number, number, number, number]

function mostCommonColor(
  data: Uint8ClampedArray,
  firstPixel: number,
  pixelStride: number,
  pixelCount: number
): Color | null {
  const counts = new Map<number, { count: number; color: Color }>()

  for (let sample = 0; sample < pixelCount; sample += 1) {
    const index = firstPixel + sample * pixelStride
    const alpha = data[index + 3]
    if (alpha < 128) continue

    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const key = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3)
    const current = counts.get(key)
    if (current) {
      current.count += 1
      current.color[0] += red
      current.color[1] += green
      current.color[2] += blue
    } else {
      counts.set(key, { count: 1, color: [red, green, blue, 255] })
    }
  }

  let mostCommon: { count: number; color: Color } | null = null
  for (const value of counts.values()) {
    if (!mostCommon || value.count > mostCommon.count) mostCommon = value
  }
  if (!mostCommon) return null

  return [
    Math.round(mostCommon.color[0] / mostCommon.count),
    Math.round(mostCommon.color[1] / mostCommon.count),
    Math.round(mostCommon.color[2] / mostCommon.count),
    255
  ]
}

function createEdgeImages(alpha2: string, entry: FlagImageEntry): FlagEdgeImages | null {
  if (typeof document === 'undefined') return null

  const metadataRatio = getFlagAspectRatio(alpha2)?.ratio
  const imageRatio = entry.image.naturalWidth / entry.image.naturalHeight
  const flagRatio = metadataRatio && Number.isFinite(metadataRatio) ? metadataRatio : imageRatio
  if (!Number.isFinite(flagRatio) || flagRatio <= 0) return null

  const sampleWidth = 256
  const sampleHeight = Math.max(32, Math.round(sampleWidth / flagRatio))
  const canvas = document.createElement('canvas')
  canvas.width = sampleWidth
  canvas.height = sampleHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  try {
    context.drawImage(entry.image, 0, 0, sampleWidth, sampleHeight)
    const imageData = context.getImageData(0, 0, sampleWidth, sampleHeight)
    const data = imageData.data
    const edgeBandWidth = Math.max(2, Math.round(sampleWidth * 0.08))
    const edgeBandHeight = Math.max(2, Math.round(sampleHeight * 0.08))

    const createVerticalEdge = (side: 'left' | 'right'): string => {
      const edgeCanvas = document.createElement('canvas')
      edgeCanvas.width = 1
      edgeCanvas.height = sampleHeight
      const edgeContext = edgeCanvas.getContext('2d')
      if (!edgeContext) return ''
      const edgeData = edgeContext.createImageData(1, sampleHeight)

      for (let y = 0; y < sampleHeight; y += 1) {
        const start = side === 'left' ? 0 : sampleWidth - edgeBandWidth
        const end = side === 'left' ? edgeBandWidth : sampleWidth
        const rowStart = (y * sampleWidth + start) * 4
        const color = mostCommonColor(data, rowStart, 4, end - start) ??
          mostCommonColor(data, y * sampleWidth * 4, 4, sampleWidth) ?? [0, 0, 0, 0]
        edgeData.data.set(color, y * 4)
      }

      edgeContext.putImageData(edgeData, 0, 0)
      return edgeCanvas.toDataURL('image/png')
    }

    const createHorizontalEdge = (side: 'top' | 'bottom'): string => {
      const edgeCanvas = document.createElement('canvas')
      edgeCanvas.width = sampleWidth
      edgeCanvas.height = 1
      const edgeContext = edgeCanvas.getContext('2d')
      if (!edgeContext) return ''
      const edgeData = edgeContext.createImageData(sampleWidth, 1)

      for (let x = 0; x < sampleWidth; x += 1) {
        const start = side === 'top' ? 0 : sampleHeight - edgeBandHeight
        const end = side === 'top' ? edgeBandHeight : sampleHeight
        const columnStart = (start * sampleWidth + x) * 4
        const color = mostCommonColor(data, columnStart, sampleWidth * 4, end - start) ??
          mostCommonColor(data, x * 4, sampleWidth * 4, sampleHeight) ?? [0, 0, 0, 0]
        edgeData.data.set(color, x * 4)
      }

      edgeContext.putImageData(edgeData, 0, 0)
      return edgeCanvas.toDataURL('image/png')
    }

    const result: FlagEdgeImages = {
      left: createVerticalEdge('left'),
      right: createVerticalEdge('right'),
      top: createHorizontalEdge('top'),
      bottom: createHorizontalEdge('bottom')
    }

    if (!result.left || !result.right || !result.top || !result.bottom) return null
    return result
  } catch {
    // Keep the original local flag visible if a platform blocks canvas pixel reads.
    return null
  }
}

function processEdgeImageQueue(deadline: IdleDeadline): void {
  edgeImageWorkScheduled = false
  let processedCount = 0
  const maxImagesPerSlice = deadline.didTimeout ? 2 : 8

  while (
    edgeImageQueue.length > 0 &&
    processedCount < maxImagesPerSlice &&
    (deadline.didTimeout || deadline.timeRemaining() > 2)
  ) {
    const code = edgeImageQueue.shift()!
    queuedEdgeImageCodes.delete(code)
    const entry = flagImages.get(code)
    if (!entry?.loaded || edgeImages.has(code)) continue

    processedCount += 1
    edgeImages.set(code, createEdgeImages(code, entry))
    const listeners = edgeImageListeners.get(code)
    listeners?.forEach((listener) => listener())
    edgeImageListeners.delete(code)
  }

  scheduleEdgeImageWork()
}

function scheduleEdgeImageWork(): void {
  if (edgeImageWorkScheduled || edgeImageQueue.length === 0 || typeof window === 'undefined') return
  edgeImageWorkScheduled = true

  const idleWindow = window as IdleWindow
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(processEdgeImageQueue, { timeout: 250 })
  } else {
    window.requestAnimationFrame(() =>
      processEdgeImageQueue({ didTimeout: true, timeRemaining: () => 0 })
    )
  }
}

export function getFlagEdgeImages(alpha2: string): FlagEdgeImages | null {
  const code = alpha2.toUpperCase()
  if (edgeImages.has(code)) return edgeImages.get(code) ?? null

  const entry = getFlagImageEntry(code)
  if (!entry?.loaded) return null

  if (!queuedEdgeImageCodes.has(code)) {
    queuedEdgeImageCodes.add(code)
    edgeImageQueue.push(code)
    scheduleEdgeImageWork()
  }
  return null
}

export function getFlagImageLayers(
  alpha2: string,
  bounds: [number, number, number, number],
  edges: FlagEdgeImages | null
): FlagImageLayer[] {
  const [left, top, right, bottom] = bounds
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)
  const flagRatio = getFlagAspectRatio(alpha2)?.ratio ?? width / height
  const flagWidth = Math.min(width, height * flagRatio)
  const flagHeight = Math.min(height, width / flagRatio)
  const flagLeft = left + (width - flagWidth) / 2
  const flagTop = top + (height - flagHeight) / 2
  const source = getFlagImageSource(alpha2)

  if (!edges) {
    return [
      { key: 'flag', href: source, x: flagLeft, y: flagTop, width: flagWidth, height: flagHeight }
    ]
  }

  const layers: FlagImageLayer[] = [
    { key: 'flag', href: source, x: flagLeft, y: flagTop, width: flagWidth, height: flagHeight }
  ]

  if (flagLeft > left) {
    layers.push(
      {
        key: 'edge-left',
        href: edges.left,
        x: left,
        y: flagTop,
        width: flagLeft - left,
        height: flagHeight
      },
      {
        key: 'edge-right',
        href: edges.right,
        x: flagLeft + flagWidth,
        y: flagTop,
        width: right - flagLeft - flagWidth,
        height: flagHeight
      }
    )
  } else if (flagTop > top) {
    layers.push(
      {
        key: 'edge-top',
        href: edges.top,
        x: flagLeft,
        y: top,
        width: flagWidth,
        height: flagTop - top
      },
      {
        key: 'edge-bottom',
        href: edges.bottom,
        x: flagLeft,
        y: flagTop + flagHeight,
        width: flagWidth,
        height: bottom - flagTop - flagHeight
      }
    )
  }

  return layers
}
