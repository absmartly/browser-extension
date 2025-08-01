/**
 * DOM change instruction interface used by the content script
 */
export interface DOMChangeInstruction {
  selector: string;
  action: 'text' | 'html' | 'style' | 'attribute' | 'class' | 'javascript';
  value?: string;
  attribute?: string;
  css?: Record<string, string>;
  className?: string;
  script?: string;
}