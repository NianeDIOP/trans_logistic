//! Journal des erreurs dans un fichier local (ET-06) : `journal-erreurs.log` dans le dossier des données.

use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static FICHIER: OnceLock<PathBuf> = OnceLock::new();
/// Au-delà, le journal repart de zéro.
const TAILLE_MAX: u64 = 1_000_000;

pub fn initialiser(dossier: &std::path::Path) {
    let _ = FICHIER.set(dossier.join("journal-erreurs.log"));
}

/// Date et heure UTC « AAAA-MM-JJ HH:MM:SS » sans dépendance externe.
fn horodatage() -> String {
    let s = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs() as i64);
    let (jours, reste) = (s.div_euclid(86_400), s.rem_euclid(86_400));
    // Algorithme « civil from days » (H. Hinnant).
    let z = jours + 719_468;
    let ere = z.div_euclid(146_097);
    let doe = z - ere * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let jour = doy - (153 * mp + 2) / 5 + 1;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 };
    let annee = yoe + ere * 400 + i64::from(mois <= 2);
    format!(
        "{annee:04}-{mois:02}-{jour:02} {:02}:{:02}:{:02} UTC",
        reste / 3600,
        reste % 3600 / 60,
        reste % 60
    )
}

pub fn erreur(message: &str) {
    let Some(chemin) = FICHIER.get() else {
        return;
    };
    if std::fs::metadata(chemin).is_ok_and(|m| m.len() > TAILLE_MAX) {
        let _ = std::fs::remove_file(chemin);
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(chemin)
    {
        let _ = writeln!(f, "{} {}", horodatage(), message.replace('\n', " "));
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn horodatage_lisible() {
        let h = super::horodatage();
        assert_eq!(h.len(), 23);
        assert!(h.starts_with("20") && h.ends_with(" UTC"));
    }
}
