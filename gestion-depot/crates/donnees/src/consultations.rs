//! Consultations et historique : fournisseurs, réceptions, alimentations, fiche de stock (EF-23),
//! journées enregistrées (EF-30) et réouverture tracée d'une journée (RG-22).

use crate::{Base, Lieu, Resultat, refus};
use noyau::quantite_lisible;
use rusqlite::{OptionalExtension, params};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Fournisseur {
    pub id: i64,
    pub nom: String,
    pub telephone: String,
}

/// Ligne d'une réception ou d'une alimentation, prête à afficher.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LigneMouvementee {
    pub produit_id: i64,
    pub designation: String,
    pub bouteilles: i64,
    pub quantite: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct OperationDepot {
    pub id: i64,
    pub date: String,
    /// Fournisseur (réception) ou « Fiche du jour » (alimentation notée sur la fiche).
    pub origine: String,
    pub reference: String,
    pub bouteilles: i64,
    pub lignes: Vec<LigneMouvementee>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MouvementStock {
    pub date: String,
    pub lieu: String,
    pub type_mouvement: String,
    pub quantite: i64,
    pub solde_depot: i64,
    pub solde_boutique: i64,
    pub motif: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct JourneeResume {
    pub date: String,
    pub statut: String,
    pub total_ventes: i64,
    pub total_recu: i64,
    pub total_depenses: i64,
    pub ecart: i64,
    pub bouteilles_vendues: i64,
}

/// Ligne d'une journée enregistrée (valeurs figées).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LigneEnregistree {
    pub produit_id: i64,
    pub stock_initial: i64,
    pub stock_initial_fiche: Option<i64>,
    pub alimentation: i64,
    pub stock_total: i64,
    pub stock_restant: i64,
    pub casse: i64,
    pub ventes: i64,
    pub ventes_fiche: Option<i64>,
    pub prix: i64,
    pub prix_fiche: Option<i64>,
    pub montant: i64,
    pub montant_fiche: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct JourneeEnregistree {
    pub date: String,
    pub statut: String,
    pub total_ventes: i64,
    pub total_recu: i64,
    pub total_depenses: i64,
    pub ecart: i64,
    pub observations: String,
    pub valide_le: Option<String>,
    pub lignes: Vec<LigneEnregistree>,
    pub depenses: Vec<(String, i64)>,
    /// Peut être rouverte : c'est la dernière journée validée.
    pub reouvrable: bool,
}

impl Base {
    pub fn fournisseurs(&self) -> Resultat<Vec<Fournisseur>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, nom, telephone FROM fournisseurs WHERE actif = 1 ORDER BY nom")?;
        let liste = stmt
            .query_map([], |r| {
                Ok(Fournisseur {
                    id: r.get(0)?,
                    nom: r.get(1)?,
                    telephone: r.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(liste)
    }

    fn lignes_operation(&self, table: &str, cle: &str, id: i64) -> Resultat<Vec<LigneMouvementee>> {
        let sql =
            format!("SELECT produit_id, bouteilles FROM {table} WHERE {cle} = ?1 ORDER BY id");
        let mut stmt = self.conn.prepare(&sql)?;
        let brutes = stmt
            .query_map(params![id], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        brutes
            .into_iter()
            .map(|(pid, bt)| {
                let p = self.produit(pid)?;
                Ok(LigneMouvementee {
                    produit_id: pid,
                    designation: p.designation(),
                    bouteilles: bt,
                    quantite: quantite_lisible(bt, &p.format),
                })
            })
            .collect()
    }

    /// Réceptions entre deux dates incluses, de la plus récente à la plus ancienne.
    pub fn receptions(&self, du: &str, au: &str) -> Resultat<Vec<OperationDepot>> {
        let mut stmt = self.conn.prepare(
            "SELECT r.id, r.date, COALESCE(f.nom, ''), r.num_bl FROM receptions r
             LEFT JOIN fournisseurs f ON f.id = r.fournisseur_id
             WHERE r.date BETWEEN ?1 AND ?2 ORDER BY r.date DESC, r.id DESC",
        )?;
        let entetes = stmt
            .query_map(params![du, au], |r| {
                Ok((r.get::<_, i64>(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })?
            .collect::<rusqlite::Result<Vec<(i64, String, String, String)>>>()?;
        entetes
            .into_iter()
            .map(|(id, date, origine, reference)| {
                let lignes = self.lignes_operation("lignes_reception", "reception_id", id)?;
                Ok(OperationDepot {
                    bouteilles: lignes.iter().map(|l| l.bouteilles).sum(),
                    id,
                    date,
                    origine,
                    reference,
                    lignes,
                })
            })
            .collect()
    }

    /// Alimentations de la boutique entre deux dates incluses.
    pub fn alimentations(&self, du: &str, au: &str) -> Resultat<Vec<OperationDepot>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, date, journee_id IS NOT NULL, notes FROM alimentations
             WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC",
        )?;
        let entetes = stmt
            .query_map(params![du, au], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get(1)?,
                    r.get::<_, bool>(2)?,
                    r.get(3)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<(i64, String, bool, String)>>>()?;
        entetes
            .into_iter()
            .map(|(id, date, fiche, notes)| {
                let lignes = self.lignes_operation("lignes_alimentation", "alimentation_id", id)?;
                Ok(OperationDepot {
                    bouteilles: lignes.iter().map(|l| l.bouteilles).sum(),
                    id,
                    date,
                    origine: if fiche {
                        "Fiche du jour".into()
                    } else {
                        "Module Dépôt".into()
                    },
                    reference: notes,
                    lignes,
                })
            })
            .collect()
    }

    /// Fiche de stock d'un produit (EF-23) : mouvements dans l'ordre, avec les soldes après chacun.
    pub fn fiche_stock(&self, produit_id: i64) -> Resultat<Vec<MouvementStock>> {
        self.produit(produit_id)?;
        let mut stmt = self.conn.prepare(
            "SELECT date, lieu, type, quantite, motif FROM mouvements WHERE produit_id = ?1 ORDER BY date, id",
        )?;
        let brutes = stmt
            .query_map(params![produit_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, String>(4)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let (mut depot, mut boutique) = (0, 0);
        Ok(brutes
            .into_iter()
            .map(|(date, lieu, type_mouvement, quantite, motif)| {
                if lieu == Lieu::Depot.code() {
                    depot += quantite;
                } else {
                    boutique += quantite;
                }
                MouvementStock {
                    date,
                    lieu,
                    type_mouvement,
                    quantite,
                    solde_depot: depot,
                    solde_boutique: boutique,
                    motif,
                }
            })
            .collect())
    }

    /// Journées entre deux dates incluses, de la plus récente à la plus ancienne (EF-30).
    pub fn journees(&self, du: &str, au: &str) -> Resultat<Vec<JourneeResume>> {
        let mut stmt = self.conn.prepare(
            "SELECT j.date, j.statut, j.total_ventes, j.total_recu, j.total_depenses, j.ecart,
               (SELECT COALESCE(SUM(l.ventes), 0) FROM lignes_journee l WHERE l.journee_id = j.id)
             FROM journees j WHERE j.date BETWEEN ?1 AND ?2 ORDER BY j.date DESC",
        )?;
        let liste = stmt
            .query_map(params![du, au], |r| {
                Ok(JourneeResume {
                    date: r.get(0)?,
                    statut: r.get(1)?,
                    total_ventes: r.get(2)?,
                    total_recu: r.get(3)?,
                    total_depenses: r.get(4)?,
                    ecart: r.get(5)?,
                    bouteilles_vendues: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(liste)
    }

    fn derniere_validee(&self) -> Resultat<Option<String>> {
        Ok(self.conn.query_row(
            "SELECT MAX(date) FROM journees WHERE statut = 'validee'",
            [],
            |r| r.get(0),
        )?)
    }

    /// Journée enregistrée (brouillon ou validée), ou `None` si aucune fiche à cette date.
    pub fn journee(&self, date: &str) -> Resultat<Option<JourneeEnregistree>> {
        let entete = self
            .conn
            .query_row(
                "SELECT id, statut, total_ventes, total_recu, total_depenses, ecart, observations, valide_le
                 FROM journees WHERE date = ?1",
                params![date],
                |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, String>(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                        r.get(7)?,
                    ))
                },
            )
            .optional()?;
        let Some((
            id,
            statut,
            total_ventes,
            total_recu,
            total_depenses,
            ecart,
            observations,
            valide_le,
        )) = entete
        else {
            return Ok(None);
        };
        let mut stmt = self.conn.prepare(
            "SELECT produit_id, stock_initial, stock_initial_fiche, alimentation, stock_total, stock_restant, casse,
               ventes, ventes_fiche, prix, prix_fiche, montant, montant_fiche
             FROM lignes_journee WHERE journee_id = ?1 ORDER BY id",
        )?;
        let lignes = stmt
            .query_map(params![id], |r| {
                Ok(LigneEnregistree {
                    produit_id: r.get(0)?,
                    stock_initial: r.get(1)?,
                    stock_initial_fiche: r.get(2)?,
                    alimentation: r.get(3)?,
                    stock_total: r.get(4)?,
                    stock_restant: r.get(5)?,
                    casse: r.get(6)?,
                    ventes: r.get(7)?,
                    ventes_fiche: r.get(8)?,
                    prix: r.get(9)?,
                    prix_fiche: r.get(10)?,
                    montant: r.get(11)?,
                    montant_fiche: r.get(12)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut stmt = self
            .conn
            .prepare("SELECT libelle, montant FROM depenses WHERE journee_id = ?1 ORDER BY id")?;
        let depenses = stmt
            .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let reouvrable = statut == "validee" && self.derniere_validee()?.as_deref() == Some(date);
        Ok(Some(JourneeEnregistree {
            date: date.to_string(),
            statut,
            total_ventes,
            total_recu,
            total_depenses,
            ecart,
            observations,
            valide_le,
            lignes,
            depenses,
            reouvrable,
        }))
    }

    /// Rouvre la dernière journée validée pour correction (RG-22) : ses ventes, sa casse et
    /// l'alimentation notée sur la fiche sont annulées, la journée repasse en brouillon, et la
    /// réouverture est inscrite au journal avec son motif.
    pub fn reouvrir_journee(&mut self, date: &str, motif: &str) -> Resultat<()> {
        if motif.trim().len() < 3 {
            return refus("Indiquez le motif de la réouverture.");
        }
        if self.derniere_validee()?.as_deref() != Some(date) {
            return refus("Seule la dernière journée validée peut être rouverte.");
        }
        let tx = self.conn.transaction()?;
        let (id, avant): (i64, String) = tx.query_row(
            "SELECT id, 'ventes ' || total_ventes || ' F, reçu ' || total_recu || ' F, écart ' || ecart || ' F' FROM journees WHERE date = ?1",
            params![date],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        tx.execute(
            "DELETE FROM mouvements WHERE reference_type = 'journee' AND reference_id = ?1",
            params![id],
        )?;
        tx.execute(
            "DELETE FROM mouvements WHERE reference_type = 'alimentation'
               AND reference_id IN (SELECT id FROM alimentations WHERE journee_id = ?1)",
            params![id],
        )?;
        tx.execute(
            "DELETE FROM alimentations WHERE journee_id = ?1",
            params![id],
        )?;
        tx.execute(
            "UPDATE journees SET statut = 'brouillon', valide_le = NULL WHERE id = ?1",
            params![id],
        )?;
        tx.execute(
            "INSERT INTO journal (objet, avant, apres, motif) VALUES (?1, ?2, 'rouverte en brouillon', ?3)",
            params![format!("Journée du {date}"), avant, motif.trim()],
        )?;
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::*;
    use noyau::SaisieLigne;

    fn base() -> (Base, i64) {
        let mut base = Base::en_memoire().unwrap();
        let h = base
            .produits(false)
            .unwrap()
            .into_iter()
            .find(|p| p.designation() == "Heineken PM")
            .unwrap()
            .id;
        base.definir_format(h, 24, None).unwrap();
        base.definir_prix(h, "2026-10-01", 600, None).unwrap();
        let f = base
            .ajouter_fournisseur("Brasserie du Cap", "33 000 00 00")
            .unwrap();
        base.enregistrer_reception(&ReceptionSaisie {
            date: "2026-10-13".into(),
            fournisseur_id: Some(f),
            num_bl: "BL 77".into(),
            lignes: vec![LigneQuantite {
                produit_id: h,
                conditionnements: 30,
                bouteilles: 0,
            }],
            ..Default::default()
        })
        .unwrap();
        base.stock_ouverture("2026-10-13", &[(h, 0, 18)]).unwrap();
        (base, h)
    }

    fn fiche(date: &str, h: i64, caisses: i64, restant: i64) -> FicheSaisie {
        FicheSaisie {
            date: date.into(),
            lignes: vec![(
                h,
                SaisieLigne {
                    alimentation_conditionnements: caisses,
                    stock_restant: Some(restant),
                    ..Default::default()
                },
            )],
            total_recu: 27_000,
            depenses: vec![("Glace".into(), 500)],
            ..Default::default()
        }
    }

    #[test]
    fn receptions_alimentations_et_fiche_de_stock() {
        let (mut base, h) = base();
        base.valider_journee(&fiche("2026-10-14", h, 2, 21))
            .unwrap();
        let r = base.receptions("2026-10-01", "2026-10-31").unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(
            (r[0].origine.as_str(), r[0].bouteilles),
            ("Brasserie du Cap", 720)
        );
        assert_eq!(r[0].lignes[0].quantite, "30 caisses");
        let a = base.alimentations("2026-10-01", "2026-10-31").unwrap();
        assert_eq!(
            (a[0].origine.as_str(), a[0].bouteilles),
            ("Fiche du jour", 48)
        );

        let f = base.fiche_stock(h).unwrap();
        let dernier = f.last().unwrap();
        assert_eq!((dernier.solde_depot, dernier.solde_boutique), (672, 21));
        assert_eq!(f.iter().filter(|m| m.type_mouvement == "vente").count(), 1);
        assert_eq!(base.fournisseurs().unwrap()[0].nom, "Brasserie du Cap");
    }

    #[test]
    fn journees_et_relecture() {
        let (mut base, h) = base();
        base.valider_journee(&fiche("2026-10-14", h, 2, 21))
            .unwrap();
        base.enregistrer_brouillon(&fiche("2026-10-15", h, 0, 15))
            .unwrap();
        let liste = base.journees("2026-10-01", "2026-10-31").unwrap();
        assert_eq!(
            liste.iter().map(|j| j.statut.as_str()).collect::<Vec<_>>(),
            ["brouillon", "validee"]
        );
        assert_eq!(
            (
                liste[1].total_ventes,
                liste[1].bouteilles_vendues,
                liste[1].ecart
            ),
            (27_000, 45, 500)
        );

        let j = base.journee("2026-10-14").unwrap().unwrap();
        assert!(j.reouvrable);
        assert_eq!(j.depenses, vec![("Glace".to_string(), 500)]);
        let l = j.lignes.iter().find(|l| l.produit_id == h).unwrap();
        assert_eq!(
            (l.stock_initial, l.alimentation, l.ventes, l.montant),
            (18, 48, 45, 27_000)
        );
        assert!(base.journee("2026-10-20").unwrap().is_none());
    }

    #[test]
    fn reouverture_de_la_derniere_journee() {
        let (mut base, h) = base();
        base.valider_journee(&fiche("2026-10-14", h, 2, 21))
            .unwrap();
        base.valider_journee(&fiche("2026-10-15", h, 0, 15))
            .unwrap();
        assert!(
            base.reouvrir_journee("2026-10-14", "erreur").is_err(),
            "pas la dernière"
        );
        assert!(
            base.reouvrir_journee("2026-10-15", "").is_err(),
            "motif obligatoire"
        );

        base.reouvrir_journee("2026-10-15", "Restant mal compté")
            .unwrap();
        assert_eq!(
            base.stock(h, Lieu::Boutique, None).unwrap(),
            21,
            "ventes du 15 annulées"
        );
        assert_eq!(
            base.journee("2026-10-15").unwrap().unwrap().statut,
            "brouillon"
        );
        // Correction puis nouvelle validation.
        base.valider_journee(&fiche("2026-10-15", h, 0, 16))
            .unwrap();
        assert_eq!(base.stock(h, Lieu::Boutique, None).unwrap(), 16);

        // Réouverture d'une journée avec alimentation : le dépôt est rétabli.
        base.reouvrir_journee("2026-10-15", "test").unwrap();
        base.reouvrir_journee("2026-10-14", "Alimentation erronée")
            .unwrap();
        assert_eq!(base.stock(h, Lieu::Depot, None).unwrap(), 720);
        assert_eq!(base.stock(h, Lieu::Boutique, None).unwrap(), 18);
        let n: i64 = base
            .connexion()
            .query_row("SELECT COUNT(*) FROM journal", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 3);
    }
}
