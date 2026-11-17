import countryCatalog from './countryCatalog.json'
import countryExplorationData from './countryExplorationData.json'
import countryProfileFacts from './countryProfileFacts.json'
import type { AppLanguage } from '../i18n'
import { getContinentLabelForCountry, quizRegions, type QuizRegion } from './countryContinents'
import { shuffleItems } from './useQuizSession'

type CountryMeasurement = {
  alpha2: string
  population?: number
  metrics?: {
    areaKm2?: number
    perimeterKm?: number
    northSouthKm?: number
    eastWestKm?: number
  }
  cities?: Array<{ name: string; population: number }>
}

type ProfileMeasurement = {
  highestPoint?: { elevationMeters?: number }
}

export type EstimationQuestion = {
  id: string
  regionName: string
  metricLabel: string
  actualValue: number
  unit: string
  prompt: string
}

const countries = countryExplorationData.countries as CountryMeasurement[]
const profileByAlpha2 = countryProfileFacts.byAlpha2 as Record<string, ProfileMeasurement>
const regionNames: Record<AppLanguage, Record<QuizRegion, string>> = {
  fr: { world: 'le monde', africa: 'l’Afrique', 'north-america': 'l’Amérique du Nord', 'south-america': 'l’Amérique du Sud', asia: 'l’Asie', europe: 'l’Europe', oceania: 'l’Océanie' },
  en: { world: 'the world', africa: 'Africa', 'north-america': 'North America', 'south-america': 'South America', asia: 'Asia', europe: 'Europe', oceania: 'Oceania' },
  es: { world: 'el mundo', africa: 'África', 'north-america': 'América del Norte', 'south-america': 'América del Sur', asia: 'Asia', europe: 'Europa', oceania: 'Oceanía' }
}
const localizedMetricText: Record<AppLanguage, Record<string, { label: string; unit: string }>> = {
  fr: {
    population: { label: 'Population', unit: 'habitants' },
    area: { label: 'Superficie', unit: 'km²' },
    populationDensity: { label: 'Densité de population', unit: 'hab./km²' },
    perimeter: { label: 'Périmètre', unit: 'km' },
    northSouth: { label: 'Étendue du nord au sud', unit: 'km' },
    eastWest: { label: 'Étendue d’est en ouest', unit: 'km' },
    highestPoint: { label: 'Altitude du point culminant', unit: 'm' },
    largestCity: { label: 'Population de la plus grande ville répertoriée', unit: 'habitants' }
  },
  en: {
    population: { label: 'Population', unit: 'people' },
    area: { label: 'Area', unit: 'km²' },
    populationDensity: { label: 'Population density', unit: 'people/km²' },
    perimeter: { label: 'Perimeter', unit: 'km' },
    northSouth: { label: 'North to south extent', unit: 'km' },
    eastWest: { label: 'East to west extent', unit: 'km' },
    highestPoint: { label: 'Highest point elevation', unit: 'm' },
    largestCity: { label: 'Population of the largest listed city', unit: 'people' }
  },
  es: {
    population: { label: 'Población', unit: 'habitantes' },
    area: { label: 'Superficie', unit: 'km²' },
    populationDensity: { label: 'Densidad de población', unit: 'hab./km²' },
    perimeter: { label: 'Perímetro', unit: 'km' },
    northSouth: { label: 'Extensión de norte a sur', unit: 'km' },
    eastWest: { label: 'Extensión de este a oeste', unit: 'km' },
    highestPoint: { label: 'Altitud del punto más alto', unit: 'm' },
    largestCity: { label: 'Población de la ciudad más grande registrada', unit: 'habitantes' }
  }
}

const prompts: Record<AppLanguage, (metric: string, region: string) => string> = {
  fr: (metric, region) => `Estime ${metric.toLocaleLowerCase('fr')} pour ${region}.`,
  en: (metric, region) => `Estimate ${metric.toLocaleLowerCase('en')} for ${region}.`,
  es: (metric, region) => `Estima ${metric.toLocaleLowerCase('es')} de ${region}.`
}

function groupLabel(alpha2s: string[], language: AppLanguage): string {
  const countryNames = new Intl.DisplayNames([language], { type: 'region' })
  const fallbackNames = new Map(
    (countryCatalog as { alpha2: string; countryName: string }[]).map((country) => [country.alpha2, country.countryName])
  )
  const names = alpha2s.map((code) => countryNames.of(code) ?? fallbackNames.get(code) ?? code)
  if (names.length === 1) return names[0]
  if (names.length <= 3) return names.join(', ')
  const suffix = language === 'fr' ? 'autres territoires' : language === 'es' ? 'otros territorios' : 'other territories'
  const conjunction = language === 'fr' ? 'et' : language === 'es' ? 'y' : 'and'
  return `${names.slice(0, 3).join(', ')} ${conjunction} ${names.length - 3} ${suffix}`
}

function sumMetric(records: CountryMeasurement[], getValue: (record: CountryMeasurement) => number | undefined): number | undefined {
  const values = records.map(getValue)
  if (values.some((value) => value === undefined || !Number.isFinite(value))) return undefined
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

function createMetricRows(
  records: CountryMeasurement[],
  alpha2s: string[],
  regionName: string,
  language: AppLanguage
): EstimationQuestion[] {
  const text = localizedMetricText[language]
  const singleCountry = records.length === 1
  const totalPopulation = sumMetric(records, (record) => record.population)
  const totalArea = sumMetric(records, (record) => record.metrics?.areaKm2)
  const metrics: Array<{ id: string; value: number | undefined; groupMetric?: boolean }> = [
    { id: 'population', value: totalPopulation },
    { id: 'area', value: totalArea },
    { id: 'populationDensity', value: totalPopulation && totalArea ? totalPopulation / totalArea : undefined },
    ...(singleCountry ? [
      { id: 'perimeter', value: records[0].metrics?.perimeterKm },
      { id: 'northSouth', value: records[0].metrics?.northSouthKm },
      { id: 'eastWest', value: records[0].metrics?.eastWestKm }
    ] : []),
    {
      id: 'highestPoint',
      value: Math.max(...records.map((record) => profileByAlpha2[record.alpha2]?.highestPoint?.elevationMeters ?? Number.NEGATIVE_INFINITY))
    },
    {
      id: 'largestCity',
      value: Math.max(...records.map((record) => Math.max(0, ...(record.cities ?? []).map((city) => city.population))))
    }
  ]

  return metrics.flatMap(({ id, value }) => {
    if (value === undefined || !Number.isFinite(value) || value <= 0) return []
    const metric = text[id]
    return [{
      id: `${alpha2s.join('-')}:${id}`,
      regionName,
      metricLabel: metric.label,
      actualValue: id === 'populationDensity' ? Number(value.toPrecision(3)) : Math.round(value),
      unit: metric.unit,
      prompt: prompts[language](metric.label, regionName)
    }]
  })
}

export function createEstimationQuestions(
  region: QuizRegion,
  selectedAlpha2s: readonly string[],
  language: AppLanguage,
  count = 10
): EstimationQuestion[] {
  const selected = new Set(selectedAlpha2s.map((code) => code.toUpperCase()))
  const scopedCountries = selected.size > 0
    ? countries.filter((country) => selected.has(country.alpha2))
    : countries.filter((country) =>
        region === 'world' || getContinentLabelForCountry(country.alpha2) ===
          (quizRegions.find((candidate) => candidate.id === region)?.label ?? '')
      )
  if (!scopedCountries.length) return []

  const pool = selected.size > 0
    ? scopedCountries.flatMap((country) => {
        const countryName = groupLabel([country.alpha2], language)
        return createMetricRows([country], [country.alpha2], countryName, language)
      })
    : createMetricRows(
        scopedCountries,
        scopedCountries.map((country) => country.alpha2),
        regionNames[language][region],
        language
      )
  return shuffleItems(pool).slice(0, Math.min(count, pool.length))
}

export function getEstimationPrecision(answer: number, actual: number): number {
  if (!Number.isFinite(answer) || answer <= 0 || !Number.isFinite(actual) || actual <= 0) return 0
  return Math.max(0, Math.min(1, Math.min(answer / actual, actual / answer)))
}
