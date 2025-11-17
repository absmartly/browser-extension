#!/bin/bash

# AI Chat Diagnostic Test Runner
# This script builds the extension and runs the diagnostic test
# to gather data about the AI chat blank screen issue.

set -e  # Exit on error

echo "======================================"
echo "AI Chat Blank Screen Diagnostic Test"
echo "======================================"
echo ""

# Step 1: Build the extension
echo "📦 Step 1: Building extension (development mode)..."
npm run build:dev
echo "✅ Build complete"
echo ""

# Step 2: Run the diagnostic test
echo "🧪 Step 2: Running diagnostic test..."
echo "   This test will PASS even if AI chat fails."
echo "   We're gathering diagnostic data, not testing functionality."
echo ""
npx playwright test tests/e2e/ai-chat-diagnostic.spec.ts
echo ""

# Step 3: Show results location
echo "======================================"
echo "✅ Diagnostic test complete!"
echo "======================================"
echo ""
echo "📊 Results saved to:"
echo "   - Console output (above)"
echo "   - Screenshots in: test-results/"
echo ""
echo "📄 Next steps:"
echo "   1. Review the console output for KEY FINDINGS"
echo "   2. Check screenshots in test-results/ directory"
echo "   3. Read PRPs/ai-chat-diagnostic-test-plan.md for interpretation"
echo ""
echo "🔍 Look for:"
echo "   - Component state progression"
echo "   - Iframe existence timeline"
echo "   - React component logs"
echo "   - Console errors"
echo ""
