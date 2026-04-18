import { createClient } from '@libsql/client'

export const runtime = 'nodejs'

const globalForDb = globalThis as unknown as {
  _db?: ReturnType<typeof createClient>
}

function getDb() {
  if (!process.env.TURSO_URL) {
    throw new Error('TURSO_URL environment variable is not set')
  }
  return createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

export const db = globalForDb._db ?? getDb()

if (process.env.NODE_ENV !== 'production') {
  globalForDb._db = db
}

export async function migrate() {
  // Add columns to existing tables that may have been created without them
  for (const sql of [
    "ALTER TABLE journey_history ADD COLUMN from_id TEXT NOT NULL DEFAULT 'current'",
    "ALTER TABLE journey_history ADD COLUMN to_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE saved_destinations ADD COLUMN kind TEXT NOT NULL DEFAULT 'destination'",
    "ALTER TABLE saved_destinations ADD COLUMN from_label TEXT",
    "ALTER TABLE saved_destinations ADD COLUMN from_id TEXT",
    "ALTER TABLE saved_destinations ADD COLUMN direction TEXT",
    "ALTER TABLE saved_destinations ADD COLUMN routes TEXT",
    "ALTER TABLE saved_destinations ADD COLUMN color TEXT",
    "ALTER TABLE saved_destinations ADD COLUMN icon TEXT",
    "ALTER TABLE users ADD COLUMN home_layout TEXT",
  ]) {
    try { await db.execute(sql) } catch { /* column already exists */ }
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      home_layout TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'destination',
      label TEXT NOT NULL,
      stop_name TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      lat REAL,
      lng REAL,
      from_label TEXT,
      from_id TEXT,
      direction TEXT,
      routes TEXT,
      color TEXT,
      icon TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journey_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_label TEXT NOT NULL,
      from_id TEXT NOT NULL DEFAULT 'current',
      to_label TEXT NOT NULL,
      to_id TEXT NOT NULL DEFAULT '',
      used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}
