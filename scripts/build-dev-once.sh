#!/bin/bash
set -euo pipefail

# Ensure development environment
export NODE_ENV=development

# Create a named pipe (FIFO) to stream output
PIPE=$(mktemp -u)
mkfifo "$PIPE"

# Start plasmo dev in background, redirect output to the pipe
npx plasmo dev --no-hot-reload --src-path=. > "$PIPE" 2>&1 &
PLASMO_PID=$!

# Read line-by-line from the pipe and print to stdout
# Kill plasmo dev after the first successful repackage
cleanup() {
  # Avoid error if process already exited
  if ps -p $PLASMO_PID > /dev/null 2>&1; then
    kill $PLASMO_PID 2>/dev/null || true
    wait $PLASMO_PID 2>/dev/null || true
  fi
  rm -f "$PIPE"
}
trap cleanup EXIT

while IFS= read -r line; do
  echo "$line"
  if [[ "$line" == *"DONE   | Extension re-packaged"* ]]; then
    echo "Detected build complete. Killing plasmo dev (PID $PLASMO_PID)..."
    break
  fi
done < "$PIPE"

# Copy SDK bridge bundle to build directory after Plasmo finishes
if [ -f "public/absmartly-sdk-bridge.bundle.js" ]; then
  if [ -d "build/chrome-mv3-dev" ]; then
    cp public/absmartly-sdk-bridge.bundle.js build/chrome-mv3-dev/
    echo "✅ Copied SDK bridge bundle to build/chrome-mv3-dev/"
  fi
  if [ -f "public/absmartly-sdk-bridge.bundle.js.map" ] && [ -d "build/chrome-mv3-dev" ]; then
    cp public/absmartly-sdk-bridge.bundle.js.map build/chrome-mv3-dev/
  fi
fi
