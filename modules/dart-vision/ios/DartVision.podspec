Pod::Spec.new do |s|
  s.name           = 'DartVision'
  s.version        = '0.1.0'
  s.summary        = 'Dart and board keypoints for Ton Up snap to score'
  s.description    = 'Runs the Core ML keypoint model through Vision and decodes its heatmaps (ADR 0011).'
  s.author         = ''
  s.homepage       = 'https://github.com/ncfritz/tonup'
  s.platforms      = { :ios => '18.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.frameworks     = 'Vision', 'CoreML', 'UIKit', 'Accelerate'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
  # The compiled model (ml/README.md → Export), when there is one.
  s.resource_bundles = { 'DartVisionModels' => ['Models/*.mlmodelc'] }
end
