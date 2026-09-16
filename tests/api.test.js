/**
 * AerospaceBot — API Integration Tests
 * Uses Node.js built-in test runner (node:test) and native global fetch.
 * Zero external test dependencies required.
 */
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/server');
const db = require('../server/db');

let server;
let baseUrl;

// ── Lifecycle: start ephemeral server before all tests ───────────────────────
before(() => new Promise((resolve, reject) => {
  server = app.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
  server.on('error', reject);
}));

// ── Lifecycle: close server after all tests ───────────────────────────────────
after(() => new Promise((resolve) => {
  if (server && server.listening) {
    server.close(resolve);
  } else {
    resolve();
  }
}));

// ── Helper ────────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 1 — Health & Configuration
// ═══════════════════════════════════════════════════════════════════════════════
describe('Health & Configuration Endpoints', () => {

  test('GET /api/health → 200 with correct schema', async () => {
    const { status, body } = await api('/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.hasServerKey, 'boolean');
    assert.ok(body.timestamp, 'timestamp should be present');
  });

  test('GET /api/config → 200 with models array', async () => {
    const { status, body } = await api('/api/config');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.models), 'models must be an array');
    assert.ok(body.models.includes('gemini-2.5-flash'));
    assert.ok(body.models.length >= 3, 'at least 3 fallback models expected');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 2 — SQLite Database Integrity
// ═══════════════════════════════════════════════════════════════════════════════
describe('SQLite Database Integrity & Cascading', () => {

  const sessionId = `ci-test-${Date.now()}`;

  test('can create a session and insert a message', async () => {
    await db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [sessionId, 'CI Test Session']);

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    assert.ok(session, 'session should exist');
    assert.equal(session.title, 'CI Test Session');

    await db.run(
      'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
      [sessionId, 'user', 'Test message from CI']
    );

    const messages = await db.all('SELECT * FROM messages WHERE session_id = ?', [sessionId]);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, 'Test message from CI');
  });

  test('cascade deletes messages when session is deleted', async () => {
    await db.run('PRAGMA foreign_keys = ON');
    await db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    assert.equal(session, undefined, 'session should be deleted');

    const messages = await db.all('SELECT * FROM messages WHERE session_id = ?', [sessionId]);
    assert.equal(messages.length, 0, 'messages should be cascade deleted');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 3 — REST API Route Contracts
// ═══════════════════════════════════════════════════════════════════════════════
describe('REST API Route Contracts', () => {

  test('GET /api/sessions → 200 returns array', async () => {
    const { status, body } = await api('/api/sessions');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  test('POST /api/chat with no body → 400 invalid messages format', async () => {
    const { status, body } = await api('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'Invalid messages format');
  });

  test('POST /api/chat with non-array messages → 400', async () => {
    const { status } = await api('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: 'not-an-array' })
    });
    assert.equal(status, 400);
  });

  test('POST /api/chat with empty messages array and no key → error response', async () => {
    const { status, body } = await api('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [], apiKey: '' })
    });
    // Server returns 400 for validation errors (no key), 500 if key exists but Gemini rejects
    assert.ok(status === 400 || status === 500, `expected 400 or 500, got ${status}`);
    assert.ok(body.error, 'should return error message');
  });

  test('DELETE /api/sessions/:id removes session → 200', async () => {
    const tempId = `delete-test-${Date.now()}`;
    await db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [tempId, 'Temp Session']);

    const { status, body } = await api(`/api/sessions/${tempId}`, { method: 'DELETE' });
    assert.equal(status, 200);
    assert.equal(body.success, true);

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [tempId]);
    assert.equal(session, undefined, 'session should be gone from DB');
  });

  test('GET /api/sessions/:id returns messages for existing session', async () => {
    const tempId = `read-test-${Date.now()}`;
    await db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [tempId, 'Read Test']);
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [tempId, 'user', 'Hello']);
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [tempId, 'assistant', 'Hi!']);

    const { status, body } = await api(`/api/sessions/${tempId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 2);
    assert.equal(body[0].role, 'user');
    assert.equal(body[1].role, 'assistant');

    // Cleanup
    await db.run('DELETE FROM sessions WHERE id = ?', [tempId]);
  });

});
