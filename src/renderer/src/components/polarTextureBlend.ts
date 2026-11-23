export function createPolarBlendPixels(
  edgePixels: Uint8ClampedArray,
  rowCount: number,
  edgeAtBottom: boolean
): Uint8ClampedArray {
  const width = Math.floor(edgePixels.length / 4)
  const result = new Uint8ClampedArray(width * rowCount * 4)
  if (width === 0 || rowCount === 0) return result

  const average = [0, 0, 0, 0]
  for (let x = 0; x < width; x += 1) {
    const offset = x * 4
    for (let channel = 0; channel < 4; channel += 1) {
      average[channel] += edgePixels[offset + channel]
    }
  }
  for (let channel = 0; channel < 4; channel += 1) average[channel] /= width

  for (let row = 0; row < rowCount; row += 1) {
    const progress = rowCount === 1 ? 1 : row / (rowCount - 1)
    const edgeStrength = edgeAtBottom ? progress : 1 - progress
    const easedEdgeStrength = edgeStrength * edgeStrength * (3 - 2 * edgeStrength)
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * 4
      const targetOffset = (row * width + x) * 4
      for (let channel = 0; channel < 4; channel += 1) {
        result[targetOffset + channel] = Math.round(
          average[channel] +
            (edgePixels[sourceOffset + channel] - average[channel]) * easedEdgeStrength
        )
      }
    }
  }
  return result
}
