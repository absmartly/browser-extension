import type {
  DOMChange,
  DOMChangeText,
  DOMChangeStyle,
  DOMChangeStyleRules,
  DOMChangeClass,
  DOMChangeAttribute,
  DOMChangeHTML,
  DOMChangeJavaScript,
  DOMChangeMove,
  DOMChangeRemove,
  DOMChangeInsert,
  DOMChangeCreate
} from './dom-changes'

// Type guard functions for DOMChange union type
export function isTextChange(change: DOMChange): change is DOMChangeText {
  return change.type === 'text'
}

export function isStyleChange(change: DOMChange): change is DOMChangeStyle {
  return change.type === 'style'
}

export function isStyleRulesChange(change: DOMChange): change is DOMChangeStyleRules {
  return change.type === 'styleRules'
}

export function isClassChange(change: DOMChange): change is DOMChangeClass {
  return change.type === 'class'
}

export function isAttributeChange(change: DOMChange): change is DOMChangeAttribute {
  return change.type === 'attribute'
}

export function isHTMLChange(change: DOMChange): change is DOMChangeHTML {
  return change.type === 'html'
}

export function isJavaScriptChange(change: DOMChange): change is DOMChangeJavaScript {
  return change.type === 'javascript'
}

export function isMoveChange(change: DOMChange): change is DOMChangeMove {
  return change.type === 'move'
}

export function isRemoveChange(change: DOMChange): change is DOMChangeRemove {
  return change.type === 'remove'
}

export function isInsertChange(change: DOMChange): change is DOMChangeInsert {
  return change.type === 'insert'
}

export function isCreateChange(change: DOMChange): change is DOMChangeCreate {
  return change.type === 'create'
}

// Helper to check if a change has a string value property
export function hasStringValue(change: DOMChange): change is DOMChangeText | DOMChangeHTML | DOMChangeJavaScript {
  return isTextChange(change) || isHTMLChange(change) || isJavaScriptChange(change)
}

// Helper to check if a change has a record value property
export function hasRecordValue(change: DOMChange): change is DOMChangeStyle | DOMChangeAttribute {
  return isStyleChange(change) || isAttributeChange(change)
}
