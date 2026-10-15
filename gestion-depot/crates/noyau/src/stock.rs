//! Conditionnements et affichage des quantités (RG-01, RG-02, RG-05).
//!
//! Le stock est toujours compté en bouteilles ; le conditionnement (caisse, carton, pack…) ne sert
//! qu'à la saisie et à l'affichage. Son nom est paramétrable.

/// Nom d'un conditionnement : « caisse » / « caisses » / « cs ».
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Conditionnement {
    pub singulier: String,
    pub pluriel: String,
    pub abreviation: String,
}

impl Conditionnement {
    pub fn new(singulier: &str, pluriel: &str, abreviation: &str) -> Self {
        Self {
            singulier: singulier.into(),
            pluriel: pluriel.into(),
            abreviation: abreviation.into(),
        }
    }

    /// Conditionnement par défaut de l'application.
    pub fn caisse() -> Self {
        Self::new("caisse", "caisses", "cs")
    }

    pub fn carton() -> Self {
        Self::new("carton", "cartons", "ct")
    }

    fn accorde(&self, n: i64) -> &str {
        if n.abs() >= 2 {
            &self.pluriel
        } else {
            &self.singulier
        }
    }
}

/// Format d'un produit : nombre de bouteilles par conditionnement (6, 12 ou 24) et nom du conditionnement.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Format {
    pub bouteilles_par_conditionnement: i64,
    pub conditionnement: Conditionnement,
}

impl Format {
    pub fn new(bouteilles_par_conditionnement: i64, conditionnement: Conditionnement) -> Self {
        assert!(
            bouteilles_par_conditionnement > 0,
            "un conditionnement contient au moins une bouteille"
        );
        Self {
            bouteilles_par_conditionnement,
            conditionnement,
        }
    }

    /// Conditionnements entiers + bouteilles restantes : 725 en caisses de 24 → (30, 5).
    pub fn decomposer(&self, bouteilles: i64) -> (i64, i64) {
        let signe = if bouteilles < 0 { -1 } else { 1 };
        let n = bouteilles.abs();
        (
            signe * (n / self.bouteilles_par_conditionnement),
            signe * (n % self.bouteilles_par_conditionnement),
        )
    }

    /// Nombre de bouteilles correspondant à une saisie « conditionnements + bouteilles isolées ».
    pub fn en_bouteilles(&self, conditionnements: i64, bouteilles: i64) -> i64 {
        conditionnements * self.bouteilles_par_conditionnement + bouteilles
    }
}

fn mot_bouteille(n: i64) -> &'static str {
    if n.abs() >= 2 {
        "bouteilles"
    } else {
        "bouteille"
    }
}

/// Quantité lisible : « 30 caisses + 5 bouteilles », « 1 caisse », « 5 bouteilles », « 0 bouteille ».
pub fn quantite_lisible(bouteilles: i64, format: &Format) -> String {
    let (c, b) = format.decomposer(bouteilles);
    let signe = if bouteilles < 0 { "-" } else { "" };
    let (c, b) = (c.abs(), b.abs());
    match (c, b) {
        (0, b) => format!("{signe}{b} {}", mot_bouteille(b)),
        (c, 0) => format!("{signe}{c} {}", format.conditionnement.accorde(c)),
        (c, b) => format!(
            "{signe}{c} {} + {b} {}",
            format.conditionnement.accorde(c),
            mot_bouteille(b)
        ),
    }
}

/// Forme courte pour les tableaux : « 30 cs + 5 bt », « 2 cs », « 5 bt ».
pub fn quantite_courte(bouteilles: i64, format: &Format) -> String {
    let (c, b) = format.decomposer(bouteilles);
    let abr = &format.conditionnement.abreviation;
    match (c, b) {
        (0, b) => format!("{b} bt"),
        (c, 0) => format!("{c} {abr}"),
        (c, b) => format!("{c} {abr} + {} bt", b.abs()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn caisse24() -> Format {
        Format::new(24, Conditionnement::caisse())
    }

    #[test]
    fn t1_reception_de_30_caisses_de_24() {
        let f = caisse24();
        assert_eq!(f.en_bouteilles(30, 0), 720);
        assert_eq!(quantite_lisible(720, &f), "30 caisses");
    }

    #[test]
    fn t2_affichage_caisses_et_bouteilles() {
        let f = caisse24();
        assert_eq!(f.decomposer(725), (30, 5));
        assert_eq!(quantite_lisible(725, &f), "30 caisses + 5 bouteilles");
        assert_eq!(quantite_courte(725, &f), "30 cs + 5 bt");
    }

    #[test]
    fn accords_singulier_pluriel() {
        let f = caisse24();
        assert_eq!(quantite_lisible(0, &f), "0 bouteille");
        assert_eq!(quantite_lisible(1, &f), "1 bouteille");
        assert_eq!(quantite_lisible(24, &f), "1 caisse");
        assert_eq!(quantite_lisible(25, &f), "1 caisse + 1 bouteille");
        assert_eq!(quantite_lisible(-12, &f), "-12 bouteilles");
    }

    #[test]
    fn le_nom_du_conditionnement_ne_change_que_l_affichage() {
        let carton = Format::new(24, Conditionnement::carton());
        assert_eq!(quantite_lisible(725, &carton), "30 cartons + 5 bouteilles");
        assert_eq!(quantite_courte(48, &carton), "2 ct");
        let pack = Format::new(6, Conditionnement::new("pack", "packs", "pk"));
        assert_eq!(quantite_lisible(13, &pack), "2 packs + 1 bouteille");
    }
}
