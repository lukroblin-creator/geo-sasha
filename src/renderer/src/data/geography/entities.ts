
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
    name: 'Guyane française',
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
  }
]
