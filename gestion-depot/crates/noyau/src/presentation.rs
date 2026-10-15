//! Identité visuelle propre à l'application (chapitre 7 du cahier des charges) :
//! thèmes de couleurs (EF-54, EF-55) et modèles de documents (EF-53).

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct Theme {
    pub code: &'static str,
    pub nom: &'static str,
    /// Couleur principale (en-têtes, boutons, titres).
    pub principal: &'static str,
    /// Couleur d'accent (filets, mises en valeur).
    pub accent: &'static str,
}

const fn t(
    code: &'static str,
    nom: &'static str,
    principal: &'static str,
    accent: &'static str,
) -> Theme {
    Theme {
        code,
        nom,
        principal,
        accent,
    }
}

/// Thèmes disponibles pour l'interface et pour les documents. Le premier est celui par défaut.
pub const THEMES: [Theme; 8] = [
    t("emeraude", "Émeraude et ambre", "#123d3a", "#c8891a"),
    t("bordeaux", "Bordeaux et or", "#6d1a36", "#c8a165"),
    t("ocean", "Bleu océan", "#0f4c81", "#1fa5b8"),
    t("ardoise", "Ardoise et orange", "#2b2f36", "#e0762f"),
    t("terre", "Terre cuite", "#8a3b12", "#2f6d70"),
    t("violet", "Violet royal", "#3d2a7a", "#d9a92e"),
    t("foret", "Vert forêt", "#1f4d2b", "#8fb339"),
    t("noir_blanc", "Noir et blanc", "#111111", "#6b6b6b"),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct ModeleDocument {
    pub code: &'static str,
    pub nom: &'static str,
    pub description: &'static str,
}

pub const MODELES: [ModeleDocument; 4] = [
    ModeleDocument {
        code: "classique",
        nom: "Classique",
        description: "Logo et coordonnées en tête, tableaux à en-tête coloré.",
    },
    ModeleDocument {
        code: "bandeau",
        nom: "Bandeau",
        description: "Large bandeau de couleur en tête de page.",
    },
    ModeleDocument {
        code: "sobre",
        nom: "Sobre",
        description: "Filets fins, sans aplat de couleur : économe en encre.",
    },
    ModeleDocument {
        code: "compact",
        nom: "Compact",
        description: "Marges et textes resserrés : plus de lignes par page.",
    },
];

/// Éléments pouvant figurer dans l'en-tête des documents (EF-52).
pub const ELEMENTS_ENTETE: [(&str, &str); 4] = [
    ("nom", "Nom commercial"),
    ("slogan", "Slogan"),
    ("coordonnees", "Adresse et téléphones"),
    ("legal", "NINEA et RC"),
];

pub const POSITIONS_LOGO: [&str; 4] = ["gauche", "centre", "droite", "aucun"];

pub fn theme(code: &str) -> Option<&'static Theme> {
    THEMES.iter().find(|t| t.code == code)
}

pub fn modele(code: &str) -> Option<&'static ModeleDocument> {
    MODELES.iter().find(|m| m.code == code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn huit_themes_dont_noir_et_blanc() {
        assert_eq!(THEMES.len(), 8);
        assert!(theme("noir_blanc").is_some());
        assert_eq!(THEMES[0].code, "emeraude");
        assert!(
            THEMES
                .iter()
                .all(|t| t.principal.len() == 7 && t.accent.starts_with('#'))
        );
    }

    #[test]
    fn modeles_connus() {
        assert_eq!(
            MODELES.iter().map(|m| m.code).collect::<Vec<_>>(),
            ["classique", "bandeau", "sobre", "compact"]
        );
        assert!(modele("inconnu").is_none());
    }
}
