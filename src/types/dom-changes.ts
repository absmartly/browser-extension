export type DOMChangeType = 'text' | 'style' | 'class' | 'attribute' | 'html' | 'javascript' | 'move' | 'remove' | 'insert';

export interface DOMChangeStyle {
  selector: string;
  type: 'style';
  value: Record<string, string>;
  enabled?: boolean;
  mode?: 'replace' | 'merge';
}

export interface DOMChangeText {
  selector: string;
  type: 'text';
  value: string;
  enabled?: boolean;
}

export interface DOMChangeClass {
  selector: string;
  type: 'class';
  add?: string[];
  remove?: string[];
  enabled?: boolean;
  mode?: 'replace' | 'merge';
}

export interface DOMChangeAttribute {
  selector: string;
  type: 'attribute';
  value: Record<string, string>;
  enabled?: boolean;
  mode?: 'replace' | 'merge';
}

export interface DOMChangeHTML {
  selector: string;
  type: 'html';
  value: string;
  enabled?: boolean;
}

export interface DOMChangeJavaScript {
  selector: string;
  type: 'javascript';
  value: string;
  enabled?: boolean;
}

export interface DOMChangeMove {
  selector: string;
  type: 'move';
  targetSelector: string;
  position: 'before' | 'after' | 'firstChild' | 'lastChild';
  enabled?: boolean;
}

export interface DOMChangeRemove {
  selector: string;
  type: 'remove';
  enabled?: boolean;
}

export interface DOMChangeInsert {
  selector: string; // Reference element selector
  type: 'insert';
  html: string; // HTML content to insert
  position: 'before' | 'after' | 'firstChild' | 'lastChild';
  enabled?: boolean;
}

export type DOMChange = 
  | DOMChangeStyle 
  | DOMChangeText 
  | DOMChangeClass 
  | DOMChangeAttribute 
  | DOMChangeHTML 
  | DOMChangeJavaScript
  | DOMChangeMove
  | DOMChangeRemove
  | DOMChangeInsert;

export interface DOMChangeTemplate {
  id: string;
  name: string;
  type: DOMChangeType;
  value?: Record<string, string> | string; // For style/attribute (Record) or text/html/javascript (string)
  add?: string[]; // For class type
  remove?: string[]; // For class type
}

export const DOM_CHANGE_TEMPLATES: DOMChangeTemplate[] = [
  {
    id: 'rounded-cta',
    name: 'Rounded Call-to-Action Button',
    type: 'style',
    value: {
      'border-radius': '8px',
      'padding': '12px 24px',
      'font-weight': '600',
      'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
      'transition': 'all 0.2s ease'
    }
  },
  {
    id: 'hide-element',
    name: 'Hide Element',
    type: 'style',
    value: {
      'display': 'none'
    }
  },
  {
    id: 'highlight-urgent',
    name: 'Urgent Highlight',
    type: 'style',
    value: {
      'background-color': '#ff4444',
      'color': 'white',
      'font-weight': 'bold',
      'padding': '4px 8px',
      'border-radius': '4px'
    }
  },
  {
    id: 'text-emphasis',
    name: 'Emphasize Text',
    type: 'style',
    value: {
      'background-color': '#fff3cd',
      'padding': '2px 6px',
      'border': '1px solid #ffeaa7',
      'border-radius': '3px'
    }
  },
  {
    id: 'success-style',
    name: 'Success Style',
    type: 'style',
    value: {
      'background-color': '#10b981',
      'color': 'white',
      'border': '1px solid #059669',
      'padding': '8px 16px',
      'border-radius': '4px'
    }
  },
  {
    id: 'disabled-state',
    name: 'Disabled State',
    type: 'style',
    value: {
      'opacity': '0.5',
      'cursor': 'not-allowed',
      'pointer-events': 'none'
    }
  }
];