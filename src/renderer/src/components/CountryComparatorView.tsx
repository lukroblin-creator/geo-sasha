import { useCallback, useMemo, useRef, useState } from 'react'
import { AppModeSwitcher, type AppPrimaryMode } from './AppModeSwitcher'
import { useLanguage } from '../data/i18n'
import {
  flagHasAllColorFilters,
  flagNamedColorOptions,
  flagOutlineMatches,
  getFlagAspectRatio,
  getFlagBandCounts,
  getFlagImageSource,
  getFlagOutline,
  type FlagColorFilter,
  type FlagNamedColorFilterId,
  type FlagPolygonDrawing,
  type FlagRatioRange
} from '../data/quiz/flagAssets'
import { FlagRatioFilter } from './FlagRatioFilter'
import countryCatalog from '../data/quiz/countryCatalog.json'
import {
  explorationEconomicSources,
  getExplorationDetails,
  type ExplorationDetails
} from '../data/geography/exploration'
import type { ResourceIndustryFact, LocalizedResourceText } from '../data/geography/resources'

type CompareCountry = {
  alpha2: string
  name: string
  details: ExplorationDetails
}

type CompareFieldId =
  | 'flag'
  | 'capital'
  | 'continent'
  | 'area'
  | 'perimeter'
  | 'northSouth'
  | 'eastWest'
  | 'population'
  | 'territories'
  | 'officialLanguages'
  | 'regionalLanguages'
  | 'currencies'
  | 'salary'
  | 'webDomains'
  | 'writingSystems'
  | 'resources'
  | 'terrain'
  | 'cities'
  | 'highestPoint'
  | 'mountains'
  | 'lowestPoint'
  | 'rivers'
  | 'government'
  | 'music'
  | 'funFacts'
  | 'historicalFact'
  | 'sources'

const compareFields: { id: CompareFieldId; label: string; numeric?: boolean }[] = [
  { id: 'flag', label: 'Drapeau' },
  { id: 'capital', label: 'Capitale' },
  { id: 'continent', label: 'Continent' },
  { id: 'area', label: 'Superficie', numeric: true },
  { id: 'perimeter', label: 'Périmètre', numeric: true },
  { id: 'northSouth', label: 'Étendue nord-sud', numeric: true },
  { id: 'eastWest', label: 'Étendue est-ouest', numeric: true },
  { id: 'population', label: 'Population', numeric: true },
  { id: 'territories', label: 'Territoires associés' },
  { id: 'officialLanguages', label: 'Langues officielles' },
  { id: 'regionalLanguages', label: 'Langues régionales reconnues' },
  { id: 'currencies', label: 'Devise' },
  { id: 'salary', label: 'Salaire médian mensuel des salariés' },
  { id: 'webDomains', label: 'Extension web du pays' },
  { id: 'writingSystems', label: 'Alphabet et systèmes d’écriture' },
  { id: 'resources', label: 'Ressources et industries' },
  { id: 'terrain', label: 'Relief majeur et caractère du terrain' },
  { id: 'cities', label: 'Grandes villes recensées' },
  { id: 'highestPoint', label: 'Point culminant' },
  { id: 'mountains', label: 'Sommets et reliefs majeurs recensés' },
  { id: 'lowestPoint', label: 'Point le plus bas' },
  { id: 'rivers', label: 'Fleuves majeurs' },
  { id: 'government', label: 'Régime politique' },
  { id: 'music', label: 'Style musical le plus écouté' },
  { id: 'funFacts', label: 'Anecdotes' },
  { id: 'historicalFact', label: 'Fait historique majeur' },
  { id: 'sources', label: 'Sources et date des données' }
]

type FilterTargetKind = 'text' | 'number' | 'flag'
type NumericOperator = 'lt' | 'gt' | 'eq' | 'lte' | 'gte' | 'between'
type TextOperator = 'contains' | 'equals'
type FilterTarget = {
  id: string
  field: CompareFieldId
  label: string
  kind: FilterTargetKind
  unit?: string
}
type ComparatorFilter = {
  id: string
  targetId: string
  operator: NumericOperator
  value: string
  upperValue: string
  textOperator: TextOperator
  textValue: string
  colorDraft: string
  flagColors: FlagColorFilter[]
  bandCount: number
  bandDirections: Array<'horizontal' | 'vertical' | 'oblique'>
  ratioRange: FlagRatioRange | null
  polygon: FlagPolygonDrawing | null
}

type ComparatorFilterRegion = 'both' | 'aOnly' | 'bOnly' | 'neither'
type ComparatorFilterGroup = { id: string; startFilterId: string; endFilterId: string }
type ComparatorFilterExpressionToken =
  | { kind: 'value'; value: boolean }
  | { kind: 'operator'; regions: ComparatorFilterRegion[] }
  | { kind: 'open' | 'close' }
type ComparatorFilterOperation = {
  id: string
  label: string
  regions: ComparatorFilterRegion[]
}

const comparatorFilterOperations: ComparatorFilterOperation[] = [
  { id: 'intersection', label: 'Intersection · A et B', regions: ['both'] },
  { id: 'union', label: 'A + B · Union', regions: ['both', 'aOnly', 'bOnly'] },
  { id: 'aOnly', label: 'Différence · A sans B', regions: ['aOnly'] },
  { id: 'bOnly', label: 'Différence · B sans A', regions: ['bOnly'] },
  {
    id: 'symmetricDifference',
    label: 'Différence symétrique · A ou B, mais pas les deux',
    regions: ['aOnly', 'bOnly']
  },
  { id: 'neither', label: 'Ni A ni B', regions: ['neither'] },
  { id: 'notA', label: 'Complément de A · tout sauf A', regions: ['bOnly', 'neither'] },
  { id: 'notB', label: 'Complément de B · tout sauf B', regions: ['aOnly', 'neither'] },
  {
    id: 'notIntersection',
    label: 'Tout sauf l’intersection',
    regions: ['aOnly', 'bOnly', 'neither']
  },
  { id: 'all', label: 'Tous les pays', regions: ['both', 'aOnly', 'bOnly', 'neither'] },
  { id: 'none', label: 'Aucun pays', regions: [] }
]

const comparatorFilterRegions: { id: ComparatorFilterRegion; label: string }[] = [
  { id: 'both', label: 'A et B' },
  { id: 'aOnly', label: 'A seulement' },
  { id: 'bOnly', label: 'B seulement' },
  { id: 'neither', label: 'Ni A ni B' }
]

const simpleFilterRegions: Record<'union' | 'intersection', ComparatorFilterRegion[]> = {
  union: ['both', 'aOnly', 'bOnly'],
  intersection: ['both']
}

const filterTargets: FilterTarget[] = [
  ...compareFields.map((field) => ({
    id: field.id,
    field: field.id,
    label: field.label,
    kind: (field.id === 'flag'
      ? 'flag'
      : field.numeric || field.id === 'salary'
        ? 'number'
        : 'text') as FilterTargetKind,
    unit:
      field.id === 'area'
        ? 'km²'
        : ['perimeter', 'northSouth', 'eastWest'].includes(field.id)
          ? 'km'
          : field.id === 'population'
            ? 'hab.'
            : field.id === 'salary'
              ? 'EUR / mois'
              : undefined
  })),
  {
    id: 'highestPointElevation',
    field: 'highestPoint',
    label: 'Altitude du point culminant',
    kind: 'number',
    unit: 'm'
  },
  {
    id: 'lowestPointElevation',
    field: 'lowestPoint',
    label: 'Altitude du point le plus bas',
    kind: 'number',
    unit: 'm'
  },
  {
    id: 'territoryCount',
    field: 'territories',
    label: 'Nombre de territoires associés',
    kind: 'number'
  },
  {
    id: 'cityPopulation',
    field: 'cities',
    label: 'Population des grandes villes',
    kind: 'number',
    unit: 'hab.'
  },
  {
    id: 'mountainElevation',
    field: 'mountains',
    label: 'Altitude des sommets recensés',
    kind: 'number',
    unit: 'm'
  },
  {
    id: 'currencyEuroRate',
    field: 'currencies',
    label: 'Conversion des devises en euros',
    kind: 'number',
    unit: 'EUR / unité'
  },
  {
    id: 'resourceMeasures',
    field: 'resources',
    label: 'Indicateurs chiffrés des ressources et industries',
    kind: 'number'
  },
  { id: 'musicMeasures', field: 'music', label: 'Classement et audience musicale', kind: 'number' }
]

const numericOperators: { id: NumericOperator; label: string }[] = [
  { id: 'lt', label: 'inférieur à' },
  { id: 'gt', label: 'supérieur à' },
  { id: 'eq', label: 'égal à' },
  { id: 'lte', label: 'inférieur ou égal à' },
  { id: 'gte', label: 'supérieur ou égal à' },
  { id: 'between', label: 'compris entre' }
]

function createComparatorFilter(id: string, targetId = ''): ComparatorFilter {
  return {
    id,
    targetId,
    operator: 'gt',
    value: '',
    upperValue: '',
    textOperator: 'contains',
    textValue: '',
    colorDraft: '#e53935',
    flagColors: [],
    bandCount: 0,
    bandDirections: [],
    ratioRange: null,
    polygon: null
  }
}

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
    [...new Set(initialAlpha2.map((alpha2) => alpha2.toUpperCase()))].filter((alpha2) =>
      availableAlpha2.has(alpha2)
    )
  )
  const [filters, setFilters] = useState<ComparatorFilter[]>([])
  const [excludedFilteredAlpha2, setExcludedFilteredAlpha2] = useState<string[]>([])
  const [simpleFilterLogic, setSimpleFilterLogic] = useState<'union' | 'intersection'>('union')
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)
  const [filterRelationOverrides, setFilterRelationOverrides] = useState<
    Record<string, ComparatorFilterRegion[]>
  >({})
  const [customRelationEditors, setCustomRelationEditors] = useState<Record<string, boolean>>({})
  const [filterGroups, setFilterGroups] = useState<ComparatorFilterGroup[]>([])
  const [groupStartFilterId, setGroupStartFilterId] = useState('')
  const [groupEndFilterId, setGroupEndFilterId] = useState('')
  const nextFilterId = useRef(0)
  const nextFilterGroupId = useRef(0)
  const [search, setSearch] = useState('')
  const [fieldSearch, setFieldSearch] = useState('')
  const [fieldSearchIsOpen, setFieldSearchIsOpen] = useState(false)
  const [selectedFields, setSelectedFields] = useState<CompareFieldId[]>([
    'area',
    'population',
    'capital',
    'continent'
  ])

  const countries = useMemo<CompareCountry[]>(() => {
    const countryNames = new Intl.DisplayNames([language], { type: 'region' })
    return countryCatalog
      .map((entry) => {
        return {
          alpha2: entry.alpha2,
          name: countryNames.of(entry.alpha2) ?? entry.countryName,
          details: getExplorationDetails(entry.sourceFeatureId, entry.countryName, null)
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, language))
  }, [language])

  const searchQuery = normalizeSearch(search)
  const fieldSearchQuery = normalizeSearch(fieldSearch)
  const fieldSuggestions = fieldSearchQuery
    ? compareFields
        .filter(
          (field) =>
            !selectedFields.includes(field.id) &&
            normalizeSearch(t(field.label)).startsWith(fieldSearchQuery)
        )
        .slice(0, 8)
    : []

  const toggleField = (field: CompareFieldId): void => {
    setSelectedFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    )
  }

  const addCompareField = (field: CompareFieldId): void => {
    setSelectedFields((current) => (current.includes(field) ? current : [...current, field]))
    setFieldSearch('')
    setFieldSearchIsOpen(false)
  }

  const addCountry = (alpha2: string): void => {
    setSelectedAlpha2((current) => (current.includes(alpha2) ? current : [...current, alpha2]))
    setExcludedFilteredAlpha2((current) => current.filter((code) => code !== alpha2))
    setSearch('')
  }

  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US'
  const formatNumber = (value: number, maximumFractionDigits = 0): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)

  const formatDate = (value: string): string =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${value}T00:00:00Z`)
    )

  const formatMoney = (amount: number, currencyCode: string): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(amount)
    } catch {
      return `${formatNumber(amount)} ${currencyCode}`
    }
  }

  const formatEuroPerUnit = (amount: number): string =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumSignificantDigits: 4
    }).format(amount)

  const localizedProfileText = useCallback(
    (value: { en: string; fr: string } | null | undefined): string =>
      value ? (language === 'fr' ? value.fr : value.en) : 'ND',
    [language]
  )

  const localizedResourceText = useCallback(
    (value: LocalizedResourceText): string => value[language] || value.fr,
    [language]
  )

  const getLanguageName = useCallback(
    (code: string, fallback: string): string => {
      try {
        const name = new Intl.DisplayNames([language], { type: 'language' }).of(code)
        return name && name.toLowerCase() !== code.toLowerCase() ? name : fallback
      } catch {
        return fallback
      }
    },
    [language]
  )

  const getCurrencyName = useCallback(
    (code: string, fallback: string): string => {
      try {
        const name = new Intl.DisplayNames([language], { type: 'currency' }).of(code)
        return name && name.toLowerCase() !== code.toLowerCase() ? name : fallback
      } catch {
        return fallback
      }
    },
    [language]
  )

  const getScriptName = useCallback(
    (code: string): string => {
      try {
        const name = new Intl.DisplayNames([language], { type: 'script' }).of(code)
        return name && name.toLowerCase() !== code.toLowerCase() ? name : code
      } catch {
        return code
      }
    },
    [language]
  )

  const getTextFilterValues = useCallback(
    (country: CompareCountry, targetId: string): string[] => {
      const details = country.details
      const field = filterTargets.find((target) => target.id === targetId)?.field
      if (!field || field === 'flag') return []
      if (field === 'capital') return details.capital ? [details.capital] : []
      if (field === 'continent') return details.continent ? [t(details.continent)] : []
      if (field === 'territories') return details.territories.map((territory) => territory.name)
      if (field === 'officialLanguages' || field === 'regionalLanguages') {
        const languages =
          field === 'officialLanguages'
            ? (details.culture?.officialLanguages ?? [])
            : (details.culture?.regionalLanguages ?? [])
        return languages.flatMap((item) => [
          item.canonicalCode === 'tzm'
            ? t('Tamazight (Amazigh)')
            : getLanguageName(item.canonicalCode, item.name),
          item.name,
          item.canonicalCode
        ])
      }
      if (field === 'currencies') {
        return (details.culture?.currencies ?? []).flatMap((currency) => [
          getCurrencyName(currency.code, currency.name),
          currency.name,
          currency.code,
          currency.symbol ?? ''
        ])
      }
      if (field === 'salary') {
        const earnings = details.medianMonthlyEarnings
        return earnings
          ? [earnings.currencyCode, earnings.sourceName ?? '', earnings.definition ?? '']
          : []
      }
      if (field === 'webDomains') return details.culture?.webDomains ?? []
      if (field === 'writingSystems') {
        return (details.culture?.writingSystems ?? []).flatMap((system) => [
          getScriptName(system.scriptCode),
          system.scriptCode,
          system.characters,
          system.example,
          system.exampleLanguageCode ?? ''
        ])
      }
      if (field === 'resources') {
        return details.resources.flatMap((industry) => [
          t(industry.label),
          industry.id,
          industry.sourceDetails,
          ...(industry.research
            ? [
                localizedResourceText(industry.research.importance ?? { fr: '', en: '', es: '' }),
                localizedResourceText(industry.research.production ?? { fr: '', en: '', es: '' }),
                localizedResourceText(industry.research.work ?? { fr: '', en: '', es: '' }),
                localizedResourceText(
                  industry.research.worldRank?.metric ?? { fr: '', en: '', es: '' }
                ),
                localizedResourceText(
                  industry.research.worldRank?.share ?? { fr: '', en: '', es: '' }
                )
              ]
            : []),
          ...(industry.industrialContext?.indicators?.flatMap((indicator) => [
            localizedResourceText(indicator.label),
            typeof indicator.value === 'string'
              ? indicator.value
              : localizedResourceText(indicator.value)
          ]) ?? [])
        ])
      }
      if (field === 'terrain') {
        const facts = details.profileFacts
        return facts
          ? [localizedProfileText(facts.terrain), localizedProfileText(facts.terrainCharacter)]
          : []
      }
      if (field === 'cities') return details.cities.map((city) => city.name)
      if (field === 'highestPoint' || field === 'lowestPoint') {
        const point =
          field === 'highestPoint'
            ? details.profileFacts?.highestPoint
            : details.profileFacts?.lowestPoint
        return point ? [localizedProfileText(point.name)] : []
      }
      if (field === 'mountains') return details.mountains.map((mountain) => mountain.name)
      if (field === 'rivers')
        return (details.profileFacts?.rivers ?? []).map((river) => localizedProfileText(river))
      if (field === 'government') {
        const facts = details.profileFacts
        const regime = facts?.politicalRegime
        return [
          localizedProfileText(facts?.governmentType),
          regime ? (language === 'fr' ? regime.label : regime.sourceLabel) : ''
        ]
      }
      if (field === 'music') {
        const music = details.profileFacts?.music
        return music
          ? [
              language === 'fr' ? music.genreFr : music.genre,
              music.secondGenre
                ? language === 'fr'
                  ? (music.secondGenreFr ?? '')
                  : music.secondGenre
                : '',
              localizedProfileText(music.sourceNote)
            ]
          : []
      }
      if (field === 'funFacts')
        return (details.profileFacts?.funFacts ?? []).map((fact) => localizedProfileText(fact))
      if (field === 'historicalFact')
        return [localizedProfileText(details.profileFacts?.historicalFact)]
      if (field === 'sources') {
        const facts = details.profileFacts
        return [
          details.populationSource,
          details.metricsSource ?? '',
          facts?.sourceUrl ?? '',
          ...(facts?.additionalSources?.flatMap((source) => [
            localizedProfileText(source.label),
            source.url
          ]) ?? []),
          ...details.resources.flatMap(
            (industry) => industry.research?.sources.map((source) => source.name) ?? []
          )
        ]
      }
      return []
    },
    [
      getCurrencyName,
      getLanguageName,
      getScriptName,
      language,
      localizedProfileText,
      localizedResourceText,
      t
    ]
  )

  const getNumericFilterValues = (country: CompareCountry, targetId: string): number[] => {
    const details = country.details
    const addNumberText = (
      value: number | string | LocalizedResourceText | null | undefined
    ): number[] => {
      if (typeof value === 'number') return Number.isFinite(value) ? [value] : []
      const text = typeof value === 'string' ? value : value ? localizedResourceText(value) : ''
      return (text.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
        .map((match) => Number(match.replace(',', '.')))
        .filter(Number.isFinite)
    }

    if (targetId === 'area') return details.metrics ? [details.metrics.areaKm2] : []
    if (targetId === 'perimeter') return details.metrics ? [details.metrics.perimeterKm] : []
    if (targetId === 'northSouth') return details.metrics ? [details.metrics.northSouthKm] : []
    if (targetId === 'eastWest') return details.metrics ? [details.metrics.eastWestKm] : []
    if (targetId === 'population') return details.population === null ? [] : [details.population]
    if (targetId === 'salary') {
      const earnings = details.medianMonthlyEarnings
      return earnings?.euroPerUnit === null || !earnings
        ? []
        : [earnings.amount * earnings.euroPerUnit]
    }
    if (targetId === 'highestPointElevation') {
      const elevation = details.profileFacts?.highestPoint?.elevationMeters
      return elevation === null || elevation === undefined ? [] : [elevation]
    }
    if (targetId === 'lowestPointElevation') {
      const elevation = details.profileFacts?.lowestPoint?.elevationMeters
      return elevation === null || elevation === undefined ? [] : [elevation]
    }
    if (targetId === 'territoryCount') return [details.territories.length]
    if (targetId === 'cityPopulation')
      return details.cities.map((city) => city.population).filter((value) => value > 0)
    if (targetId === 'mountainElevation')
      return details.mountains.flatMap((mountain) =>
        mountain.elevationMeters === null ? [] : [mountain.elevationMeters]
      )
    if (targetId === 'currencyEuroRate')
      return (details.culture?.currencies ?? []).flatMap((currency) =>
        currency.euroPerUnit == null ? [] : [currency.euroPerUnit]
      )
    if (targetId === 'resourceMeasures') {
      return details.resources.flatMap((industry) => {
        const research = industry.research
        const context = industry.industrialContext
        return [
          ...(research?.worldRank
            ? [
                research.worldRank.position,
                research.worldRank.total ?? 0,
                research.worldRank.year,
                ...addNumberText(research.worldRank.share)
              ]
            : []),
          ...(context?.manufacturingRank
            ? [
                context.manufacturingRank.position,
                context.manufacturingRank.total,
                context.manufacturingRank.year
              ]
            : []),
          ...(context?.indicators?.flatMap((indicator) => addNumberText(indicator.value)) ?? [])
        ].filter((value) => value > 0)
      })
    }
    if (targetId === 'musicMeasures') {
      const music = details.profileFacts?.music
      return music
        ? [
            music.rank,
            music.year,
            music.sharePercent,
            music.secondRank,
            music.secondSharePercent
          ].filter((value): value is number => value !== null && value !== undefined)
        : []
    }
    return []
  }

  const isFilterActive = (filter: ComparatorFilter): boolean => {
    const target = filterTargets.find((candidate) => candidate.id === filter.targetId)
    if (!target) return false
    if (target.kind === 'number') {
      const first = Number(filter.value)
      const second = Number(filter.upperValue)
      return (
        filter.value !== '' &&
        Number.isFinite(first) &&
        (filter.operator !== 'between' || (filter.upperValue !== '' && Number.isFinite(second)))
      )
    }
    if (target.kind === 'text') return filter.textValue.trim().length > 0
    return (
      filter.flagColors.length > 0 ||
      filter.bandCount > 0 ||
      filter.bandDirections.length > 0 ||
      filter.ratioRange !== null ||
      filter.polygon !== null
    )
  }

  const matchesFilter = (country: CompareCountry, filter: ComparatorFilter): boolean => {
    const target = filterTargets.find((candidate) => candidate.id === filter.targetId)
    if (!target) return false
    if (target.kind === 'text') {
      const query = normalizeSearch(filter.textValue)
      return getTextFilterValues(country, target.id).some((value) => {
        const candidate = normalizeSearch(value)
        if (!candidate || candidate === 'nd') return false
        return filter.textOperator === 'equals' ? candidate === query : candidate.includes(query)
      })
    }
    if (target.kind === 'number') {
      const first = Number(filter.value)
      const second = Number(filter.upperValue)
      return getNumericFilterValues(country, target.id).some((value) => {
        if (filter.operator === 'lt') return value < first
        if (filter.operator === 'gt') return value > first
        if (filter.operator === 'eq') return value === first
        if (filter.operator === 'lte') return value <= first
        if (filter.operator === 'gte') return value >= first
        return value >= Math.min(first, second) && value <= Math.max(first, second)
      })
    }

    const alpha2 = country.details.flagAlpha2 ?? country.alpha2
    if (!flagHasAllColorFilters(alpha2, filter.flagColors)) return false
    const bands = getFlagBandCounts(alpha2)
    const matchesBands = filter.bandDirections.length
      ? filter.bandDirections.every((direction) =>
          filter.bandCount === 0 ? bands[direction] > 1 : bands[direction] === filter.bandCount
        )
      : filter.bandCount === 0 ||
        Math.max(bands.horizontal, bands.vertical, bands.oblique) === filter.bandCount
    if (!matchesBands) return false
    if (filter.polygon) return flagOutlineMatches(alpha2, filter.polygon)
    if (filter.ratioRange) {
      const ratio = getFlagAspectRatio(alpha2)?.ratio
      if (
        getFlagOutline(alpha2) ||
        ratio === undefined ||
        ratio < filter.ratioRange.minimum ||
        ratio > filter.ratioRange.maximum
      )
        return false
    }
    return true
  }

  const filterOptionValues = useMemo(() => {
    const byTarget = new Map<string, string[]>()
    filterTargets
      .filter((target) => target.kind === 'text')
      .forEach((target) => {
        const values = new Map<string, string>()
        countries.forEach((country) => {
          getTextFilterValues(country, target.id).forEach((value) => {
            const trimmed = value.trim()
            const key = normalizeSearch(trimmed)
            if (key && key !== 'nd' && !values.has(key)) values.set(key, trimmed)
          })
        })
        byTarget.set(
          target.id,
          [...values.values()].sort((a, b) => a.localeCompare(b, language))
        )
      })
    return byTarget
  }, [countries, getTextFilterValues, language])

  const activeFilters = filters.filter(isFilterActive)
  const activeFilterGroups = filterGroups.flatMap((group) => {
    const startIndex = activeFilters.findIndex((filter) => filter.id === group.startFilterId)
    const endIndex = activeFilters.findIndex((filter) => filter.id === group.endFilterId)
    return startIndex >= 0 && endIndex > startIndex ? [{ ...group, startIndex, endIndex }] : []
  })
  const selectedGroupStart =
    activeFilters.find((filter) => filter.id === groupStartFilterId) ?? activeFilters[0]
  const selectedGroupEnd =
    activeFilters.find((filter) => filter.id === groupEndFilterId) ?? activeFilters[1]
  const selectedGroupStartIndex = selectedGroupStart
    ? activeFilters.findIndex((filter) => filter.id === selectedGroupStart.id)
    : -1
  const selectedGroupEndIndex = selectedGroupEnd
    ? activeFilters.findIndex((filter) => filter.id === selectedGroupEnd.id)
    : -1
  const groupWouldCrossExisting = (
    startIndex: number,
    endIndex: number,
    ignoredGroupId?: string,
    groupsToCheck: ComparatorFilterGroup[] = filterGroups
  ): boolean =>
    groupsToCheck.some((group) => {
      if (group.id === ignoredGroupId) return false
      const currentStart = activeFilters.findIndex((filter) => filter.id === group.startFilterId)
      const currentEnd = activeFilters.findIndex((filter) => filter.id === group.endFilterId)
      if (currentStart < 0 || currentEnd <= currentStart) return false
      if (startIndex === currentStart && endIndex === currentEnd) return true
      return (
        (currentStart < startIndex && startIndex <= currentEnd && currentEnd < endIndex) ||
        (startIndex < currentStart && currentStart <= endIndex && endIndex < currentEnd)
      )
    })
  const canAddFilterGroup =
    activeFilters.length > 1 &&
    selectedGroupStartIndex >= 0 &&
    selectedGroupEndIndex > selectedGroupStartIndex &&
    !groupWouldCrossExisting(selectedGroupStartIndex, selectedGroupEndIndex)
  const activeRelationKeys = new Set(
    activeFilters.slice(0, -1).flatMap((filter, index) => {
      const nextFilter = activeFilters[index + 1]
      return nextFilter ? [`${filter.id}::${nextFilter.id}`] : []
    })
  )
  const hasAdvancedFilterRules =
    activeFilterGroups.length > 0 ||
    [...activeRelationKeys].some((key) => filterRelationOverrides[key] !== undefined)

  const getFilterRelationRegions = (
    leftFilter: ComparatorFilter,
    rightFilter: ComparatorFilter
  ): ComparatorFilterRegion[] =>
    filterRelationOverrides[`${leftFilter.id}::${rightFilter.id}`] ??
    simpleFilterRegions[simpleFilterLogic]

  const describeFilter = (filter: ComparatorFilter, index: number): string => {
    const target = filterTargets.find((candidate) => candidate.id === filter.targetId)
    if (!target) return `${t('Filtre')} ${index + 1}`
    if (target.kind === 'number') {
      const operator =
        numericOperators.find((item) => item.id === filter.operator)?.label ?? filter.operator
      const first = Number(filter.value)
      const second = Number(filter.upperValue)
      const format = (value: number): string =>
        new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value)
      const values =
        filter.operator === 'between' ? `${format(first)}–${format(second)}` : format(first)
      return `${t(target.label)} ${t(operator)} ${values}${target.unit ? ` ${t(target.unit)}` : ''}`
    }
    if (target.kind === 'text') {
      const operator = filter.textOperator === 'equals' ? '=' : t('contient')
      return `${t(target.label)} ${operator} « ${filter.textValue.trim()} »`
    }
    const colors = filter.flagColors.map((color) =>
      color.kind === 'named'
        ? t(flagNamedColorOptions.find((item) => item.id === color.id)?.label ?? color.id)
        : color.color.toUpperCase()
    )
    const parts = [
      colors.length ? colors.join(' + ') : null,
      filter.bandCount ? `${filter.bandCount} ${t('bandes')}` : null,
      filter.bandDirections.length
        ? filter.bandDirections
            .map((direction) =>
              t(
                direction === 'horizontal'
                  ? 'horizontales'
                  : direction === 'vertical'
                    ? 'verticales'
                    : 'obliques'
              )
            )
            .join(', ')
        : null,
      filter.polygon ? t('forme dessinée') : null,
      filter.ratioRange ? t('proportions sélectionnées') : null
    ].filter((part): part is string => Boolean(part))
    return `${t('Drapeau')} : ${parts.join(' · ') || t('critères de drapeau')}`
  }

  const describeRelation = (left: ComparatorFilter, right: ComparatorFilter): string => {
    const regions = getFilterRelationRegions(left, right)
    const operation = comparatorFilterOperations.find(
      (item) =>
        item.regions.length === regions.length &&
        item.regions.every((region) => regions.includes(region))
    )
    if (operation) return t(operation.label)
    return `${t('relation personnalisée')} (${regions.map((region) => t(comparatorFilterRegions.find((item) => item.id === region)?.label ?? region)).join(', ') || t('aucune zone')})`
  }

  const filterExpressionSummary = activeFilters
    .map((filter, index) => {
      const openingGroups = activeFilterGroups.filter((group) => group.startIndex === index)
      const closingGroups = activeFilterGroups.filter((group) => group.endIndex === index)
      const nextFilter = activeFilters[index + 1]
      return `${'('.repeat(openingGroups.length)}F${index + 1} · ${describeFilter(filter, index)}${')'.repeat(closingGroups.length)}${nextFilter ? `  ${describeRelation(filter, nextFilter)}  ` : ''}`
    })
    .join('')

  const evaluateAdvancedFilterExpression = (country: CompareCountry): boolean => {
    const tokens: ComparatorFilterExpressionToken[] = []
    activeFilters.forEach((filter, index) => {
      activeFilterGroups
        .filter((group) => group.startIndex === index)
        .sort((first, second) => second.endIndex - first.endIndex)
        .forEach(() => tokens.push({ kind: 'open' }))
      tokens.push({ kind: 'value', value: matchesFilter(country, filter) })
      activeFilterGroups
        .filter((group) => group.endIndex === index)
        .sort((first, second) => second.startIndex - first.startIndex)
        .forEach(() => tokens.push({ kind: 'close' }))
      const nextFilter = activeFilters[index + 1]
      if (nextFilter)
        tokens.push({ kind: 'operator', regions: getFilterRelationRegions(filter, nextFilter) })
    })

    let cursor = 0
    const evaluatePrimary = (): boolean => {
      const token = tokens[cursor++]
      if (!token) return false
      if (token.kind === 'open') {
        const value = evaluateExpression()
        if (tokens[cursor]?.kind === 'close') cursor += 1
        return value
      }
      return token.kind === 'value' ? token.value : false
    }
    const evaluateExpression = (): boolean => {
      let value = evaluatePrimary()
      while (tokens[cursor]?.kind === 'operator') {
        const operation = tokens[cursor]
        if (!operation || operation.kind !== 'operator') break
        cursor += 1
        const nextValue = evaluatePrimary()
        const region: ComparatorFilterRegion = value
          ? nextValue
            ? 'both'
            : 'aOnly'
          : nextValue
            ? 'bOnly'
            : 'neither'
        value = operation.regions.includes(region)
      }
      return value
    }
    return evaluateExpression()
  }
  const filteredCountries = activeFilters.length
    ? countries.filter((country) => {
        if (activeFilters.length === 1) return matchesFilter(country, activeFilters[0])
        return evaluateAdvancedFilterExpression(country)
      })
    : []
  const filteredAlpha2 = filteredCountries
    .map((country) => country.alpha2)
    .filter(
      (alpha2) => !excludedFilteredAlpha2.includes(alpha2) && !selectedAlpha2.includes(alpha2)
    )
  const comparatorAlpha2 = [...new Set([...selectedAlpha2, ...filteredAlpha2])]
  const selectedCountries = comparatorAlpha2
    .map((alpha2) => countries.find((country) => country.alpha2 === alpha2))
    .filter((country): country is CompareCountry => country !== undefined)
  const suggestions = searchQuery
    ? countries
        .filter(
          (country) =>
            !comparatorAlpha2.includes(country.alpha2) &&
            normalizeSearch(country.name).includes(searchQuery)
        )
        .sort((first, second) => {
          const firstName = normalizeSearch(first.name)
          const secondName = normalizeSearch(second.name)
          const firstRank =
            firstName === searchQuery ? 0 : firstName.startsWith(searchQuery) ? 1 : 2
          const secondRank =
            secondName === searchQuery ? 0 : secondName.startsWith(searchQuery) ? 1 : 2
          return firstRank - secondRank || first.name.localeCompare(second.name, language)
        })
        .slice(0, 8)
    : []

  const updateFilter = (
    id: string,
    updater: (filter: ComparatorFilter) => ComparatorFilter
  ): void => {
    setFilters((current) => current.map((filter) => (filter.id === id ? updater(filter) : filter)))
    setExcludedFilteredAlpha2([])
  }

  const addFilter = (): void => {
    const id = `comparator-filter-${nextFilterId.current++}`
    setFilters((current) => [...current, createComparatorFilter(id)])
  }

  const removeFilter = (id: string): void => {
    setFilters((current) => current.filter((filter) => filter.id !== id))
    setFilterRelationOverrides((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.split('::').includes(id)))
    )
    setCustomRelationEditors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.split('::').includes(id)))
    )
    setFilterGroups((current) =>
      current.filter((group) => group.startFilterId !== id && group.endFilterId !== id)
    )
    setExcludedFilteredAlpha2([])
  }

  const addFilterGroup = (): void => {
    if (!canAddFilterGroup || !selectedGroupStart || !selectedGroupEnd) return
    const newGroup = {
      id: `comparator-filter-group-${nextFilterGroupId.current++}`,
      startFilterId: selectedGroupStart.id,
      endFilterId: selectedGroupEnd.id
    }
    const nextGroups = [...filterGroups, newGroup]
    setFilterGroups(nextGroups)
    const groupRanges = activeFilters.flatMap((_, startIndex) =>
      activeFilters.slice(startIndex + 1).map((__, endOffset) => ({
        startIndex,
        endIndex: startIndex + endOffset + 1
      }))
    )
    const nextRange = [
      ...groupRanges.filter((range) => range.startIndex > selectedGroupEndIndex),
      ...groupRanges.filter((range) => range.startIndex <= selectedGroupEndIndex)
    ].find(
      (range) => !groupWouldCrossExisting(range.startIndex, range.endIndex, undefined, nextGroups)
    )
    if (nextRange) {
      const nextStartFilter = activeFilters[nextRange.startIndex]
      const nextEndFilter = activeFilters[nextRange.endIndex]
      if (nextStartFilter && nextEndFilter) {
        setGroupStartFilterId(nextStartFilter.id)
        setGroupEndFilterId(nextEndFilter.id)
      }
    }
    setExcludedFilteredAlpha2([])
  }

  const updateFilterGroupEndpoint = (
    groupId: string,
    endpoint: 'start' | 'end',
    filterId: string
  ): void => {
    const group = activeFilterGroups.find((item) => item.id === groupId)
    if (!group) return
    const startFilterId = endpoint === 'start' ? filterId : group.startFilterId
    const endFilterId = endpoint === 'end' ? filterId : group.endFilterId
    const startIndex = activeFilters.findIndex((filter) => filter.id === startFilterId)
    const endIndex = activeFilters.findIndex((filter) => filter.id === endFilterId)
    if (
      startIndex < 0 ||
      endIndex <= startIndex ||
      groupWouldCrossExisting(startIndex, endIndex, groupId)
    )
      return
    setFilterGroups((current) =>
      current.map((item) => (item.id === groupId ? { ...item, startFilterId, endFilterId } : item))
    )
    setExcludedFilteredAlpha2([])
  }

  const removeComparedCountry = (alpha2: string): void => {
    setSelectedAlpha2((current) => current.filter((code) => code !== alpha2))
    if (filteredCountries.some((country) => country.alpha2 === alpha2)) {
      setExcludedFilteredAlpha2((current) =>
        current.includes(alpha2) ? current : [...current, alpha2]
      )
    }
  }

  const availableFlagRatios = useMemo(
    () =>
      [
        ...new Map(
          countries.flatMap((country) => {
            const ratio = getFlagAspectRatio(country.alpha2)
            return ratio ? [[ratio.ratio, ratio] as const] : []
          })
        ).values()
      ].sort((first, second) => first.ratio - second.ratio),
    [countries]
  )

  const availablePolygonShapes = useMemo(
    () =>
      countries.flatMap((country) => {
        const outline = getFlagOutline(country.alpha2)
        return outline ? [{ name: country.name, vertexCount: outline.length }] : []
      }),
    [countries]
  )
  const maxFlagBandCount = Math.max(
    1,
    ...countries.map((country) => {
      const bands = getFlagBandCounts(country.alpha2)
      return Math.max(bands.horizontal, bands.vertical, bands.oblique)
    })
  )

  const setFilterTarget = (filterId: string, targetId: string): void => {
    setFilters((current) =>
      current.map((filter) =>
        filter.id === filterId ? createComparatorFilter(filterId, targetId) : filter
      )
    )
    setExcludedFilteredAlpha2([])
  }

  const renderList = (
    items: Array<{ key: string; content: React.ReactNode }>
  ): React.JSX.Element =>
    items.length ? (
      <ul className="country-comparator-value-list">
        {items.map((item) => (
          <li key={item.key}>{item.content}</li>
        ))}
      </ul>
    ) : (
      <span>ND</span>
    )

  const getNumericValue = (country: CompareCountry, field: CompareFieldId): number | null => {
    if (field === 'population') return country.details.population
    if (!country.details.metrics) return null
    if (field === 'area') return country.details.metrics.areaKm2
    if (field === 'perimeter') return country.details.metrics.perimeterKm
    if (field === 'northSouth') return country.details.metrics.northSouthKm
    if (field === 'eastWest') return country.details.metrics.eastWestKm
    return null
  }

  const formatNumericValue = (country: CompareCountry, field: CompareFieldId): string => {
    const value = getNumericValue(country, field)
    if (value === null) return 'ND'
    if (field === 'area') return `${formatNumber(value)} km²`
    if (field === 'population') {
      return `${formatNumber(value)}${country.details.populationYear ? ` · ${country.details.populationYear}` : ''}`
    }
    return `${formatNumber(value)} km`
  }

  const renderFieldValue = (country: CompareCountry, field: CompareFieldId): React.JSX.Element => {
    const details = country.details
    if (field === 'flag') {
      return details.flagAlpha2 ? (
        <div className="country-comparator-flag-value">
          <img
            src={getFlagImageSource(details.flagAlpha2)}
            alt={`${t('Drapeau de')} ${details.flagName}`}
          />
        </div>
      ) : (
        <span>ND</span>
      )
    }
    if (field === 'capital') return <span>{details.capital ?? 'ND'}</span>
    if (field === 'continent') return <span>{details.continent ? t(details.continent) : 'ND'}</span>
    if (field === 'territories') {
      return renderList(
        details.territories.map((territory) => ({ key: territory.id, content: territory.name }))
      )
    }
    if (field === 'officialLanguages' || field === 'regionalLanguages') {
      const languages =
        field === 'officialLanguages'
          ? (details.culture?.officialLanguages ?? [])
          : (details.culture?.regionalLanguages ?? [])
      return renderList(
        languages.map((item) => ({
          key: `${item.code}-${item.status}`,
          content:
            item.canonicalCode === 'tzm'
              ? t('Tamazight (Amazigh)')
              : getLanguageName(item.canonicalCode, item.name)
        }))
      )
    }
    if (field === 'currencies') {
      return renderList(
        (details.culture?.currencies ?? []).map((currency) => ({
          key: currency.code,
          content: (
            <>
              {getCurrencyName(currency.code, currency.name)} ({currency.code})
              {currency.symbol ? ` · ${currency.symbol}` : ''}
              <br />
              {currency.euroPerUnit === null || currency.euroPerUnit === undefined
                ? `${t('Conversion en euros')} : ND`
                : `1 ${currency.code} = ${formatEuroPerUnit(currency.euroPerUnit)}`}
              {currency.exchangeRateDate
                ? ` · ${t('Cours au')} ${formatDate(currency.exchangeRateDate)}`
                : ''}
              <br />
              <a href={explorationEconomicSources.currencyRates} target="_blank" rel="noreferrer">
                {t('Source des taux')} · {formatDate(explorationEconomicSources.snapshotDate)}
              </a>
            </>
          )
        }))
      )
    }
    if (field === 'salary') {
      const earnings = details.medianMonthlyEarnings
      return earnings ? (
        <span>
          {formatNumber(earnings.amount)} {earnings.currencyCode} / {t('mois')}
          {earnings.euroPerUnit !== null && (
            <>
              <br />≈ {formatMoney(earnings.amount * earnings.euroPerUnit, 'EUR')} / {t('mois')}
            </>
          )}
          <br />
          {t('Dernière donnée disponible')} · {earnings.year}
          {earnings.status === 'B' ? ` · ${t('Rupture de série')}` : ''}
          {earnings.definition ? ` · ${t(earnings.definition)}` : ''}
          {earnings.exchangeRateDate
            ? ` · ${t('Cours au')} ${formatDate(earnings.exchangeRateDate)}`
            : ''}
          {earnings.sourceName ? (
            <>
              {' '}
              ·{' '}
              <a
                href={earnings.sourceUrl ?? explorationEconomicSources.medianEarnings}
                target="_blank"
                rel="noreferrer"
              >
                {earnings.sourceName}
              </a>
            </>
          ) : null}
        </span>
      ) : (
        <span>ND</span>
      )
    }
    if (field === 'webDomains') {
      return renderList(
        (details.culture?.webDomains ?? []).map((domain, index) => ({
          key: `${domain}-${index}`,
          content: <bdi dir="ltr">{domain}</bdi>
        }))
      )
    }
    if (field === 'writingSystems') {
      return renderList(
        (details.culture?.writingSystems ?? []).map((system) => ({
          key: system.scriptCode,
          content: (
            <>
              <strong>{getScriptName(system.scriptCode)}</strong>
              <br />
              {t('Caractères')}: <bdi dir="auto">{system.characters || 'ND'}</bdi>
              <br />
              {t('Phrase exemple')}
              {system.exampleLanguageCode
                ? ` · ${getLanguageName(system.exampleLanguageCode, system.exampleLanguageCode)}`
                : ''}
              : <bdi dir="auto">{system.example || 'ND'}</bdi>
            </>
          )
        }))
      )
    }
    if (field === 'resources') {
      return details.resources.length ? (
        <ul className="country-comparator-resource-list">
          {details.resources.map((industry: ResourceIndustryFact) => {
            const research = industry.research
            const context = industry.industrialContext
            const lines = [
              research?.worldRank
                ? `${t('Classement mondial vérifié')} : #${research.worldRank.position}${research.worldRank.total ? ` / ${research.worldRank.total}` : ''} · ${localizedResourceText(research.worldRank.metric)} · ${research.worldRank.year}${research.worldRank.share ? ` · ${localizedResourceText(research.worldRank.share)}` : ''}`
                : `${t('Classement mondial vérifié')} : ND`,
              `${t('Poids dans le territoire')} : ${research?.importance ? localizedResourceText(research.importance) : 'ND'}`,
              `${t('Production et savoir-faire')} : ${research?.production ? localizedResourceText(research.production) : 'ND'}`,
              `${t('Travail et conditions')} : ${research?.work ? localizedResourceText(research.work) : 'ND'}`
            ]
            if (context?.manufacturingRank) {
              lines.push(
                `${t('Compétitivité manufacturière')} : #${context.manufacturingRank.position} / ${context.manufacturingRank.total} · ${context.manufacturingRank.year}`
              )
            }
            context?.indicators?.forEach((indicator) => {
              lines.push(
                `${localizedResourceText(indicator.label)} : ${typeof indicator.value === 'string' ? indicator.value : localizedResourceText(indicator.value)} · ${indicator.year}`
              )
            })
            if (industry.sourceDetails)
              lines.push(
                `${t('Activités détaillées mentionnées dans la source (termes originaux)')} : ${industry.sourceDetails}`
              )
            return (
              <li key={industry.id}>
                <span aria-hidden="true">{industry.icon}</span>
                <span>
                  <strong>{t(industry.label)}</strong>
                  <br />
                  {lines.map((line, index) => (
                    <span className="country-comparator-resource-detail" key={index}>
                      {line}
                    </span>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <span>ND</span>
      )
    }
    if (field === 'terrain') {
      const terrain = details.profileFacts?.terrain
      const character = details.profileFacts?.terrainCharacter
      return terrain || character ? (
        <span>
          {character ? (
            <>
              <strong>{localizedProfileText(character)}</strong>
              <br />
            </>
          ) : null}
          {localizedProfileText(terrain)}
        </span>
      ) : (
        <span>ND</span>
      )
    }
    if (field === 'cities') {
      return renderList(
        details.cities.slice(0, 5).map((city) => ({
          key: city.name,
          content: (
            <>
              {city.name}
              {city.population > 0 ? ` · ${formatNumber(city.population)}` : ''}
            </>
          )
        }))
      )
    }
    if (field === 'highestPoint') {
      const point = details.profileFacts?.highestPoint
      return point ? (
        <span>
          {localizedProfileText(point.name)}
          {point.elevationMeters !== null ? ` · ${formatNumber(point.elevationMeters)} m` : ''}
        </span>
      ) : (
        <span>ND</span>
      )
    }
    if (field === 'mountains') {
      const highestName = localizedProfileText(
        details.profileFacts?.highestPoint?.name
      ).toLocaleLowerCase()
      return renderList(
        details.mountains
          .filter((mountain) => mountain.name.toLocaleLowerCase() !== highestName)
          .slice(0, 5)
          .map((mountain) => ({
            key: mountain.name,
            content: (
              <>
                {mountain.name}
                {mountain.elevationMeters !== null
                  ? ` · ${formatNumber(mountain.elevationMeters)} m`
                  : ''}
              </>
            )
          }))
      )
    }
    if (field === 'lowestPoint') {
      const point = details.profileFacts?.lowestPoint
      return point ? (
        <span>
          {localizedProfileText(point.name)}
          {point.elevationMeters !== null ? ` · ${formatNumber(point.elevationMeters)} m` : ''}
        </span>
      ) : (
        <span>ND</span>
      )
    }
    if (field === 'rivers') {
      return renderList(
        (details.profileFacts?.rivers ?? []).map((river, index) => ({
          key: `${river.en}-${index}`,
          content: localizedProfileText(river)
        }))
      )
    }
    if (field === 'government') {
      const facts = details.profileFacts
      const government = facts?.governmentType
      const regime = facts?.politicalRegime
      if (!government && !regime) return <span>ND</span>
      return (
        <span>
          {government
            ? localizedProfileText(government)
            : language === 'fr'
              ? regime?.label
              : regime?.sourceLabel}
          {government && facts?.governmentTypeYear
            ? ` · ${t('description gouvernementale')} ${facts.governmentTypeYear}`
            : ''}
          {regime
            ? ` · ${t('classification V-Dem')} ${regime.year} : ${language === 'fr' ? regime.label : regime.sourceLabel}`
            : ''}
        </span>
      )
    }
    if (field === 'music') {
      const music = details.profileFacts?.music
      if (!music) return <span>ND</span>
      const genre = language === 'fr' ? music.genreFr : music.genre
      const secondGenre = language === 'fr' ? music.secondGenreFr : music.secondGenre
      const date = music.snapshotDate ? formatDate(music.snapshotDate) : String(music.year)
      return (
        <span>
          {genre} · {t('rang')} {music.rank}
          {music.measure === 'streaming-chart'
            ? ` · ${music.sharePercent ?? 'ND'} % · ${date}`
            : music.measure === 'apple-chart'
              ? ` · Apple Music Top 100${music.sharePercent !== null ? ` · ${music.sharePercent} %` : ''} · ${date}`
              : ` · ${music.year}${music.sharePercent !== null ? ` · ${music.sharePercent} % ${t('des répondants')}` : ''}`}
          {secondGenre
            ? `; ${t('rang')} ${music.secondRank} : ${secondGenre}${music.secondSharePercent !== null ? ` · ${music.secondSharePercent} %` : ''}`
            : ''}
          {music.sourceNote ? (
            <>
              <br />
              {localizedProfileText(music.sourceNote)}
            </>
          ) : null}
        </span>
      )
    }
    if (field === 'funFacts') {
      return renderList(
        (details.profileFacts?.funFacts ?? []).map((fact, index) => ({
          key: String(index),
          content: localizedProfileText(fact)
        }))
      )
    }
    if (field === 'historicalFact') {
      return <span>{localizedProfileText(details.profileFacts?.historicalFact)}</span>
    }
    if (field === 'sources') {
      const sourceRows = new Map<string, string>()
      if (details.population !== null && !details.populationSourceUrl)
        sourceRows.set(
          `population-${details.populationSource}`,
          `${t(details.populationSource)}${details.populationYear ? ` · ${details.populationYear}` : ''}`
        )
      if (details.metricsSource)
        sourceRows.set(`metrics-${details.metricsSource}`, t(details.metricsSource))
      if (details.populationSourceUrl)
        sourceRows.set(details.populationSourceUrl, t(details.populationSource))
      if (details.metricsSourceUrl)
        sourceRows.set(details.metricsSourceUrl, t('Source officielle des dimensions'))
      if (details.metricsSecondarySourceUrl)
        sourceRows.set(details.metricsSecondarySourceUrl, t('Source du périmètre'))
      sourceRows.set(
        'nd-explanation',
        t(
          'ND signifie que les sources intégrées ne fournissent pas de donnée exploitable pour ce champ. Les classifications politiques, enquêtes et classements musicaux sont datés.'
        )
      )
      if (details.profileFacts?.sourceUrl)
        sourceRows.set(
          details.profileFacts.sourceUrl,
          `${t('Fiche source du CIA World Factbook')} · ${t('archive mise à jour le 22 janvier 2026')}`
        )
      details.profileFacts?.additionalSources?.forEach((source) =>
        sourceRows.set(source.url, localizedProfileText(source.label))
      )
      if (details.profileFacts?.music?.sourceUrl) {
        sourceRows.set(
          details.profileFacts.music.sourceUrl,
          localizedProfileText(
            details.profileFacts.music.sourceLabel ?? { fr: 'Source musicale', en: 'Music source' }
          )
        )
      }
      details.resources.forEach((industry) => {
        industry.research?.sources.forEach((source) =>
          sourceRows.set(source.url, `${source.name}${source.year ? ` · ${source.year}` : ''}`)
        )
        if (industry.industrialContext?.source) {
          const source = industry.industrialContext.source
          sourceRows.set(source.url, `${source.name}${source.year ? ` · ${source.year}` : ''}`)
        }
      })
      if (details.resources.length && !details.profileFacts?.sourceUrl) {
        sourceRows.set(
          'https://github.com/factbook/factbook.json',
          'CIA World Factbook · archived profile'
        )
      }
      sourceRows.set(
        explorationEconomicSources.currencyRates,
        `${t('Source des taux')} · ${formatDate(explorationEconomicSources.snapshotDate)}`
      )
      sourceRows.set(
        'https://github.com/mledoze/countries',
        `mledoze/countries · ${t('langues officielles, devises et domaines nationaux')} · ODbL-1.0`
      )
      sourceRows.set(
        'https://github.com/unicode-org/cldr',
        `Unicode CLDR · ${t('langues reconnues et systèmes d’écriture')} · Unicode-3.0`
      )
      sourceRows.set(explorationEconomicSources.medianEarnings, t('Base internationale ILOSTAT'))
      if (details.medianMonthlyEarnings) {
        const earnings = details.medianMonthlyEarnings
        const sourceName = earnings.sourceName ?? 'ILOSTAT'
        sourceRows.set(
          `salary-${earnings.sourceUrl ?? sourceName}`,
          `${sourceName} · ${earnings.year}`
        )
      }
      sourceRows.set(
        'https://www.v-dem.net/data/the-v-dem-dataset/',
        `V-Dem · ${t('classification politique 2025')}`
      )
      sourceRows.set(
        'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/',
        `Natural Earth · ${t('réseau hydrographique')}`
      )
      sourceRows.set(
        'https://datacatalog.worldbank.org/search/dataset/0042032/major-rivers-of-the-world',
        `World Bank · ${t('grands fleuves')}`
      )
      sourceRows.set(
        'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-geography-regions-elevation-points/',
        `Natural Earth · ${t('sommets et reliefs')}`
      )
      sourceRows.set(
        'https://www.ifpi.org/wp-content/uploads/2022/11/Engaging-with-Music-2022_full-report.pdf',
        `IFPI · ${t('enquête musicale 2022')}`
      )
      sourceRows.set(
        'https://www.ifpi.org/wp-content/uploads/2023/12/IFPI-Engaging-With-Music-2023_full-report.pdf',
        `IFPI · ${t('enquête musicale 2023')}`
      )
      sourceRows.set(
        'https://rss.applemarketingtools.com/api/v2/us/music/most-played/100/songs.json',
        `Apple · ${language === 'fr' ? 'flux officiel des chansons les plus écoutées' : 'official most-played songs feed'}`
      )
      sourceRows.set(
        'https://spotify-top.com/genres',
        `Spotify Top · ${language === 'fr' ? 'répartition des genres' : 'genre breakdown'}`
      )
      sourceRows.set(
        'https://mostpops.com/lists/music-genres/',
        `MostPops · ${language === 'fr' ? 'source secondaire Apple Top 100' : 'secondary Apple Top 100 source'}`
      )
      return renderList([...sourceRows].map(([key, value]) => ({ key, content: value })))
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
        {field === 'population' && (
          <small>
            {details.populationSourceUrl ? (
              <a href={details.populationSourceUrl} target="_blank" rel="noreferrer">
                {t(details.populationSource)}
              </a>
            ) : (
              t(details.populationSource)
            )}
          </small>
        )}
        {field !== 'population' && details.metricsScope && (
          <small>
            {t(details.metricsScope)}
            {details.metricsSource && (
              <>
                {' '}
                ·{' '}
                {details.metricsSourceUrl ? (
                  <a href={details.metricsSourceUrl} target="_blank" rel="noreferrer">
                    {details.metricsSource}
                  </a>
                ) : (
                  details.metricsSource
                )}
              </>
            )}
          </small>
        )}
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
              onKeyDown={(event) => {
                if (event.key === 'Enter' && suggestions[0]) {
                  event.preventDefault()
                  addCountry(suggestions[0].alpha2)
                }
              }}
              placeholder={t('Rechercher un pays…')}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="country-comparator-suggestions"
            />
            {suggestions.length > 0 && (
              <ul
                id="country-comparator-suggestions"
                className="country-comparator-suggestions"
                role="listbox"
              >
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

          <div className="country-comparator-filters">
            <div className="country-comparator-filters-heading">
              <div>
                <strong>{t('Filtres de pays')}</strong>
                <small>
                  {t(
                    'Ajoute des critères et combine-les en mode simple ou avancé. Les pays correspondants sont ajoutés au comparateur.'
                  )}
                </small>
              </div>
              <div className="country-comparator-filter-actions">
                <button type="button" onClick={addFilter}>
                  ＋ {t('Ajouter un filtre')}
                </button>
              </div>
            </div>

            {filters.map((filter, filterIndex) => {
              const target = filterTargets.find((candidate) => candidate.id === filter.targetId)
              const textOptions =
                target?.kind === 'text' ? (filterOptionValues.get(target.id) ?? []) : []
              const hasDraftColor = filter.flagColors.some(
                (item) =>
                  item.kind === 'wheel' &&
                  item.color.toLowerCase() === filter.colorDraft.toLowerCase()
              )
              return (
                <div className="country-comparator-filter-card" key={filter.id}>
                  <div className="country-comparator-filter-card-heading">
                    <div
                      className="country-comparator-filter-index"
                      aria-label={`${t('Filtre')} ${filterIndex + 1}`}
                    >
                      <span>{t('Filtre')}</span>
                      <strong>{filterIndex + 1}</strong>
                    </div>
                    <label>
                      <span>{t('Caractéristique')}</span>
                      <select
                        value={filter.targetId}
                        onChange={(event) => setFilterTarget(filter.id, event.target.value)}
                      >
                        <option value="">{t('Choisir une caractéristique')}</option>
                        {filterTargets.map((option) => (
                          <option key={option.id} value={option.id}>
                            {t(option.label)}
                            {option.kind === 'flag'
                              ? ''
                              : option.kind === 'number'
                                ? ` · ${t('Valeur numérique')}`
                                : ` · ${t('Texte')}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="country-comparator-filter-remove"
                      aria-label={t('Supprimer ce filtre')}
                      title={t('Supprimer ce filtre')}
                      onClick={() => removeFilter(filter.id)}
                    >
                      ×
                    </button>
                  </div>

                  {target?.kind === 'number' && (
                    <div className="country-comparator-filter-number">
                      <label>
                        <span>{t('Opérateur')}</span>
                        <select
                          value={filter.operator}
                          onChange={(event) =>
                            updateFilter(filter.id, (current) => ({
                              ...current,
                              operator: event.target.value as NumericOperator
                            }))
                          }
                        >
                          {numericOperators.map((operator) => (
                            <option key={operator.id} value={operator.id}>
                              {t(operator.label)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>
                          {filter.operator === 'between' ? t('Valeur minimale') : t('Valeur')}
                        </span>
                        <div className="country-comparator-filter-number-input">
                          <input
                            type="number"
                            step="any"
                            value={filter.value}
                            onChange={(event) =>
                              updateFilter(filter.id, (current) => ({
                                ...current,
                                value: event.target.value
                              }))
                            }
                            placeholder="0"
                          />
                          {target.unit && <small>{target.unit}</small>}
                        </div>
                      </label>
                      {filter.operator === 'between' && (
                        <label>
                          <span>{t('Valeur maximale')}</span>
                          <div className="country-comparator-filter-number-input">
                            <input
                              type="number"
                              step="any"
                              value={filter.upperValue}
                              onChange={(event) =>
                                updateFilter(filter.id, (current) => ({
                                  ...current,
                                  upperValue: event.target.value
                                }))
                              }
                              placeholder="0"
                            />
                            {target.unit && <small>{target.unit}</small>}
                          </div>
                        </label>
                      )}
                    </div>
                  )}

                  {target?.kind === 'text' && (
                    <div className="country-comparator-filter-text">
                      <label>
                        <span>{t('Correspondance')}</span>
                        <select
                          value={filter.textOperator}
                          onChange={(event) =>
                            updateFilter(filter.id, (current) => ({
                              ...current,
                              textOperator: event.target.value as TextOperator
                            }))
                          }
                        >
                          <option value="contains">{t('contient')}</option>
                          <option value="equals">{t('est exactement')}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t('Valeur à rechercher')}</span>
                        <input
                          type="search"
                          list={`country-comparator-filter-options-${filter.id}`}
                          value={filter.textValue}
                          onChange={(event) =>
                            updateFilter(filter.id, (current) => ({
                              ...current,
                              textValue: event.target.value
                            }))
                          }
                          placeholder={t('Saisir ou choisir une valeur')}
                          autoComplete="off"
                        />
                        <datalist id={`country-comparator-filter-options-${filter.id}`}>
                          {textOptions.map((option) => (
                            <option key={normalizeSearch(option)} value={option} />
                          ))}
                        </datalist>
                      </label>
                    </div>
                  )}

                  {target?.kind === 'flag' && (
                    <div className="country-comparator-flag-filter">
                      <div className="country-comparator-flag-color-row">
                        <label>
                          <span>{t('Couleur personnalisée')}</span>
                          <input
                            type="color"
                            value={filter.colorDraft}
                            onChange={(event) =>
                              updateFilter(filter.id, (current) => ({
                                ...current,
                                colorDraft: event.target.value
                              }))
                            }
                            aria-label={t('Choisir une couleur de drapeau')}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={hasDraftColor}
                          onClick={() =>
                            updateFilter(filter.id, (current) => ({
                              ...current,
                              flagColors: hasDraftColor
                                ? current.flagColors
                                : [
                                    ...current.flagColors,
                                    { kind: 'wheel', color: current.colorDraft }
                                  ]
                            }))
                          }
                        >
                          {t('Ajouter la couleur')}
                        </button>
                      </div>
                      <div
                        className="country-comparator-flag-color-options"
                        aria-label={t('Couleurs du drapeau')}
                      >
                        {flagNamedColorOptions.map((option) => {
                          const active = filter.flagColors.some(
                            (item) => item.kind === 'named' && item.id === option.id
                          )
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={active ? 'is-active' : undefined}
                              aria-pressed={active}
                              onClick={() =>
                                updateFilter(filter.id, (current) => ({
                                  ...current,
                                  flagColors: active
                                    ? current.flagColors.filter(
                                        (item) => item.kind !== 'named' || item.id !== option.id
                                      )
                                    : [
                                        ...current.flagColors,
                                        { kind: 'named', id: option.id as FlagNamedColorFilterId }
                                      ]
                                }))
                              }
                            >
                              <i style={{ backgroundColor: option.swatch }} />
                              {t(option.label)}
                            </button>
                          )
                        })}
                      </div>
                      {filter.flagColors.length > 0 && (
                        <div className="country-comparator-flag-active-colors">
                          <span>{t('Toutes les couleurs sélectionnées sont requises')}</span>
                          {filter.flagColors.map((item, index) => {
                            const title =
                              item.kind === 'named'
                                ? t(
                                    flagNamedColorOptions.find((option) => option.id === item.id)
                                      ?.label ?? item.id
                                  )
                                : item.color
                            return (
                              <button
                                key={`${item.kind}-${item.kind === 'named' ? item.id : item.color}-${index}`}
                                type="button"
                                title={`${t('Retirer le filtre')} ${title}`}
                                aria-label={`${t('Retirer le filtre de couleur')} ${title}`}
                                style={{
                                  backgroundColor:
                                    item.kind === 'named'
                                      ? flagNamedColorOptions.find(
                                          (option) => option.id === item.id
                                        )?.swatch
                                      : item.color
                                }}
                                onClick={() =>
                                  updateFilter(filter.id, (current) => ({
                                    ...current,
                                    flagColors: current.flagColors.filter(
                                      (_, colorIndex) => colorIndex !== index
                                    )
                                  }))
                                }
                              />
                            )
                          })}
                        </div>
                      )}
                      <label className="country-comparator-flag-band-count">
                        <span>
                          {t('Nombre de bandes')} ·{' '}
                          {filter.bandCount === 0 ? t('Tous') : filter.bandCount}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={maxFlagBandCount}
                          step={1}
                          value={filter.bandCount}
                          onChange={(event) =>
                            updateFilter(filter.id, (current) => ({
                              ...current,
                              bandCount: Number(event.target.value)
                            }))
                          }
                        />
                      </label>
                      <div className="country-comparator-flag-directions">
                        {(
                          [
                            ['horizontal', 'Horizontales'],
                            ['vertical', 'Verticales'],
                            ['oblique', 'Obliques']
                          ] as const
                        ).map(([direction, label]) => (
                          <label key={direction}>
                            <input
                              type="checkbox"
                              checked={filter.bandDirections.includes(direction)}
                              onChange={() =>
                                updateFilter(filter.id, (current) => ({
                                  ...current,
                                  bandDirections: current.bandDirections.includes(direction)
                                    ? current.bandDirections.filter((item) => item !== direction)
                                    : [...current.bandDirections, direction]
                                }))
                              }
                            />
                            {t(label)}
                          </label>
                        ))}
                      </div>
                      <FlagRatioFilter
                        availableRatios={availableFlagRatios}
                        availablePolygonShapes={availablePolygonShapes}
                        selectedRatioRange={filter.ratioRange}
                        selectedPolygon={filter.polygon}
                        onRatioRangeChange={(range) =>
                          updateFilter(filter.id, (current) => ({ ...current, ratioRange: range }))
                        }
                        onPolygonChange={(polygon) =>
                          updateFilter(filter.id, (current) => ({ ...current, polygon }))
                        }
                        disabled={false}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {activeFilters.length >= 2 && (
              <div className="country-comparator-filter-controls">
                <label className="country-comparator-filter-simple-mode">
                  <span>{t('Logique')}</span>
                  <select
                    value={hasAdvancedFilterRules ? 'advanced' : simpleFilterLogic}
                    onChange={(event) => {
                      const nextLogic = event.target.value
                      if (nextLogic !== 'union' && nextLogic !== 'intersection') return
                      setSimpleFilterLogic(nextLogic)
                      setFilterRelationOverrides({})
                      setCustomRelationEditors({})
                      setFilterGroups([])
                      setExcludedFilteredAlpha2([])
                    }}
                  >
                    <option value="union">{t('+ · Au moins un filtre')}</option>
                    <option value="intersection">{t('ET · Tous les filtres')}</option>
                    {hasAdvancedFilterRules && (
                      <option value="advanced">{t('Avancé personnalisé')}</option>
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  className="country-comparator-advanced-toggle"
                  aria-label={t(
                    isAdvancedFilterOpen
                      ? 'Masquer le calculateur avancé'
                      : 'Afficher le calculateur avancé'
                  )}
                  aria-expanded={isAdvancedFilterOpen}
                  aria-controls="country-comparator-filter-calculator-content"
                  onClick={() => setIsAdvancedFilterOpen((current) => !current)}
                >
                  {t('Avancé')} <span aria-hidden="true">{isAdvancedFilterOpen ? '⌃' : '⌄'}</span>
                </button>
              </div>
            )}

            {activeFilters.length >= 2 && (
              <section
                id="country-comparator-filter-calculator-content"
                className="country-comparator-filter-calculator"
                aria-label={t('Calculateur avancé')}
                hidden={!isAdvancedFilterOpen}
              >
                <p className="country-comparator-filter-calculator-heading">
                  {t(
                    'Choisis une relation entre chaque paire ; sans parenthèses, les relations sont évaluées de gauche à droite.'
                  )}
                </p>
                <div className="country-comparator-filter-relations">
                  {activeFilters.slice(0, -1).map((filter, index) => {
                    const nextFilter = activeFilters[index + 1]
                    const relationKey = `${filter.id}::${nextFilter.id}`
                    const regions = getFilterRelationRegions(filter, nextFilter)
                    const matchingOperation = comparatorFilterOperations.find(
                      (operation) =>
                        operation.regions.length === regions.length &&
                        operation.regions.every((region) => regions.includes(region))
                    )
                    const isCustom = customRelationEditors[relationKey] ?? !matchingOperation
                    return (
                      <div className="country-comparator-filter-relation" key={relationKey}>
                        <span className="country-comparator-filter-relation-pair">
                          {t('Filtre')} {index + 1} <span aria-hidden="true">↔</span> {t('Filtre')}{' '}
                          {index + 2}
                        </span>
                        <label>
                          <span>{t('Relation')}</span>
                          <select
                            value={
                              customRelationEditors[relationKey]
                                ? 'custom'
                                : (matchingOperation?.id ?? 'custom')
                            }
                            onChange={(event) => {
                              const operation = comparatorFilterOperations.find(
                                (item) => item.id === event.target.value
                              )
                              setFilterRelationOverrides((current) => ({
                                ...current,
                                [relationKey]:
                                  operation?.regions ?? simpleFilterRegions[simpleFilterLogic]
                              }))
                              setCustomRelationEditors((current) => ({
                                ...current,
                                [relationKey]: !operation
                              }))
                              setExcludedFilteredAlpha2([])
                            }}
                          >
                            <option value="custom">{t('Personnalisée')}</option>
                            {comparatorFilterOperations.map((operation) => (
                              <option key={operation.id} value={operation.id}>
                                {t(operation.label)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {isCustom && (
                          <div
                            className="country-comparator-filter-truth-grid"
                            role="group"
                            aria-label={t('Zones de résultat à inclure')}
                          >
                            {comparatorFilterRegions.map((region) => {
                              const checked = regions.includes(region.id)
                              return (
                                <label
                                  key={region.id}
                                  className={checked ? 'is-active' : undefined}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setFilterRelationOverrides((current) => ({
                                        ...current,
                                        [relationKey]: checked
                                          ? regions.filter((item) => item !== region.id)
                                          : [...regions, region.id]
                                      }))
                                      setExcludedFilteredAlpha2([])
                                    }}
                                  />
                                  <span>{t(region.label)}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="country-comparator-filter-groups">
                  <strong>{t('Groupes parenthésés')}</strong>
                  {activeFilterGroups.map((group, groupIndex) => (
                    <div className="country-comparator-filter-group-row" key={group.id}>
                      <strong>
                        {t('Parenthèse')} {groupIndex + 1}
                      </strong>
                      <label>
                        <span>{t('Du filtre')}</span>
                        <select
                          value={group.startFilterId}
                          onChange={(event) =>
                            updateFilterGroupEndpoint(group.id, 'start', event.target.value)
                          }
                        >
                          {activeFilters
                            .map((filter, index) => ({ filter, index }))
                            .filter(
                              ({ index }) =>
                                index < group.endIndex &&
                                !groupWouldCrossExisting(index, group.endIndex, group.id)
                            )
                            .map(({ filter, index }) => (
                              <option
                                key={filter.id}
                                value={filter.id}
                              >{`${t('Filtre')} ${index + 1}`}</option>
                            ))}
                        </select>
                      </label>
                      <label>
                        <span>{t('Au filtre')}</span>
                        <select
                          value={group.endFilterId}
                          onChange={(event) =>
                            updateFilterGroupEndpoint(group.id, 'end', event.target.value)
                          }
                        >
                          {activeFilters
                            .map((filter, index) => ({ filter, index }))
                            .filter(
                              ({ index }) =>
                                index > group.startIndex &&
                                !groupWouldCrossExisting(group.startIndex, index, group.id)
                            )
                            .map(({ filter, index }) => (
                              <option
                                key={filter.id}
                                value={filter.id}
                              >{`${t('Filtre')} ${index + 1}`}</option>
                            ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label={`${t('Retirer le groupe')} ${group.startIndex + 1}–${group.endIndex + 1}`}
                        onClick={() => {
                          setFilterGroups((current) =>
                            current.filter((item) => item.id !== group.id)
                          )
                          setExcludedFilteredAlpha2([])
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="country-comparator-filter-group-builder">
                    <label>
                      <span>{t('Du filtre')}</span>
                      <select
                        value={selectedGroupStart?.id ?? ''}
                        onChange={(event) => setGroupStartFilterId(event.target.value)}
                      >
                        {activeFilters.map((filter, index) => (
                          <option
                            key={filter.id}
                            value={filter.id}
                          >{`${t('Filtre')} ${index + 1}`}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{t('Au filtre')}</span>
                      <select
                        value={selectedGroupEnd?.id ?? ''}
                        onChange={(event) => setGroupEndFilterId(event.target.value)}
                      >
                        {activeFilters.map((filter, index) => (
                          <option
                            key={filter.id}
                            value={filter.id}
                          >{`${t('Filtre')} ${index + 1}`}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={!canAddFilterGroup} onClick={addFilterGroup}>
                      ＋ {t('Ajouter une parenthèse')}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeFilters.length > 0 && (
              <div className="country-comparator-filter-summary" aria-live="polite">
                <span>
                  {filteredAlpha2.length} {t('pays ajoutés au comparateur')} ·{' '}
                  {filteredCountries.length} {t('correspondances')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilters([])
                    setFilterRelationOverrides({})
                    setCustomRelationEditors({})
                    setFilterGroups([])
                    setIsAdvancedFilterOpen(false)
                    setExcludedFilteredAlpha2([])
                  }}
                >
                  {t('Effacer les filtres')}
                </button>
              </div>
            )}
            {activeFilters.length > 0 && (
              <details className="country-comparator-filter-explanation">
                <summary>
                  {t('Comprendre les correspondances')} · {filteredCountries.length}
                </summary>
                <p className="country-comparator-filter-expression">{filterExpressionSummary}</p>
                {filteredCountries.length > 0 ? (
                  <ul>
                    {filteredCountries.map((country) => (
                      <li key={country.alpha2}>
                        <strong>{country.name}</strong>
                        <span>
                          {activeFilters
                            .map((filter, index) =>
                              matchesFilter(country, filter)
                                ? `${t('Filtre')} ${index + 1} ✓`
                                : `${t('Filtre')} ${index + 1} —`
                            )
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('Aucun pays ne correspond à cette combinaison.')}</p>
                )}
              </details>
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
                    onClick={() => removeComparedCountry(country.alpha2)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="country-comparator-empty-hint">
              {t('Recherche un pays pour commencer la comparaison.')}
            </p>
          )}
        </section>

        <section className="country-comparator-fields">
          <div className="country-comparator-section-heading">
            <div>
              <span className="section-label">{t('INFORMATIONS')}</span>
              <h2>{t('Éléments à comparer')}</h2>
            </div>
            <div className="country-comparator-field-search">
              <input
                type="search"
                value={fieldSearch}
                placeholder={t('Rechercher un élément à comparer…')}
                aria-label={t('Rechercher un élément à comparer')}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={fieldSearchIsOpen && fieldSearchQuery.length > 0}
                aria-controls="country-comparator-field-suggestions"
                onFocus={() => setFieldSearchIsOpen(true)}
                onChange={(event) => {
                  setFieldSearch(event.target.value)
                  setFieldSearchIsOpen(true)
                }}
                onBlur={() => setFieldSearchIsOpen(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setFieldSearchIsOpen(false)
                  if (event.key === 'Enter' && fieldSuggestions[0]) {
                    event.preventDefault()
                    addCompareField(fieldSuggestions[0].id)
                  }
                }}
              />
              {fieldSearchIsOpen && fieldSearchQuery.length > 0 && (
                <ul
                  id="country-comparator-field-suggestions"
                  className="country-comparator-field-suggestions"
                  role="listbox"
                >
                  {fieldSuggestions.length > 0 ? (
                    fieldSuggestions.map((field) => (
                      <li key={field.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => addCompareField(field.id)}
                        >
                          <span>{t(field.label)}</span>
                          <span aria-hidden="true">＋</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="country-comparator-field-no-suggestions">
                      {t('Aucun élément correspondant à ajouter.')}
                    </li>
                  )}
                </ul>
              )}
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
                      return (
                        <th key={field.id} scope="col">
                          {t(field.label)}
                        </th>
                      )
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
            {t(
              'Les mesures géographiques sont approximatives ; les données absentes sont indiquées comme indisponibles.'
            )}
          </p>
        </section>
      </main>
    </div>
  )
}
