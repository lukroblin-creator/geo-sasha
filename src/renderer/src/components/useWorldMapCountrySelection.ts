import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import {
  getKeyboardActivationFeature,
  getNextCountryFeature
} from '../data/geography/countryHitTesting'
import { useKeyboardShortcuts } from '../data/keyboardShortcuts'
import { normalizeSourceFeatureId } from '../data/geography/sourceFeatureIds'
import {
  getCountryFeatureAtPoint,
  getDirectionalCountryFeature,
  getSmallCountryFeaturesAroundPoint,
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
  setHoveredCountry
}: UseWorldMapCountrySelectionOptions): WorldMapCountrySelectionController {
  const { hasActiveBinding } = useKeyboardShortcuts()
  const hoverPointerRef = useRef<{ x: number; y: number } | null>(null)
  const keyboardPreselectionRef = useRef<{
    entityId: string | null
    sourceFeatureId: string | number
  } | null>(null)
  const keyboardPreselectionFeatureRef = useRef<InteractiveCountryFeature | null>(null)
  const keyboardSelectionActiveRef = useRef(false)

  const clearKeyboardPreselection = useCallback((): void => {
    keyboardSelectionActiveRef.current = false
    keyboardPreselectionRef.current = null
    keyboardPreselectionFeatureRef.current = null
  }, [])

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

  const handleCountryHover = (event: MapLayerMouseEvent): void => {
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
  }

  const handleCountryLeave = useCallback((): void => {
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
    mapContainer.addEventListener('pointermove', handleMapPointerMove)
    mapContainer.addEventListener('pointerleave', handleCountryLeave)

    const handleCountryKeyboardNavigation = (event: KeyboardEvent): void => {
      if (perspectiveCorrectionEnabled || opacityMaskPlacement) return
      const pointer = hoverPointerRef.current
      if (!pointer || event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof Element ? event.target : null
      if (
        target?.closest('dialog[open], [role="dialog"], .settings-menu-root') ||
        (target?.closest('button, input, textarea, select, [contenteditable="true"]') &&
          !target.matches('.map-search-input')) ||
        hasActiveBinding(event)
      )
        return

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
        event.key === 'Shift' &&
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        // Keep Shift from entering MapLibre's box-zoom/focus behavior. This
        // interaction is handled whenever the pointer is over the map.
        event.preventDefault()
        event.stopImmediatePropagation()
        const candidates = getSmallCountryFeaturesAroundPoint(map, pointer, 20)
        if (candidates.length === 0) return
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
        const currentIdentity = current
          ? current.entityId
            ? `entity:${current.entityId}`
            : `source:${normalizeSourceFeatureId(current.sourceFeatureId)}`
          : null
        const nextFeature = getNextCountryFeature(candidates, currentIdentity)
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
        keyboardSelectionActiveRef.current = true
        keyboardPreselectionRef.current = nextCountry
        keyboardPreselectionFeatureRef.current = nextFeature
        setHoveredCountry(nextCountry)
        return
      }

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
      keyboardSelectionActiveRef.current = true
      keyboardPreselectionRef.current = nextCountry
      keyboardPreselectionFeatureRef.current = nextFeature
      setHoveredCountry(nextCountry)
    }
    window.addEventListener('keydown', handleCountryKeyboardNavigation, true)
    return () => {
      mapContainer.removeEventListener('pointermove', handleMapPointerMove)
      mapContainer.removeEventListener('pointerleave', handleCountryLeave)
      window.removeEventListener('keydown', handleCountryKeyboardNavigation, true)
    }
  }, [
    countryClickHandlerRef,
    clearKeyboardPreselection,
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
