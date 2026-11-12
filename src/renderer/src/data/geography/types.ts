// Les grandes catégories d'entités géographiques.
export type GeographicEntityKind =
  'country' | 'territory' | 'administrative-region' | 'disputed-area' | 'other'

// Représente une entité géographique indépendante de sa représentation sur la carte.
export type GeographicEntity = {
  id: string
  name: string
  kind: GeographicEntityKind
  // ISO region code for the entity. A territory can have this without having a distinct flag.
  alpha2?: string

  // ISO region code used for a distinct local flag, when one exists.
  flagAlpha2?: string

  // Permet de rattacher un territoire à un État souverain.
  sovereignEntityId?: string

  // Permet de rattacher une région à une entité administrative supérieure.
  parentEntityId?: string
}

// Décrit l'origine d'un jeu de données géographiques.
export type GeographicDataSource = {
  id: string
  name: string
  provider: string
  license: string
  scale?: string
  resolution?: string
}

// Relie une géométrie issue d'une source à une entité de World Atlas.
export type GeographicGeometryLink = {
  id: string
  entityId: string
  sourceId: string
  sourceFeatureId?: string | number
  // Index du polygone dans le MultiPolygon source. Absent = géométrie entière.
  sourcePolygonIndex?: number
}
