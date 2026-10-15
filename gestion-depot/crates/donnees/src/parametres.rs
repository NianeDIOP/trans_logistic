//! Paramètres : identité de la boutique, présentation (thèmes, en-têtes), conditionnements,
//! produits et historique des prix (EF-40 à EF-45, EF-50 à EF-55).

use crate::{Base, Erreur, Resultat, refus};
use noyau::catalogue::CATEGORIES;
use noyau::presentation::{ELEMENTS_ENTETE, POSITIONS_LOGO, modele, theme};
use rusqlite::{OptionalExtension, params};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Identite {
    pub nom_commercial: String,
    pub slogan: String,
    pub adresse: String,
    pub telephones: String,
    pub email: String,
    pub ninea: String,
    pub rc: String,
    pub logo_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Presentation {
    pub modele_document: String,
    pub theme_document: String,
    pub theme_interface: String,
    pub mode_sombre: bool,
    pub grand_texte: bool,
    pub entete_logo: String,
    pub entete_elements: Vec<String>,
    pub pied_page: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ConditionnementEnregistre {
    pub id: i64,
    pub singulier: String,
    pub pluriel: String,
    pub abreviation: String,
    pub par_defaut: bool,
    pub actif: bool,
    /// Nombre de produits qui l'utilisent explicitement.
    pub nb_produits: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ConditionnementSaisie {
    pub singulier: String,
    pub pluriel: String,
    pub abreviation: String,
}

/// Saisie d'un produit dans les Paramètres.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ProduitSaisie {
    pub nom: String,
    pub contenance: String,
    pub categorie: String,
    /// `None` : conditionnement par défaut.
    pub conditionnement_id: Option<i64>,
    pub bt_par_conditionnement: i64,
    pub seuil_depot_conditionnements: i64,
    pub seuil_boutique_bt: i64,
    pub actif: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct PrixDate {
    pub date_debut: String,
    pub prix_vente: i64,
    pub prix_achat_conditionnement: Option<i64>,
}

fn verifier_produit(s: &ProduitSaisie) -> Resultat<()> {
    if s.nom.trim().is_empty() {
        return refus("Le nom du produit est obligatoire.");
    }
    if s.bt_par_conditionnement <= 0 || s.bt_par_conditionnement > 1000 {
        return refus(
            "Le nombre de bouteilles par conditionnement doit être compris entre 1 et 1000.",
        );
    }
    if s.seuil_depot_conditionnements < 0 || s.seuil_boutique_bt < 0 {
        return refus("Les seuils d’alerte ne peuvent pas être négatifs.");
    }
    if !CATEGORIES.iter().any(|c| c.0 == s.categorie) {
        return refus(format!("Catégorie inconnue : {}.", s.categorie));
    }
    Ok(())
}

fn doublon_produit(e: rusqlite::Error) -> Erreur {
    match e {
        rusqlite::Error::SqliteFailure(f, _)
            if f.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            Erreur::Refus("Un produit portant ce nom et cette contenance existe déjà.".into())
        }
        e => e.into(),
    }
}

impl Base {
    // ------------------------------------------------------------- Identité

    pub fn identite(&self) -> Resultat<Identite> {
        Ok(self.conn.query_row(
            "SELECT nom_commercial, slogan, adresse, telephones, email, ninea, rc, logo_path FROM identite WHERE id = 1",
            [],
            |r| {
                Ok(Identite {
                    nom_commercial: r.get(0)?,
                    slogan: r.get(1)?,
                    adresse: r.get(2)?,
                    telephones: r.get(3)?,
                    email: r.get(4)?,
                    ninea: r.get(5)?,
                    rc: r.get(6)?,
                    logo_path: r.get(7)?,
                })
            },
        )?)
    }

    /// Enregistre l'identité (le chemin du logo se change avec `definir_logo`).
    pub fn modifier_identite(&self, i: &Identite) -> Resultat<Identite> {
        if i.nom_commercial.trim().is_empty() {
            return refus("Le nom commercial est obligatoire.");
        }
        if !i.email.trim().is_empty() && !i.email.contains('@') {
            return refus("L’adresse e-mail n’est pas valide.");
        }
        self.conn.execute(
            "UPDATE identite SET nom_commercial = ?1, slogan = ?2, adresse = ?3, telephones = ?4, email = ?5, ninea = ?6, rc = ?7 WHERE id = 1",
            params![
                i.nom_commercial.trim(),
                i.slogan.trim(),
                i.adresse.trim(),
                i.telephones.trim(),
                i.email.trim(),
                i.ninea.trim(),
                i.rc.trim()
            ],
        )?;
        self.identite()
    }

    pub fn definir_logo(&self, chemin: Option<&str>) -> Resultat<()> {
        self.conn.execute(
            "UPDATE identite SET logo_path = ?1 WHERE id = 1",
            params![chemin],
        )?;
        Ok(())
    }

    // ------------------------------------------------------------- Présentation

    pub fn presentation(&self) -> Resultat<Presentation> {
        Ok(self.conn.query_row(
            "SELECT modele_document, theme_document, theme_interface, mode_sombre, grand_texte, entete_logo, entete_elements, pied_page
             FROM presentation WHERE id = 1",
            [],
            |r| {
                let elements: String = r.get(6)?;
                Ok(Presentation {
                    modele_document: r.get(0)?,
                    theme_document: r.get(1)?,
                    theme_interface: r.get(2)?,
                    mode_sombre: r.get::<_, i64>(3)? == 1,
                    grand_texte: r.get::<_, i64>(4)? == 1,
                    entete_logo: r.get(5)?,
                    entete_elements: elements
                        .split(',')
                        .filter(|e| !e.is_empty())
                        .map(String::from)
                        .collect(),
                    pied_page: r.get(7)?,
                })
            },
        )?)
    }

    pub fn modifier_presentation(&self, p: &Presentation) -> Resultat<Presentation> {
        if modele(&p.modele_document).is_none() {
            return refus("Modèle de document inconnu.");
        }
        if theme(&p.theme_document).is_none() || theme(&p.theme_interface).is_none() {
            return refus("Thème inconnu.");
        }
        if !POSITIONS_LOGO.contains(&p.entete_logo.as_str()) {
            return refus("Position du logo inconnue.");
        }
        if let Some(e) = p
            .entete_elements
            .iter()
            .find(|e| !ELEMENTS_ENTETE.iter().any(|x| x.0 == e.as_str()))
        {
            return refus(format!("Élément d’en-tête inconnu : {e}."));
        }
        self.conn.execute(
            "UPDATE presentation SET modele_document = ?1, theme_document = ?2, theme_interface = ?3, mode_sombre = ?4,
               grand_texte = ?5, entete_logo = ?6, entete_elements = ?7, pied_page = ?8 WHERE id = 1",
            params![
                p.modele_document,
                p.theme_document,
                p.theme_interface,
                p.mode_sombre as i64,
                p.grand_texte as i64,
                p.entete_logo,
                p.entete_elements.join(","),
                p.pied_page.trim()
            ],
        )?;
        self.presentation()
    }

    // ------------------------------------------------------------- Conditionnements (RG-05)

    pub fn conditionnements(&self) -> Resultat<Vec<ConditionnementEnregistre>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.singulier, c.pluriel, c.abreviation, c.par_defaut, c.actif,
               (SELECT COUNT(*) FROM produits p WHERE p.conditionnement_id = c.id)
             FROM conditionnements c ORDER BY c.par_defaut DESC, c.singulier",
        )?;
        let liste = stmt
            .query_map([], |r| {
                Ok(ConditionnementEnregistre {
                    id: r.get(0)?,
                    singulier: r.get(1)?,
                    pluriel: r.get(2)?,
                    abreviation: r.get(3)?,
                    par_defaut: r.get::<_, i64>(4)? == 1,
                    actif: r.get::<_, i64>(5)? == 1,
                    nb_produits: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(liste)
    }

    fn verifier_conditionnement(s: &ConditionnementSaisie) -> Resultat<()> {
        if s.singulier.trim().is_empty()
            || s.pluriel.trim().is_empty()
            || s.abreviation.trim().is_empty()
        {
            return refus("Le nom au singulier, au pluriel et l’abréviation sont obligatoires.");
        }
        Ok(())
    }

    pub fn ajouter_conditionnement(&self, s: &ConditionnementSaisie) -> Resultat<i64> {
        Self::verifier_conditionnement(s)?;
        self.conn
            .execute(
                "INSERT INTO conditionnements (singulier, pluriel, abreviation) VALUES (?1, ?2, ?3)",
                params![
                    s.singulier.trim().to_lowercase(),
                    s.pluriel.trim().to_lowercase(),
                    s.abreviation.trim()
                ],
            )
            .map_err(|e| match e {
                rusqlite::Error::SqliteFailure(f, _) if f.code == rusqlite::ErrorCode::ConstraintViolation => {
                    Erreur::Refus("Ce conditionnement existe déjà.".into())
                }
                e => e.into(),
            })?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn modifier_conditionnement(&self, id: i64, s: &ConditionnementSaisie) -> Resultat<()> {
        Self::verifier_conditionnement(s)?;
        let n = self.conn.execute(
            "UPDATE conditionnements SET singulier = ?2, pluriel = ?3, abreviation = ?4 WHERE id = ?1",
            params![
                id,
                s.singulier.trim().to_lowercase(),
                s.pluriel.trim().to_lowercase(),
                s.abreviation.trim()
            ],
        )?;
        if n == 0 {
            refus("Conditionnement inconnu.")
        } else {
            Ok(())
        }
    }

    /// Conditionnement par défaut : utilisé par tous les produits qui n'en précisent pas.
    pub fn definir_conditionnement_defaut(&mut self, id: i64) -> Resultat<()> {
        let tx = self.conn.transaction()?;
        let existe: Option<i64> = tx
            .query_row(
                "SELECT id FROM conditionnements WHERE id = ?1 AND actif = 1",
                params![id],
                |r| r.get(0),
            )
            .optional()?;
        if existe.is_none() {
            return refus("Conditionnement inconnu ou désactivé.");
        }
        tx.execute(
            "UPDATE conditionnements SET par_defaut = (id = ?1)",
            params![id],
        )?;
        tx.commit()?;
        Ok(())
    }

    // ------------------------------------------------------------- Produits (EF-40)

    pub fn ajouter_produit(&self, s: &ProduitSaisie) -> Resultat<i64> {
        verifier_produit(s)?;
        let ordre: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(ordre), 0) + 1 FROM produits",
            [],
            |r| r.get(0),
        )?;
        self.conn
            .execute(
                "INSERT INTO produits (nom, contenance, categorie, conditionnement_id, bt_par_conditionnement,
                   seuil_depot_conditionnements, seuil_boutique_bt, ordre, actif)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    s.nom.trim(),
                    s.contenance.trim(),
                    s.categorie,
                    s.conditionnement_id,
                    s.bt_par_conditionnement,
                    s.seuil_depot_conditionnements,
                    s.seuil_boutique_bt,
                    ordre,
                    s.actif as i64
                ],
            )
            .map_err(doublon_produit)?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Modifie un produit ; le format est alors considéré comme confirmé.
    /// Un produit n'est jamais supprimé (RG-23) : on le désactive avec `actif = false`.
    pub fn modifier_produit(&self, id: i64, s: &ProduitSaisie) -> Resultat<()> {
        verifier_produit(s)?;
        let n = self
            .conn
            .execute(
                "UPDATE produits SET nom = ?2, contenance = ?3, categorie = ?4, conditionnement_id = ?5, bt_par_conditionnement = ?6,
               seuil_depot_conditionnements = ?7, seuil_boutique_bt = ?8, actif = ?9, format_a_confirmer = 0 WHERE id = ?1",
                params![
                    id,
                    s.nom.trim(),
                    s.contenance.trim(),
                    s.categorie,
                    s.conditionnement_id,
                    s.bt_par_conditionnement,
                    s.seuil_depot_conditionnements,
                    s.seuil_boutique_bt,
                    s.actif as i64
                ],
            )
            .map_err(doublon_produit)?;
        if n == 0 {
            refus(format!("Produit inconnu (n° {id})."))
        } else {
            Ok(())
        }
    }

    /// Déplace un produit d'un rang (ordre de la fiche papier) : `sens` = -1 (monter) ou +1 (descendre).
    pub fn deplacer_produit(&mut self, id: i64, sens: i64) -> Resultat<()> {
        let tx = self.conn.transaction()?;
        let ids: Vec<i64> = {
            let mut stmt = tx.prepare("SELECT id FROM produits ORDER BY ordre, id")?;
            stmt.query_map([], |r| r.get(0))?
                .collect::<rusqlite::Result<_>>()?
        };
        let Some(i) = ids.iter().position(|x| *x == id) else {
            return refus("Produit inconnu.");
        };
        let j = i as i64 + sens.signum();
        if j < 0 || j >= ids.len() as i64 {
            return Ok(());
        }
        let mut ids = ids;
        ids.swap(i, j as usize);
        for (rang, pid) in ids.iter().enumerate() {
            tx.execute(
                "UPDATE produits SET ordre = ?2 WHERE id = ?1",
                params![pid, rang as i64 + 1],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Historique des prix d'un produit, du plus récent au plus ancien.
    pub fn historique_prix(&self, produit_id: i64) -> Resultat<Vec<PrixDate>> {
        let mut stmt = self.conn.prepare(
            "SELECT date_debut, prix_vente, prix_achat_conditionnement FROM prix WHERE produit_id = ?1 ORDER BY date_debut DESC",
        )?;
        let liste = stmt
            .query_map(params![produit_id], |r| {
                Ok(PrixDate {
                    date_debut: r.get(0)?,
                    prix_vente: r.get(1)?,
                    prix_achat_conditionnement: r.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(liste)
    }

    /// Indicateurs de configuration pour l'accueil : formats à confirmer, produits sans prix.
    pub fn a_configurer(&self, date: &str) -> Resultat<(i64, i64)> {
        let formats: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM produits WHERE actif = 1 AND format_a_confirmer = 1",
            [],
            |r| r.get(0),
        )?;
        let sans_prix: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM produits p WHERE p.actif = 1
               AND NOT EXISTS (SELECT 1 FROM prix x WHERE x.produit_id = p.id AND x.date_debut <= ?1)",
            params![date],
            |r| r.get(0),
        )?;
        Ok((formats, sans_prix))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn saisie(nom: &str) -> ProduitSaisie {
        ProduitSaisie {
            nom: nom.into(),
            contenance: "1 L".into(),
            categorie: "whisky".into(),
            conditionnement_id: None,
            bt_par_conditionnement: 6,
            seuil_depot_conditionnements: 2,
            seuil_boutique_bt: 6,
            actif: true,
        }
    }

    #[test]
    fn identite_et_presentation() {
        let base = Base::en_memoire().unwrap();
        let mut i = base.identite().unwrap();
        assert_eq!(i.nom_commercial, "Ma boutique");
        i.nom_commercial = "Boutique Teranga".into();
        i.telephones = "77 000 00 00".into();
        assert_eq!(
            base.modifier_identite(&i).unwrap().nom_commercial,
            "Boutique Teranga"
        );
        i.nom_commercial = " ".into();
        assert!(base.modifier_identite(&i).is_err());

        let mut p = base.presentation().unwrap();
        assert_eq!(
            (p.theme_interface.as_str(), p.modele_document.as_str()),
            ("emeraude", "classique")
        );
        assert_eq!(p.entete_elements, ["nom", "slogan", "coordonnees"]);
        p.theme_document = "noir_blanc".into();
        p.mode_sombre = true;
        p.entete_elements = vec!["nom".into(), "legal".into()];
        let p2 = base.modifier_presentation(&p).unwrap();
        assert!(p2.mode_sombre);
        assert_eq!(p2.entete_elements, ["nom", "legal"]);
        p.theme_interface = "rose".into();
        assert!(base.modifier_presentation(&p).is_err());
    }

    #[test]
    fn conditionnements_parametrables() {
        let mut base = Base::en_memoire().unwrap();
        let liste = base.conditionnements().unwrap();
        assert_eq!(liste[0].singulier, "caisse");
        assert!(liste[0].par_defaut);
        let carton = liste.iter().find(|c| c.singulier == "carton").unwrap().id;
        base.definir_conditionnement_defaut(carton).unwrap();
        let p = base.produits(false).unwrap();
        assert_eq!(
            p[0].format.conditionnement.singulier, "carton",
            "le défaut s’applique aux produits sans conditionnement propre"
        );
        let fardeau = base
            .ajouter_conditionnement(&ConditionnementSaisie {
                singulier: "Fardeau".into(),
                pluriel: "fardeaux".into(),
                abreviation: "fd".into(),
            })
            .unwrap();
        assert!(
            base.ajouter_conditionnement(&ConditionnementSaisie {
                singulier: "fardeau".into(),
                pluriel: "x".into(),
                abreviation: "x".into()
            })
            .is_err()
        );
        let mut s = saisie("Whisky Test");
        s.conditionnement_id = Some(fardeau);
        let id = base.ajouter_produit(&s).unwrap();
        assert_eq!(
            base.produit(id).unwrap().format.conditionnement.pluriel,
            "fardeaux"
        );
    }

    #[test]
    fn produits_ajout_modification_ordre() {
        let mut base = Base::en_memoire().unwrap();
        let id = base.ajouter_produit(&saisie("Gin")).unwrap();
        assert_eq!(base.produits(false).unwrap().len(), 30);
        assert!(
            base.ajouter_produit(&saisie("Gin")).is_err(),
            "doublon refusé"
        );
        let mut s = saisie("Gin");
        s.bt_par_conditionnement = 0;
        assert!(base.modifier_produit(id, &s).is_err());

        let premier = base.produits(false).unwrap()[0].id;
        let mut s = saisie("Bronson");
        s.contenance = "3/4".into();
        s.categorie = "autre".into();
        s.bt_par_conditionnement = 12;
        base.modifier_produit(premier, &s).unwrap();
        assert!(!base.produit(premier).unwrap().format_a_confirmer);

        base.deplacer_produit(id, -1).unwrap();
        let ordre: Vec<i64> = base.produits(false).unwrap().iter().map(|p| p.id).collect();
        assert_eq!(ordre[28], id, "monté d’un rang");

        s.actif = false;
        base.modifier_produit(premier, &s).unwrap();
        assert_eq!(base.produits(false).unwrap().len(), 29);
        assert_eq!(base.produits(true).unwrap().len(), 30);
    }

    #[test]
    fn historique_des_prix_et_configuration() {
        let base = Base::en_memoire().unwrap();
        let id = base.produits(false).unwrap()[0].id;
        assert_eq!(base.a_configurer("2026-10-15").unwrap(), (29, 29));
        base.definir_prix(id, "2026-10-01", 1_000, Some(10_000))
            .unwrap();
        base.definir_prix(id, "2026-11-01", 1_100, None).unwrap();
        let h = base.historique_prix(id).unwrap();
        assert_eq!(
            h.iter().map(|p| p.prix_vente).collect::<Vec<_>>(),
            [1_100, 1_000]
        );
        assert_eq!(base.a_configurer("2026-10-15").unwrap(), (29, 28));
    }
}
