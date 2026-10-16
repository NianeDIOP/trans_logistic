//! Commandes de sécurité et de sauvegarde (chapitre 12 : ET-10 à ET-13).

use crate::Etat;
use crate::commandes::{R, base, base_libre, texte};
use donnees::Base;
use donnees::securite::{
    CopieSauvegarde, FICHIER_REINITIALISATION, InfosSauvegarde, copies_automatiques, restaurer,
    verifier_sauvegarde,
};
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::State;

#[derive(Serialize)]
pub struct EtatSecurite {
    protege: bool,
    deverrouille: bool,
    dossier_donnees: String,
    dossier_sauvegardes: String,
    fichier_reinitialisation: &'static str,
    derniere_sauvegarde_externe: Option<String>,
    date_du_jour: String,
    copies: Vec<CopieSauvegarde>,
}

#[tauri::command]
pub fn securite_etat(etat: State<Etat>) -> R<EtatSecurite> {
    let b = base_libre(&etat)?;
    let deverrouille = etat.deverrouille.load(Ordering::SeqCst);
    Ok(EtatSecurite {
        protege: b.mot_de_passe_defini().map_err(texte)?,
        deverrouille,
        dossier_donnees: etat.dossier.to_string_lossy().into_owned(),
        dossier_sauvegardes: etat.sauvegardes().to_string_lossy().into_owned(),
        fichier_reinitialisation: FICHIER_REINITIALISATION,
        derniere_sauvegarde_externe: b.derniere_sauvegarde_externe().map_err(texte)?,
        date_du_jour: b.date_du_jour().map_err(texte)?,
        // La liste des copies n'est montrée qu'une fois l'application ouverte.
        copies: if deverrouille {
            copies_automatiques(&etat.sauvegardes())
        } else {
            Vec::new()
        },
    })
}

#[tauri::command]
pub fn deverrouiller(etat: State<Etat>, mot_de_passe: String) -> R<bool> {
    let bon = base_libre(&etat)?
        .verifier_mot_de_passe(&mot_de_passe)
        .map_err(texte)?;
    if bon {
        etat.deverrouille.store(true, Ordering::SeqCst);
    } else {
        // Freine les essais successifs.
        std::thread::sleep(std::time::Duration::from_millis(700));
    }
    Ok(bon)
}

#[tauri::command]
pub fn verrouiller(etat: State<Etat>) -> R<()> {
    if base_libre(&etat)?.mot_de_passe_defini().map_err(texte)? {
        etat.deverrouille.store(false, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn mot_de_passe_changer(etat: State<Etat>, actuel: String, nouveau: Option<String>) -> R<()> {
    base(&etat)?
        .changer_mot_de_passe(&actuel, nouveau.as_deref())
        .map_err(texte)
}

/// Sauvegarde manuelle vers un dossier choisi (clé USB…) ; renvoie le chemin du fichier créé.
#[tauri::command]
pub fn sauvegarde_creer(etat: State<Etat>, dossier: String) -> R<String> {
    let chemin = base(&etat)?
        .sauvegarder_dans(Path::new(&dossier), &etat.images)
        .map_err(texte)?;
    Ok(chemin.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn sauvegarde_verifier(etat: State<Etat>, chemin: String) -> R<InfosSauvegarde> {
    drop(base(&etat)?);
    verifier_sauvegarde(Path::new(&chemin)).map_err(texte)
}

/// Restauration (ET-12) : copie de sécurité de la base actuelle, puis remplacement. En cas d'échec,
/// la base d'origine est rouverte. L'interface se recharge ensuite.
#[tauri::command]
pub fn sauvegarde_restaurer(etat: State<Etat>, chemin: String) -> R<()> {
    let source = Path::new(&chemin);
    verifier_sauvegarde(source).map_err(texte)?;
    let mut garde = base(&etat)?;
    let horodatage: String = garde
        .connexion()
        .query_row(
            "SELECT strftime('%Y-%m-%d_%Hh%M%S', 'now', 'localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(texte)?;
    let securite = etat.sauvegardes().join(format!(
        "avant-restauration-{horodatage}.{}",
        donnees::securite::EXTENSION
    ));
    std::fs::create_dir_all(etat.sauvegardes()).map_err(texte)?;
    garde.sauvegarder(&securite, &etat.images).map_err(texte)?;

    // Ferme la base actuelle en la remplaçant par une base vide en mémoire.
    *garde = Base::en_memoire().map_err(texte)?;
    match restaurer(source, &etat.fichier_base(), &etat.images) {
        Ok(nouvelle) => {
            let protege = nouvelle.mot_de_passe_defini().unwrap_or(false);
            *garde = nouvelle;
            etat.deverrouille.store(!protege, Ordering::SeqCst);
            Ok(())
        }
        Err(e) => {
            let message = texte(format!("Restauration impossible : {e}"));
            // Retour à la base d'origine par la copie de sécurité faite juste avant.
            *garde = restaurer(&securite, &etat.fichier_base(), &etat.images)
                .or_else(|_| Base::ouvrir(etat.fichier_base()))
                .map_err(texte)?;
            Err(message)
        }
    }
}
