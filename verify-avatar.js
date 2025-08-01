// Test script to verify avatar URL construction
const https = require('https');

// Sample user data from the debug output
const userData = {
  "id": 3,
  "email": "jonas@absmartly.com",
  "picture": {
    "id": 357,
    "file_usage_id": 1,
    "width": 1200,
    "height": 1200,
    "file_size": 41836,
    "file_name": "01_Color_Logo-square.png",
    "content_type": "image/png",
    "base_url": "/files/avatars/f7bd44c4acd4",
    "crop_left": 119.99999999999999,
    "crop_top": 120,
    "crop_width": 960.0000000000001,
    "crop_height": 960.0000000000001,
    "created_at": "2025-03-31T13:44:22.922Z",
    "created_by_user_id": 3
  }
};

const endpoint = "https://dev-1.absmartly.com/";
const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;

// Construct avatar URL
let pictureUrl = null;
if (userData.picture && typeof userData.picture === 'object' && userData.picture.base_url) {
  pictureUrl = `${cleanEndpoint}${userData.picture.base_url}/crop/original.png`;
}

console.log('Constructed Avatar URL:', pictureUrl);
console.log('Expected URL format: https://dev-1.absmartly.com/files/avatars/f7bd44c4acd4/crop/original.png');

// Test if the URL is accessible
if (pictureUrl) {
  https.get(pictureUrl, (res) => {
    console.log('\nHTTP Status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    
    if (res.statusCode === 200) {
      console.log('✅ Avatar URL is accessible!');
    } else {
      console.log('❌ Avatar URL returned status:', res.statusCode);
    }
  }).on('error', (err) => {
    console.error('❌ Error accessing avatar URL:', err.message);
  });
}