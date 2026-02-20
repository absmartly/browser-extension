export class OverrideManager {
  constructor(cookieName?: string) {}
  parseCookieOverrides = jest.fn()
  checkOverridesCookie = jest.fn()
  getCookieValue = jest.fn().mockReturnValue(null)
  getOverrides = jest.fn().mockReturnValue({ overrides: {}, devEnv: null })
}
