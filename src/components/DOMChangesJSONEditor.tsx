import React, { useEffect, useRef } from 'react';

interface DOMChangesJSONEditorProps {
  isOpen: boolean;
  onClose: () => void;
  changes: any[];
  onSave: (changes: any[]) => void;
  variantName: string;
}

export const export const DOMChangesJSONEditor: React.FC<DOMChangesJSONEditorProps> = ({
  isOpen,
  onClose,
  changes,
  onSave,
  variantName,
}) => {
  const onSaveRef = useRef(onSave)
  const onCloseRef = useRef(onClose)
  
  useEffect(() => {
    onSaveRef.current = onSave
    onCloseRef.current = onClose
  }, [onSave, onClose])

  useEffect(() => {
    if (!isOpen) return

    // Send message to content script to open the JSON editor
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'OPEN_JSON_EDITOR',
          data: {
            variantName,
            value: JSON.stringify(changes, null, 2)
          }
        })
      }
    })

    const handleMessage = (message: any) => {
      if (message.type === 'JSON_EDITOR_SAVE') {
        try {
          const parsedChanges = JSON.parse(message.value)
          
          if (!Array.isArray(parsedChanges)) {
            console.error('Changes must be an array')
            return
          }
          
          onSaveRef.current(parsedChanges)
          onCloseRef.current()
        } catch (e) {
          console.error('Failed to parse JSON:', e)
        }
      } else if (message.type === 'JSON_EDITOR_CLOSE') {
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CLOSE_JSON_EDITOR'
          })
        }
      })
    }
  }, [isOpen, changes, variantName])

  return null
} => !open && onClose()}>
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