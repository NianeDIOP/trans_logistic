//! Crée une base de démonstration (boutique fictive, prix d'illustration) pour essayer l'application.
//!
//! ```text
//! cargo run -p donnees --example demo -- /chemin/dossier
//! GD_DONNEES=/chemin/dossier  (puis lancer l'application)
//! ```

use donnees::{Base, FicheSaisie, Identite, LigneQuantite, ReceptionSaisie};
use noyau::fiche::SaisieLigne;

/// (désignation, bouteilles par caisse, prix de vente d'illustration)
const FORMATS: [(&str, i64, i64); 29] = [
    ("Bronson 3/4", 12, 2_500),
    ("Best Seller 1/2", 24, 1_500),
    ("Valmeras 1/2", 24, 1_500),
    ("Don Garcia PM", 24, 1_000),
    ("Pichet", 12, 2_000),
    ("Don Garcia", 12, 2_000),
    ("Captain 1 L", 12, 4_000),
    ("Captain 3/4", 12, 3_000),
    ("Heineken GM", 12, 1_000),
    ("Margnat + Palais", 12, 2_500),
    ("Pastis Bastonde", 12, 3_500),
    ("Valmeras 1 L", 12, 2_500),
    ("Whisky Black 1 L", 12, 7_500),
    ("Heineken PM", 24, 600),
    ("Whisky Black 3/4", 12, 6_000),
    ("Whisky Club 7 1 L", 12, 5_000),
    ("Hallwis 1/2", 24, 1_500),
    ("Royal", 12, 2_000),
    ("Saint Sernin", 12, 3_000),
    ("Merlot", 12, 3_500),
    ("Merlot / Syrah", 12, 4_000),
    ("Meister", 24, 800),
    ("Cap 1/2", 24, 1_500),
    ("Club 7 1/2", 24, 2_500),
    ("Baron", 12, 3_000),
    ("Pastis 1/2", 24, 2_000),
    ("Vodka", 12, 4_500),
    ("Exo", 24, 700),
    ("Buzz", 24, 700),
];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dossier = std::env::args().nth(1).ok_or("usage : demo <dossier>")?;
    std::fs::create_dir_all(&dossier)?;
    let chemin = std::path::Path::new(&dossier).join("gestion_depot.db");
    if chemin.exists() {
        std::fs::remove_file(&chemin)?;
    }
    let mut base = Base::ouvrir(&chemin)?;
    base.modifier_identite(&Identite {
        nom_commercial: "Boutique Teranga Boissons".into(),
        slogan: "Boissons fraîches tous les jours".into(),
        adresse: "Marché central, Louga".into(),
        telephones: "77 000 00 00".into(),
        email: String::new(),
        ninea: String::new(),
        rc: String::new(),
        logo_path: None,
    })?;
    let produits = base.produits(false)?;
    let mut reception = ReceptionSaisie {
        date: "2026-10-01".into(),
        num_bl: "BL 2026-0412".into(),
        ..Default::default()
    };
    let mut ouverture = Vec::new();
    for (i, (nom, bt, prix)) in FORMATS.iter().enumerate() {
        let p = produits
            .iter()
            .find(|p| p.designation() == *nom)
            .ok_or(format!("produit inconnu : {nom}"))?;
        // Seuils : 2 caisses au dépôt, une demi-caisse en boutique.
        let s = donnees::ProduitSaisie {
            nom: p.nom.clone(),
            contenance: p.contenance.clone(),
            categorie: p.categorie.clone(),
            conditionnement_id: None,
            bt_par_conditionnement: *bt,
            seuil_depot_conditionnements: 2,
            seuil_boutique_bt: bt / 2,
            actif: true,
        };
        base.modifier_produit(p.id, &s)?;
        base.definir_prix(p.id, "2026-10-01", *prix, Some(prix * bt * 8 / 10))?;
        let i = i as i64;
        ouverture.push((p.id, 0, (i * 7) % 18 + 3));
        reception.lignes.push(LigneQuantite {
            produit_id: p.id,
            conditionnements: (i * 5) % 14 + 1,
            bouteilles: if i % 4 == 0 { 5 } else { 0 },
        });
    }
    base.stock_ouverture("2026-09-30", &ouverture)?;
    base.enregistrer_reception(&reception)?;

    // Deux semaines de fiches : une alimentation au dépôt le 6, des ventes chaque jour, un brouillon le 15.
    let alimentation: Vec<LigneQuantite> = reception
        .lignes
        .iter()
        .filter(|l| l.conditionnements >= 2)
        .map(|l| LigneQuantite {
            produit_id: l.produit_id,
            conditionnements: 1,
            bouteilles: 0,
        })
        .collect();
    for jour in 2..=15 {
        let date = format!("2026-10-{jour:02}");
        if jour == 6 {
            base.enregistrer_alimentation(&date, &alimentation, "Réassort de la semaine")?;
        }
        let mut fiche = FicheSaisie {
            date: date.clone(),
            ..Default::default()
        };
        let situation = base.situation(&date)?;
        let mut ventes = 0;
        for (i, l) in base.preparer_fiche(&date)?.iter().enumerate() {
            let i = i as i64;
            // Le vendeur reçoit une caisse quand la boutique descend sous 3 bouteilles.
            let au_depot = situation
                .iter()
                .find(|s| s.produit.id == l.produit.id)
                .map_or(0, |s| s.depot);
            let bt = l.produit.format.bouteilles_par_conditionnement;
            let alim = i64::from(l.stock_initial < 3 && i % 3 != 0 && au_depot >= bt);
            let total = l.stock_initial + alim * bt + l.alimentation_enregistree;
            let vendu = ((i * 3 + jour * 7) % 6).min(total);
            if alim == 0 && vendu == 0 {
                continue;
            }
            ventes += vendu * l.prix.unwrap_or(0);
            fiche.lignes.push((
                l.produit.id,
                SaisieLigne {
                    alimentation_conditionnements: alim,
                    stock_restant: Some(total - vendu),
                    ..Default::default()
                },
            ));
        }
        let depenses = if jour % 3 == 0 { 2_500 } else { 0 };
        let ecart = match jour % 5 {
            1 => -1_000,
            3 => 500,
            _ => 0,
        };
        fiche.total_recu = ventes - depenses + ecart;
        if depenses > 0 {
            fiche.depenses.push(("Glace et sachets".into(), depenses));
        }
        if jour == 15 {
            base.enregistrer_brouillon(&fiche)?;
        } else {
            base.valider_journee(&fiche)?;
        }
    }
    println!("Base de démonstration créée : {}", chemin.display());
    Ok(())
}
