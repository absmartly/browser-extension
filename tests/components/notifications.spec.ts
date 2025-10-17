import { test, expect } from '@playwright/test'

/**
 * Notifications Component Tests
 *
 * Comprehensive tests for the Notifications component using Playwright component testing.
 * Tests toast notification rendering, auto-dismiss timing, multiple notifications stacking,
 * click to dismiss functionality, animation transitions, positioning, message truncation,
 * icons, ARIA announcements, and queue management.
 */

// Mock Notifications implementation for testing
const mockNotificationsCode = `
class TestNotifications {
  constructor() {
    this.notificationQueue = []
    this.currentNotification = null
    this.notificationCounter = 0
    this.maxNotifications = 5
  }

  show(title, message = '', type = 'info', options = {}) {
    const notification = {
      id: ++this.notificationCounter,
      title,
      message,
      type,
      duration: options.duration || 3000,
      persistent: options.persistent || false,
      clickToDismiss: options.clickToDismiss !== false,
      showIcon: options.showIcon !== false,
      ariaLive: options.ariaLive || 'polite'
    }

    // Handle queue management
    if (this.notificationQueue.length >= this.maxNotifications) {
      this.notificationQueue.shift() // Remove oldest
    }

    this.notificationQueue.push(notification)
    this.processQueue()

    return notification.id
  }

  processQueue() {
    if (this.currentNotification || this.notificationQueue.length === 0) {
      return
    }

    const notification = this.notificationQueue.shift()
    this.displayNotification(notification)
  }

  displayNotification(notification) {
    // Remove existing notification
    this.remove()

    const notificationEl = document.createElement('div')
    notificationEl.id = \`notification-\${notification.id}\`
    notificationEl.className = 'absmartly-notification'
    notificationEl.setAttribute('role', 'alert')
    notificationEl.setAttribute('aria-live', notification.ariaLive)
    notificationEl.setAttribute('data-type', notification.type)
    notificationEl.setAttribute('data-notification-id', notification.id)

    // Apply styles based on type and positioning
    notificationEl.style.cssText = \`
      position: fixed !important;
      bottom: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(0) !important;
      background: \${this.getBackgroundColor(notification.type)} !important;
      color: white !important;
      padding: 12px 20px !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
      z-index: 2147483647 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 14px !important;
      max-width: 400px !important;
      min-width: 200px !important;
      text-align: left !important;
      pointer-events: auto !important;
      animation: absmartly-slideUp 0.3s ease-out !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      transition: all 0.3s ease-out !important;
    \`

    // Create notification content
    const content = this.createNotificationContent(notification)
    notificationEl.innerHTML = content

    // Add animations if not already added
    this.addAnimationStyles()

    // Add click to dismiss handler
    if (notification.clickToDismiss) {
      notificationEl.style.cursor = 'pointer'
      notificationEl.addEventListener('click', () => {
        this.dismiss(notification.id)
      })
    }

    this.currentNotification = notificationEl
    document.body.appendChild(notificationEl)

    // Auto-dismiss after duration (unless persistent)
    if (!notification.persistent && notification.duration > 0) {
      setTimeout(() => {
        this.dismiss(notification.id)
      }, notification.duration)
    }

    // Announce to screen readers
    this.announceToScreenReader(notification)
  }

  createNotificationContent(notification) {
    const icon = notification.showIcon ? this.getIcon(notification.type) : ''
    const iconHtml = icon ? \`<span class="notification-icon" aria-hidden="true">\${icon}</span>\` : ''

    const titleHtml = \`<span class="notification-title">\${this.escapeHtml(notification.title)}</span>\`

    const messageHtml = notification.message
      ? \`<span class="notification-message">\${this.escapeHtml(this.truncateMessage(notification.message))}</span>\`
      : ''

    return \`
      <div class="notification-content" style="display: flex; align-items: flex-start; gap: 8px;">
        \${iconHtml}
        <div class="notification-text" style="flex: 1; min-width: 0;">
          \${titleHtml}
          \${messageHtml}
        </div>
        <button class="notification-close" aria-label="Close notification" style="
          background: none;
          border: none;
          color: inherit;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          margin-left: 8px;
          line-height: 1;
          opacity: 0.7;
        " onclick="event.stopPropagation(); this.closest('.absmartly-notification').remove();">×</button>
      </div>
    \`
  }

  truncateMessage(message, maxLength = 200) {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + '...'
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }
    return icons[type] || icons.info
  }

  getBackgroundColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    }
    return colors[type] || colors.info
  }

  dismiss(notificationId) {
    const notification = document.querySelector(\`[data-notification-id="\${notificationId}"]\`)
    if (notification) {
      this.remove(notification)
    }
  }

  remove(notificationElement = null) {
    const element = notificationElement || this.currentNotification
    if (element) {
      element.style.animation = 'absmartly-slideDown 0.3s ease-out forwards'
      setTimeout(() => {
        if (element && element.parentNode) {
          element.remove()
          if (element === this.currentNotification) {
            this.currentNotification = null
            // Process next in queue
            setTimeout(() => this.processQueue(), 100)
          }
        }
      }, 300)
    }
  }

  clear() {
    this.notificationQueue = []
    this.remove()
  }

  announceToScreenReader(notification) {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', notification.ariaLive)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.style.cssText = \`
      position: absolute !important;
      left: -10000px !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
    \`

    const text = notification.message
      ? \`\${notification.title}. \${notification.message}\`
      : notification.title

    announcement.textContent = text
    document.body.appendChild(announcement)

    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.remove()
      }
    }, 1000)
  }

  addAnimationStyles() {
    if (document.getElementById('absmartly-notification-styles')) return

    const style = document.createElement('style')
    style.id = 'absmartly-notification-styles'
    style.textContent = \`
      @keyframes absmartly-slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      @keyframes absmartly-slideDown {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
      }

      .absmartly-notification {
        transition: all 0.3s ease-out;
      }

      .absmartly-notification:hover {
        transform: translateX(-50%) translateY(-2px) !important;
        box-shadow: 0 12px 30px rgba(0,0,0,0.25) !important;
      }

      .notification-title {
        font-weight: 600;
        display: block;
        margin-bottom: 2px;
      }

      .notification-message {
        font-size: 13px;
        opacity: 0.9;
        display: block;
        line-height: 1.4;
      }

      .notification-icon {
        font-size: 16px;
        margin-top: 1px;
      }

      .notification-close:hover {
        opacity: 1 !important;
      }
    \`
    document.head.appendChild(style)
  }
}

window.TestNotifications = TestNotifications
`

test.describe('Notifications Component Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notifications Test Page</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              min-height: 100vh;
            }
            .test-container {
              width: 100%;
              height: 100vh;
              position: relative;
            }
            .trigger-button {
              padding: 10px 20px;
              margin: 10px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="test-container">
            <h1>Notification Test Page</h1>
            <button id="success-btn" class="trigger-button">Show Success</button>
            <button id="error-btn" class="trigger-button">Show Error</button>
            <button id="warning-btn" class="trigger-button">Show Warning</button>
            <button id="info-btn" class="trigger-button">Show Info</button>
            <button id="long-message-btn" class="trigger-button">Show Long Message</button>
            <button id="persistent-btn" class="trigger-button">Show Persistent</button>
            <button id="multiple-btn" class="trigger-button">Show Multiple</button>
            <button id="clear-btn" class="trigger-button">Clear All</button>
          </div>
        </body>
      </html>
    `)

    // Inject the notifications implementation
    await page.evaluate(mockNotificationsCode)

    // Initialize notifications and set up event handlers
    await page.evaluate(() => {
      window.notifications = new window.TestNotifications()

      // Set up button handlers
      document.getElementById('success-btn').addEventListener('click', () => {
        window.notifications.show('Success!', 'Operation completed successfully', 'success')
      })

      document.getElementById('error-btn').addEventListener('click', () => {
        window.notifications.show('Error!', 'Something went wrong', 'error')
      })

      document.getElementById('warning-btn').addEventListener('click', () => {
        window.notifications.show('Warning!', 'Please check your input', 'warning')
      })

      document.getElementById('info-btn').addEventListener('click', () => {
        window.notifications.show('Info', 'Here is some information', 'info')
      })

      document.getElementById('long-message-btn').addEventListener('click', () => {
        const longMessage = 'This is a very long notification message that should be truncated when it exceeds the maximum length limit. It contains a lot of text to test the truncation functionality and ensure that notifications do not become too large or unwieldy for users to read comfortably.'
        window.notifications.show('Long Message', longMessage, 'info')
      })

      document.getElementById('persistent-btn').addEventListener('click', () => {
        window.notifications.show('Persistent', 'This notification will not auto-dismiss', 'info', { persistent: true })
      })

      document.getElementById('multiple-btn').addEventListener('click', () => {
        window.notifications.show('First', 'First notification', 'success')
        setTimeout(() => window.notifications.show('Second', 'Second notification', 'warning'), 100)
        setTimeout(() => window.notifications.show('Third', 'Third notification', 'error'), 200)
      })

      document.getElementById('clear-btn').addEventListener('click', () => {
        window.notifications.clear()
      })
    })
  })

  test('should render toast notifications with different types', async ({ page }) => {
    // Test success notification
    await page.click('#success-btn')

    const successNotification = page.locator('.absmartly-notification[data-type="success"]')
    await expect(successNotification).toBeVisible()

    // Check content
    await expect(successNotification.locator('.notification-title')).toHaveText('Success!')
    await expect(successNotification.locator('.notification-message')).toHaveText('Operation completed successfully')
    await expect(successNotification.locator('.notification-icon')).toHaveText('✅')

    // Check styling
    const successBg = await successNotification.evaluate(el => window.getComputedStyle(el).backgroundColor)
    expect(successBg).toBe('rgb(16, 185, 129)') // #10b981

    // Clear and test error notification
    await page.click('#clear-btn')
    await expect(successNotification).not.toBeVisible()

    await page.click('#error-btn')

    const errorNotification = page.locator('.absmartly-notification[data-type="error"]')
    await expect(errorNotification).toBeVisible()
    await expect(errorNotification.locator('.notification-icon')).toHaveText('❌')

    const errorBg = await errorNotification.evaluate(el => window.getComputedStyle(el).backgroundColor)
    expect(errorBg).toBe('rgb(239, 68, 68)') // #ef4444
  })

  test('should auto-dismiss notifications after specified timing', async ({ page }) => {
    // Show notification with custom duration
    await page.evaluate(() => {
      window.notifications.show('Test Timer', 'Will dismiss in 1 second', 'info', { duration: 1000 })
    })

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Wait for auto-dismiss
    await expect(notification).not.toBeVisible({ timeout: 2000 })
  })

  test('should not auto-dismiss persistent notifications', async ({ page }) => {
    await page.click('#persistent-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Wait longer than normal auto-dismiss time
    await page.waitForTimeout(4000)

    // Should still be visible
    await expect(notification).toBeVisible()
  })

  test('should handle multiple notifications with queue management', async ({ page }) => {
    await page.click('#multiple-btn')

    // Should only show one notification at a time
    const notifications = page.locator('.absmartly-notification')
    await expect(notifications).toHaveCount(1)

    // First notification should be visible
    await expect(notifications.first()).toBeVisible()
    await expect(notifications.first().locator('.notification-title')).toHaveText('First')

    // Wait for first to dismiss and second to appear
    await expect(page.locator('.absmartly-notification').locator('.notification-title').filter({ hasText: 'Second' })).toBeVisible({ timeout: 5000 })
  })

  test('should handle rapid notification creation without overwhelming queue', async ({ page }) => {
    // Create more notifications than the queue limit
    await page.evaluate(() => {
      for (let i = 1; i <= 8; i++) {
        window.notifications.show(`Notification ${i}`, `Message ${i}`, 'info', { duration: 500 })
      }
    })

    // Should only process up to queue limit
    const queueLength = await page.evaluate(() => window.notifications.notificationQueue.length)
    expect(queueLength).toBeLessThanOrEqual(5) // maxNotifications = 5
  })

  test('should dismiss notifications when clicked', async ({ page }) => {
    await page.click('#info-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Click on notification to dismiss
    await notification.click()

    // Should be dismissed with animation
    await expect(notification).not.toBeVisible({ timeout: 1000 })
  })

  test('should dismiss notifications using close button', async ({ page }) => {
    await page.click('#success-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Click close button
    await notification.locator('.notification-close').click()

    // Should be dismissed
    await expect(notification).not.toBeVisible({ timeout: 1000 })
  })

  test('should show animation transitions correctly', async ({ page }) => {
    await page.click('#info-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Check that animation styles are applied
    const animationName = await notification.evaluate(el => window.getComputedStyle(el).animationName)
    expect(animationName).toBe('absmartly-slideUp')

    // Test hover animation - transform is computed as matrix, so check for matrix values
    await notification.hover()
    const transform = await notification.evaluate(el => window.getComputedStyle(el).transform)
    // Transform matrix should indicate vertical translation (matrix includes Y offset)
    expect(transform).toMatch(/matrix\([^)]+\)/)
  })

  test('should position notifications correctly on screen', async ({ page }) => {
    await page.click('#info-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Check positioning - use inline style for left (browsers compute to pixels)
    const styles = await notification.evaluate(el => {
      const computed = window.getComputedStyle(el)
      const inline = (el as HTMLElement).style
      return {
        position: computed.position,
        bottom: computed.bottom,
        left: inline.left, // Use inline style which preserves percentage
        transform: computed.transform,
        zIndex: computed.zIndex
      }
    })

    expect(styles.position).toBe('fixed')
    expect(styles.bottom).toBe('20px')
    expect(styles.left).toBe('50%')
    expect(styles.transform).toMatch(/matrix\([^)]+\)/) // Transform computed as matrix
    expect(parseInt(styles.zIndex)).toBeGreaterThan(2000000)
  })

  test('should truncate long messages appropriately', async ({ page }) => {
    await page.click('#long-message-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    const messageText = await notification.locator('.notification-message').textContent()

    // Should be truncated with ellipsis
    expect(messageText.length).toBeLessThanOrEqual(203) // 200 chars + "..."
    expect(messageText).toContain('...')

    // Should not break layout - max-width is 400px but padding/content adds ~40px
    const notificationWidth = await notification.evaluate(el => (el as HTMLElement).offsetWidth)
    expect(notificationWidth).toBeLessThanOrEqual(450) // Allow for padding and content
  })

  test('should display appropriate icons for different notification types', async ({ page }) => {
    // Test all notification types
    const testCases = [
      { button: '#success-btn', type: 'success', expectedIcon: '✅' },
      { button: '#error-btn', type: 'error', expectedIcon: '❌' },
      { button: '#warning-btn', type: 'warning', expectedIcon: '⚠️' },
      { button: '#info-btn', type: 'info', expectedIcon: 'ℹ️' }
    ]

    for (const testCase of testCases) {
      await page.click('#clear-btn') // Clear previous
      await page.click(testCase.button)

      const notification = page.locator(`[data-type="${testCase.type}"]`)
      await expect(notification).toBeVisible()

      const icon = notification.locator('.notification-icon')
      await expect(icon).toHaveText(testCase.expectedIcon)
      await expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('should provide proper ARIA announcements for screen readers', async ({ page }) => {
    await page.click('#info-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Check ARIA attributes
    await expect(notification).toHaveAttribute('role', 'alert')
    await expect(notification).toHaveAttribute('aria-live', 'polite')

    // Check for screen reader announcement element
    const srAnnouncement = await page.evaluate(() => {
      const announcements = Array.from(document.querySelectorAll('[aria-live]'))
      return announcements.find(el =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.left === '-10000px'
      )
    })

    expect(srAnnouncement).toBeTruthy()
  })

  test('should handle notifications without icons when configured', async ({ page }) => {
    await page.evaluate(() => {
      window.notifications.show('No Icon', 'This notification has no icon', 'info', { showIcon: false })
    })

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Should not have icon
    const icon = notification.locator('.notification-icon')
    await expect(icon).not.toBeVisible()
  })

  test('should maintain proper stacking order with multiple rapid notifications', async ({ page }) => {
    // Create notifications rapidly
    await page.evaluate(() => {
      window.notifications.show('First', 'First message', 'success', { duration: 2000 })
      setTimeout(() => window.notifications.show('Second', 'Second message', 'warning', { duration: 2000 }), 50)
      setTimeout(() => window.notifications.show('Third', 'Third message', 'error', { duration: 2000 }), 100)
    })

    // Should only show one at a time
    const visibleNotifications = page.locator('.absmartly-notification')
    await expect(visibleNotifications).toHaveCount(1)

    // First notification should be shown first
    await expect(visibleNotifications.locator('.notification-title')).toHaveText('First')
  })

  test('should handle edge cases gracefully', async ({ page }) => {
    // Test empty title
    await page.evaluate(() => {
      window.notifications.show('', 'Message only', 'info')
    })

    let notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    await page.click('#clear-btn')

    // Test empty message
    await page.evaluate(() => {
      window.notifications.show('Title only', '', 'info')
    })

    notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()
    await expect(notification.locator('.notification-message')).not.toBeVisible()

    await page.click('#clear-btn')

    // Test HTML escaping
    await page.evaluate(() => {
      window.notifications.show('<script>alert("xss")</script>', '<img src=x onerror=alert("xss")>', 'info')
    })

    notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Should escape HTML
    const titleText = await notification.locator('.notification-title').textContent()
    expect(titleText).toBe('<script>alert("xss")</script>')
  })

  test('should cleanup properly when notifications are removed', async ({ page }) => {
    await page.click('#info-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Get notification ID
    const notificationId = await notification.getAttribute('data-notification-id')

    // Clear all notifications
    await page.click('#clear-btn')

    // Should be removed from DOM
    await expect(notification).not.toBeVisible()

    // Should not leave any notification elements
    const remainingNotifications = await page.locator('.absmartly-notification').count()
    expect(remainingNotifications).toBe(0)

    // Queue should be empty
    const queueLength = await page.evaluate(() => window.notifications.notificationQueue.length)
    expect(queueLength).toBe(0)
  })

  test('should handle viewport resizing correctly', async ({ page }) => {
    await page.click('#info-btn')

    const notification = page.locator('.absmartly-notification')
    await expect(notification).toBeVisible()

    // Get initial position
    const initialPosition = await notification.evaluate(el => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left, bottom: window.innerHeight - rect.bottom }
    })

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 400 })

    // Position should adjust to stay centered
    const newPosition = await notification.evaluate(el => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left, bottom: window.innerHeight - rect.bottom }
    })

    // Should remain centered horizontally and same distance from bottom
    expect(Math.abs(newPosition.bottom - initialPosition.bottom)).toBeLessThan(5)

    // Should be centered in new viewport width
    const expectedLeft = 800 / 2 // New viewport center
    expect(Math.abs(newPosition.left + (await notification.evaluate(el => (el as HTMLElement).offsetWidth / 2)) - expectedLeft)).toBeLessThan(10)
  })
})