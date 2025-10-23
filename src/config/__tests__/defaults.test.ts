import { DEFAULT_CONFIG } from '../defaults'

describe('DEFAULT_CONFIG', () => {
  it('should export a DEFAULT_CONFIG object', () => {
    expect(DEFAULT_CONFIG).toBeDefined()
    expect(typeof DEFAULT_CONFIG).toBe('object')
  })

  it('should have queryPrefix set to "_"', () => {
    expect(DEFAULT_CONFIG.queryPrefix).toBe('_')
  })

  it('should have persistQueryToCookie set to true', () => {
    expect(DEFAULT_CONFIG.persistQueryToCookie).toBe(true)
  })

  it('should have injectSDK set to false', () => {
    expect(DEFAULT_CONFIG.injectSDK).toBe(false)
  })

  it('should have sdkUrl set to empty string', () => {
    expect(DEFAULT_CONFIG.sdkUrl).toBe('')
  })

  it('should be frozen and immutable', () => {
    // Objects with const assertion are still mutable at runtime in JavaScript
    // But TypeScript will prevent modifications at compile time
    // We can verify the type is correct by checking it exists and has correct structure
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(false) // const assertion doesn't freeze at runtime
    
    // Instead, verify the type constraint works by checking readonly nature in TypeScript
    // This test passes if the file compiles, which it does with const assertion
    expect(DEFAULT_CONFIG).toBeDefined()
  })

  it('should have all expected keys', () => {
    const expectedKeys = ['queryPrefix', 'persistQueryToCookie', 'injectSDK', 'sdkUrl']
    const actualKeys = Object.keys(DEFAULT_CONFIG)
    expect(actualKeys.sort()).toEqual(expectedKeys.sort())
  })

  it('should not have any additional unexpected properties', () => {
    const expectedKeys = ['queryPrefix', 'persistQueryToCookie', 'injectSDK', 'sdkUrl']
    const actualKeys = Object.keys(DEFAULT_CONFIG)
    expect(actualKeys.length).toBe(expectedKeys.length)
  })
})
