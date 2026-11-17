import { useRef, useState } from 'react'
import WorldMap from './WorldMap'
import {
  getExplorationDetails,
  getExplorationDetailsForTerritory,
  type ExplorationDetails
} from '../data/geography/exploration'
import { ExplorationPlaceDetails } from './ExplorationPlaceDetails'
import { useLanguage } from '../data/i18n'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'
import { SettingsMenu } from './SettingsMenu'
import { MapFullscreenBar } from './MapFullscreenBar'
import { useSkin } from '../data/skin'
import { MapLayerControls } from './MapLayerControls'
import { MapLayerManager, type MapLayerManagerItem } from './MapLayerManager'
import { fullMapLayerDensities, mapLayerDensityMaximums, type DensityLayerId, type MapLayerDensities } from '../data/geography/mapLayerDensity'
import { mountainRanges } from '../data/geography/physical/mountainRanges'
import {
  defaultMapLayerOpacities,
  defaultMapLayerOrder,
  type MapLayerOpacityValues,
  type MapLayerStackId,
  type MapOpacityMask,
  type MapOpacityMaskDraft,
  type ManagedMapLayerId
} from '../data/geography/mapLayerManager'

type ExplorationViewProps = {
  globeMode: boolean
  onToggleGlobeMode: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenStatistics: () => void
  onCompareCountries: (alpha2s: string[]) => void
  onModeChange: (mode: AppPrimaryMode) => void
}

export function ExplorationView({
  globeMode,
  onToggleGlobeMode,
  isFullscreen,
  onToggleFullscreen,
  onOpenStatistics,
  onCompareCountries,
  onModeChange
}: ExplorationViewProps): React.JSX.Element {
  const { t } = useLanguage()
  const { skin } = useSkin()
  const [showBorders, setShowBorders] = useState(true)
  const [showTerritories, setShowTerritories] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showFlagTerritories, setShowFlagTerritories] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const [showRivers, setShowRivers] = useState(false)
  const [showMountains, setShowMountains] = useState(false)
  const [showSummits, setShowSummits] = useState(false)
  const [chromeCollapsed, setChromeCollapsed] = useState(false)
  const [mapIntroCollapsed, setMapIntroCollapsed] = useState(false)
  const [layerControlsCollapsed, setLayerControlsCollapsed] = useState(false)
  const [detailsCollapsed, setDetailsCollapsed] = useState(false)
  const [perspectiveComparisonPortal, setPerspectiveComparisonPortal] = useState<HTMLDivElement | null>(null)
  const [layerDensities, setLayerDensities] = useState<MapLayerDensities>(fullMapLayerDensities)
  const [realLayer, setRealLayer] = useState<'day' | 'night' | 'clouds' | null>(null)
  const [realLayerVariant, setRealLayerVariant] = useState<'day' | 'night' | 'clouds'>('day')
  const [layerOrder, setLayerOrder] = useState<MapLayerStackId[]>(defaultMapLayerOrder)
  const [layerOpacities, setLayerOpacities] = useState<MapLayerOpacityValues>(defaultMapLayerOpacities)
  const [opacityMasks, setOpacityMasks] = useState<MapOpacityMask[]>([])
  const [pendingMaskDraft, setPendingMaskDraft] = useState<MapOpacityMaskDraft | null>(null)
  const [pendingMaskId, setPendingMaskId] = useState<string | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<ExplorationDetails | null>(null)
  const explorationPanelsCollapsed = chromeCollapsed && layerControlsCollapsed && detailsCollapsed
  const [focusEntityRequest, setFocusEntityRequest] = useState<{
    entityId: string
    sequence: number
  } | null>(null)
  const focusSequenceRef = useRef(0)

  const handlePlaceSelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): void => {
    setSelectedPlace(getExplorationDetails(sourceFeatureId, name, entityId))
  }

  const handleTerritorySelected = (entityId: string): void => {
    const details = getExplorationDetailsForTerritory(entityId)
    if (!details) return

    setSelectedPlace(details)
    focusSequenceRef.current += 1
    setFocusEntityRequest({ entityId, sequence: focusSequenceRef.current })
  }
  const toggleLayer = (id: string, enabled: boolean): void => {
    if (id === 'summits') {
      setShowSummits(enabled)
      if (enabled && layerDensities.mountains === 0) {
        setLayerDensities((current) => ({ ...current, mountains: 1 }))
      }
      return
    }
    if (id === 'borders') setShowBorders(enabled)
    if (id === 'labels') setShowLabels(enabled)
    if (id === 'rivers') setShowRivers(enabled)
    if (id === 'mountains') setShowMountains(enabled)
    if (id === 'flags') setShowFlagTerritories(enabled)
    if (id === 'resources') setShowResources(enabled)
    if (id !== 'mountains') {
      const layerId = id as DensityLayerId
      if (enabled && layerId in layerDensities && layerDensities[layerId] === 0) {
        setLayerDensities((current) => ({ ...current, [layerId]: 1 }))
      }
    }
  }

  const changeLayerDensity = (id: string, value: number): void => {
    const layerId = (id === 'summits' ? 'mountains' : id) as DensityLayerId
    setLayerDensities((current) => ({ ...current, [layerId]: value }))
    const enabled = value > 0
    if (id === 'labels') setShowLabels(enabled)
    if (id === 'rivers') setShowRivers(enabled)
    if (id === 'summits') setShowSummits(enabled)
    if (id === 'flags') setShowFlagTerritories(enabled)
    if (id === 'resources') setShowResources(enabled)
  }

  const addOpacityMask = (draft: MapOpacityMaskDraft, center?: [number, number]): void => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const mask: MapOpacityMask = { ...draft, id, ...(center ? { center } : {}) }
    setOpacityMasks((current) => [...current, mask])
    setLayerOrder((current) => [`mask:${id}`, ...current.filter((item) => item !== `mask:${id}`)])
  }

  const handleCreateOpacityMask = (draft: MapOpacityMaskDraft): void => {
    if (draft.kind === 'circle' || draft.kind === 'rectangle') {
      setPendingMaskDraft(draft)
      setPendingMaskId(null)
      return
    }
    addOpacityMask(draft)
  }

  const handlePlaceOpacityMask = (position: [number, number]): void => {
    if (!pendingMaskDraft) return
    if (pendingMaskId) {
      setOpacityMasks((current) => current.map((mask) => mask.id === pendingMaskId ? { ...mask, center: position } : mask))
    } else {
      addOpacityMask(pendingMaskDraft, position)
    }
    setPendingMaskDraft(null)
    setPendingMaskId(null)
  }

  const cancelOpacityMaskPlacement = (): void => {
    setPendingMaskDraft(null)
    setPendingMaskId(null)
  }

  const relocateOpacityMask = (mask: MapOpacityMask): void => {
    if (mask.kind !== 'circle' && mask.kind !== 'rectangle') return
    setPendingMaskDraft({
      kind: mask.kind,
      name: mask.name,
      opacity: mask.opacity,
      ...(mask.radiusKm !== undefined ? { radiusKm: mask.radiusKm } : {}),
      ...(mask.widthKm !== undefined ? { widthKm: mask.widthKm } : {}),
      ...(mask.heightKm !== undefined ? { heightKm: mask.heightKm } : {})
    })
    setPendingMaskId(mask.id)
  }

  const handleLayerManagerToggle = (id: ManagedMapLayerId, enabled: boolean): void => {
    if (id === 'texture') {
      setRealLayer(enabled ? realLayerVariant : null)
      return
    }
    if (id === 'territories') {
      setShowTerritories(enabled)
      return
    }
    toggleLayer(id, enabled)
  }

  const managerLayers: MapLayerManagerItem[] = [
    {
      id: 'territories', label: 'Territoires', description: 'Fond neutre',
      enabled: showTerritories, opacity: layerOpacities.territories
    },
    {
      id: 'texture',
      label: 'Réelle',
      enabled: realLayer !== null,
      opacity: layerOpacities.texture,
      activeVariant: realLayerVariant,
      variants: [
        { id: 'day', label: 'Jour' },
        { id: 'night', label: 'Nuit' },
        { id: 'clouds', label: 'Nuages' }
      ]
    }
  ]

  const managerOrder = layerOrder.filter((id) =>
    id === 'texture' || id === 'territories' || id.startsWith('mask:')
  )

  const updateManagerOrder = (nextManagerOrder: MapLayerStackId[]): void => {
    setLayerOrder((current) => {
      const isManaged = (id: MapLayerStackId): boolean =>
        id === 'texture' || id === 'territories' || id.startsWith('mask:')
      const firstManagedIndex = current.findIndex(isManaged)
      const preservedBefore = current.slice(0, firstManagedIndex).filter((id) => !isManaged(id))
      const preservedAfter = current.slice(firstManagedIndex).filter((id) => !isManaged(id))
      return [...preservedBefore, ...nextManagerOrder, ...preservedAfter]
    })
  }

  const layerOptions = (
    <>
      <MapLayerControls
        layers={[
          { id: 'borders', label: 'Frontières', enabled: showBorders, density: 0, maximum: 0, border: true },
          { id: 'labels', label: 'Noms des pays', enabled: showLabels, density: layerDensities.labels, maximum: mapLayerDensityMaximums.labels },
          { id: 'rivers', label: 'Fleuves', enabled: showRivers, density: layerDensities.rivers, maximum: mapLayerDensityMaximums.rivers, title: 'Afficher les principaux fleuves documentés' },
          {
            id: 'mountains',
            label: 'Chaînes de montagnes',
            enabled: showMountains,
            density: mountainRanges.length,
            maximum: mountainRanges.length,
            fixedCount: mountainRanges.length,
            subLayer: {
              id: 'summits',
              label: 'Sommets',
              enabled: showSummits,
              density: layerDensities.mountains,
              maximum: mapLayerDensityMaximums.mountains
            },
            title: 'Afficher les principales chaînes de montagnes documentées'
          },
          { id: 'flags', label: 'Drapeaux', enabled: showFlagTerritories, density: layerDensities.flags, maximum: mapLayerDensityMaximums.flags, title: 'Intégrer le drapeau dans le contour des pays et territoires' },
          { id: 'resources', label: 'Ressources', enabled: showResources, density: layerDensities.resources, maximum: mapLayerDensityMaximums.resources, title: 'Afficher les principales industries documentées de chaque territoire' }
        ]}
        onToggle={toggleLayer}
        onDensityChange={changeLayerDensity}
      />
      <MapLayerManager
        layers={managerLayers}
        masks={opacityMasks}
        order={managerOrder}
        isPlacingMask={pendingMaskDraft !== null}
        relocatingMaskId={pendingMaskId}
        onToggleLayer={handleLayerManagerToggle}
        onLayerOpacityChange={(id, opacity) => setLayerOpacities((current) => ({ ...current, [id]: opacity }))}
        onLayerDensityChange={changeLayerDensity}
        onSelectLayerVariant={(id, variantId) => {
          if (id !== 'texture' || !['day', 'night', 'clouds'].includes(variantId)) return
          const nextVariant = variantId as 'day' | 'night' | 'clouds'
          setRealLayerVariant(nextVariant)
          setRealLayer(nextVariant)
        }}
        onOrderChange={updateManagerOrder}
        onCreateMask={handleCreateOpacityMask}
        onCancelMaskPlacement={cancelOpacityMaskPlacement}
        onRelocateMask={relocateOpacityMask}
        onUpdateMask={(id, patch) => setOpacityMasks((current) => current.map((mask) => mask.id === id ? { ...mask, ...patch } : mask))}
        onDeleteMask={(id) => {
          setOpacityMasks((current) => current.filter((mask) => mask.id !== id))
          setLayerOrder((current) => current.filter((item) => item !== `mask:${id}`))
        }}
      />
    </>
  )

  return (
    <div className={`exploration-screen${isFullscreen ? ' map-fullscreen-screen exploration-map-fullscreen' : ''}`}>
      {chromeCollapsed && !isFullscreen && <SettingsMenu floating />}
      {isFullscreen && (
        <MapFullscreenBar
          title={t('Exploration')}
          onOpenStatistics={onOpenStatistics}
          onExit={onToggleFullscreen}
        />
      )}
      {chromeCollapsed && !isFullscreen && (
        <button
          className="exploration-panel-toggle exploration-panel-reopen exploration-chrome-reopen exploration-hover-reveal"
          type="button"
          aria-label={t('Afficher l’en-tête et la navigation')}
          title={t('Afficher l’en-tête et la navigation')}
          aria-expanded={false}
          onClick={() => setChromeCollapsed(false)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      )}
      {!chromeCollapsed && (
        <>
          <header className="exploration-header">
            <div className="exploration-brand">
              <div className="brand-icon">W</div>
              <div>
                <div className="brand-name">WORLD ATLAS</div>
                <div className="brand-subtitle">{t('Exploration')}</div>
              </div>
            </div>

            <div className="exploration-heading">
              <div className="breadcrumb">{t('EXPLORATION / MONDE')}</div>
              <h1>{t('Explorer le monde')}</h1>
            </div>

            <div className="exploration-header-actions">
              <button className="home-back-button" type="button" onClick={onOpenStatistics}>
                {t('Statistiques')}
              </button>
              <button className="home-back-button" type="button" onClick={onToggleFullscreen}>
                {t(isFullscreen ? 'Quitter le plein écran' : 'Plein écran')}
              </button>
            </div>
            <button
              className="exploration-panel-toggle exploration-zone-collapse"
              type="button"
              aria-label={t('Masquer l’en-tête et la navigation')}
              title={t('Masquer l’en-tête et la navigation')}
              aria-expanded={true}
              onClick={() => setChromeCollapsed(true)}
            >
              <span aria-hidden="true">⌃</span>
            </button>
          </header>

          <AppModeSwitcher active="exploration" onChange={onModeChange} />
        </>
      )}

      <main className="exploration-workspace">
        <section className="exploration-map-panel" aria-label={t('Carte interactive')}>
          <div className={`exploration-map-toolbar${mapIntroCollapsed ? ' is-collapsed' : ''}`}>
            {!mapIntroCollapsed && (
              <div>
                <div className="map-title">{t('Carte mondiale')}</div>
                <div className="map-subtitle">
                  {t('Clique sur un pays ou un territoire pour afficher sa fiche.')}
                </div>
              </div>
            )}
            {!mapIntroCollapsed && (
              <div
                className="perspective-comparison-toolbar-slot"
                ref={setPerspectiveComparisonPortal}
              />
            )}
            <button
              className={`exploration-panel-toggle exploration-zone-collapse${mapIntroCollapsed ? ' exploration-hover-reveal' : ''}`}
              type="button"
              aria-label={t(mapIntroCollapsed ? 'Afficher le titre et l’aide de la carte' : 'Masquer le titre et l’aide de la carte')}
              title={t(mapIntroCollapsed ? 'Afficher le titre et l’aide de la carte' : 'Masquer le titre et l’aide de la carte')}
              aria-expanded={!mapIntroCollapsed}
              onClick={() => setMapIntroCollapsed((collapsed) => !collapsed)}
            >
              <span aria-hidden="true">{mapIntroCollapsed ? '⌄' : '⌃'}</span>
            </button>
          </div>

          <div className="exploration-map-frame">
            <WorldMap
              showBorders={showBorders}
              showTerritories={showTerritories}
              showLabels={showLabels}
              globeMode={globeMode}
              onToggleGlobeMode={onToggleGlobeMode}
              showFlagTerritories={showFlagTerritories}
              showResources={showResources}
              showRivers={showRivers}
              showMountains={showMountains}
              showSummits={showSummits}
              layerDensities={layerDensities}
              realLayer={realLayer}
              layerOrder={layerOrder}
              layerOpacities={layerOpacities}
              opacityMasks={opacityMasks}
              opacityMaskPlacement={pendingMaskDraft !== null}
              onOpacityMaskPlace={handlePlaceOpacityMask}
              perspectiveComparisonPortal={
                isFullscreen || mapIntroCollapsed || explorationPanelsCollapsed
                  ? null
                  : perspectiveComparisonPortal
              }
              focusEntityRequest={focusEntityRequest}
              onCompareCountries={onCompareCountries}
              onCountrySelected={handlePlaceSelected}
              onCountryDeselected={() => setSelectedPlace(null)}
            />
            <button
              className={`exploration-panel-toggle exploration-details-toggle${detailsCollapsed ? ' is-collapsed exploration-hover-reveal' : ''}`}
              type="button"
              aria-label={t(detailsCollapsed ? 'Afficher la fiche du territoire' : 'Masquer la fiche du territoire')}
              title={t(detailsCollapsed ? 'Afficher la fiche du territoire' : 'Masquer la fiche du territoire')}
              aria-expanded={!detailsCollapsed}
              onClick={() => setDetailsCollapsed((collapsed) => !collapsed)}
            >
              <span aria-hidden="true">{detailsCollapsed ? '›' : '‹'}</span>
            </button>
          </div>

          {!mapIntroCollapsed && (
            <div className="map-comparison-hint">
              {t('cmd + clic pour sélectionner des pays et les comparer')}
            </div>
          )}

          <div className={`exploration-layer-controls-region${layerControlsCollapsed ? ' is-collapsed' : ''}`}>
            <button
              className={`exploration-panel-toggle exploration-zone-collapse${layerControlsCollapsed ? ' exploration-hover-reveal' : ''}`}
              type="button"
              aria-label={t(layerControlsCollapsed ? 'Afficher les options cartographiques' : 'Masquer les options cartographiques')}
              title={t(layerControlsCollapsed ? 'Afficher les options cartographiques' : 'Masquer les options cartographiques')}
              aria-expanded={!layerControlsCollapsed}
              onClick={() => setLayerControlsCollapsed((collapsed) => !collapsed)}
            >
              <span aria-hidden="true">{layerControlsCollapsed ? '⌃' : '⌄'}</span>
            </button>
            {!layerControlsCollapsed && (
              skin === 'minimal' ? (
                <details
                  className="exploration-layer-controls minimal-layer-disclosure"
                  aria-label={t('Affichage de la carte')}
                >
                  <summary>{t('AFFICHAGE CARTOGRAPHIQUE')}</summary>
                  <div className="minimal-layer-options">{layerOptions}</div>
                </details>
              ) : (
                <div className="exploration-layer-controls" aria-label={t('Affichage de la carte')}>
                  <span className="settings-heading">{t('AFFICHAGE CARTOGRAPHIQUE')}</span>
                  {layerOptions}
                </div>
              )
            )}
          </div>
        </section>

        {!detailsCollapsed && (
          <aside
            className={`exploration-details-panel${selectedPlace ? ' has-selection' : ''}`}
            aria-live="polite"
          >
            <ExplorationPlaceDetails
              place={selectedPlace}
              showExtended
              onSelectTerritory={handleTerritorySelected}
            />
          </aside>
        )}
      </main>
    </div>
  )
}
