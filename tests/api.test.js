const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server/server');
const db = require('../server/db');

let server;
let port;
let baseUrl;

before((_, done) => {
  // Start server on an ephemeral free port
  server = app.listen(0, () => {
    port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

after((_, done) => {
  server.close(done);
});

describe('1. Health & Configuration Endpoints', () => {
  test('GET /api/health returns status 200 and health payload', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.database, 'connected');
    assert.strictEqual(typeof data.uptime, 'number');
    assert.strictEqual(typeof data.hasServerKey, 'boolean');
  });

  test('GET /api/config returns available models', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.models));
    assert.ok(data.models.includes('gemini-2.5-flash'));
  });
});

describe('2. SQLite Database Integrity & Cascading', () => {
  const testSessionId = 'test-session-' + Date.now();

  test('can create session and insert messages', async () => {
    // Insert session
    await db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [testSessionId, 'Test Session Title']);
    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [testSessionId]);
    assert.ok(session);
    assert.strictEqual(session.title, 'Test Session Title');

    // Insert message
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [testSessionId, 'user', 'Hello Test']);
    const messages = await db.all('SELECT * FROM messages WHERE session_id = ?', [testSessionId]);
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].content, 'Hello Test');
  });

  test('cascades delete messages when session is deleted', async () => {
    // Enable foreign keys in sqlite
    await db.run('PRAGMA foreign_keys = ON');
    await db.run('DELETE FROM sessions WHERE id = ?', [testSessionId]);

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [testSessionId]);
    assert.strictEqual(session, undefined);
  });
});

describe('3. Chat & History API Routes', () => {
  test('GET /api/sessions returns an array of sessions', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  test('POST /api/chat rejects missing messages with 400', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid messages format');
  });

  test('POST /api/chat rejects non-array messages with 400', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: 'not-an-array' })
    });
    assert.strictEqual(res.status, 400);
  });

  test('DELETE /api/sessions/:id responds with success', async () => {
    const tempId = 'delete-test-' + Date.now();
    await db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [tempId, 'Temporary Title']);

    const res = await fetch(`${baseUrl}/api/sessions/${tempId}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });
});
