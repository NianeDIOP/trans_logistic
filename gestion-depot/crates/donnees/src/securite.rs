//! Sécurité et sauvegarde (chapitre 12) : mot de passe à l'ouverture (ET-10), sauvegarde automatique
//! (ET-11), sauvegarde manuelle et restauration (ET-12), fichier unique pour changer d'ordinateur (ET-13).
//!
//! Une sauvegarde est une copie cohérente de la base (`VACUUM INTO`) à laquelle on joint les images
//! (logo) dans une table `fichiers_joints` : un seul fichier suffit pour tout retrouver.

use crate::{Base, Erreur, Resultat, migrations, refus};
use argon2::Argon2;
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rusqlite::{Connection, OpenFlags, OptionalExtension, params};
use std::path::{Path, PathBuf};

const CLE_MOT_DE_PASSE: &str = "mot_de_passe";
const CLE_SAUVEGARDE_EXTERNE: &str = "derniere_sauvegarde_externe";
/// Nom du fichier qui, posé dans le dossier des données, retire le mot de passe au démarrage (ET-10).
pub const FICHIER_REINITIALISATION: &str = "REINITIALISER-MOT-DE-PASSE.txt";
/// Copies automatiques conservées (ET-11).
pub const COPIES_AUTOMATIQUES: usize = 30;
/// Extension des fichiers de sauvegarde.
pub const EXTENSION: &str = "gdsauv";

/// Informations lues dans un fichier de sauvegarde avant restauration.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct InfosSauvegarde {
    pub nom_boutique: String,
    pub version_schema: i64,
    pub nb_produits: i64,
    pub derniere_journee: Option<String>,
    pub nb_journees: i64,
}

/// Copie présente dans le dossier des sauvegardes automatiques.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct CopieSauvegarde {
    pub nom: String,
    pub chemin: String,
    pub octets: u64,
}

impl Base {
    fn parametre(&self, cle: &str) -> Resultat<Option<String>> {
        Ok(self
            .conn
            .query_row(
                "SELECT valeur FROM parametres WHERE cle = ?1",
                params![cle],
                |r| r.get(0),
            )
            .optional()?)
    }

    fn definir_parametre(&self, cle: &str, valeur: Option<&str>) -> Resultat<()> {
        match valeur {
            Some(v) => self.conn.execute(
                "INSERT INTO parametres (cle, valeur) VALUES (?1, ?2)
                 ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur",
                params![cle, v],
            )?,
            None => self
                .conn
                .execute("DELETE FROM parametres WHERE cle = ?1", params![cle])?,
        };
        Ok(())
    }

    fn journaliser(&self, objet: &str, motif: &str) -> Resultat<()> {
        self.conn.execute(
            "INSERT INTO journal (objet, motif) VALUES (?1, ?2)",
            params![objet, motif],
        )?;
        Ok(())
    }

    /// Date du jour (heure locale de l'ordinateur), AAAA-MM-JJ.
    pub fn date_du_jour(&self) -> Resultat<String> {
        Ok(self
            .conn
            .query_row("SELECT date('now', 'localtime')", [], |r| r.get(0))?)
    }

    // ------------------------------------------------------------- Mot de passe (ET-10)

    pub fn mot_de_passe_defini(&self) -> Resultat<bool> {
        Ok(self.parametre(CLE_MOT_DE_PASSE)?.is_some())
    }

    /// Vrai si aucun mot de passe n'est défini ou si `essai` est le bon.
    pub fn verifier_mot_de_passe(&self, essai: &str) -> Resultat<bool> {
        let Some(empreinte) = self.parametre(CLE_MOT_DE_PASSE)? else {
            return Ok(true);
        };
        let empreinte = PasswordHash::new(&empreinte)
            .map_err(|_| Erreur::Refus("Mot de passe enregistré illisible.".into()))?;
        Ok(Argon2::default()
            .verify_password(essai.as_bytes(), &empreinte)
            .is_ok())
    }

    /// Définit, change (`nouveau = Some`) ou retire (`None`) le mot de passe ; l'actuel est exigé s'il existe.
    pub fn changer_mot_de_passe(&self, actuel: &str, nouveau: Option<&str>) -> Resultat<()> {
        if !self.verifier_mot_de_passe(actuel)? {
            return refus("Le mot de passe actuel est incorrect.");
        }
        match nouveau {
            Some(n) => {
                if n.chars().count() < 4 {
                    return refus("Le mot de passe doit contenir au moins 4 caractères.");
                }
                let sel = SaltString::generate(&mut OsRng);
                let empreinte = Argon2::default()
                    .hash_password(n.as_bytes(), &sel)
                    .map_err(|_| Erreur::Refus("Le mot de passe n’a pas pu être chiffré.".into()))?
                    .to_string();
                self.definir_parametre(CLE_MOT_DE_PASSE, Some(&empreinte))?;
                self.journaliser("Mot de passe", "Mot de passe défini ou changé")
            }
            None => {
                self.definir_parametre(CLE_MOT_DE_PASSE, None)?;
                self.journaliser("Mot de passe", "Mot de passe retiré")
            }
        }
    }

    /// Procédure d'oubli (ET-10) : si le fichier de réinitialisation est présent dans `dossier`, le mot de
    /// passe est retiré et le fichier supprimé. Aucune donnée n'est touchée. Renvoie vrai si c'est fait.
    pub fn reinitialisation_demandee(&self, dossier: &Path) -> Resultat<bool> {
        let fichier = std::fs::read_dir(dossier)
            .ok()
            .into_iter()
            .flatten()
            .flatten()
            .map(|e| e.path())
            .find(|p| {
                p.file_name().and_then(|n| n.to_str()).is_some_and(|n| {
                    n.eq_ignore_ascii_case(FICHIER_REINITIALISATION)
                        || n.eq_ignore_ascii_case("REINITIALISER-MOT-DE-PASSE")
                })
            });
        let Some(fichier) = fichier else {
            return Ok(false);
        };
        self.definir_parametre(CLE_MOT_DE_PASSE, None)?;
        self.journaliser(
            "Mot de passe",
            "Mot de passe retiré par le fichier de réinitialisation",
        )?;
        let _ = std::fs::remove_file(fichier);
        Ok(true)
    }

    // ------------------------------------------------------------- Sauvegardes

    /// Copie complète et cohérente de la base vers `cible`, avec les images de `images` (logo).
    pub fn sauvegarder(&self, cible: &Path, images: &Path) -> Resultat<()> {
        if cible.exists() {
            std::fs::remove_file(cible).map_err(|e| {
                Erreur::Refus(format!(
                    "Le fichier existant ne peut pas être remplacé : {e}"
                ))
            })?;
        }
        self.conn
            .execute("VACUUM INTO ?1", params![cible.to_string_lossy()])?;
        let copie = Connection::open(cible)?;
        copie.execute_batch(
            "CREATE TABLE IF NOT EXISTS fichiers_joints (nom TEXT PRIMARY KEY, contenu BLOB NOT NULL)",
        )?;
        for entree in std::fs::read_dir(images).into_iter().flatten().flatten() {
            let chemin = entree.path();
            if chemin.is_file()
                && let (Some(nom), Ok(contenu)) = (
                    chemin.file_name().and_then(|n| n.to_str()),
                    std::fs::read(&chemin),
                )
            {
                copie.execute(
                    "INSERT OR REPLACE INTO fichiers_joints (nom, contenu) VALUES (?1, ?2)",
                    params![nom, contenu],
                )?;
            }
        }
        Ok(())
    }

    /// Sauvegarde vers un dossier choisi (clé USB…) : renvoie le chemin du fichier créé et note la date (ET-12).
    pub fn sauvegarder_dans(&self, dossier: &Path, images: &Path) -> Resultat<PathBuf> {
        if !dossier.is_dir() {
            return refus("Le dossier choisi n’existe pas.");
        }
        let horodatage: String = self.conn.query_row(
            "SELECT strftime('%Y-%m-%d_%Hh%M', 'now', 'localtime')",
            [],
            |r| r.get(0),
        )?;
        let cible = dossier.join(format!("Sauvegarde-GestionDepot-{horodatage}.{EXTENSION}"));
        self.sauvegarder(&cible, images)?;
        let jour = self.date_du_jour()?;
        self.definir_parametre(CLE_SAUVEGARDE_EXTERNE, Some(&jour))?;
        Ok(cible)
    }

    pub fn derniere_sauvegarde_externe(&self) -> Resultat<Option<String>> {
        self.parametre(CLE_SAUVEGARDE_EXTERNE)
    }

    /// Sauvegarde automatique (ET-11) : une copie par jour dans `dossier`, les 30 plus récentes conservées.
    /// Renvoie le chemin créé, ou `None` si la copie du jour existe déjà.
    pub fn sauvegarde_automatique(
        &self,
        dossier: &Path,
        images: &Path,
    ) -> Resultat<Option<PathBuf>> {
        std::fs::create_dir_all(dossier)
            .map_err(|e| Erreur::Refus(format!("Dossier des sauvegardes inaccessible : {e}")))?;
        let cible = dossier.join(format!("auto-{}.{EXTENSION}", self.date_du_jour()?));
        if cible.exists() {
            return Ok(None);
        }
        self.sauvegarder(&cible, images)?;
        let mut copies: Vec<_> = copies_automatiques(dossier)
            .into_iter()
            .filter(|c| c.nom.starts_with("auto-"))
            .map(|c| c.chemin)
            .collect();
        copies.sort();
        while copies.len() > COPIES_AUTOMATIQUES {
            let _ = std::fs::remove_file(copies.remove(0));
        }
        Ok(Some(cible))
    }
}

/// Copies automatiques présentes dans `dossier`, de la plus récente à la plus ancienne.
pub fn copies_automatiques(dossier: &Path) -> Vec<CopieSauvegarde> {
    let mut liste: Vec<CopieSauvegarde> = std::fs::read_dir(dossier)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let nom = e.file_name().to_str()?.to_string();
            (nom.starts_with("auto-") || nom.starts_with("avant-")).then(|| CopieSauvegarde {
                chemin: e.path().to_string_lossy().into_owned(),
                octets: e.metadata().map(|m| m.len()).unwrap_or(0),
                nom,
            })
        })
        .collect();
    liste.sort_by(|a, b| b.nom.cmp(&a.nom));
    liste
}

/// Vérifie qu'un fichier est une sauvegarde lisible et compatible (ET-12) sans le modifier.
pub fn verifier_sauvegarde(chemin: &Path) -> Resultat<InfosSauvegarde> {
    if !chemin.is_file() {
        return refus("Le fichier choisi n’existe pas.");
    }
    let illisible = || {
        Erreur::Refus("Ce fichier n’est pas une sauvegarde de Gestion Dépôt et Boutique.".into())
    };
    let conn = Connection::open_with_flags(chemin, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| illisible())?;
    let integrite: String = conn
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(|_| illisible())?;
    if integrite != "ok" {
        return refus("La sauvegarde est endommagée : restauration impossible.");
    }
    for table in [
        "schema_version",
        "identite",
        "produits",
        "mouvements",
        "journees",
    ] {
        let n: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            params![table],
            |r| r.get(0),
        )?;
        if n == 0 {
            return Err(illisible());
        }
    }
    let version = migrations::version(&conn)?;
    if version > migrations::version_cible() {
        return refus(
            "Cette sauvegarde vient d’une version plus récente du logiciel : mettez d’abord l’application à jour.",
        );
    }
    Ok(InfosSauvegarde {
        nom_boutique: conn.query_row(
            "SELECT nom_commercial FROM identite WHERE id = 1",
            [],
            |r| r.get(0),
        )?,
        version_schema: version,
        nb_produits: conn.query_row("SELECT COUNT(*) FROM produits", [], |r| r.get(0))?,
        derniere_journee: conn.query_row(
            "SELECT MAX(date) FROM journees WHERE statut = 'validee'",
            [],
            |r| r.get(0),
        )?,
        nb_journees: conn.query_row(
            "SELECT COUNT(*) FROM journees WHERE statut = 'validee'",
            [],
            |r| r.get(0),
        )?,
    })
}

/// Remplace la base `cible` par la sauvegarde `source` (vérifiée au préalable) et rétablit les images.
/// Aucune connexion ne doit être ouverte sur `cible`. Renvoie la base rouverte (migrations appliquées).
pub fn restaurer(source: &Path, cible: &Path, images: &Path) -> Resultat<Base> {
    verifier_sauvegarde(source)?;
    let temporaire = cible.with_extension("restauration");
    std::fs::copy(source, &temporaire)
        .map_err(|e| Erreur::Refus(format!("Copie de la sauvegarde impossible : {e}")))?;
    for suffixe in ["-wal", "-shm"] {
        let _ = std::fs::remove_file(PathBuf::from(format!("{}{suffixe}", cible.display())));
    }
    std::fs::rename(&temporaire, cible)
        .map_err(|e| Erreur::Refus(format!("Remplacement de la base impossible : {e}")))?;

    let base = Base::ouvrir(cible)?;
    let joints = base.conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'fichiers_joints'",
        [],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if joints {
        std::fs::create_dir_all(images)
            .map_err(|e| Erreur::Refus(format!("Dossier des images inaccessible : {e}")))?;
        let mut stmt = base
            .conn
            .prepare("SELECT nom, contenu FROM fichiers_joints")?;
        let fichiers = stmt
            .query_map([], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(stmt);
        for (nom, contenu) in fichiers {
            // Le nom vient d'un fichier : on n'en garde que la dernière composante.
            let Some(nom) = Path::new(&nom).file_name() else {
                continue;
            };
            let _ = std::fs::write(images.join(nom), contenu);
        }
        base.conn.execute_batch("DROP TABLE fichiers_joints")?;
    }
    // Le logo est désigné par un chemin absolu : on le fait pointer vers le dossier d'images de cet ordinateur.
    if let Some(logo) = base.identite()?.logo_path
        && let Some(nom) = Path::new(&logo.replace('\\', "/")).file_name()
    {
        let local = images.join(nom);
        base.definir_logo(
            local
                .exists()
                .then(|| local.to_string_lossy().into_owned())
                .as_deref(),
        )?;
    }
    base.journaliser(
        "Restauration",
        &format!("Base restaurée depuis {}", source.display()),
    )?;
    Ok(base)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{FicheSaisie, Lieu, LigneQuantite, ReceptionSaisie};

    fn dossier(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("gd-securite-{nom}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn mot_de_passe_defini_change_retire_et_reinitialise() {
        let d = dossier("mdp");
        let base = Base::en_memoire().unwrap();
        assert!(!base.mot_de_passe_defini().unwrap());
        assert!(base.verifier_mot_de_passe("n’importe").unwrap());
        assert!(
            base.changer_mot_de_passe("", Some("abc")).is_err(),
            "trop court"
        );
        base.changer_mot_de_passe("", Some("teranga")).unwrap();
        assert!(base.mot_de_passe_defini().unwrap());
        assert!(base.verifier_mot_de_passe("teranga").unwrap());
        assert!(!base.verifier_mot_de_passe("Teranga").unwrap());
        assert!(base.changer_mot_de_passe("faux", None).is_err());
        base.changer_mot_de_passe("teranga", Some("dakar2026"))
            .unwrap();
        assert!(base.verifier_mot_de_passe("dakar2026").unwrap());

        assert!(!base.reinitialisation_demandee(&d).unwrap());
        std::fs::write(d.join(FICHIER_REINITIALISATION), "").unwrap();
        assert!(base.reinitialisation_demandee(&d).unwrap());
        assert!(!base.mot_de_passe_defini().unwrap());
        assert!(!d.join(FICHIER_REINITIALISATION).exists());
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn sauvegarde_puis_restauration_sur_un_autre_ordinateur() {
        let d = dossier("restauration");
        let (images_a, images_b) = (d.join("images-a"), d.join("images-b"));
        std::fs::create_dir_all(&images_a).unwrap();
        std::fs::write(images_a.join("logo.png"), b"PNG-logo").unwrap();

        // Ordinateur A : une réception, un logo.
        let base_a = d.join("a.db");
        let mut a = Base::ouvrir(&base_a).unwrap();
        let h = a.produits(false).unwrap()[0].id;
        a.enregistrer_reception(&ReceptionSaisie {
            date: "2026-10-10".into(),
            lignes: vec![LigneQuantite {
                produit_id: h,
                conditionnements: 2,
                bouteilles: 0,
            }],
            ..Default::default()
        })
        .unwrap();
        a.definir_logo(Some(&images_a.join("logo.png").to_string_lossy()))
            .unwrap();
        let fichier = a.sauvegarder_dans(&d, &images_a).unwrap();
        assert!(a.derniere_sauvegarde_externe().unwrap().is_some());
        let infos = verifier_sauvegarde(&fichier).unwrap();
        assert_eq!(infos.nb_produits, 29);

        // Ordinateur B : base neuve remplacée par la sauvegarde.
        let base_b = d.join("b.db");
        drop(Base::ouvrir(&base_b).unwrap());
        let b = restaurer(&fichier, &base_b, &images_b).unwrap();
        assert_eq!(b.stock(h, Lieu::Depot, None).unwrap(), 24);
        assert_eq!(
            std::fs::read(images_b.join("logo.png")).unwrap(),
            b"PNG-logo"
        );
        assert_eq!(
            b.identite().unwrap().logo_path.unwrap(),
            images_b.join("logo.png").to_string_lossy()
        );
        drop(b);
        drop(a);
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn fichier_etranger_refuse_et_copies_automatiques() {
        let d = dossier("auto");
        std::fs::write(d.join("faux.gdsauv"), b"ceci n'est pas une base").unwrap();
        assert!(verifier_sauvegarde(&d.join("faux.gdsauv")).is_err());
        assert!(verifier_sauvegarde(&d.join("absent.gdsauv")).is_err());

        let mut base = Base::ouvrir(d.join("base.db")).unwrap();
        base.valider_journee(&FicheSaisie {
            date: "2026-10-10".into(),
            ..Default::default()
        })
        .unwrap();
        let copies = d.join("sauvegardes");
        for i in 0..32 {
            std::fs::create_dir_all(&copies).unwrap();
            std::fs::write(copies.join(format!("auto-2020-01-{i:02}.gdsauv")), b"x").unwrap();
        }
        assert!(base.sauvegarde_automatique(&copies, &d).unwrap().is_some());
        assert!(
            base.sauvegarde_automatique(&copies, &d).unwrap().is_none(),
            "une par jour"
        );
        let liste = copies_automatiques(&copies);
        assert_eq!(liste.len(), COPIES_AUTOMATIQUES);
        assert!(
            liste[0]
                .nom
                .starts_with(&format!("auto-{}", base.date_du_jour().unwrap()))
        );
        assert!(verifier_sauvegarde(Path::new(&liste[0].chemin)).is_ok());
        std::fs::remove_dir_all(d).unwrap();
    }
}
