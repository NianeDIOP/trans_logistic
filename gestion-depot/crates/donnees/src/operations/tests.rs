//! Cas de recette du cahier des charges (chapitre 14) sur une base en mémoire.

use super::*;
use noyau::Alerte;

/// Base avec Heineken PM (caisses de 24, 600 F) et Whisky Black 3/4 (caisses de 12, 6 000 F).
fn base() -> (Base, i64, i64) {
    let base = Base::en_memoire().unwrap();
    let id = |nom: &str| {
        base.produits(false)
            .unwrap()
            .into_iter()
            .find(|p| p.designation() == nom)
            .unwrap()
            .id
    };
    let (heineken, whisky) = (id("Heineken PM"), id("Whisky Black 3/4"));
    base.definir_format(heineken, 24, None).unwrap();
    base.definir_format(whisky, 12, None).unwrap();
    base.definir_prix(heineken, "2026-10-01", 600, Some(12_000))
        .unwrap();
    base.definir_prix(whisky, "2026-10-01", 6_000, None)
        .unwrap();
    (base, heineken, whisky)
}

fn reception(date: &str, produit_id: i64, caisses: i64) -> ReceptionSaisie {
    ReceptionSaisie {
        date: date.into(),
        lignes: vec![LigneQuantite {
            produit_id,
            conditionnements: caisses,
            bouteilles: 0,
        }],
        ..Default::default()
    }
}

#[test]
fn migration_et_catalogue_initial() {
    let base = Base::en_memoire().unwrap();
    assert_eq!(base.version_schema().unwrap(), 1);
    let produits = base.produits(false).unwrap();
    assert_eq!(produits.len(), 29);
    assert!(produits.iter().all(|p| p.format_a_confirmer));
    assert_eq!(
        produits[0].format.conditionnement.singulier, "caisse",
        "conditionnement par défaut"
    );
}

#[test]
fn t1_reception_au_depot() {
    let (mut base, heineken, _) = base();
    base.enregistrer_reception(&reception("2026-10-13", heineken, 30))
        .unwrap();
    assert_eq!(base.stock(heineken, Lieu::Depot, None).unwrap(), 720);
    let p = base.produit(heineken).unwrap();
    assert_eq!(noyau::quantite_lisible(720, &p.format), "30 caisses");
}

#[test]
fn t3_t4_journee_complete() {
    let (mut base, heineken, whisky) = base();
    base.enregistrer_reception(&reception("2026-10-13", heineken, 30))
        .unwrap();
    base.stock_ouverture("2026-10-13", &[(heineken, 0, 18), (whisky, 24, 7)])
        .unwrap();

    let prep = base.preparer_fiche("2026-10-14").unwrap();
    let h = prep.iter().find(|l| l.produit.id == heineken).unwrap();
    assert_eq!((h.stock_initial, h.prix), (18, Some(600)));

    let fiche = FicheSaisie {
        date: "2026-10-14".into(),
        lignes: vec![
            (
                heineken,
                SaisieLigne {
                    alimentation_conditionnements: 2,
                    stock_restant: Some(21),
                    ..Default::default()
                },
            ),
            (
                whisky,
                SaisieLigne {
                    stock_restant: Some(4),
                    casse: 1,
                    ..Default::default()
                },
            ),
        ],
        total_recu: 37_500,
        depenses: vec![("Glace".into(), 1_000)],
        observations: String::new(),
    };
    let bilan = base.valider_journee(&fiche).unwrap();
    let ligne = |id| {
        bilan
            .lignes
            .iter()
            .find(|(p, _)| *p == id)
            .unwrap()
            .1
            .clone()
    };
    assert_eq!(
        (ligne(heineken).ventes, ligne(heineken).montant),
        (45, 27_000)
    );
    assert_eq!((ligne(whisky).ventes, ligne(whisky).montant), (2, 12_000));
    assert_eq!(bilan.caisse.total_ventes, 39_000);
    assert_eq!(bilan.caisse.ecart, -500, "37 500 + 1 000 − 39 000");

    assert_eq!(
        base.stock(heineken, Lieu::Depot, None).unwrap(),
        672,
        "28 caisses"
    );
    assert_eq!(base.stock(heineken, Lieu::Boutique, None).unwrap(), 21);
    assert_eq!(base.stock(whisky, Lieu::Boutique, None).unwrap(), 4);

    // Le lendemain, le stock initial reprend le stock restant.
    let prep = base.preparer_fiche("2026-10-15").unwrap();
    assert_eq!(
        prep.iter()
            .find(|l| l.produit.id == heineken)
            .unwrap()
            .stock_initial,
        21
    );
    let s = base.situation("2026-10-15").unwrap();
    let h = s.iter().find(|x| x.produit.id == heineken).unwrap();
    assert_eq!(
        (h.depot, h.boutique, h.total, h.valeur),
        (672, 21, 693, 693 * 600)
    );

    assert!(
        matches!(base.valider_journee(&fiche), Err(Erreur::Refus(_))),
        "une journée validée ne se revalide pas"
    );
}

#[test]
fn t5_ligne_bloquante() {
    let (mut base, heineken, _) = base();
    base.stock_ouverture("2026-10-13", &[(heineken, 0, 3)])
        .unwrap();
    let fiche = FicheSaisie {
        date: "2026-10-14".into(),
        lignes: vec![(
            heineken,
            SaisieLigne {
                stock_restant: Some(4),
                ..Default::default()
            },
        )],
        ..Default::default()
    };
    match base.valider_journee(&fiche) {
        Err(Erreur::LignesBloquantes(l)) => assert_eq!(
            l,
            vec![(
                heineken,
                vec![Alerte::RestantSuperieurAuTotal {
                    restant: 4,
                    total: 3
                }]
            )]
        ),
        autre => panic!("attendu : ligne bloquante, obtenu {autre:?}"),
    }
    assert_eq!(
        base.stock(heineken, Lieu::Boutique, None).unwrap(),
        3,
        "rien n’est écrit"
    );
}

#[test]
fn ventes_sans_prix_bloquantes() {
    let (mut base, _, _) = base();
    let sans_prix = base
        .produits(false)
        .unwrap()
        .into_iter()
        .find(|p| p.designation() == "Vodka")
        .unwrap()
        .id;
    base.stock_ouverture("2026-10-13", &[(sans_prix, 0, 10)])
        .unwrap();
    let fiche = FicheSaisie {
        date: "2026-10-14".into(),
        lignes: vec![(
            sans_prix,
            SaisieLigne {
                stock_restant: Some(8),
                ..Default::default()
            },
        )],
        ..Default::default()
    };
    assert!(matches!(
        base.valider_journee(&fiche),
        Err(Erreur::LignesBloquantes(_))
    ));
}

#[test]
fn t8_alimentation_superieure_au_depot() {
    let (mut base, heineken, _) = base();
    base.enregistrer_reception(&reception("2026-10-13", heineken, 3))
        .unwrap();
    let err = base
        .enregistrer_alimentation(
            "2026-10-14",
            &[LigneQuantite {
                produit_id: heineken,
                conditionnements: 5,
                bouteilles: 0,
            }],
            "",
        )
        .unwrap_err();
    assert!(
        err.to_string()
            .contains("le dépôt n’en contient que 3 caisses"),
        "{err}"
    );

    // Même contrôle quand l'alimentation est notée sur la fiche.
    let fiche = FicheSaisie {
        date: "2026-10-14".into(),
        lignes: vec![(
            heineken,
            SaisieLigne {
                alimentation_conditionnements: 5,
                stock_restant: Some(0),
                ..Default::default()
            },
        )],
        ..Default::default()
    };
    assert!(matches!(
        base.valider_journee(&fiche),
        Err(Erreur::Refus(_))
    ));
    assert_eq!(base.stock(heineken, Lieu::Depot, None).unwrap(), 72);
}

#[test]
fn alimentation_enregistree_avant_la_fiche() {
    let (mut base, heineken, _) = base();
    base.enregistrer_reception(&reception("2026-10-13", heineken, 10))
        .unwrap();
    base.enregistrer_alimentation(
        "2026-10-14",
        &[LigneQuantite {
            produit_id: heineken,
            conditionnements: 1,
            bouteilles: 0,
        }],
        "Matin",
    )
    .unwrap();
    let prep = base.preparer_fiche("2026-10-14").unwrap();
    let h = prep.iter().find(|l| l.produit.id == heineken).unwrap();
    assert_eq!((h.stock_initial, h.alimentation_enregistree), (0, 24));

    let fiche = FicheSaisie {
        date: "2026-10-14".into(),
        lignes: vec![(
            heineken,
            SaisieLigne {
                alimentation_conditionnements: 1,
                stock_restant: Some(30),
                ..Default::default()
            },
        )],
        total_recu: 18 * 600,
        ..Default::default()
    };
    let bilan = base.valider_journee(&fiche).unwrap();
    let l = &bilan.lignes.iter().find(|(p, _)| *p == heineken).unwrap().1;
    assert_eq!((l.alimentation, l.stock_total, l.ventes), (48, 48, 18));
    assert_eq!(base.stock(heineken, Lieu::Depot, None).unwrap(), 240 - 48);
    assert_eq!(bilan.caisse.ecart, 0);
}

#[test]
fn t9_changement_de_prix() {
    let (base, heineken, _) = base();
    base.definir_prix(heineken, "2026-11-01", 650, None)
        .unwrap();
    assert_eq!(
        base.prix_en_vigueur(heineken, "2026-10-31").unwrap(),
        Some(600)
    );
    assert_eq!(
        base.prix_en_vigueur(heineken, "2026-11-01").unwrap(),
        Some(650)
    );
    assert_eq!(base.prix_en_vigueur(heineken, "2026-09-30").unwrap(), None);
}

#[test]
fn t11_inventaire_du_depot() {
    let (mut base, heineken, _) = base();
    base.enregistrer_reception(&reception("2026-10-13", heineken, 28))
        .unwrap();
    let ecarts = base
        .enregistrer_inventaire(
            "2026-10-20",
            Lieu::Depot,
            &[(heineken, 660)],
            "Comptage mensuel",
        )
        .unwrap();
    assert_eq!(ecarts, vec![(heineken, -12)]);
    assert_eq!(base.stock(heineken, Lieu::Depot, None).unwrap(), 660);
}

#[test]
fn ordre_des_journees() {
    let (mut base, heineken, _) = base();
    base.stock_ouverture("2026-10-13", &[(heineken, 0, 50)])
        .unwrap();
    let fiche = |date: &str| FicheSaisie {
        date: date.into(),
        ..Default::default()
    };
    base.enregistrer_brouillon(&fiche("2026-10-14")).unwrap();
    let err = base.valider_journee(&fiche("2026-10-15")).unwrap_err();
    assert!(err.to_string().contains("2026-10-14"), "{err}");
    base.valider_journee(&fiche("2026-10-14")).unwrap();
    base.valider_journee(&fiche("2026-10-16")).unwrap();
    assert!(
        base.valider_journee(&fiche("2026-10-15")).is_err(),
        "journée antérieure à une journée validée"
    );
    assert!(
        base.stock_ouverture("2026-10-17", &[(heineken, 1, 1)])
            .is_err()
    );
}

#[test]
fn dates_invalides_refusees() {
    let (base, heineken, _) = base();
    assert!(
        base.definir_prix(heineken, "14/10/2026", 600, None)
            .is_err()
    );
    assert!(base.preparer_fiche("2026-13-01").is_err());
    assert!(date_valide("2026-10-14"));
}

#[test]
fn stock_ouverture_resaisi_sans_doublon() {
    let (mut base, heineken, _) = base();
    base.stock_ouverture("2026-10-13", &[(heineken, 48, 10)])
        .unwrap();
    base.stock_ouverture("2026-10-13", &[(heineken, 72, 0)])
        .unwrap();
    assert_eq!(base.stock(heineken, Lieu::Depot, None).unwrap(), 72);
    assert_eq!(base.stock(heineken, Lieu::Boutique, None).unwrap(), 0);
    let (date, lignes) = base.stock_ouverture_actuel().unwrap();
    assert_eq!(date.as_deref(), Some("2026-10-13"));
    assert_eq!(lignes, vec![(heineken, 72, 0)]);
}
