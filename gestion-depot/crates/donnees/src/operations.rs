//! Opérations métier sur la base : produits, prix, stocks, réceptions, alimentations,
//! inventaires et fiche journalière.

use crate::{Base, Erreur, Resultat, refus};
use noyau::{
    BilanCaisse, Conditionnement, Format, LigneCalculee, SaisieLigne, bilan_caisse, calculer_ligne,
};
use rusqlite::{Connection, OptionalExtension, params};

/// Lieu de stockage.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lieu {
    Depot,
    Boutique,
}

impl Lieu {
    pub fn code(self) -> &'static str {
        match self {
            Lieu::Depot => "depot",
            Lieu::Boutique => "boutique",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Produit {
    pub id: i64,
    pub nom: String,
    pub contenance: String,
    pub categorie: String,
    pub format: Format,
    pub format_a_confirmer: bool,
    pub seuil_depot_conditionnements: i64,
    pub seuil_boutique_bt: i64,
    pub ordre: i64,
    pub actif: bool,
}

impl Produit {
    pub fn designation(&self) -> String {
        if self.contenance.is_empty() {
            self.nom.clone()
        } else {
            format!("{} {}", self.nom, self.contenance)
        }
    }
}

/// Ligne de réception ou d'alimentation : conditionnements entiers + bouteilles isolées.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LigneQuantite {
    pub produit_id: i64,
    pub conditionnements: i64,
    pub bouteilles: i64,
}

#[derive(Debug, Clone, Default)]
pub struct ReceptionSaisie {
    pub date: String,
    pub fournisseur_id: Option<i64>,
    pub num_bl: String,
    pub notes: String,
    pub lignes: Vec<LigneQuantite>,
    /// Prix d'achat d'un conditionnement, par produit (facultatif).
    pub prix_achat: Vec<(i64, i64)>,
}

/// Fiche journalière telle que recopiée par le propriétaire.
#[derive(Debug, Clone, Default)]
pub struct FicheSaisie {
    pub date: String,
    /// Lignes saisies ; les produits actifs absents sont considérés sans mouvement.
    /// `stock_initial` est ignoré : il est recalculé depuis la base.
    pub lignes: Vec<(i64, SaisieLigne)>,
    pub total_recu: i64,
    pub depenses: Vec<(String, i64)>,
    pub observations: String,
}

/// Ligne préparée pour la saisie d'une journée.
#[derive(Debug, Clone, PartialEq)]
pub struct LignePreparee {
    pub produit: Produit,
    pub stock_initial: i64,
    /// Bouteilles déjà transférées du dépôt ce jour-là depuis le module Dépôt.
    pub alimentation_enregistree: i64,
    pub prix: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct BilanJournee {
    pub journee_id: i64,
    pub lignes: Vec<(i64, LigneCalculee)>,
    pub caisse: BilanCaisse,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SituationProduit {
    pub produit: Produit,
    pub depot: i64,
    pub boutique: i64,
    pub total: i64,
    pub prix: Option<i64>,
    pub valeur: i64,
    pub alerte_depot: bool,
    pub alerte_boutique: bool,
}

pub(crate) fn date_valide(date: &str) -> bool {
    let b = date.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
        && (1..=12).contains(&date[5..7].parse::<u32>().unwrap_or(0))
        && (1..=31).contains(&date[8..10].parse::<u32>().unwrap_or(0))
}

fn verifier_date(date: &str) -> Resultat<()> {
    if date_valide(date) {
        Ok(())
    } else {
        refus(format!(
            "Date invalide : « {date} » (format attendu AAAA-MM-JJ)."
        ))
    }
}

// ------------------------------------------------------------------ Lecture (fonctions sur une connexion)

const SELECT_PRODUIT: &str = "SELECT p.id, p.nom, p.contenance, p.categorie, p.bt_par_conditionnement, p.format_a_confirmer,
    p.seuil_depot_conditionnements, p.seuil_boutique_bt, p.ordre, p.actif, c.singulier, c.pluriel, c.abreviation
  FROM produits p
  JOIN conditionnements c ON c.id = COALESCE(p.conditionnement_id, (SELECT id FROM conditionnements WHERE par_defaut = 1 LIMIT 1))";

fn ligne_produit(r: &rusqlite::Row) -> rusqlite::Result<Produit> {
    let cond = Conditionnement::new(
        &r.get::<_, String>(10)?,
        &r.get::<_, String>(11)?,
        &r.get::<_, String>(12)?,
    );
    Ok(Produit {
        id: r.get(0)?,
        nom: r.get(1)?,
        contenance: r.get(2)?,
        categorie: r.get(3)?,
        format: Format::new(r.get(4)?, cond),
        format_a_confirmer: r.get::<_, i64>(5)? == 1,
        seuil_depot_conditionnements: r.get(6)?,
        seuil_boutique_bt: r.get(7)?,
        ordre: r.get(8)?,
        actif: r.get::<_, i64>(9)? == 1,
    })
}

fn lire_produits(conn: &Connection, inclure_inactifs: bool) -> Resultat<Vec<Produit>> {
    let sql = format!(
        "{SELECT_PRODUIT} {} ORDER BY p.ordre, p.id",
        if inclure_inactifs {
            ""
        } else {
            "WHERE p.actif = 1"
        }
    );
    let mut stmt = conn.prepare(&sql)?;
    let produits = stmt
        .query_map([], ligne_produit)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(produits)
}

fn lire_produit(conn: &Connection, id: i64) -> Resultat<Produit> {
    conn.query_row(
        &format!("{SELECT_PRODUIT} WHERE p.id = ?1"),
        params![id],
        ligne_produit,
    )
    .optional()?
    .ok_or_else(|| Erreur::Refus(format!("Produit inconnu (n° {id}).")))
}

/// Stock d'un lieu ; `jusqu_au` inclus (AAAA-MM-JJ), `None` pour le stock actuel.
fn lire_stock(
    conn: &Connection,
    produit_id: i64,
    lieu: Lieu,
    jusqu_au: Option<&str>,
) -> Resultat<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(quantite), 0) FROM mouvements WHERE produit_id = ?1 AND lieu = ?2 AND (?3 IS NULL OR date <= ?3)",
        params![produit_id, lieu.code(), jusqu_au],
        |r| r.get(0),
    )?)
}

/// Stock à l'ouverture d'une journée (mouvements des jours précédents).
fn stock_avant(conn: &Connection, produit_id: i64, lieu: Lieu, date: &str) -> Resultat<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(quantite), 0) FROM mouvements WHERE produit_id = ?1 AND lieu = ?2 AND date < ?3",
        params![produit_id, lieu.code(), date],
        |r| r.get(0),
    )?)
}

fn lire_prix(conn: &Connection, produit_id: i64, date: &str) -> Resultat<Option<i64>> {
    Ok(conn
        .query_row(
            "SELECT prix_vente FROM prix WHERE produit_id = ?1 AND date_debut <= ?2 ORDER BY date_debut DESC LIMIT 1",
            params![produit_id, date],
            |r| r.get(0),
        )
        .optional()?)
}

fn alimentation_du_jour(conn: &Connection, produit_id: i64, date: &str) -> Resultat<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(quantite), 0) FROM mouvements
         WHERE produit_id = ?1 AND lieu = 'boutique' AND type = 'alimentation' AND date = ?2",
        params![produit_id, date],
        |r| r.get(0),
    )?)
}

#[allow(clippy::too_many_arguments)]
fn mouvement(
    conn: &Connection,
    date: &str,
    produit_id: i64,
    lieu: Lieu,
    quantite: i64,
    type_: &str,
    reference: (&str, i64),
    motif: &str,
) -> Resultat<()> {
    if quantite != 0 {
        conn.execute(
            "INSERT INTO mouvements (date, produit_id, lieu, quantite, type, reference_type, reference_id, motif) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![date, produit_id, lieu.code(), quantite, type_, reference.0, reference.1, motif],
        )?;
    }
    Ok(())
}

/// Transfert dépôt → boutique, contrôlé (RG-14). `journee_id` lie l'alimentation à une fiche.
fn alimenter(
    conn: &Connection,
    date: &str,
    lignes: &[(i64, i64)],
    journee_id: Option<i64>,
    notes: &str,
) -> Resultat<Option<i64>> {
    let lignes: Vec<_> = lignes.iter().copied().filter(|(_, bt)| *bt != 0).collect();
    if lignes.is_empty() {
        return Ok(None);
    }
    for &(produit_id, bt) in &lignes {
        let p = lire_produit(conn, produit_id)?;
        if bt < 0 {
            return refus(format!(
                "{} : la quantité transférée ne peut pas être négative.",
                p.designation()
            ));
        }
        let disponible = lire_stock(conn, produit_id, Lieu::Depot, Some(date))?;
        if bt > disponible {
            return refus(format!(
                "{} : alimentation de {} impossible, le dépôt n’en contient que {}. Enregistrez d’abord la réception manquante.",
                p.designation(),
                noyau::quantite_lisible(bt, &p.format),
                noyau::quantite_lisible(disponible, &p.format)
            ));
        }
    }
    conn.execute(
        "INSERT INTO alimentations (date, journee_id, notes) VALUES (?1, ?2, ?3)",
        params![date, journee_id, notes],
    )?;
    let id = conn.last_insert_rowid();
    for (produit_id, bt) in lignes {
        conn.execute("INSERT INTO lignes_alimentation (alimentation_id, produit_id, bouteilles) VALUES (?1, ?2, ?3)", params![id, produit_id, bt])?;
        mouvement(
            conn,
            date,
            produit_id,
            Lieu::Depot,
            -bt,
            "alimentation",
            ("alimentation", id),
            "",
        )?;
        mouvement(
            conn,
            date,
            produit_id,
            Lieu::Boutique,
            bt,
            "alimentation",
            ("alimentation", id),
            "",
        )?;
    }
    Ok(Some(id))
}

/// Calcule toutes les lignes d'une fiche (produits actifs), sans rien écrire.
fn calculer_fiche(
    conn: &Connection,
    fiche: &FicheSaisie,
) -> Resultat<Vec<(i64, SaisieLigne, LigneCalculee, i64)>> {
    let mut resultat = Vec::new();
    for p in lire_produits(conn, false)? {
        let mut saisie = fiche
            .lignes
            .iter()
            .find(|(id, _)| *id == p.id)
            .map(|(_, s)| s.clone())
            .unwrap_or_default();
        saisie.stock_initial = stock_avant(conn, p.id, Lieu::Boutique, &fiche.date)?;
        let deja = alimentation_du_jour(conn, p.id, &fiche.date)?;
        let supplement = p.format.en_bouteilles(
            saisie.alimentation_conditionnements,
            saisie.alimentation_bouteilles,
        );
        let mut pour_calcul = saisie.clone();
        pour_calcul.alimentation_bouteilles += deja;
        let calcul = calculer_ligne(&pour_calcul, &p.format, lire_prix(conn, p.id, &fiche.date)?);
        resultat.push((p.id, saisie, calcul, supplement));
    }
    Ok(resultat)
}

fn enregistrer_lignes_journee(
    conn: &Connection,
    journee_id: i64,
    lignes: &[(i64, SaisieLigne, LigneCalculee, i64)],
    fiche: &FicheSaisie,
) -> Resultat<BilanCaisse> {
    conn.execute(
        "DELETE FROM lignes_journee WHERE journee_id = ?1",
        params![journee_id],
    )?;
    conn.execute(
        "DELETE FROM depenses WHERE journee_id = ?1",
        params![journee_id],
    )?;
    for (produit_id, s, l, _) in lignes {
        conn.execute(
            "INSERT INTO lignes_journee (journee_id, produit_id, stock_initial, stock_initial_fiche, alimentation, stock_total, stock_restant,
               casse, ventes, ventes_fiche, prix, prix_fiche, montant, montant_fiche)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![journee_id, produit_id, s.stock_initial, s.stock_initial_fiche, l.alimentation, l.stock_total, l.stock_restant,
                    s.casse, l.ventes, s.ventes_fiche, l.prix, s.prix_fiche, l.montant, s.montant_fiche],
        )?;
    }
    for (libelle, montant) in &fiche.depenses {
        if *montant < 0 || libelle.trim().is_empty() {
            return refus("Chaque dépense doit avoir un libellé et un montant positif.");
        }
        conn.execute(
            "INSERT INTO depenses (journee_id, libelle, montant) VALUES (?1, ?2, ?3)",
            params![journee_id, libelle.trim(), montant],
        )?;
    }
    let montants: Vec<i64> = lignes.iter().map(|(_, _, l, _)| l.montant).collect();
    let depenses: Vec<i64> = fiche.depenses.iter().map(|d| d.1).collect();
    let bilan = bilan_caisse(&montants, fiche.total_recu, &depenses);
    conn.execute(
        "UPDATE journees SET total_ventes = ?2, total_recu = ?3, total_depenses = ?4, ecart = ?5, observations = ?6 WHERE id = ?1",
        params![journee_id, bilan.total_ventes, bilan.total_recu, bilan.total_depenses, bilan.ecart, fiche.observations],
    )?;
    Ok(bilan)
}

fn journee_existante(conn: &Connection, date: &str) -> Resultat<Option<(i64, String)>> {
    Ok(conn
        .query_row(
            "SELECT id, statut FROM journees WHERE date = ?1",
            params![date],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?)
}

// ------------------------------------------------------------------ API publique

impl Base {
    pub fn produits(&self, inclure_inactifs: bool) -> Resultat<Vec<Produit>> {
        lire_produits(&self.conn, inclure_inactifs)
    }

    pub fn produit(&self, id: i64) -> Resultat<Produit> {
        lire_produit(&self.conn, id)
    }

    /// Format d'un produit : bouteilles par conditionnement et conditionnement (`None` = celui par défaut).
    pub fn definir_format(
        &self,
        produit_id: i64,
        bouteilles_par_conditionnement: i64,
        conditionnement_id: Option<i64>,
    ) -> Resultat<()> {
        if bouteilles_par_conditionnement <= 0 {
            return refus("Le nombre de bouteilles par conditionnement doit être positif.");
        }
        let n = self.conn.execute(
            "UPDATE produits SET bt_par_conditionnement = ?2, conditionnement_id = ?3, format_a_confirmer = 0 WHERE id = ?1",
            params![produit_id, bouteilles_par_conditionnement, conditionnement_id],
        )?;
        if n == 0 {
            refus(format!("Produit inconnu (n° {produit_id})."))
        } else {
            Ok(())
        }
    }

    /// Nouveau prix de vente (RG-04) à partir de `date_debut` ; remplace un prix existant à la même date.
    pub fn definir_prix(
        &self,
        produit_id: i64,
        date_debut: &str,
        prix_vente: i64,
        prix_achat_conditionnement: Option<i64>,
    ) -> Resultat<()> {
        verifier_date(date_debut)?;
        if prix_vente < 0 || prix_achat_conditionnement.is_some_and(|p| p < 0) {
            return refus("Les prix ne peuvent pas être négatifs.");
        }
        lire_produit(&self.conn, produit_id)?;
        self.conn.execute(
            "INSERT INTO prix (produit_id, prix_vente, prix_achat_conditionnement, date_debut) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (produit_id, date_debut) DO UPDATE SET prix_vente = excluded.prix_vente, prix_achat_conditionnement = excluded.prix_achat_conditionnement",
            params![produit_id, prix_vente, prix_achat_conditionnement, date_debut],
        )?;
        Ok(())
    }

    pub fn prix_en_vigueur(&self, produit_id: i64, date: &str) -> Resultat<Option<i64>> {
        lire_prix(&self.conn, produit_id, date)
    }

    /// Stock actuel (ou au soir de `jusqu_au`) d'un lieu, en bouteilles.
    pub fn stock(&self, produit_id: i64, lieu: Lieu, jusqu_au: Option<&str>) -> Resultat<i64> {
        lire_stock(&self.conn, produit_id, lieu, jusqu_au)
    }

    /// Stock d'ouverture à la mise en service (EF-42) : (produit, dépôt en bouteilles, boutique en bouteilles).
    pub fn stock_ouverture(&mut self, date: &str, lignes: &[(i64, i64, i64)]) -> Resultat<()> {
        verifier_date(date)?;
        let tx = self.conn.transaction()?;
        let deja: i64 = tx.query_row(
            "SELECT COUNT(*) FROM journees WHERE statut = 'validee'",
            [],
            |r| r.get(0),
        )?;
        if deja > 0 {
            return refus(
                "Le stock d’ouverture ne peut plus être saisi après la première journée validée ; utilisez un inventaire.",
            );
        }
        for &(produit_id, depot, boutique) in lines_ok(lignes)? {
            lire_produit(&tx, produit_id)?;
            mouvement(
                &tx,
                date,
                produit_id,
                Lieu::Depot,
                depot,
                "ouverture",
                ("", 0),
                "Stock d’ouverture",
            )?;
            mouvement(
                &tx,
                date,
                produit_id,
                Lieu::Boutique,
                boutique,
                "ouverture",
                ("", 0),
                "Stock d’ouverture",
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn ajouter_fournisseur(&self, nom: &str, telephone: &str) -> Resultat<i64> {
        if nom.trim().is_empty() {
            return refus("Le nom du fournisseur est obligatoire.");
        }
        self.conn.execute(
            "INSERT INTO fournisseurs (nom, telephone) VALUES (?1, ?2)",
            params![nom.trim(), telephone.trim()],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Réception fournisseur au dépôt (EF-20).
    pub fn enregistrer_reception(&mut self, r: &ReceptionSaisie) -> Resultat<i64> {
        verifier_date(&r.date)?;
        if r.lignes.is_empty() {
            return refus("La réception ne contient aucune ligne.");
        }
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO receptions (date, fournisseur_id, num_bl, notes) VALUES (?1, ?2, ?3, ?4)",
            params![r.date, r.fournisseur_id, r.num_bl.trim(), r.notes],
        )?;
        let id = tx.last_insert_rowid();
        for l in &r.lignes {
            let p = lire_produit(&tx, l.produit_id)?;
            let bt = p.format.en_bouteilles(l.conditionnements, l.bouteilles);
            if bt <= 0 || l.conditionnements < 0 || l.bouteilles < 0 {
                return refus(format!("{} : quantité reçue invalide.", p.designation()));
            }
            let achat = r
                .prix_achat
                .iter()
                .find(|(pid, _)| *pid == l.produit_id)
                .map(|x| x.1);
            tx.execute(
                "INSERT INTO lignes_reception (reception_id, produit_id, bouteilles, prix_achat_conditionnement) VALUES (?1, ?2, ?3, ?4)",
                params![id, l.produit_id, bt, achat],
            )?;
            mouvement(
                &tx,
                &r.date,
                l.produit_id,
                Lieu::Depot,
                bt,
                "reception",
                ("reception", id),
                "",
            )?;
        }
        tx.commit()?;
        Ok(id)
    }

    /// Alimentation de la boutique depuis le dépôt (EF-21), hors fiche journalière.
    pub fn enregistrer_alimentation(
        &mut self,
        date: &str,
        lignes: &[LigneQuantite],
        notes: &str,
    ) -> Resultat<i64> {
        verifier_date(date)?;
        let tx = self.conn.transaction()?;
        let mut bt = Vec::new();
        for l in lignes {
            let p = lire_produit(&tx, l.produit_id)?;
            bt.push((
                l.produit_id,
                p.format.en_bouteilles(l.conditionnements, l.bouteilles),
            ));
        }
        let id = alimenter(&tx, date, &bt, None, notes)?
            .ok_or_else(|| Erreur::Refus("L’alimentation ne contient aucune quantité.".into()))?;
        tx.commit()?;
        Ok(id)
    }

    /// Inventaire physique (EF-22) : enregistre les écarts comme mouvements ; retourne (produit, écart).
    pub fn enregistrer_inventaire(
        &mut self,
        date: &str,
        lieu: Lieu,
        comptes: &[(i64, i64)],
        notes: &str,
    ) -> Resultat<Vec<(i64, i64)>> {
        verifier_date(date)?;
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO inventaires (date, lieu, notes) VALUES (?1, ?2, ?3)",
            params![date, lieu.code(), notes],
        )?;
        let id = tx.last_insert_rowid();
        let mut ecarts = Vec::new();
        for &(produit_id, compte) in comptes {
            if compte < 0 {
                return refus("Une quantité comptée ne peut pas être négative.");
            }
            lire_produit(&tx, produit_id)?;
            let theorique = lire_stock(&tx, produit_id, lieu, Some(date))?;
            let ecart = compte - theorique;
            tx.execute(
                "INSERT INTO lignes_inventaire (inventaire_id, produit_id, theorique, compte, ecart) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, produit_id, theorique, compte, ecart],
            )?;
            mouvement(
                &tx,
                date,
                produit_id,
                lieu,
                ecart,
                "inventaire",
                ("inventaire", id),
                notes,
            )?;
            ecarts.push((produit_id, ecart));
        }
        tx.commit()?;
        Ok(ecarts)
    }

    /// Lignes d'une nouvelle fiche : stock initial, alimentation déjà enregistrée et prix du jour.
    pub fn preparer_fiche(&self, date: &str) -> Resultat<Vec<LignePreparee>> {
        verifier_date(date)?;
        lire_produits(&self.conn, false)?
            .into_iter()
            .map(|p| {
                Ok(LignePreparee {
                    stock_initial: stock_avant(&self.conn, p.id, Lieu::Boutique, date)?,
                    alimentation_enregistree: alimentation_du_jour(&self.conn, p.id, date)?,
                    prix: lire_prix(&self.conn, p.id, date)?,
                    produit: p,
                })
            })
            .collect()
    }

    /// Calcule la fiche sans rien enregistrer (affichage en direct).
    pub fn apercu_fiche(
        &self,
        fiche: &FicheSaisie,
    ) -> Resultat<(Vec<(i64, LigneCalculee)>, BilanCaisse)> {
        verifier_date(&fiche.date)?;
        let lignes = calculer_fiche(&self.conn, fiche)?;
        let montants: Vec<i64> = lignes.iter().map(|l| l.2.montant).collect();
        let depenses: Vec<i64> = fiche.depenses.iter().map(|d| d.1).collect();
        Ok((
            lignes.into_iter().map(|(id, _, l, _)| (id, l)).collect(),
            bilan_caisse(&montants, fiche.total_recu, &depenses),
        ))
    }

    /// Enregistre la fiche en brouillon (RG-20) : aucun mouvement de stock.
    pub fn enregistrer_brouillon(&mut self, fiche: &FicheSaisie) -> Resultat<i64> {
        verifier_date(&fiche.date)?;
        let tx = self.conn.transaction()?;
        let id = match journee_existante(&tx, &fiche.date)? {
            Some((_, statut)) if statut == "validee" => {
                return refus("Cette journée est déjà validée.");
            }
            Some((id, _)) => id,
            None => {
                tx.execute(
                    "INSERT INTO journees (date) VALUES (?1)",
                    params![fiche.date],
                )?;
                tx.last_insert_rowid()
            }
        };
        let lignes = calculer_fiche(&tx, fiche)?;
        enregistrer_lignes_journee(&tx, id, &lignes, fiche)?;
        tx.commit()?;
        Ok(id)
    }

    /// Valide la journée (RG-20, RG-21) : contrôles, alimentation, ventes et casse dans une seule transaction.
    pub fn valider_journee(&mut self, fiche: &FicheSaisie) -> Resultat<BilanJournee> {
        verifier_date(&fiche.date)?;
        let tx = self.conn.transaction()?;
        if let Some((_, statut)) = journee_existante(&tx, &fiche.date)?
            && statut == "validee" {
                return refus("Cette journée est déjà validée.");
            }
        let anterieure: Option<String> = tx.query_row(
            "SELECT MIN(date) FROM journees WHERE date < ?1 AND statut = 'brouillon'",
            params![fiche.date],
            |r| r.get(0),
        )?;
        if let Some(d) = anterieure {
            return refus(format!(
                "Validez d’abord la journée du {d}, encore en brouillon."
            ));
        }
        let posterieure: Option<String> = tx.query_row(
            "SELECT MAX(date) FROM journees WHERE date > ?1 AND statut = 'validee'",
            params![fiche.date],
            |r| r.get(0),
        )?;
        if let Some(d) = posterieure {
            return refus(format!(
                "La journée du {d} est déjà validée : une journée antérieure ne peut plus être ajoutée."
            ));
        }

        let lignes = calculer_fiche(&tx, fiche)?;
        let bloquantes: Vec<_> = lignes
            .iter()
            .filter(|(_, _, l, _)| l.bloquante())
            .map(|(id, _, l, _)| (*id, l.alertes.clone()))
            .collect();
        if !bloquantes.is_empty() {
            return Err(Erreur::LignesBloquantes(bloquantes));
        }

        let id = match journee_existante(&tx, &fiche.date)? {
            Some((id, _)) => id,
            None => {
                tx.execute(
                    "INSERT INTO journees (date) VALUES (?1)",
                    params![fiche.date],
                )?;
                tx.last_insert_rowid()
            }
        };
        let supplements: Vec<(i64, i64)> =
            lignes.iter().map(|(pid, _, _, sup)| (*pid, *sup)).collect();
        alimenter(
            &tx,
            &fiche.date,
            &supplements,
            Some(id),
            "Alimentation notée sur la fiche",
        )?;
        for (produit_id, s, l, _) in &lignes {
            mouvement(
                &tx,
                &fiche.date,
                *produit_id,
                Lieu::Boutique,
                -l.ventes,
                "vente",
                ("journee", id),
                "",
            )?;
            mouvement(
                &tx,
                &fiche.date,
                *produit_id,
                Lieu::Boutique,
                -s.casse,
                "casse",
                ("journee", id),
                "",
            )?;
        }
        let caisse = enregistrer_lignes_journee(&tx, id, &lignes, fiche)?;
        tx.execute(
            "UPDATE journees SET statut = 'validee', valide_le = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        tx.commit()?;
        Ok(BilanJournee {
            journee_id: id,
            lignes: lignes.into_iter().map(|(pid, _, l, _)| (pid, l)).collect(),
            caisse,
        })
    }

    /// Situation actuelle des stocks (EF-02), à la date `date` incluse.
    pub fn situation(&self, date: &str) -> Resultat<Vec<SituationProduit>> {
        verifier_date(date)?;
        lire_produits(&self.conn, false)?
            .into_iter()
            .map(|p| {
                let depot = lire_stock(&self.conn, p.id, Lieu::Depot, Some(date))?;
                let boutique = lire_stock(&self.conn, p.id, Lieu::Boutique, Some(date))?;
                let prix = lire_prix(&self.conn, p.id, date)?;
                let total = depot + boutique;
                Ok(SituationProduit {
                    alerte_depot: depot
                        < p.seuil_depot_conditionnements * p.format.bouteilles_par_conditionnement,
                    alerte_boutique: boutique < p.seuil_boutique_bt,
                    valeur: total * prix.unwrap_or(0),
                    depot,
                    boutique,
                    total,
                    prix,
                    produit: p,
                })
            })
            .collect()
    }
}

fn lines_ok(lignes: &[(i64, i64, i64)]) -> Resultat<&[(i64, i64, i64)]> {
    if lignes.iter().any(|&(_, d, b)| d < 0 || b < 0) {
        refus("Le stock d’ouverture ne peut pas être négatif.")
    } else {
        Ok(lignes)
    }
}

#[cfg(test)]
mod tests;
