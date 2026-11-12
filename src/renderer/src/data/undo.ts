type UndoScope = {
  element: HTMLElement
  undo: () => boolean
}

const undoScopes = new Set<UndoScope>()
let activeUndoScope: UndoScope | null = null

export function registerUndoScope(element: HTMLElement, undo: () => boolean): () => void {
  const scope = { element, undo }
  undoScopes.add(scope)

  return () => {
    undoScopes.delete(scope)
    if (activeUndoScope === scope) activeUndoScope = null
  }
}

export function activateUndoScope(target: EventTarget | null): void {
  const targetNode = target instanceof Node ? target : null
  activeUndoScope = null
  if (!targetNode) return
  for (const scope of undoScopes) {
    if (scope.element.contains(targetNode)) activeUndoScope = scope
  }
}

export function undoActiveScope(): boolean {
  return activeUndoScope?.undo() ?? false
}
