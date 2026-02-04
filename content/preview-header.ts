interface PreviewHeaderState {
  shadowHost: HTMLElement
  mouseMoveHandler: (e: MouseEvent) => void
  mouseUpHandler: () => void
}

let currentPreviewHeader: PreviewHeaderState | null = null

export function createPreviewHeader(
  experimentName: string,
  variantName: string,
  isVisualEditorActive: boolean,
  isVisualEditorStarting: boolean
) {
  removePreviewHeader()

  if (isVisualEditorActive || isVisualEditorStarting) {
    console.log(
      `[Content Script] Skipping preview header creation: isVisualEditorActive=${isVisualEditorActive}, isVisualEditorStarting=${isVisualEditorStarting}`
    )
    return
  }

  console.log(
    `[Content Script] Creating preview header for ${experimentName} / ${variantName}`
  )

  const shadowHost = document.createElement("div")
  shadowHost.id = "absmartly-preview-header-host"
  shadowHost.style.cssText =
    "all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;"

  const shadowRoot = shadowHost.attachShadow({ mode: "closed" })

  const headerContainer = document.createElement("div")
  headerContainer.id = "absmartly-preview-header"
  headerContainer.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    color: white;
    padding: 12px 20px;
    border-radius: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 14px;
    min-width: 500px;
    max-width: 90vw;
    cursor: grab;
    pointer-events: auto;
  `

  let isDragging = false
  let startX = 0
  let startY = 0
  let currentX = 0
  let currentY = 0

  headerContainer.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return
    isDragging = true
    headerContainer.style.cursor = "grabbing"
    startX = e.clientX - currentX
    startY = e.clientY - currentY
  })

  const mouseMoveHandler = (e: MouseEvent) => {
    if (!isDragging) return
    currentX = e.clientX - startX
    currentY = e.clientY - startY
    headerContainer.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px)`
  }

  const mouseUpHandler = () => {
    if (isDragging) {
      isDragging = false
      headerContainer.style.cursor = "grab"
    }
  }

  document.addEventListener("mousemove", mouseMoveHandler)
  document.addEventListener("mouseup", mouseUpHandler)

  const content = document.createElement("div")
  content.style.cssText =
    "flex: 1; display: flex; flex-direction: column; align-items: center;"

  const logoUrl = chrome.runtime.getURL("assets/absmartly-logo-white.svg")

  const titleDiv = document.createElement("div")
  titleDiv.style.cssText = "font-weight: 500; font-size: 14px; display: flex; align-items: center; gap: 10px;"

  const logo = document.createElement("img")
  logo.src = logoUrl
  logo.alt = "ABSmartly"
  logo.style.cssText = "width: 24px; height: 24px;"

  const titleText = document.createElement("span")
  titleText.textContent = `Preview Mode - ${experimentName}`

  titleDiv.appendChild(logo)
  titleDiv.appendChild(titleText)

  const variantDiv = document.createElement("div")
  variantDiv.style.cssText = "font-size: 12px; opacity: 0.9; margin-top: 5px;"

  const variantLabel = document.createTextNode("Variant: ")
  const variantValue = document.createElement("strong")
  variantValue.textContent = variantName

  variantDiv.appendChild(variantLabel)
  variantDiv.appendChild(variantValue)

  content.appendChild(titleDiv)
  content.appendChild(variantDiv)

  const closeButton = document.createElement("button")
  closeButton.style.cssText = `
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  `
  closeButton.textContent = "Exit Preview"
  closeButton.onmouseover = () => {
    closeButton.style.background = "rgba(255, 255, 255, 0.25)"
  }
  closeButton.onmouseout = () => {
    closeButton.style.background = "rgba(255, 255, 255, 0.15)"
  }
  closeButton.onclick = () => {
    removePreviewHeader()

    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"]`
    )
    console.log(
      `[Content Script] Found ${markedElements.length} elements with preview markers`
    )

    markedElements.forEach((element) => {
      const original = element.getAttribute("data-absmartly-original")
      if (original) {
        try {
          const originalData = JSON.parse(original)
          if (originalData.textContent !== undefined) {
            element.textContent = originalData.textContent
          }
          if (originalData.innerHTML !== undefined) {
            element.innerHTML = originalData.innerHTML
          }
          if (originalData.styles) {
            const htmlElement = element as HTMLElement
            if (originalData.styles.display !== undefined) {
              htmlElement.style.display = originalData.styles.display
            }
            if (originalData.styles.width !== undefined) {
              htmlElement.style.width = originalData.styles.width
            }
            if (originalData.styles.height !== undefined) {
              htmlElement.style.height = originalData.styles.height
            }
          }
        } catch (e) {
          console.error("[Content Script] Error restoring element:", e)
        }
      }

      element.removeAttribute("data-absmartly-experiment")
      element.removeAttribute("data-absmartly-original")
      element.removeAttribute("data-absmartly-modified")
    })

    chrome.runtime.sendMessage({
      type: "PREVIEW_STATE_CHANGED",
      enabled: false
    })
  }

  headerContainer.appendChild(content)
  headerContainer.appendChild(closeButton)

  shadowRoot.appendChild(headerContainer)

  document.body.appendChild(shadowHost)

  currentPreviewHeader = {
    shadowHost,
    mouseMoveHandler,
    mouseUpHandler
  }
}

export function removePreviewHeader() {
  if (currentPreviewHeader) {
    document.removeEventListener("mousemove", currentPreviewHeader.mouseMoveHandler)
    document.removeEventListener("mouseup", currentPreviewHeader.mouseUpHandler)
    currentPreviewHeader.shadowHost.remove()
    currentPreviewHeader = null
  }
}
