import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { ExclamationTriangleIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Alert, AlertDescription } from './ui/Alert';

interface DOMChangesJSONEditorProps {
  isOpen: boolean;
  onClose: () => void;
  changes: any[];
  onSave: (changes: any[]) => void;
  variantName: string;
}

export const DOMChangesJSONEditor: React.FC<DOMChangesJSONEditorProps> = ({
  isOpen,
  onClose,
  changes,
  onSave,
  variantName,
}) => {
  const [jsonContent, setJsonContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Format the JSON with proper indentation
    try {
      setJsonContent(JSON.stringify(changes, null, 2));
      setHasChanges(false);
      setError(null);
    } catch (e) {
      setError('Failed to format changes as JSON');
    }
  }, [changes, isOpen]);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    
    setJsonContent(value);
    setHasChanges(value !== JSON.stringify(changes, null, 2));
    
    // Validate JSON syntax
    try {
      JSON.parse(value);
      setError(null);
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  const handleSave = () => {
    try {
      const parsedChanges = JSON.parse(jsonContent);
      
      // Validate that it's an array
      if (!Array.isArray(parsedChanges)) {
        setError('Changes must be an array');
        return;
      }
      
      // Validate each change has required fields
      for (let i = 0; i < parsedChanges.length; i++) {
        const change = parsedChanges[i];
        if (!change.selector || !change.type) {
          setError(`Change at index ${i} is missing required fields (selector, type)`);
          return;
        }
        
        // Validate type-specific requirements
        switch (change.type) {
          case 'text':
          case 'html':
            if (change.value === undefined) {
              setError(`Change at index ${i} (${change.type}) is missing 'value' field`);
              return;
            }
            break;
          case 'style':
            if (!change.value || typeof change.value !== 'object') {
              setError(`Change at index ${i} (style) must have 'value' as an object`);
              return;
            }
            break;
          case 'class':
            if (!change.add && !change.remove) {
              setError(`Change at index ${i} (class) must have 'add' or 'remove' array`);
              return;
            }
            break;
          case 'attribute':
            if (!change.value || typeof change.value !== 'object') {
              setError(`Change at index ${i} (attribute) must have 'value' as an object`);
              return;
            }
            break;
          case 'move':
            if (!change.targetSelector || !change.position) {
              setError(`Change at index ${i} (move) is missing targetSelector or position`);
              return;
            }
            break;
          case 'create':
            if (!change.element || !change.targetSelector) {
              setError(`Change at index ${i} (create) is missing element or targetSelector`);
              return;
            }
            break;
        }
      }
      
      onSave(parsedChanges);
      onClose();
    } catch (e) {
      setError(`Failed to save: ${(e as Error).message}`);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      setJsonContent(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError(`Cannot format invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit DOM Changes - {variantName}</span>
            <div className="flex items-center gap-2 text-sm">
              {hasChanges && (
                <span className="text-orange-500 flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Unsaved changes
                </span>
              )}
              {!error && jsonContent && (
                <span className="text-green-500 flex items-center gap-1">
                  <CheckIcon className="h-4 w-4" />
                  Valid JSON
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="border rounded-lg overflow-hidden" style={{ height: '60vh' }}>
            <Editor
              height="100%"
              defaultLanguage="json"
              value={jsonContent}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'all',
                scrollbar: {
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
            />
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            <p>Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Each change must have 'selector' and 'type' fields</li>
              <li>Use Ctrl/Cmd+F to search within the editor</li>
              <li>The editor supports code folding - click the arrows in the gutter</li>
              <li>Changes are validated before saving</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleFormat} disabled={!!error}>
            Format JSON
          </Button>
          <Button variant="outline" onClick={onClose}>
            <XMarkIcon className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!!error || !hasChanges}>
            <CheckIcon className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};