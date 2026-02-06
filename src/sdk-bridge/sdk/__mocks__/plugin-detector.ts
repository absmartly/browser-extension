export class PluginDetector {
  detectPlugin = jest.fn().mockReturnValue(null)
  isPluginAccessible = jest.fn().mockReturnValue(false)
  isPluginActive = jest.fn().mockReturnValue(false)
}
