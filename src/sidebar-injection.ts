// This file contains the sidebar injection code that will be executed in the content script context

let sidebarVisible = false
let sidebarMinimized = false

export const injectSidebar = () => {
  // Check if sidebar is already injected
  const existingContainer = document.getElementById('absmartly-sidebar-root')
  if (existingContainer) {
    console.log('🔵 ABSmartly Extension: Sidebar already exists, toggling visibility')
    // Get current transform to determine actual visibility
    const currentTransform = existingContainer.style.transform
    const isCurrentlyVisible = currentTransform === 'translateX(0)' || currentTransform === ''
    
    // Toggle based on actual current state
    if (isCurrentlyVisible) {
      existingContainer.style.transform = 'translateX(100%)'
      sidebarVisible = false
    } else {
      existingContainer.style.transform = 'translateX(0)'
      sidebarVisible = true
    }
    return
  }

  console.log('🔵 ABSmartly Extension: Injecting sidebar')

  // Create the sidebar container
  const container = document.createElement('div')
  container.id = 'absmartly-sidebar-root'
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 384px;
    height: 100vh;
    z-index: 2147483647;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out, width 0.3s ease-in-out;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  `

  // Create shadow DOM for style isolation
  const shadowRoot = container.attachShadow({ mode: 'open' })
  
  // Create styles for the shadow DOM
  const shadowStyles = document.createElement('style')
  shadowStyles.textContent = `
    :host {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      background: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
    }
    * {
      box-sizing: border-box;
    }
    .sidebar-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
    }
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: #3b82f6;
      flex-shrink: 0;
    }
    .sidebar-header.minimized {
      padding: 12px;
      flex-direction: column;
      gap: 12px;
      background-color: white;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo {
      height: 24px;
    }
    .title {
      font-weight: 600;
      font-size: 16px;
      color: white;
    }
    .buttons-container {
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: white;
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .expand-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      background: #3b82f6;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
    }
    .expand-btn:hover {
      background: #2563eb;
    }
    .vertical-text {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 12px;
      color: #6b7280;
      letter-spacing: 0.05em;
      flex: 1;
      display: flex;
      align-items: center;
    }
    .sidebar-body {
      flex: 1;
      overflow: auto;
      padding: 0;
    }
  `
  shadowRoot.appendChild(shadowStyles)
  
  // Create the sidebar structure
  const sidebarContainer = document.createElement('div')
  sidebarContainer.className = 'sidebar-container'
  
  // Create header
  const header = document.createElement('div')
  header.className = 'sidebar-header'
  
  const updateSidebar = () => {
    container.style.width = sidebarMinimized ? '48px' : '384px'
    
    header.innerHTML = ''
    header.className = sidebarMinimized ? 'sidebar-header minimized' : 'sidebar-header'
    
    if (sidebarMinimized) {
      // Minimized header - vertical layout
      const expandBtn = document.createElement('button')
      expandBtn.className = 'expand-btn'
      expandBtn.innerHTML = '←'
      expandBtn.title = 'Expand sidebar'
      expandBtn.onclick = () => {
        sidebarMinimized = false
        updateSidebar()
        chrome.storage.local.set({ sidebarMinimized: false })
      }
      
      const text = document.createElement('div')
      text.className = 'vertical-text'
      text.innerText = 'ABSmartly'
      
      header.appendChild(expandBtn)
      header.appendChild(text)
    } else {
      // Full header
      const logoContainer = document.createElement('div')
      logoContainer.className = 'logo-container'
      
      const logo = document.createElement('img')
      logo.src = chrome.runtime.getURL('assets/absmartly-logo-white.svg')
      logo.alt = 'ABSmartly'
      logo.className = 'logo'
      
      const title = document.createElement('span')
      title.className = 'title'
      title.innerText = 'ABSmartly'
      
      logoContainer.appendChild(logo)
      logoContainer.appendChild(title)
      
      const buttonsContainer = document.createElement('div')
      buttonsContainer.className = 'buttons-container'
      
      const minimizeBtn = document.createElement('button')
      minimizeBtn.className = 'btn'
      minimizeBtn.innerHTML = '→'
      minimizeBtn.title = 'Minimize sidebar'
      minimizeBtn.onclick = () => {
        sidebarMinimized = true
        updateSidebar()
        chrome.storage.local.set({ sidebarMinimized: true })
      }
      
      const closeBtn = document.createElement('button')
      closeBtn.className = 'btn'
      closeBtn.innerHTML = '✕'
      closeBtn.title = 'Close sidebar'
      closeBtn.onclick = () => {
        sidebarVisible = false
        container.style.transform = 'translateX(100%)'
      }
      
      buttonsContainer.appendChild(minimizeBtn)
      buttonsContainer.appendChild(closeBtn)
      
      header.appendChild(logoContainer)
      header.appendChild(buttonsContainer)
    }
  }
  
  // Create body for React content
  const body = document.createElement('div')
  body.className = 'sidebar-body'
  body.id = 'extension-ui-root'
  
  sidebarContainer.appendChild(header)
  sidebarContainer.appendChild(body)
  shadowRoot.appendChild(sidebarContainer)
  
  // Load saved minimized state
  chrome.storage.local.get(['sidebarMinimized'], (result) => {
    if (result.sidebarMinimized !== undefined) {
      sidebarMinimized = result.sidebarMinimized
    }
    updateSidebar()
  })
  
  document.body.appendChild(container)
  
  // Show the sidebar immediately
  sidebarVisible = true
  // Use requestAnimationFrame for smooth initial animation
  requestAnimationFrame(() => {
    container.style.transform = 'translateX(0)'
  })
  
  // Load and mount the React component
  // We'll use dynamic import to load the component
  import('~src/components/ExtensionUI').then(({ default: ExtensionUI }) => {
    import('react').then(({ default: React }) => {
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(body)
        root.render(React.createElement(ExtensionUI))
      })
    })
  })
  
  console.log('🔵 ABSmartly Extension: Sidebar injected successfully')
}