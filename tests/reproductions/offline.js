// Actual SDK, one context and one button listener. No synthetic SDK messages.
(() => {
  const log = document.getElementById('sdk-log')
  const deny = () => { throw new Error('Network client disabled in offline fixture') }
  const sdk = new absmartly.SDK({
    client: { getContext: deny, publish: deny, request: deny },
    provider: { getContextData: () => Promise.resolve({ experiments: [] }) },
    publisher: { publish: () => Promise.resolve() },
    eventLogger: (_context, name, data) => {
      log.textContent += JSON.stringify({ name, data }) + '\n'
    },
  })
  const context = sdk.createContextWith({ units: { fixture_user: 'offline' } }, { experiments: [] }, { publishDelay: -1, refreshPeriod: 0 })
  window.ABsmartlyContext = context
  // Compare the earlier fixture aliases against a single detection reference.
  if (new URLSearchParams(location.search).has('aliases')) {
    window.ABsmartly = context
    window.sdk = sdk
  }
  context.ready().then(() => { document.getElementById('sdk-status').textContent = 'Offline SDK ready' })
  // Each queued goal carries a sequence number so a test can identify the
  // latest row and assert a settled count rather than a transient one.
  let seq = 0
  document.getElementById('goal').addEventListener('click', () => {
    context.track('fixture_goal', { source: 'local-only', seq: ++seq })
  })
})()
