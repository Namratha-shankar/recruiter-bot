const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH=:memory: is used by the tests.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'recruiter-bot.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables on startup (all statements are IF NOT EXISTS, so this is safe to repeat).
db.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));

module.exports = db;
