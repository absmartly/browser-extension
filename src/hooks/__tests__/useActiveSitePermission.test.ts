import { originPatternFromUrl } from '../useActiveSitePermission'

describe('originPatternFromUrl', () => {
  it.each([
    ['https://example.com/path?q=1', 'https://example.com/*'],
    ['http://localhost:3000/', 'http://localhost:3000/*'],
    ['https://sub.dev.absmartly.com/experiments', 'https://sub.dev.absmartly.com/*'],
    ['https://example.com:8443/foo', 'https://example.com:8443/*']
  ])('normalises %s -> %s', (url, expected) => {
    expect(originPatternFromUrl(url)).toBe(expected)
  })

  it('returns file:///* for file:// URLs (matches Chrome host-permission format)', () => {
    expect(originPatternFromUrl('file:///Users/me/index.html')).toBe('file:///*')
  })

  it.each([
    'chrome://extensions',
    'chrome-extension://abc/index.html',
    'about:blank',
    'edge://settings',
    'devtools://devtools/bundled/inspector.html'
  ])('returns null for unsupported scheme %s', (url) => {
    expect(originPatternFromUrl(url)).toBeNull()
  })

  it.each([undefined, null, '', 'not a url'])('returns null for invalid input %p', (url) => {
    expect(originPatternFromUrl(url as string | null | undefined)).toBeNull()
  })
})
