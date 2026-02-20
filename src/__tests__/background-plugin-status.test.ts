import { detectPluginStatusInPage } from '../../background/main'

describe('detectPluginStatusInPage', () => {
  beforeEach(() => {
    delete (window as any).__ABSMARTLY_PLUGINS__
    delete (window as any).__absmartlyPlugin
    delete (window as any).__absmartlyDOMChangesPlugin
    delete (window as any).ABsmartlyContext
    delete (window as any).absmartly
    delete (window as any).ABsmartly
    delete (window as any).__absmartly
    delete (window as any).sdk
    delete (window as any).abSmartly
    delete (window as any).context
    delete (window as any).absmartlyContext
    delete (window as any).__context
    document.body.innerHTML = ''
  })

  it('detects plugin via context.__domPlugin registration', () => {
    ;(window as any).ABsmartlyContext = {
      treatment: () => 'A',
      __domPlugin: {
        initialized: true,
        version: '1.2.3',
        instance: { name: 'dom' }
      }
    }

    const result = detectPluginStatusInPage()

    expect(result.pluginDetected).toBe(true)
    expect(result.hasContextDomPlugin).toBe(true)
    expect(result.contextPath).toBe('ABsmartlyContext')
  })

  it('detects plugin via DOM artifacts even without context', () => {
    const marker = document.createElement('div')
    marker.setAttribute('data-absmartly-modified', 'true')
    document.body.appendChild(marker)

    const result = detectPluginStatusInPage()

    expect(result.pluginDetected).toBe(true)
    expect(result.hasDomArtifacts).toBe(true)
  })
})
