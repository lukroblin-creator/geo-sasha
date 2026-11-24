export type ExplorationViewIdentity = { id: string }

export function listExplorationViews<View extends ExplorationViewIdentity>(
  globalView: View,
  personalViews: readonly View[]
): View[] {
  return [globalView, ...personalViews.filter((view) => view.id !== globalView.id)]
}
