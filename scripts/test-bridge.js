#!/usr/bin/env node

const http = require('http');
const EventSource = require('eventsource').EventSource || require('eventsource');

const BRIDGE_URL = 'http://localhost:3000';

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: () => JSON.parse(data) });
        } catch (e) {
          resolve({ ok: false, json: () => ({}) });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testBridge() {
  console.log('Testing Claude Code Bridge Integration\n');

  // 1. Health check
  console.log('1. Checking bridge health...');
  const healthResp = await httpRequest(`${BRIDGE_URL}/health`);
  const health = await healthResp.json();
  console.log('   Bridge:', health.ok ? '✓ Running' : '✗ Not running');
  console.log('   Auth:', health.authenticated ? `✓ Authenticated (${health.subscriptionType})` : '✗ Not authenticated');

  if (!health.ok || !health.authenticated) {
    console.error('\n❌ Bridge not ready');
    process.exit(1);
  }

  // 2. Create conversation
  console.log('\n2. Creating conversation...');
  const convResp = await httpRequest(`${BRIDGE_URL}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: `test-${Date.now()}`,
      cwd: '/',
      permissionMode: 'allow'
    })
  });

  const { conversationId } = await convResp.json();
  console.log('   ✓ Conversation ID:', conversationId);

  // 3. Set up stream listener
  console.log('\n3. Setting up event stream...');
  const eventSource = new EventSource(`${BRIDGE_URL}/conversations/${conversationId}/stream`);

  const responsePromise = new Promise((resolve, reject) => {
    let fullResponse = '';
    let eventCount = 0;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      eventCount++;

      if (data.type === 'text') {
        fullResponse += data.data;
        process.stdout.write('.');
      } else if (data.type === 'done') {
        console.log(`\n   ✓ Stream complete (${eventCount} events, ${fullResponse.length} chars)`);
        eventSource.close();
        resolve(fullResponse);
      } else if (data.type === 'error') {
        console.error('\n   ✗ Claude error:', data.data);
        eventSource.close();
        reject(new Error(`Claude error: ${data.data}`));
      } else {
        console.log(`\n   Event: ${data.type}`);
      }
    };

    eventSource.onerror = (err) => {
      console.error('\n   ✗ Stream error:', err.message || err);
      eventSource.close();
      reject(new Error('Stream connection error'));
    };

    setTimeout(() => {
      console.error('\n   ✗ Timeout after 45s');
      eventSource.close();
      reject(new Error('Timeout'));
    }, 45000);
  });

  // 4. Send message (wait 100ms for stream to connect)
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('4. Sending message to Claude...');
  await httpRequest(`${BRIDGE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'Return only this exact JSON array with no markdown or explanation:\n[{"selector":"button","type":"style","value":{"background-color":"orange"},"enabled":true}]',
      files: []
    })
  });
  console.log('   ✓ Message sent');

  // 5. Wait for response
  console.log('\n5. Waiting for Claude response...');
  const responseText = await responsePromise;

  // 6. Parse response
  console.log('\n6. Parsing response...');
  let cleanedResponse = responseText.trim();
  if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  console.log('   Response preview:', cleanedResponse.substring(0, 200));

  const parsed = JSON.parse(cleanedResponse);
  console.log('   ✓ Parsed as JSON');
  console.log('   ✓ Array with', parsed.length, 'DOM changes');
  console.log('\n7. First DOM change:');
  console.log(JSON.stringify(parsed[0], null, 2));

  console.log('\n✅ All tests passed!');
  process.exit(0);
}

testBridge().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
