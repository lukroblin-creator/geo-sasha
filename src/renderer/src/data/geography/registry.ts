import { geographicEntities } from './entities'
import { geographicDataSources } from './sources'
import { geographicGeometryLinks } from './geometries'

// Recherche une entité à partir de son identifiant.
export function getEntityById(id: string) {
  return geographicEntities.find((entity) => entity.id === id)
}

// Recherche les territoires rattachés à une entité souveraine.
export function getTerritoriesBySovereign(sovereignEntityId: string) {
  return geographicEntities.filter(
    (entity) => entity.sovereignEntityId === sovereignEntityId
  )
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
export function getGeometryLinksForEntity(entityId: string) {
  const relatedEntityIds = new Set(getRelatedEntityIds(entityId))

  return geographicGeometryLinks.filter(
    (link) => relatedEntityIds.has(link.entityId)
  )
}

// Recherche une géométrie à partir de sa source et de son identifiant d'origine.
export function getGeometryLinkBySourceFeature(
  sourceId: string,
  sourceFeatureId: string | number | undefined
) {
  if (sourceFeatureId === undefined || sourceFeatureId === null) {
    return undefined
  }

  return geographicGeometryLinks.find(
    (link) =>
      link.sourceId === sourceId &&
      String(link.sourceFeatureId) === String(sourceFeatureId)
  )
}

// Recherche une source de données.
export function getDataSourceById(id: string) {
  return geographicDataSources.find((source) => source.id === id)
}
