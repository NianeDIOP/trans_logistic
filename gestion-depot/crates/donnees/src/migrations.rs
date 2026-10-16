//! Schéma de la base SQLite et migrations versionnées (table `schema_version`).
//! Une migration publiée n'est jamais modifiée : toute évolution passe par une nouvelle version.

use noyau::catalogue::PRODUITS_INITIAUX;
use rusqlite::{Connection, params};

const MIGRATION_1: &str = r#"
CREATE TABLE parametres (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);

CREATE TABLE identite (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  nom_commercial  TEXT NOT NULL DEFAULT 'Ma boutique',
  slogan          TEXT NOT NULL DEFAULT '',
  adresse         TEXT NOT NULL DEFAULT '',
  telephones      TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  ninea           TEXT NOT NULL DEFAULT '',
  rc              TEXT NOT NULL DEFAULT '',
  logo_path       TEXT
);

CREATE TABLE presentation (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  modele_document   TEXT NOT NULL DEFAULT 'classique',
  theme_document    TEXT NOT NULL DEFAULT 'emeraude',
  theme_interface   TEXT NOT NULL DEFAULT 'emeraude',
  mode_sombre       INTEGER NOT NULL DEFAULT 0 CHECK (mode_sombre IN (0, 1)),
  grand_texte       INTEGER NOT NULL DEFAULT 0 CHECK (grand_texte IN (0, 1)),
  entete_logo       TEXT NOT NULL DEFAULT 'gauche' CHECK (entete_logo IN ('gauche', 'centre', 'droite', 'aucun')),
  entete_elements   TEXT NOT NULL DEFAULT 'nom,slogan,coordonnees',
  pied_page         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE conditionnements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  singulier    TEXT NOT NULL UNIQUE,
  pluriel      TEXT NOT NULL,
  abreviation  TEXT NOT NULL,
  par_defaut   INTEGER NOT NULL DEFAULT 0 CHECK (par_defaut IN (0, 1)),
  actif        INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1))
);

CREATE TABLE produits (
  id                           INTEGER PRIMARY KEY AUTOINCREMENT,
  nom                          TEXT NOT NULL,
  contenance                   TEXT NOT NULL DEFAULT '',
  categorie                    TEXT NOT NULL DEFAULT 'autre',
  conditionnement_id           INTEGER REFERENCES conditionnements(id),
  bt_par_conditionnement       INTEGER NOT NULL CHECK (bt_par_conditionnement > 0),
  format_a_confirmer           INTEGER NOT NULL DEFAULT 0 CHECK (format_a_confirmer IN (0, 1)),
  seuil_depot_conditionnements INTEGER NOT NULL DEFAULT 0 CHECK (seuil_depot_conditionnements >= 0),
  seuil_boutique_bt            INTEGER NOT NULL DEFAULT 0 CHECK (seuil_boutique_bt >= 0),
  ordre                        INTEGER NOT NULL DEFAULT 0,
  actif                        INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
  UNIQUE (nom, contenance)
);

CREATE TABLE prix (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  produit_id                  INTEGER NOT NULL REFERENCES produits(id),
  prix_vente                  INTEGER NOT NULL CHECK (prix_vente >= 0),
  prix_achat_conditionnement  INTEGER CHECK (prix_achat_conditionnement >= 0),
  date_debut                  TEXT NOT NULL,
  UNIQUE (produit_id, date_debut)
);

CREATE TABLE fournisseurs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nom        TEXT NOT NULL UNIQUE,
  telephone  TEXT NOT NULL DEFAULT '',
  actif      INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1))
);

CREATE TABLE receptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  fournisseur_id  INTEGER REFERENCES fournisseurs(id),
  num_bl          TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  cree_le         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lignes_reception (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  reception_id                INTEGER NOT NULL REFERENCES receptions(id) ON DELETE CASCADE,
  produit_id                  INTEGER NOT NULL REFERENCES produits(id),
  bouteilles                  INTEGER NOT NULL CHECK (bouteilles > 0),
  prix_achat_conditionnement  INTEGER
);

CREATE TABLE journees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL UNIQUE,
  statut          TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'validee')),
  total_ventes    INTEGER NOT NULL DEFAULT 0,
  total_recu      INTEGER NOT NULL DEFAULT 0,
  total_depenses  INTEGER NOT NULL DEFAULT 0,
  ecart           INTEGER NOT NULL DEFAULT 0,
  observations    TEXT NOT NULL DEFAULT '',
  valide_le       TEXT
);
CREATE TABLE lignes_journee (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  journee_id           INTEGER NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
  produit_id           INTEGER NOT NULL REFERENCES produits(id),
  stock_initial        INTEGER NOT NULL,
  stock_initial_fiche  INTEGER,
  alimentation         INTEGER NOT NULL DEFAULT 0,
  stock_total          INTEGER NOT NULL,
  stock_restant        INTEGER NOT NULL,
  casse                INTEGER NOT NULL DEFAULT 0,
  ventes               INTEGER NOT NULL,
  ventes_fiche         INTEGER,
  prix                 INTEGER NOT NULL,
  prix_fiche           INTEGER,
  montant              INTEGER NOT NULL,
  montant_fiche        INTEGER,
  UNIQUE (journee_id, produit_id)
);
CREATE TABLE depenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  journee_id  INTEGER NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
  libelle     TEXT NOT NULL,
  montant     INTEGER NOT NULL CHECK (montant >= 0)
);

CREATE TABLE alimentations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  journee_id  INTEGER REFERENCES journees(id),
  notes       TEXT NOT NULL DEFAULT '',
  cree_le     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lignes_alimentation (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  alimentation_id  INTEGER NOT NULL REFERENCES alimentations(id) ON DELETE CASCADE,
  produit_id       INTEGER NOT NULL REFERENCES produits(id),
  bouteilles       INTEGER NOT NULL CHECK (bouteilles > 0)
);

CREATE TABLE inventaires (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  date    TEXT NOT NULL,
  lieu    TEXT NOT NULL CHECK (lieu IN ('depot', 'boutique')),
  notes   TEXT NOT NULL DEFAULT ''
);
CREATE TABLE lignes_inventaire (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  inventaire_id  INTEGER NOT NULL REFERENCES inventaires(id) ON DELETE CASCADE,
  produit_id     INTEGER NOT NULL REFERENCES produits(id),
  theorique      INTEGER NOT NULL,
  compte         INTEGER NOT NULL CHECK (compte >= 0),
  ecart          INTEGER NOT NULL
);

-- Journal unique des stocks : le stock d'un lieu est la somme de ses mouvements.
CREATE TABLE mouvements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  produit_id      INTEGER NOT NULL REFERENCES produits(id),
  lieu            TEXT NOT NULL CHECK (lieu IN ('depot', 'boutique')),
  quantite        INTEGER NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('ouverture', 'reception', 'alimentation', 'vente', 'casse', 'inventaire', 'correction')),
  reference_type  TEXT NOT NULL DEFAULT '',
  reference_id    INTEGER,
  motif           TEXT NOT NULL DEFAULT '',
  cree_le         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mouvements_produit ON mouvements(produit_id, lieu, date);

CREATE TABLE journal (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  date    TEXT NOT NULL DEFAULT (datetime('now')),
  objet   TEXT NOT NULL,
  avant   TEXT NOT NULL DEFAULT '',
  apres   TEXT NOT NULL DEFAULT '',
  motif   TEXT NOT NULL DEFAULT ''
);

INSERT INTO identite (id) VALUES (1);
INSERT INTO presentation (id) VALUES (1);
INSERT INTO conditionnements (singulier, pluriel, abreviation, par_defaut) VALUES
  ('caisse', 'caisses', 'cs', 1),
  ('carton', 'cartons', 'ct', 0),
  ('pack', 'packs', 'pk', 0),
  ('casier', 'casiers', 'csr', 0);
"#;

/// Migrations dans l'ordre : (version, script). Le catalogue est inséré par `semer_catalogue`.
const MIGRATIONS: &[(i64, &str)] = &[(1, MIGRATION_1)];

/// Format provisoire des produits du catalogue initial, à confirmer dans les Paramètres.
pub const FORMAT_PROVISOIRE: i64 = 12;

/// Version de schéma attendue par ce logiciel.
pub fn version_cible() -> i64 {
    MIGRATIONS.last().map_or(0, |m| m.0)
}

pub fn version(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |r| r.get(0),
    )
}

/// Applique les migrations manquantes, chacune dans sa transaction.
pub fn migrer(conn: &mut Connection) -> rusqlite::Result<i64> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, appliquee_le TEXT NOT NULL DEFAULT (datetime('now')))")?;
    let actuelle = version(conn)?;
    for (v, script) in MIGRATIONS.iter().filter(|(v, _)| *v > actuelle) {
        let tx = conn.transaction()?;
        tx.execute_batch(script)?;
        if *v == 1 {
            semer_catalogue(&tx)?;
        }
        tx.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            params![v],
        )?;
        tx.commit()?;
    }
    version(conn)
}

fn semer_catalogue(conn: &Connection) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(
        "INSERT INTO produits (nom, contenance, categorie, bt_par_conditionnement, format_a_confirmer, ordre) VALUES (?1, ?2, ?3, ?4, 1, ?5)",
    )?;
    for (i, p) in PRODUITS_INITIAUX.iter().enumerate() {
        stmt.execute(params![
            p.nom,
            p.contenance,
            p.categorie,
            FORMAT_PROVISOIRE,
            (i + 1) as i64
        ])?;
    }
    Ok(())
}
