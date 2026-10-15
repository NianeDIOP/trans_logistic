//! Catalogue initial (chapitre 4 du cahier des charges), dans l'ordre de la fiche papier.
//!
//! Le nombre de bouteilles par conditionnement et les prix restent à confirmer par le
//! propriétaire : ils sont saisis dans les Paramètres.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProduitInitial {
    pub nom: &'static str,
    /// « 3/4 », « 1/2 », « 1 L », « PM », « GM », ou vide si à préciser.
    pub contenance: &'static str,
    pub categorie: &'static str,
}

const fn p(nom: &'static str, contenance: &'static str, categorie: &'static str) -> ProduitInitial {
    ProduitInitial {
        nom,
        contenance,
        categorie,
    }
}

pub const PRODUITS_INITIAUX: [ProduitInitial; 29] = [
    p("Bronson", "3/4", "autre"),
    p("Best Seller", "1/2", "autre"),
    p("Valmeras", "1/2", "autre"),
    p("Don Garcia", "PM", "autre"),
    p("Pichet", "", "autre"),
    p("Don Garcia", "", "autre"),
    p("Captain", "1 L", "autre"),
    p("Captain", "3/4", "autre"),
    p("Heineken", "GM", "biere"),
    p("Margnat + Palais", "", "autre"),
    p("Pastis Bastonde", "", "pastis"),
    p("Valmeras", "1 L", "autre"),
    p("Whisky Black", "1 L", "whisky"),
    p("Heineken", "PM", "biere"),
    p("Whisky Black", "3/4", "whisky"),
    p("Whisky Club 7", "1 L", "whisky"),
    p("Hallwis", "1/2", "autre"),
    p("Royal", "", "autre"),
    p("Saint Sernin", "", "autre"),
    p("Merlot", "", "vin"),
    p("Merlot / Syrah", "", "vin"),
    p("Meister", "", "autre"),
    p("Cap", "1/2", "autre"),
    p("Club 7", "1/2", "autre"),
    p("Baron", "", "autre"),
    p("Pastis", "1/2", "pastis"),
    p("Vodka", "", "vodka"),
    p("Exo", "", "autre"),
    p("Buzz", "", "autre"),
];

/// Catégories proposées (code, libellé).
pub const CATEGORIES: [(&str, &str); 6] = [
    ("biere", "Bière"),
    ("vin", "Vin"),
    ("whisky", "Whisky"),
    ("pastis", "Pastis"),
    ("vodka", "Vodka"),
    ("autre", "Autre"),
];

impl ProduitInitial {
    /// Désignation affichée : « Heineken PM », « Pichet ».
    pub fn designation(&self) -> String {
        if self.contenance.is_empty() {
            self.nom.to_string()
        } else {
            format!("{} {}", self.nom, self.contenance)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn vingt_neuf_produits_aux_designations_uniques() {
        let d: HashSet<String> = PRODUITS_INITIAUX.iter().map(|p| p.designation()).collect();
        assert_eq!(d.len(), 29);
        assert_eq!(PRODUITS_INITIAUX[0].designation(), "Bronson 3/4");
        assert_eq!(PRODUITS_INITIAUX[28].designation(), "Buzz");
    }

    #[test]
    fn categories_connues() {
        let codes: HashSet<&str> = CATEGORIES.iter().map(|c| c.0).collect();
        assert!(
            PRODUITS_INITIAUX
                .iter()
                .all(|p| codes.contains(p.categorie))
        );
    }
}
