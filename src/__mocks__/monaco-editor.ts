/**
 * Mock for monaco-editor module used in Jest tests
 */

export namespace editor {
  export interface IStandaloneCodeEditor {
    getValue(): string
    setValue(value: string): void
    dispose(): void
    focus(): void
    getModel(): any
    getSelection(): any
    executeEdits(source: string, edits: any[]): void
  }

  export function create(
    domElement: HTMLElement,
    options?: any
  ): IStandaloneCodeEditor {
    return {
      getValue: jest.fn(() => ''),
      setValue: jest.fn(),
      dispose: jest.fn(),
      focus: jest.fn(),
      getModel: jest.fn(() => ({
        getValueInRange: jest.fn(() => '')
      })),
      getSelection: jest.fn(() => null),
      executeEdits: jest.fn()
    }
  }

  export function getEditors(): IStandaloneCodeEditor[] {
    return []
  }
}

export namespace languages {
  export function registerCompletionItemProvider(
    languageId: string,
    provider: any
  ): void {
    // Mock implementation
  }
}

export const Range = class {
  constructor(
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ) {}
}

export default {
  editor,
  languages,
  Range
}