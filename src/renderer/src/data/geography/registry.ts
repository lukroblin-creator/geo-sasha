import type {
  GeographicDataSource,
  GeographicEntity,
  GeographicGeometryLink
} from './types'
import { geographicEntities } from './entities'
import { geographicDataSources } from './sources'
import { geographicGeometryLinks } from './geometries'
import { formatGeographicEntityDisplayName } from './entityDisplayName'

// Recherche une entité à partir de son identifiant.
export function getEntityById(id: string): GeographicEntity | undefined {
  return geographicEntities.find((entity) => entity.id === id)
}

// Recherche les territoires rattachés à une entité souveraine.
export function getTerritoriesBySovereign(
  sovereignEntityId: string
): GeographicEntity[] {
  return geographicEntities.filter(
    (entity) => entity.sovereignEntityId === sovereignEntityId
  )
}

export function getEntityDisplayName(id: string): string | undefined {
  const entity = getEntityById(id)
  if (!entity) return undefined

  const sovereignName = entity.sovereignEntityId
    ? getEntityById(entity.sovereignEntityId)?.name
    : undefined

  return formatGeographicEntityDisplayName(entity, sovereignName)
}

// Récupère toutes les géométries associées à une entité
// ainsi qu'à ses territoires rattachés.
// Récupère l'identifiant d'une entité et ceux de ses territoires rattachés.
export function getRelatedEntityIds(entityId: string): string[] {
  return [
    entityId,
    ...getTerritoriesBySovereign(entityId).map((entity) => entity.id)
  ]
}

// Récupère toutes les géométries associées à une entité
// ainsi qu'à ses territoires rattachés.
export function getGeometryLinksForEntity(
  entityId: string
): GeographicGeometryLink[] {
  const relatedEntityIds = new Set(getRelatedEntityIds(entityId))

  return geographicGeometryLinks.filter(
    (link) => relatedEntityIds.has(link.entityId)
  )
}

// Recherche une géométrie à partir de sa source et de son identifiant d'origine.
export function getGeometryLinkBySourceFeature(
  sourceId: string,
  sourceFeatureId: string | number | undefined
): GeographicGeometryLink | undefined {
  if (sourceFeatureId === undefined || sourceFeatureId === null) {
    return undefined
  }

  return geographicGeometryLinks.find(
    (link) =>
      link.sourceId === sourceId &&
      String(link.sourceFeatureId) === String(sourceFeatureId) &&
      link.sourcePolygonIndex === undefined
  )
}

// Récupère les liens de toutes les entités d'une géométrie source.
export function getGeometryLinksBySourceFeature(
  sourceId: string,
  sourceFeatureId: string | number | undefined
): GeographicGeometryLink[] {
  if (sourceFeatureId === undefined || sourceFeatureId === null) return []

  return geographicGeometryLinks.filter(
    (link) =>
      link.sourceId === sourceId &&
      String(link.sourceFeatureId) === String(sourceFeatureId)
  )
}

// Recherche une source de données.
export function getDataSourceById(id: string): GeographicDataSource | undefined {
  return geographicDataSources.find((source) => source.id === id)
}
