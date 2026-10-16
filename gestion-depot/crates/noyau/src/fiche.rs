//! Calculs et contrôles d'une ligne de la fiche journalière (§ 5.2 et 5.5 du cahier des charges).
//!
//! ```text
//! ST = SI + AL          V = ST − SR − CA          M = V × PU
//! ```

use crate::stock::Format;

/// Ce qui est saisi pour un produit et une journée.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default)]
pub struct SaisieLigne {
    /// Stock initial connu de l'application (stock restant de la dernière journée validée).
    pub stock_initial: i64,
    /// Stock initial écrit par le vendeur, s'il l'a noté (contrôle RG-11).
    pub stock_initial_fiche: Option<i64>,
    /// Alimentation reçue du dépôt : conditionnements entiers + bouteilles isolées.
    pub alimentation_conditionnements: i64,
    pub alimentation_bouteilles: i64,
    /// Bouteilles comptées à la fermeture ; `None` = ligne sans mouvement (restant = stock total).
    pub stock_restant: Option<i64>,
    /// Bouteilles cassées, perdues ou offertes.
    pub casse: i64,
    /// Valeurs écrites par le vendeur, conservées pour contrôle (RG-12, RG-13).
    pub ventes_fiche: Option<i64>,
    pub prix_fiche: Option<i64>,
    pub montant_fiche: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Gravite {
    /// Empêche de valider la journée.
    Bloquante,
    /// Signalée, mais la journée peut être validée.
    Avertissement,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Alerte {
    /// RG-10 : le stock restant dépasse le stock total.
    RestantSuperieurAuTotal { restant: i64, total: i64 },
    /// Quantité saisie négative.
    ValeurNegative,
    /// Ventes non nulles sans prix de vente défini.
    PrixManquant,
    /// RG-11 : stock initial noté ≠ stock restant enregistré la veille (écart = noté − connu).
    EcartOuverture { ecart: i64 },
    /// RG-12 : ventes écrites par le vendeur ≠ ventes calculées.
    VentesDifferentes { fiche: i64, calcul: i64 },
    /// RG-12 : montant écrit ≠ montant calculé.
    MontantDifferent { fiche: i64, calcul: i64 },
    /// RG-13 : prix écrit ≠ prix paramétré.
    PrixDifferent { fiche: i64, parametre: i64 },
}

impl Alerte {
    pub fn gravite(&self) -> Gravite {
        match self {
            Alerte::RestantSuperieurAuTotal { .. }
            | Alerte::ValeurNegative
            | Alerte::PrixManquant => Gravite::Bloquante,
            _ => Gravite::Avertissement,
        }
    }

    pub fn message(&self) -> String {
        match self {
            Alerte::RestantSuperieurAuTotal { restant, total } => {
                format!("Le stock restant ({restant}) dépasse le stock total ({total}).")
            }
            Alerte::ValeurNegative => "Une quantité saisie est négative.".into(),
            Alerte::PrixManquant => "Aucun prix de vente n’est défini pour ce produit.".into(),
            Alerte::EcartOuverture { ecart } => {
                let sens = if *ecart < 0 { "de moins" } else { "de plus" };
                format!(
                    "Écart d’ouverture : {} bouteille(s) {sens} que le stock restant de la veille.",
                    ecart.abs()
                )
            }
            Alerte::VentesDifferentes { fiche, calcul } => {
                format!("Ventes notées sur la fiche : {fiche} ; ventes calculées : {calcul}.")
            }
            Alerte::MontantDifferent { fiche, calcul } => {
                format!("Montant noté sur la fiche : {fiche} F ; montant calculé : {calcul} F.")
            }
            Alerte::PrixDifferent { fiche, parametre } => {
                format!("Prix noté sur la fiche : {fiche} F ; prix paramétré : {parametre} F.")
            }
        }
    }
}

/// Résultat des calculs d'une ligne.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LigneCalculee {
    pub alimentation: i64,
    pub stock_total: i64,
    pub stock_restant: i64,
    pub ventes: i64,
    pub prix: i64,
    pub montant: i64,
    pub alertes: Vec<Alerte>,
}

impl LigneCalculee {
    pub fn bloquante(&self) -> bool {
        self.alertes
            .iter()
            .any(|a| a.gravite() == Gravite::Bloquante)
    }
}

/// Calcule une ligne : `prix` est le prix de vente en vigueur à la date de la journée (`None` s'il n'est pas défini).
pub fn calculer_ligne(saisie: &SaisieLigne, format: &Format, prix: Option<i64>) -> LigneCalculee {
    let mut alertes = Vec::new();
    let alimentation = format.en_bouteilles(
        saisie.alimentation_conditionnements,
        saisie.alimentation_bouteilles,
    );
    let stock_total = saisie.stock_initial + alimentation;
    let stock_restant = saisie.stock_restant.unwrap_or(stock_total - saisie.casse);

    let negatif = [
        saisie.alimentation_conditionnements,
        saisie.alimentation_bouteilles,
        saisie.casse,
        stock_restant,
    ]
    .iter()
    .any(|v| *v < 0);
    if negatif {
        alertes.push(Alerte::ValeurNegative);
    }
    if stock_restant + saisie.casse > stock_total {
        alertes.push(Alerte::RestantSuperieurAuTotal {
            restant: stock_restant + saisie.casse,
            total: stock_total,
        });
    }

    let ventes = (stock_total - stock_restant - saisie.casse).max(0);
    let prix_retenu = prix.unwrap_or(0);
    if prix.is_none() && ventes > 0 {
        alertes.push(Alerte::PrixManquant);
    }
    let montant = ventes * prix_retenu;

    if let Some(note) = saisie.stock_initial_fiche
        && note != saisie.stock_initial
    {
        alertes.push(Alerte::EcartOuverture {
            ecart: note - saisie.stock_initial,
        });
    }
    if let Some(fiche) = saisie.ventes_fiche
        && fiche != ventes
    {
        alertes.push(Alerte::VentesDifferentes {
            fiche,
            calcul: ventes,
        });
    }
    if let (Some(fiche), Some(parametre)) = (saisie.prix_fiche, prix)
        && fiche != parametre
    {
        alertes.push(Alerte::PrixDifferent { fiche, parametre });
    }
    if let Some(fiche) = saisie.montant_fiche
        && fiche != montant
    {
        alertes.push(Alerte::MontantDifferent {
            fiche,
            calcul: montant,
        });
    }

    LigneCalculee {
        alimentation,
        stock_total,
        stock_restant,
        ventes,
        prix: prix_retenu,
        montant,
        alertes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stock::Conditionnement;

    fn caisse(n: i64) -> Format {
        Format::new(n, Conditionnement::caisse())
    }

    #[test]
    fn t3_exemple_du_cahier_des_charges() {
        // SI 18, alimentation 2 caisses de 24, restant 21, prix 600
        let s = SaisieLigne {
            stock_initial: 18,
            alimentation_conditionnements: 2,
            stock_restant: Some(21),
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(24), Some(600));
        assert_eq!(
            (l.alimentation, l.stock_total, l.ventes, l.montant),
            (48, 66, 45, 27_000)
        );
        assert!(l.alertes.is_empty());
    }

    #[test]
    fn casse_deduite_des_ventes() {
        let s = SaisieLigne {
            stock_initial: 7,
            stock_restant: Some(4),
            casse: 1,
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(12), Some(6_000));
        assert_eq!((l.ventes, l.montant), (2, 12_000));
    }

    #[test]
    fn ligne_sans_mouvement() {
        let s = SaisieLigne {
            stock_initial: 5,
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(6), Some(5_500));
        assert_eq!((l.stock_restant, l.ventes, l.montant), (5, 0, 0));
        assert!(l.alertes.is_empty());
    }

    #[test]
    fn t5_restant_superieur_au_total_bloque() {
        let s = SaisieLigne {
            stock_initial: 3,
            stock_restant: Some(4),
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(12), Some(3_000));
        assert_eq!(
            l.alertes,
            vec![Alerte::RestantSuperieurAuTotal {
                restant: 4,
                total: 3
            }]
        );
        assert!(l.bloquante());
        assert_eq!(l.ventes, 0);
    }

    #[test]
    fn t6_ecart_d_ouverture() {
        let s = SaisieLigne {
            stock_initial: 18,
            stock_initial_fiche: Some(20),
            stock_restant: Some(18),
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(24), Some(600));
        assert_eq!(l.alertes, vec![Alerte::EcartOuverture { ecart: 2 }]);
        assert!(!l.bloquante());
    }

    #[test]
    fn t7_ventes_notees_differentes() {
        let s = SaisieLigne {
            stock_initial: 18,
            alimentation_conditionnements: 2,
            stock_restant: Some(21),
            ventes_fiche: Some(44),
            prix_fiche: Some(600),
            montant_fiche: Some(26_400),
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(24), Some(600));
        assert_eq!(l.ventes, 45, "l’application garde son calcul");
        assert_eq!(
            l.alertes,
            vec![
                Alerte::VentesDifferentes {
                    fiche: 44,
                    calcul: 45
                },
                Alerte::MontantDifferent {
                    fiche: 26_400,
                    calcul: 27_000
                }
            ]
        );
    }

    #[test]
    fn prix_note_different_et_prix_manquant() {
        let s = SaisieLigne {
            stock_initial: 10,
            stock_restant: Some(8),
            prix_fiche: Some(550),
            ..Default::default()
        };
        let l = calculer_ligne(&s, &caisse(24), Some(600));
        assert_eq!(
            l.alertes,
            vec![Alerte::PrixDifferent {
                fiche: 550,
                parametre: 600
            }]
        );
        let sans_prix = calculer_ligne(&s, &caisse(24), None);
        assert!(sans_prix.alertes.contains(&Alerte::PrixManquant));
        assert!(sans_prix.bloquante());
    }
}
