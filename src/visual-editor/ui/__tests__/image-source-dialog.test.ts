import { ImageSourceDialog } from '../image-source-dialog'

describe('ImageSourceDialog', () => {
  let dialog: ImageSourceDialog

  beforeEach(() => {
    dialog = new ImageSourceDialog()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    dialog.remove()
  })

  describe('getCurrentImageSource', () => {
    it('should return src for img elements', () => {
      const img = document.createElement('img')
      img.src = 'https://example.com/image.jpg'
      document.body.appendChild(img)

      const src = dialog.getCurrentImageSource(img)
      expect(src).toBe('https://example.com/image.jpg')
    })

    it('should extract URL from background-image', () => {
      const div = document.createElement('div')
      div.style.backgroundImage = "url('https://example.com/bg.jpg')"
      document.body.appendChild(div)

      const src = dialog.getCurrentImageSource(div)
      expect(src).toBe('https://example.com/bg.jpg')
    })

    it('should extract URL from background-image with double quotes', () => {
      const div = document.createElement('div')
      div.style.backgroundImage = 'url("https://example.com/bg.jpg")'
      document.body.appendChild(div)

      const src = dialog.getCurrentImageSource(div)
      expect(src).toBe('https://example.com/bg.jpg')
    })

    it('should extract URL from background-image without quotes', () => {
      const div = document.createElement('div')
      div.style.backgroundImage = 'url(https://example.com/bg.jpg)'
      document.body.appendChild(div)

      const src = dialog.getCurrentImageSource(div)
      expect(src).toBe('https://example.com/bg.jpg')
    })

    it('should return empty string for elements without images', () => {
      const div = document.createElement('div')
      document.body.appendChild(div)

      const src = dialog.getCurrentImageSource(div)
      expect(src).toBe('')
    })

    it('should return background-image string if URL cannot be extracted', () => {
      const div = document.createElement('div')
      div.style.backgroundImage = 'linear-gradient(red, blue)'
      document.body.appendChild(div)

      const src = dialog.getCurrentImageSource(div)
      expect(src).toBe('linear-gradient(red, blue)')
    })
  })

  describe('validateImageUrl', () => {
    it('should validate https URLs', () => {
      expect(dialog.validateImageUrl('https://example.com/image.jpg')).toBe(true)
    })

    it('should validate http URLs', () => {
      expect(dialog.validateImageUrl('http://example.com/image.jpg')).toBe(true)
    })

    it('should validate data URLs', () => {
      expect(dialog.validateImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    })

    it('should validate absolute paths', () => {
      expect(dialog.validateImageUrl('/images/photo.jpg')).toBe(true)
    })

    it('should reject empty strings', () => {
      expect(dialog.validateImageUrl('')).toBe(false)
    })

    it('should reject whitespace-only strings', () => {
      expect(dialog.validateImageUrl('   ')).toBe(false)
    })

    it('should reject invalid URLs', () => {
      expect(dialog.validateImageUrl('not a url')).toBe(false)
    })

    it('should reject relative paths', () => {
      expect(dialog.validateImageUrl('images/photo.jpg')).toBe(false)
    })
  })

  describe('show', () => {
    it('should create dialog in DOM', async () => {
      const img = document.createElement('img')
      img.src = 'https://example.com/test.jpg'

      const promise = dialog.show(img, 'https://example.com/test.jpg')

      expect(document.getElementById('absmartly-image-dialog-host')).toBeTruthy()

      // Cancel the dialog
      const backdrop = document.querySelector('.dialog-backdrop') as HTMLElement
      backdrop?.click()

      await promise
    })

    it('should pre-fill input with current source', async () => {
      const img = document.createElement('img')
      const currentSrc = 'https://example.com/current.jpg'

      const promise = dialog.show(img, currentSrc)

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const input = shadowRoot.querySelector('input') as HTMLInputElement

      expect(input.value).toBe(currentSrc)

      // Cancel
      const backdrop = shadowRoot.querySelector('.dialog-backdrop') as HTMLElement
      backdrop?.click()

      await promise
    })

    it('should return null when cancelled via backdrop', async () => {
      const img = document.createElement('img')

      const promise = dialog.show(img, 'https://example.com/test.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const backdrop = shadowRoot.querySelector('.dialog-backdrop') as HTMLElement
      backdrop?.click()

      const result = await promise
      expect(result).toBeNull()
    })

    it('should return null when cancelled via button', async () => {
      const img = document.createElement('img')

      const promise = dialog.show(img, 'https://example.com/test.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const cancelButton = shadowRoot.querySelector('.dialog-button-cancel') as HTMLElement
      cancelButton?.click()

      const result = await promise
      expect(result).toBeNull()
    })

    it('should return new URL when applied with valid URL', async () => {
      const img = document.createElement('img')
      const newUrl = 'https://example.com/new.jpg'

      const promise = dialog.show(img, 'https://example.com/old.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const input = shadowRoot.querySelector('input') as HTMLInputElement
      input.value = newUrl

      const applyButton = shadowRoot.querySelector('.dialog-button-apply') as HTMLElement
      applyButton?.click()

      const result = await promise
      expect(result).toBe(newUrl)
    })

    it('should show error for invalid URL', async () => {
      const img = document.createElement('img')

      const promise = dialog.show(img, 'https://example.com/old.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const input = shadowRoot.querySelector('input') as HTMLInputElement
      const errorDiv = shadowRoot.querySelector('.dialog-error') as HTMLElement

      input.value = 'invalid url'

      const applyButton = shadowRoot.querySelector('.dialog-button-apply') as HTMLElement
      applyButton?.click()

      // Error should be visible
      expect(errorDiv.style.display).not.toBe('none')
      expect(errorDiv.textContent).toContain('valid URL')

      // Dialog should still be open
      expect(document.getElementById('absmartly-image-dialog-host')).toBeTruthy()

      // Cancel to cleanup
      const cancelButton = shadowRoot.querySelector('.dialog-button-cancel') as HTMLElement
      cancelButton?.click()

      await promise
    })

    it('should handle Enter key to apply', async () => {
      const img = document.createElement('img')
      const newUrl = 'https://example.com/new.jpg'

      const promise = dialog.show(img, 'https://example.com/old.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const input = shadowRoot.querySelector('input') as HTMLInputElement

      input.value = newUrl

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      input.dispatchEvent(enterEvent)

      const result = await promise
      expect(result).toBe(newUrl)
    })

    it('should handle Escape key to cancel', async () => {
      const img = document.createElement('img')

      const promise = dialog.show(img, 'https://example.com/old.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const input = shadowRoot.querySelector('input') as HTMLInputElement

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      input.dispatchEvent(escapeEvent)

      const result = await promise
      expect(result).toBeNull()
    })

    it('should hide error when user types', async () => {
      const img = document.createElement('img')

      const promise = dialog.show(img, 'https://example.com/old.jpg')

      const host = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (host as any).shadowRoot
      const input = shadowRoot.querySelector('input') as HTMLInputElement
      const errorDiv = shadowRoot.querySelector('.dialog-error') as HTMLElement

      // Try invalid URL
      input.value = 'invalid'
      const applyButton = shadowRoot.querySelector('.dialog-button-apply') as HTMLElement
      applyButton?.click()

      expect(errorDiv.style.display).not.toBe('none')

      // Type to clear error
      input.value = 'https://example.com/valid.jpg'
      input.dispatchEvent(new Event('input'))

      expect(errorDiv.style.display).toBe('none')

      // Cancel to cleanup
      const cancelButton = shadowRoot.querySelector('.dialog-button-cancel') as HTMLElement
      cancelButton?.click()

      await promise
    })
  })

  describe('remove', () => {
    it('should remove dialog from DOM', async () => {
      const img = document.createElement('img')

      const promise = dialog.show(img, 'https://example.com/test.jpg')

      expect(document.getElementById('absmartly-image-dialog-host')).toBeTruthy()

      dialog.remove()

      expect(document.getElementById('absmartly-image-dialog-host')).toBeNull()

      // Promise should resolve with null
      const result = await promise
      expect(result).toBeNull()
    })

    it('should be safe to call multiple times', () => {
      dialog.remove()
      dialog.remove()
      dialog.remove()

      expect(document.getElementById('absmartly-image-dialog-host')).toBeNull()
    })
  })
})
