import { useEffect, useRef, useState } from 'react'
import WorldMap from './WorldMapLoader'
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
import {
  fullMapLayerDensities,
  mapLayerDensityMaximums,
  type DensityLayerId,
  type MapLayerDensities
} from '../data/geography/mapLayerDensity'
import { mountainRanges } from '../data/geography/physical/mountainRanges'
import countryCatalog from '../data/quiz/countryCatalog.json'
import { getContinentIdForCountry, quizRegions } from '../data/quiz/countryContinents'
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

type SavedExplorationView = {
  id: string
  name: string
  createdAt: string
  showBorders: boolean
  showTerritories: boolean
  showLabels: boolean
  showFlagTerritories: boolean
  showResources: boolean
  showRivers: boolean
  showMountains: boolean
  showSummits: boolean
  layerDensities: MapLayerDensities
  realLayer: 'day' | 'night' | 'clouds' | null
  realLayerVariant: 'day' | 'night' | 'clouds'
  globeMode: boolean
  showTopography: boolean
  layerOrder: MapLayerStackId[]
  layerOpacities: MapLayerOpacityValues
  opacityMasks: MapOpacityMask[]
  comparedCountries: string[]
  selectedPlace: { sourceFeatureId: string | number; name: string; entityId: string | null } | null
  camera: {
    longitude: number
    latitude: number
    zoom: number
    bearing: number
    pitch: number
    roll: number
    orbitMode: boolean
    freeMode: boolean
  }
}

const SAVED_EXPLORATION_VIEWS_KEY = 'world-atlas:exploration-views:v1'

function placeMasksAboveTargets(
  order: MapLayerStackId[],
  masks: MapOpacityMask[]
): MapLayerStackId[] {
  const masksByTarget = new Map<ManagedMapLayerId, MapLayerStackId[]>()
  const knownMaskIds = new Set(masks.map((mask) => `mask:${mask.id}`))
  for (const mask of masks) {
    const target = mask.targetLayerId === undefined ? 'texture' : mask.targetLayerId
    if (target === null) continue
    const targetMasks = masksByTarget.get(target) ?? []
    targetMasks.push(`mask:${mask.id}`)
    masksByTarget.set(target, targetMasks)
  }

  const normalized: MapLayerStackId[] = []
  for (const id of order) {
    if (id.startsWith('mask:')) continue
    const targetMasks = masksByTarget.get(id as ManagedMapLayerId)
    if (targetMasks) normalized.push(...targetMasks)
    normalized.push(id)
  }

  const placedMaskIds = new Set(normalized.filter((id) => id.startsWith('mask:')))
  const unplacedMasks = masks
    .map((mask) => `mask:${mask.id}` as const)
    .filter((id) => !placedMaskIds.has(id))
  const unknownMasks = order.filter((id) => id.startsWith('mask:') && !knownMaskIds.has(id))
  return [...unknownMasks, ...unplacedMasks, ...normalized]
}

function readSavedExplorationViews(): SavedExplorationView[] {
  try {
    const raw = localStorage.getItem(SAVED_EXPLORATION_VIEWS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is SavedExplorationView =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SavedExplorationView).id === 'string' &&
        typeof (entry as SavedExplorationView).name === 'string' &&
        typeof (entry as SavedExplorationView).camera?.longitude === 'number' &&
        Array.isArray((entry as SavedExplorationView).layerOrder)
    )
  } catch {
    return []
  }
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
  const { t, language } = useLanguage()
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
  const [perspectiveComparisonPortal, setPerspectiveComparisonPortal] =
    useState<HTMLDivElement | null>(null)
  const [layerDensities, setLayerDensities] = useState<MapLayerDensities>(fullMapLayerDensities)
  const [realLayer, setRealLayer] = useState<'day' | 'night' | 'clouds' | null>(null)
  const [realLayerVariant, setRealLayerVariant] = useState<'day' | 'night' | 'clouds'>('day')
  const [showTopography, setShowTopography] = useState(false)
  const [layerOrder, setLayerOrder] = useState<MapLayerStackId[]>(defaultMapLayerOrder)
  const [layerOpacities, setLayerOpacities] =
    useState<MapLayerOpacityValues>(defaultMapLayerOpacities)
  const [opacityMasks, setOpacityMasks] = useState<MapOpacityMask[]>([])
  const [pendingMaskDraft, setPendingMaskDraft] = useState<MapOpacityMaskDraft | null>(null)
  const [editingMaskId, setEditingMaskId] = useState<string | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<ExplorationDetails | null>(null)
  const [selectedPlaceIdentity, setSelectedPlaceIdentity] =
    useState<SavedExplorationView['selectedPlace']>(null)
  const [savedViews, setSavedViews] = useState<SavedExplorationView[]>(readSavedExplorationViews)
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('')
  const [savedViewName, setSavedViewName] = useState('')
  const [savedViewMessage, setSavedViewMessage] = useState('')
  const [comparedCountries, setComparedCountries] = useState<string[]>([])

  useEffect(() => {
    if (!pendingMaskDraft) return
    const cancelPlacement = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPendingMaskDraft(null)
    }
    window.addEventListener('keydown', cancelPlacement)
    return () => window.removeEventListener('keydown', cancelPlacement)
  }, [pendingMaskDraft])
  const [cameraView, setCameraView] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 1.5,
    bearing: 0,
    pitch: 0,
    roll: 0,
    orbitMode: false,
    freeMode: false
  })
  const [cameraViewRequest, setCameraViewRequest] = useState<
    (typeof cameraView & { sequence: number }) | null
  >(null)
  const explorationPanelsCollapsed = chromeCollapsed && layerControlsCollapsed && detailsCollapsed
  const [focusEntityRequest, setFocusEntityRequest] = useState<{
    entityId: string
    sequence: number
  } | null>(null)
  const focusSequenceRef = useRef(0)
  const cameraViewSequenceRef = useRef(0)

  const persistSavedViews = (nextViews: SavedExplorationView[], successMessage: string): void => {
    setSavedViews(nextViews)
    try {
      localStorage.setItem(SAVED_EXPLORATION_VIEWS_KEY, JSON.stringify(nextViews))
      setSavedViewMessage(successMessage)
    } catch {
      setSavedViewMessage(t('Impossible d’enregistrer cette vue sur cet appareil.'))
    }
  }

  const saveCurrentView = (): void => {
    const name = savedViewName.trim() || `${t('Vue')} ${new Date().toLocaleDateString()}`
    const view: SavedExplorationView = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `view-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      showBorders,
      showTerritories,
      showLabels,
      showFlagTerritories,
      showResources,
      showRivers,
      showMountains,
      showSummits,
      layerDensities,
      realLayer,
      realLayerVariant,
      globeMode,
      showTopography,
      layerOrder,
      layerOpacities,
      opacityMasks,
      comparedCountries,
      selectedPlace: selectedPlaceIdentity,
      camera: cameraView
    }
    const nextViews = [view, ...savedViews]
    persistSavedViews(nextViews, t('Vue enregistrée.'))
    setSavedViewName('')
    setSelectedSavedViewId(view.id)
  }

  const loadSavedView = (): void => {
    const view = savedViews.find((item) => item.id === selectedSavedViewId)
    if (!view) return
    setShowBorders(view.showBorders)
    setShowTerritories(view.showTerritories)
    setShowLabels(view.showLabels)
    setShowFlagTerritories(view.showFlagTerritories)
    setShowResources(view.showResources)
    setShowRivers(view.showRivers)
    setShowMountains(view.showMountains)
    setShowSummits(view.showSummits)
    setLayerDensities({ ...fullMapLayerDensities, ...view.layerDensities })
    setRealLayer(view.realLayer)
    setRealLayerVariant(view.realLayerVariant)
    if (globeMode !== view.globeMode) onToggleGlobeMode()
    setShowTopography(view.showTopography)
    setLayerOpacities({ ...defaultMapLayerOpacities, ...view.layerOpacities })
    const savedMasks = (view.opacityMasks ?? []).map((mask) => ({
      ...mask,
      targetLayerId: mask.targetLayerId === undefined ? 'texture' : mask.targetLayerId
    }))
    setOpacityMasks(savedMasks)
    setLayerOrder(placeMasksAboveTargets(view.layerOrder, savedMasks))
    setComparedCountries(view.comparedCountries ?? [])
    const savedPlace = view.selectedPlace
    setSelectedPlaceIdentity(savedPlace ?? null)
    setSelectedPlace(
      savedPlace
        ? savedPlace.entityId
          ? (getExplorationDetailsForTerritory(savedPlace.entityId) ??
            getExplorationDetails(savedPlace.sourceFeatureId, savedPlace.name, savedPlace.entityId))
          : getExplorationDetails(savedPlace.sourceFeatureId, savedPlace.name, null)
        : null
    )
    setCameraView(view.camera)
    cameraViewSequenceRef.current += 1
    setCameraViewRequest({ ...view.camera, sequence: cameraViewSequenceRef.current })
    setSavedViewMessage(`${t('Vue chargée')} : ${view.name}`)
  }

  const deleteSavedView = (): void => {
    if (!selectedSavedViewId) return
    const nextViews = savedViews.filter((view) => view.id !== selectedSavedViewId)
    setSelectedSavedViewId('')
    persistSavedViews(nextViews, t('Vue supprimée.'))
  }

  const handlePlaceSelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): void => {
    setSelectedPlaceIdentity({ sourceFeatureId, name, entityId })
    setSelectedPlace(getExplorationDetails(sourceFeatureId, name, entityId))
  }

  const handleTerritorySelected = (entityId: string): void => {
    const details = getExplorationDetailsForTerritory(entityId)
    if (!details) return

    setSelectedPlaceIdentity({ sourceFeatureId: entityId, name: details.name, entityId })
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
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `mask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const mask: MapOpacityMask = {
      ...draft,
      targetLayerId: draft.targetLayerId === undefined ? 'texture' : draft.targetLayerId,
      id,
      ...(center ? { center } : {})
    }
    const nextMasks = [...opacityMasks, mask]
    setOpacityMasks(nextMasks)
    setLayerOrder((current) => placeMasksAboveTargets(current, nextMasks))
    if (center) setEditingMaskId(id)
  }

  const handleCreateOpacityMask = (draft: MapOpacityMaskDraft): void => {
    setPendingMaskDraft(draft)
    setEditingMaskId(null)
  }

  const handlePlaceOpacityMask = (
    position: [number, number],
    sourceFeatureId?: string | number,
    multiSelection = false
  ): void => {
    if (!pendingMaskDraft) return
    let draft = pendingMaskDraft
    if (draft.kind === 'country' || draft.kind === 'continent') {
      if (sourceFeatureId === undefined) return
      const selectedCountry = countryCatalog.find(
        (country) => String(country.sourceFeatureId) === String(sourceFeatureId)
      )
      if (!selectedCountry) return
      if (draft.kind === 'country') {
        const currentIds =
          draft.sourceFeatureIds ??
          (draft.sourceFeatureId !== undefined ? [draft.sourceFeatureId] : [])
        const alreadySelected = currentIds.some((id) => String(id) === String(sourceFeatureId))
        const sourceFeatureIds = multiSelection
          ? alreadySelected
            ? currentIds.filter((id) => String(id) !== String(sourceFeatureId))
            : [...currentIds, sourceFeatureId]
          : [sourceFeatureId]
        const displayNames = new Intl.DisplayNames([language], { type: 'region' })
        const names = sourceFeatureIds.flatMap((id) => {
          const country = countryCatalog.find((item) => String(item.sourceFeatureId) === String(id))
          if (!country) return []
          return [displayNames.of(country.alpha2) ?? country.countryName]
        })
        draft = {
          ...draft,
          sourceFeatureId: undefined,
          sourceFeatureIds,
          name:
            names.length === 1
              ? `${t('Territoires')}: ${names[0]}`
              : `${t('Territoires')} (${names.length})`
        }
      } else {
        const continent = getContinentIdForCountry(selectedCountry.alpha2)
        if (!continent) return
        const currentContinents = draft.continents ?? (draft.continent ? [draft.continent] : [])
        const alreadySelected = currentContinents.includes(continent)
        const continents = multiSelection
          ? alreadySelected
            ? currentContinents.filter((item) => item !== continent)
            : [...currentContinents, continent]
          : [continent]
        const names = continents.flatMap((id) => {
          const region = quizRegions.find((item) => item.id === id)
          return region ? [t(region.label)] : []
        })
        draft = {
          ...draft,
          continent: undefined,
          continents,
          name:
            names.length === 1
              ? `${t('Continents')}: ${names[0]}`
              : `${t('Continents')} (${names.length})`
        }
      }
      if (multiSelection) {
        setPendingMaskDraft(draft)
        return
      }
      addOpacityMask(draft)
    } else {
      addOpacityMask(draft, position)
    }
    setPendingMaskDraft(null)
  }

  const handleConfirmOpacityMaskSelection = (): void => {
    if (!pendingMaskDraft) return
    if (
      pendingMaskDraft.kind === 'country' &&
      !(
        pendingMaskDraft.sourceFeatureIds?.length ??
        Number(pendingMaskDraft.sourceFeatureId !== undefined)
      )
    )
      return
    if (
      pendingMaskDraft.kind === 'continent' &&
      !(pendingMaskDraft.continents?.length ?? Number(pendingMaskDraft.continent !== undefined))
    )
      return
    addOpacityMask(pendingMaskDraft)
    setPendingMaskDraft(null)
  }

  const cancelOpacityMaskPlacement = (): void => {
    setPendingMaskDraft(null)
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
    if (id === 'topography') {
      setShowTopography(enabled)
      return
    }
    toggleLayer(id, enabled)
  }

  const managerLayers: MapLayerManagerItem[] = [
    {
      id: 'territories',
      label: 'Territoires',
      description: 'Fond neutre',
      enabled: showTerritories,
      opacity: layerOpacities.territories
    },
    {
      id: 'topography',
      label: 'Topographie',
      description: 'Relief ombré et couleurs d’altitude (Natural Earth, échelle 1:50m)',
      enabled: showTopography,
      opacity: layerOpacities.topography
    },
    {
      id: 'texture',
      label: 'Imagerie satellite',
      description: 'Jour, Nuit ou Nuages — couche indépendante de la topographie',
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

  const managerOrder = layerOrder.filter(
    (id) =>
      id === 'texture' || id === 'topography' || id === 'territories' || id.startsWith('mask:')
  )

  const updateManagerOrder = (nextManagerOrder: MapLayerStackId[]): void => {
    setLayerOrder((current) => {
      const isManaged = (id: MapLayerStackId): boolean =>
        id === 'texture' || id === 'topography' || id === 'territories' || id.startsWith('mask:')
      const firstManagedIndex = current.findIndex(isManaged)
      const preservedBefore = current.slice(0, firstManagedIndex).filter((id) => !isManaged(id))
      const preservedAfter = current.slice(firstManagedIndex).filter((id) => !isManaged(id))
      return [
        ...preservedBefore,
        ...placeMasksAboveTargets(nextManagerOrder, opacityMasks),
        ...preservedAfter
      ]
    })
  }

  const updateOpacityMask = (id: string, patch: Partial<MapOpacityMask>): void => {
    const nextMasks = opacityMasks.map((mask) => (mask.id === id ? { ...mask, ...patch } : mask))
    setOpacityMasks(nextMasks)
    if (patch.targetLayerId !== undefined) {
      setLayerOrder((current) => placeMasksAboveTargets(current, nextMasks))
    }
  }

  const layerOptions = (
    <>
      <MapLayerControls
        layers={[
          {
            id: 'borders',
            label: 'Frontières',
            enabled: showBorders,
            density: 0,
            maximum: 0,
            border: true
          },
          {
            id: 'labels',
            label: 'Noms des pays',
            enabled: showLabels,
            density: layerDensities.labels,
            maximum: mapLayerDensityMaximums.labels
          },
          {
            id: 'rivers',
            label: 'Fleuves',
            enabled: showRivers,
            density: layerDensities.rivers,
            maximum: mapLayerDensityMaximums.rivers,
            title: 'Afficher les principaux fleuves documentés'
          },
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
          {
            id: 'flags',
            label: 'Drapeaux',
            enabled: showFlagTerritories,
            density: layerDensities.flags,
            maximum: mapLayerDensityMaximums.flags,
            title: 'Intégrer le drapeau dans le contour des pays et territoires'
          },
          {
            id: 'resources',
            label: 'Ressources',
            enabled: showResources,
            density: layerDensities.resources,
            maximum: mapLayerDensityMaximums.resources,
            title: 'Afficher les principales industries documentées de chaque territoire'
          }
        ]}
        onToggle={toggleLayer}
        onDensityChange={changeLayerDensity}
      />
      <MapLayerManager
        layers={managerLayers}
        masks={opacityMasks}
        order={managerOrder}
        isPlacingMask={pendingMaskDraft !== null}
        editingMaskId={editingMaskId}
        onToggleLayer={handleLayerManagerToggle}
        onLayerOpacityChange={(id, opacity) =>
          setLayerOpacities((current) => ({ ...current, [id]: opacity }))
        }
        onLayerDensityChange={changeLayerDensity}
        onSelectLayerVariant={(id, variantId) => {
          if (id !== 'texture' || !['day', 'night', 'clouds'].includes(variantId)) return
          const nextVariant = variantId as 'day' | 'night' | 'clouds'
          setRealLayerVariant(nextVariant)
          setRealLayer(nextVariant)
        }}
        onOrderChange={updateManagerOrder}
        onCreateMask={handleCreateOpacityMask}
        onAddMask={addOpacityMask}
        onCancelMaskPlacement={cancelOpacityMaskPlacement}
        onEditMask={setEditingMaskId}
        onUpdateMask={updateOpacityMask}
        onDeleteMask={(id) => {
          setOpacityMasks((current) => current.filter((mask) => mask.id !== id))
          setLayerOrder((current) => current.filter((item) => item !== `mask:${id}`))
          setEditingMaskId((current) => (current === id ? null : current))
        }}
      />
    </>
  )

  return (
    <div
      className={`exploration-screen${isFullscreen ? ' map-fullscreen-screen exploration-map-fullscreen' : ''}`}
    >
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
              <div className="exploration-saved-views">
                <div className="exploration-saved-views-actions">
                  <input
                    value={savedViewName}
                    onChange={(event) => setSavedViewName(event.target.value)}
                    placeholder={t('Nom de la vue')}
                    aria-label={t('Nom de la vue à enregistrer')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveCurrentView()
                    }}
                  />
                  <button
                    type="button"
                    onClick={saveCurrentView}
                    title={t('Enregistrer les calques, masques et la vue caméra')}
                  >
                    {t('Enregistrer la vue')}
                  </button>
                  {savedViews.length > 0 && (
                    <>
                      <select
                        value={selectedSavedViewId}
                        onChange={(event) => setSelectedSavedViewId(event.target.value)}
                        aria-label={t('Vues enregistrées')}
                      >
                        <option value="">{t('Vues enregistrées')}</option>
                        {savedViews.map((view) => (
                          <option key={view.id} value={view.id}>
                            {view.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" disabled={!selectedSavedViewId} onClick={loadSavedView}>
                        {t('Charger')}
                      </button>
                      <button
                        type="button"
                        className="exploration-saved-view-delete"
                        disabled={!selectedSavedViewId}
                        onClick={deleteSavedView}
                        aria-label={t('Supprimer la vue sélectionnée')}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
                {savedViewMessage && (
                  <span className="exploration-saved-view-status" role="status">
                    {savedViewMessage}
                  </span>
                )}
              </div>
            )}
            {!mapIntroCollapsed && (
              <details className="exploration-map-help">
                <summary>{t('Commandes caméra')}</summary>
                <div>
                  <span>{t('Glisser à deux doigts : tourner autour du globe')}</span>
                  <span>{t('⌘ + défilement : zoom')}</span>
                  <span>
                    {t(
                      '⌥ + défilement : lacet · Ctrl + défilement : inclinaison · ⇧ + défilement : roulis'
                    )}
                  </span>
                  <span>
                    {t(
                      '⌘⇧ + défilement : déplacer la carte · D : déplacer · C : curseur de sélection'
                    )}
                  </span>
                </div>
              </details>
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
              aria-label={t(
                mapIntroCollapsed
                  ? 'Afficher le titre et l’aide de la carte'
                  : 'Masquer le titre et l’aide de la carte'
              )}
              title={t(
                mapIntroCollapsed
                  ? 'Afficher le titre et l’aide de la carte'
                  : 'Masquer le titre et l’aide de la carte'
              )}
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
              allowCameraOrbit
              showFlagTerritories={showFlagTerritories}
              showResources={showResources}
              showRivers={showRivers}
              showMountains={showMountains}
              showSummits={showSummits}
              layerDensities={layerDensities}
              realLayer={realLayer}
              showTopography={showTopography}
              layerOrder={layerOrder}
              layerOpacities={layerOpacities}
              opacityMasks={opacityMasks}
              editingOpacityMaskId={editingMaskId}
              onOpacityMaskGeometryChange={(id, patch) => updateOpacityMask(id, patch)}
              initialComparisonAlpha2s={comparedCountries}
              onComparisonSelectionChange={(alpha2s) => {
                setComparedCountries((current) =>
                  current.length === alpha2s.length &&
                  current.every((value, index) => value === alpha2s[index])
                    ? current
                    : alpha2s
                )
              }}
              cameraViewRequest={cameraViewRequest}
              onCameraViewChange={setCameraView}
              opacityMaskPlacement={pendingMaskDraft !== null}
              opacityMaskPlacementKind={pendingMaskDraft?.kind ?? null}
              opacityMaskPlacementDraft={pendingMaskDraft}
              onOpacityMaskPlace={handlePlaceOpacityMask}
              onOpacityMaskSelectionConfirm={handleConfirmOpacityMaskSelection}
              perspectiveComparisonPortal={
                isFullscreen || mapIntroCollapsed || explorationPanelsCollapsed
                  ? null
                  : perspectiveComparisonPortal
              }
              focusEntityRequest={focusEntityRequest}
              onCompareCountries={onCompareCountries}
              onCountrySelected={handlePlaceSelected}
              onCountryDeselected={() => {
                setSelectedPlace(null)
                setSelectedPlaceIdentity(null)
              }}
            />
            <button
              className={`exploration-panel-toggle exploration-details-toggle${detailsCollapsed ? ' is-collapsed exploration-hover-reveal' : ''}`}
              type="button"
              aria-label={t(
                detailsCollapsed
                  ? 'Afficher la fiche du territoire'
                  : 'Masquer la fiche du territoire'
              )}
              title={t(
                detailsCollapsed
                  ? 'Afficher la fiche du territoire'
                  : 'Masquer la fiche du territoire'
              )}
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

          <div
            className={`exploration-layer-controls-region${layerControlsCollapsed ? ' is-collapsed' : ''}`}
          >
            <button
              className={`exploration-panel-toggle exploration-zone-collapse${layerControlsCollapsed ? ' exploration-hover-reveal' : ''}`}
              type="button"
              aria-label={t(
                layerControlsCollapsed
                  ? 'Afficher les options cartographiques'
                  : 'Masquer les options cartographiques'
              )}
              title={t(
                layerControlsCollapsed
                  ? 'Afficher les options cartographiques'
                  : 'Masquer les options cartographiques'
              )}
              aria-expanded={!layerControlsCollapsed}
              onClick={() => setLayerControlsCollapsed((collapsed) => !collapsed)}
            >
              <span aria-hidden="true">{layerControlsCollapsed ? '⌃' : '⌄'}</span>
            </button>
            {!layerControlsCollapsed &&
              (skin === 'minimal' ? (
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
              ))}
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
