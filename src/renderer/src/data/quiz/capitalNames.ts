import type { AppLanguage } from '../i18n'

const localizedCapitalNames: Record<string, Partial<Record<AppLanguage, string[]>>> = {
  AT: { fr: ['Vienne'], es: ['Viena'] },
  CN: { fr: ['Pékin'], es: ['Pekín'] },
  CU: { fr: ['La Havane'], es: ['La Habana'] },
  DK: { fr: ['Copenhague', 'Copenhaguen'], es: ['Copenhague'] },
  DZ: { fr: ['Alger'], es: ['Argel'] },
  EG: { fr: ['Le Caire'], es: ['El Cairo'] },
  GB: { fr: ['Londres'], es: ['Londres'] },
  GR: { fr: ['Athènes'], es: ['Atenas'] },
  IN: { fr: ['New Delhi'], es: ['Nueva Delhi'] },
  IR: { fr: ['Téhéran'], es: ['Teherán'] },
  JP: { es: ['Tokio'] },
  KR: { fr: ['Séoul'], es: ['Seúl'] },
  LB: { fr: ['Beyrouth'] },
  NL: { es: ['Ámsterdam'] },
  PL: { fr: ['Varsovie'], es: ['Varsovia'] },
  PT: { fr: ['Lisbonne'], es: ['Lisboa'] },
  RO: { fr: ['Bucarest'], es: ['Bucarest'] },
  RU: { fr: ['Moscou'], es: ['Moscú'] },
  SE: { es: ['Estocolmo'] },
  UA: { fr: ['Kyiv', 'Kiev'], es: ['Kyiv', 'Kiev'] },
  CH: { es: ['Berna'] },
  CZ: { fr: ['Prague'], es: ['Praga'] }
}

export function getLocalizedCapitalName(
  alpha2: string,
  canonicalName: string,
  language: AppLanguage
): string {
  return localizedCapitalNames[alpha2]?.[language]?.[0] ?? canonicalName
}

export function getAcceptedCapitalNames(alpha2: string, canonicalName: string): string[] {
  return [...new Set([canonicalName, ...Object.values(localizedCapitalNames[alpha2] ?? {}).flat()])]
}
