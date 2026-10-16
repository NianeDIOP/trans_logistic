//! Commandes Tauri. Chaque commande renvoie `Result<T, String>` : le message d'erreur est
//! directement affichable à l'utilisateur.

use crate::Etat;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use donnees::{
    Base, ConditionnementEnregistre, ConditionnementSaisie, Identite, Presentation, PrixDate,
    ProduitSaisie,
};
use noyau::catalogue::CATEGORIES;
use noyau::presentation::{
    ELEMENTS_ENTETE, MODELES, ModeleDocument, POSITIONS_LOGO, THEMES, Theme,
};
use noyau::stock::quantite_courte;
use noyau::{format_fcfa, quantite_lisible};
use serde::Serialize;
use std::sync::MutexGuard;
use tauri::State;

type R<T> = Result<T, String>;

fn base<'a>(etat: &'a State<Etat>) -> R<MutexGuard<'a, Base>> {
    etat.base
        .lock()
        .map_err(|_| "La base de données est indisponible.".to_string())
}

fn texte<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ------------------------------------------------------------------ Général

#[derive(Serialize)]
pub struct InfosApp {
    version: &'static str,
    version_schema: i64,
}

#[tauri::command]
pub fn infos_app(etat: State<Etat>) -> R<InfosApp> {
    Ok(InfosApp {
        version: env!("CARGO_PKG_VERSION"),
        version_schema: base(&etat)?.version_schema().map_err(texte)?,
    })
}

#[derive(Serialize)]
pub struct Accueil {
    identite: Identite,
    formats_a_confirmer: i64,
    produits_sans_prix: i64,
    nb_produits: usize,
    bouteilles_depot: i64,
    bouteilles_boutique: i64,
    valeur_stock: i64,
    produits_sous_seuil: usize,
}

#[tauri::command]
pub fn accueil(etat: State<Etat>, date: String) -> R<Accueil> {
    let b = base(&etat)?;
    let (formats, sans_prix) = b.a_configurer(&date).map_err(texte)?;
    let situation = b.situation(&date).map_err(texte)?;
    Ok(Accueil {
        identite: b.identite().map_err(texte)?,
        formats_a_confirmer: formats,
        produits_sans_prix: sans_prix,
        nb_produits: situation.len(),
        bouteilles_depot: situation.iter().map(|s| s.depot).sum(),
        bouteilles_boutique: situation.iter().map(|s| s.boutique).sum(),
        valeur_stock: situation.iter().map(|s| s.valeur).sum(),
        produits_sous_seuil: situation
            .iter()
            .filter(|s| s.alerte_depot || s.alerte_boutique)
            .count(),
    })
}

#[derive(Serialize)]
pub struct Categorie {
    code: &'static str,
    libelle: &'static str,
}

#[derive(Serialize)]
pub struct References {
    themes: &'static [Theme],
    modeles: &'static [ModeleDocument],
    elements_entete: Vec<Categorie>,
    positions_logo: &'static [&'static str],
    categories: Vec<Categorie>,
}

/// Listes fixes : thèmes, modèles de documents, éléments d'en-tête, catégories.
#[tauri::command]
pub fn references() -> References {
    let liste = |l: &'static [(&'static str, &'static str)]| {
        l.iter()
            .map(|(code, libelle)| Categorie { code, libelle })
            .collect()
    };
    References {
        themes: &THEMES,
        modeles: &MODELES,
        elements_entete: liste(&ELEMENTS_ENTETE),
        positions_logo: &POSITIONS_LOGO,
        categories: liste(&CATEGORIES),
    }
}

// ------------------------------------------------------------------ Identité et présentation

#[tauri::command]
pub fn identite_lire(etat: State<Etat>) -> R<Identite> {
    base(&etat)?.identite().map_err(texte)
}

#[tauri::command]
pub fn identite_modifier(etat: State<Etat>, identite: Identite) -> R<Identite> {
    base(&etat)?.modifier_identite(&identite).map_err(texte)
}

/// Logo en data URL (pour l'affichage), ou `None`.
#[tauri::command]
pub fn logo_lire(etat: State<Etat>) -> R<Option<String>> {
    let chemin = base(&etat)?.identite().map_err(texte)?.logo_path;
    let Some(chemin) = chemin else {
        return Ok(None);
    };
    let Ok(octets) = std::fs::read(&chemin) else {
        return Ok(None);
    };
    let type_mime = if chemin.ends_with(".png") {
        "image/png"
    } else if chemin.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    };
    Ok(Some(format!(
        "data:{type_mime};base64,{}",
        STANDARD.encode(octets)
    )))
}

/// Enregistre le logo reçu en data URL (PNG, JPEG ou WebP, 3 Mo maximum) ; `None` le retire.
#[tauri::command]
pub fn logo_definir(etat: State<Etat>, data_url: Option<String>) -> R<()> {
    let b = base(&etat)?;
    let Some(data_url) = data_url else {
        return b.definir_logo(None).map_err(texte);
    };
    let (entete, donnees) = data_url.split_once(',').ok_or("Image illisible.")?;
    let extension = match entete {
        e if e.starts_with("data:image/png") => "png",
        e if e.starts_with("data:image/jpeg") => "jpg",
        e if e.starts_with("data:image/webp") => "webp",
        _ => return Err("Format d’image non accepté : utilisez PNG, JPEG ou WebP.".into()),
    };
    let octets = STANDARD
        .decode(donnees)
        .map_err(|_| "Image illisible.".to_string())?;
    if octets.len() > 3 * 1024 * 1024 {
        return Err("Image trop lourde (3 Mo maximum).".into());
    }
    let chemin = etat.images.join(format!("logo.{extension}"));
    std::fs::write(&chemin, octets).map_err(texte)?;
    b.definir_logo(Some(&chemin.to_string_lossy()))
        .map_err(texte)
}

#[tauri::command]
pub fn presentation_lire(etat: State<Etat>) -> R<Presentation> {
    base(&etat)?.presentation().map_err(texte)
}

#[tauri::command]
pub fn presentation_modifier(etat: State<Etat>, presentation: Presentation) -> R<Presentation> {
    base(&etat)?
        .modifier_presentation(&presentation)
        .map_err(texte)
}

// ------------------------------------------------------------------ Conditionnements

#[tauri::command]
pub fn conditionnements_lister(etat: State<Etat>) -> R<Vec<ConditionnementEnregistre>> {
    base(&etat)?.conditionnements().map_err(texte)
}

#[tauri::command]
pub fn conditionnement_ajouter(etat: State<Etat>, saisie: ConditionnementSaisie) -> R<i64> {
    base(&etat)?.ajouter_conditionnement(&saisie).map_err(texte)
}

#[tauri::command]
pub fn conditionnement_modifier(
    etat: State<Etat>,
    id: i64,
    saisie: ConditionnementSaisie,
) -> R<()> {
    base(&etat)?
        .modifier_conditionnement(id, &saisie)
        .map_err(texte)
}

#[tauri::command]
pub fn conditionnement_defaut(etat: State<Etat>, id: i64) -> R<()> {
    base(&etat)?
        .definir_conditionnement_defaut(id)
        .map_err(texte)
}

// ------------------------------------------------------------------ Produits et prix

#[derive(Serialize)]
pub struct ProduitVue {
    id: i64,
    designation: String,
    nom: String,
    contenance: String,
    categorie: String,
    conditionnement_id: Option<i64>,
    conditionnement: String,
    conditionnement_pluriel: String,
    bt_par_conditionnement: i64,
    format_a_confirmer: bool,
    seuil_depot_conditionnements: i64,
    seuil_boutique_bt: i64,
    actif: bool,
    prix: Option<i64>,
    prix_lisible: Option<String>,
}

#[tauri::command]
pub fn produits_lister(
    etat: State<Etat>,
    inclure_inactifs: bool,
    date: String,
) -> R<Vec<ProduitVue>> {
    let b = base(&etat)?;
    b.produits(inclure_inactifs)
        .map_err(texte)?
        .into_iter()
        .map(|p| {
            let prix = b.prix_en_vigueur(p.id, &date).map_err(texte)?;
            Ok(ProduitVue {
                designation: p.designation(),
                conditionnement: p.format.conditionnement.singulier.clone(),
                conditionnement_pluriel: p.format.conditionnement.pluriel.clone(),
                bt_par_conditionnement: p.format.bouteilles_par_conditionnement,
                prix_lisible: prix.map(format_fcfa),
                prix,
                id: p.id,
                nom: p.nom,
                contenance: p.contenance,
                categorie: p.categorie,
                conditionnement_id: p.conditionnement_id,
                format_a_confirmer: p.format_a_confirmer,
                seuil_depot_conditionnements: p.seuil_depot_conditionnements,
                seuil_boutique_bt: p.seuil_boutique_bt,
                actif: p.actif,
            })
        })
        .collect()
}

#[tauri::command]
pub fn produit_ajouter(etat: State<Etat>, saisie: ProduitSaisie) -> R<i64> {
    base(&etat)?.ajouter_produit(&saisie).map_err(texte)
}

#[tauri::command]
pub fn produit_modifier(etat: State<Etat>, id: i64, saisie: ProduitSaisie) -> R<()> {
    base(&etat)?.modifier_produit(id, &saisie).map_err(texte)
}

#[tauri::command]
pub fn produit_deplacer(etat: State<Etat>, id: i64, sens: i64) -> R<()> {
    base(&etat)?.deplacer_produit(id, sens).map_err(texte)
}

#[tauri::command]
pub fn prix_historique(etat: State<Etat>, produit_id: i64) -> R<Vec<PrixDate>> {
    base(&etat)?.historique_prix(produit_id).map_err(texte)
}

#[tauri::command]
pub fn prix_definir(
    etat: State<Etat>,
    produit_id: i64,
    date_debut: String,
    prix_vente: i64,
    prix_achat: Option<i64>,
) -> R<()> {
    base(&etat)?
        .definir_prix(produit_id, &date_debut, prix_vente, prix_achat)
        .map_err(texte)
}

// ------------------------------------------------------------------ Situation et stock d'ouverture

#[derive(Serialize)]
pub struct SituationVue {
    produit_id: i64,
    designation: String,
    categorie: String,
    bt_par_conditionnement: i64,
    conditionnement: String,
    depot: i64,
    boutique: i64,
    total: i64,
    depot_lisible: String,
    depot_court: String,
    total_court: String,
    prix: Option<i64>,
    valeur: i64,
    alerte_depot: bool,
    alerte_boutique: bool,
}

#[tauri::command]
pub fn situation(etat: State<Etat>, date: String) -> R<Vec<SituationVue>> {
    let b = base(&etat)?;
    Ok(b.situation(&date)
        .map_err(texte)?
        .into_iter()
        .map(|s| SituationVue {
            produit_id: s.produit.id,
            designation: s.produit.designation(),
            categorie: s.produit.categorie.clone(),
            bt_par_conditionnement: s.produit.format.bouteilles_par_conditionnement,
            conditionnement: s.produit.format.conditionnement.abreviation.clone(),
            depot_lisible: quantite_lisible(s.depot, &s.produit.format),
            depot_court: quantite_courte(s.depot, &s.produit.format),
            total_court: quantite_courte(s.total, &s.produit.format),
            depot: s.depot,
            boutique: s.boutique,
            total: s.total,
            prix: s.prix,
            valeur: s.valeur,
            alerte_depot: s.alerte_depot,
            alerte_boutique: s.alerte_boutique,
        })
        .collect())
}

/// Le stock d'ouverture n'est possible qu'avant la première journée validée.
#[tauri::command]
pub fn stock_ouverture_possible(etat: State<Etat>) -> R<bool> {
    let b = base(&etat)?;
    let n: i64 = b
        .connexion()
        .query_row(
            "SELECT COUNT(*) FROM journees WHERE statut = 'validee'",
            [],
            |r| r.get(0),
        )
        .map_err(texte)?;
    Ok(n == 0)
}

#[derive(Serialize)]
pub struct OuvertureVue {
    date: Option<String>,
    /// (produit, dépôt en bouteilles, boutique en bouteilles)
    lignes: Vec<(i64, i64, i64)>,
}

#[tauri::command]
pub fn stock_ouverture_lire(etat: State<Etat>) -> R<OuvertureVue> {
    let (date, lignes) = base(&etat)?.stock_ouverture_actuel().map_err(texte)?;
    Ok(OuvertureVue { date, lignes })
}

#[derive(serde::Deserialize)]
pub struct LigneOuverture {
    produit_id: i64,
    depot_conditionnements: i64,
    depot_bouteilles: i64,
    boutique_bouteilles: i64,
}

#[tauri::command]
pub fn stock_ouverture(etat: State<Etat>, date: String, lignes: Vec<LigneOuverture>) -> R<()> {
    let mut b = base(&etat)?;
    let mut converties = Vec::new();
    for l in lignes {
        let p = b.produit(l.produit_id).map_err(texte)?;
        let depot = p
            .format
            .en_bouteilles(l.depot_conditionnements, l.depot_bouteilles);
        converties.push((l.produit_id, depot, l.boutique_bouteilles));
    }
    b.stock_ouverture(&date, &converties).map_err(texte)
}

// ------------------------------------------------------------------ Dépôt (lot 2)

use donnees::{
    BilanJournee, FicheSaisie, Fournisseur, JourneeEnregistree, JourneeResume, Lieu, LigneQuantite,
    MouvementStock, OperationDepot, ReceptionSaisie,
};
use noyau::LigneCalculee;

#[tauri::command]
pub fn fournisseurs_lister(etat: State<Etat>) -> R<Vec<Fournisseur>> {
    base(&etat)?.fournisseurs().map_err(texte)
}

#[tauri::command]
pub fn fournisseur_ajouter(etat: State<Etat>, nom: String, telephone: String) -> R<i64> {
    base(&etat)?
        .ajouter_fournisseur(&nom, &telephone)
        .map_err(texte)
}

#[derive(serde::Deserialize)]
pub struct ReceptionVue {
    date: String,
    fournisseur_id: Option<i64>,
    num_bl: String,
    notes: String,
    lignes: Vec<LigneQuantite>,
}

#[tauri::command]
pub fn reception_enregistrer(etat: State<Etat>, reception: ReceptionVue) -> R<i64> {
    let saisie = ReceptionSaisie {
        date: reception.date,
        fournisseur_id: reception.fournisseur_id,
        num_bl: reception.num_bl,
        notes: reception.notes,
        lignes: reception.lignes,
        prix_achat: Vec::new(),
    };
    base(&etat)?.enregistrer_reception(&saisie).map_err(texte)
}

#[tauri::command]
pub fn receptions_lister(etat: State<Etat>, du: String, au: String) -> R<Vec<OperationDepot>> {
    base(&etat)?.receptions(&du, &au).map_err(texte)
}

#[tauri::command]
pub fn alimentation_enregistrer(
    etat: State<Etat>,
    date: String,
    lignes: Vec<LigneQuantite>,
    notes: String,
) -> R<i64> {
    base(&etat)?
        .enregistrer_alimentation(&date, &lignes, &notes)
        .map_err(texte)
}

#[tauri::command]
pub fn alimentations_lister(etat: State<Etat>, du: String, au: String) -> R<Vec<OperationDepot>> {
    base(&etat)?.alimentations(&du, &au).map_err(texte)
}

/// Inventaire (EF-22) : `comptes` = (produit, bouteilles comptées) ; retourne (produit, écart).
#[tauri::command]
pub fn inventaire_enregistrer(
    etat: State<Etat>,
    date: String,
    lieu: Lieu,
    comptes: Vec<(i64, i64)>,
    notes: String,
) -> R<Vec<(i64, i64)>> {
    base(&etat)?
        .enregistrer_inventaire(&date, lieu, &comptes, &notes)
        .map_err(texte)
}

#[tauri::command]
pub fn fiche_stock(etat: State<Etat>, produit_id: i64) -> R<Vec<MouvementStock>> {
    base(&etat)?.fiche_stock(produit_id).map_err(texte)
}

// ------------------------------------------------------------------ Fiche du jour et historique (lot 3)

#[derive(Serialize)]
pub struct LigneFicheVue {
    produit_id: i64,
    designation: String,
    bt_par_conditionnement: i64,
    conditionnement: String,
    conditionnement_pluriel: String,
    stock_initial: i64,
    alimentation_enregistree: i64,
    prix: Option<i64>,
}

#[derive(Serialize)]
pub struct FichePreparee {
    lignes: Vec<LigneFicheVue>,
    /// Fiche déjà enregistrée à cette date (brouillon à reprendre, ou journée validée à consulter).
    existante: Option<JourneeEnregistree>,
    /// Date de la dernière journée validée, pour guider la saisie.
    derniere_validee: Option<String>,
}

#[tauri::command]
pub fn fiche_preparer(etat: State<Etat>, date: String) -> R<FichePreparee> {
    let b = base(&etat)?;
    let lignes = b
        .preparer_fiche(&date)
        .map_err(texte)?
        .into_iter()
        .map(|l| LigneFicheVue {
            produit_id: l.produit.id,
            designation: l.produit.designation(),
            bt_par_conditionnement: l.produit.format.bouteilles_par_conditionnement,
            conditionnement: l.produit.format.conditionnement.singulier.clone(),
            conditionnement_pluriel: l.produit.format.conditionnement.pluriel.clone(),
            stock_initial: l.stock_initial,
            alimentation_enregistree: l.alimentation_enregistree,
            prix: l.prix,
        })
        .collect();
    let derniere_validee: Option<String> = b
        .connexion()
        .query_row(
            "SELECT MAX(date) FROM journees WHERE statut = 'validee'",
            [],
            |r| r.get(0),
        )
        .map_err(texte)?;
    Ok(FichePreparee {
        lignes,
        existante: b.journee(&date).map_err(texte)?,
        derniere_validee,
    })
}

#[derive(Serialize)]
pub struct AlerteVue {
    bloquante: bool,
    message: String,
}

#[derive(Serialize)]
pub struct LigneApercu {
    produit_id: i64,
    calcul: LigneCalculee,
    alertes: Vec<AlerteVue>,
}

#[derive(Serialize)]
pub struct ApercuFiche {
    lignes: Vec<LigneApercu>,
    caisse: noyau::BilanCaisse,
}

/// Calcul en direct de la fiche (mêmes règles que la validation), sans rien enregistrer.
#[tauri::command]
pub fn fiche_apercu(etat: State<Etat>, fiche: FicheSaisie) -> R<ApercuFiche> {
    let (lignes, caisse) = base(&etat)?.apercu_fiche(&fiche).map_err(texte)?;
    Ok(ApercuFiche {
        lignes: lignes
            .into_iter()
            .map(|(produit_id, calcul)| LigneApercu {
                produit_id,
                alertes: calcul
                    .alertes
                    .iter()
                    .map(|a| AlerteVue {
                        bloquante: a.gravite() == noyau::Gravite::Bloquante,
                        message: a.message(),
                    })
                    .collect(),
                calcul,
            })
            .collect(),
        caisse,
    })
}

#[tauri::command]
pub fn fiche_brouillon(etat: State<Etat>, fiche: FicheSaisie) -> R<i64> {
    base(&etat)?.enregistrer_brouillon(&fiche).map_err(texte)
}

#[tauri::command]
pub fn fiche_valider(etat: State<Etat>, fiche: FicheSaisie) -> R<BilanJournee> {
    base(&etat)?.valider_journee(&fiche).map_err(texte)
}

#[tauri::command]
pub fn journees_lister(etat: State<Etat>, du: String, au: String) -> R<Vec<JourneeResume>> {
    base(&etat)?.journees(&du, &au).map_err(texte)
}

#[tauri::command]
pub fn journee_reouvrir(etat: State<Etat>, date: String, motif: String) -> R<()> {
    base(&etat)?.reouvrir_journee(&date, &motif).map_err(texte)
}

// ------------------------------------------------------------------ Rapports (lot 4)

#[tauri::command]
pub fn rapport_periode(etat: State<Etat>, du: String, au: String) -> R<donnees::RapportPeriode> {
    base(&etat)?.rapport_periode(&du, &au).map_err(texte)
}

#[tauri::command]
pub fn indicateurs(etat: State<Etat>, date: String) -> R<donnees::Indicateurs> {
    base(&etat)?.indicateurs(&date).map_err(texte)
}

#[tauri::command]
pub fn journee_lire(etat: State<Etat>, date: String) -> R<Option<donnees::JourneeEnregistree>> {
    base(&etat)?.journee(&date).map_err(texte)
}

/// EF-32 : écrit un classeur Excel au chemin choisi par l'utilisateur.
#[tauri::command]
pub fn excel_enregistrer(
    etat: State<Etat>,
    chemin: String,
    feuilles: Vec<crate::excel::Feuille>,
) -> R<()> {
    let boutique = base(&etat)?.identite().map_err(texte)?.nom_commercial;
    crate::excel::ecrire(&chemin, &boutique, &feuilles)
        .map_err(|e| format!("Le fichier Excel n’a pas pu être écrit : {e}"))
}
