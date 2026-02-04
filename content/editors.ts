import { html } from "@codemirror/lang-html"
import { EditorState } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import { basicSetup, EditorView } from "codemirror"
import { JavaScriptEditor, JSONEditor } from "~src/visual-editor"
import { EventViewer } from "~src/visual-editor/ui/event-viewer"
import { MarkdownEditor } from "~src/visual-editor/ui/markdown-editor"
import { debugLog } from "~src/utils/debug"

let codeEditorContainer: HTMLDivElement | null = null
let codeEditorView: EditorView | null = null
let jsonEditorInstance: JSONEditor | null = null
let eventViewerInstance: EventViewer | null = null
let markdownEditorInstance: MarkdownEditor | null = null
let jsEditorInstance: JavaScriptEditor | null = null

export function openCodeEditor(data: {
  section: string
  value: string
  sectionTitle: string
  placeholder: string
  readOnly?: boolean
}) {
  console.log("[openCodeEditor] Function called with:", {
    section: data.section,
    valueLength: data.value?.length,
    timestamp: Date.now()
  })

  closeCodeEditor()
  console.log(
    "[openCodeEditor] After closeCodeEditor, now creating new container"
  )

  codeEditorContainer = document.createElement("div")
  codeEditorContainer.id = "absmartly-code-editor-fullscreen"
  codeEditorContainer.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: rgba(0, 0, 0, 0.5) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `

  const modal = document.createElement("div")
  modal.style.cssText = `
    width: calc(100vw - 32px) !important;
    height: calc(100vh - 32px) !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    background: white !important;
    border-radius: 8px !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  `

  const header = document.createElement("div")
  header.style.cssText = `
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 16px !important;
    border-bottom: 1px solid #e5e7eb !important;
    background: white !important;
  `

  const title = document.createElement("h2")
  title.style.cssText = `
    font-size: 18px !important;
    font-weight: 600 !important;
    color: #111827 !important;
    margin: 0 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  `
  title.textContent = `</> ${data.sectionTitle}`

  const closeBtn = document.createElement("button")
  closeBtn.style.cssText = `
    padding: 8px !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    color: #6b7280 !important;
    font-size: 24px !important;
    line-height: 1 !important;
    border-radius: 4px !important;
    transition: background-color 0.2s !important;
  `
  closeBtn.textContent = "×"
  closeBtn.onmouseover = () => (closeBtn.style.backgroundColor = "#f3f4f6")
  closeBtn.onmouseout = () => (closeBtn.style.backgroundColor = "transparent")
  closeBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: "CODE_EDITOR_CLOSE" })
    closeCodeEditor()
  }

  header.appendChild(title)
  header.appendChild(closeBtn)

  const editorContainer = document.createElement("div")
  editorContainer.style.cssText = `
    flex: 1 !important;
    padding: 16px !important;
    overflow: hidden !important;
    background: #f9fafb !important;
    display: flex !important;
    flex-direction: column !important;
  `

  const editorWrapper = document.createElement("div")
  editorWrapper.style.cssText = `
    flex: 1 !important;
    overflow: auto !important;
    border-radius: 6px !important;
    background: #1f2937 !important;
  `

  const extensions = [basicSetup, html(), oneDark, EditorView.lineWrapping]

  if (data.readOnly) {
    extensions.push(EditorState.readOnly.of(true))
  }

  const startState = EditorState.create({
    doc: data.value || "",
    extensions
  })

  codeEditorView = new EditorView({
    state: startState,
    parent: editorWrapper
  })

  editorContainer.appendChild(editorWrapper)

  const footer = document.createElement("div")
  footer.style.cssText = `
    display: flex !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    padding: 16px !important;
    border-top: 1px solid #e5e7eb !important;
    background: white !important;
  `

  const cancelBtn = document.createElement("button")
  cancelBtn.id = "cancel-button"
  cancelBtn.style.cssText = `
    padding: 8px 16px !important;
    background: white !important;
    color: #374151 !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    transition: all 0.2s !important;
  `
  cancelBtn.textContent = data.readOnly ? "Close" : "Cancel"
  cancelBtn.onmouseover = () => (cancelBtn.style.backgroundColor = "#f9fafb")
  cancelBtn.onmouseout = () => (cancelBtn.style.backgroundColor = "white")
  cancelBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: "CODE_EDITOR_CLOSE" })
    closeCodeEditor()
  }

  footer.appendChild(cancelBtn)

  if (!data.readOnly) {
    const saveBtn = document.createElement("button")
    saveBtn.id = "save-button"
    saveBtn.style.cssText = `
      padding: 8px 16px !important;
      background: #3b82f6 !important;
      color: white !important;
      border: none !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      transition: all 0.2s !important;
    `
    saveBtn.textContent = "Save"
    saveBtn.onmouseover = () => (saveBtn.style.backgroundColor = "#2563eb")
    saveBtn.onmouseout = () => (saveBtn.style.backgroundColor = "#3b82f6")
    saveBtn.onclick = () => {
      const value = codeEditorView?.state.doc.toString() || ""
      chrome.runtime.sendMessage({
        type: "CODE_EDITOR_SAVE",
        value
      })
      closeCodeEditor()
    }

    footer.appendChild(saveBtn)
  }

  modal.appendChild(header)
  modal.appendChild(editorContainer)
  modal.appendChild(footer)
  codeEditorContainer.appendChild(modal)

  document.body.appendChild(codeEditorContainer)

  codeEditorView.focus()

  document.body.style.overflow = "hidden"
}

export function closeCodeEditor() {
  console.log(
    "[closeCodeEditor] Function called, container exists:",
    !!codeEditorContainer,
    "view exists:",
    !!codeEditorView
  )
  if (codeEditorView) {
    codeEditorView.destroy()
    codeEditorView = null
  }
  if (codeEditorContainer) {
    codeEditorContainer.remove()
    codeEditorContainer = null
    document.body.style.overflow = ""
  }
}

export async function openJSONEditor(
  data: { variantName: string; value: string },
  isVisualEditorActive: boolean,
  currentEditor: any
) {
  closeJSONEditor()

  const wasVEActive = isVisualEditorActive
  if (wasVEActive && currentEditor) {
    debugLog("[JSON Editor] Temporarily disabling VE while JSON editor is open")
    currentEditor.disable()
  }

  jsonEditorInstance = new JSONEditor()

  const title = `Edit DOM Changes - ${data.variantName}`
  const result = await jsonEditorInstance.show(title, data.value)

  if (wasVEActive && currentEditor) {
    debugLog("[JSON Editor] Re-enabling VE after JSON editor closed")
    currentEditor.enable()
  }

  if (result !== null) {
    chrome.runtime.sendMessage({
      type: "JSON_EDITOR_SAVE",
      value: result
    })
  } else {
    chrome.runtime.sendMessage({
      type: "JSON_EDITOR_CLOSE"
    })
  }
}

export function closeJSONEditor() {
  if (jsonEditorInstance) {
    jsonEditorInstance = null
  }
}

export function openEventViewer(data: {
  eventName: string
  timestamp: string
  value: string
}) {
  closeEventViewer()
  eventViewerInstance = new EventViewer()
  eventViewerInstance.show(data.eventName, data.timestamp, data.value)
}

export function closeEventViewer() {
  if (eventViewerInstance) {
    eventViewerInstance.close()
    eventViewerInstance = null
  }
}

export async function openMarkdownEditor(
  data: { title: string; value: string; defaultValue?: string },
  isVisualEditorActive: boolean,
  currentEditor: any
) {
  closeMarkdownEditor()

  const wasVEActive = isVisualEditorActive
  if (wasVEActive && currentEditor) {
    debugLog(
      "[Markdown Editor] Temporarily disabling VE while markdown editor is open"
    )
    currentEditor.disable()
  }

  markdownEditorInstance = new MarkdownEditor()

  const result = await markdownEditorInstance.show(
    data.title,
    data.value,
    data.defaultValue
  )

  if (wasVEActive && currentEditor) {
    debugLog("[Markdown Editor] Re-enabling VE after markdown editor closed")
    currentEditor.enable()
  }

  if (result !== null) {
    chrome.runtime.sendMessage({
      type: "MARKDOWN_EDITOR_SAVE",
      value: result
    })
  } else {
    chrome.runtime.sendMessage({
      type: "MARKDOWN_EDITOR_CLOSE"
    })
  }
}

export function closeMarkdownEditor() {
  if (markdownEditorInstance) {
    markdownEditorInstance = null
  }
}

export async function openJavaScriptEditor(
  data: { value: string },
  isVisualEditorActive: boolean,
  currentEditor: any
) {
  closeJavaScriptEditor()

  const wasVEActive = isVisualEditorActive
  if (wasVEActive && currentEditor) {
    debugLog(
      "[JavaScript Editor] Temporarily disabling VE while JS editor is open"
    )
    currentEditor.disable()
  }

  jsEditorInstance = new JavaScriptEditor()

  const title = "Edit JavaScript Code"
  const result = await jsEditorInstance.show(title, data.value)

  if (wasVEActive && currentEditor) {
    debugLog("[JavaScript Editor] Re-enabling VE after JS editor closed")
    currentEditor.enable()
  }

  if (result !== null) {
    chrome.runtime.sendMessage({
      type: "JAVASCRIPT_EDITOR_SAVE",
      value: result
    })
  } else {
    chrome.runtime.sendMessage({
      type: "JAVASCRIPT_EDITOR_CLOSE"
    })
  }
}

export function closeJavaScriptEditor() {
  if (jsEditorInstance) {
    jsEditorInstance = null
  }
}
