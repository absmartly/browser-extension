// Function to seed storage with key-value pairs
window.seed = async (kv) => {
  try {
    await chrome.storage.local.set(kv);
    console.log('Storage seeded with:', Object.keys(kv));
    return 'ok';
  } catch (error) {
    console.error('Failed to seed storage:', error);
    throw error;
  }
};

// Function to clear all storage
window.clear = async () => {
  try {
    await chrome.storage.local.clear();
    console.log('Storage cleared');
    return 'ok';
  } catch (error) {
    console.error('Failed to clear storage:', error);
    throw error;
  }
};

// Function to get current storage state (for debugging)
window.getAll = async () => {
  try {
    const items = await chrome.storage.local.get(null);
    console.log('Current storage:', items);
    return items;
  } catch (error) {
    console.error('Failed to get storage:', error);
    throw error;
  }
};

// Show storage state on page load for debugging
window.addEventListener('DOMContentLoaded', async () => {
  const items = await window.getAll();
  document.body.innerHTML += `<pre>${JSON.stringify(items, null, 2)}</pre>`;
});
