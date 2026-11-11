export function flagEmojiFromAlpha2(alpha2: string): string {
  return String.fromCodePoint(
    ...alpha2
      .toUpperCase()
      .split('')
      .map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
  )
}
