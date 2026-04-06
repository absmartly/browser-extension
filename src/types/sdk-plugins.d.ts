declare module "@absmartly/sdk-plugins/core/dom-manipulator" {
  export class DOMManipulatorLite {
    constructor(debug?: boolean, plugin?: Record<string, any>)
    applyDOMChanges(
      changes: any[],
      experimentName: string,
      options?: { markElements?: boolean }
    ): { applied: number; failed: number; errors: string[] }
    applyChange(change: any, experimentName: string): boolean
    undoDOMChanges(experimentName: string): void
    undoAllDOMChanges(): void
  }
}

declare module "@absmartly/sdk-plugins/core/style-sheet-manager" {
  export class StyleSheetManager {
    constructor(id?: string, debug?: boolean)
    addStyles(css: string, experimentName: string): void
    removeStyles(experimentName: string): void
    removeAllStyles(): void
    destroy(): void
  }
}
