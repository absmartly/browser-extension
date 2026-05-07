import { type Page, expect } from "@playwright/test"
import { log } from "../utils/test-helpers"
import { clickContextMenuItem } from "../utils/visual-editor-helpers"

/**
 * Drag/drop rearrange smoke test.
 *
 * Targets the id-less `.rearrange-card` siblings under `#rearrange-zone`. They
 * intentionally have no per-element id, so the visual editor's selector
 * generator falls through to parent-context + (potentially) nth-of-type.
 * That's the codepath that surfaces the post-drop selector mismatch:
 * trackMoveChange used to generate the dragged element's selector while the
 * element was still at its drop site, then revert; on SDK replay the
 * selector matched the wrong sibling (or none) and the element snapped
 * back to its original spot.
 *
 * The visual editor's rearrange handler attaches native HTML5 dragstart /
 * dragover / drop / dragend listeners. Playwright's mouse-based dragTo()
 * does not reliably trigger HTML5 drag events in headless Chromium, so the
 * events are dispatched directly via page.evaluate. e.target is set to the
 * drop anchor by dispatching `drop` on it directly and letting the
 * document-level listener see it via bubbling.
 */
export async function testRearrangeDragDrop(page: Page): Promise<void> {
  log("\n🔀 Testing rearrange drag-and-drop...")

  const zone = page.locator("#rearrange-zone")
  await zone.waitFor({ state: "visible", timeout: 5000 })

  // Sanity: confirm initial order before doing anything.
  const initialOrder = await zone.evaluate((el) =>
    Array.from(el.children).map((c) => c.textContent?.trim() ?? "")
  )
  expect(initialOrder).toEqual(["Alpha", "Beta", "Gamma"])
  log(`  ✓ Initial order: ${initialOrder.join(", ")}`)

  // 1. Click Gamma (the third card) to open the VE context menu. The visual
  // editor opens its custom menu on left-click while VE is active — this is
  // the same path testAllVisualEditorActions uses.
  const gamma = zone.locator("> div", { hasText: "Gamma" })
  await gamma.click()
  await page.locator(".menu-container").waitFor({ state: "visible", timeout: 5000 })
  log("  ✓ Context menu open on Gamma")

  // 2. Click the Rearrange menu item — this enables HTML5 drag on the
  // smartElement (the bare div, since div is in the block-level allowlist).
  await clickContextMenuItem(page, "Rearrange")
  await page
    .locator("#rearrange-zone > div[draggable='true']")
    .waitFor({ state: "attached", timeout: 5000 })
  log("  ✓ Rearrange mode enabled (draggable=true on a card)")

  // 3. Dispatch HTML5 drag events to drop Gamma BEFORE Alpha.
  //    The drop handler reads e.clientY against dropTarget.getBoundingClientRect()
  //    to pick before vs. after — we aim for the top half of Alpha so the
  //    handler picks "before".
  const dispatchResult = await page.evaluate(() => {
    const zoneEl = document.getElementById("rearrange-zone")!
    const cards = Array.from(zoneEl.children) as HTMLElement[]
    const gamma = cards[cards.length - 1]
    const alpha = cards[0]
    const alphaRect = alpha.getBoundingClientRect()
    const dropY = alphaRect.top + 1 // top half → handler picks "before"

    const dataTransfer = new DataTransfer()

    gamma.dispatchEvent(
      new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        dataTransfer
      })
    )

    alpha.dispatchEvent(
      new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientX: alphaRect.left + alphaRect.width / 2,
        clientY: dropY,
        dataTransfer
      })
    )

    alpha.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX: alphaRect.left + alphaRect.width / 2,
        clientY: dropY,
        dataTransfer
      })
    )

    gamma.dispatchEvent(
      new DragEvent("dragend", {
        bubbles: true,
        cancelable: true,
        dataTransfer
      })
    )

    return {
      orderRightAfterDispatch: Array.from(zoneEl.children).map(
        (c) => c.textContent?.trim() ?? ""
      )
    }
  })
  log(
    `  Dispatched drag/drop. Order right after: ${dispatchResult.orderRightAfterDispatch.join(", ")}`
  )

  // 4. Wait for the SDK postMessage round-trip to land. trackMoveChange
  //    reverts the live drop and then replays via the SDK, so the final
  //    DOM state is async.
  await expect
    .poll(
      async () =>
        await zone.evaluate((el) =>
          Array.from(el.children).map((c) => c.textContent?.trim() ?? "")
        ),
      {
        message:
          "rearrange-zone children should end up in [Gamma, Alpha, Beta] after SDK replay",
        timeout: 5000
      }
    )
    .toEqual(["Gamma", "Alpha", "Beta"])

  log("  ✓ Final order after SDK replay: Gamma, Alpha, Beta")
}
