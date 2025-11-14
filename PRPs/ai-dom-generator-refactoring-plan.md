# Refactoring Plan: AI DOM Generator - Eliminate Code Duplication

## Problem
Currently ~250 lines of code are duplicated between the Anthropic API and Claude Bridge paths, making the codebase hard to maintain and impossible to add new providers without further duplication.

## Goals
1. **Eliminate all duplicated parsing/validation logic** (~250 lines)
2. **Create provider abstraction** to support multiple AI APIs
3. **Make adding OpenAI (or other providers) trivial** - just implement the interface
4. **Improve testability** - each component can be unit tested independently
5. **Maintain backward compatibility** - no breaking changes to the public API

## Current State Analysis

### Duplicated Code Sections

#### 🔴 CRITICAL: Response Parsing Logic (115 lines duplicated)
- Lines 355-427 (Anthropic API) vs 598-670 (Bridge)
- Identical logic for:
  - Markdown code block removal
  - Balanced brace JSON extraction
  - Multiple JSON object handling
  - Text before/after JSON extraction

#### 🟡 MODERATE: Validation Result Processing (36 lines duplicated)
- Lines 429-465 (Anthropic API) vs 672-708 (Bridge)
- Identical logic for:
  - Prepending/appending text before/after JSON
  - Validating result structure
  - Adding assistant message to session
  - Returning structured result

#### 🟡 MODERATE: Fallback Response Handling (19 lines duplicated)
- Lines 468-487 (Anthropic API) vs 711-730 (Bridge)
- Identical logic for converting non-JSON to conversational response

#### 🟢 MINOR: Session/Message Construction
- Similar but slightly different logic between providers

### Currently Supported Providers

- ✅ **`claude-subscription`** - Claude Code Bridge (free, uses Claude subscription)
- ✅ **`anthropic-api`** - Anthropic API with API key
- ❌ **`openai-api`** - Type exists but not implemented

## Proposed Architecture

```
src/lib/ai/
├── ai-dom-generator.ts              # Public API (orchestrator)
├── providers/
│   ├── base-provider.ts            # Provider interface + factory
│   ├── anthropic-provider.ts       # Anthropic API implementation
│   ├── bridge-provider.ts          # Claude Code Bridge implementation
│   └── openai-provider.ts          # OpenAI implementation (future)
├── parsing/
│   ├── response-parser.ts          # Extract JSON from AI response
│   └── result-processor.ts         # Process validation results
├── session/
│   └── session-manager.ts          # Session & message management
└── __tests__/
    ├── response-parser.test.ts     # Move existing test here
    └── providers/
        ├── anthropic-provider.test.ts
        └── bridge-provider.test.ts
```

### Provider Interface

```typescript
interface AIProvider {
  name: string
  sendMessage(
    userMessage: string,
    systemPrompt: string,
    session: ConversationSession,
    images?: string[]
  ): Promise<string>

  initializeSession?(session: ConversationSession, html: string): Promise<ConversationSession>
  cleanup?(): void
}
```

### Common Extracted Functions

1. **`parseAIResponse(responseText: string)`**
   - Returns `{ jsonText, textBefore, textAfter }`
   - Handles markdown removal, balanced brace matching

2. **`processValidationResult(validation, textBefore, textAfter, session)`**
   - Returns final AIDOMGenerationResult
   - Merges text before/after into response field

3. **`handleFallbackResponse(responseText, session)`**
   - Returns conversational response when JSON parsing fails

4. **`buildUserMessage(prompt, currentChanges)`**
   - Constructs formatted user message

5. **`prepareSystemPrompt(session, html, basePrompt)`**
   - Determines if HTML should be included
   - Returns complete system prompt

## Step-by-Step Refactoring Plan

### Phase 1: Extract Common Parsing Logic ⭐ NO BREAKING CHANGES

**Step 1.1:** Create `src/lib/ai/parsing/response-parser.ts`
- Extract balanced brace JSON extraction logic
- Create `parseAIResponse(responseText: string)` function
- Returns `{ jsonText: string, textBefore: string, textAfter: string }`
- Move 115 lines of duplicated parsing logic here

**Step 1.2:** Create `src/lib/ai/parsing/result-processor.ts`
- Extract `processValidationResult()` - handles valid JSON responses
- Extract `handleFallbackResponse()` - handles non-JSON conversational responses
- Move 55 lines of duplicated validation/fallback logic here

**Step 1.3:** Update both existing functions to use new parsing utilities
- Replace duplicated code in `generateDOMChanges()` with function calls
- Replace duplicated code in `generateWithBridge()` with function calls
- Run all tests to verify no regressions

**Deliverable:** ~170 lines of duplication eliminated, all tests passing

---

### Phase 2: Extract Session Management ⭐ NO BREAKING CHANGES

**Step 2.1:** Create `src/lib/ai/session/session-manager.ts`
- Extract `buildUserMessage()` - constructs user message with DOM changes
- Extract `prepareSystemPrompt()` - handles HTML inclusion logic
- Extract `updateSession()` - adds messages to session
- Move ~30 lines of session logic here

**Step 2.2:** Update existing functions to use session manager
- Simplify session handling in both paths
- Run all tests to verify no regressions

**Deliverable:** Session logic centralized, all tests passing

---

### Phase 3: Create Provider Abstraction ⭐ NO BREAKING CHANGES

**Step 3.1:** Create `src/lib/ai/providers/base-provider.ts`
- Define `AIProvider` interface
- Create provider factory function
- Add provider selection logic (try Bridge first, fallback to API)

**Step 3.2:** Create `src/lib/ai/providers/anthropic-provider.ts`
- Move Anthropic API-specific logic from `generateDOMChanges()`
- Implement `AIProvider` interface
- Keep all Anthropic-specific authentication/API call logic
- Test with Anthropic API key

**Step 3.3:** Create `src/lib/ai/providers/bridge-provider.ts`
- Move Bridge-specific logic from `generateWithBridge()`
- Implement `AIProvider` interface
- Keep all Bridge-specific connection/streaming logic
- Test with Claude Code Bridge

**Step 3.4:** Refactor main `ai-dom-generator.ts`
- Move to `src/lib/ai/ai-dom-generator.ts`
- Use provider factory and abstraction
- Use common parsing/validation/session logic for all providers
- Delete old `generateWithBridge()` function (logic moved to provider)
- Keep same public API signature

**Step 3.5:** Update imports
- Update `background/main.ts` import path
- Update any other files importing from `ai-dom-generator.ts`
- Run full test suite

**Deliverable:** Provider abstraction working, all duplication eliminated, all tests passing

---

### Phase 4: Add OpenAI Support ⭐ NEW FEATURE

**Step 4.1:** Create `src/lib/ai/providers/openai-provider.ts`
- Implement `AIProvider` interface
- Use OpenAI API to send messages
- Handle OpenAI-specific authentication
- Return text response in standard format

**Step 4.2:** Update provider factory to include OpenAI
- Add OpenAI selection logic
- Update UI to enable OpenAI option (remove error message)
- Test with OpenAI API key

**Deliverable:** OpenAI provider functional, UI updated

---

### Phase 5: Testing & Cleanup ⭐ QUALITY ASSURANCE

**Step 5.1:** Reorganize tests
- Move `src/lib/__tests__/ai-response-parsing.test.ts` → `src/lib/ai/__tests__/parsing/response-parser.test.ts`
- Add tests for result processor
- Add tests for session manager
- Add tests for each provider
- Run full test suite

**Step 5.2:** Documentation
- Update session context with refactoring details
- Add JSDoc comments to all new modules
- Document provider interface for future providers
- Update CLAUDE.md if needed

**Step 5.3:** Final verification
- Run all E2E tests
- Test all three providers (Bridge, Anthropic, OpenAI)
- Verify no breaking changes
- Performance check

**Deliverable:** All tests passing, documentation complete, ready for production

---

## Files to Create (8 new files)

1. ✅ `src/lib/ai/parsing/response-parser.ts` (~80 lines)
2. ✅ `src/lib/ai/parsing/result-processor.ts` (~60 lines)
3. ✅ `src/lib/ai/session/session-manager.ts` (~50 lines)
4. ✅ `src/lib/ai/providers/base-provider.ts` (~30 lines - interface)
5. ✅ `src/lib/ai/providers/anthropic-provider.ts` (~120 lines)
6. ✅ `src/lib/ai/providers/bridge-provider.ts` (~140 lines)
7. ✅ `src/lib/ai/providers/openai-provider.ts` (~80 lines - new feature)
8. ✅ `src/lib/ai/ai-dom-generator.ts` (refactored orchestrator, ~100 lines)

## Files to Modify (2 files)

1. ✅ `background/main.ts` - update import path
2. ✅ `src/lib/__tests__/ai-response-parsing.test.ts` → move to new location

## Files to Delete (1 file)

1. ✅ `src/lib/ai-dom-generator.ts` (after migration complete)

## Expected Outcomes

- ✅ **~250 lines of code eliminated** (parsing/validation duplication)
- ✅ **OpenAI provider working** (new feature)
- ✅ **All existing tests passing**
- ✅ **No breaking changes** to public API
- ✅ **Better organized** code with clear separation of concerns
- ✅ **Easier to maintain** - fix parsing bugs once, not twice
- ✅ **Easier to add providers** - implement interface, done

## Risk Mitigation

- **Incremental approach** - each phase independently testable
- **No breaking changes** - public API stays the same
- **Tests verify behavior** - move existing tests, add new ones
- **Can roll back** each phase independently if issues arise
- **Run tests after each step** to catch regressions early

## Success Metrics

- [ ] All existing tests pass
- [ ] New tests added for all new modules
- [ ] Code coverage maintained or improved
- [ ] No performance regression
- [ ] All three providers functional (Bridge, Anthropic, OpenAI)
- [ ] Code duplication eliminated (DRY principle)
- [ ] Documentation complete

## Timeline Estimate

- Phase 1 (Parsing): ~2 hours
- Phase 2 (Session): ~1 hour
- Phase 3 (Providers): ~3 hours
- Phase 4 (OpenAI): ~2 hours
- Phase 5 (Testing): ~2 hours

**Total: ~10 hours** (1-2 days of focused work)
