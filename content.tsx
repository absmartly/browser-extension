import type { PlasmoCSConfig, PlasmoGetRootContainer, PlasmoGetStyle } from "plasmo"
import React, { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import type { DOMChangeInstruction } from "./src/types/sdk-plugin"
import { ElementPicker } from "./src/content/element-picker"
import { DragDropPicker } from "./src/content/drag-drop-picker"
import { VisualEditor } from "./src/content/visual-editor"
// Temporarily disabled due to CSP violations
// import { injectSDKBridge } from "./src/content/sdk-bridge"

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
  run_at: "document_start",
  all_frames: false
}

// Tell Plasmo not to auto-mount anything
export const getInlineAnchor = () => undefined
export const getShadowHostId = () => undefined

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
// Visual editor instance
let visualEditor: VisualEditor | null = null

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
  } else if (message.type === "START_VISUAL_EDITOR") {
    console.log('Starting visual editor from global listener')
    try {
      // Clean up existing visual editor if any
      if (visualEditor) {
        visualEditor.destroy()
      }
      
      // Create new visual editor instance with proper options
      visualEditor = new VisualEditor({
        variantName: message.variantName,
        initialChanges: message.changes || [],
        onChangesUpdate: (changes) => {
          console.log('Visual editor changes:', changes)
          
          // Store the changes via background script
          chrome.runtime.sendMessage({ 
            type: 'STORAGE_SET', 
            key: 'visualEditorChanges',
            value: {
              variantName: message.variantName,
              changes: changes
            }
          }, (setResponse) => {
            if (setResponse && setResponse.success) {
              console.log('Visual editor changes stored')
            } else {
              console.error('Failed to store visual editor changes:', setResponse?.error)
            }
          })
          
          // Also send to popup if it's open
          try {
            chrome.runtime.sendMessage({
              type: 'VISUAL_EDITOR_CHANGES',
              variantName: message.variantName,
              changes: changes
            })
          } catch (e) {
            console.log('Popup not available to receive changes')
          }
        }
      })
      
      // Start the visual editor
      visualEditor.start()
      sendResponse({ success: true, message: 'Visual editor started' })
    } catch (error) {
      console.error('Error starting visual editor:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true
  } else if (message.type === "STOP_VISUAL_EDITOR") {
    console.log('Stopping visual editor from global listener')
    if (visualEditor) {
      const finalChanges = visualEditor.getChanges()
      visualEditor.destroy()
      visualEditor = null
      sendResponse({ success: true, changes: finalChanges })
    } else {
      sendResponse({ success: true, changes: [] })
    }
    return true
  }
  
  // Return false to allow other listeners to handle the message
  return false
  })
} catch (error) {
  console.error('❌ ABsmartly Extension: Failed to add message listener:', error)
}

// Import extension UI component for sidebar
import ExtensionUI from "./src/components/ExtensionUI"

// Inject sidebar styles
const injectSidebarStyles = () => {
  if (!document.head) {
    console.warn('ABSmartly Extension: document.head not ready yet')
    return
  }
  
  if (document.getElementById('absmartly-sidebar-styles')) return
  
  const style = document.createElement('style')
  style.id = 'absmartly-sidebar-styles'
  style.textContent = `
    .absmartly-sidebar-toggle {
      position: fixed !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      width: 48px !important;
      height: 48px !important;
      background-color: #6366f1 !important;
      color: white !important;
      border-radius: 8px 0 0 8px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      font-size: 18px !important;
      font-weight: bold !important;
      box-shadow: -2px 2px 8px rgba(0,0,0,0.15) !important;
      transition: right 0.3s ease !important;
      z-index: 2147483647 !important;
      border: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    
    .absmartly-sidebar-toggle.open {
      right: 384px !important;
    }
    
    .absmartly-sidebar-toggle.closed {
      right: 0 !important;
    }
    
    .absmartly-sidebar-toggle:hover {
      background-color: #4f46e5 !important;
    }
    
    .absmartly-sidebar-panel {
      position: fixed !important;
      top: 0 !important;
      width: 384px !important;
      height: 100vh !important;
      background-color: white !important;
      box-shadow: -2px 0 10px rgba(0,0,0,0.1) !important;
      transition: right 0.3s ease !important;
      overflow: auto !important;
      z-index: 2147483646 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    
    .absmartly-sidebar-panel.open {
      right: 0 !important;
    }
    
    .absmartly-sidebar-panel.closed {
      right: -384px !important;
    }
    
    .absmartly-sidebar-content {
      width: 100% !important;
      height: 100% !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    
    body.absmartly-sidebar-open {
      margin-right: 384px !important;
      transition: margin-right 0.3s ease !important;
    }
    
    /* Ensure all content in sidebar uses correct font */
    #absmartly-sidebar-root * {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    
    /* Visual Editor Hover Overlay */
    .absmartly-hover-overlay-active {
      position: absolute !important;
      pointer-events: none !important;
      border: 2px dashed #3b82f6 !important;
      background-color: rgba(59, 130, 246, 0.1) !important;
      display: none !important;
      z-index: 9998 !important;
    }
  `
  document.head.appendChild(style)
}

// Sidebar Component
function ABSmartlySidebar() {
  const [isOpen, setIsOpen] = useStorage("absmartly-sidebar-open", false)
  
  useEffect(() => {
    injectSidebarStyles()
    
    // Ensure document.body exists before manipulating it
    if (!document.body) {
      console.warn('ABSmartly Extension: document.body not ready yet')
      return
    }
    
    // Adjust page margin when sidebar opens/closes
    if (isOpen) {
      document.body.classList.add('absmartly-sidebar-open')
    } else {
      document.body.classList.remove('absmartly-sidebar-open')
    }
    
    return () => {
      if (document.body) {
        document.body.classList.remove('absmartly-sidebar-open')
      }
    }
  }, [isOpen])
  
  return (
    <>
      {/* Toggle Button */}
      <button 
        className={`absmartly-sidebar-toggle ${isOpen ? 'open' : 'closed'}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close ABsmartly" : "Open ABsmartly"}
      >
        {isOpen ? (
          "×"
        ) : (
          <img 
            src={chrome.runtime.getURL("assets/absmartly-logo-white.svg")} 
            alt="ABsmartly"
            style={{ 
              width: '32px', 
              height: '13px', 
              objectFit: 'contain'
            }}
          />
        )}
      </button>
      
      {/* Sidebar Panel */}
      <div className={`absmartly-sidebar-panel ${isOpen ? 'open' : 'closed'}`}>
        {isOpen && (
          <div className="absmartly-sidebar-content">
            <ExtensionUI />
          </div>
        )}
      </div>
    </>
  )
}

// Visual Editor React Component (OLD - NOT USED)
function VisualEditorReactComponent() {
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
                // JavaScript execution disabled due to CSP restrictions
                // This would require a different approach, perhaps through
                // chrome.scripting API or a dedicated content script
                console.warn('JavaScript execution is disabled for CSP compliance')
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
          className="absmartly-hover-overlay absmartly-hover-overlay-active"
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

// Plasmo will handle mounting the component automatically

// Don't export the component by default - we'll mount it manually
// export default ABSmartlySidebar

// Manual sidebar management
let sidebarMounted = false
let sidebarRoot: any = null

function mountSidebar() {
  if (sidebarMounted || !document.body) return
  
  console.log('🔵 ABSmartly Extension: Mounting sidebar')
  
  // Check if container already exists
  let container = document.getElementById("absmartly-sidebar-root")
  if (!container) {
    container = document.createElement("div")
    container.id = "absmartly-sidebar-root"
    container.style.cssText = "all: initial; z-index: 2147483647;"
    document.body.appendChild(container)
  }
  
  // Create root and render
  sidebarRoot = createRoot(container)
  sidebarRoot.render(React.createElement(ABSmartlySidebar))
  sidebarMounted = true
  console.log('✅ ABSmartly Extension: Sidebar mounted')
}

function unmountSidebar() {
  if (!sidebarMounted) return
  
  console.log('🔵 ABSmartly Extension: Unmounting sidebar')
  
  if (sidebarRoot) {
    sidebarRoot.unmount()
    sidebarRoot = null
  }
  
  const container = document.getElementById("absmartly-sidebar-root")
  if (container) {
    container.remove()
  }
  
  // Clean up body class
  document.body.classList.remove('absmartly-sidebar-open')
  
  sidebarMounted = false
  console.log('✅ ABSmartly Extension: Sidebar unmounted')
}

// Listen for toggle message from background script
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    console.log('📨 ABSmartly Extension: Received TOGGLE_SIDEBAR message')
    
    if (sidebarMounted) {
      unmountSidebar()
    } else {
      mountSidebar()
    }
    
    sendResponse({ success: true, mounted: !sidebarMounted })
    return true
  }
  
  // Let the existing listener handle other messages
  return false
})

// The element picker is handled in the main message listener above