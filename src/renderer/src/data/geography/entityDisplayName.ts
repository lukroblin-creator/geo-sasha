import type { GeographicEntity } from './types'

export function formatGeographicEntityDisplayName(
  entity: Pick<GeographicEntity, 'name' | 'kind' | 'sovereignEntityId'>,
  sovereignName?: string
): string {
  if (entity.kind === 'territory' && entity.sovereignEntityId && sovereignName) {
    return `${entity.name} (${sovereignName})`
  }

  return entity.name
}
