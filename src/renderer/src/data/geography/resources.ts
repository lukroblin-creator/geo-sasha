import resourceData from './resourceIndustries.json'
import countryCatalog from '../quiz/countryCatalog.json'

export type ResourceIndustry = {
  id: string
  label: string
  icon: string
  overview?: LocalizedResourceText
  sources?: ResourceIndustrySource[]
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

type ResourceLanguage = keyof LocalizedResourceText

const sourceHighlightTranslations: Array<{
  pattern: RegExp
  text: LocalizedResourceText
}> = [
  {
    pattern: /light (industr(?:y|ies)|manufacturing)|consumer goods/i,
    text: {
      fr: 'les biens de consommation courante',
      en: 'everyday consumer goods',
      es: 'los bienes de consumo corriente'
    }
  },
  {
    pattern: /automotive parts|motor vehicle parts/i,
    text: { fr: 'les pièces automobiles', en: 'automotive parts', es: 'las piezas de automóvil' }
  },
  {
    pattern: /motor vehicles|automobiles|car assembly|vehicle assembly/i,
    text: { fr: 'les véhicules automobiles', en: 'motor vehicles', es: 'los vehículos' }
  },
  {
    pattern: /aerospace|aircraft|aeronautic/i,
    text: {
      fr: 'les équipements aéronautiques',
      en: 'aerospace equipment',
      es: 'los equipos aeronáuticos'
    }
  },
  {
    pattern: /electronic|microelectronics/i,
    text: {
      fr: 'les composants et équipements électroniques',
      en: 'electronic components and equipment',
      es: 'los componentes y equipos electrónicos'
    }
  },
  {
    pattern: /electrical|electric motors/i,
    text: {
      fr: 'les équipements électriques',
      en: 'electrical equipment',
      es: 'los equipos eléctricos'
    }
  },
  {
    pattern: /telecommunication/i,
    text: {
      fr: 'les équipements de télécommunication',
      en: 'telecommunications equipment',
      es: 'los equipos de telecomunicaciones'
    }
  },
  {
    pattern: /textiles? and (clothing|apparel)|clothing and textiles/i,
    text: {
      fr: 'les textiles et vêtements',
      en: 'textiles and clothing',
      es: 'los textiles y prendas'
    }
  },
  {
    pattern: /leather goods|leather products/i,
    text: { fr: 'les articles en cuir', en: 'leather goods', es: 'los artículos de cuero' }
  },
  {
    pattern: /footwear|shoes/i,
    text: { fr: 'les chaussures', en: 'footwear', es: 'el calzado' }
  },
  {
    pattern: /garments?|clothing|apparel/i,
    text: { fr: 'les vêtements', en: 'clothing', es: 'las prendas de vestir' }
  },
  {
    pattern: /textiles?/i,
    text: { fr: 'les textiles', en: 'textiles', es: 'los textiles' }
  },
  {
    pattern: /food and beverages|processed food and beverages/i,
    text: {
      fr: 'les aliments et boissons transformés',
      en: 'processed food and beverages',
      es: 'los alimentos y bebidas transformados'
    }
  },
  {
    pattern: /food processing|agricultural processing|processed foods?|food products|foodstuffs/i,
    text: {
      fr: 'la transformation agroalimentaire',
      en: 'food processing',
      es: 'la transformación agroalimentaria'
    }
  },
  {
    pattern: /beverages|brewing|beer|soft drinks/i,
    text: { fr: 'les boissons', en: 'beverages', es: 'las bebidas' }
  },
  {
    pattern: /sugar/i,
    text: { fr: 'le sucre', en: 'sugar products', es: 'el azúcar' }
  },
  {
    pattern: /wine/i,
    text: { fr: 'le vin', en: 'wine', es: 'el vino' }
  },
  {
    pattern: /fish processing|seafood/i,
    text: {
      fr: 'les produits de la mer transformés',
      en: 'processed seafood',
      es: 'los productos del mar transformados'
    }
  },
  {
    pattern: /fishing|fishery|aquaculture/i,
    text: {
      fr: 'la pêche et l’aquaculture',
      en: 'fishing and aquaculture',
      es: 'la pesca y acuicultura'
    }
  },
  {
    pattern: /petroleum refining|oil refining|refined petroleum/i,
    text: {
      fr: 'les produits pétroliers raffinés',
      en: 'refined petroleum',
      es: 'los productos petroleros refinados'
    }
  },
  {
    pattern: /liquefied natural gas/i,
    text: {
      fr: 'le gaz naturel liquéfié',
      en: 'liquefied natural gas',
      es: 'el gas natural licuado'
    }
  },
  {
    pattern: /natural gas|gas production/i,
    text: { fr: 'le gaz naturel', en: 'natural gas', es: 'el gas natural' }
  },
  {
    pattern: /petroleum|\boil\b/i,
    text: { fr: 'le pétrole', en: 'petroleum', es: 'el petróleo' }
  },
  {
    pattern: /petrochemicals?/i,
    text: {
      fr: 'les produits pétrochimiques',
      en: 'petrochemicals',
      es: 'los productos petroquímicos'
    }
  },
  {
    pattern: /pharmaceutical/i,
    text: {
      fr: 'les produits pharmaceutiques',
      en: 'pharmaceuticals',
      es: 'los productos farmacéuticos'
    }
  },
  {
    pattern: /fertili[sz]er/i,
    text: { fr: 'les engrais', en: 'fertilizer', es: 'los fertilizantes' }
  },
  {
    pattern: /chemicals?|chemical products/i,
    text: { fr: 'les produits chimiques', en: 'chemicals', es: 'los productos químicos' }
  },
  {
    pattern: /iron and steel|steel/i,
    text: { fr: 'l’acier', en: 'steel', es: 'el acero' }
  },
  {
    pattern: /metal products|metalworking|base metals|metallurgy/i,
    text: { fr: 'les produits métalliques', en: 'metal products', es: 'los productos metálicos' }
  },
  {
    pattern:
      /machinery and equipment|industrial machinery|machine building|machine tools|machinery/i,
    text: {
      fr: 'les machines et équipements',
      en: 'machinery and equipment',
      es: 'la maquinaria y equipos'
    }
  },
  {
    pattern: /shipbuilding/i,
    text: { fr: 'la construction navale', en: 'shipbuilding', es: 'la construcción naval' }
  },
  {
    pattern: /ship repair/i,
    text: { fr: 'la réparation navale', en: 'ship repair', es: 'la reparación naval' }
  },
  {
    pattern: /transportation equipment|transport equipment/i,
    text: {
      fr: 'les équipements de transport',
      en: 'transport equipment',
      es: 'los equipos de transporte'
    }
  },
  {
    pattern: /wood and wood products|wood products|lumber|timber/i,
    text: { fr: 'le bois transformé', en: 'wood products', es: 'los productos de madera' }
  },
  {
    pattern: /pulp and paper|paper/i,
    text: { fr: 'le papier', en: 'paper products', es: 'los productos de papel' }
  },
  {
    pattern: /furniture/i,
    text: { fr: 'le mobilier', en: 'furniture', es: 'los muebles' }
  },
  {
    pattern: /cement/i,
    text: { fr: 'le ciment', en: 'cement', es: 'el cemento' }
  },
  {
    pattern: /construction materials|building materials/i,
    text: {
      fr: 'les matériaux de construction',
      en: 'construction materials',
      es: 'los materiales de construcción'
    }
  },
  {
    pattern: /glass/i,
    text: { fr: 'le verre', en: 'glass products', es: 'los productos de vidrio' }
  },
  {
    pattern: /ceramics/i,
    text: { fr: 'la céramique', en: 'ceramics', es: 'la cerámica' }
  },
  {
    pattern: /rubber/i,
    text: { fr: 'les produits en caoutchouc', en: 'rubber products', es: 'los productos de caucho' }
  },
  {
    pattern: /plastics?/i,
    text: {
      fr: 'les produits en plastique',
      en: 'plastic products',
      es: 'los productos de plástico'
    }
  },
  {
    pattern: /soap/i,
    text: { fr: 'le savon', en: 'soap', es: 'el jabón' }
  },
  {
    pattern: /tobacco|cigarettes/i,
    text: { fr: 'les produits du tabac', en: 'tobacco products', es: 'los productos del tabaco' }
  },
  {
    pattern: /handicrafts?/i,
    text: { fr: 'l’artisanat', en: 'handicrafts', es: 'la artesanía' }
  },
  {
    pattern: /jewelry/i,
    text: { fr: 'la joaillerie', en: 'jewelry', es: 'la joyería' }
  },
  {
    pattern: /printing/i,
    text: { fr: 'l’imprimerie', en: 'printing', es: 'la imprenta' }
  }
]

function formatLocalizedList(items: string[], language: ResourceLanguage): string {
  if (items.length <= 1) return items[0] ?? ''
  const conjunction = language === 'fr' ? ' et ' : language === 'es' ? ' y ' : ' and '
  return `${items.slice(0, -1).join(', ')}${conjunction}${items.at(-1)}`
}

/** Builds a concise, localized synthesis from the documented territory-specific products. */
export function getResourceIndustryOverview(
  industry: ResourceIndustryFact,
  language: ResourceLanguage
): string | null {
  if (industry.overview) return industry.overview[language] || industry.overview.fr

  const highlights = industry.sourceDetails
    .split(';')
    .map((detail) => sourceHighlightTranslations.find(({ pattern }) => pattern.test(detail))?.text)
    .filter((text): text is LocalizedResourceText => Boolean(text))
    .map((text) => text[language] || text.fr)
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 4)

  if (highlights.length === 0) return null
  const list = formatLocalizedList(highlights, language)
  if (language === 'en') return `In this territory, this industry notably includes ${list}.`
  if (language === 'es') return `En este territorio, este sector incluye especialmente ${list}.`
  return `Dans ce territoire, cette filière concerne notamment ${list}.`
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
