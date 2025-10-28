# Universal Agent Task Prompt - Pull from Queue

This is the prompt that ALL 7 testing agents receive. Each agent pulls tasks from the queue independently.

---

## YOUR MISSION (For All Agents)

You are an E2E Test Fixer. Your job is to:
1. Read `.claude/E2E_TEST_QUEUE.md`
2. Find the FIRST PENDING test in the queue (scan top to bottom)
3. Run that test
4. Either FIX it or create a FIX_PLAN for the orchestrator
5. Update the queue with your results
6. Move to the next PENDING test
7. **REPEAT until all PENDING tests are FIXED or have FIX_PLANS**

---

## CRITICAL PATTERN - USE THIS AS YOUR TEMPLATE

**visual-editor-complete.spec.ts is PASSING** ✅

Study how this test injects the sidebar. This is your gold standard. Most failing tests likely fail because they don't use the same sidebar injection pattern.

**The working sidebar injection pattern is the KEY to fixing other tests.**

---

## HOW TO WORK WITH THE QUEUE

### Reading the Queue:
Look in `.claude/E2E_TEST_QUEUE.md` for tests marked:
- `PENDING` = needs work
- `✅ PASSING` = already fixed
- `FIX_PLAN: <details>` = complex fix documented, needs implementation

### Finding Your Next Task:
Scan through categories in this order:
1. **CATEGORY: CORE WORKFLOWS** - Do these first
2. **CATEGORY: VISUAL EDITOR TESTS** - Do these second
3. **CATEGORY: EXPERIMENT FEATURES** - Do these third
4. **CATEGORY: ADVANCED FEATURES** - Do these fourth
5. **CATEGORY: INTEGRATION & PERFORMANCE** - Do these last

Pick the first PENDING test you find.

### Updating the Queue:
After working on a test, update `.claude/E2E_TEST_QUEUE.md`:

**If FIXED:**
```
- [x] **test-name.spec.ts** - ✅ PASSING
  - Status: FIXED
  - Solution: Brief summary of fix
  - Assigned to: Agent X
```

**If needs a FIX_PLAN:**
```
- [ ] **test-name.spec.ts** - FIX_PLAN CREATED
  - Status: BLOCKED - See Fix Plans section
  - Assigned to: Agent X
  - Plan ID: FP-001
```

Then add your plan to the "Fix Plans (To Be Added)" section

---

## WORKFLOW FOR EACH TEST

### Step 1: Run the Test
```bash
npx playwright test tests/e2e/test-name.spec.ts
```

### Step 2: Check Result
- **PASSES**: Mark ✅ PASSING in queue, move to next test
- **FAILS**: Go to Step 3

### Step 3: Analyze the Failure

**Check FIRST:** Does the test properly inject the sidebar like `visual-editor-complete.spec.ts` does?

Common issues (in order of likelihood):
1. **Sidebar injection pattern different** - Apply visual-editor-complete.spec.ts pattern
2. **Message passing wrong** - Check for sendToContent/sendToBackground helpers
3. **Async timing issues** - Use proper waits instead of timeouts
4. **DOM selectors wrong** - Verify against working tests
5. **Other** - Investigate deeper

### Step 4: Attempt Fix (If < 30 min estimate)

If the fix looks straightforward:
1. Read the test file carefully
2. Compare to visual-editor-complete.spec.ts
3. Apply the fix
4. Run test again
5. If it passes, update queue and move to next test
6. If still fails, create FIX_PLAN

### Step 5: Create FIX_PLAN (If > 30 min or blocked)

If the fix is complex or you're blocked:
1. Analyze root cause thoroughly
2. Document exactly what needs to change
3. Write step-by-step fix instructions
4. Update queue with FIX_PLAN reference
5. Move to next PENDING test

---

## FIX_PLAN FORMAT

When creating a fix plan, use this format:

```markdown
## FIX_PLAN-XXX: test-name.spec.ts

**Root Cause**:
[Detailed explanation of why the test fails]

**Files to Modify**:
- path/to/file.ts (line numbers)
- path/to/file2.ts (line numbers)

**Steps**:
1. [Specific code change 1]
2. [Specific code change 2]
3. [Testing step]

**Estimated Effort**: X hours
**Complexity**: Low/Medium/High
**Blocking**: None / [Test X depends on this]
```

---

## IMPORTANT RULES

✅ **DO:**
- Focus on fixing tests in priority order
- Use visual-editor-complete.spec.ts as your template
- Update queue after each test
- Create FIX_PLANs for complex issues
- Move fast - don't spend > 30 min per test trying to fix

❌ **DON'T:**
- Don't skip tests (scan top to bottom)
- Don't invent fixes without understanding the pattern
- Don't forget to update the queue
- Don't spend hours on one test - hand off if blocked

---

## Key Insights from Previous Session

1. **Sidebar injection fix** - The main issue blocking tests was removing `setupMessageListener` import from `tabs/sidebar.tsx`
2. **Messaging helpers** - All message passing should use `sendToContent()` and `sendToBackground()` from `src/lib/messaging.ts`
3. **Test pattern** - visual-editor-complete.spec.ts shows the correct way to:
   - Inject the sidebar
   - Wait for it to load
   - Send messages through it
   - Handle async operations

---

## Quick Reference Commands

```bash
# Run a single test
npx playwright test tests/e2e/test-name.spec.ts

# Run with more verbose output
npx playwright test tests/e2e/test-name.spec.ts --reporter=list

# Run specific test within file
npx playwright test tests/e2e/test-name.spec.ts -g "test description"

# Check if build is up to date
npm run build:dev
```

---

## When You're Done With a Test

1. Update `.claude/E2E_TEST_QUEUE.md` with results
2. If FIXED: Move to next PENDING test
3. If FIX_PLAN: Add plan to queue, move to next PENDING test
4. **Keep working until you see NO MORE PENDING tests**

---

## Success = All Tests Either ✅ PASSING or Have FIX_PLAN

When all tests are either fixed or have detailed fix plans, report back to the orchestrator with:
- Number of tests FIXED
- Number of tests with FIX_PLANs
- Summary of what's blocking remaining tests
