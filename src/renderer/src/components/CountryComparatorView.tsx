import { useMemo, useState } from 'react'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'
import { useLanguage } from '../data/i18n'
import { getFlagImageSource } from '../data/quiz/flagAssets'
import countryCatalog from '../data/quiz/countryCatalog.json'
import countryExplorationData from '../data/quiz/countryExplorationData.json'
import { getContinentLabelForCountry } from '../data/quiz/countryContinents'
import { getResourceIndustryFactsForMapFeature, type ResourceIndustryFact } from '../data/geography/resources'

type CountryRecord = (typeof countryExplorationData.countries)[number]

type CompareCountry = {
  alpha2: string
  name: string
  capital: string | null
  continent: string
  population: number | null
  populationYear: number | null
  metrics: NonNullable<CountryRecord['metrics']> | null
  cities: CountryRecord['cities']
  mountains: CountryRecord['mountains']
  resources: ResourceIndustryFact[]
}

type CompareFieldId =
  | 'capital'
  | 'continent'
  | 'area'
  | 'perimeter'
  | 'northSouth'
  | 'eastWest'
  | 'population'
  | 'cities'
  | 'mountains'
  | 'resources'

const compareFields: { id: CompareFieldId; label: string; numeric?: boolean }[] = [
  { id: 'capital', label: 'Capitale' },
  { id: 'continent', label: 'Continent' },
  { id: 'area', label: 'Superficie', numeric: true },
  { id: 'perimeter', label: 'Périmètre', numeric: true },
  { id: 'northSouth', label: 'Étendue nord-sud', numeric: true },
  { id: 'eastWest', label: 'Étendue est-ouest', numeric: true },
  { id: 'population', label: 'Population', numeric: true },
  { id: 'cities', label: 'Grandes villes' },
  { id: 'mountains', label: 'Reliefs majeurs' },
  { id: 'resources', label: 'Ressources et industries' }
]

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

export function CountryComparatorView({
  onModeChange,
  onOpenStatistics,
  initialAlpha2 = []
}: {
  onModeChange: (mode: AppPrimaryMode) => void
  onOpenStatistics: () => void
  initialAlpha2?: string[]
}): React.JSX.Element {
  const { language, t } = useLanguage()
  const availableAlpha2 = new Set(countryCatalog.map((country) => country.alpha2))
  const [selectedAlpha2, setSelectedAlpha2] = useState<string[]>(() =>
    [...new Set(initialAlpha2.map((alpha2) => alpha2.toUpperCase()))]
      .filter((alpha2) => availableAlpha2.has(alpha2))
  )
  const [search, setSearch] = useState('')
  const [selectedFields, setSelectedFields] = useState<CompareFieldId[]>([
    'area',
    'population',
    'capital',
    'continent'
  ])

  const countries = useMemo<CompareCountry[]>(() => {
    const countryNames = new Intl.DisplayNames([language], { type: 'region' })
    const dataByAlpha2 = new Map(
      (countryExplorationData.countries as CountryRecord[]).map((entry) => [entry.alpha2, entry])
    )
    return countryCatalog
      .map((entry) => {
        const data = dataByAlpha2.get(entry.alpha2)
        return {
          alpha2: entry.alpha2,
          name: countryNames.of(entry.alpha2) ?? entry.countryName,
          capital: data?.capital ?? null,
          continent: getContinentLabelForCountry(entry.alpha2) ?? 'Autre',
          population: data?.population ?? null,
          populationYear: data?.populationYear ?? null,
          metrics: data?.metrics ?? null,
          cities: data?.cities ?? [],
          mountains: data?.mountains ?? [],
          resources: getResourceIndustryFactsForMapFeature(null, entry.sourceFeatureId)
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, language))
  }, [language])

  const selectedCountries = selectedAlpha2
    .map((alpha2) => countries.find((country) => country.alpha2 === alpha2))
    .filter((country): country is CompareCountry => country !== undefined)
  const searchQuery = normalizeSearch(search)
  const suggestions = searchQuery
    ? countries
        .filter(
          (country) =>
            !selectedAlpha2.includes(country.alpha2) &&
            normalizeSearch(country.name).includes(searchQuery)
        )
        .slice(0, 8)
    : []

  const toggleField = (field: CompareFieldId): void => {
    setSelectedFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    )
  }

  const addCountry = (alpha2: string): void => {
    setSelectedAlpha2((current) =>
      current.includes(alpha2) ? current : [...current, alpha2]
    )
    setSearch('')
  }

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      maximumFractionDigits: 0
    }).format(value)

  const getNumericValue = (country: CompareCountry, field: CompareFieldId): number | null => {
    if (field === 'population') return country.population
    if (!country.metrics) return null
    if (field === 'area') return country.metrics.areaKm2
    if (field === 'perimeter') return country.metrics.perimeterKm
    if (field === 'northSouth') return country.metrics.northSouthKm
    if (field === 'eastWest') return country.metrics.eastWestKm
    return null
  }

  const formatNumericValue = (country: CompareCountry, field: CompareFieldId): string => {
    const value = getNumericValue(country, field)
    if (value === null) return t('Indisponible')
    if (field === 'area') return `${formatNumber(value)} km²`
    if (field === 'population') {
      return `${formatNumber(value)}${country.populationYear ? ` · ${country.populationYear}` : ''}`
    }
    return `${formatNumber(value)} km`
  }

  const renderFieldValue = (country: CompareCountry, field: CompareFieldId): React.JSX.Element => {
    if (field === 'capital') {
      return <span>{country.capital ?? t('Indisponible')}</span>
    }
    if (field === 'continent') return <span>{t(country.continent)}</span>
    if (field === 'cities') {
      const names = country.cities.slice(0, 3).map((city) => city.name)
      return <span>{names.length ? names.join(', ') : t('Indisponible')}</span>
    }
    if (field === 'mountains') {
      const names = country.mountains.slice(0, 3).map((mountain) => mountain.name)
      return <span>{names.length ? names.join(', ') : t('Indisponible')}</span>
    }
    if (field === 'resources') {
      return country.resources.length ? (
        <ul className="country-comparator-resource-list">
          {country.resources.map((industry) => (
            <li key={industry.id}>
              <span aria-hidden="true">{industry.icon}</span>
              <span>{t(industry.label)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span>{t('Indisponible')}</span>
      )
    }

    const value = getNumericValue(country, field)
    const maximum = Math.max(
      0,
      ...selectedCountries.map((item) => getNumericValue(item, field) ?? 0)
    )
    const fill = value !== null && maximum > 0 ? Math.max(5, (value / maximum) * 100) : 0
    return (
      <div className="country-comparator-measure">
        <span>{formatNumericValue(country, field)}</span>
        {value !== null && (
          <div className="country-comparator-bar" aria-hidden="true">
            <span style={{ width: `${fill}%` }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="country-comparator-screen">
      <header className="statistics-header country-comparator-header">
        <div className="country-comparator-brand">
          <div className="brand-icon">W</div>
          <div>
            <div className="brand-name">WORLD ATLAS</div>
            <div className="brand-subtitle">{t('Comparateur')}</div>
          </div>
        </div>
        <div>
          <div className="breadcrumb">{t('COMPARAISON / MONDE')}</div>
          <h1>{t('Comparer des pays')}</h1>
          <p>{t('Choisis les pays et les informations à comparer.')}</p>
        </div>
        <div className="statistics-actions">
          <button className="home-back-button" type="button" onClick={onOpenStatistics}>
            {t('Statistiques')}
          </button>
        </div>
      </header>

      <AppModeSwitcher active="comparator" onChange={onModeChange} />

      <main className="country-comparator-content">
        <section className="country-comparator-setup">
          <div className="country-comparator-section-heading">
            <div>
              <span className="section-label">{t('PAYS À COMPARER')}</span>
              <h2>{t('Sélection des pays')}</h2>
            </div>
            <span className="country-comparator-count">
              {selectedCountries.length} {t('pays sélectionnés')}
            </span>
          </div>

          <div className="country-comparator-search">
            <label htmlFor="country-comparator-search">{t('Ajouter un pays')}</label>
            <input
              id="country-comparator-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Rechercher un pays…')}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="country-comparator-suggestions" role="listbox">
                {suggestions.map((country) => (
                  <li key={country.alpha2}>
                    <button type="button" role="option" onClick={() => addCountry(country.alpha2)}>
                      <img src={getFlagImageSource(country.alpha2)} alt="" aria-hidden="true" />
                      <span>{country.name}</span>
                      <span aria-hidden="true">+</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedCountries.length > 0 ? (
            <ul className="country-comparator-selected-list">
              {selectedCountries.map((country) => (
                <li key={country.alpha2}>
                  <img src={getFlagImageSource(country.alpha2)} alt="" aria-hidden="true" />
                  <span>{country.name}</span>
                  <button
                    type="button"
                    aria-label={`${t('Retirer')} ${country.name}`}
                    onClick={() =>
                      setSelectedAlpha2((current) => current.filter((code) => code !== country.alpha2))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="country-comparator-empty-hint">{t('Recherche un pays pour commencer la comparaison.')}</p>
          )}
        </section>

        <section className="country-comparator-fields">
          <div className="country-comparator-section-heading">
            <div>
              <span className="section-label">{t('INFORMATIONS')}</span>
              <h2>{t('Éléments à comparer')}</h2>
            </div>
          </div>
          <div className="country-comparator-field-options">
            {compareFields.map((field) => (
              <button
                key={field.id}
                type="button"
                className={selectedFields.includes(field.id) ? 'is-selected' : undefined}
                aria-pressed={selectedFields.includes(field.id)}
                onClick={() => toggleField(field.id)}
              >
                <span aria-hidden="true">{selectedFields.includes(field.id) ? '✓' : '+'}</span>
                {t(field.label)}
              </button>
            ))}
          </div>
        </section>

        <section className="country-comparator-results" aria-live="polite">
          {selectedCountries.length === 0 || selectedFields.length === 0 ? (
            <div className="country-comparator-empty-state">
              {selectedCountries.length === 0
                ? t('Ajoute au moins un pays pour afficher le tableau.')
                : t('Choisis au moins une information à comparer.')}
            </div>
          ) : (
            <div className="country-comparator-table-scroll">
              <table className="country-comparator-table">
                <thead>
                  <tr>
                    <th scope="col">{t('Pays')}</th>
                    {selectedFields.map((fieldId) => {
                      const field = compareFields.find((item) => item.id === fieldId)!
                      return <th key={field.id} scope="col">{t(field.label)}</th>
                    })}
                  </tr>
                </thead>
                <tbody>
                  {selectedCountries.map((country) => (
                    <tr key={country.alpha2}>
                      <th scope="row">
                        <div className="country-comparator-country-name">
                          <img src={getFlagImageSource(country.alpha2)} alt="" aria-hidden="true" />
                          <span>{country.name}</span>
                        </div>
                      </th>
                      {selectedFields.map((fieldId) => (
                        <td key={fieldId}>{renderFieldValue(country, fieldId)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="country-comparator-note">
            {t('Les mesures géographiques sont approximatives ; les données absentes sont indiquées comme indisponibles.')}
          </p>
        </section>
      </main>
    </div>
  )
}
