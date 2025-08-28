// This file contains the sidebar injection code that will be executed in the content script context

export const injectSidebar = () => {
  // Check if sidebar is already injected
  if (document.getElementById('absmartly-sidebar-root')) {
    console.log('🔵 ABSmartly Extension: Sidebar already exists, toggling visibility')
    const event = new CustomEvent('absmartly-toggle-sidebar')
    document.dispatchEvent(event)
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
    background-color: white;
    border-left: 1px solid #e5e7eb;
    box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #111827;
    display: none;
  `
  
  // Create the iframe for isolation
  const iframe = document.createElement('iframe')
  iframe.id = 'absmartly-sidebar-iframe'
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `
  // Use the tabs page as the iframe source
  iframe.src = chrome.runtime.getURL('tabs/sidebar.html')
  
  container.appendChild(iframe)
  document.body.appendChild(container)
  
  // Show the sidebar
  container.style.display = 'block'
  
  // Listen for toggle events
  document.addEventListener('absmartly-toggle-sidebar', () => {
    const sidebar = document.getElementById('absmartly-sidebar-root')
    if (sidebar) {
      sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none'
    }
  })
  
  console.log('🔵 ABSmartly Extension: Sidebar injected successfully')
}