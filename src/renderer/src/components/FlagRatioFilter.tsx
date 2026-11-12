import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type {
  FlagAspectRatio,
  FlagOutlinePoint,
  FlagPolygonDrawing,
  FlagRatioRange
} from '../data/quiz/flagAssets'
import { registerUndoScope } from '../data/undo'
import { useLanguage } from '../data/i18n'

type Rectangle = {
  left: number
  top: number
  right: number
  bottom: number
}

type DragMode = 'draw' | 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
type ShapeMode = 'rectangle' | 'polygon'
type DragLayer = 'main' | 'margin'
type PolygonShape = { name: string; vertexCount: number }
type DrawingSnapshot = {
  shapeMode: ShapeMode
  rectangle: Rectangle | null
  marginRectangle: Rectangle | null
  measuredRatio: number | null
  snappedRatioLabel: string | null
  polygonPoints: FlagOutlinePoint[]
  polygonFinished: boolean
  ratioRange: FlagRatioRange | null
  polygon: FlagPolygonDrawing | null
  viewport: { scale: number; x: number; y: number }
}

type DragState = {
  pointerId: number
  layer: DragLayer
  mode: DragMode
  startX: number
  startY: number
  origin: Rectangle
  originInner: Rectangle | null
  originMargin: Rectangle | null
}

type FlagRatioFilterProps = {
  availableRatios: FlagAspectRatio[]
  availablePolygonShapes: PolygonShape[]
  selectedRatioRange: FlagRatioRange | null
  selectedPolygon: FlagPolygonDrawing | null
  onRatioRangeChange: (range: FlagRatioRange | null) => void
  onPolygonChange: (polygon: FlagPolygonDrawing | null) => void
  disabled: boolean
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

const POLYGON_CLOSE_SNAP_RADIUS = 24

function formatRatio(ratio: number): string {
  return `${ratio.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}:1`
}

function rectangleStyle(rectangle: Rectangle): React.CSSProperties {
  return {
    left: `${rectangle.left * 100}%`,
    top: `${rectangle.top * 100}%`,
    width: `${(rectangle.right - rectangle.left) * 100}%`,
    height: `${(rectangle.bottom - rectangle.top) * 100}%`
  }
}

function resizeAroundCenter(
  origin: Rectangle,
  mode: DragMode,
  dx: number,
  dy: number,
  minimumHalfWidth: number,
  minimumHalfHeight: number,
  maximumHalfWidth = Math.min(
    (origin.left + origin.right) / 2,
    1 - (origin.left + origin.right) / 2
  ),
  maximumHalfHeight = Math.min(
    (origin.top + origin.bottom) / 2,
    1 - (origin.top + origin.bottom) / 2
  )
): Rectangle {
  const centerX = (origin.left + origin.right) / 2
  const centerY = (origin.top + origin.bottom) / 2
  let halfWidth = (origin.right - origin.left) / 2
  let halfHeight = (origin.bottom - origin.top) / 2

  if (mode.includes('w')) halfWidth = centerX - (origin.left + dx)
  if (mode.includes('e')) halfWidth = origin.right + dx - centerX
  if (mode.includes('n')) halfHeight = centerY - (origin.top + dy)
  if (mode.includes('s')) halfHeight = origin.bottom + dy - centerY

  halfWidth = clamp(halfWidth, minimumHalfWidth, maximumHalfWidth)
  halfHeight = clamp(halfHeight, minimumHalfHeight, maximumHalfHeight)
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY - halfHeight,
    bottom: centerY + halfHeight
  }
}

export function FlagRatioFilter({
  availableRatios,
  availablePolygonShapes,
  selectedRatioRange,
  selectedPolygon,
  onRatioRangeChange,
  onPolygonChange,
  disabled
}: FlagRatioFilterProps): React.JSX.Element {
  const { t } = useLanguage()
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const undoHistoryRef = useRef<DrawingSnapshot[]>([])
  const undoHandlerRef = useRef<() => boolean>(() => false)
  const [shapeMode, setShapeMode] = useState<ShapeMode>('rectangle')
  const [rectangle, setRectangle] = useState<Rectangle | null>(null)
  const [marginRectangle, setMarginRectangle] = useState<Rectangle | null>(null)
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null)
  const [snappedRatioLabel, setSnappedRatioLabel] = useState<string | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<FlagOutlinePoint[]>([])
  const [polygonCursorPoint, setPolygonCursorPoint] = useState<FlagOutlinePoint | null>(null)
  const [polygonClosingTarget, setPolygonClosingTarget] = useState(false)
  const [polygonFinished, setPolygonFinished] = useState(false)
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 })

  const pushUndoSnapshot = (): void => {
    undoHistoryRef.current.push({
      shapeMode,
      rectangle,
      marginRectangle,
      measuredRatio,
      snappedRatioLabel,
      polygonPoints,
      polygonFinished,
      ratioRange: selectedRatioRange,
      polygon: selectedPolygon,
      viewport
    })
    if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift()
  }

  useEffect(() => {
    undoHandlerRef.current = () => {
      const previous = undoHistoryRef.current.pop()
      if (!previous) return false
      setShapeMode(previous.shapeMode)
      setRectangle(previous.rectangle)
      setMarginRectangle(previous.marginRectangle)
      setMeasuredRatio(previous.measuredRatio)
      setSnappedRatioLabel(previous.snappedRatioLabel)
      setPolygonPoints(previous.polygonPoints)
      setPolygonCursorPoint(null)
      setPolygonClosingTarget(false)
      setPolygonFinished(previous.polygonFinished)
      setViewport(previous.viewport)
      onRatioRangeChange(previous.ratioRange)
      onPolygonChange(previous.polygon)
      return true
    }
  }, [
    marginRectangle,
    measuredRatio,
    onPolygonChange,
    onRatioRangeChange,
    polygonFinished,
    polygonPoints,
    rectangle,
    selectedPolygon,
    selectedRatioRange,
    shapeMode,
    snappedRatioLabel,
    viewport
  ])

  useEffect(() => {
    const root = rootRef.current
    return root ? registerUndoScope(root, () => undoHandlerRef.current()) : undefined
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const handleWheel = (event: WheelEvent): void => {
      // React's delegated wheel listener may be passive, so handle this natively
      // to keep the quiz answer panel from scrolling while the drawing is panned.
      event.preventDefault()
      event.stopPropagation()
      const bounds = stage.getBoundingClientRect()

      if (event.metaKey || event.ctrlKey) {
        const cursorX = event.clientX - bounds.left
        const cursorY = event.clientY - bounds.top
        const zoomFactor = Math.exp(-event.deltaY * 0.002)
        setViewport((current) => {
          const scale = clamp(current.scale * zoomFactor, 0.75, 4)
          const canvasX = (cursorX - current.x) / current.scale
          const canvasY = (cursorY - current.y) / current.scale
          return {
            scale,
            x: cursorX - canvasX * scale,
            y: cursorY - canvasY * scale
          }
        })
        return
      }

      setViewport((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY
      }))
    }

    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => stage.removeEventListener('wheel', handleWheel)
  }, [])

  const createInitialMargin = (inner: Rectangle, bounds: DOMRect): Rectangle => {
    const width = inner.right - inner.left
    const height = inner.bottom - inner.top
    const paddingX = Math.min(
      width * 0.1,
      Math.max(2 / bounds.width, width * 0.02),
      inner.left,
      1 - inner.right
    )
    const paddingY = Math.min(
      height * 0.1,
      Math.max(2 / bounds.height, height * 0.02),
      inner.top,
      1 - inner.bottom
    )
    return {
      left: inner.left - paddingX,
      top: inner.top - paddingY,
      right: inner.right + paddingX,
      bottom: inner.bottom + paddingY
    }
  }

  const moveMarginWithRectangle = (
    currentMargin: Rectangle,
    previousInner: Rectangle,
    nextInner: Rectangle
  ): Rectangle => ({
    left: clamp(currentMargin.left + nextInner.left - previousInner.left, 0, nextInner.left),
    top: clamp(currentMargin.top + nextInner.top - previousInner.top, 0, nextInner.top),
    right: clamp(currentMargin.right + nextInner.right - previousInner.right, nextInner.right, 1),
    bottom: clamp(
      currentMargin.bottom + nextInner.bottom - previousInner.bottom,
      nextInner.bottom,
      1
    )
  })

  const updateRatioRange = (inner: Rectangle, margin: Rectangle): void => {
    const stage = stageRef.current
    if (!stage) return

    const bounds = stage.getBoundingClientRect()
    const width = (inner.right - inner.left) * bounds.width
    const height = (inner.bottom - inner.top) * bounds.height
    if (width < 1 || height < 1) return

    const leftMargin = Math.max(0, (inner.left - margin.left) * bounds.width)
    const rightMargin = Math.max(0, (margin.right - inner.right) * bounds.width)
    const topMargin = Math.max(0, (inner.top - margin.top) * bounds.height)
    const bottomMargin = Math.max(0, (margin.bottom - inner.bottom) * bounds.height)
    let minimum = Math.max(1, width - leftMargin) / (height + bottomMargin)
    let maximum = (width + rightMargin) / Math.max(1, height - topMargin)
    const nearest = availableRatios.reduce<FlagAspectRatio | null>((best, candidate) => {
      if (
        !best ||
        Math.abs(candidate.ratio - width / height) < Math.abs(best.ratio - width / height)
      ) {
        return candidate
      }
      return best
    }, null)
    const snapped =
      nearest && Math.abs(nearest.ratio - width / height) <= Math.max(0.02, nearest.ratio * 0.03)
    if (snapped && nearest) {
      minimum = Math.min(minimum, nearest.ratio)
      maximum = Math.max(maximum, nearest.ratio)
      setSnappedRatioLabel(nearest.label)
    } else {
      setSnappedRatioLabel(null)
    }

    setMeasuredRatio(width / height)
    onRatioRangeChange({ minimum, maximum })
  }

  const getPoint = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>
  ): FlagOutlinePoint => {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return [0, 0]
    return [
      clamp((event.clientX - bounds.left - viewport.x) / (bounds.width * viewport.scale), 0, 1),
      clamp((event.clientY - bounds.top - viewport.y) / (bounds.height * viewport.scale), 0, 1)
    ]
  }

  const resetViewport = (): void => {
    if (viewport.scale !== 1 || viewport.x !== 0 || viewport.y !== 0) pushUndoSnapshot()
    setViewport({ scale: 1, x: 0, y: 0 })
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (disabled || shapeMode !== 'rectangle' || event.button !== 0) return
    pushUndoSnapshot()
    const [x, y] = getPoint(event)
    const target = event.target as HTMLElement
    const marginHandle = target.closest<HTMLElement>('[data-margin-resize-handle]')
    const innerHandle = target.closest<HTMLElement>('[data-resize-handle]')
    const onMargin = Boolean(marginHandle) || target.closest('.flag-ratio-margin-box') !== null
    const layer: DragLayer = onMargin ? 'margin' : 'main'
    const handle = (marginHandle?.dataset.marginResizeHandle ??
      innerHandle?.dataset.resizeHandle) as DragMode | undefined
    const insideInner = target.closest('.flag-ratio-rectangle') !== null
    const mode: DragMode = handle ?? (layer === 'margin' || insideInner ? 'move' : 'draw')
    const pointRectangle = { left: x, top: y, right: x, bottom: y }
    const origin =
      layer === 'margin'
        ? (marginRectangle ?? rectangle ?? pointRectangle)
        : (rectangle ?? pointRectangle)

    dragRef.current = {
      pointerId: event.pointerId,
      layer,
      mode,
      startX: x,
      startY: y,
      origin,
      originInner: rectangle,
      originMargin: layer === 'main' ? marginRectangle : null
    }
    if (layer === 'main' && mode === 'draw') {
      setRectangle(pointRectangle)
      setMarginRectangle(pointRectangle)
      setMeasuredRatio(null)
      setSnappedRatioLabel(null)
      onRatioRangeChange(null)
      onPolygonChange(null)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const continueDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage || drag.pointerId !== event.pointerId) {
      if (shapeMode === 'polygon' && !polygonFinished) {
        const point = getPoint(event)
        const firstPoint = polygonPoints[0]
        const canClose = availablePolygonShapes.some(
          (shape) => shape.vertexCount === polygonPoints.length
        )
        const bounds = stage?.getBoundingClientRect()
        const distance =
          firstPoint && bounds
            ? Math.hypot(
                (point[0] - firstPoint[0]) * bounds.width * viewport.scale,
                (point[1] - firstPoint[1]) * bounds.height * viewport.scale
              )
            : Infinity
        setPolygonCursorPoint(point)
        setPolygonClosingTarget(canClose && distance <= POLYGON_CLOSE_SNAP_RADIUS)
      } else {
        setPolygonCursorPoint(null)
        setPolygonClosingTarget(false)
      }
      return
    }

    const [x, y] = getPoint(event)
    const dx = x - drag.startX
    const dy = y - drag.startY
    const bounds = stage.getBoundingClientRect()
    if (drag.layer === 'margin') {
      const originInner = drag.originInner
      if (!originInner) return
      if (drag.mode === 'move') {
        const shiftX = clamp(dx, -drag.origin.left, 1 - drag.origin.right)
        const shiftY = clamp(dy, -drag.origin.top, 1 - drag.origin.bottom)
        const nextMargin = {
          left: drag.origin.left + shiftX,
          right: drag.origin.right + shiftX,
          top: drag.origin.top + shiftY,
          bottom: drag.origin.bottom + shiftY
        }
        const nextInner = {
          left: originInner.left + shiftX,
          right: originInner.right + shiftX,
          top: originInner.top + shiftY,
          bottom: originInner.bottom + shiftY
        }
        setMarginRectangle(nextMargin)
        setRectangle(nextInner)
        updateRatioRange(nextInner, nextMargin)
        return
      }

      const centerX = (originInner.left + originInner.right) / 2
      const centerY = (originInner.top + originInner.bottom) / 2
      const maximumHalfWidth = Math.min(centerX, 1 - centerX)
      const maximumHalfHeight = Math.min(centerY, 1 - centerY)
      const innerHalfWidth = (originInner.right - originInner.left) / 2
      const innerHalfHeight = (originInner.bottom - originInner.top) / 2
      const minimumHalfWidth =
        innerHalfWidth + Math.min(2 / bounds.width, maximumHalfWidth - innerHalfWidth)
      const minimumHalfHeight =
        innerHalfHeight + Math.min(2 / bounds.height, maximumHalfHeight - innerHalfHeight)
      const nextMargin = resizeAroundCenter(
        drag.origin,
        drag.mode,
        dx,
        dy,
        minimumHalfWidth,
        minimumHalfHeight
      )
      setMarginRectangle(nextMargin)
      updateRatioRange(originInner, nextMargin)
      return
    }

    const next = { ...drag.origin }
    if (drag.mode === 'draw') {
      next.left = Math.min(drag.startX, x)
      next.right = Math.max(drag.startX, x)
      next.top = Math.min(drag.startY, y)
      next.bottom = Math.max(drag.startY, y)
    } else if (drag.mode === 'move') {
      const movementBounds = drag.originMargin ?? drag.origin
      const shiftX = clamp(dx, -movementBounds.left, 1 - movementBounds.right)
      const shiftY = clamp(dy, -movementBounds.top, 1 - movementBounds.bottom)
      next.left = drag.origin.left + shiftX
      next.right = drag.origin.right + shiftX
      next.top = drag.origin.top + shiftY
      next.bottom = drag.origin.bottom + shiftY
    } else {
      const centerX = (drag.origin.left + drag.origin.right) / 2
      const centerY = (drag.origin.top + drag.origin.bottom) / 2
      const outer = drag.originMargin ?? drag.origin
      const marginHalfWidth = Math.max(
        0,
        (outer.right - outer.left - (drag.origin.right - drag.origin.left)) / 2
      )
      const marginHalfHeight = Math.max(
        0,
        (outer.bottom - outer.top - (drag.origin.bottom - drag.origin.top)) / 2
      )
      const maximumHalfWidth = Math.max(0, Math.min(centerX, 1 - centerX) - marginHalfWidth)
      const maximumHalfHeight = Math.max(0, Math.min(centerY, 1 - centerY) - marginHalfHeight)
      const nextCentered = resizeAroundCenter(
        drag.origin,
        drag.mode,
        dx,
        dy,
        Math.min(4 / bounds.width, maximumHalfWidth),
        Math.min(4 / bounds.height, maximumHalfHeight),
        maximumHalfWidth,
        maximumHalfHeight
      )
      Object.assign(next, nextCentered)
    }

    const nextMargin =
      drag.mode === 'draw'
        ? createInitialMargin(next, bounds)
        : drag.originMargin
          ? moveMarginWithRectangle(drag.originMargin, drag.origin, next)
          : createInitialMargin(next, bounds)
    setRectangle(next)
    setMarginRectangle(nextMargin)
    updateRatioRange(next, nextMargin)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null

    const stage = stageRef.current
    if (!rectangle || !stage) return
    const bounds = stage.getBoundingClientRect()
    const width = (rectangle.right - rectangle.left) * bounds.width
    const height = (rectangle.bottom - rectangle.top) * bounds.height
    if (width < 8 || height < 8) {
      setRectangle(null)
      setMarginRectangle(null)
      setMeasuredRatio(null)
      setSnappedRatioLabel(null)
      onRatioRangeChange(null)
    }
  }

  const finishPolygon = (points = polygonPoints): void => {
    const stage = stageRef.current
    if (!stage || points.length < 3) return
    const bounds = stage.getBoundingClientRect()
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const left = Math.min(...xs)
    const right = Math.max(...xs)
    const top = Math.min(...ys)
    const bottom = Math.max(...ys)
    const width = right - left
    const height = bottom - top
    if (width * bounds.width < 8 || height * bounds.height < 8) return

    pushUndoSnapshot()
    const normalizedPoints = points.map(([x, y]) => [
      (x - left) / width,
      (y - top) / height
    ]) as FlagOutlinePoint[]
    setPolygonFinished(true)
    setPolygonCursorPoint(null)
    setPolygonClosingTarget(false)
    onPolygonChange({
      points: normalizedPoints,
      ratio: (width * bounds.width) / (height * bounds.height)
    })
  }

  const addPolygonPoint = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (disabled || shapeMode !== 'polygon' || polygonFinished) return
    const point = getPoint(event)
    const firstPoint = polygonPoints[0]
    const bounds = stageRef.current?.getBoundingClientRect()
    if (polygonPoints.length >= 3 && firstPoint && bounds) {
      const distance = Math.hypot(
        (point[0] - firstPoint[0]) * bounds.width * viewport.scale,
        (point[1] - firstPoint[1]) * bounds.height * viewport.scale
      )
      if (canClosePolygon && distance <= POLYGON_CLOSE_SNAP_RADIUS) {
        finishPolygon()
        return
      }
    }
    pushUndoSnapshot()
    setPolygonPoints((current) => [...current, point])
    setPolygonCursorPoint(null)
    setPolygonClosingTarget(false)
  }

  const switchMode = (nextMode: ShapeMode): void => {
    if (disabled || nextMode === shapeMode) return
    pushUndoSnapshot()
    setShapeMode(nextMode)
    setRectangle(null)
    setMarginRectangle(null)
    setMeasuredRatio(null)
    setSnappedRatioLabel(null)
    setPolygonPoints([])
    setPolygonCursorPoint(null)
    setPolygonClosingTarget(false)
    setPolygonFinished(false)
    onRatioRangeChange(null)
    onPolygonChange(null)
  }

  const clear = (): void => {
    pushUndoSnapshot()
    setRectangle(null)
    setMarginRectangle(null)
    setMeasuredRatio(null)
    setSnappedRatioLabel(null)
    setPolygonPoints([])
    setPolygonCursorPoint(null)
    setPolygonClosingTarget(false)
    setPolygonFinished(false)
    onRatioRangeChange(null)
    onPolygonChange(null)
  }

  const minRatio = availableRatios[0]?.ratio ?? 0.5
  const maxRatio = availableRatios.at(-1)?.ratio ?? 2
  const ratioSpan = Math.max(maxRatio - minRatio, 0.01)
  const readoutSide = rectangle
    ? rectangle.right <= 0.76
      ? 'right'
      : rectangle.left >= 0.24
        ? 'left'
        : 'inside'
    : 'right'
  const expectedVertexLabel = [
    ...new Map(
      availablePolygonShapes.map((shape) => [
        shape.name,
        `${shape.name} : ${shape.vertexCount} sommets`
      ])
    ).values()
  ].join(' · ')
  const canClosePolygon = availablePolygonShapes.some(
    (shape) => shape.vertexCount === polygonPoints.length
  )
  const nextPolygonVertexCount = availablePolygonShapes
    .map((shape) => shape.vertexCount)
    .filter((vertexCount) => vertexCount > polygonPoints.length)
    .sort((a, b) => a - b)[0]
  const firstPoint = polygonPoints[0]
  const previewPoints =
    polygonCursorPoint && !polygonFinished
      ? [...polygonPoints, polygonClosingTarget && firstPoint ? firstPoint : polygonCursorPoint]
      : polygonPoints
  const displayedPoints = previewPoints.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')

  return (
    <section
      ref={rootRef}
      className="country-flag-ratio-filter"
      aria-label={t('Filtrer par forme du drapeau')}
    >
      <div className="country-flag-ratio-heading">
        <span>{t('Forme')}</span>
        <svg className="country-flag-ratio-icon" viewBox="0 0 36 28" aria-hidden="true">
          <rect x="4" y="5" width="23" height="17" rx="2" />
          <path d="M24 15l8 8-4 .3 1.3 3-2 .8-1.3-3-2.4 2.8z" />
          <path d="M8 9h15M8 13h10" />
        </svg>
        {(rectangle || polygonPoints.length > 0) && (
          <button
            type="button"
            className="country-flag-ratio-clear"
            onClick={clear}
            disabled={disabled}
          >
            {t('Effacer')}
          </button>
        )}
      </div>
      {availablePolygonShapes.length > 0 && (
        <div
          className="country-flag-shape-modes"
          role="group"
          aria-label={t('Type de forme à dessiner')}
        >
          <button
            type="button"
            className={shapeMode === 'rectangle' ? 'active' : ''}
            aria-pressed={shapeMode === 'rectangle'}
            onClick={() => switchMode('rectangle')}
            disabled={disabled}
          >
            {t('Rectangle')}
          </button>
          <button
            type="button"
            className={shapeMode === 'polygon' ? 'active' : ''}
            aria-pressed={shapeMode === 'polygon'}
            onClick={() => switchMode('polygon')}
            disabled={disabled}
          >
            {t('Polygone')}
          </button>
        </div>
      )}
      <div className="country-flag-shape-instruction-row">
        <p className="country-flag-ratio-instruction">
          {shapeMode === 'rectangle'
            ? t('Dessine la forme du drapeau')
            : t('Clique pour placer chaque sommet')}
        </p>
        {shapeMode === 'polygon' && polygonPoints.length >= 3 && !polygonFinished && (
          <button
            type="button"
            className="country-flag-polygon-finish"
            onClick={() => finishPolygon()}
            disabled={disabled || !canClosePolygon}
          >
            {t('Fermer le polygone')}
          </button>
        )}
      </div>
      {shapeMode === 'polygon' && (
        <p className="country-flag-polygon-hint">
          {polygonFinished
            ? `${polygonPoints.length} ${t(polygonPoints.length === 1 ? 'sommet' : 'sommets')} · ${expectedVertexLabel}`
            : canClosePolygon
              ? `${polygonPoints.length} ${t('sommets')} · ${t('Clique près du premier point pour fermer.')}`
              : nextPolygonVertexCount
                ? `${polygonPoints.length} ${t(polygonPoints.length === 1 ? 'sommet' : 'sommets')} · ${t('Ajoute encore')} ${nextPolygonVertexCount - polygonPoints.length} ${t(nextPolygonVertexCount - polygonPoints.length === 1 ? 'sommet' : 'sommets')} ${t('avant de fermer.')}`
                : `${polygonPoints.length} ${t('sommets')} · ${t('Le nombre de sommets ne correspond pas aux formes disponibles. Efface le tracé pour recommencer.')}`}
        </p>
      )}
      <div className="flag-drawing-toolbar">
        <div className="flag-drawing-instructions" aria-label={t('Gestes de navigation')}>
          <span>{t('2 doigts sur le pavé tactile pour déplacer')}</span>
          <span>{t('⌘ + défilement pour zoomer')}</span>
        </div>
        <div className="flag-drawing-controls">
          <span className="flag-drawing-zoom-level">{Math.round(viewport.scale * 100)} %</span>
          <button
            type="button"
            className="flag-drawing-reset"
            onClick={resetViewport}
            title={t('Recentrer la zone de dessin')}
            aria-label={t('Recentrer la zone de dessin')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 6a5.5 5.5 0 1 1-.7 4" />
              <path d="M3.5 2.5v3.8h3.8" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={stageRef}
        className={`country-flag-ratio-stage${rectangle || polygonPoints.length > 0 ? ' has-rectangle' : ''}${shapeMode === 'polygon' ? ' polygon-mode' : ''}`}
        onPointerDown={startDrag}
        onPointerMove={continueDrag}
        onPointerLeave={() => {
          setPolygonCursorPoint(null)
          setPolygonClosingTarget(false)
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={addPolygonPoint}
        role="img"
        aria-label={
          shapeMode === 'rectangle'
            ? rectangle
              ? `${t('Forme dessinée, ratio')} ${measuredRatio ? formatRatio(measuredRatio) : t('en cours')}`
              : t('Zone de dessin vide')
            : `${t('Tracé polygonal')} · ${polygonPoints.length} ${t('sommets')}`
        }
      >
        <div
          className="flag-drawing-plane"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
          }}
        >
          {shapeMode === 'rectangle' && rectangle && marginRectangle && (
            <div className="flag-ratio-margin-box" style={rectangleStyle(marginRectangle)}>
              {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((handle) => (
                <span
                  key={handle}
                  className={`flag-ratio-margin-handle ${handle}`}
                  data-margin-resize-handle={handle}
                />
              ))}
            </div>
          )}
          {shapeMode === 'rectangle' && rectangle && (
            <div className="flag-ratio-rectangle" style={rectangleStyle(rectangle)}>
              {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((handle) => (
                <span
                  key={handle}
                  className={`flag-ratio-handle ${handle}`}
                  data-resize-handle={handle}
                />
              ))}
            </div>
          )}
          {shapeMode === 'polygon' && polygonPoints.length > 0 && (
            <>
              <svg
                className="flag-polygon-layer"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {polygonFinished ? (
                  <polygon className="flag-polygon-finished" points={displayedPoints} />
                ) : (
                  <polyline className="flag-polygon-preview" points={displayedPoints} />
                )}
              </svg>
              {polygonPoints.map(([x, y], index) => (
                <span
                  key={`${x}-${y}-${index}`}
                  className={`flag-polygon-vertex${index === 0 && polygonClosingTarget ? ' closing-target' : ''}`}
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                />
              ))}
              {polygonFinished && selectedPolygon && (
                <div className="flag-polygon-readout" aria-live="polite">
                  {t('Polygone fermé')} · {polygonPoints.length} {t('sommets')}
                </div>
              )}
            </>
          )}
          {shapeMode === 'rectangle' && measuredRatio !== null && rectangle !== null && (
            <div
              className="flag-ratio-readout"
              aria-live="polite"
              style={{
                left: `${
                  (readoutSide === 'right'
                    ? rectangle.right
                    : readoutSide === 'left'
                      ? rectangle.left
                      : (rectangle.left + rectangle.right) / 2) * 100
                }%`,
                top: `${((rectangle.top + rectangle.bottom) / 2) * 100}%`,
                transform:
                  readoutSide === 'right'
                    ? 'translate(6px, -50%)'
                    : readoutSide === 'left'
                      ? 'translate(calc(-100% - 6px), -50%)'
                      : 'translate(-50%, -50%)'
              }}
            >
              <strong>{formatRatio(measuredRatio)}</strong>
              {selectedRatioRange && (
                <span>
                  {formatRatio(selectedRatioRange.minimum)} –{' '}
                  {formatRatio(selectedRatioRange.maximum)}
                </span>
              )}
              {snappedRatioLabel && <span>{t('cran')} {snappedRatioLabel}</span>}
            </div>
          )}
        </div>
      </div>
      {shapeMode === 'rectangle' ? (
        <>
          <div className="flag-ratio-scale" aria-label={t('Ratios présents dans les drapeaux proposés')}>
            <div className="flag-ratio-scale-line" />
            {availableRatios.map((item) => {
              const position = ((item.ratio - minRatio) / ratioSpan) * 100
              const active =
                selectedRatioRange !== null &&
                item.ratio >= selectedRatioRange.minimum &&
                item.ratio <= selectedRatioRange.maximum
              return (
                <span
                  key={`${item.ratio}-${item.label}`}
                  className={`flag-ratio-tick${active ? ' active' : ''}`}
                  style={{ left: `${position}%` }}
                  title={`${t('Drapeau au ratio')} ${item.label}`}
                  aria-hidden="true"
                />
              )
            })}
          </div>
          <p className="flag-ratio-scale-caption">
            {selectedRatioRange
              ? `${t('Plage')} : ${formatRatio(selectedRatioRange.minimum)} ${t('à')} ${formatRatio(selectedRatioRange.maximum)}`
              : `${availableRatios.length} ${t('ratios disponibles · aimantation légère')}`}
          </p>
        </>
      ) : (
        <p className="flag-ratio-scale-caption">
          {t('Le contour filtre quand il est fermé, avec le bon nombre de sommets et une forme proche.')}
        </p>
      )}
    </section>
  )
}
