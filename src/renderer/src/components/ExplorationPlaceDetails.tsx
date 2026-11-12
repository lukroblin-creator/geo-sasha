import { getFlagImageSource } from '../data/quiz/flagAssets'
import type { ExplorationDetails } from '../data/geography/exploration'
import { useLanguage } from '../data/i18n'

type ExplorationPlaceDetailsProps = {
  place: ExplorationDetails | null
  compact?: boolean
}

export function ExplorationPlaceDetails({
  place,
  compact = false
}: ExplorationPlaceDetailsProps): React.JSX.Element {
  const { t } = useLanguage()
  if (!place) {
    return (
      <div className="exploration-place-details exploration-empty-state">
        <span aria-hidden="true">⌖</span>
        <p>
          {t('Sélectionne un pays sur la carte pour découvrir son drapeau, sa capitale et son continent.')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`exploration-place-details${compact ? ' exploration-place-details-compact' : ''}`}
    >
      <div className="exploration-details-eyebrow">{t('FICHE GÉOGRAPHIQUE')}</div>
      <h2 className="exploration-place-name">{place.name}</h2>
      {place.isTerritory && place.sovereignName && (
        <p className="exploration-place-kind">{t('Territoire de')} {place.sovereignName}</p>
      )}

      {place.flagAlpha2 ? (
        <div className="exploration-flag-card">
          <img
            src={getFlagImageSource(place.flagAlpha2)}
            alt={`${t('Drapeau de')} ${place.flagName}`}
          />
          <span>{t('Drapeau de')} {place.flagName}</span>
        </div>
      ) : (
        <div className="exploration-missing-flag">{t('Drapeau non disponible')}</div>
      )}

      <dl className="exploration-facts">
        <div>
          <dt>{t('Capitale')}</dt>
          <dd>{place.capital ?? t('Non renseignée')}</dd>
        </div>
        <div>
          <dt>{t('Continent')}</dt>
          <dd>{place.continent ? t(place.continent) : t('Non renseigné')}</dd>
        </div>
      </dl>
    </div>
  )
}
