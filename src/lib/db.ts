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
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      stop_name TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journey_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_label TEXT NOT NULL,
      to_label TEXT NOT NULL,
      used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}
