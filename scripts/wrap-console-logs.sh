#!/bin/bash

# Script to wrap all console.log/warn/error/trace statements with DEBUG flag
# Usage: ./scripts/wrap-console-logs.sh

set -e

echo "Wrapping console statements with DEBUG flag..."

# Find all TypeScript files (excluding tests and node_modules)
files=$(find src -name "*.ts" -o -name "*.tsx" | grep -v "__tests__" | grep -v "\.test\." | grep -v "node_modules")

count=0
for file in $files; do
  # Check if file has any console statements
  if grep -q "^\s*console\.\(log\|warn\|error\|trace\)" "$file"; then
    echo "Processing: $file"

    # Use perl for more reliable multi-line replacement
    perl -i -pe '
      # Match console.log/warn/error/trace at start of line (with optional whitespace)
      if (/^(\s*)(console\.(log|warn|error|trace)\([^)]*\))/) {
        my $indent = $1;
        my $statement = $2;
        # Only wrap if not already wrapped
        unless (/if\s*\(.*DEBUG.*\)/) {
          $_ = "${indent}if (process.env.DEBUG) ${statement}\n";
        }
      }
    ' "$file"

    ((count++))
  fi
done

echo "✅ Processed $count files"
echo "Done! All console statements are now wrapped with DEBUG flag."
