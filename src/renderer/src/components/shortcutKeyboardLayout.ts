// DOM codes identify positions. Each pair supplies the unshifted and shifted legends.
export type KeyboardLayoutName = 'AZERTY' | 'QWERTY'
type KeyPair = readonly [string, string]
const codes = (row: string): string[] => row.split(' ')
const letterCodes = (letters: string): string[] => [...letters].map((letter) => 'Key' + letter)

export const keyboardRows = [
  codes('Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'),
  codes(
    'Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace'
  ),
  ['Tab', ...letterCodes('QWERTYUIOP'), ...codes('BracketLeft BracketRight Backslash')],
  ['CapsLock', ...letterCodes('ASDFGHJKL'), ...codes('Semicolon Quote Enter')],
  [
    'ShiftLeft',
    'IntlBackslash',
    ...letterCodes('ZXCVBNM'),
    ...codes('Comma Period Slash ShiftRight')
  ],
  codes('ControlLeft AltLeft MetaLeft Space MetaRight AltRight ControlRight')
]
export const navigationRows = [
  codes('F13 F14 F15'),
  codes('Insert Home PageUp'),
  codes('Delete End PageDown'),
  ['ArrowUp'],
  codes('ArrowLeft ArrowDown ArrowRight')
]
export const keypadRows = [
  codes('F16 F17 F18 F19'),
  codes('NumLock NumpadEqual NumpadDivide NumpadMultiply'),
  codes('Numpad7 Numpad8 Numpad9 NumpadSubtract'),
  codes('Numpad4 Numpad5 Numpad6 NumpadAdd'),
  codes('Numpad1 Numpad2 Numpad3 NumpadEnter'),
  codes('Numpad0 NumpadDecimal')
]

const punctuationCodes = codes(
  'Backquote Minus Equal BracketLeft BracketRight Backslash Semicolon Quote Comma Period Slash IntlBackslash'
)
const layouts: Record<
  KeyboardLayoutName,
  { letters: string; digits: string; punctuation: readonly KeyPair[] }
> = {
  QWERTY: {
    letters: 'qwertyuiopasdfghjklzxcvbnm',
    digits: '!@#$%^&*()',
    punctuation: [
      ['`', '~'],
      ['-', '_'],
      ['=', '+'],
      ['[', '{'],
      [']', '}'],
      ['\\', '|'],
      [';', ':'],
      ["'", '"'],
      [',', '<'],
      ['.', '>'],
      ['/', '?'],
      ['<', '>']
    ]
  },
  AZERTY: {
    letters: 'azertyuiopqsdfghjklwxcvbn,',
    digits: '&é"\'(§è!çà',
    punctuation: [
      ['@', '#'],
      [')', '°'],
      ['-', '_'],
      ['^', '¨'],
      ['$', '*'],
      ['`', '£'],
      ['m', 'M'],
      ['ù', '%'],
      [';', '.'],
      [':', '/'],
      ['=', '+'],
      ['<', '>']
    ]
  }
}
const specialKeys: Record<string, string> = {
  Space: 'Space',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  NumpadEnter: 'Enter',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadEqual: '=',
  NumpadSubtract: '-',
  NumpadAdd: '+',
  NumpadDecimal: '.'
}
export const keyLegends: Record<string, string> = {
  Escape: 'Esc',
  Backspace: '⌫',
  Enter: '↵',
  CapsLock: '⇪',
  Tab: '⇥',
  Shift: '⇧',
  Control: 'Ctrl',
  Alt: '⌥',
  Meta: '⌘',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: '⇞',
  PageDown: '⇟',
  Home: '↖',
  End: '↘',
  Insert: 'Ins',
  Delete: '⌦',
  NumLock: 'Clear',
  Space: '␣'
}

export function keyboardKeyPair(code: string, layout: KeyboardLayoutName): KeyPair {
  const spec = layouts[layout]
  if (code.startsWith('Key')) {
    const letter = spec.letters['QWERTYUIOPASDFGHJKLZXCVBNM'.indexOf(code.slice(3))]
    return [letter, letter === ',' ? '?' : letter.toUpperCase()]
  }
  if (code.startsWith('Digit')) {
    const digit = code.slice(5)
    const symbol = spec.digits[(Number(digit) + 9) % 10]
    return layout === 'AZERTY' ? [symbol, digit] : [digit, symbol]
  }
  const punctuation = spec.punctuation[punctuationCodes.indexOf(code)]
  if (punctuation) return punctuation
  const value = specialKeys[code] ?? code.replace(/^Numpad(\d)$/, '$1')
  return [value, value]
}

// Older macOS bindings can store the character produced by Option instead of a code.
const optionLayers: Record<
  KeyboardLayoutName,
  { letters: KeyPair; digits: KeyPair; punctuation: KeyPair }
> = {
  AZERTY: {
    letters: ['æÂê®†Úºîœπ‡Ò∂ƒﬁÌÏÈ¬‹≈©◊ß~∞', 'ÆÅÊ‚™ŸªïŒ∏Ω∑∆·ﬂÎÍË|›⁄¢√∫ı¿'],
    digits: ['ë“‘{¶«¡Çø', '´„”’[å»ÛÁØ'],
    punctuation: ['•}—ô€@µÙ…÷≠≤', 'Ÿ]–Ô¥#Ó‰•\\±≥']
  },
  QWERTY: {
    letters: ['œ∑´®†¥¨ˆøπåß∂ƒ©˙∆˚¬Ω≈ç√∫˜µ', 'Œ„´‰ˇÁ¨ˆØ∏ÅÍÎÏ˝ÓÔÒ¸˛Ç◊ı˜Â'],
    digits: ['¡™£¢∞§¶•ªº', '⁄€‹›ﬁﬂ‡°·‚'],
    punctuation: ['`–≠“‘«…æ≤≥÷§', '`—±”’»ÚÆ¯˘¿±']
  }
}

export function optionCharacter(
  code: string,
  layout: KeyboardLayoutName,
  shift: boolean
): string | undefined {
  const symbols = optionLayers[layout]
  const layer = shift ? 1 : 0
  if (code.startsWith('Key'))
    return symbols.letters[layer]['QWERTYUIOPASDFGHJKLZXCVBNM'.indexOf(code.slice(3))]
  if (code.startsWith('Digit')) return symbols.digits[layer][(Number(code.slice(5)) + 9) % 10]
  return symbols.punctuation[layer][punctuationCodes.indexOf(code)]
}
