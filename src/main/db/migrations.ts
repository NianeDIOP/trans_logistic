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
  },
  {
    version: 2,
    description: 'Tables de paramétrage (prestations, listes) et désactivation',
    up: (db) => {
      db.exec(`
        -- Référentiels paramétrables
        CREATE TABLE prestations (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          libelle    TEXT NOT NULL,
          prix       INTEGER NOT NULL DEFAULT 0,
          soumis_tva INTEGER NOT NULL DEFAULT 0 CHECK (soumis_tva IN (0, 1)),
          actif      INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
          ordre      INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE types_conteneurs (
          id      INTEGER PRIMARY KEY AUTOINCREMENT,
          code    TEXT NOT NULL UNIQUE,
          libelle TEXT NOT NULL,
          actif   INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
          ordre   INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE natures (
          id      INTEGER PRIMARY KEY AUTOINCREMENT,
          code    TEXT NOT NULL UNIQUE,
          libelle TEXT NOT NULL,
          actif   INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
          ordre   INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE modes_paiement (
          id      INTEGER PRIMARY KEY AUTOINCREMENT,
          code    TEXT NOT NULL UNIQUE,
          libelle TEXT NOT NULL,
          actif   INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
          ordre   INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO prestations (libelle, prix, soumis_tva, ordre) VALUES
          ('AGS aller simple', 1500, 0, 1),
          ('Imprimé', 1000, 0, 2);

        INSERT INTO types_conteneurs (code, libelle, ordre) VALUES
          ('20', '20''', 1),
          ('40', '40''', 2);

        INSERT INTO natures (code, libelle, ordre) VALUES
          ('import', 'Import', 1),
          ('export', 'Export', 2);

        INSERT INTO modes_paiement (code, libelle, ordre) VALUES
          ('especes', 'Espèces', 1),
          ('cheque', 'Chèque', 2),
          ('virement', 'Virement', 3),
          ('wave', 'Wave', 4),
          ('orange_money', 'Orange Money', 5);

        -- Désactivation au lieu de suppression
        ALTER TABLE clients ADD COLUMN actif INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1));

        -- Mentions de bas de facture
        ALTER TABLE entreprise ADD COLUMN mentions TEXT NOT NULL DEFAULT '';

        -- Les types, natures et modes deviennent paramétrables : on retire les listes figées (CHECK)
        -- en reconstruisant les tables concernées (aucune autre table ne les référence).
        CREATE TABLE zones_tarifs_v2 (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          zone           TEXT NOT NULL,
          type_conteneur TEXT NOT NULL,
          prix           INTEGER NOT NULL,
          actif          INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
          UNIQUE (zone, type_conteneur)
        );
        INSERT INTO zones_tarifs_v2 (id, zone, type_conteneur, prix)
          SELECT id, zone, type_conteneur, prix FROM zones_tarifs;
        DROP TABLE zones_tarifs;
        ALTER TABLE zones_tarifs_v2 RENAME TO zones_tarifs;

        CREATE TABLE lignes_v2 (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          facture_id     INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
          ordre          INTEGER NOT NULL DEFAULT 0,
          num_conteneur  TEXT NOT NULL DEFAULT '',
          type_conteneur TEXT,
          zone           TEXT NOT NULL DEFAULT '',
          nature         TEXT,
          designation    TEXT NOT NULL DEFAULT '',
          montant_ht     INTEGER NOT NULL DEFAULT 0,
          soumis_tva     INTEGER NOT NULL DEFAULT 1 CHECK (soumis_tva IN (0, 1))
        );
        INSERT INTO lignes_v2 SELECT * FROM lignes;
        DROP TABLE lignes;
        ALTER TABLE lignes_v2 RENAME TO lignes;
        CREATE INDEX idx_lignes_facture ON lignes(facture_id);

        CREATE TABLE paiements_v2 (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          facture_id INTEGER NOT NULL REFERENCES factures(id),
          date       TEXT NOT NULL,
          montant    INTEGER NOT NULL,
          mode       TEXT NOT NULL,
          reference  TEXT NOT NULL DEFAULT ''
        );
        INSERT INTO paiements_v2 SELECT * FROM paiements;
        DROP TABLE paiements;
        ALTER TABLE paiements_v2 RENAME TO paiements;
        CREATE INDEX idx_paiements_facture ON paiements(facture_id);

        -- Exemple de tarif du cahier des charges (modifiable)
        INSERT OR IGNORE INTO zones_tarifs (zone, type_conteneur, prix) VALUES ('Dakar Zone 1', '20', 70000);
      `)
    }
  },
  {
    version: 3,
    description: 'Instantanés de facture (client, taux, libellés) et chemin du PDF',
    up: (db) => {
      db.exec(`
        -- Une facture garde les valeurs du moment où elle a été établie.
        ALTER TABLE factures ADD COLUMN taux_tva INTEGER NOT NULL DEFAULT 18;
        ALTER TABLE factures ADD COLUMN client_raison_sociale TEXT NOT NULL DEFAULT '';
        ALTER TABLE factures ADD COLUMN client_adresse TEXT NOT NULL DEFAULT '';
        ALTER TABLE factures ADD COLUMN client_ninea TEXT NOT NULL DEFAULT '';
        ALTER TABLE factures ADD COLUMN client_tel TEXT NOT NULL DEFAULT '';
        ALTER TABLE factures ADD COLUMN client_email TEXT NOT NULL DEFAULT '';
        -- PDF archivé à la validation (dossier de l'application).
        ALTER TABLE factures ADD COLUMN pdf_path TEXT;

        ALTER TABLE lignes ADD COLUMN type_libelle TEXT NOT NULL DEFAULT '';
        ALTER TABLE lignes ADD COLUMN nature_libelle TEXT NOT NULL DEFAULT '';
        ALTER TABLE lignes ADD COLUMN prestation_id INTEGER;

        UPDATE factures SET taux_tva = (SELECT taux_tva FROM entreprise WHERE id = 1);
      `)
    }
  },
  {
    version: 4,
    description: 'Prestations facturées par conteneur (AGS) et ajoutées automatiquement',
    up: (db) => {
      db.exec(`
        -- par_conteneur : montant = prix unitaire × nombre de conteneurs de la facture.
        ALTER TABLE prestations ADD COLUMN par_conteneur INTEGER NOT NULL DEFAULT 0 CHECK (par_conteneur IN (0, 1));
        -- automatique : ajoutée d'office à chaque nouvelle facture.
        ALTER TABLE prestations ADD COLUMN automatique INTEGER NOT NULL DEFAULT 0 CHECK (automatique IN (0, 1));
        UPDATE prestations SET par_conteneur = 1, automatique = 1 WHERE libelle = 'AGS aller simple';

        -- Quantité de la ligne (nombre de conteneurs pour une prestation par conteneur).
        ALTER TABLE lignes ADD COLUMN quantite INTEGER NOT NULL DEFAULT 1;
      `)
    }
  },
  {
    version: 5,
    description: 'Modèle (mise en page) et thème de couleurs des factures',
    up: (db) => {
      db.exec(`
        ALTER TABLE entreprise ADD COLUMN modele_facture TEXT NOT NULL DEFAULT 'classique';
        ALTER TABLE entreprise ADD COLUMN theme_facture TEXT NOT NULL DEFAULT 'marque';
      `)
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
