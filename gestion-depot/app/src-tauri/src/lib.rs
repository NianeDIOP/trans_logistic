//! Application de bureau : ouvre la base dans le dossier de données de l'application et expose
//! les commandes appelées par l'interface. Aucune règle de gestion ici : tout passe par `donnees`
//! et `noyau`.

mod commandes;

use donnees::Base;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// État partagé entre les commandes.
pub struct Etat {
    pub base: Mutex<Base>,
    /// Dossier des images (logo).
    pub images: PathBuf,
}

/// Nom du fichier de base, dans le dossier de données propre à l'application.
const FICHIER_BASE: &str = "gestion_depot.db";

pub fn lancer() {
    tauri::Builder::default()
        .setup(|app| {
            // GD_DONNEES permet de pointer vers un autre dossier (démonstration, essais).
            let dossier = match std::env::var_os("GD_DONNEES") {
                Some(d) => PathBuf::from(d),
                None => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(dossier.join("images"))?;
            let base = Base::ouvrir(dossier.join(FICHIER_BASE))?;
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
        ])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer l’application");
}
