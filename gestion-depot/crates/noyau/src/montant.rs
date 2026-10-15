//! Montants en francs CFA (RG-03) : entiers, affichés avec une espace comme séparateur de milliers.

/// `27000` → `"27 000"` ; `-500` → `"-500"`.
pub fn format_fcfa(montant: i64) -> String {
    let chiffres = montant.unsigned_abs().to_string();
    let mut groupes = Vec::new();
    let mut fin = chiffres.len();
    while fin > 3 {
        groupes.push(&chiffres[fin - 3..fin]);
        fin -= 3;
    }
    groupes.push(&chiffres[..fin]);
    groupes.reverse();
    let texte = groupes.join("\u{202f}");
    if montant < 0 {
        format!("-{texte}")
    } else {
        texte
    }
}

/// Lecture d'une saisie (« 27 000 », « 27000 ») ; `None` si ce n'est pas un entier.
pub fn lire_montant(saisie: &str) -> Option<i64> {
    let nettoye: String = saisie.chars().filter(|c| !c.is_whitespace()).collect();
    if nettoye.is_empty() {
        return None;
    }
    nettoye.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn separateur_de_milliers() {
        assert_eq!(format_fcfa(0), "0");
        assert_eq!(format_fcfa(600), "600");
        assert_eq!(format_fcfa(27_000), "27\u{202f}000");
        assert_eq!(format_fcfa(3_950_000), "3\u{202f}950\u{202f}000");
        assert_eq!(format_fcfa(-500), "-500");
        assert_eq!(format_fcfa(-1_500), "-1\u{202f}500");
    }

    #[test]
    fn lecture_des_saisies() {
        assert_eq!(lire_montant("27 000"), Some(27_000));
        assert_eq!(lire_montant("27\u{202f}000"), Some(27_000));
        assert_eq!(lire_montant(" 600 "), Some(600));
        assert_eq!(lire_montant(""), None);
        assert_eq!(lire_montant("6,5"), None);
    }
}
