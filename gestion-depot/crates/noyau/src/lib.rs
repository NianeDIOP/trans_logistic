//! Règles de gestion de l'application « Gestion Dépôt et Boutique ».
//!
//! Bibliothèque pure, sans base de données ni interface : conversions caisses / bouteilles,
//! calculs de la fiche journalière, contrôles et caisse. Les références `RG-xx` renvoient au
//! cahier des charges (`docs/cahier-des-charges-v1.1.pdf`).
//!
//! Conventions : toutes les quantités sont des nombres entiers de **bouteilles** (`i64`),
//! tous les montants des **francs CFA entiers** (`i64`).

pub mod caisse;
pub mod catalogue;
pub mod fiche;
pub mod montant;
pub mod presentation;
pub mod stock;

pub use caisse::{BilanCaisse, bilan_caisse};
pub use fiche::{Alerte, Gravite, LigneCalculee, SaisieLigne, calculer_ligne};
pub use montant::format_fcfa;
pub use stock::{Conditionnement, Format, quantite_lisible};
