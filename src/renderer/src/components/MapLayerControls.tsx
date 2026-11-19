import { useState } from 'react'
import { useLanguage } from '../data/i18n'

export type MapLayerControlItem = {
  id: string
  label: string
  enabled: boolean
  density: number
  maximum: number
  title?: string
  border?: boolean
  disabled?: boolean
  fixedCount?: number
  subLayer?: {
    id: string
    label: string
    enabled: boolean
    density: number
    maximum: number
  }
}

type MapLayerControlsProps = {
  layers: MapLayerControlItem[]
  onToggle: (id: string, enabled: boolean) => void
  onDensityChange: (id: string, density: number) => void
}

export function MapLayerControls({
  layers,
  onToggle,
  onDensityChange
}: MapLayerControlsProps): React.JSX.Element {
  const { t } = useLanguage()
  const [openLayerId, setOpenLayerId] = useState<string | null>(null)

  return (
    <div className="map-layer-controls-list">
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`map-layer-control${layer.enabled ? ' is-enabled' : ''}${layer.disabled ? ' is-disabled' : ''}`}
          title={layer.title ? t(layer.title) : undefined}
        >
          <label className="setting-item">
            <input
              type="checkbox"
              checked={layer.enabled}
              disabled={layer.disabled}
              aria-label={t(layer.label)}
              onChange={(event) => onToggle(layer.id, event.target.checked)}
            />
          </label>
          {layer.border ? (
            <span className="map-layer-control-label">{t(layer.label)}</span>
          ) : (
            <>
              <button
                className="map-layer-density-trigger"
                type="button"
                aria-expanded={openLayerId === layer.id}
                onClick={() =>
                  setOpenLayerId((current) => (current === layer.id ? null : layer.id))
                }
              >
                <span>{t(layer.label)}</span>
                <small>
                  {layer.fixedCount !== undefined
                    ? `${layer.fixedCount} ${t('chaînes')}`
                    : layer.enabled
                      ? `${layer.density} / ${layer.maximum}`
                      : t('Masquée')}
                </small>
                <span aria-hidden="true">{openLayerId === layer.id ? '⌃' : '⌄'}</span>
              </button>
              {openLayerId === layer.id && (
                <div className="map-layer-density-panel">
                  {layer.subLayer ? (
                    <>
                      <label className="map-layer-sublayer-toggle">
                        <input
                          type="checkbox"
                          checked={layer.subLayer.enabled}
                          aria-label={t(layer.subLayer.label)}
                          onChange={(event) => onToggle(layer.subLayer!.id, event.target.checked)}
                        />
                        <span>{t(layer.subLayer.label)}</span>
                        <strong>
                          {layer.subLayer.enabled
                            ? `${layer.subLayer.density} / ${layer.subLayer.maximum}`
                            : t('Masqués')}
                        </strong>
                      </label>
                      {layer.subLayer.enabled && (
                        <>
                          <label className="map-layer-density-subheading">
                            <span>{t('Sommets affichés')}</span>
                            <strong>
                              {layer.subLayer.density} / {layer.subLayer.maximum}
                            </strong>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(1, layer.subLayer.maximum)}
                            step={1}
                            value={layer.subLayer.density}
                            aria-label={`${t(layer.subLayer.label)} — ${t('Éléments affichés')}`}
                            onChange={(event) =>
                              onDensityChange(layer.subLayer!.id, Number(event.target.value))
                            }
                          />
                          <div className="map-layer-density-ends">
                            <span>{t('Aucun')}</span>
                            <span>{t('Tout')}</span>
                          </div>
                          <p>
                            {t('Le premier cran affiche uniquement l’élément le plus remarquable.')}
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <label>
                        <span>{t('Éléments affichés')}</span>
                        <strong>
                          {layer.density} / {layer.maximum}
                        </strong>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, layer.maximum)}
                        step={1}
                        value={layer.density}
                        aria-label={`${t(layer.label)} — ${t('Éléments affichés')}`}
                        onChange={(event) => onDensityChange(layer.id, Number(event.target.value))}
                      />
                      <div className="map-layer-density-ends">
                        <span>{t('Aucun')}</span>
                        <span>{t('Tout')}</span>
                      </div>
                      <p>
                        {t('Le premier cran affiche uniquement l’élément le plus remarquable.')}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
