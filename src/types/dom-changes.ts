export type DOMChangeType = 'text' | 'style' | 'styleRules' | 'class' | 'attribute' | 'html' | 'javascript' | 'move' | 'remove' | 'insert' | 'create';

// URL filtering types
export interface URLFilterConfig {
  include?: string[];
  exclude?: string[];
  mode?: 'simple' | 'regex';
  matchType?: 'full-url' | 'path' | 'domain' | 'query' | 'hash';
}

export type URLFilter = string | string[] | URLFilterConfig;

export interface DOMChangeStyle {
  selector: string;
  type: 'style';
  value: Record<string, string>;
  important?: boolean;
  enabled?: boolean;
  mode?: 'replace' | 'merge';
  waitForElement?: boolean;
  persistStyle?: boolean;
  observerRoot?: string;
}

export interface DOMChangeStyleRules {
  selector: string;
  type: 'styleRules';
  states: {
    normal?: Record<string, string>;
    hover?: Record<string, string>;
    active?: Record<string, string>;
    focus?: Record<string, string>;
  };
  important?: boolean;
  enabled?: boolean;
  waitForElement?: boolean;
  persistStyle?: boolean;
  observerRoot?: string;
}

export interface DOMChangeText {
  selector: string;
  type: 'text';
  value: string;
  originalText?: string; // Store original text for restoration when preview is removed
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeClass {
  selector: string;
  type: 'class';
  add?: string[];
  remove?: string[];
  enabled?: boolean;
  mode?: 'replace' | 'merge';
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeAttribute {
  selector: string;
  type: 'attribute';
  value: Record<string, string>;
  enabled?: boolean;
  mode?: 'replace' | 'merge';
  waitForElement?: boolean;
  persistAttribute?: boolean;
  observerRoot?: string;
}

export interface DOMChangeHTML {
  selector: string;
  type: 'html';
  value: string;
  originalHtml?: string; // Store original HTML for restoration when preview is removed
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeJavaScript {
  selector: string;
  type: 'javascript';
  value: string;
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeMove {
  selector: string;
  type: 'move';
  targetSelector: string;
  position: 'before' | 'after' | 'firstChild' | 'lastChild';
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeRemove {
  selector: string;
  type: 'remove';
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeInsert {
  selector: string; // Reference element selector
  type: 'insert';
  html: string; // HTML content to insert
  position: 'before' | 'after' | 'firstChild' | 'lastChild';
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export interface DOMChangeCreate {
  selector: string; // Unique ID for created element
  type: 'create';
  element: string; // HTML content to create
  targetSelector: string;
  position: 'before' | 'after' | 'firstChild' | 'lastChild';
  enabled?: boolean;
  waitForElement?: boolean;
  observerRoot?: string;
}

export type DOMChange =
  | DOMChangeStyle
  | DOMChangeStyleRules
  | DOMChangeText
  | DOMChangeClass
  | DOMChangeAttribute
  | DOMChangeHTML
  | DOMChangeJavaScript
  | DOMChangeMove
  | DOMChangeRemove
  | DOMChangeInsert
  | DOMChangeCreate;

// New format for __dom_changes with URL filtering and global defaults
export interface DOMChangesConfig {
  changes: DOMChange[];
  urlFilter?: URLFilter;

  // Global defaults that can be overridden per-change
  waitForElement?: boolean;
  persistStyle?: boolean;
  important?: boolean;
  observerRoot?: string;
}

// Union type supporting both legacy array format and new config format
export type DOMChangesData = DOMChange[] | DOMChangesConfig;

export interface DOMChangeTemplate {
  id: string;
  name: string;
  type: DOMChangeType;
  value?: Record<string, string> | string; // For style/attribute (Record) or text/html/javascript (string)
  add?: string[]; // For class type
  remove?: string[]; // For class type
}

export interface StyleRulesTemplate {
  id: string;
  name: string;
  description: string;
  states: {
    normal?: Record<string, string>;
    hover?: Record<string, string>;
    active?: Record<string, string>;
    focus?: Record<string, string>;
  };
  important?: boolean;
}

export const STYLE_RULES_TEMPLATES: StyleRulesTemplate[] = [
  {
    id: 'primary-button',
    name: 'Primary Button',
    description: 'Blue button with hover effects',
    states: {
      normal: {
        backgroundColor: '#007bff',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      },
      hover: {
        backgroundColor: '#0056b3',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
      },
      active: {
        backgroundColor: '#004085',
        transform: 'translateY(0)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }
    }
  },
  {
    id: 'danger-button',
    name: 'Danger Button',
    description: 'Red button for destructive actions',
    states: {
      normal: {
        backgroundColor: '#dc3545',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      },
      hover: {
        backgroundColor: '#c82333',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(220,53,69,0.3)'
      },
      active: {
        backgroundColor: '#bd2130',
        transform: 'translateY(0)'
      }
    }
  },
  {
    id: 'ghost-button',
    name: 'Ghost Button',
    description: 'Transparent button with border',
    states: {
      normal: {
        backgroundColor: 'transparent',
        color: '#007bff',
        padding: '10px 20px',
        borderRadius: '4px',
        border: '2px solid #007bff',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      },
      hover: {
        backgroundColor: '#007bff',
        color: 'white',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0,123,255,0.3)'
      },
      active: {
        transform: 'translateY(0)'
      }
    }
  },
  {
    id: 'card-hover',
    name: 'Card Hover Effect',
    description: 'Elevate card on hover',
    states: {
      normal: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      },
      hover: {
        transform: 'translateY(-4px)',
        boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
      }
    }
  },
  {
    id: 'link-underline',
    name: 'Link Underline',
    description: 'Animated underline on hover',
    states: {
      normal: {
        color: '#007bff',
        textDecoration: 'none',
        position: 'relative',
        transition: 'color 0.2s ease'
      },
      hover: {
        color: '#0056b3',
        textDecoration: 'underline'
      }
    }
  }
];

// AI DOM Generation Types
export type DOMChangeAction =
  | 'append'
  | 'replace_all'
  | 'replace_specific'
  | 'remove_specific'
  | 'none';

export interface AIDOMGenerationResult {
  domChanges: DOMChange[];
  response: string;
  action: DOMChangeAction;
  targetSelectors?: string[];
  session?: import('./absmartly').ConversationSession;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  domChangesSnapshot?: DOMChange[];
  timestamp: number;
  id: string;
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