//! Export Excel (EF-32, ET-04) : classeur .xlsx écrit à partir des tableaux affichés.
//! Les nombres restent des nombres (pas de texte « 85 100 ») pour permettre les calculs.

use rust_xlsxwriter::{Format, FormatBorder, Workbook, XlsxError};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct Colonne {
    pub titre: String,
    /// Largeur en caractères.
    pub largeur: f64,
}

#[derive(Deserialize)]
pub struct Feuille {
    /// Nom de l'onglet (31 caractères au plus).
    pub nom: String,
    pub titre: String,
    pub sous_titre: String,
    pub colonnes: Vec<Colonne>,
    pub lignes: Vec<Vec<Value>>,
    #[serde(default)]
    pub total: Option<Vec<Value>>,
}

/// Nom d'onglet accepté par Excel : sans `[]:*?/\`, 31 caractères au plus.
fn nom_onglet(nom: &str) -> String {
    let propre: String = nom
        .chars()
        .map(|c| if "[]:*?/\\".contains(c) { '-' } else { c })
        .take(31)
        .collect();
    if propre.trim().is_empty() {
        "Feuille".into()
    } else {
        propre
    }
}

pub fn ecrire(chemin: &str, boutique: &str, feuilles: &[Feuille]) -> Result<(), XlsxError> {
    let mut classeur = Workbook::new();
    let titre = Format::new().set_bold().set_font_size(14);
    let gras = Format::new().set_bold();
    let discret = Format::new().set_font_color("#5a6664");
    let entete = Format::new()
        .set_bold()
        .set_background_color("#e8eeed")
        .set_border_bottom(FormatBorder::Thin);
    let nombre = Format::new().set_num_format("#,##0");
    let total_txt = Format::new().set_bold().set_border_top(FormatBorder::Thin);
    let total_nb = Format::new()
        .set_bold()
        .set_num_format("#,##0")
        .set_border_top(FormatBorder::Thin);

    for f in feuilles {
        let ws = classeur.add_worksheet();
        ws.set_name(nom_onglet(&f.nom))?;
        ws.write_with_format(0, 0, boutique, &gras)?;
        ws.write_with_format(1, 0, &f.titre, &titre)?;
        ws.write_with_format(2, 0, &f.sous_titre, &discret)?;
        const LIGNE_ENTETE: u32 = 4;
        for (c, col) in f.colonnes.iter().enumerate() {
            let c = c as u16;
            ws.set_column_width(c, col.largeur)?;
            ws.write_with_format(LIGNE_ENTETE, c, &col.titre, &entete)?;
        }
        let mut ligne = LIGNE_ENTETE + 1;
        for valeurs in &f.lignes {
            for (c, v) in valeurs.iter().enumerate() {
                let c = c as u16;
                match v {
                    Value::Number(n) => {
                        ws.write_number_with_format(ligne, c, n.as_f64().unwrap_or(0.0), &nombre)?;
                    }
                    Value::String(s) => {
                        ws.write_string(ligne, c, s)?;
                    }
                    Value::Bool(b) => {
                        ws.write_string(ligne, c, if *b { "Oui" } else { "Non" })?;
                    }
                    _ => {}
                }
            }
            ligne += 1;
        }
        if let Some(total) = &f.total {
            for (c, v) in total.iter().enumerate() {
                let c = c as u16;
                match v {
                    Value::Number(n) => {
                        ws.write_number_with_format(
                            ligne,
                            c,
                            n.as_f64().unwrap_or(0.0),
                            &total_nb,
                        )?;
                    }
                    Value::String(s) => {
                        ws.write_string_with_format(ligne, c, s, &total_txt)?;
                    }
                    _ => {
                        ws.write_blank(ligne, c, &total_txt)?;
                    }
                }
            }
        }
        if !f.colonnes.is_empty() {
            ws.set_freeze_panes(LIGNE_ENTETE + 1, 0)?;
            if !f.lignes.is_empty() {
                ws.autofilter(
                    LIGNE_ENTETE,
                    0,
                    LIGNE_ENTETE + f.lignes.len() as u32,
                    f.colonnes.len() as u16 - 1,
                )?;
            }
        }
    }
    classeur.save(chemin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classeur_avec_nombres_bruts() {
        let dossier = std::env::temp_dir().join(format!("gd-excel-{}", std::process::id()));
        std::fs::create_dir_all(&dossier).unwrap();
        let chemin = dossier.join("essai.xlsx");
        let feuille: Feuille = serde_json::from_value(serde_json::json!({
            "nom": "Situation [stocks]",
            "titre": "Situation des stocks",
            "sous_titre": "Au 16/10/2026",
            "colonnes": [{ "titre": "Produit", "largeur": 24 }, { "titre": "Total", "largeur": 10 }],
            "lignes": [["Heineken PM", 693], ["Merlot", 81]],
            "total": ["Total", 774]
        }))
        .unwrap();
        ecrire(chemin.to_str().unwrap(), "Boutique", &[feuille]).unwrap();
        let octets = std::fs::read(&chemin).unwrap();
        assert_eq!(&octets[..2], b"PK", "un .xlsx est une archive zip");
        assert_eq!(nom_onglet("a/b:c"), "a-b-c");
        std::fs::remove_dir_all(dossier).unwrap();
    }
}
