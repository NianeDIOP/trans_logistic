import { join } from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'

export const DB_FILENAME = 'trans_logistic.db'

let db: Database.Database | null = null
let schemaVersion = 0

/** Ouvre (ou crée) la base dans le dossier userData et applique les migrations. */
export function openDatabase(): Database.Database {
  if (db) return db
  const file = join(app.getPath('userData'), DB_FILENAME)
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  schemaVersion = runMigrations(db)
  return db
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error("La base de données n'est pas ouverte")
  return db
}

export function getSchemaVersion(): number {
  return schemaVersion
}

export function closeDatabase(): void {
  db?.close()
  db = null
}
