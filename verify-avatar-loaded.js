// Simple script to inject into the extension popup to verify avatar
// This script will be run in the browser console while the extension popup is open

function verifyAvatar() {
  console.log('=== AVATAR VERIFICATION TEST ===');
  
  // Find all user avatar images
  const avatars = document.querySelectorAll('img[alt*="User"]');
  console.log(`Found ${avatars.length} avatar image(s)`);
  
  if (avatars.length === 0) {
    console.error('❌ NO AVATAR FOUND!');
    
    // Check authentication status
    const authSection = document.querySelector('.bg-gray-50');
    if (authSection) {
      console.log('Authentication section content:', authSection.textContent);
    }
    
    // Check for debug info
    const debugSummary = document.querySelector('summary:has-text("Debug info")');
    if (debugSummary) {
      debugSummary.click();
      setTimeout(() => {
        const debugPre = document.querySelector('pre');
        if (debugPre) {
          console.log('Debug info:', debugPre.textContent);
        }
      }, 100);
    }
    
    return false;
  }
  
  // Check each avatar
  avatars.forEach((img, index) => {
    console.log(`\n--- Avatar ${index + 1} ---`);
    console.log('src:', img.src ? img.src.substring(0, 100) + '...' : 'none');
    console.log('alt:', img.alt);
    console.log('naturalWidth:', img.naturalWidth);
    console.log('naturalHeight:', img.naturalHeight);
    console.log('width:', img.width);
    console.log('height:', img.height);
    console.log('complete:', img.complete);
    console.log('visible:', img.offsetParent !== null);
    console.log('Is data URL:', img.src.startsWith('data:'));
    
    if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.complete) {
      console.log('✅ Avatar loaded successfully!');
      return true;
    } else {
      console.log('❌ Avatar failed to load!');
    }
  });
  
  return false;
}

// Run the verification
const result = verifyAvatar();
console.log('\n=== TEST RESULT ===');
console.log(result ? '✅ AVATAR IS VISIBLE AND LOADED!' : '❌ AVATAR TEST FAILED!');

// Return result for external scripts
result;