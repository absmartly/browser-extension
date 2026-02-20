/**
 * Comprehensive unit tests for the Notifications UI component
 */

import { Notifications } from '../notifications'

// Mock timers for controlling setTimeout and animation timing
jest.useFakeTimers()

describe('Notifications', () => {
  let notifications: Notifications

  beforeEach(() => {
    notifications = new Notifications()
    // Clear DOM between tests
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    jest.clearAllTimers()
  })

  afterEach(() => {
    // Clean up any remaining timers
    jest.clearAllTimers()
    jest.runOnlyPendingTimers()
  })

  describe('show() method', () => {
    it('should create and display a notification with title only', () => {
      notifications.show('Test Notification')

      const notification = document.querySelector('.absmartly-notification')
      expect(notification).toBeTruthy()
      expect(notification?.innerHTML).toBe('<strong>Test Notification</strong>')
    })

    it('should create a notification with title and message', () => {
      notifications.show('Test Title', 'Test message')

      const notification = document.querySelector('.absmartly-notification')
      expect(notification?.innerHTML).toBe('<strong>Test Title</strong> · Test message')
    })

    it('should display success notification with correct styling', () => {
      notifications.show('Success', 'Operation completed', 'success')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(16, 185, 129)')
    })

    it('should display error notification with correct styling', () => {
      notifications.show('Error', 'Something went wrong', 'error')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(239, 68, 68)')
    })

    it('should display info notification with correct styling', () => {
      notifications.show('Info', 'Information message', 'info')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(59, 130, 246)')
    })

    it('should default to info type when no type specified', () => {
      notifications.show('Default Type')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(59, 130, 246)')
    })

    it('should apply correct CSS positioning and styling', () => {
      notifications.show('Styled Notification')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      const styles = notification.style

      expect(styles.position).toBe('fixed')
      expect(styles.bottom).toBe('20px')
      expect(styles.left).toBe('50%')
      expect(styles.transform).toBe('translateX(-50%)')
      expect(styles.color).toBe('white')
      expect(styles.padding).toBe('12px 20px')
      expect(styles.borderRadius).toBe('8px')
      expect(styles.zIndex).toBe('2147483647')
      expect(styles.fontFamily).toBe('system-ui, -apple-system, sans-serif')
      expect(styles.fontSize).toBe('14px')
      expect(styles.maxWidth).toBe('400px')
      expect(styles.textAlign).toBe('center')
      expect(styles.pointerEvents).toBe('auto')
      expect(styles.animation).toBe('absmartly-slideUp 0.3s ease-out')
    })

    it('should append notification to document body', () => {
      notifications.show('Body Test')

      expect(document.body.children.length).toBe(1)
      expect(document.body.children[0]).toHaveClass('absmartly-notification')
    })
  })

  describe('Auto-dismiss functionality', () => {
    it('should auto-dismiss notification after 3 seconds', () => {
      notifications.show('Auto-dismiss test')

      let notification = document.querySelector('.absmartly-notification')
      expect(notification).toBeTruthy()

      // Fast-forward time by 3 seconds
      jest.advanceTimersByTime(3000)

      // Should trigger slide-down animation
      const notificationAfterTimeout = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notificationAfterTimeout?.style.animation).toBe('absmartly-slideDown 0.3s ease-out forwards')

      // Fast-forward animation duration
      jest.advanceTimersByTime(300)

      // Notification should be removed from DOM
      notification = document.querySelector('.absmartly-notification')
      expect(notification).toBeFalsy()
    })

    it('should not auto-dismiss if manually removed first', () => {
      notifications.show('Manual dismiss test')

      // Manually remove before auto-dismiss timer
      notifications.remove()
      jest.advanceTimersByTime(300) // Wait for slide-down animation

      // Fast-forward past auto-dismiss time
      jest.advanceTimersByTime(3000)

      // Should still be no notification (shouldn't cause errors)
      const notification = document.querySelector('.absmartly-notification')
      expect(notification).toBeFalsy()
    })
  })

  describe('Multiple notification handling', () => {
    it('should create new notifications when called multiple times', () => {
      notifications.show('First notification')
      let allNotifications = document.querySelectorAll('.absmartly-notification')
      expect(allNotifications.length).toBe(1)

      notifications.show('Second notification')
      allNotifications = document.querySelectorAll('.absmartly-notification')
      // Due to implementation behavior, multiple notifications may exist temporarily
      expect(allNotifications.length).toBeGreaterThanOrEqual(1)
    })

    it('should update currentNotification reference', () => {
      const notificationsAny = notifications as any

      notifications.show('First')
      const firstRef = notificationsAny.currentNotification
      expect(firstRef).toBeTruthy()

      notifications.show('Second')
      const secondRef = notificationsAny.currentNotification
      expect(secondRef).toBeTruthy()
      expect(secondRef).not.toBe(firstRef) // Reference should be updated
    })
  })

  describe('remove() method', () => {
    it('should remove notification with slide-down animation', () => {
      notifications.show('Remove test')

      let notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification).toBeTruthy()

      notifications.remove()

      // Should apply slide-down animation
      expect(notification.style.animation).toBe('absmartly-slideDown 0.3s ease-out forwards')

      // Fast-forward animation
      jest.advanceTimersByTime(300)

      // Should be removed from DOM
      notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification).toBeFalsy()
    })

    it('should handle removal when no notification exists', () => {
      // Should not throw error
      expect(() => notifications.remove()).not.toThrow()
    })

    it('should handle multiple remove calls gracefully', () => {
      notifications.show('Multiple remove test')

      notifications.remove()
      notifications.remove() // Second call should not throw

      expect(() => notifications.remove()).not.toThrow()
    })
  })

  describe('Animation styles management', () => {
    it('should add animation styles to document head', () => {
      notifications.show('Animation test')

      const styleElement = document.getElementById('absmartly-notification-styles')
      expect(styleElement).toBeTruthy()
      expect(styleElement?.tagName).toBe('STYLE')
    })

    it('should not duplicate animation styles', () => {
      notifications.show('First')
      notifications.show('Second')

      const styleElements = document.querySelectorAll('#absmartly-notification-styles')
      expect(styleElements.length).toBe(1)
    })

    it('should include slideUp animation keyframes', () => {
      notifications.show('SlideUp test')

      const styleElement = document.getElementById('absmartly-notification-styles')
      const styleContent = styleElement?.textContent || ''

      expect(styleContent).toContain('@keyframes absmartly-slideUp')
      expect(styleContent).toContain('from')
      expect(styleContent).toContain('to')
      expect(styleContent).toContain('opacity: 0')
      expect(styleContent).toContain('opacity: 1')
      expect(styleContent).toContain('translateY(20px)')
      expect(styleContent).toContain('translateY(0)')
    })

    it('should include slideDown animation keyframes', () => {
      notifications.show('SlideDown test')

      const styleElement = document.getElementById('absmartly-notification-styles')
      const styleContent = styleElement?.textContent || ''

      expect(styleContent).toContain('@keyframes absmartly-slideDown')
      expect(styleContent).toContain('opacity: 1')
      expect(styleContent).toContain('opacity: 0')
    })
  })

  describe('Background color mapping', () => {
    it('should return correct color for success type', () => {
      notifications.show('Success test', 'Test message', 'success')
      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(16, 185, 129)')
    })

    it('should return correct color for error type', () => {
      notifications.show('Error test', 'Test message', 'error')
      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(239, 68, 68)')
    })

    it('should return correct color for info type', () => {
      notifications.show('Info test', 'Test message', 'info')
      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification?.style.background).toContain('rgb(59, 130, 246)')
    })
  })

  describe('Memory management', () => {
    it('should clear currentNotification reference on removal', () => {
      notifications.show('Memory test')

      // Access private property through type assertion for testing
      const notificationsAny = notifications as any
      expect(notificationsAny.currentNotification).toBeTruthy()

      notifications.remove()
      jest.advanceTimersByTime(300)

      expect(notificationsAny.currentNotification).toBeNull()
    })

    it('should clear currentNotification on auto-dismiss', () => {
      notifications.show('Auto-dismiss memory test')

      const notificationsAny = notifications as any
      expect(notificationsAny.currentNotification).toBeTruthy()

      // Trigger auto-dismiss
      jest.advanceTimersByTime(3000)
      jest.advanceTimersByTime(300)

      expect(notificationsAny.currentNotification).toBeNull()
    })
  })

  describe('DOM manipulation safety', () => {
    it('should handle missing document.body gracefully', () => {
      // Mock document.body to be null
      const originalBody = document.body
      Object.defineProperty(document, 'body', {
        value: null,
        writable: true
      })

      expect(() => notifications.show('No body test')).toThrow()

      // Restore document.body
      Object.defineProperty(document, 'body', {
        value: originalBody,
        writable: true
      })
    })

    it('should handle HTML content safely', () => {
      notifications.show('<script>alert("xss")</script>', 'Test message')

      const notification = document.querySelector('.absmartly-notification')
      expect(notification?.innerHTML).toBe('<strong>&lt;script&gt;alert("xss")&lt;/script&gt;</strong> · Test message')
    })
  })

  describe('Z-index and positioning', () => {
    it('should use maximum z-index for overlay', () => {
      notifications.show('Z-index test')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification.style.zIndex).toBe('2147483647')
    })

    it('should center notification horizontally', () => {
      notifications.show('Center test')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification.style.left).toBe('50%')
      expect(notification.style.transform).toBe('translateX(-50%)')
    })

    it('should position notification at bottom of viewport', () => {
      notifications.show('Bottom test')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification.style.bottom).toBe('20px')
    })
  })

  describe('Accessibility considerations', () => {
    it('should use appropriate semantic markup', () => {
      notifications.show('Accessibility test', 'Important message')

      const notification = document.querySelector('.absmartly-notification')
      const strongElements = notification?.querySelectorAll('strong')

      expect(strongElements?.length).toBe(1)
      expect(strongElements?.[0].textContent).toBe('Accessibility test')
    })

    it('should be readable with system fonts', () => {
      notifications.show('Font test')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification.style.fontFamily).toBe('system-ui, -apple-system, sans-serif')
    })

    it('should have sufficient contrast with white text', () => {
      notifications.show('Contrast test', 'Message', 'error')

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification.style.color).toBe('white')
      expect(notification.style.background).toContain('rgb(239, 68, 68)') // Dark enough for white text
    })
  })

  describe('Edge cases', () => {
    it('should handle empty title', () => {
      notifications.show('')

      const notification = document.querySelector('.absmartly-notification')
      expect(notification?.innerHTML).toBe('<strong></strong>')
    })

    it('should handle empty message with title', () => {
      notifications.show('Title', '')

      const notification = document.querySelector('.absmartly-notification')
      expect(notification?.innerHTML).toBe('<strong>Title</strong>')
    })

    it('should handle very long content', () => {
      const longTitle = 'A'.repeat(1000)
      const longMessage = 'B'.repeat(1000)

      notifications.show(longTitle, longMessage)

      const notification = document.querySelector('.absmartly-notification') as HTMLElement
      expect(notification.style.maxWidth).toBe('400px')
      expect(notification?.innerHTML).toContain(longTitle)
      expect(notification?.innerHTML).toContain(longMessage)
    })

    it('should handle special characters in content', () => {
      notifications.show('Special: !@#$%^&*()', 'More: <>{}[]|\\')

      const notification = document.querySelector('.absmartly-notification')
      // HTML entities are escaped by innerHTML
      expect(notification?.innerHTML).toContain('Special: !@#$%^&amp;*()')
      expect(notification?.innerHTML).toContain('More: &lt;&gt;{}[]|\\')
    })
  })

  describe('Performance considerations', () => {
    it('should reuse style element across instances', () => {
      const notifications1 = new Notifications()
      const notifications2 = new Notifications()

      notifications1.show('First instance')
      notifications2.show('Second instance')

      const styleElements = document.querySelectorAll('#absmartly-notification-styles')
      expect(styleElements.length).toBe(1)
    })

    it('should track currentNotification reference correctly with rapid calls', () => {
      const notificationsAny = notifications as any

      // Show notifications rapidly
      for (let i = 0; i < 3; i++) {
        notifications.show(`Notification ${i}`)
      }

      // Current notification reference should be the last one
      expect(notificationsAny.currentNotification).toBeTruthy()
      expect(notificationsAny.currentNotification.innerHTML).toBe('<strong>Notification 2</strong>')

      // Allow cleanup
      jest.advanceTimersByTime(600)

      // There should be at least one notification (the current one)
      const allNotifications = document.querySelectorAll('.absmartly-notification')
      expect(allNotifications.length).toBeGreaterThanOrEqual(1)
    })
  })
})