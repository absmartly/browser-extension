# Avatar Display Test Instructions

## Manual Test Steps:

1. **Open Chrome and load the extension**
   - Go to `chrome://extensions/`
   - Make sure "Developer mode" is ON
   - Click "Load unpacked" and select the `build/chrome-mv3-prod` folder
   - Or reload the extension if already loaded

2. **Open the extension popup**
   - Click the extension icon in the toolbar
   - Click the "Settings" button

3. **Wait for authentication**
   - The extension should show "Authentication Status"
   - Wait 3-5 seconds for the authentication check to complete

4. **Open Developer Console**
   - Right-click on the popup and select "Inspect"
   - Go to the Console tab

5. **Run the verification script**
   - Copy all the content from `verify-avatar-loaded.js`
   - Paste it into the console and press Enter

6. **Check the results**
   - Look for "✅ AVATAR IS VISIBLE AND LOADED!" for success
   - Look for "❌ AVATAR TEST FAILED!" for failure

## Expected Results:

- Avatar should be visible as a circular image (40x40 pixels)
- Avatar src should be a data URL starting with "data:image/"
- naturalWidth and naturalHeight should be greater than 0
- complete should be true

## Debugging:

If the avatar is not showing:
1. Check the console for errors
2. Click "Debug info" in the settings to see the user object
3. Look for these console messages:
   - "Constructed picture URL from picture.base_url: ..."
   - "Avatar fetched successfully" or "Failed to fetch avatar: ..."

## Screenshot Evidence:

Take a screenshot of the settings page showing:
- The user avatar displayed
- The console output from the verification script