import type { GeographicEntity } from './types'

// Registre central des entités géographiques de World Atlas.
export const geographicEntities: GeographicEntity[] = [
  {
    id: 'country:france',
    name: 'France',
    kind: 'country'
  },
  {
    id: 'territory:guyane',
    name: 'Guyane',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:guadeloupe',
    name: 'Guadeloupe',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:martinique',
    name: 'Martinique',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:reunion',
    name: 'La Réunion',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:mayotte',
    name: 'Mayotte',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-pierre-et-miquelon',
    name: 'Saint-Pierre-et-Miquelon',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-barthelemy',
    name: 'Saint-Barthélemy',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:saint-martin',
    name: 'Saint-Martin',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:polynesie-francaise',
    name: 'Polynésie française',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:nouvelle-caledonie',
    name: 'Nouvelle-Calédonie',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:wallis-et-futuna',
    name: 'Wallis-et-Futuna',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:taaf',
    name: 'Terres australes et antarctiques françaises',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  },
  {
    id: 'territory:clipperton',
    name: 'Clipperton',
    kind: 'territory',
    sovereignEntityId: 'country:france'
  }
]
