import React from 'react';
import { Input } from './ui/Input';

export interface DOMChangeOptionsProps {
  important?: boolean;
  waitForElement?: boolean;
  persistStyle?: boolean;
  observerRoot?: string;
  onImportantChange?: (value: boolean) => void;
  onWaitForElementChange?: (value: boolean) => void;
  onPersistStyleChange?: (value: boolean) => void;
  onObserverRootChange?: (value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
  showImportant?: boolean;
  showWaitForElement?: boolean;
  showPersistStyle?: boolean;
  showObserverRoot?: boolean;
}

export const DOMChangeOptions: React.FC<DOMChangeOptionsProps> = ({
  important = false,
  waitForElement = false,
  persistStyle = false,
  observerRoot = '',
  onImportantChange,
  onWaitForElementChange,
  onPersistStyleChange,
  onObserverRootChange,
  disabled = false,
  idPrefix = 'dom-options',
  showImportant = true,
  showWaitForElement = true,
  showPersistStyle = true,
  showObserverRoot = true,
}) => {
  return (
    <div className="space-y-2">
      {showImportant && onImportantChange && (
        <div className="flex items-start">
          <input
            type="checkbox"
            id={`${idPrefix}-important`}
            checked={important}
            onChange={(e) => onImportantChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5 mr-2"
          />
          <label htmlFor={`${idPrefix}-important`} className="text-xs">
            <span className="font-medium text-gray-700">Use !important flag</span>
            <p className="text-gray-500">Ensures styles override existing CSS</p>
          </label>
        </div>
      )}

      {showWaitForElement && onWaitForElementChange && (
        <div className="flex items-start">
          <input
            type="checkbox"
            id={`${idPrefix}-wait`}
            checked={waitForElement}
            onChange={(e) => onWaitForElementChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5 mr-2"
          />
          <label htmlFor={`${idPrefix}-wait`} className="text-xs">
            <span className="font-medium text-gray-700">Wait for element (lazy-loaded)</span>
            <p className="text-gray-500">Apply change when element appears in DOM</p>
          </label>
        </div>
      )}

      {showPersistStyle && onPersistStyleChange && (
        <div className="flex items-start">
          <input
            type="checkbox"
            id={`${idPrefix}-persist`}
            checked={persistStyle}
            onChange={(e) => onPersistStyleChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5 mr-2"
          />
          <label htmlFor={`${idPrefix}-persist`} className="text-xs">
            <span className="font-medium text-gray-700">Persist styles (React/Vue/Angular)</span>
            <p className="text-gray-500">Re-apply styles when frameworks overwrite them</p>
          </label>
        </div>
      )}

      {showObserverRoot && waitForElement && onObserverRootChange && (
        <div className="ml-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observer Root (optional)
          </label>
          <Input
            value={observerRoot}
            onChange={(e) => onObserverRootChange(e.target.value)}
            placeholder="body, .container, #app"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      )}
    </div>
  );
};
