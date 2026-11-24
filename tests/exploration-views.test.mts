import assert from 'node:assert/strict'
import test from 'node:test'
import { listExplorationViews } from '../src/renderer/src/data/geography/explorationViews.ts'

test('the built-in Global view is first and cannot be shadowed by a stored entry', () => {
  const globalView = { id: 'builtin-global', name: 'Global', builtIn: true }
  const personalViews = [
    { id: 'personal-1', name: 'Europe', builtIn: false },
    { id: 'builtin-global', name: 'Old Global', builtIn: false }
  ]

  assert.deepEqual(listExplorationViews(globalView, personalViews), [globalView, personalViews[0]])
  assert.equal(personalViews.length, 2)
  assert.equal(personalViews[1].name, 'Old Global')
})
