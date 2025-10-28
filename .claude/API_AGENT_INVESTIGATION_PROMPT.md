# Universal Agent Prompt - API Experiments Investigation

**Mission**: Investigate why the API experiments loading is broken so we can fix it systematically

---

## Your Task

You are one of 7 parallel investigators. Your job is to:

1. **Read** `.claude/API_FIX_QUEUE.md` to see which investigation task is assigned to you
2. **Investigate** the specific area of code listed in your task
3. **Document** your findings in the queue file
4. **Answer** the investigation questions
5. **Don't code yet** - just analyze and report back

---

## How to Work

### Phase: Investigation Only (No Code Changes)

You are NOT writing fixes yet. You are:
- Reading code
- Understanding the flow
- Identifying problems
- Documenting findings

### Agent Assignments

**Agent 1 - Message Adapter Inspector**:
- File: `src/background/message-adapter.ts`
- Question: Is the `API_REQUEST` message type being handled?
- Task: Find the handler (or confirm it's missing)
- Report: Where is it? What does it do?

**Agent 2 - Background Service Worker Tracer**:
- Files: `src/background/message-adapter.ts`, background service worker entry point
- Question: How is the API request actually being made?
- Task: Follow the message flow from sidebar to API call
- Report: What auth is being used? Where does the request happen?

**Agent 3 - API Client Analyzer**:
- File: `src/lib/background-api-client.ts`
- Question: How are experiments being parsed from the API response?
- Task: Look at `getExperiments()` method
- Report: What's the response structure? Any parsing issues?

**Agent 4 - Sidebar Component Auditor**:
- Files: `src/tabs/sidebar.tsx`, `src/components/ExperimentList.tsx`
- Question: When and how does the sidebar load experiments?
- Task: Find where `getExperiments()` is called
- Report: Is it called on mount? On demand? Any error handling?

**Agent 5 - Test Failure Analyzer**:
- File: `tests/e2e/api-integration.spec.ts`
- Question: What exact error appears when experiments fail to load?
- Task: Read the test, understand what it's checking for
- Report: What's the error message? Is it network, parsing, or missing data?

**Agent 6 - Auth Flow Checker**:
- Files: `.env.dev.local`, `src/lib/background-api-client.ts`
- Question: How does the API key get from storage to the API request?
- Task: Trace the auth flow
- Report: Where does the key come from? How is it passed to the request?

**Agent 7 - Environment and Build Verifier**:
- Files: `.env.dev.local`, build configuration
- Question: Are environment variables and API endpoints configured correctly?
- Task: Check env file and build setup
- Report: Is the API endpoint valid? Do credentials exist in .env.dev.local?

---

## How to Investigate

### Step 1: Read Your Assigned Code
- Open the file(s) specified for your agent
- Understand what the code does
- Look for issues or missing pieces

### Step 2: Answer Investigation Questions
- Your agent has 1-3 specific questions
- Answer them based on code reading
- Be specific and include line numbers

### Step 3: Document Findings
- Add your findings to `.claude/API_FIX_QUEUE.md`
- Update your section under "Investigation Findings Log"
- Include:
  - What you found
  - File path and line numbers
  - Is this the root cause?
  - What needs to be fixed?

### Step 4: Communicate
- Keep findings brief but complete
- Use code snippets if helpful
- Clearly state if it's blocking or not critical

---

## Key Files to Know

**API Client**:
- `src/lib/background-api-client.ts` - Makes API requests through background worker

**Message Handling**:
- `src/background/message-adapter.ts` - Routes messages from sidebar

**Sidebar**:
- `src/tabs/sidebar.tsx` - The UI sidebar
- `src/components/ExperimentList.tsx` - Shows experiments

**Tests**:
- `tests/e2e/api-integration.spec.ts` - Tests API experiment loading

**Config**:
- `.env.dev.local` - API credentials (should exist)

---

## Investigation Commands

When investigating, you may need to:
```bash
# Search for specific code
grep -r "API_REQUEST" src/
grep -r "getExperiments" src/

# Look for message handlers
grep -r "chrome.runtime.onMessage" src/

# Find auth setup
grep -r "apiKey" src/ --include="*.ts"

# View test to understand what it expects
cat tests/e2e/api-integration.spec.ts | head -150
```

---

## Important Notes

✅ **DO**:
- Read code carefully
- Ask specific questions about what you see
- Include line numbers in findings
- Be thorough in investigation
- Report blockers clearly

❌ **DON'T**:
- Make code changes yet
- Make assumptions without checking code
- Skip parts of the investigation
- Use grep without understanding context
- Report vague findings ("something's wrong")

---

## Expected Outcome

After all 7 agents complete investigation:
- We will know the root cause
- We will know exactly which files need fixing
- We will understand the flow from sidebar → API call
- We will be ready to implement fixes

---

## When You're Done

1. Add your findings to `.claude/API_FIX_QUEUE.md`
2. Clearly state if you found the root cause
3. List files that need fixing
4. Wait for all agents to complete
5. Follow orchestrator's next instructions

---

## Questions?

If you encounter:
- **Unclear code**: Document what you expect vs what you see
- **Missing files**: Report the missing file and what should be there
- **Multiple issues**: List all of them with priorities
- **Can't find something**: Report what you searched for and what you expected to find

Good luck! Let's find this bug!
