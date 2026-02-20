#!/bin/bash

# AI Chat Fix Testing Script
# Applies fixes one by one, tests each iteration, and tracks results

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$PROJECT_ROOT/test-results/ai-chat-fix-iterations"
BACKUP_DIR="$PROJECT_ROOT/.test-backups"

# Files to modify
AIDOMCHANGES_PAGE="$PROJECT_ROOT/src/components/AIDOMChangesPage.tsx"
DOMCHANGES_EDITOR="$PROJECT_ROOT/src/components/DOMChangesInlineEditor.tsx"
VARIANT_LIST="$PROJECT_ROOT/src/components/VariantList.tsx"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Chat Fix - Iterative Testing Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create directories
mkdir -p "$RESULTS_DIR"
mkdir -p "$BACKUP_DIR"

# Backup original files
echo -e "${YELLOW}Creating backups...${NC}"
cp "$AIDOMCHANGES_PAGE" "$BACKUP_DIR/AIDOMChangesPage.tsx.backup"
cp "$DOMCHANGES_EDITOR" "$BACKUP_DIR/DOMChangesInlineEditor.tsx.backup"
cp "$VARIANT_LIST" "$BACKUP_DIR/VariantList.tsx.backup"
echo -e "${GREEN}✓ Backups created${NC}"
echo ""

# Function to run test and capture result
run_test() {
  local iteration=$1
  local description=$2

  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}Iteration $iteration: $description${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""

  # Build extension
  echo -e "${YELLOW}Building extension...${NC}"
  cd "$PROJECT_ROOT"
  npm run build:sdk-bridge > "$RESULTS_DIR/build-sdk-$iteration.log" 2>&1
  NODE_ENV=development npx plasmo build --src-path=. > "$RESULTS_DIR/build-$iteration.log" 2>&1

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
  else
    echo -e "${RED}✗ Build failed${NC}"
    echo "See: $RESULTS_DIR/build-$iteration.log"
    return 1
  fi

  # Run E2E test
  echo -e "${YELLOW}Running E2E test...${NC}"
  npx playwright test tests/e2e/ai-chat-diagnostic-simple.spec.ts \
    --reporter=json \
    --output="$RESULTS_DIR/iteration-$iteration" \
    > "$RESULTS_DIR/test-$iteration.log" 2>&1

  local test_exit_code=$?

  # Parse test results
  if [ $test_exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ TEST PASSED${NC}"
    echo ""

    # Extract metrics from test summary
    if [ -f "$RESULTS_DIR/iteration-$iteration/test-summary.json" ]; then
      echo -e "${GREEN}Test Summary:${NC}"
      cat "$RESULTS_DIR/iteration-$iteration/test-summary.json" | grep -E '"renderCount"|"domRemovalCount"|"componentVisible"' || true
      echo ""
    fi

    return 0
  else
    echo -e "${RED}✗ TEST FAILED${NC}"
    echo ""

    # Show failure reason if available
    if [ -f "$RESULTS_DIR/iteration-$iteration/test-summary.json" ]; then
      echo -e "${RED}Failure Reason:${NC}"
      cat "$RESULTS_DIR/iteration-$iteration/test-summary.json" | grep "failureReason" || true
      echo ""
    fi

    return 1
  fi
}

# Function to apply Fix #1: Ref pattern for onPreviewToggle
apply_fix_1() {
  echo -e "${YELLOW}Applying Fix #1: Ref pattern for onPreviewToggle${NC}"

  # This is a placeholder - you'll need to apply the actual changes
  # For now, we'll use sed/awk to make the changes programmatically

  # Find the line with "const onPreviewToggleRef = useRef(onPreviewToggle)"
  # If it doesn't exist, add it after the existing refs

  grep -q "onPreviewToggleRef" "$AIDOMCHANGES_PAGE" || {
    # Add ref declaration after other refs (around line 60)
    sed -i.tmp '/const textareaRef = useRef/a\
  const onPreviewToggleRef = useRef(onPreviewToggle)
' "$AIDOMCHANGES_PAGE"

    # Add sync effect (around line 112)
    sed -i.tmp '/useEffect(() => {/,/}, \[variantName\])/ {
      /}, \[variantName\])/a\
\
  // Keep ref updated with latest callback\
  useEffect(() => {\
    onPreviewToggleRef.current = onPreviewToggle\
  }, [onPreviewToggle])
    }' "$AIDOMCHANGES_PAGE"

    # Modify preview toggle effect to use ref with empty deps
    # This is complex, so we'll provide manual instructions
    echo -e "${YELLOW}NOTE: You need to manually update the preview toggle useEffect${NC}"
    echo "Change the useEffect that calls onPreviewToggle to:"
    echo "  useEffect(() => {"
    echo "    if (onPreviewToggleRef.current) {"
    echo "      onPreviewToggleRef.current(true)"
    echo "    }"
    echo "  }, [])  // Empty deps"

    rm -f "$AIDOMCHANGES_PAGE.tmp"
  }

  echo -e "${GREEN}✓ Fix #1 applied (verify manual changes)${NC}"
}

# Function to apply Fix #2: Initialize isInitialized as true
apply_fix_2() {
  echo -e "${YELLOW}Applying Fix #2: Initialize isInitialized as true${NC}"

  # Change useState(false) to useState(true)
  sed -i.bak 's/const \[isInitialized, setIsInitialized\] = useState(false)/const [isInitialized, setIsInitialized] = useState(true)/' "$AIDOMCHANGES_PAGE"

  # Remove setIsInitialized(true) from initialization effect
  sed -i.bak '/setIsInitialized(true)/d' "$AIDOMCHANGES_PAGE"

  rm -f "$AIDOMCHANGES_PAGE.bak"

  echo -e "${GREEN}✓ Fix #2 applied${NC}"
}

# Function to verify Fix #3: useCallback on handleAIGenerate
verify_fix_3() {
  echo -e "${YELLOW}Verifying Fix #3: useCallback on handleAIGenerate${NC}"

  if grep -q "const handleAIGenerate = useCallback" "$DOMCHANGES_EDITOR"; then
    echo -e "${GREEN}✓ Fix #3 verified (useCallback present)${NC}"
    return 0
  else
    echo -e "${RED}✗ Fix #3 NOT present${NC}"
    echo "Need to wrap handleAIGenerate in useCallback"
    return 1
  fi
}

# Function to restore from backup
restore_backup() {
  echo -e "${YELLOW}Restoring from backup...${NC}"
  cp "$BACKUP_DIR/AIDOMChangesPage.tsx.backup" "$AIDOMCHANGES_PAGE"
  cp "$BACKUP_DIR/DOMChangesInlineEditor.tsx.backup" "$DOMCHANGES_EDITOR"
  cp "$BACKUP_DIR/VariantList.tsx.backup" "$VARIANT_LIST"
  echo -e "${GREEN}✓ Files restored${NC}"
}

# Main test sequence
echo -e "${BLUE}Starting fix iteration sequence...${NC}"
echo ""

# Baseline test (before any fixes)
echo -e "${BLUE}Running baseline test (no fixes applied)...${NC}"
run_test "0-baseline" "No fixes applied"
baseline_result=$?

if [ $baseline_result -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}BASELINE TEST PASSED!${NC}"
  echo -e "${GREEN}The issue may already be fixed!${NC}"
  echo -e "${GREEN}========================================${NC}"
  exit 0
fi

echo ""
echo -e "${RED}Baseline test failed - proceeding with fixes...${NC}"
echo ""

# Iteration 1: Apply Fix #1 only
echo -e "${BLUE}Iteration 1: Applying Fix #1 (Ref pattern)${NC}"
restore_backup
apply_fix_1
run_test "1-fix1" "Fix #1: Ref pattern for onPreviewToggle"
fix1_result=$?

if [ $fix1_result -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}SUCCESS! Fix #1 solved the issue!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "The ref pattern for onPreviewToggle broke the infinite loop."
  echo "No further fixes needed."
  echo ""
  echo "Summary:"
  echo "  - Fix #1: APPLIED ✓"
  echo "  - Fix #2: Not needed"
  echo "  - Fix #3: Not needed"
  exit 0
fi

echo ""
echo -e "${YELLOW}Fix #1 alone didn't solve it - trying Fix #1 + Fix #2...${NC}"
echo ""

# Iteration 2: Apply Fix #1 + Fix #2
echo -e "${BLUE}Iteration 2: Applying Fix #1 + Fix #2${NC}"
restore_backup
apply_fix_1
apply_fix_2
run_test "2-fix1-fix2" "Fix #1 + Fix #2: Ref pattern + Initialize state"
fix2_result=$?

if [ $fix2_result -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}SUCCESS! Fix #1 + Fix #2 solved the issue!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "The combination of ref pattern and state initialization fixed it."
  echo ""
  echo "Summary:"
  echo "  - Fix #1: APPLIED ✓"
  echo "  - Fix #2: APPLIED ✓"
  echo "  - Fix #3: Not needed"
  exit 0
fi

echo ""
echo -e "${YELLOW}Fixes #1 + #2 didn't solve it - verifying Fix #3...${NC}"
echo ""

# Iteration 3: Verify Fix #3 is present
echo -e "${BLUE}Iteration 3: Verifying Fix #3 (useCallback)${NC}"
verify_fix_3
fix3_present=$?

if [ $fix3_present -ne 0 ]; then
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}Fix #3 is missing!${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo "handleAIGenerate needs to be wrapped in useCallback."
  echo "Please apply this fix manually and re-run the script."
  echo ""
  echo "Expected code in DOMChangesInlineEditor.tsx:"
  echo ""
  echo "const handleAIGenerate = useCallback(async ("
  echo "  prompt: string,"
  echo "  images?: string[],"
  echo "  conversationSession?: ConversationSession | null"
  echo "): Promise<AIDOMGenerationResult> => {"
  echo "  // ... implementation ..."
  echo "}, [changes, onChange])"
  exit 1
fi

echo -e "${GREEN}Fix #3 is present${NC}"
echo ""

# All fixes applied, run final test
echo -e "${BLUE}Iteration 4: All fixes applied${NC}"
restore_backup
apply_fix_1
apply_fix_2
# Fix #3 should already be present from previous attempts
run_test "3-all-fixes" "All fixes: Ref pattern + State init + useCallback"
all_fixes_result=$?

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FINAL RESULTS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $all_fixes_result -eq 0 ]; then
  echo -e "${GREEN}✓ TEST PASSED with all fixes applied${NC}"
  echo ""
  echo "Summary of applied fixes:"
  echo "  - Fix #1: Ref pattern for onPreviewToggle ✓"
  echo "  - Fix #2: Initialize isInitialized as true ✓"
  echo "  - Fix #3: useCallback on handleAIGenerate ✓"
  echo ""
  echo "The issue is resolved!"
  echo ""
  echo "Next steps:"
  echo "  1. Review the changes in the source files"
  echo "  2. Run manual testing to confirm"
  echo "  3. Commit the fixes"
else
  echo -e "${RED}✗ TEST FAILED even with all fixes${NC}"
  echo ""
  echo "Summary:"
  echo "  - Baseline: FAILED"
  echo "  - Fix #1 only: FAILED"
  echo "  - Fix #1 + #2: FAILED"
  echo "  - All fixes: FAILED"
  echo ""
  echo "The issue is NOT a simple callback/state problem."
  echo ""
  echo "Next steps:"
  echo "  1. Review diagnostic test output: $RESULTS_DIR"
  echo "  2. Check test screenshots for visual clues"
  echo "  3. Analyze console logs for patterns"
  echo "  4. Consider other root causes (CSS, iframe, Plasmo)"
  echo ""
  echo "Restoring original files..."
  restore_backup
fi

echo ""
echo "Test results saved to: $RESULTS_DIR"
echo "Logs available at:"
echo "  - Build logs: $RESULTS_DIR/build-*.log"
echo "  - Test logs: $RESULTS_DIR/test-*.log"
echo "  - Screenshots: $RESULTS_DIR/iteration-*/ai-chat-fix/"
echo ""
