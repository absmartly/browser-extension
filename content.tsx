import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import type { DOMChangeInstruction } from "./src/types/sdk-plugin"
import { ElementPicker } from "./src/content/element-picker"
import { DragDropPicker } from "./src/content/drag-drop-picker"
import { injectSDKBridge } from "./src/content/sdk-bridge"

// Debug logging - immediately when script loads
console.log('🔵 ABsmartly Extension: Content script loaded on', window.location.href)

// Check if chrome.runtime is available
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('✅ ABsmartly Extension: chrome.runtime is available')
} else {
  console.error('❌ ABsmartly Extension: chrome.runtime is NOT available')
}

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
// Drag-drop picker instance
const dragDropPicker = new DragDropPicker()

// Global message listener - set up immediately, not inside React component
try {
  chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
    console.log('📨 ABsmartly Extension: Received message (global listener):', message.type)
  
  if (message.type === "TEST_CONNECTION") {
    console.log('✅ Test connection message received!')
    sendResponse({ success: true, message: 'Content script is loaded and listening!' })
    return true
  } else if (message.type === "START_ELEMENT_PICKER") {
    console.log('Starting element picker from global listener')
    try {
      elementPicker.start((selector: string) => {
        console.log('Element selected:', selector)
        if (message.fromPopup) {
          console.log('Sending to popup via runtime')
          chrome.runtime.sendMessage({
            type: 'ELEMENT_SELECTED',
            selector: selector
          })
        } else {
          sendResponse({ selector })
        }
      })
      sendResponse({ success: true, message: 'Element picker started' })
    } catch (error) {
      console.error('Error starting element picker:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true // Keep channel open for async response
  } else if (message.type === "CANCEL_ELEMENT_PICKER") {
    console.log('Canceling element picker from global listener')
    elementPicker.stop()
    sendResponse({ success: true })
  } else if (message.type === "START_DRAG_DROP_PICKER") {
    console.log('Starting drag-drop picker from global listener')
    try {
      dragDropPicker.start(async (result: { selector: string, targetSelector: string, position: string }) => {
        console.log('Drag-drop complete:', result)
        
        // Use background script to access storage
        try {
          // First get the saved state to know which variant we're editing
          chrome.runtime.sendMessage({ 
            type: 'STORAGE_GET', 
            key: 'domChangesInlineState' 
          }, (response) => {
            if (response && response.success) {
              const savedState = response.value
              console.log('Saved state for drag-drop:', savedState)
              
              if (savedState && savedState.variantName) {
                const dragDropData = {
                  variantName: savedState.variantName,
                  selector: result.selector,
                  targetSelector: result.targetSelector,
                  position: result.position
                }
                console.log('Storing drag-drop result:', dragDropData)
                
                // Store the result via background script
                chrome.runtime.sendMessage({ 
                  type: 'STORAGE_SET', 
                  key: 'dragDropResult',
                  value: dragDropData
                }, (setResponse) => {
                  if (setResponse && setResponse.success) {
                    console.log('Drag-drop result stored in session storage')
                  } else {
                    console.error('Failed to store drag-drop result:', setResponse?.error)
                  }
                })
              } else {
                console.warn('No saved state found, cannot store drag-drop result')
              }
            } else {
              console.error('Failed to get saved state:', response?.error)
            }
          })
        } catch (e) {
          console.error('Error communicating with background script:', e)
        }
        
        // Also try sending message in case popup is open
        try {
          chrome.runtime.sendMessage({
            type: 'DRAG_DROP_COMPLETE',
            ...result
          })
        } catch (e) {
          console.log('Popup not available to receive message, result stored in storage')
        }
      })
      sendResponse({ success: true, message: 'Drag-drop picker started' })
    } catch (error) {
      console.error('Error starting drag-drop picker:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true
  } else if (message.type === "CANCEL_DRAG_DROP_PICKER") {
    console.log('Canceling drag-drop picker from global listener')
    dragDropPicker.stop()
    sendResponse({ success: true })
  }
  
  // Return false to allow other listeners to handle the message
  return false
  })
} catch (error) {
  console.error('❌ ABsmartly Extension: Failed to add message listener:', error)
}

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
      console.log('ABsmartly Extension: Received message in content script:', message.type)
      if (message.type === "TOGGLE_VISUAL_EDITOR") {
        setState(prev => ({ ...prev, isActive: !prev.isActive }))
        setShowPanel(message.show ?? !showPanel)
      } else if (message.type === "GET_DOM_CHANGES") {
        sendResponse({ changes: state.changes })
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
    if (!changes || !Array.isArray(changes)) return
    
    changes.forEach(change => {
      try {
        if (!change || !change.selector) return
        
        const elements = document.querySelectorAll(change.selector)
        elements.forEach(element => {
          if (element instanceof HTMLElement) {
            switch (change.type) {
              case 'text':
                if (change.value != null) {
                  element.textContent = String(change.value)
                }
                break
              case 'html':
                if (change.value != null) {
                  element.innerHTML = String(change.value)
                }
                break
              case 'style':
                if (change.value && typeof change.value === 'object') {
                  Object.entries(change.value).forEach(([property, value]) => {
                    if (property && value != null) {
                      element.style.setProperty(property, String(value))
                    }
                  })
                }
                break
              case 'class':
                if (change.add && Array.isArray(change.add)) {
                  element.classList.add(...change.add.filter(c => c))
                }
                if (change.remove && Array.isArray(change.remove)) {
                  element.classList.remove(...change.remove.filter(c => c))
                }
                break
              case 'attribute':
                if (change.value && typeof change.value === 'object') {
                  Object.entries(change.value).forEach(([attr, value]) => {
                    if (attr && value != null) {
                      element.setAttribute(attr, String(value))
                    }
                  })
                }
                break
              case 'javascript':
                // Execute JavaScript in the context of the element
                if (change.value && typeof change.value === 'string') {
                  try {
                    new Function('element', change.value)(element)
                  } catch (jsError) {
                    console.error('Error executing JavaScript:', jsError)
                  }
                }
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
          <h3>ABsmartly Visual Editor</h3>
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

// Log to confirm content script is loaded
console.log('🔵 ABsmartly Extension: Content script loaded on', window.location.href)
console.log('🔵 ABsmartly Extension: Setting up message listeners...')

// Test that chrome.runtime is available
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('✅ ABsmartly Extension: chrome.runtime is available')
} else {
  console.error('❌ ABsmartly Extension: chrome.runtime is NOT available!')
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log('ABsmartly Extension: DOM ready, mounting components')
    injectSDKBridge()
    mount()
  })
} else {
  console.log('ABsmartly Extension: DOM already loaded, mounting components')
  injectSDKBridge()
  mount()
}

// Export for Plasmo
export default VisualEditor

// The element picker is handled in the main message listener above