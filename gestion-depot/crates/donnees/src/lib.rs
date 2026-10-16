//! Accès à la base SQLite de « Gestion Dépôt et Boutique ».
//!
//! Le stock n'est jamais stocké en dur : il est la somme des `mouvements` (ouverture, réception,
//! alimentation, vente, casse, inventaire). Chaque opération qui modifie le stock est écrite dans
//! une transaction (tout ou rien).

pub mod consultations;
pub mod migrations;
mod operations;
pub mod parametres;

pub use consultations::*;
pub use operations::*;
pub use parametres::*;

use rusqlite::Connection;
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum Erreur {
    #[error("erreur de base de données : {0}")]
    Sql(#[from] rusqlite::Error),
    /// Saisie refusée par une règle de gestion ; le message est destiné à l'utilisateur.
    #[error("{0}")]
    Refus(String),
    /// Journée non validable : lignes portant une alerte bloquante.
    #[error("la journée contient {} ligne(s) à corriger", .0.len())]
    LignesBloquantes(Vec<(i64, Vec<noyau::Alerte>)>),
}

pub type Resultat<T> = Result<T, Erreur>;

pub(crate) fn refus<T>(message: impl Into<String>) -> Resultat<T> {
    Err(Erreur::Refus(message.into()))
}

/// Base ouverte, clés étrangères actives, migrations appliquées.
pub struct Base {
    pub(crate) conn: Connection,
}

impl Base {
    pub fn ouvrir(chemin: impl AsRef<Path>) -> Resultat<Self> {
        Self::preparer(Connection::open(chemin)?)
    }

    pub fn en_memoire() -> Resultat<Self> {
        Self::preparer(Connection::open_in_memory()?)
    }

    fn preparer(mut conn: Connection) -> Resultat<Self> {
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        migrations::migrer(&mut conn)?;
        Ok(Self { conn })
    }

    pub fn version_schema(&self) -> Resultat<i64> {
        Ok(migrations::version(&self.conn)?)
    }

    /// Accès direct en lecture (rapports, tests).
    pub fn connexion(&self) -> &Connection {
        &self.conn
    }
}
