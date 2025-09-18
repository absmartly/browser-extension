/**
 * Notifications UI Component
 * Handles toast notifications for user feedback
 */

export class Notifications {
  private currentNotification: HTMLElement | null = null

  show(title: string, message: string = '', type: 'success' | 'error' | 'info' = 'info'): void {
    // Remove existing notification
    this.remove()

    const notification = document.createElement('div')
    notification.className = 'absmartly-notification'
    notification.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: ${this.getBackgroundColor(type)} !important;
      color: white !important;
      padding: 12px 20px !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
      z-index: 2147483647 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 14px !important;
      max-width: 400px !important;
      text-align: center !important;
      pointer-events: auto !important;
      animation: absmartly-slideUp 0.3s ease-out !important;
    `

    // Create content
    const content = message
      ? `<strong>${title}</strong> · ${message}`
      : `<strong>${title}</strong>`

    notification.innerHTML = content

    // Add animations if not already added
    this.addAnimationStyles()

    this.currentNotification = notification
    document.body.appendChild(notification)

    // Auto-remove after 3 seconds
    setTimeout(() => {
      this.remove()
    }, 3000)
  }

  remove(): void {
    if (this.currentNotification) {
      this.currentNotification.style.animation = 'absmartly-slideDown 0.3s ease-out forwards'
      setTimeout(() => {
        if (this.currentNotification) {
          this.currentNotification.remove()
          this.currentNotification = null
        }
      }, 300)
    }
  }

  private getBackgroundColor(type: 'success' | 'error' | 'info'): string {
    switch (type) {
      case 'success':
        return '#10b981'
      case 'error':
        return '#ef4444'
      case 'info':
      default:
        return '#3b82f6'
    }
  }

  private addAnimationStyles(): void {
    // Check if styles already exist
    if (document.getElementById('absmartly-notification-styles')) return

    const style = document.createElement('style')
    style.id = 'absmartly-notification-styles'
    style.textContent = `
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
    `
    document.head.appendChild(style)
  }
}