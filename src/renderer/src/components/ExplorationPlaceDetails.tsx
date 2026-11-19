import { getFlagImageSource } from '../data/quiz/flagAssets'
import { explorationEconomicSources, type ExplorationDetails } from '../data/geography/exploration'
import { useLanguage } from '../data/i18n'
import { ResourceIndustryDescription } from './ResourceIndustryDescription'

type ExplorationPlaceDetailsProps = {
  place: ExplorationDetails | null
  compact?: boolean
  showExtended?: boolean
  onSelectTerritory?: (entityId: string) => void
}

export function ExplorationPlaceDetails({
  place,
  compact = false,
  showExtended = false,
  onSelectTerritory
}: ExplorationPlaceDetailsProps): React.JSX.Element {
  const { t, language } = useLanguage()
  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      maximumFractionDigits: 3
    }).format(value)
  const formatDate = (value: string): string =>
    new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`))
  const formatMoney = (amount: number, currencyCode: string): string => {
    try {
      return new Intl.NumberFormat(
        language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
        { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }
      ).format(amount)
    } catch {
      return `${formatNumber(amount)} ${currencyCode}`
    }
  }
  const formatWholeNumber = (amount: number): string =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      maximumFractionDigits: 0
    }).format(amount)
  const formatEuroPerUnit = (amount: number): string =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumSignificantDigits: 4
    }).format(amount)
  const profileText = (value: { en: string; fr: string } | null | undefined): string =>
    value ? (language === 'fr' ? value.fr : value.en) : 'ND'
  const languageNames = new Intl.DisplayNames([language], { type: 'language' })
  const currencyNames = new Intl.DisplayNames([language], { type: 'currency' })
  const scriptNames = new Intl.DisplayNames([language], { type: 'script' })
  const displayLanguage = (code: string, fallback: string): string => {
    try {
      const name = languageNames.of(code)
      return name && name.toLowerCase() !== code.toLowerCase() ? name : fallback
    } catch {
      return fallback
    }
  }
  const displayCurrency = (code: string, fallback: string): string => {
    try {
      const name = currencyNames.of(code)
      return name && name.toLowerCase() !== code.toLowerCase() ? name : fallback
    } catch {
      return fallback
    }
  }
  const displayScript = (code: string): string => {
    try {
      const name = scriptNames.of(code)
      return name && name.toLowerCase() !== code.toLowerCase() ? name : code
    } catch {
      return code
    }
  }
  const displayCountryLanguage = (code: string, fallback: string): string =>
    code === 'tzm' ? t('Tamazight (Amazigh)') : displayLanguage(code, fallback)
  if (!place) {
    return (
      <div className="exploration-place-details exploration-empty-state">
        <span aria-hidden="true">⌖</span>
        <p>
          {t(
            'Sélectionne un pays sur la carte pour découvrir son drapeau, sa capitale et son continent.'
          )}
        </p>
      </div>
    )
  }
  const highestPoint = place.profileFacts?.highestPoint
  const highestPointName = profileText(highestPoint?.name)
  const listedMountains = place.mountains.filter(
    (mountain) => mountain.name.toLocaleLowerCase() !== highestPointName.toLocaleLowerCase()
  )

  return (
    <div
      className={`exploration-place-details${compact ? ' exploration-place-details-compact' : ''}`}
    >
      <div className="exploration-details-eyebrow">{t('FICHE GÉOGRAPHIQUE')}</div>
      <h2 className="exploration-place-name">{place.name}</h2>
      {place.isTerritory && place.sovereignName && (
        <p className="exploration-place-kind">
          {t('Territoire de')} {place.sovereignName}
        </p>
      )}

      {place.flagAlpha2 ? (
        <div className="exploration-flag-card">
          <img
            src={getFlagImageSource(place.flagAlpha2)}
            alt={`${t('Drapeau de')} ${place.flagName}`}
          />
          <span>
            {t('Drapeau de')} {place.flagName}
          </span>
        </div>
      ) : (
        <div className="exploration-missing-flag">ND</div>
      )}

      <dl className="exploration-facts">
        <div>
          <dt>{t('Capitale')}</dt>
          <dd>{place.capital ?? 'ND'}</dd>
        </div>
        <div>
          <dt>{t('Continent')}</dt>
          <dd>{place.continent ? t(place.continent) : 'ND'}</dd>
        </div>
      </dl>

      {showExtended && (
        <div className="exploration-extended-facts">
          {!place.isTerritory && place.territories.length > 0 && (
            <p className="exploration-fact-note">
              {t(
                'Les informations physiques et descriptives ci-dessous concernent le territoire principal. Les territoires éloignés disposent de leur propre fiche.'
              )}
            </p>
          )}
          <section className="exploration-fact-section">
            <h3>{t('Dimensions et population')}</h3>
            {place.metrics ? (
              <>
                {place.metricsScope && (
                  <p className="exploration-fact-note">{t(place.metricsScope)}</p>
                )}
                <dl className="exploration-facts">
                  <div>
                    <dt>{t('Superficie approximative')}</dt>
                    <dd>{formatNumber(place.metrics.areaKm2)} km²</dd>
                  </div>
                  <div>
                    <dt>{t('Périmètre approximatif')}</dt>
                    <dd>{formatNumber(place.metrics.perimeterKm)} km</dd>
                  </div>
                  <div>
                    <dt>{t('Étendue nord-sud')}</dt>
                    <dd>{formatNumber(place.metrics.northSouthKm)} km</dd>
                  </div>
                  <div>
                    <dt>{t('Étendue est-ouest')}</dt>
                    <dd>{formatNumber(place.metrics.eastWestKm)} km</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="exploration-unavailable">ND</p>
            )}
            <div className="exploration-population-fact">
              <span>{t('Population')}</span>
              <strong>
                {place.population === null
                  ? 'ND'
                  : `${formatNumber(place.population)}${place.populationYear ? ` · ${place.populationYear}` : ''}`}
              </strong>
            </div>
            {(place.population !== null || place.metrics !== null) && (
              <p className="exploration-fact-note">
                {[
                  place.population !== null ? t(place.populationSource) : null,
                  place.metrics
                    ? t(place.metricsSource ?? 'Contour géographique approximatif')
                    : null
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </section>

          {!place.isTerritory && place.territories.length > 0 && (
            <section className="exploration-fact-section">
              <h3>{t('Territoires associés')}</h3>
              <p className="exploration-fact-note">
                {t(
                  'Les dimensions décrivent le territoire principal. La population suit le périmètre de sa source.'
                )}
              </p>
              <ul className="exploration-territory-list">
                {place.territories.map((territory) => (
                  <li key={territory.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTerritory?.(territory.id)}
                      disabled={!onSelectTerritory}
                    >
                      {territory.flagAlpha2 && (
                        <img
                          src={getFlagImageSource(territory.flagAlpha2)}
                          alt=""
                          aria-hidden="true"
                        />
                      )}
                      <span>{territory.name}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="exploration-fact-section">
            <h3>{t('Langues, monnaie et écriture')}</h3>
            <dl className="exploration-facts exploration-culture-facts">
              <div>
                <dt>{t('Langues officielles')}</dt>
                <dd>
                  {place.culture?.officialLanguages.length
                    ? place.culture.officialLanguages
                        .map((item) => displayCountryLanguage(item.canonicalCode, item.name))
                        .join(', ')
                    : 'ND'}
                </dd>
              </div>
              {Boolean(place.culture?.regionalLanguages.length) && (
                <div>
                  <dt>{t('Langues régionales reconnues')}</dt>
                  <dd>
                    {place.culture?.regionalLanguages
                      .map((item) => displayCountryLanguage(item.canonicalCode, item.name))
                      .join(', ')}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t('Devise')}</dt>
                <dd>
                  {place.culture?.currencies.length
                    ? place.culture.currencies.map((currency) => (
                        <span className="exploration-culture-value" key={currency.code}>
                          {displayCurrency(currency.code, currency.name)} ({currency.code})
                          {currency.symbol ? ` · ${currency.symbol}` : ''}
                          <span className="exploration-fact-note">
                            {currency.euroPerUnit === null || currency.euroPerUnit === undefined
                              ? `${t('Conversion en euros')} : ND`
                              : `1 ${currency.code} = ${formatEuroPerUnit(currency.euroPerUnit)}`}
                            {currency.exchangeRateDate
                              ? ` · ${t('Cours au')} ${formatDate(currency.exchangeRateDate)}`
                              : ''}
                          </span>
                        </span>
                      ))
                    : 'ND'}
                </dd>
              </div>
              <div>
                <dt>{t('Salaire médian mensuel des salariés')}</dt>
                <dd>
                  {place.medianMonthlyEarnings ? (
                    <>
                      {formatWholeNumber(place.medianMonthlyEarnings.amount)}{' '}
                      {place.medianMonthlyEarnings.currencyCode} / {t('mois')}
                      {place.medianMonthlyEarnings.euroPerUnit !== null && (
                        <span className="exploration-culture-value">
                          ≈{' '}
                          {formatMoney(
                            place.medianMonthlyEarnings.amount *
                              place.medianMonthlyEarnings.euroPerUnit,
                            'EUR'
                          )}{' '}
                          / {t('mois')}
                        </span>
                      )}
                      <span className="exploration-fact-note">
                        {t('Dernière donnée disponible')} · {place.medianMonthlyEarnings.year}
                        {place.medianMonthlyEarnings.status === 'B'
                          ? ` · ${t('Rupture de série')}`
                          : ''}
                        {place.medianMonthlyEarnings.definition
                          ? ` · ${t(place.medianMonthlyEarnings.definition)}`
                          : ''}
                        {place.medianMonthlyEarnings.exchangeRateDate
                          ? ` · ${t('Cours au')} ${formatDate(place.medianMonthlyEarnings.exchangeRateDate)}`
                          : ''}
                        {' · '}
                        <a
                          href={
                            place.medianMonthlyEarnings.sourceUrl ??
                            explorationEconomicSources.medianEarnings
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {place.medianMonthlyEarnings.sourceName ?? 'ILOSTAT'}
                        </a>
                      </span>
                    </>
                  ) : (
                    'ND'
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('Extension web du pays')}</dt>
                <dd>
                  {place.culture?.webDomains.length
                    ? place.culture.webDomains.map((domain, index) => (
                        <span className="exploration-culture-value" key={`${domain}-${index}`}>
                          <bdi dir="ltr">{domain}</bdi>
                        </span>
                      ))
                    : 'ND'}
                </dd>
              </div>
            </dl>
            <p className="exploration-fact-note">
              {t('Les taux sont des références indicatives, pas des cours de transaction.')}{' '}
              <a href={explorationEconomicSources.currencyRates} target="_blank" rel="noreferrer">
                {t('Source des taux')}
              </a>
              {' · '}
              {t(
                'Les montants salariaux correspondent à la dernière médiane mensuelle publiée pour les salariés. La définition et l’année de référence varient selon la source ; la conversion en euros est indicative et ne reflète pas le pouvoir d’achat.'
              )}{' '}
              <a href={explorationEconomicSources.medianEarnings} target="_blank" rel="noreferrer">
                {t('Base internationale ILOSTAT')}
              </a>
            </p>
            <h4>{t('Alphabet et systèmes d’écriture')}</h4>
            {place.culture?.writingSystems.length ? (
              <div className="exploration-writing-systems">
                {place.culture.writingSystems.map((system) => (
                  <article className="exploration-writing-system" key={system.scriptCode}>
                    <h4>{displayScript(system.scriptCode)}</h4>
                    <div className="exploration-writing-label">{t('Caractères')}</div>
                    <p
                      className="exploration-writing-characters"
                      lang={system.exampleLanguageCode ?? undefined}
                      dir="auto"
                    >
                      {system.characters || 'ND'}
                    </p>
                    <div className="exploration-writing-label">
                      {t('Phrase exemple')}
                      {system.exampleLanguageCode
                        ? ` · ${displayLanguage(system.exampleLanguageCode, system.exampleLanguageCode)}`
                        : ''}
                    </div>
                    <p
                      className="exploration-writing-example"
                      lang={system.exampleLanguageCode ?? undefined}
                      dir="auto"
                    >
                      {system.example || 'ND'}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="exploration-unavailable">ND</p>
            )}
          </section>

          <section className="exploration-fact-section">
            <h3>{t('Ressources et industries')}</h3>
            <p className="exploration-fact-note">
              {t('Activités industrielles documentées pour ce territoire.')}
            </p>
            {place.resources.length > 0 ? (
              <div className="exploration-resource-list">
                {place.resources.map((industry) => (
                  <details className="exploration-resource-row" key={industry.id}>
                    <summary>
                      <span className="exploration-resource-icon" aria-hidden="true">
                        {industry.icon}
                      </span>
                      <span>{t(industry.label)}</span>
                      <span className="exploration-resource-chevron" aria-hidden="true">
                        ⌄
                      </span>
                    </summary>
                    <ResourceIndustryDescription industry={industry} />
                  </details>
                ))}
              </div>
            ) : (
              <p className="exploration-unavailable">ND</p>
            )}
          </section>

          <section className="exploration-fact-section">
            <h3>{t('Villes et reliefs')}</h3>
            <div>
              <h4>{t('Relief majeur et caractère du terrain')}</h4>
              {place.profileFacts?.terrainCharacter && (
                <strong>{profileText(place.profileFacts.terrainCharacter)}</strong>
              )}
              <p>{profileText(place.profileFacts?.terrain)}</p>
            </div>
            {place.cities.length > 0 ? (
              <div>
                <h4>{t('Grandes villes recensées')}</h4>
                <ul>
                  {place.cities.slice(0, 5).map((city) => (
                    <li key={city.name}>
                      {city.name}
                      {city.population > 0 && <span> · {formatNumber(city.population)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="exploration-unavailable">ND</p>
            )}
            {place.mountains.length > 0 || highestPoint ? (
              <div>
                <h4>{t('Sommets et reliefs majeurs recensés')}</h4>
                {highestPoint && (
                  <p>
                    <strong>{t('Point culminant')} :</strong> {highestPointName}
                    {highestPoint.elevationMeters !== null && (
                      <span> · {formatNumber(highestPoint.elevationMeters)} m</span>
                    )}
                  </p>
                )}
                {listedMountains.length > 0 && (
                  <ul>
                    {listedMountains.slice(0, 5).map((mountain) => (
                      <li key={mountain.name}>
                        {mountain.name}
                        {mountain.elevationMeters !== null && (
                          <span> · {formatNumber(mountain.elevationMeters)} m</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="exploration-fact-note">
                  {Math.max(
                    ...place.mountains.map((mountain) => mountain.elevationMeters ?? 0),
                    highestPoint?.elevationMeters ?? 0
                  ) >= 4000
                    ? t('Relief très montagneux selon les sommets recensés.')
                    : Math.max(
                          ...place.mountains.map((mountain) => mountain.elevationMeters ?? 0),
                          highestPoint?.elevationMeters ?? 0
                        ) >= 2000
                      ? t('Relief montagneux selon les sommets recensés.')
                      : highestPoint && place.mountains.length === 0
                        ? t(
                            'Point culminant indiqué; la fiche ne permet pas de caractériser tout le terrain.'
                          )
                        : t(
                            'Des reliefs sont recensés, mais la fiche ne permet pas de caractériser tout le terrain.'
                          )}
                </p>
              </div>
            ) : (
              <p className="exploration-unavailable">ND</p>
            )}
          </section>

          <section className="exploration-fact-section">
            <h3>{t('Autres informations')}</h3>
            <dl className="exploration-facts">
              <div>
                <dt>{t('Point le plus bas')}</dt>
                <dd>
                  {place.profileFacts?.lowestPoint
                    ? `${profileText(place.profileFacts.lowestPoint.name)}${place.profileFacts.lowestPoint.elevationMeters === null ? '' : ` · ${formatNumber(place.profileFacts.lowestPoint.elevationMeters)} m`}`
                    : 'ND'}
                </dd>
              </div>
              <div>
                <dt>{t('Fleuves majeurs')}</dt>
                <dd>
                  {place.profileFacts?.rivers.length
                    ? place.profileFacts.rivers.map((river) => profileText(river)).join(', ')
                    : 'ND'}
                </dd>
              </div>
              <div>
                <dt>{t('Régime politique')}</dt>
                <dd>
                  {place.profileFacts?.governmentType ? (
                    <>
                      {profileText(place.profileFacts.governmentType)}
                      {place.profileFacts.governmentTypeYear
                        ? ` · ${t('description gouvernementale')} ${place.profileFacts.governmentTypeYear}`
                        : ''}
                      {place.profileFacts.politicalRegime
                        ? ` · ${t('classification V-Dem')} ${place.profileFacts.politicalRegime.year} : ${language === 'fr' ? place.profileFacts.politicalRegime.label : place.profileFacts.politicalRegime.sourceLabel}`
                        : ''}
                    </>
                  ) : place.profileFacts?.politicalRegime ? (
                    `${language === 'fr' ? place.profileFacts.politicalRegime.label : place.profileFacts.politicalRegime.sourceLabel} · V-Dem ${place.profileFacts.politicalRegime.year}`
                  ) : (
                    'ND'
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('Style musical le plus écouté')}</dt>
                <dd>
                  {place.profileFacts?.music ? (
                    <>
                      {language === 'fr'
                        ? place.profileFacts.music.genreFr
                        : place.profileFacts.music.genre}
                      {' · '}
                      {t('rang')} {place.profileFacts.music.rank}
                      {place.profileFacts.music.measure === 'streaming-chart'
                        ? ` · ${place.profileFacts.music.sharePercent ?? 'ND'} % ${language === 'fr' ? 'des écoutes classées' : 'of chart streams'} · ${place.profileFacts.music.snapshotDate ? formatDate(place.profileFacts.music.snapshotDate) : place.profileFacts.music.year}`
                        : place.profileFacts.music.measure === 'apple-chart'
                          ? ` · ${language === 'fr' ? 'Top 100 Apple Music' : 'Apple Music Top 100'}${place.profileFacts.music.sharePercent !== null ? ` · ${place.profileFacts.music.sharePercent} % ${language === 'fr' ? 'des titres' : 'of chart entries'}` : ''} · ${place.profileFacts.music.snapshotDate ? formatDate(place.profileFacts.music.snapshotDate) : place.profileFacts.music.year}`
                          : ` · ${place.profileFacts.music.year}${place.profileFacts.music.sharePercent !== null ? ` · ${place.profileFacts.music.sharePercent} % ${t('des répondants')}` : ''}`}
                      {place.profileFacts.music.secondGenre
                        ? `; ${t('rang')} ${place.profileFacts.music.secondRank} : ${language === 'fr' ? place.profileFacts.music.secondGenreFr : place.profileFacts.music.secondGenre}${place.profileFacts.music.secondSharePercent !== null ? ` · ${place.profileFacts.music.secondSharePercent} %${place.profileFacts.music.measure === 'apple-chart' ? (language === 'fr' ? ' des titres' : ' of chart entries') : ''}` : ''}`
                        : ''}
                      {place.profileFacts.music.sourceNote && (
                        <p className="exploration-fact-note">
                          {profileText(place.profileFacts.music.sourceNote)}{' '}
                          {place.profileFacts.music.sourceUrl && (
                            <a
                              href={place.profileFacts.music.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {profileText(place.profileFacts.music.sourceLabel)}
                            </a>
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    'ND'
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('Anecdotes')}</dt>
                <dd>
                  {place.profileFacts?.funFacts.length ? (
                    <ul>
                      {place.profileFacts.funFacts.map((fact, index) => (
                        <li key={index}>{profileText(fact)}</li>
                      ))}
                    </ul>
                  ) : (
                    'ND'
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('Fait historique majeur')}</dt>
                <dd>{profileText(place.profileFacts?.historicalFact)}</dd>
              </div>
            </dl>
          </section>

          <section className="exploration-fact-section exploration-data-sources">
            <h3>{t('Sources et date des données')}</h3>
            <p className="exploration-fact-note">
              {t(
                'ND signifie que les sources intégrées ne fournissent pas de donnée exploitable pour ce champ. Les classifications politiques, enquêtes et classements musicaux sont datés.'
              )}
            </p>
            {place.profileFacts?.sourceUrl && (
              <p>
                <a href={place.profileFacts.sourceUrl} target="_blank" rel="noreferrer">
                  {t('Fiche source du CIA World Factbook')}
                </a>{' '}
                · {t('archive mise à jour le 22 janvier 2026')}
              </p>
            )}
            {place.profileFacts?.additionalSources?.map((source) => (
              <p key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {profileText(source.label)}
                </a>
              </p>
            ))}
            {place.populationSourceUrl && (
              <p>
                <a href={place.populationSourceUrl} target="_blank" rel="noreferrer">
                  {t(place.populationSource)}
                </a>
              </p>
            )}
            {place.metricsSourceUrl && (
              <p>
                <a href={place.metricsSourceUrl} target="_blank" rel="noreferrer">
                  {t('Source officielle des dimensions')}
                </a>
              </p>
            )}
            {place.metricsSecondarySourceUrl && (
              <p>
                <a href={place.metricsSecondarySourceUrl} target="_blank" rel="noreferrer">
                  {t('Source du périmètre')}
                </a>
              </p>
            )}
            <ul>
              <li>
                <a href="https://github.com/mledoze/countries" target="_blank" rel="noreferrer">
                  mledoze/countries · {t('langues officielles, devises et domaines nationaux')} ·
                  ODbL-1.0
                </a>
              </li>
              <li>
                <a href="https://github.com/unicode-org/cldr" target="_blank" rel="noreferrer">
                  Unicode CLDR · {t('langues reconnues et systèmes d’écriture')} · Unicode-3.0
                </a>
              </li>
              <li>
                <a
                  href="https://www.v-dem.net/data/the-v-dem-dataset/"
                  target="_blank"
                  rel="noreferrer"
                >
                  V-Dem · {t('classification politique 2025')}
                </a>
              </li>
              <li>
                <a
                  href="https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Natural Earth · {t('réseau hydrographique')}
                </a>
              </li>
              <li>
                <a
                  href="https://datacatalog.worldbank.org/search/dataset/0042032/major-rivers-of-the-world"
                  target="_blank"
                  rel="noreferrer"
                >
                  World Bank · {t('grands fleuves')}
                </a>
              </li>
              <li>
                <a
                  href="https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-geography-regions-elevation-points/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Natural Earth · {t('sommets et reliefs')}
                </a>
              </li>
              <li>
                <a
                  href="https://www.ifpi.org/wp-content/uploads/2022/11/Engaging-with-Music-2022_full-report.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  IFPI · {t('enquête musicale 2022')}
                </a>
              </li>
              <li>
                <a
                  href="https://www.ifpi.org/wp-content/uploads/2023/12/IFPI-Engaging-With-Music-2023_full-report.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  IFPI · {t('enquête musicale 2023')}
                </a>
              </li>
              <li>
                <a
                  href="https://rss.applemarketingtools.com/api/v2/us/music/most-played/100/songs.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  Apple ·{' '}
                  {language === 'fr'
                    ? 'flux officiel des chansons les plus écoutées'
                    : 'official most-played songs feed'}
                </a>
              </li>
              <li>
                <a href="https://spotify-top.com/genres" target="_blank" rel="noreferrer">
                  Spotify Top · {language === 'fr' ? 'répartition des genres' : 'genre breakdown'}
                </a>
              </li>
              <li>
                <a href="https://mostpops.com/lists/music-genres/" target="_blank" rel="noreferrer">
                  MostPops ·{' '}
                  {language === 'fr'
                    ? 'source secondaire Apple Top 100'
                    : 'secondary Apple Top 100 source'}
                </a>
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
