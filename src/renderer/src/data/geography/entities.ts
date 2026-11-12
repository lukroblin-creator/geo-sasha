import type { GeographicEntity } from './types'

// Registre central des entités géographiques de World Atlas.
export const geographicEntities: GeographicEntity[] = [
  {
    id: 'country:france',
    name: 'France',
    kind: 'country',
    alpha2: 'FR'
  },
  {
    id: 'territory:guyane',
    name: 'Guyane',
    kind: 'territory',
    alpha2: 'GF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:guadeloupe',
    name: 'Guadeloupe',
    kind: 'territory',
    alpha2: 'GP',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:martinique',
    name: 'Martinique',
    kind: 'territory',
    alpha2: 'MQ',
    flagAlpha2: 'MQ',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:reunion',
    name: 'La Réunion',
    kind: 'territory',
    alpha2: 'RE',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:mayotte',
    name: 'Mayotte',
    kind: 'territory',
    alpha2: 'YT',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-pierre-et-miquelon',
    name: 'Saint-Pierre-et-Miquelon',
    kind: 'territory',
    alpha2: 'PM',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-barthelemy',
    name: 'Saint-Barthélemy',
    kind: 'territory',
    alpha2: 'BL',
    flagAlpha2: 'BL',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-martin',
    name: 'Saint-Martin',
    kind: 'territory',
    alpha2: 'MF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:polynesie-francaise',
    name: 'Polynésie française',
    kind: 'territory',
    alpha2: 'PF',
    flagAlpha2: 'PF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:nouvelle-caledonie',
    name: 'Nouvelle-Calédonie',
    kind: 'territory',
    alpha2: 'NC',
    flagAlpha2: 'NC',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:wallis-et-futuna',
    name: 'Wallis-et-Futuna',
    kind: 'territory',
    alpha2: 'WF',
    flagAlpha2: 'WF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:taaf',
    name: 'Terres australes et antarctiques françaises',
    kind: 'territory',
    alpha2: 'TF',
    flagAlpha2: 'TF',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:clipperton',
    name: 'Clipperton',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  }
]
