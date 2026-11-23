export type ShortcutModifier = 'Meta' | 'Control' | 'Alt' | 'Shift'

export type KeyboardShortcutBinding = {
  key: string
  modifiers: ShortcutModifier[]
  /** Physical key for user bindings captured with a modifier that changes its character. */
  code?: string
}

type KeyStroke = {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export function normalizeShortcutKey(key: string): string {
  if (key === ' ') return 'Space'
  return key.length === 1 ? key.toLowerCase() : key
}

export function isShortcutModifier(key: string): key is ShortcutModifier {
  return key === 'Meta' || key === 'Control' || key === 'Alt' || key === 'Shift'
}

export function eventModifiers(event: KeyStroke): ShortcutModifier[] {
  const modifiers: ShortcutModifier[] = []
  if (event.metaKey && event.key !== 'Meta') modifiers.push('Meta')
  if (event.ctrlKey && event.key !== 'Control') modifiers.push('Control')
  if (event.altKey && event.key !== 'Alt') modifiers.push('Alt')
  if (event.shiftKey && event.key !== 'Shift') modifiers.push('Shift')
  return modifiers
}

function sameModifiers(a: readonly ShortcutModifier[], b: readonly ShortcutModifier[]): boolean {
  return a.length === b.length && a.every((modifier) => b.includes(modifier))
}

// macOS Option transforms e.g. Digit1 into ¡ and KeyF into ƒ. The digit row
// keeps its printed numbers on French keyboards even when its base glyph is & or é.
function optionKey(code: string, key: string, baseKey?: string): string {
  if (/^Digit[0-9]$/.test(code)) return code.slice(-1)
  if (baseKey) return normalizeShortcutKey(baseKey)
  if (/^Key[A-Z]$/.test(code)) return code.slice(-1).toLowerCase()
  return normalizeShortcutKey(key)
}

export function shortcutMatchesKey(
  binding: KeyboardShortcutBinding | null | undefined,
  code: string,
  key: string,
  modifiers: readonly ShortcutModifier[],
  baseKey?: string
): boolean {
  if (!binding || !sameModifiers(binding.modifiers, modifiers)) return false
  if (binding.code) return binding.code === code
  if (binding.key === normalizeShortcutKey(key)) return true
  return modifiers.includes('Alt') && binding.key === optionKey(code, key, baseKey)
}

export function captureShortcut(event: KeyStroke, baseKey?: string): KeyboardShortcutBinding {
  const modifiers = eventModifiers(event)
  const key = normalizeShortcutKey(event.key)
  if (event.altKey && !isShortcutModifier(key) && event.code && event.code !== 'Unidentified') {
    return { key: optionKey(event.code, key, baseKey), modifiers, code: event.code }
  }
  return { key, modifiers }
}

export function equivalentShortcuts(
  a: KeyboardShortcutBinding | null,
  b: KeyboardShortcutBinding | null
): boolean {
  if (!a || !b || !sameModifiers(a.modifiers, b.modifiers)) return false
  if (a.code && b.code) return a.code === b.code
  return a.key === b.key
}
