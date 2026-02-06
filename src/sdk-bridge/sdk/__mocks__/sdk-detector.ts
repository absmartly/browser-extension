export class SDKDetector {
  detectSDK = jest.fn().mockReturnValue({
    sdk: null,
    context: null,
    contextPath: null
  })
  getCachedContext = jest.fn().mockReturnValue(null)
  getContextPath = jest.fn().mockReturnValue(null)
  clearCache = jest.fn()
}
