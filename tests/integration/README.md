# AI provider testing

Ordinary extension E2E tests script responses at the provider HTTP boundary. They
run the packaged extension's UI, background worker, Anthropic request/response
adapter, tool loop and DOM changes without contacting a model service. Each test
owns its ordered responses; unexpected or unconsumed calls fail the test. Settings
and storage resets must not turn this into a live-provider fallback.

`bun run test:e2e` and pull-request CI need no Anthropic or ABsmartly credentials.
The management API is a local fixture validated against the pinned published
contract (see `tests/helpers/management-api/README.md`); only this optional live
smoke uses a real environment.

## Optional live compatibility smoke

The separate `bun run test:integration:ai` command opts into one real provider
roundtrip. It is excluded from ordinary E2E discovery and pull-request CI. Use it
only when deliberately checking compatibility with a configured provider. It has
no automatic retries, requires an explicit endpoint and API key, and does not fall
back to the subscription bridge or a different provider.

1. Build the extension with `bun run build:dev` (or `bun run build` for CI mode).
2. Supply `PLASMO_PUBLIC_ANTHROPIC_ENDPOINT` and
   `PLASMO_PUBLIC_ANTHROPIC_API_KEY` in the command environment. An explicitly supplied
   `ANTHROPIC_API_KEY` is also accepted. Do not commit keys.
3. Supply the usual `PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT` and
   `PLASMO_PUBLIC_ABSMARTLY_API_KEY` for the Office experiment fixture.
4. Run `bun run test:integration:ai` (or `CI=true bun run test:integration:ai` for
   the production build).

The smoke creates a test experiment, requests a native DOM-change tool call and
asserts the extension receives actual generated changes. Failure here is provider
integration evidence; routine extension coverage does not depend on this check.
