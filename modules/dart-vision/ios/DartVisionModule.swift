import Accelerate
import CoreML
import ExpoModulesCore
import UIKit
import Vision

/// Dart and board keypoints for snap to score (ADR 0011). On the phone only: the photo is read
/// in memory and nothing is sent anywhere.
///
/// The model (`ml/`) takes the whole photo scaled to its square input and returns
/// `heatmaps` [1, 6, H, W] (sigmoid; channels cal20, cal6, cal3, cal11, bull, tip) and
/// `offsets` [1, 2, H, W] (sub-cell x and y). Geometry and scoring happen in TypeScript
/// (`src/domain/camera`).
public class DartVisionModule: Module {
  private var model: VNCoreMLModel?
  private var version: String?
  private var loaded = false

  public func definition() -> ModuleDefinition {
    Name("DartVision")

    AsyncFunction("getCapabilitiesAsync") { () -> [String: Any] in
      self.loadModel()
      return ["model": self.model != nil, "version": self.version ?? NSNull()]
    }

    AsyncFunction("detectAsync") { (uri: String) throws -> [String: Any] in
      self.loadModel()
      let path = URL(string: uri)?.path ?? uri
      guard let raw = UIImage(contentsOfFile: path), let image = raw.upright()?.cgImage else {
        throw ImageNotReadableException()
      }
      var result: [String: Any] = [
        "width": image.width,
        "height": image.height,
        "sharpness": Sharpness.measure(image),
        "modelVersion": NSNull(),
        "keypoints": [String: Any](),
        "tips": [[String: Double]](),
      ]
      guard let model = self.model else { return result }
      let request = VNCoreMLRequest(model: model)
      request.imageCropAndScaleOption = .scaleFill
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
      let features = (request.results as? [VNCoreMLFeatureValueObservation]) ?? []
      let heatmaps = features.first { $0.featureName == "heatmaps" }?.featureValue.multiArrayValue
      let offsets = features.first { $0.featureName == "offsets" }?.featureValue.multiArrayValue
      guard let heatmaps else { throw ModelOutputException() }
      let decoded = HeatmapDecoder.decode(heatmaps: heatmaps, offsets: offsets)
      result["modelVersion"] = self.version ?? NSNull()
      result["keypoints"] = decoded.keypoints
      result["tips"] = decoded.tips
      return result
    }
  }

  /// A model dropped into Documents/models (for trying a new one without a rebuild) wins over
  /// the bundled one.
  private func loadModel() {
    if loaded { return }
    loaded = true
    let config = MLModelConfiguration()
    config.computeUnits = .all
    for url in candidateModels() {
      do {
        let compiled = url.pathExtension == "mlmodelc" ? url : try MLModel.compileModel(at: url)
        let ml = try MLModel(contentsOf: compiled, configuration: config)
        model = try VNCoreMLModel(for: ml)
        let meta = ml.modelDescription.metadata[MLModelMetadataKey.creatorDefinedKey] as? [String: String]
        version =
          meta?["tonup.version"]
          ?? ml.modelDescription.metadata[MLModelMetadataKey.versionString] as? String
        return
      } catch {
        continue
      }
    }
  }

  private func candidateModels() -> [URL] {
    var urls: [URL] = []
    let fm = FileManager.default
    if let docs = fm.urls(for: .documentDirectory, in: .userDomainMask).first {
      let dir = docs.appendingPathComponent("models")
      for name in ["DartKeypoints.mlmodelc", "DartKeypoints.mlpackage", "DartKeypoints.mlmodel"] {
        let url = dir.appendingPathComponent(name)
        if fm.fileExists(atPath: url.path) { urls.append(url) }
      }
    }
    if let bundleURL = Bundle(for: DartVisionModule.self).url(
      forResource: "DartVisionModels", withExtension: "bundle"),
      let bundle = Bundle(url: bundleURL),
      let url = bundle.url(forResource: "DartKeypoints", withExtension: "mlmodelc")
    {
      urls.append(url)
    }
    return urls
  }
}

enum HeatmapDecoder {
  static let calibrationIds = ["cal20", "cal6", "cal3", "cal11", "bull"]
  /** Below this a peak isn't a keypoint. */
  static let threshold: Float = 0.3
  static let maxTips = 8

  static func decode(heatmaps: MLMultiArray, offsets: MLMultiArray?) -> (
    keypoints: [String: [String: Double]], tips: [[String: Double]]
  ) {
    let shape = heatmaps.shape.map { $0.intValue }
    let channels = shape[shape.count - 3]
    let h = shape[shape.count - 2]
    let w = shape[shape.count - 1]
    let s = heatmaps.strides.map { $0.intValue }
    let (cs, ys, xs) = (s[s.count - 3], s[s.count - 2], s[s.count - 1])
    let value = { (c: Int, y: Int, x: Int) -> Float in
      heatmaps[c * cs + y * ys + x * xs].floatValue
    }
    let offset = { (axis: Int, y: Int, x: Int) -> Float in
      guard let offsets else { return 0.5 }
      let o = offsets.strides.map { $0.intValue }
      return offsets[axis * o[o.count - 3] + y * o[o.count - 2] + x * o[o.count - 1]].floatValue
    }
    func peaks(_ c: Int) -> [(x: Double, y: Double, c: Double)] {
      var out: [(x: Double, y: Double, c: Double)] = []
      for y in 0..<h {
        for x in 0..<w {
          let v = value(c, y, x)
          if v < threshold { continue }
          var isMax = true
          for dy in -1...1 {
            for dx in -1...1 where !(dx == 0 && dy == 0) {
              let ny = y + dy
              let nx = x + dx
              if ny >= 0, ny < h, nx >= 0, nx < w, value(c, ny, nx) > v { isMax = false }
            }
          }
          if isMax {
            out.append((
              x: (Double(x) + Double(offset(0, y, x))) / Double(w),
              y: (Double(y) + Double(offset(1, y, x))) / Double(h),
              c: Double(v)
            ))
          }
        }
      }
      return out.sorted { $0.c > $1.c }
    }
    var keypoints: [String: [String: Double]] = [:]
    for (i, id) in calibrationIds.enumerated() where i < channels {
      if let p = peaks(i).first { keypoints[id] = ["x": p.x, "y": p.y, "c": p.c] }
    }
    let tips = channels > 5 ? peaks(5).prefix(maxTips).map { ["x": $0.x, "y": $0.y, "c": $0.c] } : []
    return (keypoints, Array(tips))
  }
}

enum Sharpness {
  /// Variance of the Laplacian of a 256-pixel-wide greyscale copy.
  static func measure(_ image: CGImage) -> Double {
    let width = 256
    let height = max(3, image.height * width / max(1, image.width))
    var pixels = [UInt8](repeating: 0, count: width * height)
    guard let ctx = CGContext(
      data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)
    else { return 0 }
    ctx.interpolationQuality = .medium
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    var sum = 0.0
    var sumSq = 0.0
    var n = 0.0
    for y in 1..<(height - 1) {
      for x in 1..<(width - 1) {
        let i = y * width + x
        let lap = 4 * Double(pixels[i]) - Double(pixels[i - 1]) - Double(pixels[i + 1])
          - Double(pixels[i - width]) - Double(pixels[i + width])
        sum += lap
        sumSq += lap * lap
        n += 1
      }
    }
    guard n > 0 else { return 0 }
    let mean = sum / n
    return sumSq / n - mean * mean
  }
}

extension UIImage {
  /// The photo redrawn the right way up, so normalised points match what the player sees.
  func upright() -> UIImage? {
    if imageOrientation == .up { return self }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let pixels = CGSize(width: size.width * scale, height: size.height * scale)
    return UIGraphicsImageRenderer(size: pixels, format: format).image { _ in
      draw(in: CGRect(origin: .zero, size: pixels))
    }
  }
}

internal class ImageNotReadableException: Exception {
  override var reason: String { "The photo couldn't be read" }
}

internal class ModelOutputException: Exception {
  override var reason: String { "The model didn't return heatmaps" }
}
