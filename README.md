# FT-1910 visual editor rearrange — screenshots

Orphan branch holding the focused-zone screenshots captured by the
`tests/e2e/visual-editor-complete.spec.ts` rearrange scenarios in
PR [#28](https://github.com/absmartly/browser-extension/pull/28). Kept
off the PR branch so the binaries don't pollute its diff.

Each pair is captured of the same rearrange fixture before / after the
HTML5 drag dispatched by `tests/e2e/helpers/ve-rearrange.ts`.

| File | Scenario |
|------|----------|
| `01-snap-back-before.png` | `#rearrange-zone` initial — `[Alpha, Beta, Gamma]` |
| `01-snap-back-after.png` | After dragging Gamma to before Alpha → `[Gamma, Alpha, Beta]` survives the SDK replay (the snap-back regression) |
| `02-block-sibling-before.png` | `#rearrange-zone-deep` initial — three card siblings |
| `02-block-sibling-after.png` | Block default: dropping Gamma card with cursor over Alpha card's `<h3>` snaps to sibling, no nesting |
| `03-inline-nest-before.png` | `#rearrange-inline` initial — `Alpha-i Beta-i Gamma-i` siblings |
| `03-inline-nest-after.png` | Inline default: Gamma-i ends up nested inside Alpha-i |
| `04-inline-alt-sibling-after.png` | Inline + Alt: Beta-i lands as sibling before Alpha-i (the swap rule) |
| `05-escape-cancel-after.png` | Escape mid-drag: card order unchanged, draggable cleared, no `move` change recorded |

Regenerate by running PR #28's branch with `CAPTURE_SCREENSHOTS=1`:

    CAPTURE_SCREENSHOTS=1 SAVE_EXPERIMENT=1 \
      npx playwright test tests/e2e/visual-editor-complete.spec.ts

Files land in `screenshots-for-pr/`; the capture is gated behind that
env var so it never runs in CI.
