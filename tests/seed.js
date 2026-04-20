// Function to seed storage with key-value pairs
// IMPORTANT: Plasmo Storage expects all values to be JSON-serialized
// Secret keys (ai-apikey, absmartly-apikey) go in local storage;
// everything else goes in sync storage. This mirrors the extension's
// own routing in src/utils/storage.ts.
window.seed = async (kv) => {
  try {
    if (kv['absmartly-endpoint'] || kv['absmartly-auth-method']) {
      console.log('⚠️  Detected legacy storage format, converting to new format...');

      const config = {
        apiKey: '',
        apiEndpoint: kv['absmartly-endpoint'] || kv['absmartly-apiEndpoint'],
        authMethod: kv['absmartly-auth-method'] || kv['absmartly-authMethod'] || 'jwt',
        applicationId: kv['absmartly-applicationId'],
        domChangesFieldName: kv['absmartly-domChangesFieldName']
      };

      delete kv['absmartly-endpoint'];
      delete kv['absmartly-apiEndpoint'];
      delete kv['absmartly-auth-method'];
      delete kv['absmartly-authMethod'];
      delete kv['absmartly-env'];
      delete kv['absmartly-environment'];
      delete kv['absmartly-applicationId'];
      delete kv['absmartly-domChangesFieldName'];

      kv['absmartly-config'] = config;

      console.log('✅ Converted to config object:', config);
    }

    const LOCAL_AREA_KEYS = new Set([
      'ai-apikey',
      'absmartly-apikey',
      'plasmo:ai-apikey',
      'plasmo:absmartly-apikey'
    ]);

    const syncSerialized = {};
    const localSerialized = {};
    for (const [key, value] of Object.entries(kv)) {
      const serialized = JSON.stringify(value);
      if (LOCAL_AREA_KEYS.has(key)) {
        localSerialized[key] = serialized;
      } else {
        syncSerialized[key] = serialized;
      }
    }

    if (Object.keys(syncSerialized).length > 0) {
      await chrome.storage.sync.set(syncSerialized);
    }
    if (Object.keys(localSerialized).length > 0) {
      await chrome.storage.local.set(localSerialized);
    }

    console.log('Storage seeded (sync):', Object.keys(syncSerialized));
    console.log('Storage seeded (local):', Object.keys(localSerialized));
    return 'ok';
  } catch (error) {
    console.error('Failed to seed storage:', error);
    throw error;
  }
};

window.clear = async () => {
  try {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
    console.log('Storage cleared (sync + local)');
    return 'ok';
  } catch (error) {
    console.error('Failed to clear storage:', error);
    throw error;
  }
};

window.getAll = async () => {
  try {
    const syncItems = await chrome.storage.sync.get(null);
    const localItems = await chrome.storage.local.get(null);
    const all = { ...syncItems, ...localItems };
    const deserialized = {};
    for (const [key, value] of Object.entries(all)) {
      try {
        deserialized[key] = JSON.parse(value);
      } catch {
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

window.addEventListener('DOMContentLoaded', async () => {
  const items = await window.getAll();
  document.body.innerHTML += `<pre>${JSON.stringify(items, null, 2)}</pre>`;
});
