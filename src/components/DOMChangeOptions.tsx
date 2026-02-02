import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

export interface DOMChangeOptionsProps {
  important?: boolean;
  waitForElement?: boolean;
  triggerOnView?: boolean;
  persistStyle?: boolean;
  observerRoot?: string;
  onImportantChange?: (value: boolean) => void;
  onWaitForElementChange?: (value: boolean) => void;
  onTriggerOnViewChange?: (value: boolean) => void;
  onPersistStyleChange?: (value: boolean) => void;
  onObserverRootChange?: (value: string) => void;
  onStartPicker?: (field: string) => void;
  pickingForField?: string | null;
  disabled?: boolean;
  idPrefix?: string;
  showImportant?: boolean;
  showWaitForElement?: boolean;
  showTriggerOnView?: boolean;
  showPersistStyle?: boolean;
  showObserverRoot?: boolean;
}

export const DOMChangeOptions: React.FC<DOMChangeOptionsProps> = ({
  important = false,
  waitForElement = false,
  triggerOnView = false,
  persistStyle = false,
  observerRoot = '',
  onImportantChange,
  onWaitForElementChange,
  onTriggerOnViewChange,
  onPersistStyleChange,
  onObserverRootChange,
  onStartPicker,
  pickingForField,
  disabled = false,
  idPrefix = 'dom-options',
  showImportant = true,
  showWaitForElement = true,
  showTriggerOnView = true,
  showPersistStyle = true,
  showObserverRoot = true,
}) => {
  const [localPickingForField, setLocalPickingForField] = useState<string | null>(pickingForField || null)
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

      {showTriggerOnView && onTriggerOnViewChange && (
        <div className="flex items-start">
          <input
            type="checkbox"
            id={`${idPrefix}-trigger-view`}
            checked={triggerOnView}
            onChange={(e) => onTriggerOnViewChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5 mr-2"
          />
          <label htmlFor={`${idPrefix}-trigger-view`} className="text-xs">
            <span className="font-medium text-gray-700">Trigger on-view</span>
            <p className="text-gray-500">Only register exposure when element is visible</p>
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
            <span className="font-medium text-gray-700">Persist change</span>
            <p className="text-gray-500">Re-apply change when frameworks or interactions overwrite it</p>
          </label>
        </div>
      )}

      {showObserverRoot && waitForElement && onObserverRootChange && (
        <div className="ml-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observer Root (optional)
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={observerRoot}
                onChange={(e) => onObserverRootChange(e.target.value)}
                placeholder="body, .container, #app"
                disabled={disabled}
                className={`w-full px-3 py-2 pr-10 border rounded-md text-xs font-mono bg-white ${localPickingForField === 'observerRoot' ? 'border-blue-500' : 'border-gray-300'}`}
              />
            </div>
            {onStartPicker && (
              <Button
                type="button"
                onClick={() => {
                  setLocalPickingForField('observerRoot')
                  onStartPicker('observerRoot')
                }}
                size="sm"
                variant="secondary"
                title="Pick element"
                className={localPickingForField === 'observerRoot' ? 'bg-blue-100' : ''}
              >
                🎯
              </Button>
            )}
          </div>
          {localPickingForField === 'observerRoot' && (
            <p className="text-xs text-blue-600 mt-1 animate-pulse">
              Click an element on the page...
            </p>
          )}
        </div>
      )}
    </div>
  );
};
