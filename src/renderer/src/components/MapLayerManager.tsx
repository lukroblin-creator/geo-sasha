import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { createPortal } from 'react-dom'
import pointOnFeature from '@turf/point-on-feature'
import countryCatalog from '../data/quiz/countryCatalog.json'
import {
  getContinentIdForCountry,
  getQuizRegionFocusBounds,
  quizRegions,
  type ContinentId
} from '../data/quiz/countryContinents'
import { world110mMap } from '../data/world'
import { useLanguage } from '../data/i18n'
import type {
  MapLayerStackId,
  MapOpacityMask,
  MapOpacityMaskDraft,
  ManagedMapLayerId
} from '../data/geography/mapLayerManager'

export type MapLayerManagerItem = {
  id: ManagedMapLayerId
  label: string
  description?: string
  enabled: boolean
  opacity: number
  density?: number
  maximum?: number
  fixedCount?: number
  variants?: Array<{ id: string; label: string }>
  activeVariant?: string
}

type MapLayerManagerProps = {
  layers: MapLayerManagerItem[]
  masks: MapOpacityMask[]
  order: MapLayerStackId[]
  isPlacingMask: boolean
  editingMaskId: string | null
  onToggleLayer: (id: ManagedMapLayerId, enabled: boolean) => void
  onLayerOpacityChange: (id: ManagedMapLayerId, opacity: number) => void
  onLayerDensityChange: (id: ManagedMapLayerId, density: number) => void
  onSelectLayerVariant: (id: ManagedMapLayerId, variantId: string) => void
  onOrderChange: (order: MapLayerStackId[]) => void
  onCreateMask: (draft: MapOpacityMaskDraft) => void
  onAddMask: (draft: MapOpacityMaskDraft) => void
  onCancelMaskPlacement: () => void
  onEditMask: (id: string | null) => void
  onUpdateMask: (id: string, patch: Partial<MapOpacityMask>) => void
  onDeleteMask: (id: string) => void
}

type LayerStackRow =
  | { id: ManagedMapLayerId; kind: 'layer'; layer: MapLayerManagerItem }
  | { id: `mask:${string}`; kind: 'mask'; mask: MapOpacityMask }

function getRegionDisplayName(alpha2: string, fallback: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(alpha2) ?? fallback
  } catch {
    return fallback
  }
}

export function MapLayerManager({
  layers,
  masks,
  order,
  isPlacingMask,
  editingMaskId,
  onToggleLayer,
  onLayerOpacityChange,
  onLayerDensityChange,
  onSelectLayerVariant,
  onOrderChange,
  onCreateMask,
  onAddMask,
  onCancelMaskPlacement,
  onEditMask,
  onUpdateMask,
  onDeleteMask
}: MapLayerManagerProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [maskKind, setMaskKind] = useState<'circle' | 'rectangle' | 'country' | 'continent'>(
    'circle'
  )
  const [countrySourceFeatureIds, setCountrySourceFeatureIds] = useState<number[]>([])
  const [selectedContinentIds, setSelectedContinentIds] = useState<ContinentId[]>([])
  const [maskSelectionSearch, setMaskSelectionSearch] = useState('')
  const [expandedLayerGroups, setExpandedLayerGroups] = useState<Set<ManagedMapLayerId>>(
    () => new Set(['texture'])
  )
  // This is the target layer's remaining opacity inside the mask: 0% punches
  // a full hole, while 100% leaves the layer unchanged.
  const [maskOpacity, setMaskOpacity] = useState(0)
  const [radiusKm, setRadiusKm] = useState(500)
  const [widthKm, setWidthKm] = useState(1000)
  const [heightKm, setHeightKm] = useState(700)
  const [draggedRowId, setDraggedRowId] = useState<MapLayerStackId | null>(null)
  const activePointerDragRef = useRef<{
    id: MapLayerStackId
    pointerId: number
    startX: number
    startY: number
    started: boolean
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: ManagedMapLayerId | '__top__'
    zone: 'layer' | 'mask'
    after: boolean
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLElement | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number } | null>(null)
  const isOpen = open && !isPlacingMask
  const closePopover = useCallback((): void => {
    setOpen(false)
    setPopoverPosition(null)
  }, [])

  const rows = useMemo<LayerStackRow[]>(() => {
    const byId = new Map<string, LayerStackRow>()
    for (const layer of layers) byId.set(layer.id, { id: layer.id, kind: 'layer', layer })
    for (const mask of masks) {
      const id = `mask:${mask.id}` as const
      byId.set(id, { id, kind: 'mask', mask })
    }
    const ordered = order.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
    const included = new Set(ordered.map((row) => row.id))
    const unordered = [...byId.values()].filter((row) => !included.has(row.id))
    return [...ordered, ...unordered]
  }, [layers, masks, order])
  const orderedLayerRows = rows.filter(
    (row): row is Extract<LayerStackRow, { kind: 'layer' }> => row.kind === 'layer'
  )
  const maskRows = rows.filter(
    (row): row is Extract<LayerStackRow, { kind: 'mask' }> => row.kind === 'mask'
  )
  const attachedMasksByLayer = useMemo(() => {
    const grouped = new Map<ManagedMapLayerId, MapOpacityMask[]>()
    for (const mask of masks) {
      const targetLayerId = mask.targetLayerId === undefined ? 'texture' : mask.targetLayerId
      if (targetLayerId === null) continue
      const attached = grouped.get(targetLayerId) ?? []
      attached.push(mask)
      grouped.set(targetLayerId, attached)
    }
    return grouped
  }, [masks])
  const unassignedMasks = maskRows
    .filter((row) => row.mask.targetLayerId === null)
    .map((row) => row.mask)
  const draggedMask = draggedRowId?.startsWith('mask:')
    ? (masks.find((mask) => `mask:${mask.id}` === draggedRowId) ?? null)
    : null

  const continentOptions = quizRegions.filter((region) => region.id !== 'world')
  const normalizedMaskSearch = maskSelectionSearch
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase(language)
  const filteredMaskCountries = countryCatalog.filter((country) =>
    getRegionDisplayName(country.alpha2, country.countryName, language)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase(language)
      .includes(normalizedMaskSearch)
  )
  const filteredMaskContinents = continentOptions.filter((region) => {
    if (!normalizedMaskSearch) return true
    const labelMatches = t(region.label)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase(language)
      .includes(normalizedMaskSearch)
    if (labelMatches) return true
    return countryCatalog.some((country) => {
      if (getContinentIdForCountry(country.alpha2) !== region.id) return false
      return getRegionDisplayName(country.alpha2, country.countryName, language)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase(language)
        .includes(normalizedMaskSearch)
    })
  })

  const getMaskTargetLayer = (mask: MapOpacityMask): ManagedMapLayerId | null =>
    mask.targetLayerId === undefined ? 'texture' : mask.targetLayerId

  const countryMaskName = (sourceFeatureIds: Array<string | number>): string => {
    const names = sourceFeatureIds.flatMap((sourceFeatureId) => {
      const country = countryCatalog.find(
        (item) => String(item.sourceFeatureId) === String(sourceFeatureId)
      )
      return country ? [getRegionDisplayName(country.alpha2, country.countryName, language)] : []
    })
    if (names.length === 0) return t('Masque de territoires')
    return names.length <= 2
      ? `${t('Territoires')}: ${names.join(', ')}`
      : `${t('Territoires')} (${names.length})`
  }

  const continentMaskName = (ids: ContinentId[]): string => {
    const names = ids.flatMap((id) => {
      const region = continentOptions.find((item) => item.id === id)
      return region ? [t(region.label)] : []
    })
    if (names.length === 0) return t('Masque de continents')
    return names.length <= 2
      ? `${t('Continents')}: ${names.join(', ')}`
      : `${t('Continents')} (${names.length})`
  }

  const getMaskShapeCenter = (mask: MapOpacityMask): [number, number] => {
    if (mask.center) return mask.center
    if (mask.kind === 'continent') {
      const continent = (mask.continents ?? (mask.continent ? [mask.continent] : []))[0]
      if (continent) {
        const bounds = getQuizRegionFocusBounds(continent)
        if (bounds) return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
      }
    }
    const selectedCountryIds =
      mask.kind === 'country'
        ? (mask.sourceFeatureIds ??
          (mask.sourceFeatureId !== undefined ? [mask.sourceFeatureId] : []))
        : []
    const selectedId = selectedCountryIds[0]
    if (selectedId !== undefined) {
      const feature = world110mMap.features.find(
        (item) => String(item.properties?.sourceId) === String(selectedId)
      )
      if (feature) {
        const point = pointOnFeature(feature)
        return [point.geometry.coordinates[0], point.geometry.coordinates[1]]
      }
    }
    return [0, 0]
  }

  const changeMaskKind = (mask: MapOpacityMask, kind: MapOpacityMask['kind']): void => {
    if (mask.kind === kind) return
    const existingCountryIds =
      mask.sourceFeatureIds ?? (mask.sourceFeatureId !== undefined ? [mask.sourceFeatureId] : [])
    const existingContinentIds = mask.continents ?? (mask.continent ? [mask.continent] : [])
    if (kind === 'circle') {
      onUpdateMask(mask.id, {
        kind,
        name: t('Cercle'),
        center: getMaskShapeCenter(mask),
        radiusKm: mask.radiusKm ?? 500
      })
      return
    }
    if (kind === 'rectangle') {
      onUpdateMask(mask.id, {
        kind,
        name: t('Rectangle'),
        center: getMaskShapeCenter(mask),
        widthKm: mask.widthKm ?? 1000,
        heightKm: mask.heightKm ?? 700
      })
      return
    }
    if (kind === 'country') {
      const sourceFeatureIds =
        existingCountryIds.length > 0
          ? existingCountryIds
          : countryCatalog
              .filter((country) => {
                const continent = getContinentIdForCountry(country.alpha2)
                return continent !== undefined && existingContinentIds.includes(continent)
              })
              .map((country) => country.sourceFeatureId)
      onUpdateMask(mask.id, {
        kind,
        name: countryMaskName(sourceFeatureIds),
        sourceFeatureId: undefined,
        sourceFeatureIds
      })
      return
    }
    const continents =
      existingContinentIds.length > 0
        ? existingContinentIds
        : existingCountryIds
            .flatMap((sourceFeatureId) => {
              const country = countryCatalog.find(
                (item) => String(item.sourceFeatureId) === String(sourceFeatureId)
              )
              const continent = country ? getContinentIdForCountry(country.alpha2) : undefined
              return continent ? [continent] : []
            })
            .filter((continent, index, all) => all.indexOf(continent) === index)
    onUpdateMask(mask.id, {
      kind,
      name: continentMaskName(continents),
      continent: undefined,
      continents
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return

    let frame = 0
    const updatePosition = (): void => {
      const trigger = triggerRef.current
      const popover = popoverRef.current
      if (!trigger || !popover) return

      const anchor = trigger.getBoundingClientRect()
      const bounds = popover.getBoundingClientRect()
      const width = Math.min(bounds.width || 470, window.innerWidth - 32)
      const height = Math.min(bounds.height || 460, window.innerHeight - 32)
      const left = Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16))
      let top = anchor.top - height - 10
      if (top < 16) top = Math.min(anchor.bottom + 10, window.innerHeight - height - 16)
      setPopoverPosition((current) =>
        current?.left === left && current.top === top ? current : { left, top }
      )
    }

    frame = window.requestAnimationFrame(updatePosition)
    const observer = popoverRef.current ? new ResizeObserver(updatePosition) : null
    if (popoverRef.current) observer?.observe(popoverRef.current)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, rows.length, masks.length])

  useLayoutEffect(() => {
    if (!isOpen) return
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target))
        closePopover()
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePopover()
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closePopover, isOpen])

  const beginPointerDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: MapLayerStackId
  ): void => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    activePointerDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const getDropTargetAt = (
      x: number,
      y: number,
      sourceId: MapLayerStackId
    ): { id: ManagedMapLayerId | '__top__'; zone: 'layer' | 'mask'; after: boolean } | null => {
      const hovered = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-layer-drop-target], [data-layer-drop-zone="top"]')
      if (!hovered) return null
      if (hovered.dataset.layerDropZone === 'top')
        return { id: '__top__', zone: 'layer', after: false }
      const targetId = hovered.dataset.layerDropTarget as ManagedMapLayerId | undefined
      if (!targetId) return null
      const bounds = hovered.getBoundingClientRect()
      const isMask = sourceId.startsWith('mask:')
      const zone = isMask && x >= bounds.left + bounds.width / 2 ? 'mask' : 'layer'
      return { id: targetId, zone, after: !isMask && y >= bounds.top + bounds.height / 2 }
    }
    const moveLayer = (
      sourceId: ManagedMapLayerId,
      targetId: ManagedMapLayerId | null,
      after: boolean
    ): void => {
      if (sourceId === targetId) return
      const remaining = order.filter(
        (id): id is ManagedMapLayerId => !id.startsWith('mask:') && id !== sourceId
      )
      if (!order.includes(sourceId)) return
      if (targetId === null) {
        onOrderChange([sourceId, ...remaining])
        return
      }
      const targetIndex = remaining.indexOf(targetId)
      if (targetIndex < 0) return
      remaining.splice(targetIndex + (after ? 1 : 0), 0, sourceId)
      onOrderChange(remaining)
    }
    const finishPointerDrag = (pointerId: number, x: number, y: number): void => {
      const drag = activePointerDragRef.current
      if (!drag || drag.pointerId !== pointerId) return
      const target = drag.started ? getDropTargetAt(x, y, drag.id) : null
      if (drag.started && target) {
        if (drag.id.startsWith('mask:')) {
          const maskId = drag.id.slice(5)
          onUpdateMask(maskId, {
            targetLayerId: target.zone === 'mask' ? (target.id as ManagedMapLayerId) : null
          })
        } else if (target.id === '__top__') {
          moveLayer(drag.id as ManagedMapLayerId, null, false)
        } else {
          moveLayer(drag.id as ManagedMapLayerId, target.id, target.after)
        }
      }
      activePointerDragRef.current = null
      setDraggedRowId(null)
      setDropTarget(null)
    }
    const updatePointerDrag = (event: PointerEvent): void => {
      const drag = activePointerDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (!drag.started && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5)
        return
      drag.started = true
      setDraggedRowId((current) => (current === drag.id ? current : drag.id))
      const target = getDropTargetAt(event.clientX, event.clientY, drag.id)
      setDropTarget((current) => {
        if (
          current?.id === target?.id &&
          current?.zone === target?.zone &&
          current?.after === target?.after
        )
          return current
        return target
      })
      event.preventDefault()
    }
    const endPointerDrag = (event: PointerEvent): void => {
      finishPointerDrag(event.pointerId, event.clientX, event.clientY)
    }
    const cancelPointerDrag = (event: PointerEvent): void => {
      if (activePointerDragRef.current?.pointerId !== event.pointerId) return
      activePointerDragRef.current = null
      setDraggedRowId(null)
      setDropTarget(null)
    }
    window.addEventListener('pointermove', updatePointerDrag, { passive: false })
    window.addEventListener('pointerup', endPointerDrag)
    window.addEventListener('pointercancel', cancelPointerDrag)
    return () => {
      window.removeEventListener('pointermove', updatePointerDrag)
      window.removeEventListener('pointerup', endPointerDrag)
      window.removeEventListener('pointercancel', cancelPointerDrag)
    }
  }, [isOpen, order, onOrderChange, onUpdateMask])

  const renderLayerCard = (layer: MapLayerManagerItem): React.JSX.Element => {
    const label = t(layer.label)
    const expanded = expandedLayerGroups.has(layer.id)
    const layerExpandable = Boolean(layer.variants || layer.maximum !== undefined)
    const rowDetail =
      layer.fixedCount !== undefined
        ? `${layer.fixedCount} ${t('chaînes')}`
        : layer.maximum !== undefined
          ? `${layer.enabled ? (layer.density ?? 0) : 0} / ${layer.maximum}`
          : null
    return (
      <div className={`map-layer-manager-row${draggedRowId === layer.id ? ' is-dragging' : ''}`}>
        <button
          className="map-layer-manager-drag-handle"
          type="button"
          aria-label={`${t('Déplacer le calque')} — ${label}`}
          title={t('Glisser pour changer l’ordre')}
          onPointerDown={(event) => beginPointerDrag(event, layer.id)}
        >
          ⠿
        </button>
        <label className="map-layer-manager-visibility-target">
          <input
            className="map-layer-manager-visibility"
            type="checkbox"
            checked={layer.enabled}
            aria-label={`${t('Afficher le calque')} — ${label}`}
            onChange={(event) => onToggleLayer(layer.id, event.target.checked)}
          />
        </label>
        <div className="map-layer-manager-row-content">
          <div className="map-layer-manager-row-title">
            <strong>{label}</strong>
            {layerExpandable && (
              <button
                type="button"
                className="map-layer-manager-group-toggle"
                aria-expanded={expanded}
                aria-label={`${t(expanded ? 'Replier le groupe' : 'Déplier le groupe')} — ${label}`}
                onClick={() =>
                  setExpandedLayerGroups((current) => {
                    const next = new Set(current)
                    if (next.has(layer.id)) next.delete(layer.id)
                    else next.add(layer.id)
                    return next
                  })
                }
              >
                {expanded ? '⌃' : '⌄'}
              </button>
            )}
            {rowDetail && <small className="map-layer-manager-count">{rowDetail}</small>}
          </div>
          {layer.description && (
            <small className="map-layer-manager-row-description">{t(layer.description)}</small>
          )}
          <div className="map-layer-manager-row-opacity">
            <input
              type="range"
              min={0}
              max={100}
              value={layer.opacity}
              aria-label={`${t('Opacité')} — ${label}`}
              onChange={(event) => onLayerOpacityChange(layer.id, Number(event.target.value))}
            />
            <span>{layer.opacity}%</span>
          </div>
          {layerExpandable && expanded && (
            <div className="map-layer-manager-layer-options">
              {layer.variants && (
                <div
                  className="map-layer-manager-layer-variants"
                  role="radiogroup"
                  aria-label={`${t('Sous-calques')} — ${label}`}
                >
                  {layer.variants.map((variant) => (
                    <label
                      key={variant.id}
                      className={layer.activeVariant === variant.id ? 'is-active' : ''}
                    >
                      <input
                        type="radio"
                        name={`managed-layer-${layer.id}`}
                        value={variant.id}
                        checked={layer.activeVariant === variant.id}
                        onChange={() => onSelectLayerVariant(layer.id, variant.id)}
                      />
                      <span>{t(variant.label)}</span>
                    </label>
                  ))}
                </div>
              )}
              {layer.maximum !== undefined && layer.density !== undefined && (
                <div className="map-layer-manager-density">
                  <label>
                    <span>{t('Éléments affichés')}</span>
                    <strong>
                      {layer.enabled ? layer.density : 0} / {layer.maximum}
                    </strong>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, layer.maximum)}
                    step={1}
                    value={layer.enabled ? layer.density : 0}
                    aria-label={`${label} — ${t('Éléments affichés')}`}
                    onChange={(event) => onLayerDensityChange(layer.id, Number(event.target.value))}
                  />
                  <div className="map-layer-manager-density-ends">
                    <span>{t('Aucun')}</span>
                    <span>{t('Tout')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderMaskCard = (mask: MapOpacityMask): React.JSX.Element => {
    const label = mask.name
    const maskEnabled = mask.enabled !== false
    const hint =
      mask.kind === 'circle'
        ? `${t('Cercle')} · ${mask.radiusKm ?? 0} km`
        : mask.kind === 'rectangle'
          ? `${t('Rectangle')} · ${mask.widthKm ?? 0} × ${mask.heightKm ?? 0} km`
          : mask.kind === 'continent'
            ? t('Masque de continents')
            : t('Masque de territoires')
    const targetLayerId = mask.targetLayerId === undefined ? 'texture' : mask.targetLayerId
    return (
      <div
        className={`map-layer-manager-row is-mask${maskEnabled ? '' : ' is-disabled'}${draggedRowId === `mask:${mask.id}` ? ' is-dragging' : ''}`}
        key={mask.id}
      >
        <button
          className="map-layer-manager-drag-handle"
          type="button"
          aria-label={`${t('Déplacer le masque')} — ${label}`}
          title={t(
            'Glisser à droite d’un calque pour lui appliquer le masque ; à gauche pour le détacher'
          )}
          onPointerDown={(event) => beginPointerDrag(event, `mask:${mask.id}`)}
        >
          ⠿
        </button>
        <div className="map-layer-manager-row-content">
          <div className="map-layer-manager-row-title">
            <strong>{label}</strong>
            <select
              className="map-layer-manager-mask-kind"
              value={mask.kind}
              aria-label={`${t('Type de masque')} — ${label}`}
              title={t('Type de masque')}
              onChange={(event) =>
                changeMaskKind(mask, event.currentTarget.value as MapOpacityMask['kind'])
              }
            >
              <option value="circle">{t('Cercle')}</option>
              <option value="rectangle">{t('Rectangle')}</option>
              <option value="country">{t('Territoires')}</option>
              <option value="continent">{t('Continents')}</option>
            </select>
            <label className="map-layer-manager-mask-enabled">
              <input
                type="checkbox"
                role="switch"
                checked={maskEnabled}
                aria-label={`${t(maskEnabled ? 'Désactiver le masque' : 'Activer le masque')} — ${label}`}
                onChange={(event) =>
                  onUpdateMask(mask.id, { enabled: event.currentTarget.checked })
                }
              />
              <span className="map-layer-manager-mask-switch-track" aria-hidden="true" />
              <span className="map-layer-manager-mask-switch-label">
                {t(maskEnabled ? 'Activé' : 'Désactivé')}
              </span>
            </label>
            <small>{hint}</small>
          </div>
          <div className="map-layer-manager-row-opacity">
            <input
              type="range"
              min={0}
              max={100}
              value={mask.opacity}
              aria-label={`${t('Opacité du calque dans la zone')} — ${label}`}
              onChange={(event) => onUpdateMask(mask.id, { opacity: Number(event.target.value) })}
            />
            <span>{mask.opacity}%</span>
          </div>
          <label className="map-layer-manager-mask-target">
            <span>{t('Calque visé')}</span>
            <select
              value={targetLayerId ?? ''}
              aria-label={`${t('Calque visé')} — ${label}`}
              onChange={(event) =>
                onUpdateMask(mask.id, {
                  targetLayerId: event.currentTarget.value
                    ? (event.currentTarget.value as ManagedMapLayerId)
                    : null
                })
              }
            >
              <option value="">{t('Non assigné · au-dessus de la pile')}</option>
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {t(layer.label)}
                </option>
              ))}
            </select>
          </label>
          <details className="map-layer-manager-mask-editor">
            <summary>{t('Modifier le masque')}</summary>
            {mask.kind === 'circle' && (
              <label>
                <span>
                  {t('Rayon')} · {mask.radiusKm ?? 500} km
                </span>
                <input
                  type="range"
                  min={50}
                  max={6000}
                  step={50}
                  value={mask.radiusKm ?? 500}
                  onChange={(event) =>
                    onUpdateMask(mask.id, { radiusKm: Number(event.target.value) })
                  }
                />
              </label>
            )}
            {mask.kind === 'rectangle' && (
              <div className="map-layer-manager-mask-dimensions">
                <label>
                  <span>
                    {t('Largeur')} · {mask.widthKm ?? 1000} km
                  </span>
                  <input
                    type="range"
                    min={100}
                    max={12000}
                    step={100}
                    value={mask.widthKm ?? 1000}
                    onChange={(event) =>
                      onUpdateMask(mask.id, { widthKm: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>
                    {t('Hauteur')} · {mask.heightKm ?? 700} km
                  </span>
                  <input
                    type="range"
                    min={100}
                    max={12000}
                    step={100}
                    value={mask.heightKm ?? 700}
                    onChange={(event) =>
                      onUpdateMask(mask.id, { heightKm: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            )}
            {mask.kind === 'country' && (
              <label>
                <span>{t('Territoires à utiliser')}</span>
                <select
                  className="map-layer-manager-multi-select"
                  multiple
                  size={6}
                  value={(
                    mask.sourceFeatureIds ??
                    (mask.sourceFeatureId !== undefined ? [mask.sourceFeatureId] : [])
                  ).map(String)}
                  onChange={(event) => {
                    const ids = Array.from(event.currentTarget.selectedOptions).map((option) =>
                      Number(option.value)
                    )
                    onUpdateMask(mask.id, {
                      sourceFeatureId: undefined,
                      sourceFeatureIds: ids,
                      name: countryMaskName(ids)
                    })
                  }}
                >
                  {countryCatalog.map((country) => (
                    <option key={country.alpha2} value={country.sourceFeatureId}>
                      {getRegionDisplayName(country.alpha2, country.countryName, language)}
                    </option>
                  ))}
                </select>
                <small className="map-layer-manager-selection-hint">
                  {t('Maintiens ⌘ ou Ctrl et clique pour sélectionner plusieurs éléments.')}
                </small>
              </label>
            )}
            {mask.kind === 'continent' && (
              <label>
                <span>{t('Continents à utiliser')}</span>
                <select
                  className="map-layer-manager-multi-select"
                  multiple
                  size={Math.min(6, Math.max(3, continentOptions.length))}
                  value={(mask.continents ?? (mask.continent ? [mask.continent] : [])).map(String)}
                  onChange={(event) => {
                    const ids = Array.from(event.currentTarget.selectedOptions).map(
                      (option) => option.value as ContinentId
                    )
                    onUpdateMask(mask.id, {
                      continent: undefined,
                      continents: ids,
                      name: continentMaskName(ids)
                    })
                  }}
                >
                  {continentOptions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {t(region.label)}
                    </option>
                  ))}
                </select>
                <small className="map-layer-manager-selection-hint">
                  {t('Maintiens ⌘ ou Ctrl et clique pour sélectionner plusieurs éléments.')}
                </small>
              </label>
            )}
            {(mask.kind === 'circle' || mask.kind === 'rectangle') && (
              <button
                type="button"
                className="map-layer-manager-reposition-mask"
                onClick={() => onEditMask(editingMaskId === mask.id ? null : mask.id)}
              >
                {editingMaskId === mask.id
                  ? t('Masquer les poignées')
                  : t('Afficher les poignées sur la carte')}
              </button>
            )}
          </details>
        </div>
        <button
          className="map-layer-manager-remove"
          type="button"
          aria-label={`${t('Supprimer le masque')} — ${label}`}
          title={t('Supprimer le masque')}
          onClick={() => onDeleteMask(mask.id)}
        >
          ×
        </button>
      </div>
    )
  }

  const buildMaskDraft = (): MapOpacityMaskDraft | null => {
    const targetLayerId: ManagedMapLayerId | null = null
    if (maskKind === 'circle') {
      return {
        kind: 'circle',
        name: t('Cercle'),
        opacity: maskOpacity,
        enabled: true,
        radiusKm,
        targetLayerId
      }
    } else if (maskKind === 'rectangle') {
      return {
        kind: 'rectangle',
        name: t('Rectangle'),
        opacity: maskOpacity,
        enabled: true,
        widthKm,
        heightKm,
        targetLayerId
      }
    } else if (maskKind === 'country') {
      return {
        kind: 'country',
        name: countryMaskName(countrySourceFeatureIds),
        opacity: maskOpacity,
        enabled: true,
        targetLayerId,
        sourceFeatureIds: countrySourceFeatureIds
      }
    } else if (maskKind === 'continent') {
      return {
        kind: 'continent',
        name: continentMaskName(selectedContinentIds),
        opacity: maskOpacity,
        enabled: true,
        targetLayerId,
        continents: selectedContinentIds
      }
    }
    return null
  }

  const addMaskFromList = (): void => {
    const draft = buildMaskDraft()
    if (draft) onAddMask(draft)
  }

  const searchMaskOnMap = (): void => {
    const draft = buildMaskDraft()
    if (draft) {
      setPopoverPosition(null)
      onCreateMask(draft)
    }
  }

  return (
    <div className={`map-layer-manager${isOpen ? ' is-open' : ''}`}>
      <button
        ref={triggerRef}
        className="map-layer-manager-trigger"
        type="button"
        disabled={isPlacingMask}
        aria-expanded={isOpen}
        aria-controls="map-layer-manager-popover"
        title={t('Gérer l’ordre et l’opacité des calques')}
        onClick={() => {
          setPopoverPosition(null)
          setOpen((current) => !current)
        }}
      >
        <span className="map-layer-manager-trigger-icon" aria-hidden="true">
          ▤
        </span>
        <span>{t('Calque')}</span>
      </button>

      {isOpen &&
        createPortal(
          <section
            ref={popoverRef}
            className="map-layer-manager-popover"
            id="map-layer-manager-popover"
            aria-label={t('Gestion des calques')}
            style={
              popoverPosition
                ? { left: popoverPosition.left, top: popoverPosition.top }
                : { left: 16, top: 16, visibility: 'hidden' }
            }
          >
            <header className="map-layer-manager-heading">
              <div>
                <h2>{t('Gestion des calques')}</h2>
                <p>
                  {t(
                    'Les calques restent dans la pile ; les masques sans cible vont au-dessus. Glisse un masque à droite d’un calque pour l’associer.'
                  )}
                </p>
              </div>
              <button type="button" aria-label={t('Fermer')} onClick={closePopover}>
                ×
              </button>
            </header>

            <ol
              className="map-layer-manager-stack"
              aria-label={t('Ordre des calques, du dessus vers le dessous')}
            >
              {draggedRowId && (
                <li
                  data-layer-drop-zone="top"
                  className={`map-layer-manager-top-drop-zone${dropTarget?.id === '__top__' ? ' is-drop-target' : ''}`}
                >
                  {draggedMask
                    ? t('Relâcher ici pour détacher et replacer au-dessus')
                    : t('Déposer ici pour placer au sommet')}
                </li>
              )}
              {unassignedMasks.map((mask) => (
                <li
                  data-layer-drop-zone="top"
                  className="map-layer-manager-stack-item is-unassigned"
                  key={`mask:${mask.id}`}
                >
                  <small className="map-layer-manager-unassigned-label">
                    {t('Masque non assigné · au-dessus de la pile')}
                  </small>
                  {renderMaskCard(mask)}
                </li>
              ))}
              {orderedLayerRows.map(({ layer }) => {
                const attachedMasks = attachedMasksByLayer.get(layer.id) ?? []
                const layerDropActive = dropTarget?.id === layer.id && dropTarget.zone === 'layer'
                const maskDropActive = dropTarget?.id === layer.id && dropTarget.zone === 'mask'
                const showPair =
                  attachedMasks.length > 0 || (Boolean(draggedMask) && maskDropActive)
                const previewMask =
                  draggedMask && getMaskTargetLayer(draggedMask) !== layer.id && maskDropActive
                    ? draggedMask
                    : null
                const layerClass = `map-layer-manager-layer-slot${layerDropActive ? (dropTarget?.after ? ' drop-after' : ' drop-before') : ''}`
                return (
                  <li
                    data-layer-drop-target={layer.id}
                    className="map-layer-manager-stack-item"
                    key={layer.id}
                  >
                    <div
                      className={`map-layer-manager-layer-layout${showPair ? ' is-paired' : ''}`}
                    >
                      <div className={layerClass}>{renderLayerCard(layer)}</div>
                      <div
                        className={`map-layer-manager-mask-slot${showPair ? ' is-visible' : ''}${maskDropActive ? ' is-drop-target' : ''}`}
                        aria-label={`${t('Masques appliqués à')} ${t(layer.label)}`}
                        aria-hidden={!showPair}
                      >
                        {attachedMasks.map((mask) => renderMaskCard(mask))}
                        {previewMask && (
                          <div className="map-layer-manager-mask-preview">
                            <span aria-hidden="true">◌</span>
                            <strong>{previewMask.name}</strong>
                            <small>{t('Relâcher pour associer le masque')}</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            <details className="map-layer-manager-create-mask">
              <summary>{t('Ajouter un masque d’opacité')}</summary>
              <label>
                <span>{t('Type de masque')}</span>
                <select
                  value={maskKind}
                  onChange={(event) => setMaskKind(event.target.value as typeof maskKind)}
                >
                  <option value="circle">{t('Cercle')}</option>
                  <option value="rectangle">{t('Rectangle')}</option>
                  <option value="country">{t('Territoires')}</option>
                  <option value="continent">{t('Continents')}</option>
                </select>
              </label>

              {maskKind === 'country' && (
                <div className="map-layer-manager-country-picker">
                  <label className="map-layer-manager-search-label">
                    <span>{t('Rechercher un pays')}</span>
                    <input
                      type="search"
                      value={maskSelectionSearch}
                      placeholder={t('Saisis le nom d’un pays…')}
                      onChange={(event) => setMaskSelectionSearch(event.target.value)}
                    />
                  </label>
                  <div
                    className="map-layer-manager-country-options"
                    role="group"
                    aria-label={t('Territoires à utiliser')}
                  >
                    {filteredMaskCountries.map((country) => (
                      <label className="map-layer-manager-country-option" key={country.alpha2}>
                        <input
                          type="checkbox"
                          checked={countrySourceFeatureIds.includes(country.sourceFeatureId)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked
                            setCountrySourceFeatureIds((current) =>
                              checked
                                ? [...current, country.sourceFeatureId]
                                : current.filter((id) => id !== country.sourceFeatureId)
                            )
                          }}
                        />
                        <span>
                          {getRegionDisplayName(country.alpha2, country.countryName, language)}
                        </span>
                      </label>
                    ))}
                    {filteredMaskCountries.length === 0 && (
                      <p className="map-layer-manager-country-empty">{t('Aucun pays trouvé.')}</p>
                    )}
                  </div>
                  <small className="map-layer-manager-selection-hint">
                    {t('Pays sélectionnés')} · {countrySourceFeatureIds.length}
                  </small>
                </div>
              )}

              {maskKind === 'continent' && (
                <div className="map-layer-manager-country-picker">
                  <label className="map-layer-manager-search-label">
                    <span>{t('Rechercher un pays ou un continent')}</span>
                    <input
                      type="search"
                      value={maskSelectionSearch}
                      placeholder={t('Saisis un pays ou un continent…')}
                      onChange={(event) => setMaskSelectionSearch(event.target.value)}
                    />
                  </label>
                  <div
                    className="map-layer-manager-country-options"
                    role="group"
                    aria-label={t('Continents à utiliser')}
                  >
                    {filteredMaskContinents.map((region) => (
                      <label className="map-layer-manager-country-option" key={region.id}>
                        <input
                          type="checkbox"
                          checked={selectedContinentIds.includes(region.id as ContinentId)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked
                            setSelectedContinentIds((current) =>
                              checked
                                ? [...current, region.id as ContinentId]
                                : current.filter((id) => id !== (region.id as ContinentId))
                            )
                          }}
                        />
                        <span>{t(region.label)}</span>
                      </label>
                    ))}
                    {filteredMaskContinents.length === 0 && (
                      <p className="map-layer-manager-country-empty">
                        {t('Aucun continent trouvé.')}
                      </p>
                    )}
                  </div>
                  <small className="map-layer-manager-selection-hint">
                    {t('Une recherche par pays affiche son continent dans la liste.')}
                  </small>
                  <small className="map-layer-manager-selection-hint">
                    {t('Continents sélectionnés')} · {selectedContinentIds.length}
                  </small>
                </div>
              )}

              {maskKind === 'circle' && (
                <label>
                  <span>
                    {t('Rayon du cercle')} · {radiusKm} km
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={6000}
                    step={50}
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value))}
                  />
                </label>
              )}

              {maskKind === 'rectangle' && (
                <div className="map-layer-manager-mask-dimensions">
                  <label>
                    <span>
                      {t('Largeur')} · {widthKm} km
                    </span>
                    <input
                      type="range"
                      min={100}
                      max={12000}
                      step={100}
                      value={widthKm}
                      onChange={(event) => setWidthKm(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>
                      {t('Hauteur')} · {heightKm} km
                    </span>
                    <input
                      type="range"
                      min={100}
                      max={12000}
                      step={100}
                      value={heightKm}
                      onChange={(event) => setHeightKm(Number(event.target.value))}
                    />
                  </label>
                </div>
              )}

              <label className="map-layer-manager-mask-opacity">
                <span>
                  {t('Opacité du calque dans la zone')} · {maskOpacity}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={maskOpacity}
                  onChange={(event) => setMaskOpacity(Number(event.target.value))}
                />
              </label>

              {maskKind === 'country' || maskKind === 'continent' ? (
                <div className="map-layer-manager-mask-actions">
                  <button
                    className="map-layer-manager-add-mask"
                    type="button"
                    onClick={isPlacingMask ? onCancelMaskPlacement : searchMaskOnMap}
                  >
                    {isPlacingMask ? t('Annuler la recherche') : t('Rechercher sur la carte')}
                  </button>
                  <button
                    className="map-layer-manager-add-mask is-confirm"
                    type="button"
                    disabled={
                      maskKind === 'country'
                        ? countrySourceFeatureIds.length === 0
                        : selectedContinentIds.length === 0
                    }
                    onClick={addMaskFromList}
                  >
                    <span aria-hidden="true">✓</span> {t('Ajouter le masque')}
                  </button>
                </div>
              ) : (
                <button
                  className="map-layer-manager-add-mask"
                  type="button"
                  onClick={isPlacingMask ? onCancelMaskPlacement : searchMaskOnMap}
                >
                  {isPlacingMask ? t('Annuler le placement') : t('Placer sur la carte')}
                </button>
              )}
              {isPlacingMask && (
                <p className="map-layer-manager-placement-hint">
                  {maskKind === 'country' || maskKind === 'continent'
                    ? t('Clique sur un territoire de la carte pour le sélectionner comme masque.')
                    : t('Clique sur la carte pour placer le centre du masque.')}
                </p>
              )}
              <p className="map-layer-manager-mask-help">
                {t(
                  '0 % rend le calque transparent dans la zone ; 100 % le laisse intact. Le masque révèle les calques placés dessous.'
                )}
              </p>
            </details>
          </section>,
          document.getElementById('root') ?? document.body
        )}
    </div>
  )
}
