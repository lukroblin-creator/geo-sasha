import { lazy, Suspense } from 'react'
import type { ComponentProps, JSX } from 'react'

import { useLanguage } from '../data/i18n'

const WorldMap = lazy(() => import('./WorldMap'))

type WorldMapLoaderProps = ComponentProps<typeof WorldMap>

export default function WorldMapLoader(props: WorldMapLoaderProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <Suspense
      fallback={
        <div className="world-map-loading" role="status">
          {t('Chargement de la carte')}
        </div>
      }
    >
      <WorldMap {...props} />
    </Suspense>
  )
}
