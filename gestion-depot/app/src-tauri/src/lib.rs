//! Application de bureau : ouvre la base dans le dossier de données de l'application et expose
//! les commandes appelées par l'interface. Aucune règle de gestion ici : tout passe par `donnees`
//! et `noyau`.

mod commandes;
mod excel;
mod journal;
mod securite;

use donnees::Base;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::AtomicBool;
use tauri::Manager;

/// État partagé entre les commandes.
pub struct Etat {
    pub base: Mutex<Base>,
    /// Dossier des images (logo).
    pub images: PathBuf,
    /// Dossier des données (base, images, sauvegardes automatiques, journal des erreurs).
    pub dossier: PathBuf,
    /// Faux tant que le mot de passe n'a pas été saisi (ET-10).
    pub deverrouille: AtomicBool,
}

impl Etat {
    pub fn fichier_base(&self) -> PathBuf {
        self.dossier.join(FICHIER_BASE)
    }

    pub fn sauvegardes(&self) -> PathBuf {
        self.dossier.join("sauvegardes")
    }
}

/// Nom du fichier de base, dans le dossier de données propre à l'application.
const FICHIER_BASE: &str = "gestion_depot.db";

pub fn lancer() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // GD_DONNEES permet de pointer vers un autre dossier (démonstration, essais).
            let dossier = match std::env::var_os("GD_DONNEES") {
                Some(d) => PathBuf::from(d),
                None => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(dossier.join("images"))?;
            journal::initialiser(&dossier);
            let base = Base::ouvrir(dossier.join(FICHIER_BASE))?;
            // ET-10 : procédure d'oubli du mot de passe (fichier déposé dans le dossier des données).
            if let Err(e) = base.reinitialisation_demandee(&dossier) {
                journal::erreur(&format!("Réinitialisation du mot de passe : {e}"));
            }
            // ET-11 : une copie automatique par jour, 30 conservées.
            if let Err(e) =
                base.sauvegarde_automatique(&dossier.join("sauvegardes"), &dossier.join("images"))
            {
                journal::erreur(&format!("Sauvegarde automatique : {e}"));
            }
            let protege = base.mot_de_passe_defini().unwrap_or(false);
            if let Ok(nom) = base.identite().map(|i| i.nom_commercial)
                && let Some(fenetre) = app.get_webview_window("principale")
            {
                let _ = fenetre.set_title(&format!("{nom} — Gestion Dépôt et Boutique"));
            }
            // Développement : GD_ECRAN=parametres/produits ouvre directement un écran.
            #[cfg(debug_assertions)]
            if let (Ok(ecran), Some(fenetre)) = (
                std::env::var("GD_ECRAN"),
                app.get_webview_window("principale"),
            ) && let Ok(mut url) = fenetre.url()
            {
                url.set_fragment(Some(&format!("/{ecran}")));
                let _ = fenetre.navigate(url);
            }
            app.manage(Etat {
                base: Mutex::new(base),
                images: dossier.join("images"),
                deverrouille: AtomicBool::new(!protege),
                dossier,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commandes::infos_app,
            commandes::accueil,
            commandes::references,
            commandes::identite_lire,
            commandes::identite_modifier,
            commandes::logo_lire,
            commandes::logo_definir,
            commandes::presentation_lire,
            commandes::presentation_modifier,
            commandes::conditionnements_lister,
            commandes::conditionnement_ajouter,
            commandes::conditionnement_modifier,
            commandes::conditionnement_defaut,
            commandes::produits_lister,
            commandes::produit_ajouter,
            commandes::produit_modifier,
            commandes::produit_deplacer,
            commandes::prix_historique,
            commandes::prix_definir,
            commandes::situation,
            commandes::stock_ouverture_possible,
            commandes::stock_ouverture_lire,
            commandes::stock_ouverture,
            commandes::fournisseurs_lister,
            commandes::fournisseur_ajouter,
            commandes::reception_enregistrer,
            commandes::receptions_lister,
            commandes::alimentation_enregistrer,
            commandes::alimentations_lister,
            commandes::inventaire_enregistrer,
            commandes::fiche_stock,
            commandes::fiche_preparer,
            commandes::fiche_apercu,
            commandes::fiche_brouillon,
            commandes::fiche_valider,
            commandes::journees_lister,
            commandes::journee_reouvrir,
            commandes::journee_lire,
            commandes::rapport_periode,
            commandes::indicateurs,
            commandes::excel_enregistrer,
            securite::securite_etat,
            securite::deverrouiller,
            securite::verrouiller,
            securite::mot_de_passe_changer,
            securite::sauvegarde_creer,
            securite::sauvegarde_verifier,
            securite::sauvegarde_restaurer,
        ])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer l’application");
}
