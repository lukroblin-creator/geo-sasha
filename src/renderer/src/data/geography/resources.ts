import resourceData from './resourceIndustries.json'
import countryCatalog from '../quiz/countryCatalog.json'

export type ResourceIndustry = {
  id: string
  label: string
  icon: string
  research?: ResourceIndustryResearch
}

export type LocalizedResourceText = {
  fr: string
  en: string
  es: string
}

export type ResourceIndustrySource = {
  name: string
  year?: number
  url: string
}

export type ResourceIndustryResearch = {
  worldRank?: {
    position: number
    total?: number
    year: number
    metric: LocalizedResourceText
    share?: LocalizedResourceText
  }
  importance?: LocalizedResourceText
  production?: LocalizedResourceText
  work?: LocalizedResourceText
  sources: ResourceIndustrySource[]
}

export type ResourceIndustryContext = {
  manufacturingRank?: {
    position: number
    total: number
    year: number
  }
  indicators?: Array<{
    label: LocalizedResourceText
    value: string | LocalizedResourceText
    year: number
  }>
  source?: ResourceIndustrySource
}

export type ResourceIndustryFact = ResourceIndustry & {
  sourceDetails: string
  industrialContext?: ResourceIndustryContext
}

type ResourceEntityRecord = {
  sourceName: string
  sourceProfile: string
  sourceText: string
  industries: ResourceIndustry[]
  industrialContext?: ResourceIndustryContext
}

type ResourceIndustryData = {
  entities: Record<string, ResourceEntityRecord>
}

type CountryCatalogEntry = {
  sourceFeatureId: number
  alpha2: string
}

const industriesByEntity = (resourceData as ResourceIndustryData).entities

export function getResourceIndustryCount(): number {
  return Object.values(industriesByEntity).reduce(
    (total, record) => total + record.industries.length,
    0
  )
}

function normalizeSourceFeatureId(sourceFeatureId: string | number): string {
  const value = String(sourceFeatureId).trim()
  return /^\d+$/.test(value) ? String(Number(value)) : value
}

const entityIdBySourceFeatureId = new Map(
  (countryCatalog as CountryCatalogEntry[]).map((country) => [
    normalizeSourceFeatureId(country.sourceFeatureId),
    `country:${country.alpha2.toLowerCase()}`
  ])
)

const descriptionByIndustry: Record<string, string> = {
  agriculture:
    'Les activités agricoles et la transformation des produits alimentaires recensées dans ce territoire.',
  mining:
    'L’extraction ou le traitement de minerais et de ressources du sous-sol recensés dans ce territoire.',
  energy:
    'La production, l’extraction ou la transformation de ressources énergétiques recensées dans ce territoire.',
  fishery:
    'La pêche, l’aquaculture ou la transformation de produits de la mer recensées dans ce territoire.',
  forestry: 'L’exploitation forestière et la transformation du bois recensées dans ce territoire.',
  automotive: 'La fabrication ou l’assemblage de véhicules recensés dans ce territoire.',
  aerospace:
    'La fabrication ou les activités aéronautiques et spatiales recensées dans ce territoire.',
  textiles:
    'La fabrication de textiles, de vêtements ou d’articles en cuir recensée dans ce territoire.',
  electronics:
    'La fabrication de matériel électronique ou les télécommunications recensées dans ce territoire.',
  tourism: 'Les activités touristiques recensées dans ce territoire.',
  transport:
    'Les activités de transport, de navigation ou de construction navale recensées dans ce territoire.',
  construction: 'La construction et la production de matériaux recensées dans ce territoire.',
  chemistry: 'La production chimique, pétrochimique ou pharmaceutique recensée dans ce territoire.',
  services: 'Les activités de services, de finance ou d’assurance recensées dans ce territoire.',
  manufacturing: 'Les activités de fabrication et de transformation recensées dans ce territoire.'
}

const evidencePatternByIndustry: Record<string, RegExp> = {
  agriculture:
    /agricultur|food|beverage|sugar|livestock|crop|cotton|coffee|tea|rice|meat|fruit|tobacco|grain|dairy|brew|cocoa|palm oil|foodstuff|agribusiness/i,
  mining:
    /min(e|es|ing|eral|erals)|gold|silver|diamond|copper|cobalt|iron ore|bauxite|uranium|phosphate|lithium|nickel|coal|tin|zinc|chrom|bauxite|potash|salt|rub(y|ies)|coltan|feldspar|asbestos|soda ash|tungsten|manganese|zircon|emerald/i,
  energy:
    /petroleum|oil|natural gas|gas production|gas liquefaction|gas extraction|electricity|power generation|energy|hydrocarbon|refin(e|ing)|coal/i,
  fishery: /fish|fishing|seafood|shrimp|prawn|halibut|aquaculture|fishery/i,
  forestry: /forest|timber|lumber|wood|sawmill|paper|pulp|plywood|carpentry/i,
  automotive: /automotive|automobile|motor vehicle|car assembly|truck assembly|vehicle assembly/i,
  aerospace: /aerospace|aircraft|aviation|aeronautic|spacecraft/i,
  textiles: /textile|clothing|apparel|garment|footwear|shoes|leather|cotton ginning|jute|fashion/i,
  electronics:
    /electronic|telecommunication|wireless communication|computer|fiber optics|electrical machinery|radio and telephone/i,
  tourism: /tourism|tourist|hospitality/i,
  transport: /transport|shipping|ship|boat|maritime|port|railroad|airline|shipyard|vessel/i,
  construction: /construction|cement|building material|public works|brick|glass|road building/i,
  chemistry:
    /chemical|petrochemical|pharmaceutical|pharma|fertili[sz]er|plastics|soap|ammonia|caustic soda|paint|inorganic chemicals/i,
  services:
    /banking|finance|financial|insurance|real estate|information technology|software|retail|services|telecommunications/i,
  manufacturing:
    /manufactur|industr|electrical|industrial machinery|machinery|metal product|metalworking|steel|assembly|consumer goods|processing|fabrication|engineering|handicraft|jewelry|printing|ceramics|glassware|furniture|armaments|precision equipment|watches/i
}

function getSourceDetails(sourceText: string, industryId: string): string {
  const pattern = evidencePatternByIndustry[industryId]
  if (!pattern) return ''

  return [
    ...new Set(
      sourceText
        .replace(/&nbsp;/gi, ' ')
        .split(/[;,]+/)
        .map((detail) => detail.trim().replace(/\s+/g, ' '))
        .filter((detail) => detail && pattern.test(detail))
    )
  ].join('; ')
}

function resolveResourceRecord(
  entityId: string | null,
  sourceFeatureId: string | number | null | undefined
): ResourceEntityRecord | undefined {
  if (entityId) {
    const record = industriesByEntity[entityId]
    if (record) return record
  }

  const countryEntityId =
    sourceFeatureId === null || sourceFeatureId === undefined
      ? undefined
      : entityIdBySourceFeatureId.get(normalizeSourceFeatureId(sourceFeatureId))
  return countryEntityId ? industriesByEntity[countryEntityId] : undefined
}

/** Returns the documented source-ordered industries for an entity. */
export function getResourceIndustries(entityId: string): ResourceIndustry[] {
  return industriesByEntity[entityId]?.industries ?? []
}

/** Returns industries plus territory-specific evidence extracted from the offline source. */
export function getResourceIndustryFactsForMapFeature(
  entityId: string | null,
  sourceFeatureId: string | number | null | undefined
): ResourceIndustryFact[] {
  const record = resolveResourceRecord(entityId, sourceFeatureId)
  if (!record) return []

  return record.industries.map((industry) => ({
    ...industry,
    sourceDetails: getSourceDetails(record.sourceText, industry.id),
    industrialContext: record.industrialContext
  }))
}

/** A localized key describing what each documented industry category includes. */
export function getResourceIndustryDescription(industryId: string): string {
  return descriptionByIndustry[industryId] ?? 'Activité économique recensée dans ce territoire.'
}
