# Native Messaging Host for ABsmartly Extension

This native messaging host enables the ABsmartly Browser Extension to communicate with the Claude Code CLI without requiring a manual server startup.

## Overview

The native host bridges Chrome's native messaging protocol to the Claude Code CLI via stdin/stdout communication. This eliminates the need for the previous HTTP server approach.

## Installation

### Prerequisites

- Node.js 16 or higher
- Chrome browser
- ABsmartly extension installed

### macOS / Linux

1. Get your extension ID:
   - Open Chrome and go to `chrome://extensions`
   - Enable Developer Mode
   - Find the ABsmartly extension and copy its ID

2. Run the installer:
   ```bash
   cd native-host
   node install.js <your-extension-id>
   ```

3. The installer will:
   - Create the NativeMessagingHosts directory if needed
   - Make host.js executable
   - Write the manifest to the correct location

### Windows

Windows requires manual registry setup:

1. Create the manifest file manually:
   - Copy `manifest.json.template` to `manifest.json`
   - Replace `{{HOST_PATH}}` with the full path to `host.js`
   - Replace `{{EXTENSION_ID}}` with your extension ID

2. Add registry key:
   ```
   HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.absmartly.claude_native_host
   ```
   - Set default value to the full path of `manifest.json`

3. Ensure Node.js is in your PATH

## Verification

After installation:

1. Reload the ABsmartly extension in Chrome
2. Open the extension settings
3. Look for the native host status indicator
4. It should show a green checkmark when connected

## Debugging

To enable debug logging:

```bash
export DEBUG_NATIVE_HOST=1
```

Debug logs will be written to `/tmp/native-host-debug.log`

## Uninstallation

### macOS / Linux

```bash
cd native-host
node install.js --uninstall
```

### Windows

Manually delete the registry key mentioned above.

## Architecture

```
Chrome Extension (Background Script)
    ↕ (Native Messaging Protocol - 4-byte length prefix + JSON)
Native Host (host.js)
    ↕ (JSON Lines over stdin/stdout)
Claude Code CLI (npx @anthropic-ai/claude-code --json)
```

## Manifest Locations

- **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- **Linux**: `~/.config/google-chrome/NativeMessagingHosts/`
- **Windows**: Registry key (see above)

## Troubleshooting

### "Native host not found" error

1. Verify the manifest is in the correct location
2. Check that `host.js` is executable (macOS/Linux)
3. Verify the extension ID in the manifest matches your extension
4. Check Chrome's native messaging host list: `chrome://version` -> Profile Path

### Host fails to start

1. Enable debug logging (see above)
2. Check `/tmp/native-host-debug.log` for errors
3. Verify Node.js is installed and in PATH
4. Ensure `@anthropic-ai/claude-code` can be run via npx

### Permission denied

Make sure `host.js` is executable:
```bash
chmod +x native-host/host.js
```

## Security

The native host:
- Only accepts connections from the specified extension ID
- Runs with user permissions (not elevated)
- Does not expose any network ports
- Communicates only via stdio

## Development

To test the native host manually:

```bash
cd native-host
echo '{"type":"ping"}' | node host.js
```

This should output a pong message with Chrome's 4-byte length prefix.
