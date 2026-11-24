import type { JSX } from 'react'

import { useLanguage } from '../data/i18n'
import type { CameraRotation } from './worldMapCamera'

type WorldMapCameraControlsProps = {
  allowCameraOrbit: boolean
  cameraOrbitMode: boolean
  cameraFreeMode: boolean
  cameraPanMode: boolean
  cameraControlsOpen: boolean
  cameraRotation: CameraRotation
  onToggleOrbit: () => void
  onToggleControls: () => void
  onTogglePanMode: () => void
  onResetAnchor: () => void
  onChangeAxis: (axis: keyof CameraRotation, value: number) => void
}

export function WorldMapCameraControls({
  allowCameraOrbit,
  cameraOrbitMode,
  cameraFreeMode,
  cameraPanMode,
  cameraControlsOpen,
  cameraRotation,
  onToggleOrbit,
  onToggleControls,
  onTogglePanMode,
  onResetAnchor,
  onChangeAxis
}: WorldMapCameraControlsProps): JSX.Element | null {
  const { t } = useLanguage()
  if (!allowCameraOrbit) return null

  return (
    <div className={`map-camera-controls${cameraOrbitMode ? ' is-active' : ''}`}>
      <button
        className={`map-control-button map-camera-mode-control${cameraOrbitMode ? ' is-active' : ''}${cameraFreeMode ? ' is-free-camera' : ''}`}
        type="button"
        data-shortcut-action="map.toggleCameraOrbit"
        title={t(cameraFreeMode ? 'Caméra libre : ancrage détaché' : 'Mode caméra')}
        aria-label={t(cameraFreeMode ? 'Caméra libre : ancrage détaché' : 'Mode caméra')}
        aria-pressed={cameraOrbitMode}
        onClick={onToggleOrbit}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6.5" />
          <path d="M3.5 12a8.5 8.5 0 0 1 16.4-3.2M20.5 12a8.5 8.5 0 0 1-16.4 3.2M17.5 5.2l2.4 3.6-4.2.5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      </button>
      <button
        className="map-control-button map-camera-menu-toggle"
        type="button"
        data-shortcut-action="map.toggleCameraControls"
        title={t(
          cameraControlsOpen ? 'Masquer les réglages caméra' : 'Afficher les réglages caméra'
        )}
        aria-label={t(
          cameraControlsOpen ? 'Masquer les réglages caméra' : 'Afficher les réglages caméra'
        )}
        aria-expanded={cameraControlsOpen}
        aria-controls="map-camera-adjustments"
        onClick={onToggleControls}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={cameraControlsOpen ? 'm6 14 6-6 6 6' : 'm6 10 6 6 6-6'} />
        </svg>
      </button>
      {cameraControlsOpen && (
        <div className="map-camera-adjustments" id="map-camera-adjustments">
          {cameraFreeMode && (
            <small className="map-camera-free-status">{t('Caméra libre : ancrage détaché')}</small>
          )}
          <button
            className={`map-camera-pan-tool${cameraPanMode ? ' is-active' : ''}`}
            type="button"
            data-shortcut-action={cameraPanMode ? 'map.selectionCursor' : 'map.panTool'}
            title={t(cameraPanMode ? 'Curseur du jeu (C)' : 'Déplacer la carte (D)')}
            aria-label={t(cameraPanMode ? 'Curseur du jeu (C)' : 'Déplacer la carte (D)')}
            aria-pressed={cameraPanMode}
            onClick={onTogglePanMode}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {cameraPanMode ? (
                <path d="M5 3v17l4.4-4.2 3 5.2 2.2-1.3-3-5.2H18L5 3Z" />
              ) : (
                <path d="M10 10 4 4m0 0h5M4 4v5m10 1 6-6m0 0h-5m5 0v5m-6 5 6 6m0 0v-5m0 5h-5m-5-6-6 6m0 0h5m-5 0v-5" />
              )}
            </svg>
            <span>{t(cameraPanMode ? 'Curseur du jeu' : 'Déplacer la carte')}</span>
          </button>
          {cameraOrbitMode && (
            <button
              className="map-camera-pan-tool map-camera-reset-anchor"
              type="button"
              data-shortcut-action="map.recenterCameraAnchor"
              title={t('Ramener le point d’ancrage au centre de la Terre')}
              aria-label={t('Ramener le point d’ancrage au centre de la Terre')}
              onClick={onResetAnchor}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 2v6m0 8v6M2 12h6m8 0h6M9 9l6 6m0-6-6 6" />
              </svg>
              <span>{t('Recentrer l’ancrage sur le globe')}</span>
            </button>
          )}
          <CameraAxisSlider
            label="Pitch"
            value={cameraRotation.pitch}
            min={0}
            max={180}
            icon={<path d="M5 17a9 9 0 0 1 14-10M5 17v-5m0 5h5" />}
            onChange={(value) => onChangeAxis('pitch', value)}
          />
          <CameraAxisSlider
            label="Yaw"
            value={cameraRotation.yaw}
            min={-180}
            max={180}
            icon={<path d="M4 12h16M12 4l8 8-8 8" />}
            onChange={(value) => onChangeAxis('yaw', value)}
          />
          <CameraAxisSlider
            label="Roll"
            value={cameraRotation.roll}
            min={-180}
            max={180}
            icon={<path d="M19 8a8 8 0 1 0 1 7M19 4v4h-4" />}
            onChange={(value) => onChangeAxis('roll', value)}
          />
          <small>
            {t(
              'Deux doigts : orbite · ⌘ défilement : zoom · ⌥ yaw · Ctrl pitch · ⇧ roll · ⌘⌥ / ⌘Ctrl / ⌘⇧ : caméra libre · D/C : déplacement/curseur'
            )}
          </small>
        </div>
      )}
    </div>
  )
}

type CameraAxisSliderProps = {
  label: 'Pitch' | 'Yaw' | 'Roll'
  value: number
  min: number
  max: number
  icon: JSX.Element
  onChange: (value: number) => void
}

function CameraAxisSlider({
  label,
  value,
  min,
  max,
  icon,
  onChange
}: CameraAxisSliderProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="map-camera-adjustment">
      <span className="map-camera-adjustment-heading">
        <span className="map-camera-adjustment-name">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {icon}
          </svg>
          {t(label)}
        </span>
        <output>{Math.round(value)}°</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={t(label)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
