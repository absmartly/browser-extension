# AI-Powered DOM Changes Generation - Feature Documentation

## Overview

This feature enables users to generate DOM changes for ABsmartly experiments using natural language descriptions. Instead of manually configuring DOM changes, users can describe what they want in plain English, and Claude AI will analyze the page HTML and generate the appropriate DOM change configuration.

---

## User Guide

### Setup

1. **Configure Anthropic API Key**
   - Open the extension settings
   - Scroll to the "AI Features" section
   - Enter your Anthropic API key (get one from [console.anthropic.com](https://console.anthropic.com/))
   - Click "Save Settings"

### Using AI-Powered Generation

1. **Navigate to an Experiment**
   - Open your ABsmartly extension
   - Select or create an experiment
   - Navigate to a specific variant

2. **Open AI Dialog**
   - Click the "Generate with AI" button (sparkle icon ✨)
   - This button appears next to "Add DOM Change" for each variant

3. **Describe Your Changes**
   - Enter a natural language description of what you want to change
   - Examples:
     - "Change the CTA button to red"
     - "Hide the pricing section"
     - "Add a banner at the top saying 'Limited Time Offer'"
     - "Make the headline text bigger and bold"
     - "Change all product images to have rounded corners"

4. **Generate Changes**
   - Click "Generate" or press Cmd/Ctrl+Enter
   - Wait while AI analyzes the page and generates DOM changes
   - Generated changes will automatically be added to your variant

5. **Review and Edit**
   - Review the generated DOM changes
   - Edit selectors or values if needed
   - Enable/disable specific changes
   - Preview the changes on the page

### Tips for Best Results

- **Be Specific**: "Change the main CTA button background to blue" works better than "make button blue"
- **Use Page Context**: Refer to elements by their semantic meaning (header, CTA, pricing section)
- **Test Prompts**: If results aren't perfect, try rephrasing or being more specific
- **Combine with Manual Editing**: AI generates starting points; you can refine manually

---

## Technical Architecture

### System Flow

```
User Input (Natural Language Prompt)
         ↓
DOMChangesInlineEditor Component
         ↓
capturePageHTML() - Captures HTML from active tab
         ↓
chrome.runtime.sendMessage('AI_GENERATE_DOM_CHANGES')
         ↓
Background Script Handler
         ↓
ai-dom-generator.ts - Calls Anthropic Claude API
         ↓
Claude Analysis (HTML + Prompt → DOM Changes JSON)
         ↓
Response with Generated DOM Changes
         ↓
DOMChangesInlineEditor adds changes to variant
```

### Key Components

#### 1. AIDOMChangesDialog Component
**Location**: `src/components/AIDOMChangesDialog.tsx`

Modal dialog component that:
- Provides textarea for user prompt input
- Shows loading state during generation
- Displays error messages
- Includes example prompts
- Supports keyboard shortcuts (Cmd/Ctrl+Enter)

**Props**:
- `isOpen`: boolean - Controls dialog visibility
- `onClose`: () => void - Close callback
- `onGenerate`: (prompt: string) => Promise<void> - Generation handler
- `variantName`: string - Name of the variant being edited

#### 2. AI DOM Generator Service
**Location**: `src/lib/ai-dom-generator.ts`

Core service that:
- Interfaces with Anthropic Claude API
- Sends comprehensive system prompt
- Processes HTML and user request
- Parses and validates response
- Returns DOM changes array

**System Prompt**:
- Defines all 11 DOM change types (text, style, styleRules, class, attribute, html, javascript, move, remove, insert, create)
- Provides detailed examples for each type
- Specifies output format requirements
- Guides selector generation strategy

**Key Function**:
```typescript
generateDOMChanges(
  html: string,      // Page HTML content
  prompt: string,    // User's natural language request
  apiKey: string     // Anthropic API key
): Promise<DOMChange[]>
```

#### 3. HTML Capture Utility
**Location**: `src/utils/html-capture.ts`

Utility function that:
- Queries active tab
- Sends CAPTURE_HTML message to content script
- Retrieves full page HTML
- Handles errors gracefully

**Key Function**:
```typescript
capturePageHTML(): Promise<string>
```

#### 4. Background Script Handler
**Location**: `background.ts` (lines 1051-1084)

Message handler that:
- Receives AI_GENERATE_DOM_CHANGES messages
- Validates API key and input
- Dynamically imports ai-dom-generator
- Calls Claude API (avoiding CORS in frontend)
- Returns generated changes or error

**Message Type**: `AI_GENERATE_DOM_CHANGES`

**Payload**:
```typescript
{
  html: string      // Page HTML
  prompt: string    // User prompt
  apiKey: string    // Anthropic API key
}
```

**Response**:
```typescript
{
  success: boolean
  changes?: DOMChange[]
  error?: string
}
```

#### 5. Content Script Handler
**Location**: `content.ts` (lines 406-416)

Message handler that:
- Receives CAPTURE_HTML messages
- Captures document.documentElement.outerHTML
- Returns HTML or error

**Message Type**: `CAPTURE_HTML`

#### 6. DOMChangesInlineEditor Integration
**Location**: `src/components/DOMChangesInlineEditor.tsx`

Enhanced with:
- `aiDialogOpen` state for dialog visibility
- `handleAIGenerate()` function to orchestrate generation
- "Generate with AI" button with SparklesIcon
- AIDOMChangesDialog component rendering

#### 7. Settings Integration
**Location**: `src/components/SettingsView.tsx`

Enhanced with:
- `anthropicApiKey` state
- Input field in "AI Features" section
- Save/load from ABsmartlyConfig
- Link to Anthropic console

---

## Files Changed

### New Files (3)

1. **src/components/AIDOMChangesDialog.tsx** (145 lines)
   - Modal dialog component for AI prompt input

2. **src/lib/ai-dom-generator.ts** (224 lines)
   - Claude API integration and system prompt

3. **src/utils/html-capture.ts** (25 lines)
   - HTML capture utility

### Modified Files (7)

1. **package.json** (+1 line)
   - Added `@anthropic-ai/sdk: ^0.65.0` dependency

2. **package-lock.json** (+24 lines)
   - Lockfile updates for new dependency

3. **src/types/absmartly.ts** (+1 line)
   - Added `anthropicApiKey?: string` to ABsmartlyConfig

4. **src/components/SettingsView.tsx** (+41 lines)
   - Added anthropicApiKey state
   - Added AI Features section with API key input
   - Updated config save/load logic

5. **src/components/DOMChangesInlineEditor.tsx** (+57 lines)
   - Added imports for AIDOMChangesDialog, capturePageHTML, getConfig
   - Added aiDialogOpen state
   - Added handleAIGenerate() function
   - Added "Generate with AI" button
   - Added AIDOMChangesDialog component

6. **background.ts** (+35 lines)
   - Added AI_GENERATE_DOM_CHANGES message handler
   - Validates inputs
   - Calls ai-dom-generator
   - Returns generated changes

7. **content.ts** (+12 lines)
   - Added CAPTURE_HTML message handler
   - Returns document.documentElement.outerHTML

### Total Changes
- **10 files changed**
- **558 insertions**
- **7 deletions**

---

## Testing Recommendations

### Unit Testing

1. **AI DOM Generator Service**
   ```typescript
   // Test system prompt generation
   // Test API call with mock responses
   // Test JSON parsing and validation
   // Test error handling
   ```

2. **HTML Capture Utility**
   ```typescript
   // Test active tab querying
   // Test message sending
   // Test error scenarios (no tab, no response)
   ```

3. **AIDOMChangesDialog Component**
   ```typescript
   // Test dialog open/close
   // Test prompt input
   // Test keyboard shortcuts
   // Test loading states
   // Test error display
   ```

### Integration Testing

1. **End-to-End AI Generation Flow**
   - Configure API key in settings
   - Navigate to experiment/variant
   - Click "Generate with AI"
   - Enter test prompt
   - Verify changes are generated
   - Verify changes are added to variant

2. **Error Scenarios**
   - No API key configured → Show error message
   - Invalid API key → Show API error
   - Network failure → Show connection error
   - Failed to capture HTML → Show capture error
   - Invalid JSON from Claude → Show parsing error

3. **Edge Cases**
   - Very large HTML pages (>100KB)
   - Pages with complex DOM structures
   - Pages with shadow DOM
   - Prompts in different languages
   - Multiple concurrent generations

### Manual Testing Checklist

#### Setup Phase
- [ ] Install extension in browser
- [ ] Configure ABsmartly credentials
- [ ] Configure Anthropic API key
- [ ] Verify settings save correctly

#### Basic Usage
- [ ] Create/select an experiment
- [ ] Navigate to a variant
- [ ] Click "Generate with AI" button
- [ ] Dialog opens with prompt field
- [ ] Example prompts are visible
- [ ] Enter a simple prompt (e.g., "Change button to red")
- [ ] Click Generate
- [ ] Wait for loading state
- [ ] Verify changes appear in variant
- [ ] Verify changes have correct format

#### Advanced Usage
- [ ] Test complex prompts with multiple changes
- [ ] Test prompts targeting specific elements
- [ ] Test prompts for different change types:
  - [ ] Text changes
  - [ ] Style changes
  - [ ] StyleRules with hover states
  - [ ] Class additions/removals
  - [ ] Attribute modifications
  - [ ] HTML insertions
  - [ ] Element removal
- [ ] Edit generated changes manually
- [ ] Preview generated changes
- [ ] Save experiment with AI-generated changes

#### Error Handling
- [ ] Try without API key → Shows error
- [ ] Try with invalid API key → Shows API error
- [ ] Try on restricted page (chrome:// URL) → Shows error
- [ ] Try with empty prompt → Shows validation error
- [ ] Test network timeout scenarios

#### Performance
- [ ] Test on small pages (<10KB HTML)
- [ ] Test on medium pages (10-100KB HTML)
- [ ] Test on large pages (>100KB HTML)
- [ ] Measure generation time
- [ ] Verify no UI blocking during generation

#### Cross-Browser Testing
- [ ] Test in Chrome
- [ ] Test in Edge
- [ ] Test in Brave

---

## API Usage and Costs

### Anthropic Claude API

**Model Used**: `claude-3-5-sonnet-20241022`

**Typical Request**:
- Input tokens: ~5,000-50,000 (system prompt + HTML + user prompt)
- Output tokens: ~500-2,000 (generated DOM changes JSON)

**Estimated Costs** (as of Jan 2025):
- Input: $3 per million tokens
- Output: $15 per million tokens

**Example Cost per Request**:
- Small page (10KB HTML): ~$0.02-0.05
- Medium page (50KB HTML): ~$0.05-0.10
- Large page (100KB HTML): ~$0.10-0.20

### Cost Optimization Tips

1. **HTML Truncation**: Limit HTML to first 50KB (implemented in ai-dom-generator.ts)
2. **Batch Prompts**: Generate multiple changes in one request
3. **Cache System Prompt**: Use Claude's prompt caching feature (future enhancement)
4. **Fallback Model**: Use a smaller model for simple requests

---

## Future Enhancements

### Planned Improvements

1. **Prompt Caching**
   - Cache the system prompt to reduce costs
   - Implement Claude's prompt caching API

2. **Change Preview Before Adding**
   - Show preview of generated changes
   - Allow user to approve/reject before adding

3. **Learning from User Edits**
   - Track common user edits to AI-generated changes
   - Improve system prompt based on patterns

4. **Change Templates**
   - Save common prompts as templates
   - Share templates across team

5. **Multi-Variant Generation**
   - Generate variations for multiple variants at once
   - A/B test different interpretations

6. **Visual Context**
   - Include screenshots with highlighted elements
   - Use Claude's vision capabilities for better targeting

7. **Undo/Redo for AI Changes**
   - Track AI-generated change groups
   - Allow bulk undo of AI changes

8. **AI Suggestions**
   - Analyze page and suggest potential changes
   - "What would you like to test on this page?"

---

## Troubleshooting

### Common Issues

**Problem**: "Anthropic API key is required" error
- **Solution**: Configure API key in Settings → AI Features section

**Problem**: Generated changes target wrong elements
- **Solution**: Be more specific in prompt, use unique identifiers (classes, IDs)

**Problem**: API request times out
- **Solution**: Page HTML too large, try on simpler page or wait longer

**Problem**: Invalid JSON error
- **Solution**: Claude occasionally returns malformed JSON, retry the request

**Problem**: Changes not appearing
- **Solution**: Check browser console for errors, verify changes were added to variant

**Problem**: Selector not found on page
- **Solution**: AI-generated selector may be incorrect, edit manually or regenerate

### Debug Mode

Enable debug logging:
1. Open browser DevTools
2. Check Console for debug messages
3. Look for messages prefixed with:
   - `[Background] Generating DOM changes with AI...`
   - `🤖 Generating DOM changes with AI...`
   - `✅ Generated X DOM changes`

---

## Security Considerations

1. **API Key Storage**: Stored in Chrome storage, not accessible to web pages
2. **HTML Sanitization**: Only page HTML is sent, no sensitive data
3. **CORS Protection**: API calls made from background script, not content script
4. **API Key in Transit**: Sent over HTTPS to Anthropic API
5. **Response Validation**: JSON response is parsed and validated before use

---

## Contributing

To extend this feature:

1. **Improve System Prompt**: Edit `src/lib/ai-dom-generator.ts`
2. **Add New Change Types**: Update system prompt with examples
3. **Enhance Dialog UI**: Modify `src/components/AIDOMChangesDialog.tsx`
4. **Optimize Performance**: Implement HTML truncation strategies
5. **Add Tests**: Create unit tests for core functions

---

## References

- [Anthropic Claude API Documentation](https://docs.anthropic.com/)
- [ABsmartly DOM Changes Documentation](https://docs.absmartly.com/)
- [Chrome Extension Messaging](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Plasmo Framework](https://docs.plasmo.com/)

---

## License

This feature is part of the ABsmartly Browser Extension and follows the same license.

---

## Changelog

### Version 1.0.0 (2025-01-04)
- Initial release
- Natural language DOM change generation
- Support for all 11 DOM change types
- Settings integration for API key
- Comprehensive system prompt
- Error handling and validation
- Loading states and user feedback
