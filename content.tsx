import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import type { DOMChangeInstruction } from "./src/types/sdk-plugin"
import { ElementPicker } from "./src/content/element-picker"
import { injectSDKBridge } from "./src/content/sdk-bridge"

// Configure content script
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  css: ["style.css"],
  run_at: "document_start"
}

// Types
interface SelectedElement {
  element: HTMLElement
  selector: string
  originalStyles?: CSSStyleDeclaration
}

interface EditorState {
  isActive: boolean
  selectedElement: SelectedElement | null
  changes: DOMChangeInstruction[]
  isRecording: boolean
}

// Storage instance
const storage = new Storage()

// Element picker instance
const elementPicker = new ElementPicker()

// Visual Editor Component
function VisualEditor() {
  const [state, setState] = useState<EditorState>({
    isActive: false,
    selectedElement: null,
    changes: [],
    isRecording: false
  })
  
  const [showPanel, setShowPanel] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const hoveredElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Listen for messages from popup/background
    const messageListener = (message: any, sender: any, sendResponse: (response?: any) => void) => {
      if (message.type === "TOGGLE_VISUAL_EDITOR") {
        setState(prev => ({ ...prev, isActive: !prev.isActive }))
        setShowPanel(message.show ?? !showPanel)
      } else if (message.type === "GET_DOM_CHANGES") {
        sendResponse({ changes: state.changes })
      } else if (message.type === "START_ELEMENT_PICKER") {
        console.log('Starting element picker from content script')
        // Start element picker
        elementPicker.start((selector: string) => {
          console.log('Element selected:', selector)
          if (message.fromPopup) {
            // Send directly to runtime (popup will receive it)
            chrome.runtime.sendMessage({
              type: 'ELEMENT_SELECTED',
              selector: selector
            })
          } else if (message.fromExtension) {
            // Legacy: Send to background script
            chrome.runtime.sendMessage({
              type: 'ELEMENT_SELECTED',
              selector: selector
            })
          } else {
            sendResponse({ selector })
          }
        })
        // Return true to indicate we'll send a response asynchronously
        return true
      } else if (message.type === "CANCEL_ELEMENT_PICKER") {
        console.log('Canceling element picker from content script')
        elementPicker.stop()
        sendResponse({ success: true })
      } else if (message.type === "ABSMARTLY_PREVIEW") {
        // Handle preview messages
        if (message.action === "apply") {
          applyPreviewChanges(message.changes)
        } else if (message.action === "remove") {
          removePreviewChanges()
        }
      }
    }
    
    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      // Cleanup
      if (state.selectedElement) {
        state.selectedElement.element.classList.remove("absmartly-selected")
      }
    }
  }, [state.changes])

  useEffect(() => {
    if (state.isActive) {
      document.addEventListener("mouseover", handleMouseOver)
      document.addEventListener("mouseout", handleMouseOut)
      document.addEventListener("click", handleElementClick)
      
      return () => {
        document.removeEventListener("mouseover", handleMouseOver)
        document.removeEventListener("mouseout", handleMouseOut)
        document.removeEventListener("click", handleElementClick)
        
        // Remove any highlights
        document.querySelectorAll(".absmartly-hover").forEach(el => {
          el.classList.remove("absmartly-hover")
        })
      }
    }
  }, [state.isActive])

  const handleMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (isValidTarget(target)) {
      // Remove previous hover
      if (hoveredElementRef.current && hoveredElementRef.current !== target) {
        hoveredElementRef.current.classList.remove("absmartly-hover")
      }
      
      target.classList.add("absmartly-hover")
      hoveredElementRef.current = target
      
      // Update overlay position
      if (overlayRef.current) {
        const rect = target.getBoundingClientRect()
        overlayRef.current.style.left = `${rect.left + window.scrollX}px`
        overlayRef.current.style.top = `${rect.top + window.scrollY}px`
        overlayRef.current.style.width = `${rect.width}px`
        overlayRef.current.style.height = `${rect.height}px`
        overlayRef.current.style.display = "block"
      }
    }
  }

  const handleMouseOut = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    target.classList.remove("absmartly-hover")
    
    if (overlayRef.current && hoveredElementRef.current === target) {
      overlayRef.current.style.display = "none"
    }
  }

  const handleElementClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target as HTMLElement
    if (isValidTarget(target)) {
      // Remove previous selection
      if (state.selectedElement) {
        state.selectedElement.element.classList.remove("absmartly-selected")
      }
      
      target.classList.add("absmartly-selected")
      
      setState(prev => ({
        ...prev,
        selectedElement: {
          element: target,
          selector: generateSelector(target)
        }
      }))
    }
  }

  const isValidTarget = (element: HTMLElement): boolean => {
    // Don't select our own UI elements
    if (element.closest("#absmartly-visual-editor")) return false
    if (element.classList.contains("absmartly-hover")) return false
    if (element.classList.contains("absmartly-selected")) return false
    
    return true
  }

  const generateSelector = (element: HTMLElement): string => {
    // Try to generate a unique selector
    if (element.id) {
      return `#${element.id}`
    }
    
    if (element.className && typeof element.className === "string") {
      const classes = element.className
        .split(" ")
        .filter(c => c && !c.startsWith("absmartly-"))
        .join(".")
      
      if (classes) {
        const selector = `${element.tagName.toLowerCase()}.${classes}`
        // Check if selector is unique
        if (document.querySelectorAll(selector).length === 1) {
          return selector
        }
      }
    }
    
    // Generate path-based selector
    const path: string[] = []
    let current: HTMLElement | null = element
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase()
      
      if (current.id) {
        selector = `#${current.id}`
        path.unshift(selector)
        break
      } else {
        const parent = current.parentElement
        if (parent) {
          const index = Array.from(parent.children).indexOf(current)
          if (index > 0) {
            selector += `:nth-child(${index + 1})`
          }
        }
        path.unshift(selector)
      }
      
      current = current.parentElement
    }
    
    return path.join(" > ")
  }

  const addChange = (change: DOMChangeInstruction) => {
    setState(prev => ({
      ...prev,
      changes: [...prev.changes, change]
    }))
  }

  const removeChange = (index: number) => {
    setState(prev => ({
      ...prev,
      changes: prev.changes.filter((_, i) => i !== index)
    }))
  }

  const applyTextChange = (value: string) => {
    if (!state.selectedElement) return
    
    const change: DOMChangeInstruction = {
      selector: state.selectedElement.selector,
      action: "text",
      value
    }
    
    // Apply immediately for preview
    state.selectedElement.element.textContent = value
    addChange(change)
  }

  const applyStyleChange = (property: string, value: string) => {
    if (!state.selectedElement) return
    
    const existingChange = state.changes.find(
      c => c.selector === state.selectedElement?.selector && c.action === "style"
    )
    
    const css = existingChange?.css || {}
    css[property] = value
    
    const change: DOMChangeInstruction = {
      selector: state.selectedElement.selector,
      action: "style",
      css
    }
    
    // Apply immediately for preview
    state.selectedElement.element.style.setProperty(property, value)
    
    if (existingChange) {
      // Update existing style change
      setState(prev => ({
        ...prev,
        changes: prev.changes.map(c => 
          c === existingChange ? change : c
        )
      }))
    } else {
      addChange(change)
    }
  }

  const applyClassChange = (className: string, operation: "add" | "remove" | "toggle") => {
    if (!state.selectedElement) return
    
    const change: DOMChangeInstruction = {
      selector: state.selectedElement.selector,
      action: "class",
      className,
      value: operation
    }
    
    // Apply immediately for preview
    state.selectedElement.element.classList[operation](className)
    addChange(change)
  }

  const exportChanges = () => {
    const json = JSON.stringify(state.changes, null, 2)
    navigator.clipboard.writeText(json)
    alert("DOM changes copied to clipboard!")
  }

  const applyPreviewChanges = (changes: any[]) => {
    changes.forEach(change => {
      try {
        const elements = document.querySelectorAll(change.selector)
        elements.forEach(element => {
          if (element instanceof HTMLElement) {
            switch (change.type) {
              case 'text':
                element.textContent = change.value
                break
              case 'html':
                element.innerHTML = change.value
                break
              case 'style':
                Object.entries(change.value).forEach(([property, value]) => {
                  element.style.setProperty(property, value as string)
                })
                break
              case 'class':
                if (change.add) {
                  element.classList.add(...change.add)
                }
                if (change.remove) {
                  element.classList.remove(...change.remove)
                }
                break
              case 'attribute':
                Object.entries(change.value).forEach(([attr, value]) => {
                  element.setAttribute(attr, value as string)
                })
                break
              case 'javascript':
                // Execute JavaScript in the context of the element
                new Function('element', change.value)(element)
                break
            }
            // Mark element as previewed
            element.dataset.absmartlyPreview = 'true'
          }
        })
      } catch (error) {
        console.error('Error applying preview change:', error, change)
      }
    })
  }

  const removePreviewChanges = () => {
    // Find all elements that were modified by preview
    const previewedElements = document.querySelectorAll('[data-absmartly-preview="true"]')
    previewedElements.forEach(element => {
      if (element instanceof HTMLElement) {
        // Remove the preview marker
        delete element.dataset.absmartlyPreview
        // Note: In a real implementation, we'd need to store original values
        // and restore them. For now, we just reload the page.
      }
    })
    // Reload page to restore original state
    window.location.reload()
  }

  if (!showPanel) return null

  return (
    <div id="absmartly-visual-editor" className="absmartly-editor-root">
      {/* Hover Overlay */}
      {state.isActive && (
        <div
          ref={overlayRef}
          className="absmartly-hover-overlay"
          style={{
            position: "absolute",
            pointerEvents: "none",
            border: "2px dashed #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            display: "none",
            zIndex: 9998
          }}
        />
      )}
      
      {/* Editor Panel */}
      <div className="absmartly-editor-panel">
        <div className="absmartly-editor-header">
          <h3>ABSmartly Visual Editor</h3>
          <button
            onClick={() => setShowPanel(false)}
            className="absmartly-close-btn"
          >
            ×
          </button>
        </div>
        
        <div className="absmartly-editor-content">
          {/* Mode Toggle */}
          <div className="absmartly-mode-toggle">
            <button
              onClick={() => setState(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={`absmartly-btn ${state.isActive ? "active" : ""}`}
            >
              {state.isActive ? "Stop Selection" : "Start Selection"}
            </button>
          </div>
          
          {/* Selected Element Info */}
          {state.selectedElement && (
            <div className="absmartly-selected-info">
              <h4>Selected Element</h4>
              <code>{state.selectedElement.selector}</code>
              
              {/* Text Editor */}
              <div className="absmartly-editor-section">
                <h5>Text Content</h5>
                <input
                  type="text"
                  defaultValue={state.selectedElement.element.textContent || ""}
                  onChange={(e) => applyTextChange(e.target.value)}
                  className="absmartly-input"
                />
              </div>
              
              {/* Style Editor */}
              <div className="absmartly-editor-section">
                <h5>Styles</h5>
                <div className="absmartly-style-grid">
                  <input
                    type="text"
                    placeholder="Property"
                    className="absmartly-input"
                    id="style-prop"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    className="absmartly-input"
                    id="style-val"
                  />
                  <button
                    onClick={() => {
                      const prop = (document.getElementById("style-prop") as HTMLInputElement)?.value
                      const val = (document.getElementById("style-val") as HTMLInputElement)?.value
                      if (prop && val) {
                        applyStyleChange(prop, val)
                      }
                    }}
                    className="absmartly-btn"
                  >
                    Apply
                  </button>
                </div>
              </div>
              
              {/* Class Editor */}
              <div className="absmartly-editor-section">
                <h5>Classes</h5>
                <div className="absmartly-class-grid">
                  <input
                    type="text"
                    placeholder="Class name"
                    className="absmartly-input"
                    id="class-name"
                  />
                  <select className="absmartly-select" id="class-op">
                    <option value="add">Add</option>
                    <option value="remove">Remove</option>
                    <option value="toggle">Toggle</option>
                  </select>
                  <button
                    onClick={() => {
                      const className = (document.getElementById("class-name") as HTMLInputElement)?.value
                      const operation = (document.getElementById("class-op") as HTMLSelectElement)?.value as any
                      if (className) {
                        applyClassChange(className, operation)
                      }
                    }}
                    className="absmartly-btn"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Changes List */}
          <div className="absmartly-changes-list">
            <h4>DOM Changes ({state.changes.length})</h4>
            {state.changes.map((change, index) => (
              <div key={index} className="absmartly-change-item">
                <div className="absmartly-change-info">
                  <strong>{change.action}</strong> on <code>{change.selector}</code>
                  {change.value && <span>: {change.value}</span>}
                  {change.css && <span>: {JSON.stringify(change.css)}</span>}
                  {change.className && <span>: {change.className}</span>}
                </div>
                <button
                  onClick={() => removeChange(index)}
                  className="absmartly-remove-btn"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          {/* Export Button */}
          {state.changes.length > 0 && (
            <div className="absmartly-export">
              <button
                onClick={exportChanges}
                className="absmartly-btn absmartly-btn-primary"
              >
                Export Changes as JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mount the visual editor
const mount = () => {
  const container = document.createElement("div")
  container.id = "absmartly-visual-editor-root"
  document.body.appendChild(container)
  
  const root = createRoot(container)
  root.render(<VisualEditor />)
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectSDKBridge()
    mount()
  })
} else {
  injectSDKBridge()
  mount()
}

// Export for Plasmo
export default VisualEditor

// The element picker is handled in the main message listener above