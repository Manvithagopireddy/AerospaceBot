'use strict';
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new Database(dbPath);

console.log('🚀 Connected to the SQLite database at:', dbPath);

// Enable foreign key support
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  )
`);

// ── Promise-compatible wrappers (same API as before) ─────────────────────────
// better-sqlite3 is synchronous; we wrap in Promises to keep server.js intact.

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const info = stmt.run(params);
      resolve({ id: info.lastInsertRowid, changes: info.changes });
    } catch (err) {
      reject(err);
    }
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      resolve(stmt.all(params));
    } catch (err) {
      reject(err);
    }
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      resolve(stmt.get(params));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { db, run, all, get };
