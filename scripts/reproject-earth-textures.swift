import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: swift scripts/reproject-earth-textures.swift <input-directory> <output-directory>\n", stderr)
  exit(2)
}

let inputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let textureFiles = [("earth-day.jpg", "earth-day-mercator.jpg"), ("earth-night.jpg", "earth-night-mercator.jpg"), ("earth-clouds.jpg", "earth-clouds-mercator.jpg")]
let maximumLatitude = 85.0511287798066
let maximumMercatorY = log(tan(Double.pi / 4 + maximumLatitude * Double.pi / 360))

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

for (inputName, outputName) in textureFiles {
  let inputURL = inputDirectory.appendingPathComponent(inputName)
  let outputURL = outputDirectory.appendingPathComponent(outputName)

  guard
    let imageSource = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
  else {
    throw NSError(domain: "EarthTexture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read \(inputURL.path)"])
  }

  let width = image.width
  let sourceHeight = image.height
  // A full-width Web Mercator world is square in projected coordinates.
  // Keeping the original 2:1 equirectangular height would squash it vertically.
  let outputHeight = width
  let bytesPerPixel = 4
  let sourceBytesPerRow = width * bytesPerPixel
  let outputBytesPerRow = width * bytesPerPixel
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.union(CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue))
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let sourcePixels = UnsafeMutablePointer<UInt8>.allocate(capacity: sourceBytesPerRow * sourceHeight)
  let projectedPixels = UnsafeMutablePointer<UInt8>.allocate(capacity: outputBytesPerRow * outputHeight)

  defer {
    sourcePixels.deallocate()
    projectedPixels.deallocate()
  }

  guard
    let sourceContext = CGContext(
      data: sourcePixels,
      width: width,
      height: sourceHeight,
      bitsPerComponent: 8,
      bytesPerRow: sourceBytesPerRow,
      space: colorSpace,
      bitmapInfo: bitmapInfo.rawValue
    ),
    let projectedContext = CGContext(
      data: projectedPixels,
      width: width,
      height: outputHeight,
      bitsPerComponent: 8,
      bytesPerRow: outputBytesPerRow,
      space: colorSpace,
      bitmapInfo: bitmapInfo.rawValue
    )
  else {
    throw NSError(domain: "EarthTexture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot create image buffers for \(inputName)"])
  }

  sourceContext.interpolationQuality = .high
  sourceContext.translateBy(x: 0, y: CGFloat(sourceHeight))
  sourceContext.scaleBy(x: 1, y: -1)
  sourceContext.draw(image, in: CGRect(x: 0, y: 0, width: width, height: sourceHeight))

  for outputRow in 0..<outputHeight {
    let verticalFraction = Double(outputRow) / Double(outputHeight - 1)
    let mercatorY = maximumMercatorY * (1 - 2 * verticalFraction)
    let latitude = (2 * atan(exp(mercatorY)) - Double.pi / 2) * 180 / Double.pi
    // CoreGraphics bitmap rows are stored bottom-up; translate geographic latitude to that row order.
    let sourceRowPosition = (latitude + 90) / 180 * Double(sourceHeight - 1)
    let lowerSourceRow = Int(sourceRowPosition.rounded(.down))
    let upperSourceRow = min(lowerSourceRow + 1, sourceHeight - 1)
    let rowBlend = sourceRowPosition - Double(lowerSourceRow)
    let outputRowPixels = projectedPixels.advanced(by: outputRow * outputBytesPerRow)
    let lowerRowPixels = sourcePixels.advanced(by: lowerSourceRow * sourceBytesPerRow)
    let upperRowPixels = sourcePixels.advanced(by: upperSourceRow * sourceBytesPerRow)

    for byteIndex in 0..<outputBytesPerRow {
      let lowerValue = Double(lowerRowPixels[byteIndex])
      let upperValue = Double(upperRowPixels[byteIndex])
      outputRowPixels[byteIndex] = UInt8((lowerValue * (1 - rowBlend) + upperValue * rowBlend).rounded())
    }
  }

  guard
    let projectedImage = projectedContext.makeImage(),
    let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
  else {
    throw NSError(domain: "EarthTexture", code: 3, userInfo: [NSLocalizedDescriptionKey: "Cannot encode projected image \(inputName)"])
  }

  CGImageDestinationAddImage(destination, projectedImage, [kCGImageDestinationLossyCompressionQuality: 0.96] as CFDictionary)
  guard CGImageDestinationFinalize(destination) else {
    throw NSError(domain: "EarthTexture", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot write projected image \(outputURL.path)"])
  }

  print("Reprojected \(inputName) as \(outputName) to \(width) × \(outputHeight) Web Mercator pixels")
}
