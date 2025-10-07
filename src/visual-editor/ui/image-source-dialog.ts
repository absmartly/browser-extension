/**
 * Image Source Dialog
 * Dialog for changing image sources (img src or background-image)
 */

export class ImageSourceDialog {
  private dialogHost: HTMLElement | null = null
  private resolveCallback: ((value: string | null) => void) | null = null

  show(element: Element, currentSrc: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolveCallback = resolve
      this.createDialog(element, currentSrc)
    })
  }

  getCurrentImageSource(element: Element): string {
    if (element.tagName.toLowerCase() === 'img') {
      return (element as HTMLImageElement).src
    }

    const computedStyle = window.getComputedStyle(element)
    const backgroundImage = computedStyle.backgroundImage

    if (backgroundImage && backgroundImage !== 'none') {
      const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/)
      return urlMatch ? urlMatch[1] : backgroundImage
    }

    return ''
  }

  validateImageUrl(url: string): boolean {
    if (!url || url.trim() === '') return false

    try {
      new URL(url)
      return true
    } catch {
      return url.startsWith('data:image/') || url.startsWith('/')
    }
  }

  private createDialog(element: Element, currentSrc: string): void {
    this.remove()

    const isImgTag = element.tagName.toLowerCase() === 'img'
    const elementType = isImgTag ? 'image' : 'background image'

    const dialogHost = document.createElement('div')
    dialogHost.id = 'absmartly-image-dialog-host'
    dialogHost.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
    `

    const shadow = dialogHost.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .dialog-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      }

      .dialog-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        padding: 24px;
        min-width: 400px;
        max-width: 600px;
        pointer-events: auto;
        z-index: 2;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .dialog-header {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }

      .dialog-description {
        font-size: 14px;
        color: #666;
        margin-bottom: 20px;
      }

      .dialog-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin-bottom: 8px;
      }

      .dialog-input {
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 8px;
        font-family: monospace;
      }

      .dialog-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .dialog-hint {
        font-size: 12px;
        color: #999;
        margin-bottom: 20px;
      }

      .dialog-preview {
        margin-bottom: 20px;
        border: 1px solid #e5e5e5;
        border-radius: 4px;
        overflow: hidden;
        background: #f9f9f9;
      }

      .dialog-preview img {
        max-width: 100%;
        max-height: 200px;
        display: block;
        margin: 0 auto;
      }

      .dialog-preview-empty {
        padding: 40px;
        text-align: center;
        color: #999;
        font-size: 14px;
      }

      .dialog-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .dialog-button {
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 500;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .dialog-button-cancel {
        background: #f3f4f6;
        color: #374151;
      }

      .dialog-button-cancel:hover {
        background: #e5e7eb;
      }

      .dialog-button-apply {
        background: #3b82f6;
        color: white;
      }

      .dialog-button-apply:hover {
        background: #2563eb;
      }

      .dialog-button-apply:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      .dialog-error {
        color: #dc2626;
        font-size: 12px;
        margin-top: 4px;
        margin-bottom: 12px;
      }
    `
    shadow.appendChild(style)

    const backdrop = document.createElement('div')
    backdrop.className = 'dialog-backdrop'

    const container = document.createElement('div')
    container.className = 'dialog-container'

    const header = document.createElement('div')
    header.className = 'dialog-header'
    header.textContent = `Change ${elementType} source`

    const description = document.createElement('div')
    description.className = 'dialog-description'
    description.textContent = `Enter a new URL for the ${elementType}`

    const label = document.createElement('label')
    label.className = 'dialog-label'
    label.textContent = 'Image URL'

    const input = document.createElement('input')
    input.className = 'dialog-input'
    input.type = 'text'
    input.placeholder = 'https://example.com/image.jpg'
    input.value = currentSrc

    const hint = document.createElement('div')
    hint.className = 'dialog-hint'
    hint.textContent = 'Enter a full URL starting with http:// or https://'

    const errorDiv = document.createElement('div')
    errorDiv.className = 'dialog-error'
    errorDiv.style.display = 'none'

    const preview = document.createElement('div')
    preview.className = 'dialog-preview'
    if (currentSrc && this.validateImageUrl(currentSrc)) {
      const img = document.createElement('img')
      img.src = currentSrc
      img.alt = 'Current image'
      img.onerror = () => {
        preview.innerHTML = '<div class="dialog-preview-empty">Image preview not available</div>'
      }
      preview.appendChild(img)
    } else {
      preview.innerHTML = '<div class="dialog-preview-empty">No image preview</div>'
    }

    const buttons = document.createElement('div')
    buttons.className = 'dialog-buttons'

    const cancelButton = document.createElement('button')
    cancelButton.className = 'dialog-button dialog-button-cancel'
    cancelButton.textContent = 'Cancel'

    const applyButton = document.createElement('button')
    applyButton.className = 'dialog-button dialog-button-apply'
    applyButton.textContent = 'Apply'

    const handleApply = () => {
      const url = input.value.trim()

      if (!this.validateImageUrl(url)) {
        errorDiv.textContent = 'Please enter a valid URL'
        errorDiv.style.display = 'block'
        return
      }

      if (this.resolveCallback) {
        this.resolveCallback(url)
      }
      this.remove()
    }

    const handleCancel = () => {
      if (this.resolveCallback) {
        this.resolveCallback(null)
      }
      this.remove()
    }

    cancelButton.addEventListener('click', handleCancel)
    applyButton.addEventListener('click', handleApply)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        handleCancel()
      }
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApply()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    })

    input.addEventListener('input', () => {
      errorDiv.style.display = 'none'
    })

    buttons.appendChild(cancelButton)
    buttons.appendChild(applyButton)

    container.appendChild(header)
    container.appendChild(description)
    container.appendChild(label)
    container.appendChild(input)
    container.appendChild(errorDiv)
    container.appendChild(hint)
    container.appendChild(preview)
    container.appendChild(buttons)

    backdrop.appendChild(container)
    shadow.appendChild(backdrop)

    document.body.appendChild(dialogHost)
    this.dialogHost = dialogHost

    setTimeout(() => {
      input.focus()
      input.select()
    }, 100)
  }

  remove(): void {
    if (this.dialogHost) {
      this.dialogHost.remove()
      this.dialogHost = null
    }
    this.resolveCallback = null
  }
}

export default ImageSourceDialog
