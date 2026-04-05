import { migrate } from './db'

let migrated = false

export async function ensureMigrated() {
  if (!migrated) {
    await migrate()
    migrated = true
  }
}
