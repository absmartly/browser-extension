#!/bin/bash

# Script to verify test health after timeout fixes

echo "🔍 Verifying Test Suite Health"
echo "================================"
echo ""

# Check 1: No waitForTimeout
echo "✓ Checking for forbidden waitForTimeout()..."
TIMEOUT_COUNT=$(grep -r "waitForTimeout" tests/**/*.spec.ts tests/*.spec.ts 2>/dev/null | grep -v "// " | wc -l | tr -d ' ')
if [ "$TIMEOUT_COUNT" -eq "0" ]; then
  echo "  ✅ PASS: No waitForTimeout() calls found"
else
  echo "  ❌ FAIL: Found $TIMEOUT_COUNT waitForTimeout() calls"
  grep -n "waitForTimeout" tests/**/*.spec.ts tests/*.spec.ts 2>/dev/null | grep -v "// " | head -5
fi
echo ""

# Check 2: No problematic networkidle
echo "✓ Checking for problematic networkidle waits..."
NETWORKIDLE_COUNT=$(grep -r "waitForLoadState('networkidle')" tests/**/*.spec.ts tests/*.spec.ts 2>/dev/null | grep -v "timeout:" | grep -v "// " | wc -l | tr -d ' ')
if [ "$NETWORKIDLE_COUNT" -eq "0" ]; then
  echo "  ✅ PASS: No problematic networkidle waits found"
else
  echo "  ❌ FAIL: Found $NETWORKIDLE_COUNT networkidle waits without timeout"
  grep -n "waitForLoadState('networkidle')" tests/**/*.spec.ts tests/*.spec.ts 2>/dev/null | grep -v "timeout:" | head -5
fi
echo ""

# Check 3: All goto has waitUntil
echo "✓ Checking for goto without waitUntil..."
GOTO_NO_WAIT=$(grep -r "\.goto(" tests/**/*.spec.ts tests/*.spec.ts 2>/dev/null | grep -v "waitUntil" | grep -v "// " | wc -l | tr -d ' ')
echo "  ℹ️  Found $GOTO_NO_WAIT goto calls without explicit waitUntil (may be OK if using defaults)"
if [ "$GOTO_NO_WAIT" -lt "10" ]; then
  echo "  ✅ PASS: Most goto calls have proper wait configuration"
else
  echo "  ⚠️  WARNING: Many goto calls without explicit waitUntil"
fi
echo ""

# Check 4: Count TODO markers
echo "✓ Checking for TODO markers needing review..."
TODO_COUNT=$(grep -r "TODO: Replace timeout" tests/**/*.spec.ts tests/*.spec.ts 2>/dev/null | wc -l | tr -d ' ')
echo "  ℹ️  Found $TODO_COUNT TODO markers for manual review"
if [ "$TODO_COUNT" -lt "100" ]; then
  echo "  ✅ PASS: Reasonable number of TODOs"
else
  echo "  ⚠️  WARNING: Many TODOs need review"
fi
echo ""

# Check 5: Test file count
echo "✓ Checking test file count..."
TEST_COUNT=$(find tests -name "*.spec.ts" | wc -l | tr -d ' ')
echo "  ℹ️  Total test files: $TEST_COUNT"
echo ""

# Summary
echo "================================"
echo "Summary:"
echo "  - waitForTimeout() calls: $TIMEOUT_COUNT (should be 0)"
echo "  - Problematic networkidle: $NETWORKIDLE_COUNT (should be 0)"
echo "  - goto without waitUntil: $GOTO_NO_WAIT"
echo "  - TODO markers: $TODO_COUNT"
echo "  - Total test files: $TEST_COUNT"
echo ""

if [ "$TIMEOUT_COUNT" -eq "0" ] && [ "$NETWORKIDLE_COUNT" -eq "0" ]; then
  echo "✅ Test suite health: GOOD"
  echo ""
  echo "Next steps:"
  echo "  1. Run tests to verify they complete within timeout"
  echo "  2. Review TODO markers and replace with specific waits"
  echo "  3. Monitor test execution times"
  exit 0
else
  echo "❌ Test suite health: NEEDS ATTENTION"
  exit 1
fi
