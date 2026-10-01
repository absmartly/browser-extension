# Controlled management API for deterministic E2E

Required E2E runs the production MV3 build in real Chromium. The sidebar
iframe, content scripts and service worker make their real `fetch` calls. Only
two boundaries are replaced: the ABsmartly management API (this fixture) and the
AI provider (`tests/helpers/provider-server.ts`, scripted).

## How requests get here

- The extension is configured with `https://e2e-api.absmartly.com`. That origin
  is inside the production endpoint allow-list, so no production guard is
  disabled or bypassed.
- `tests/helpers/network-boundary.ts` forwards that origin to this loopback
  server through Playwright context routing. On Playwright 1.59.1 this covers
  service-worker requests.
- Every other `http(s)` request from pages or the worker is aborted and recorded,
  and the test fails at teardown (`tests/e2e/network-boundary.spec.ts`). The only
  exceptions are the local test-page server and the scripted provider.
- The Node test process may only connect to loopback
  (`tests/helpers/node-egress-guard.ts`; see that file for what it does and does
  not cover).

## Contract checks

- **Contract:** published `@absmartly/api-mocks@1.0.9` (`gitHead 9fad02a9`). It
  is fetched by `scripts/fetch-api-contract.js`, which checks sha512 tarball
  integrity and the bundle's sha256. It is not vendored, because the package is
  `UNLICENSED`.
- **Requests:** query and body are validated against the raw schemas. Required
  fields, enums and patterns are kept. The package's lenient
  `validateRequest`/`validateRequestStrict` helpers are not used.
- **Responses:** responses are validated per status.
  - A documented schema is enforced.
  - A documented status with no schema is allowed only under a provider-pinned
    `ERROR_EXPECTATIONS` entry.
  - An undocumented status, a missing operation or a missing fixture route fails
    the test as a coverage issue.
- **Unlisted query parameters** fail as a coverage gap, which is stricter than
  OpenAPI. Owned exceptions are listed in `KNOWN_UNLISTED_QUERY`.
- **Local corrections** are listed in `tests/helpers/contract/deviations.ts` and
  pinned to abs source. The published contract itself still needs correcting
  upstream; that is separate work.
  - **Deviations:** `state` enum, `running_type`, `/auth/current-user` and draft
    `primary_metric.metric_id: null`.
  - **Corrigendum:** the invalid `Template.required: null`.

Schema validation does not prove provider semantics. Examples: filter AND/OR,
totals, permissions, and the primary-metric requirement for ready or running
experiments. Those belong to provider conformance in abs.

## Using it in a spec

```ts
test('...', async ({ managementApi, seedStorage }) => {
  managementApi.state.experiments.push(experimentRecord({ name: 'owned', state: 'created' }))
  managementApi.override(({ url }) => url.pathname === '/auth/current-user' ? UNAUTHORIZED : undefined)
  // ... drive the UI ...
  expect(managementApi.callsTo('POST', '/v1/experiments')[0].body).toMatchObject({ percentage_of_traffic: 75 })
})
```

- **State:** each test gets a fresh server with its own state.
- **Timing:** `managementApi.delay(method, path, ms)` holds matching requests to reproduce slow responses. Assert on the awaited response and its rendered outcome, not on a spinner being absent: the first list request starts only after config, auth and resources have loaded.
- **Pre-mount data:** seed records before the sidebar mounts. The list loads on
  mount, and the default filter shows created and ready experiments.
- **Reconfiguring:** use `controlledConfigSeed(managementApi)` when a spec
  reseeds configuration. Never use environment credentials.
- **Real environment:** `bun run test:integration:ai` sets `liveBackend`. It is
  manual and is not part of required CI.
