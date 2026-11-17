import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import countryCatalog from '../data/quiz/countryCatalog.json'
import { quizRegions, type ContinentId } from '../data/quiz/countryContinents'
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
  relocatingMaskId: string | null
  onToggleLayer: (id: ManagedMapLayerId, enabled: boolean) => void
  onLayerOpacityChange: (id: ManagedMapLayerId, opacity: number) => void
  onLayerDensityChange: (id: ManagedMapLayerId, density: number) => void
  onSelectLayerVariant: (id: ManagedMapLayerId, variantId: string) => void
  onOrderChange: (order: MapLayerStackId[]) => void
  onCreateMask: (draft: MapOpacityMaskDraft) => void
  onCancelMaskPlacement: () => void
  onRelocateMask: (mask: MapOpacityMask) => void
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
  relocatingMaskId,
  onToggleLayer,
  onLayerOpacityChange,
  onLayerDensityChange,
  onSelectLayerVariant,
  onOrderChange,
  onCreateMask,
  onCancelMaskPlacement,
  onRelocateMask,
  onUpdateMask,
  onDeleteMask
}: MapLayerManagerProps): React.JSX.Element {
  const { language, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [maskKind, setMaskKind] = useState<'circle' | 'rectangle' | 'country' | 'continent'>('circle')
  const [countrySourceFeatureIds, setCountrySourceFeatureIds] = useState<number[]>([])
  const [selectedContinentIds, setSelectedContinentIds] = useState<ContinentId[]>(['africa'])
  const [expandedLayerGroups, setExpandedLayerGroups] = useState<Set<ManagedMapLayerId>>(
    () => new Set(['texture'])
  )
  const [maskOpacity, setMaskOpacity] = useState(35)
  const [radiusKm, setRadiusKm] = useState(500)
  const [widthKm, setWidthKm] = useState(1000)
  const [heightKm, setHeightKm] = useState(700)
  const [draggedRowId, setDraggedRowId] = useState<MapLayerStackId | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: MapLayerStackId; after: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLElement | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number } | null>(null)

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

  const continentOptions = quizRegions.filter((region) => region.id !== 'world')

  const countryMaskName = (sourceFeatureIds: Array<string | number>): string => {
    const names = sourceFeatureIds.flatMap((sourceFeatureId) => {
      const country = countryCatalog.find((item) => String(item.sourceFeatureId) === String(sourceFeatureId))
      return country ? [getRegionDisplayName(country.alpha2, country.countryName, language)] : []
    })
    return names.length <= 2
      ? `${t('Territoires')}: ${names.join(', ')}`
      : `${t('Territoires')} (${names.length})`
  }

  const continentMaskName = (ids: ContinentId[]): string => {
    const names = ids.flatMap((id) => {
      const region = continentOptions.find((item) => item.id === id)
      return region ? [t(region.label)] : []
    })
    return names.length <= 2
      ? `${t('Continents')}: ${names.join(', ')}`
      : `${t('Continents')} (${names.length})`
  }

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null)
      return
    }

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
      setPopoverPosition((current) => current?.left === left && current.top === top ? current : { left, top })
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
  }, [open, rows.length])

  useLayoutEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const moveRow = (sourceId: MapLayerStackId, targetId: MapLayerStackId, after: boolean): void => {
    if (sourceId === targetId) return
    const next = rows.map((row) => row.id)
    const sourceIndex = next.indexOf(sourceId)
    const targetIndex = next.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    next.splice(sourceIndex, 1)
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    next.splice(adjustedTargetIndex + (after ? 1 : 0), 0, sourceId)
    onOrderChange(next)
  }

  const createMask = (): void => {
    if (maskKind === 'circle') {
      onCreateMask({ kind: 'circle', name: t('Cercle'), opacity: maskOpacity, radiusKm })
    } else if (maskKind === 'rectangle') {
      onCreateMask({ kind: 'rectangle', name: t('Rectangle'), opacity: maskOpacity, widthKm, heightKm })
    } else if (maskKind === 'country' && countrySourceFeatureIds.length) {
      onCreateMask({
        kind: 'country',
        name: countryMaskName(countrySourceFeatureIds),
        opacity: maskOpacity,
        sourceFeatureIds: countrySourceFeatureIds
      })
    } else if (maskKind === 'continent') {
      if (!selectedContinentIds.length) return
      onCreateMask({
        kind: 'continent',
        name: continentMaskName(selectedContinentIds),
        opacity: maskOpacity,
        continents: selectedContinentIds
      })
    }
  }

  return (
    <div className={`map-layer-manager${open ? ' is-open' : ''}`}>
      <button
        ref={triggerRef}
        className="map-layer-manager-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="map-layer-manager-popover"
        title={t('Gérer l’ordre et l’opacité des calques')}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="map-layer-manager-trigger-icon" aria-hidden="true">▤</span>
        <span>{t('Calque')}</span>
      </button>

      {open && createPortal(
        <section
          ref={popoverRef}
          className="map-layer-manager-popover"
          id="map-layer-manager-popover"
          aria-label={t('Gestion des calques')}
          style={popoverPosition ? { left: popoverPosition.left, top: popoverPosition.top } : { left: 16, top: 16, visibility: 'hidden' }}
        >
          <header className="map-layer-manager-heading">
            <div>
              <h2>{t('Gestion des calques')}</h2>
              <p>{t('Glisse une ligne au-dessus ou en dessous des autres couches.')}</p>
            </div>
            <button type="button" aria-label={t('Fermer')} onClick={() => setOpen(false)}>×</button>
          </header>

          <ol className="map-layer-manager-stack" aria-label={t('Ordre des calques, du dessus vers le dessous')}>
            {rows.map((row) => {
              const isMask = row.kind === 'mask'
              const label = isMask ? row.mask.name : t(row.layer.label)
              const enabled = isMask || row.layer.enabled
              const opacity = isMask ? row.mask.opacity : row.layer.opacity
              const maskHint = isMask
                ? row.mask.kind === 'circle'
                  ? `${t('Cercle')} · ${row.mask.radiusKm ?? 0} km`
                  : row.mask.kind === 'rectangle'
                    ? `${t('Rectangle')} · ${row.mask.widthKm ?? 0} × ${row.mask.heightKm ?? 0} km`
                    : row.mask.kind === 'continent' ? t('Masque de continents') : t('Masque de territoires')
                : null
              const layerExpandable = !isMask && Boolean(
                row.layer.variants || row.layer.maximum !== undefined
              )
              const rowDetail = isMask
                ? null
                : row.layer.fixedCount !== undefined
                  ? `${row.layer.fixedCount} ${t('chaînes')}`
                  : row.layer.maximum !== undefined
                    ? `${row.layer.enabled ? row.layer.density ?? 0 : 0} / ${row.layer.maximum}`
                    : null
              return (
                <li
                  key={row.id}
                  className={`map-layer-manager-row${isMask ? ' is-mask' : ''}${draggedRowId === row.id ? ' is-dragging' : ''}${dropTarget?.id === row.id ? dropTarget.after ? ' drop-after' : ' drop-before' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    const bounds = event.currentTarget.getBoundingClientRect()
                    setDropTarget({ id: row.id, after: event.clientY > bounds.top + bounds.height / 2 })
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceId = draggedRowId ?? event.dataTransfer.getData('text/plain') as MapLayerStackId
                    const bounds = event.currentTarget.getBoundingClientRect()
                    const after = event.clientY > bounds.top + bounds.height / 2
                    if (sourceId) moveRow(sourceId, row.id, after)
                    setDraggedRowId(null)
                    setDropTarget(null)
                  }}
                >
                  <button
                    className="map-layer-manager-drag-handle"
                    type="button"
                    draggable
                    aria-label={`${t('Déplacer le calque')} — ${label}`}
                    title={t('Glisser pour changer l’ordre')}
                    onDragStart={(event) => {
                      setDraggedRowId(row.id)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', row.id)
                    }}
                    onDragEnd={() => {
                      setDraggedRowId(null)
                      setDropTarget(null)
                    }}
                  >
                    ⠿
                  </button>
                  {isMask ? (
                    <span className="map-layer-manager-mask-icon" aria-hidden="true">◌</span>
                  ) : (
                    <input
                      className="map-layer-manager-visibility"
                      type="checkbox"
                      checked={enabled}
                      aria-label={`${t('Afficher le calque')} — ${label}`}
                      onChange={(event) => onToggleLayer(row.layer.id, event.target.checked)}
                    />
                  )}
                  <div className="map-layer-manager-row-content">
                    <div className="map-layer-manager-row-title">
                      <strong>{label}</strong>
                      {!isMask && layerExpandable && (
                        <button
                          type="button"
                          className="map-layer-manager-group-toggle"
                          aria-expanded={expandedLayerGroups.has(row.layer.id)}
                          aria-label={`${t(expandedLayerGroups.has(row.layer.id) ? 'Replier le groupe' : 'Déplier le groupe')} — ${label}`}
                          onClick={() => setExpandedLayerGroups((current) => {
                            const next = new Set(current)
                            if (next.has(row.layer.id)) next.delete(row.layer.id)
                            else next.add(row.layer.id)
                            return next
                          })}
                        >
                          {expandedLayerGroups.has(row.layer.id) ? '⌃' : '⌄'}
                        </button>
                      )}
                      {maskHint && <small>{maskHint}</small>}
                      {!isMask && rowDetail && <small className="map-layer-manager-count">{rowDetail}</small>}
                    </div>
                    {!isMask && row.layer.description && (
                      <small className="map-layer-manager-row-description">{t(row.layer.description)}</small>
                    )}
                    <div className="map-layer-manager-row-opacity">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={opacity}
                        aria-label={`${t('Opacité')} — ${label}`}
                        onChange={(event) => isMask
                          ? onUpdateMask(row.mask.id, { opacity: Number(event.target.value) })
                          : onLayerOpacityChange(row.layer.id, Number(event.target.value))}
                      />
                      <span>{opacity}%</span>
                    </div>
                    {isMask && (
                      <details className="map-layer-manager-mask-editor">
                        <summary>{t('Modifier le masque')}</summary>
                        {row.mask.kind === 'circle' && (
                          <label>
                            <span>{t('Rayon')} · {row.mask.radiusKm ?? 500} km</span>
                            <input type="range" min={50} max={6000} step={50} value={row.mask.radiusKm ?? 500} onChange={(event) => onUpdateMask(row.mask.id, { radiusKm: Number(event.target.value) })} />
                          </label>
                        )}
                        {row.mask.kind === 'rectangle' && (
                          <div className="map-layer-manager-mask-dimensions">
                            <label>
                              <span>{t('Largeur')} · {row.mask.widthKm ?? 1000} km</span>
                              <input type="range" min={100} max={12000} step={100} value={row.mask.widthKm ?? 1000} onChange={(event) => onUpdateMask(row.mask.id, { widthKm: Number(event.target.value) })} />
                            </label>
                            <label>
                              <span>{t('Hauteur')} · {row.mask.heightKm ?? 700} km</span>
                              <input type="range" min={100} max={12000} step={100} value={row.mask.heightKm ?? 700} onChange={(event) => onUpdateMask(row.mask.id, { heightKm: Number(event.target.value) })} />
                            </label>
                          </div>
                        )}
                        {row.mask.kind === 'country' && (
                          <label>
                            <span>{t('Territoires à utiliser')}</span>
                            <select
                              className="map-layer-manager-multi-select"
                              multiple
                              size={Math.min(6, Math.max(3, countryCatalog.length))}
                              value={(row.mask.sourceFeatureIds ?? (row.mask.sourceFeatureId !== undefined ? [row.mask.sourceFeatureId] : [])).map(String)}
                              onChange={(event) => {
                                const sourceFeatureIds = Array.from(event.currentTarget.selectedOptions)
                                  .map((option) => Number(option.value))
                                const names = countryMaskName(sourceFeatureIds)
                                onUpdateMask(row.mask.id, {
                                  sourceFeatureId: undefined,
                                  sourceFeatureIds,
                                  name: names
                                })
                              }}
                            >
                              {countryCatalog.map((country) => (
                                <option key={country.alpha2} value={country.sourceFeatureId}>
                                  {getRegionDisplayName(country.alpha2, country.countryName, language)}
                                </option>
                              ))}
                            </select>
                            <small className="map-layer-manager-selection-hint">{t('Maintiens ⌘ ou Ctrl et clique pour sélectionner plusieurs éléments.')}</small>
                          </label>
                        )}
                        {row.mask.kind === 'continent' && (
                          <label>
                            <span>{t('Continents à utiliser')}</span>
                            <select
                              className="map-layer-manager-multi-select"
                              multiple
                              size={Math.min(6, Math.max(3, continentOptions.length))}
                              value={(row.mask.continents ?? (row.mask.continent ? [row.mask.continent] : [])).map(String)}
                              onChange={(event) => {
                                const nextContinents = Array.from(event.currentTarget.selectedOptions)
                                  .map((option) => option.value as ContinentId)
                                onUpdateMask(row.mask.id, {
                                  continent: undefined,
                                  continents: nextContinents,
                                  name: continentMaskName(nextContinents)
                                })
                              }}
                            >
                              {continentOptions.map((region) => (
                                <option key={region.id} value={region.id}>{t(region.label)}</option>
                              ))}
                            </select>
                            <small className="map-layer-manager-selection-hint">{t('Maintiens ⌘ ou Ctrl et clique pour sélectionner plusieurs éléments.')}</small>
                          </label>
                        )}
                        {(row.mask.kind === 'circle' || row.mask.kind === 'rectangle') && (
                          <button
                            type="button"
                            className="map-layer-manager-reposition-mask"
                            onClick={() => onRelocateMask(row.mask)}
                          >
                            {relocatingMaskId === row.mask.id ? t('Clique sur la carte pour repositionner') : t('Repositionner sur la carte')}
                          </button>
                        )}
                      </details>
                    )}
                    {!isMask && layerExpandable && expandedLayerGroups.has(row.layer.id) && (
                      <div className="map-layer-manager-layer-options">
                        {row.layer.variants && (
                          <div className="map-layer-manager-layer-variants" role="radiogroup" aria-label={`${t('Sous-calques')} — ${label}`}>
                            {row.layer.variants.map((variant) => (
                              <label key={variant.id} className={row.layer.activeVariant === variant.id ? 'is-active' : ''}>
                                <input
                                  type="radio"
                                  name={`managed-layer-${row.layer.id}`}
                                  value={variant.id}
                                  checked={row.layer.activeVariant === variant.id}
                                  onChange={() => onSelectLayerVariant(row.layer.id, variant.id)}
                                />
                                <span>{t(variant.label)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {row.layer.maximum !== undefined && row.layer.density !== undefined && (
                          <div className="map-layer-manager-density">
                            <label>
                              <span>{t('Éléments affichés')}</span>
                              <strong>{row.layer.enabled ? row.layer.density : 0} / {row.layer.maximum}</strong>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(1, row.layer.maximum)}
                              step={1}
                              value={row.layer.enabled ? row.layer.density : 0}
                              aria-label={`${t(row.layer.label)} — ${t('Éléments affichés')}`}
                              onChange={(event) => onLayerDensityChange(row.layer.id, Number(event.target.value))}
                            />
                            <div className="map-layer-manager-density-ends"><span>{t('Aucun')}</span><span>{t('Tout')}</span></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isMask && (
                    <button
                      className="map-layer-manager-remove"
                      type="button"
                      aria-label={`${t('Supprimer le masque')} — ${label}`}
                      title={t('Supprimer le masque')}
                      onClick={() => onDeleteMask(row.mask.id)}
                    >
                      ×
                    </button>
                  )}
                </li>
              )
            })}
          </ol>

          <details className="map-layer-manager-create-mask">
            <summary>{t('Ajouter un masque d’opacité')}</summary>
            <label>
              <span>{t('Type de masque')}</span>
              <select value={maskKind} onChange={(event) => setMaskKind(event.target.value as typeof maskKind)}>
                <option value="circle">{t('Cercle')}</option>
                <option value="rectangle">{t('Rectangle')}</option>
                <option value="country">{t('Territoires')}</option>
                <option value="continent">{t('Continents')}</option>
              </select>
            </label>

            {maskKind === 'country' && (
              <label>
                <span>{t('Territoires à utiliser')}</span>
                <select
                  className="map-layer-manager-multi-select"
                  multiple
                  size={6}
                  value={countrySourceFeatureIds.map(String)}
                  onChange={(event) => setCountrySourceFeatureIds(
                    Array.from(event.currentTarget.selectedOptions).map((option) => Number(option.value))
                  )}
                >
                  {countryCatalog.map((country) => (
                    <option key={country.alpha2} value={country.sourceFeatureId}>
                      {getRegionDisplayName(country.alpha2, country.countryName, language)}
                    </option>
                  ))}
                </select>
                <small className="map-layer-manager-selection-hint">{t('Maintiens ⌘ ou Ctrl et clique pour sélectionner plusieurs éléments.')}</small>
              </label>
            )}

            {maskKind === 'continent' && (
              <label>
                <span>{t('Continents à utiliser')}</span>
                <select
                  className="map-layer-manager-multi-select"
                  multiple
                  size={Math.min(6, continentOptions.length)}
                  value={selectedContinentIds}
                  onChange={(event) => setSelectedContinentIds(
                    Array.from(event.currentTarget.selectedOptions).map((option) => option.value as ContinentId)
                  )}
                >
                  {continentOptions.map((region) => (
                    <option key={region.id} value={region.id}>{t(region.label)}</option>
                  ))}
                </select>
                <small className="map-layer-manager-selection-hint">{t('Maintiens ⌘ ou Ctrl et clique pour sélectionner plusieurs éléments.')}</small>
              </label>
            )}

            {maskKind === 'circle' && (
              <label>
                <span>{t('Rayon du cercle')} · {radiusKm} km</span>
                <input type="range" min={50} max={6000} step={50} value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} />
              </label>
            )}

            {maskKind === 'rectangle' && (
              <div className="map-layer-manager-mask-dimensions">
                <label>
                  <span>{t('Largeur')} · {widthKm} km</span>
                  <input type="range" min={100} max={12000} step={100} value={widthKm} onChange={(event) => setWidthKm(Number(event.target.value))} />
                </label>
                <label>
                  <span>{t('Hauteur')} · {heightKm} km</span>
                  <input type="range" min={100} max={12000} step={100} value={heightKm} onChange={(event) => setHeightKm(Number(event.target.value))} />
                </label>
              </div>
            )}

            <label className="map-layer-manager-mask-opacity">
              <span>{t('Opacité dans la zone')} · {maskOpacity}%</span>
              <input type="range" min={0} max={100} value={maskOpacity} onChange={(event) => setMaskOpacity(Number(event.target.value))} />
            </label>

            <button
              className="map-layer-manager-add-mask"
              type="button"
              disabled={
                !isPlacingMask && (
                  (maskKind === 'country' && countrySourceFeatureIds.length === 0) ||
                  (maskKind === 'continent' && selectedContinentIds.length === 0)
                )
              }
              onClick={isPlacingMask ? onCancelMaskPlacement : createMask}
            >
              {isPlacingMask
                ? t('Annuler le placement')
                : maskKind === 'circle' || maskKind === 'rectangle'
                  ? t('Placer sur la carte')
                : t('Ajouter le masque')}
            </button>
            {isPlacingMask && (
              <p className="map-layer-manager-placement-hint">
                {t(relocatingMaskId ? 'Clique sur la carte pour repositionner le masque.' : 'Clique sur la carte pour placer le centre du masque.')}
              </p>
            )}
            <p className="map-layer-manager-mask-help">{t('Le masque atténue les calques placés sous lui dans la liste.')}</p>
          </details>
        </section>,
        document.getElementById('root') ?? document.body
      )}
    </div>
  )
}
