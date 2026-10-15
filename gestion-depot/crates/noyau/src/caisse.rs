//! Caisse du jour (§ 5.3) : écart = (total reçu + dépenses) − total des ventes.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BilanCaisse {
    pub total_ventes: i64,
    pub total_recu: i64,
    pub total_depenses: i64,
    /// Négatif : manquant ; positif : excédent ; zéro : caisse juste.
    pub ecart: i64,
}

impl BilanCaisse {
    pub fn manquant(&self) -> bool {
        self.ecart < 0
    }
}

pub fn bilan_caisse(montants_lignes: &[i64], total_recu: i64, depenses: &[i64]) -> BilanCaisse {
    let total_ventes: i64 = montants_lignes.iter().sum();
    let total_depenses: i64 = depenses.iter().sum();
    BilanCaisse {
        total_ventes,
        total_recu,
        total_depenses,
        ecart: total_recu + total_depenses - total_ventes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn t4_manquant_de_caisse() {
        let b = bilan_caisse(&[27_000, 15_000, 12_000, 0], 52_000, &[1_500]);
        assert_eq!(b.total_ventes, 54_000);
        assert_eq!(b.ecart, -500);
        assert!(b.manquant());
    }

    #[test]
    fn caisse_juste_et_excedent() {
        assert_eq!(bilan_caisse(&[27_000], 27_000, &[]).ecart, 0);
        assert_eq!(bilan_caisse(&[27_000], 26_000, &[1_500]).ecart, 500);
    }
}
