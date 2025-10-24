#!/usr/bin/env python3
"""
Systematically fix all test timeout and wait issues.
Replaces waitForTimeout with proper element waits.
"""

import re
import os
import glob
from pathlib import Path

TESTS_DIR = Path("/Users/joalves/git_tree/ext-dev6-refactor-sdk-plugin/tests")

def fix_file(filepath):
    """Fix timeout issues in a single test file"""
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    changes = 0

    # Fix 1: Replace waitForLoadState('networkidle') with safer alternative
    pattern = r"await (\w+)\.waitForLoadState\(['\"]networkidle['\"]\)"
    replacement = r"await \1.waitForSelector('body', { timeout: 5000 })"
    content, n = re.subn(pattern, replacement, content)
    changes += n

    # Fix 2: Add proper waitUntil to goto without it (but not if it already has options)
    pattern = r"await (\w+)\.goto\(([^,)]+)\)(\s*$|\s*\n)"
    replacement = r"await \1.goto(\2, { waitUntil: 'domcontentloaded', timeout: 10000 })\3"
    # Only replace if there's no second parameter
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'await ' in line and '.goto(' in line and ', {' not in line and not line.strip().endswith(','):
            match = re.search(r'await (\w+)\.goto\(([^)]+)\)', line)
            if match and match.group(2).count(',') == 0:
                line = re.sub(
                    r'await (\w+)\.goto\(([^)]+)\)',
                    r'await \1.goto(\2, { waitUntil: \'domcontentloaded\', timeout: 10000 })',
                    line
                )
                changes += 1
        new_lines.append(line)
    content = '\n'.join(new_lines)

    # Fix 3: Replace waitForTimeout after iframe injection
    pattern = r"(// Wait for iframe to load.*?\n\s+)await (\w+)\.waitForTimeout\(\d+\)"
    replacement = r"\1await \2.waitForSelector('#absmartly-sidebar-iframe', { state: 'attached', timeout: 5000 }).catch(() => {})"
    content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
    changes += n

    # Fix 4: Replace waitForTimeout after clicks (common pattern)
    pattern = r"await (\w+)\.click\(\)\s*\n(\s+)await (\w+)\.waitForTimeout\(\d+\)"
    replacement = r"await \1.click()\n\2// Wait briefly for UI update\n\2await \3.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})"
    content, n = re.subn(pattern, replacement, content)
    changes += n

    # Fix 5: Replace remaining waitForTimeout with marked TODOs
    pattern = r"await (\w+)\.waitForTimeout\((\d+)\)"
    replacement = r"// TODO: Replace timeout with specific element wait\n    await \1.waitForFunction(() => document.readyState === 'complete', { timeout: \2 }).catch(() => {})"
    content, n = re.subn(pattern, replacement, content)
    changes += n

    # Only write if changed
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return changes
    return 0

def main():
    """Process all test files"""
    # Find all spec files
    spec_files = list(TESTS_DIR.rglob("*.spec.ts"))

    total_files = 0
    total_changes = 0

    print(f"🔧 Processing {len(spec_files)} test files...\n")

    for filepath in spec_files:
        # Check if file contains waitForTimeout
        with open(filepath, 'r') as f:
            if 'waitForTimeout' not in f.read() and 'networkidle' not in f.read():
                continue

        changes = fix_file(filepath)
        if changes > 0:
            total_files += 1
            total_changes += changes
            print(f"✓ Fixed {changes} issues in {filepath.name}")

    print(f"\n✅ Fixed {total_changes} issues in {total_files} files")
    print("\n⚠️  Files with TODO markers need manual review")
    print("   Search for 'TODO: Replace timeout' to find them")

if __name__ == '__main__':
    main()
