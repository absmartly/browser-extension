/**
 * DOM change instruction interface
 */
export interface DOMChangeInstruction {
  selector: string;
  action: 'text' | 'html' | 'style' | 'attribute' | 'class' | 'javascript';
  value?: string;
  property?: string;  // For style changes
  attribute?: string;
  css?: Record<string, string>;
  className?: string;
  script?: string;
  // Additional options for advanced features
  waitForElement?: boolean;
  applyOnce?: boolean;
  priority?: number;
}