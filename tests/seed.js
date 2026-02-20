// Function to seed storage with key-value pairs
// IMPORTANT: Plasmo Storage expects all values to be JSON-serialized
// We need to serialize values the same way Plasmo Storage does
window.seed = async (kv) => {
  try {
    // Handle special case for legacy individual keys - convert to config object
    if (kv['absmartly-endpoint'] || kv['absmartly-auth-method']) {
      console.log('⚠️  Detected legacy storage format, converting to new format...');

      // Build config object from individual keys
      const config = {
        apiKey: '', // API key stored separately in secure storage
        apiEndpoint: kv['absmartly-endpoint'] || kv['absmartly-apiEndpoint'],
        authMethod: kv['absmartly-auth-method'] || kv['absmartly-authMethod'] || 'jwt',
        applicationId: kv['absmartly-applicationId'],
        domChangesFieldName: kv['absmartly-domChangesFieldName']
      };

      // Remove individual keys and use unified config
      delete kv['absmartly-endpoint'];
      delete kv['absmartly-apiEndpoint'];
      delete kv['absmartly-auth-method'];
      delete kv['absmartly-authMethod'];
      delete kv['absmartly-env'];
      delete kv['absmartly-environment'];
      delete kv['absmartly-applicationId'];
      delete kv['absmartly-domChangesFieldName'];

      // Add config object
      kv['absmartly-config'] = config;

      console.log('✅ Converted to config object:', config);
    }

    // Serialize all values using JSON.stringify, just like Plasmo Storage does
    const serialized = {};
    for (const [key, value] of Object.entries(kv)) {
      // Plasmo Storage serializes all values with JSON.stringify
      serialized[key] = JSON.stringify(value);
    }

    await chrome.storage.local.set(serialized);
    console.log('Storage seeded with keys:', Object.keys(kv));
    console.log('Storage seeded with values:', kv);
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
    // Deserialize values just like Plasmo Storage does
    const deserialized = {};
    for (const [key, value] of Object.entries(items)) {
      try {
        deserialized[key] = JSON.parse(value);
      } catch {
        // If parsing fails, return raw value (shouldn't happen if seeded correctly)
        deserialized[key] = value;
      }
    }
    console.log('Current storage:', deserialized);
    return deserialized;
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
