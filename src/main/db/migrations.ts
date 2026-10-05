/**
 * Migrations du schéma SQLite.
 *
 * Ce module ne dépend ni d'Electron ni de better-sqlite3 : il fonctionne avec
 * toute base exposant `exec` et `prepare` (better-sqlite3 dans l'application,
 * `node:sqlite` dans les tests).
 *
 * Règle : ne jamais modifier une migration déjà livrée. Ajouter une nouvelle
 * entrée à la fin de `MIGRATIONS` avec la version suivante.
 */

export interface SqlStatement {
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): unknown
}

export interface SqlDatabase {
  exec(sql: string): unknown
  prepare(sql: string): SqlStatement
}

export interface Migration {
  version: number
  description: string
  up: (db: SqlDatabase) => void
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Schéma initial',
    up: (db) => {
      db.exec(`
        CREATE TABLE entreprise (
          id              INTEGER PRIMARY KEY CHECK (id = 1),
          raison_sociale  TEXT NOT NULL,
          rc              TEXT NOT NULL DEFAULT '',
          ninea           TEXT NOT NULL DEFAULT '',
          banque          TEXT NOT NULL DEFAULT '',
          iban            TEXT NOT NULL DEFAULT '',
          siege           TEXT NOT NULL DEFAULT '',
          adresse         TEXT NOT NULL DEFAULT '',
          email           TEXT NOT NULL DEFAULT '',
          tel             TEXT NOT NULL DEFAULT '',
          logo_path       TEXT,
          cachet_path     TEXT,
          -- Taux en pourcentage entier (18 = 18 %), pas de flottant.
          taux_tva        INTEGER NOT NULL DEFAULT 18,
          prefixe_facture TEXT NOT NULL DEFAULT '2M'
        );

        CREATE TABLE clients (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          raison_sociale TEXT NOT NULL,
          adresse        TEXT NOT NULL DEFAULT '',
          ninea          TEXT NOT NULL DEFAULT '',
          tel            TEXT NOT NULL DEFAULT '',
          email          TEXT NOT NULL DEFAULT '',
          cree_le        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE factures (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          numero             TEXT UNIQUE,
          type               TEXT NOT NULL DEFAULT 'facture' CHECK (type IN ('facture', 'avoir')),
          facture_origine_id INTEGER REFERENCES factures(id),
          date               TEXT NOT NULL,
          client_id          INTEGER NOT NULL REFERENCES clients(id),
          num_bl             TEXT NOT NULL DEFAULT '',
          statut             TEXT NOT NULL DEFAULT 'brouillon'
                             CHECK (statut IN ('brouillon', 'emise', 'payee', 'partiellement_payee', 'annulee')),
          total_ht           INTEGER NOT NULL DEFAULT 0,
          base_tva           INTEGER NOT NULL DEFAULT 0,
          total_tva          INTEGER NOT NULL DEFAULT 0,
          total_ttc          INTEGER NOT NULL DEFAULT 0,
          notes              TEXT NOT NULL DEFAULT '',
          cree_le            TEXT NOT NULL DEFAULT (datetime('now')),
          valide_le          TEXT
        );
        CREATE INDEX idx_factures_client ON factures(client_id);
        CREATE INDEX idx_factures_date ON factures(date);

        CREATE TABLE lignes (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          facture_id     INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
          ordre          INTEGER NOT NULL DEFAULT 0,
          num_conteneur  TEXT NOT NULL DEFAULT '',
          type_conteneur TEXT CHECK (type_conteneur IN ('20', '40')),
          zone           TEXT NOT NULL DEFAULT '',
          nature         TEXT CHECK (nature IN ('import', 'export')),
          designation    TEXT NOT NULL DEFAULT '',
          montant_ht     INTEGER NOT NULL DEFAULT 0,
          soumis_tva     INTEGER NOT NULL DEFAULT 1 CHECK (soumis_tva IN (0, 1))
        );
        CREATE INDEX idx_lignes_facture ON lignes(facture_id);

        CREATE TABLE zones_tarifs (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          zone           TEXT NOT NULL,
          type_conteneur TEXT NOT NULL CHECK (type_conteneur IN ('20', '40')),
          prix           INTEGER NOT NULL,
          UNIQUE (zone, type_conteneur)
        );

        CREATE TABLE paiements (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          facture_id INTEGER NOT NULL REFERENCES factures(id),
          date       TEXT NOT NULL,
          montant    INTEGER NOT NULL,
          mode       TEXT NOT NULL CHECK (mode IN ('especes', 'cheque', 'virement', 'wave', 'orange_money')),
          reference  TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_paiements_facture ON paiements(facture_id);
      `)

      db.prepare(
        `INSERT INTO entreprise
           (id, raison_sociale, rc, ninea, banque, iban, siege, adresse, email, tel, taux_tva, prefixe_facture)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        '2M LOGISTIQUE ET TRANSPORT',
        'SNLGA 2021-B991',
        '008740947 2H2',
        'BICIS Louga',
        'SN10 07534 007766000006 09',
        'Dakar',
        'Quartier Thiokhna, Louga',
        '2mlogistiquetransport25@gmail.com',
        '(+221) 77 533 65 33',
        18,
        '2M'
      )
    }
  }
]

/** Version actuelle du schéma (0 si la base est vierge). */
export function getSchemaVersion(db: SqlDatabase): number {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as
    | { version: number | null }
    | undefined
  return row?.version ?? 0
}

/**
 * Applique, dans l'ordre et chacune dans sa transaction, les migrations
 * dont la version est supérieure à la version actuelle.
 * Retourne la version finale du schéma.
 */
export function runMigrations(db: SqlDatabase, migrations: Migration[] = MIGRATIONS): number {
  let current = getSchemaVersion(db)
  const pending = [...migrations]
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    db.exec('BEGIN')
    try {
      migration.up(db)
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw new Error(
        `Échec de la migration ${migration.version} (${migration.description}) : ${(err as Error).message}`
      )
    }
    current = migration.version
  }
  return current
}
