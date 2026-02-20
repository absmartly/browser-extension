import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DOMChangeEditor, createEmptyChange, handleDOMChangeTypeChange } from '../DOMChangeEditor'
import type { DOMChangeType } from '~src/types/dom-changes'

jest.mock('~src/lib/messaging', () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined)
}))

global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
} as any

describe('DOMChangeEditor', () => {
  const mockOnSave = jest.fn()
  const mockOnCancel = jest.fn()
  const mockOnStartPicker = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render editor in add mode', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText('Add DOM Change')).toBeInTheDocument()
    })

    it('should render editor in edit mode', () => {
      const editingChange = {
        ...createEmptyChange(),
        index: 0
      }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText('Edit DOM Change')).toBeInTheDocument()
    })

    it('should render selector input', () => {
      const editingChange = createEmptyChange()

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#dom-change-selector-0-new')).toBeInTheDocument()
    })

    it('should render change type selector', () => {
      const editingChange = createEmptyChange()

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#dom-change-type-0-new')).toBeInTheDocument()
    })

    it('should render save and cancel buttons', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const saveButton = document.querySelector('#dom-change-save-0-new')
      const cancelButton = document.querySelector('#dom-change-cancel-0-new')

      expect(saveButton).toBeInTheDocument()
      expect(cancelButton).toBeInTheDocument()
    })
  })

  describe('Selector Editing', () => {
    it('should update selector value on input change', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const selectorInput = document.querySelector('#dom-change-selector-0-new') as HTMLInputElement
      fireEvent.change(selectorInput, { target: { value: '.test-button' } })

      expect(selectorInput.value).toBe('.test-button')
    })

    it('should trigger picker on picker button click', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const pickerButton = screen.getByText('🎯')
      fireEvent.click(pickerButton)

      expect(mockOnStartPicker).toHaveBeenCalledWith('selector')
    })

    it('should show picking indicator when picker is active', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const pickerButton = screen.getByText('🎯')
      fireEvent.click(pickerButton)

      expect(screen.getByText(/Click an element on the page/i)).toBeInTheDocument()
    })
  })

  describe('Change Type Selection', () => {
    it('should render all change type options', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const typeSelect = document.querySelector('#dom-change-type-0-new') as HTMLSelectElement
      const options = Array.from(typeSelect.options).map(opt => opt.value)

      expect(options).toContain('text')
      expect(options).toContain('style')
      expect(options).toContain('styleRules')
      expect(options).toContain('class')
      expect(options).toContain('attribute')
      expect(options).toContain('html')
      expect(options).toContain('javascript')
      expect(options).toContain('move')
    })

    it('should change editor fields based on type selection', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const typeSelect = document.querySelector('#dom-change-type-0-new') as HTMLSelectElement
      fireEvent.change(typeSelect, { target: { value: 'text' } })

      expect(document.querySelector('#dom-change-text-0-new')).toBeInTheDocument()
    })
  })

  describe('Text Change Type', () => {
    it('should render text input for text type', () => {
      const editingChange = { ...createEmptyChange(), type: 'text' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#dom-change-text-0-new')).toBeInTheDocument()
    })

    it('should update text value', () => {
      const editingChange = { ...createEmptyChange(), type: 'text' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const textInput = container.querySelector('#dom-change-text-0-new') as HTMLInputElement
      fireEvent.change(textInput, { target: { value: 'New text' } })

      expect(textInput.value).toBe('New text')
    })
  })

  describe('Style Change Type', () => {
    it('should render style properties editor for style type', () => {
      const editingChange = { ...createEmptyChange(), type: 'style' as DOMChangeType }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText(/Style Properties/i)).toBeInTheDocument()
    })

    it('should show merge mode checkbox', () => {
      const editingChange = { ...createEmptyChange(), type: 'style' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#merge-mode')).toBeInTheDocument()
    })
  })

  describe('StyleRules Change Type', () => {
    it('should render style rules editor for styleRules type', () => {
      const editingChange = { ...createEmptyChange(), type: 'styleRules' as DOMChangeType }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText(/Style Rules \(with pseudo-classes\)/i)).toBeInTheDocument()
    })
  })

  describe('Class Change Type', () => {
    it('should render class editor for class type', () => {
      const editingChange = { ...createEmptyChange(), type: 'class' as DOMChangeType }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText(/CSS Classes/i)).toBeInTheDocument()
      expect(screen.getByText(/Classes to Add/i)).toBeInTheDocument()
      expect(screen.getByText(/Classes to Remove/i)).toBeInTheDocument()
    })
  })

  describe('Attribute Change Type', () => {
    it('should render attribute editor for attribute type', () => {
      const editingChange = { ...createEmptyChange(), type: 'attribute' as DOMChangeType }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText('Attributes')).toBeInTheDocument()
      expect(screen.getByText('Merge with existing attributes')).toBeInTheDocument()
    })
  })

  describe('HTML Change Type', () => {
    it('should render HTML textarea for html type', () => {
      const editingChange = { ...createEmptyChange(), type: 'html' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#dom-change-html-0-new')).toBeInTheDocument()
    })

    it('should update HTML value', () => {
      const editingChange = { ...createEmptyChange(), type: 'html' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const htmlTextarea = container.querySelector('#dom-change-html-0-new') as HTMLTextAreaElement
      fireEvent.change(htmlTextarea, { target: { value: '<div>Test</div>' } })

      expect(htmlTextarea.value).toBe('<div>Test</div>')
    })
  })

  describe('JavaScript Change Type', () => {
    it('should render JavaScript editor for javascript type', () => {
      const editingChange = { ...createEmptyChange(), type: 'javascript' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#dom-change-js-0-new')).toBeInTheDocument()
    })

    it('should show fullscreen editor button', () => {
      const editingChange = { ...createEmptyChange(), type: 'javascript' as DOMChangeType }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(screen.getByText(/Fullscreen/i)).toBeInTheDocument()
    })

    it('should update JavaScript value', () => {
      const editingChange = { ...createEmptyChange(), type: 'javascript' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const jsTextarea = container.querySelector('#dom-change-js-0-new') as HTMLTextAreaElement
      fireEvent.change(jsTextarea, { target: { value: 'console.log("test")' } })

      expect(jsTextarea.value).toBe('console.log("test")')
    })
  })

  describe('Move Change Type', () => {
    it('should render target selector and position for move type', () => {
      const editingChange = { ...createEmptyChange(), type: 'move' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#dom-change-target-0-new')).toBeInTheDocument()
      expect(container.querySelector('#dom-change-position-0-new')).toBeInTheDocument()
    })

    it('should render position options', () => {
      const editingChange = { ...createEmptyChange(), type: 'move' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const positionSelect = container.querySelector('#dom-change-position-0-new') as HTMLSelectElement
      const options = Array.from(positionSelect.options).map(opt => opt.value)

      expect(options).toContain('before')
      expect(options).toContain('after')
      expect(options).toContain('firstChild')
      expect(options).toContain('lastChild')
    })

    it('should trigger picker for target selector', () => {
      const editingChange = { ...createEmptyChange(), type: 'move' as DOMChangeType }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const pickerButtons = screen.getAllByText('🎯')
      fireEvent.click(pickerButtons[1])

      expect(mockOnStartPicker).toHaveBeenCalledWith('targetSelector')
    })
  })

  describe('Save and Cancel', () => {
    it('should call onSave with change data when save is clicked', () => {
      const editingChange = {
        ...createEmptyChange(),
        selector: '.test-button',
        type: 'text' as DOMChangeType,
        textValue: 'New text'
      }

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const saveButton = document.querySelector('#dom-change-save-0-new') as HTMLElement
      fireEvent.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '.test-button',
          type: 'text',
          textValue: 'New text'
        })
      )
    })

    it('should call onCancel when cancel is clicked', () => {
      const editingChange = createEmptyChange()

      render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      const cancelButton = document.querySelector('#dom-change-cancel-0-new') as HTMLElement
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('Options Section', () => {
    it('should not render options for styleRules type', () => {
      const editingChange = { ...createEmptyChange(), type: 'styleRules' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#options-new-wait')).not.toBeInTheDocument()
    })

    it('should render options for other types', () => {
      const editingChange = { ...createEmptyChange(), type: 'style' as DOMChangeType }

      const { container } = render(
        <DOMChangeEditor
          editingChange={editingChange}
          variantIndex={0}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onStartPicker={mockOnStartPicker}
        />
      )

      expect(container.querySelector('#options-new-wait')).toBeInTheDocument()
    })
  })
})

describe('createEmptyChange', () => {
  it('should create empty change with default values', () => {
    const change = createEmptyChange()

    expect(change.index).toBe(null)
    expect(change.selector).toBe('')
    expect(change.type).toBe('style')
    expect(change.styleProperties).toEqual([{ key: '', value: '' }])
  })
})

describe('handleDOMChangeTypeChange', () => {
  it('should preserve styles when switching from style to styleRules', () => {
    const change = {
      ...createEmptyChange(),
      type: 'style' as DOMChangeType,
      styleProperties: [
        { key: 'color', value: 'red' },
        { key: 'font-size', value: '16px' }
      ]
    }

    const result = handleDOMChangeTypeChange(change, 'styleRules')

    expect(result.type).toBe('styleRules')
    expect(result.styleRulesStates?.normal).toEqual({
      color: 'red',
      'font-size': '16px'
    })
  })

  it('should preserve styles when switching from styleRules to style', () => {
    const change = {
      ...createEmptyChange(),
      type: 'styleRules' as DOMChangeType,
      styleRulesStates: {
        normal: { color: 'blue', padding: '10px' },
        hover: { color: 'red' },
        active: {},
        focus: {}
      }
    }

    const result = handleDOMChangeTypeChange(change, 'style')

    expect(result.type).toBe('style')
    expect(result.styleProperties).toEqual([
      { key: 'color', value: 'blue' },
      { key: 'padding', value: '10px' }
    ])
  })

  it('should handle empty styles when switching types', () => {
    const change = {
      ...createEmptyChange(),
      type: 'styleRules' as DOMChangeType,
      styleRulesStates: {
        normal: {},
        hover: {},
        active: {},
        focus: {}
      }
    }

    const result = handleDOMChangeTypeChange(change, 'style')

    expect(result.type).toBe('style')
    expect(result.styleProperties).toEqual([{ key: '', value: '' }])
  })
})
