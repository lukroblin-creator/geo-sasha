import assert from 'node:assert/strict'
import test from 'node:test'
import {
  captureShortcut,
  equivalentShortcuts,
  eventModifiers,
  shortcutMatchesKey,
  type KeyboardShortcutBinding,
  type ShortcutModifier
} from '../src/renderer/src/data/shortcutKeys.ts'

function stroke(
  code: string,
  key: string,
  modifiers: ShortcutModifier[] = []
): Parameters<typeof captureShortcut>[0] {
  return {
    code,
    key,
    altKey: modifiers.includes('Alt'),
    ctrlKey: modifiers.includes('Control'),
    metaKey: modifiers.includes('Meta'),
    shiftKey: modifiers.includes('Shift')
  }
}

test('Option + chiffre reconnaît la rangée numérotée sur les claviers Mac français et US', () => {
  for (const [i, symbol] of ['¡', '™', '£', '¢', '∞'].entries()) {
    const digit = String(i + 1)
    const event = stroke(`Digit${digit}`, symbol, ['Alt'])
    const binding: KeyboardShortcutBinding = { key: digit, modifiers: ['Alt'] }
    assert.ok(shortcutMatchesKey(binding, event.code, event.key, eventModifiers(event), 'é'))
    assert.ok(!shortcutMatchesKey(binding, event.code, event.key, ['Alt', 'Shift']))
    assert.ok(!shortcutMatchesKey(binding, event.code, event.key, []))
    const captured = captureShortcut(event, 'é')
    assert.equal(captured.key, digit)
    assert.ok(equivalentShortcuts(binding, captured))
    assert.ok(shortcutMatchesKey(captured, event.code, 'é', ['Alt'], 'é'))
  }
})

test('Option utilise la lettre du clavier actif et conserve les anciens raccourcis', () => {
  const event = stroke('KeyA', 'œ', ['Alt'])
  const modifiers = eventModifiers(event)
  for (const key of ['q', 'œ']) {
    assert.ok(shortcutMatchesKey({ key, modifiers }, event.code, event.key, modifiers, 'q'))
  }
  assert.ok(!shortcutMatchesKey({ key: 'a', modifiers }, event.code, event.key, modifiers, 'q'))
  const captured = captureShortcut(event, 'q')
  assert.equal(captured.key, 'q')
  assert.equal(captured.code, 'KeyA')
  assert.ok(shortcutMatchesKey(captured, 'KeyA', 'œ', modifiers))
  assert.ok(!shortcutMatchesKey(captured, 'KeyQ', 'œ', modifiers))
})

test('les touches Entrée et les modificateurs seuls respectent la combinaison exacte', () => {
  const altEnter = { key: 'Enter', modifiers: ['Alt'] } satisfies KeyboardShortcutBinding
  assert.ok(shortcutMatchesKey(altEnter, 'Enter', 'Enter', ['Alt']))
  assert.ok(shortcutMatchesKey(altEnter, 'NumpadEnter', 'Enter', ['Alt']))
  assert.ok(!shortcutMatchesKey(altEnter, 'Enter', 'Enter', ['Control']))
  assert.ok(!shortcutMatchesKey(altEnter, 'Enter', 'Enter', ['Meta', 'Alt']))
  const shift = { key: 'Shift', modifiers: [] }
  assert.ok(
    shortcutMatchesKey(
      shift,
      'ShiftLeft',
      'Shift',
      eventModifiers(stroke('ShiftLeft', 'Shift', ['Shift']))
    )
  )
  assert.ok(
    !shortcutMatchesKey(
      shift,
      'ShiftLeft',
      'Shift',
      eventModifiers(stroke('ShiftLeft', 'Shift', ['Alt', 'Shift']))
    )
  )
})
