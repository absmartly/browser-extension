# Opt-in LaunchPad reproductions

These tests guard defects found during isolated exploration and should pass
with the fixed production build. They are not marked expected-failure and are
outside the default Playwright test patterns. No product behavior is mocked.

Prerequisites: repository dependencies, the matching Playwright Chromium, and a
production `build/chrome-mv3-prod` artifact (`bun run build` if absent/stale).
Prefer Node 22, matching CI. No credentials, `.env` loading, account, bridge or
pre-existing fixture server is needed.

```sh
REPRO_OUTPUT_DIR=/tmp/opencode/launchpad-repro-run1 \
  bunx playwright test -c tests/reproductions/playwright.config.ts
REPRO_OUTPUT_DIR=/tmp/opencode/launchpad-repro-run2 \
  bunx playwright test -c tests/reproductions/playwright.config.ts
```

Each test starts its own ephemeral loopback HTTP server and isolated Chromium
profile, and closes/removes them in teardown. Traces, final screenshots and
diagnostic attachments are retained even for failing assertions. One worker,
zero retries. `HEADED=1` optionally enables headed execution.

CI runs this config once in the credential-free `launchpad-regressions` job,
with a fresh production build and Chromium. The default sharded suite excludes
this directory explicitly. Failed dedicated runs upload traces, screenshots
and JSON results as `launchpad-regression-results` (seven-day retention).

Coverage:

- Packaged production **iframe** readiness/persistence and reload/remount.
- Required endpoint feedback is reachable at the narrow sidebar's current scroll.
- Invalid URL syntax must not be saved (separate from bare-host normalization or
  endpoint reachability); the previous valid endpoint survives reload.
- One real offline SDK goal produces one debug row. Both a single context
  reference and the earlier fixture's aliases are exercised to isolate alias
  effects. Repeated goals, pause/resume and clear are also exercised.
- Missing API-key validation focuses the visible field.

The iframe is programmatically mounted: this is **not native toolbar coverage**
or a reproduction of the personal-browser connector attachment. Settings are
configured through visible UI only. The fixture serves static HTML and the
installed real SDK, not a management backend. SDK provider/publisher transport
is deliberately local-only. No synthetic SDK event messages or hidden auth/
storage seeding are used. The tests execute the real packaged product scripts.

Do not infer the historical introduction of a bug from these reproductions.
