import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import {
  getKeyboardActivationFeature,
  getNextCountryFeature,
  getCountryFeatureIdentity
} from '../data/geography/countryHitTesting'
import {
  keyboardShortcutMatchesEvent,
  useHeldKeyboardShortcut,
  useKeyboardShortcuts
} from '../data/keyboardShortcuts'
import {
  getCountryFeatureAtPoint,
  getDirectionalCountryFeature,
  getSmallCountryFeaturesWithinCycleArea,
  isCountryFillFeature,
  type InteractiveCountryFeature
} from './worldMapCountrySelection'

export type HoveredCountry = {
  entityId: string | null
  sourceFeatureId: string | number
} | null

export type CountryClickHandlerRef = {
  current: (event: MapLayerMouseEvent) => void
}

type UseWorldMapCountrySelectionOptions = {
  map: MapLibreMap | null
  perspectiveCorrectionEnabled: boolean
  opacityMaskPlacement: boolean
  searchIsOpen: boolean
  searchQuery: string
  countryClickHandlerRef: CountryClickHandlerRef
  setHoveredCountry: Dispatch<SetStateAction<HoveredCountry>>
  onShiftKeyDown: (pointer: { x: number; y: number }) => void
  onShiftKeyUp: () => void
}

type WorldMapCountrySelectionController = {
  keyboardPreselectionFeatureRef: { current: InteractiveCountryFeature | null }
  keyboardSelectionActiveRef: { current: boolean }
  clearKeyboardPreselection: () => void
  handleCountryHover: (event: MapLayerMouseEvent) => void
  handleCountryLeave: () => void
}

export function useWorldMapCountrySelection({
  map,
  perspectiveCorrectionEnabled,
  opacityMaskPlacement,
  searchIsOpen,
  searchQuery,
  countryClickHandlerRef,
  setHoveredCountry,
  onShiftKeyDown,
  onShiftKeyUp
}: UseWorldMapCountrySelectionOptions): WorldMapCountrySelectionController {
  const { bindings, hasActiveBinding } = useKeyboardShortcuts()
  const [pointerIsOverMap, setPointerIsOverMap] = useState(false)
  const hoverPointerRef = useRef<{ x: number; y: number } | null>(null)
  const keyboardPreselectionRef = useRef<{
    entityId: string | null
    sourceFeatureId: string | number
  } | null>(null)
  const keyboardPreselectionFeatureRef = useRef<InteractiveCountryFeature | null>(null)
  const keyboardCycleCandidatesRef = useRef<InteractiveCountryFeature[] | null>(null)
  const keyboardSelectionActiveRef = useRef(false)

  const clearKeyboardPreselection = useCallback((): void => {
    keyboardSelectionActiveRef.current = false
    keyboardPreselectionRef.current = null
    keyboardPreselectionFeatureRef.current = null
    keyboardCycleCandidatesRef.current = null
  }, [])

  const activateMagnifier = useCallback(
    (event: KeyboardEvent): void => {
      if (perspectiveCorrectionEnabled || opacityMaskPlacement) return
      const pointer =
        hoverPointerRef.current ??
        (map?.getContainer().matches(':hover')
          ? { x: map.getCanvas().clientWidth / 2, y: map.getCanvas().clientHeight / 2 }
          : null)
      if (!pointer) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('dialog[open], [role="dialog"], .settings-menu-root')) return
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]') ||
        target?.matches('.map-search-input')
      ) {
        return
      }
      onShiftKeyDown(pointer)
    },
    [map, onShiftKeyDown, opacityMaskPlacement, perspectiveCorrectionEnabled]
  )
  useHeldKeyboardShortcut(
    'map.magnifier',
    activateMagnifier,
    onShiftKeyUp,
    Boolean(map && pointerIsOverMap && !perspectiveCorrectionEnabled && !opacityMaskPlacement)
  )
  const cycleNearbyTerritories = useCallback(
    (event: KeyboardEvent): void => {
      if (!map || perspectiveCorrectionEnabled || opacityMaskPlacement) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('dialog[open], [role="dialog"], .settings-menu-root')) return
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]') ||
        target?.matches('.map-search-input')
      ) {
        return
      }
      const pointer =
        hoverPointerRef.current ??
        (map.getContainer().matches(':hover')
          ? { x: map.getCanvas().clientWidth / 2, y: map.getCanvas().clientHeight / 2 }
          : null)
      if (!pointer) return

      const pointerFeature = getCountryFeatureAtPoint(map, pointer)
      const currentFeature = keyboardPreselectionFeatureRef.current ?? pointerFeature
      let candidates = keyboardCycleCandidatesRef.current
      if (!keyboardSelectionActiveRef.current || !candidates) {
        const uniqueFeatures = new Map<string, InteractiveCountryFeature>()
        for (const feature of [
          ...(currentFeature ? [currentFeature] : []),
          ...(currentFeature ? getSmallCountryFeaturesWithinCycleArea(currentFeature) : [])
        ]) {
          const identity = getCountryFeatureIdentity(feature)
          if (identity && !uniqueFeatures.has(identity)) uniqueFeatures.set(identity, feature)
        }
        candidates = [...uniqueFeatures.values()]
        keyboardCycleCandidatesRef.current = candidates
      }
      if (candidates.length < 2) return
      const nextFeature = getNextCountryFeature(
        candidates,
        currentFeature ? getCountryFeatureIdentity(currentFeature) : null
      )
      if (!nextFeature) return
      const sourceFeatureId = nextFeature.properties?.sourceId
      if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') return

      keyboardSelectionActiveRef.current = true
      keyboardPreselectionRef.current = {
        sourceFeatureId,
        entityId:
          typeof nextFeature.properties?.entityId === 'string'
            ? nextFeature.properties.entityId
            : null
      }
      keyboardPreselectionFeatureRef.current = nextFeature
      setHoveredCountry(keyboardPreselectionRef.current)
    },
    [map, opacityMaskPlacement, perspectiveCorrectionEnabled, setHoveredCountry]
  )
  const updateHoveredFeature = useCallback(
    (feature: InteractiveCountryFeature | undefined): void => {
      const sourceFeatureId = feature?.properties?.sourceId
      if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') {
        keyboardPreselectionRef.current = null
        keyboardPreselectionFeatureRef.current = null
        setHoveredCountry(null)
        return
      }

      const nextHoveredCountry = {
        entityId:
          typeof feature?.properties?.entityId === 'string' ? feature.properties.entityId : null,
        sourceFeatureId
      }
      keyboardPreselectionRef.current = nextHoveredCountry
      keyboardPreselectionFeatureRef.current = feature ?? null
      setHoveredCountry((current) =>
        current?.entityId === nextHoveredCountry.entityId &&
        current.sourceFeatureId === nextHoveredCountry.sourceFeatureId
          ? current
          : nextHoveredCountry
      )
    },
    [setHoveredCountry]
  )

  const handleCountryHover = useCallback(
    (event: MapLayerMouseEvent): void => {
      hoverPointerRef.current = { x: event.point.x, y: event.point.y }
      if (perspectiveCorrectionEnabled) {
        clearKeyboardPreselection()
        setHoveredCountry(null)
        return
      }
      if (keyboardSelectionActiveRef.current) return

      const feature = map
        ? getCountryFeatureAtPoint(map, event.point, event.features)
        : event.features?.find(isCountryFillFeature)
      updateHoveredFeature(feature)
    },
    [clearKeyboardPreselection, map, perspectiveCorrectionEnabled, setHoveredCountry, updateHoveredFeature]
  )

  const handleCountryLeave = useCallback((): void => {
    if (document.body?.classList.contains('map-magnifier-active')) return
    setPointerIsOverMap(false)
    hoverPointerRef.current = null
    clearKeyboardPreselection()
    setHoveredCountry(null)
  }, [clearKeyboardPreselection, setHoveredCountry])

  useEffect(() => {
    if (!map) return
    const mapContainer = map.getContainer()
    const handleMapPointerMove = (event: PointerEvent): void => {
      const bounds = mapContainer.getBoundingClientRect()
      const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      if (point.x < 0 || point.y < 0 || point.x > bounds.width || point.y > bounds.height) return
      setPointerIsOverMap(true)
      const previousPoint = hoverPointerRef.current
      const pointerMoved =
        previousPoint !== null &&
        Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) > 0.5
      if (keyboardSelectionActiveRef.current && pointerMoved) {
        // A keyboard cycle applies only while the pointer stays still. The
        // first real pointer movement returns control to ordinary hover.
        clearKeyboardPreselection()
        updateHoveredFeature(getCountryFeatureAtPoint(map, point))
      }
      hoverPointerRef.current = point
      if (!keyboardSelectionActiveRef.current) {
        keyboardPreselectionRef.current = null
        keyboardPreselectionFeatureRef.current = null
      }
    }
    if (mapContainer.matches(':hover')) setPointerIsOverMap(true)
    mapContainer.addEventListener('pointerenter', handleMapPointerMove)
    mapContainer.addEventListener('pointermove', handleMapPointerMove)
    mapContainer.addEventListener('pointerleave', handleCountryLeave)

    const handleCountryKeyboardNavigation = (event: KeyboardEvent): void => {
      if (perspectiveCorrectionEnabled || opacityMaskPlacement) return
      const pointer =
        hoverPointerRef.current ??
        (mapContainer.matches(':hover')
          ? { x: map.getCanvas().clientWidth / 2, y: map.getCanvas().clientHeight / 2 }
          : null)
      const isNearbyTerritoryShortcut = keyboardShortcutMatchesEvent(
        event,
        bindings['map.cycleNearbyTerritories']
      )
      if (isNearbyTerritoryShortcut && pointer) {
        const target = event.target instanceof Element ? event.target : null
        if (
          target?.closest('dialog[open], [role="dialog"], .settings-menu-root') ||
          target?.matches('input, textarea, select, [contenteditable="true"], .map-search-input')
        ) {
          return
        }
        event.preventDefault()
        event.stopImmediatePropagation()
        cycleNearbyTerritories(event)
        return
      }
      if (!pointer || event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('dialog[open], [role="dialog"], .settings-menu-root')) return
      if (hasActiveBinding(event)) return

      if (
        target?.closest('button, input, textarea, select, [contenteditable="true"]') &&
        !target.matches('.map-search-input')
      ) {
        return
      }

      if (event.key === 'Enter') {
        if (event.altKey || event.ctrlKey || event.shiftKey) return
        const isSubmittingSearch =
          target?.matches('.map-search-input') && searchIsOpen && searchQuery.trim().length > 0
        const preselectedFeature = keyboardPreselectionFeatureRef.current
        const activationFeature = getKeyboardActivationFeature(
          preselectedFeature,
          Boolean(isSubmittingSearch)
        )
        if (!activationFeature) return
        event.preventDefault()
        event.stopImmediatePropagation()
        keyboardSelectionActiveRef.current = true
        keyboardCycleCandidatesRef.current = null
        const syntheticClick = {
          point: { x: pointer.x, y: pointer.y },
          lngLat: map.unproject([pointer.x, pointer.y]),
          originalEvent: event,
          features: [activationFeature]
        } as unknown as MapLayerMouseEvent
        countryClickHandlerRef.current(syntheticClick)
        return
      }

      if (target?.matches('.map-search-input')) return

      if (
        !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      const pointerFeature = getCountryFeatureAtPoint(map, pointer)
      const pointerSourceId = pointerFeature?.properties?.sourceId
      const pointerCountry =
        typeof pointerSourceId === 'string' || typeof pointerSourceId === 'number'
          ? {
              sourceFeatureId: pointerSourceId,
              entityId:
                typeof pointerFeature?.properties?.entityId === 'string'
                  ? pointerFeature.properties.entityId
                  : null
            }
          : null
      const current = keyboardPreselectionRef.current ?? pointerCountry
      if (!current) return
      const nextFeature = getDirectionalCountryFeature(
        map,
        current.sourceFeatureId,
        current.entityId,
        event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
      )
      if (!nextFeature) return
      const sourceFeatureId = nextFeature.properties?.sourceId
      if (typeof sourceFeatureId !== 'string' && typeof sourceFeatureId !== 'number') return
      const nextCountry = {
        sourceFeatureId,
        entityId:
          typeof nextFeature.properties?.entityId === 'string'
            ? nextFeature.properties.entityId
            : null
      }
      keyboardCycleCandidatesRef.current = null
      keyboardSelectionActiveRef.current = true
      keyboardPreselectionRef.current = nextCountry
      keyboardPreselectionFeatureRef.current = nextFeature
      setHoveredCountry(nextCountry)
    }
    window.addEventListener('keydown', handleCountryKeyboardNavigation, true)
    return () => {
      mapContainer.removeEventListener('pointermove', handleMapPointerMove)
      mapContainer.removeEventListener('pointerenter', handleMapPointerMove)
      mapContainer.removeEventListener('pointerleave', handleCountryLeave)
      window.removeEventListener('keydown', handleCountryKeyboardNavigation, true)
    }
  }, [
    countryClickHandlerRef,
    clearKeyboardPreselection,
    bindings,
    cycleNearbyTerritories,
    handleCountryLeave,
    hasActiveBinding,
    map,
    opacityMaskPlacement,
    perspectiveCorrectionEnabled,
    searchIsOpen,
    searchQuery,
    updateHoveredFeature,
    setHoveredCountry
  ])

  return {
    keyboardPreselectionFeatureRef,
    keyboardSelectionActiveRef,
    clearKeyboardPreselection,
    handleCountryHover,
    handleCountryLeave
  }
}
