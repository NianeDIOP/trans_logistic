//! Rapports et indicateurs (EF-03, EF-31) : seules les journées **validées** comptent.

use crate::{Base, JourneeResume, Resultat};
use rusqlite::params;
use std::collections::BTreeMap;

/// Activité d'un produit sur une période.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ActiviteProduit {
    pub produit_id: i64,
    pub designation: String,
    pub categorie: String,
    pub ordre: i64,
    pub bouteilles_vendues: i64,
    pub montant: i64,
    pub casse: i64,
    /// Bouteilles reçues du fournisseur au dépôt.
    pub recu_depot: i64,
    /// Bouteilles transférées du dépôt vers la boutique.
    pub alimente: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct VentesCategorie {
    pub categorie: String,
    pub bouteilles: i64,
    pub montant: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Cumul {
    pub journees: i64,
    pub ventes: i64,
    pub recu: i64,
    pub depenses: i64,
    pub ecart: i64,
    pub bouteilles: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RapportPeriode {
    pub du: String,
    pub au: String,
    pub totaux: Cumul,
    pub casse: i64,
    pub recu_depot: i64,
    pub alimente: i64,
    /// Produits ayant eu une activité, dans l'ordre de la fiche.
    pub produits: Vec<ActiviteProduit>,
    pub categories: Vec<VentesCategorie>,
    /// Journées validées, de la plus ancienne à la plus récente.
    pub jours: Vec<JourneeResume>,
    /// Dépenses regroupées par libellé, de la plus forte à la plus faible.
    pub depenses: Vec<(String, i64)>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MeilleurProduit {
    pub designation: String,
    pub bouteilles: i64,
    pub montant: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Indicateurs {
    pub date: String,
    pub jour: Cumul,
    /// Sept derniers jours, date comprise.
    pub semaine: Cumul,
    /// Du premier du mois à la date.
    pub mois: Cumul,
    pub meilleurs: Vec<MeilleurProduit>,
    /// Ventes par jour sur les 30 derniers jours (0 si pas de journée validée).
    pub serie: Vec<(String, i64)>,
    pub derniere_validee: Option<String>,
    pub brouillons: Vec<String>,
}

impl Base {
    fn cumul(&self, du: &str, au: &str) -> Resultat<Cumul> {
        Ok(self.conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(total_ventes), 0), COALESCE(SUM(total_recu), 0),
               COALESCE(SUM(total_depenses), 0), COALESCE(SUM(ecart), 0),
               COALESCE((SELECT SUM(l.ventes) FROM lignes_journee l JOIN journees j2 ON j2.id = l.journee_id
                         WHERE j2.statut = 'validee' AND j2.date BETWEEN ?1 AND ?2), 0)
             FROM journees WHERE statut = 'validee' AND date BETWEEN ?1 AND ?2",
            params![du, au],
            |r| {
                Ok(Cumul {
                    journees: r.get(0)?,
                    ventes: r.get(1)?,
                    recu: r.get(2)?,
                    depenses: r.get(3)?,
                    ecart: r.get(4)?,
                    bouteilles: r.get(5)?,
                })
            },
        )?)
    }

    fn decaler(&self, date: &str, modificateur: &str) -> Resultat<String> {
        Ok(self
            .conn
            .query_row("SELECT date(?1, ?2)", params![date, modificateur], |r| {
                r.get(0)
            })?)
    }

    /// Rapport de période (EF-31) : ventes par produit et par catégorie, encaissements par jour,
    /// dépenses, casse, réceptions et alimentations.
    pub fn rapport_periode(&self, du: &str, au: &str) -> Resultat<RapportPeriode> {
        let mut produits: BTreeMap<i64, ActiviteProduit> = BTreeMap::new();
        let mut ajouter = |sql: &str, f: fn(&mut ActiviteProduit, i64, i64)| -> Resultat<()> {
            let mut stmt = self.conn.prepare(sql)?;
            let lignes = stmt
                .query_map(params![du, au], |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, i64>(1)?,
                        r.get::<_, i64>(2)?,
                    ))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            for (id, a, b) in lignes {
                let p = produits.entry(id).or_insert_with(|| ActiviteProduit {
                    produit_id: id,
                    ..Default::default()
                });
                f(p, a, b);
            }
            Ok(())
        };
        ajouter(
            "SELECT l.produit_id, SUM(l.ventes), SUM(l.montant) FROM lignes_journee l
             JOIN journees j ON j.id = l.journee_id
             WHERE j.statut = 'validee' AND j.date BETWEEN ?1 AND ?2 GROUP BY l.produit_id",
            |p, v, m| {
                p.bouteilles_vendues = v;
                p.montant = m;
            },
        )?;
        ajouter(
            "SELECT l.produit_id, SUM(l.casse), 0 FROM lignes_journee l
             JOIN journees j ON j.id = l.journee_id
             WHERE j.statut = 'validee' AND j.date BETWEEN ?1 AND ?2 GROUP BY l.produit_id",
            |p, c, _| p.casse = c,
        )?;
        ajouter(
            "SELECT l.produit_id, SUM(l.bouteilles), 0 FROM lignes_reception l
             JOIN receptions r ON r.id = l.reception_id
             WHERE r.date BETWEEN ?1 AND ?2 GROUP BY l.produit_id",
            |p, b, _| p.recu_depot = b,
        )?;
        ajouter(
            "SELECT l.produit_id, SUM(l.bouteilles), 0 FROM lignes_alimentation l
             JOIN alimentations a ON a.id = l.alimentation_id
             WHERE a.date BETWEEN ?1 AND ?2 GROUP BY l.produit_id",
            |p, b, _| p.alimente = b,
        )?;

        let mut liste = Vec::new();
        for (id, mut a) in produits {
            if a.bouteilles_vendues == 0 && a.casse == 0 && a.recu_depot == 0 && a.alimente == 0 {
                continue;
            }
            let p = self.produit(id)?;
            a.designation = p.designation();
            a.categorie = p.categorie;
            a.ordre = p.ordre;
            liste.push(a);
        }
        liste.sort_by_key(|a| (a.ordre, a.produit_id));

        let mut categories: Vec<VentesCategorie> = Vec::new();
        for (code, _) in noyau::catalogue::CATEGORIES {
            let (b, m) = liste
                .iter()
                .filter(|a| a.categorie == code)
                .fold((0, 0), |(b, m), a| {
                    (b + a.bouteilles_vendues, m + a.montant)
                });
            if b > 0 || m > 0 {
                categories.push(VentesCategorie {
                    categorie: code.into(),
                    bouteilles: b,
                    montant: m,
                });
            }
        }

        let mut jours: Vec<JourneeResume> = self
            .journees(du, au)?
            .into_iter()
            .filter(|j| j.statut == "validee")
            .collect();
        jours.reverse();

        let mut stmt = self.conn.prepare(
            "SELECT d.libelle, SUM(d.montant) FROM depenses d JOIN journees j ON j.id = d.journee_id
             WHERE j.statut = 'validee' AND j.date BETWEEN ?1 AND ?2
             GROUP BY d.libelle ORDER BY SUM(d.montant) DESC, d.libelle",
        )?;
        let depenses = stmt
            .query_map(params![du, au], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(RapportPeriode {
            du: du.into(),
            au: au.into(),
            totaux: self.cumul(du, au)?,
            casse: liste.iter().map(|a| a.casse).sum(),
            recu_depot: liste.iter().map(|a| a.recu_depot).sum(),
            alimente: liste.iter().map(|a| a.alimente).sum(),
            produits: liste,
            categories,
            jours,
            depenses,
        })
    }

    /// Indicateurs du tableau de bord (EF-03) à une date.
    pub fn indicateurs(&self, date: &str) -> Resultat<Indicateurs> {
        let debut_semaine = self.decaler(date, "-6 days")?;
        let debut_mois = self.decaler(date, "start of month")?;
        let debut_serie = self.decaler(date, "-29 days")?;

        let mut stmt = self.conn.prepare(
            "SELECT l.produit_id, SUM(l.ventes), SUM(l.montant) FROM lignes_journee l
             JOIN journees j ON j.id = l.journee_id
             WHERE j.statut = 'validee' AND j.date BETWEEN ?1 AND ?2
             GROUP BY l.produit_id HAVING SUM(l.ventes) > 0
             ORDER BY SUM(l.montant) DESC, SUM(l.ventes) DESC LIMIT 5",
        )?;
        let top = stmt
            .query_map(params![debut_mois, date], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let meilleurs = top
            .into_iter()
            .map(|(id, b, m)| {
                Ok(MeilleurProduit {
                    designation: self.produit(id)?.designation(),
                    bouteilles: b,
                    montant: m,
                })
            })
            .collect::<Resultat<Vec<_>>>()?;

        let mut stmt = self.conn.prepare(
            "WITH RECURSIVE jours(d) AS (SELECT ?1 UNION ALL SELECT date(d, '+1 day') FROM jours WHERE d < ?2)
             SELECT jours.d, COALESCE(j.total_ventes, 0) FROM jours
             LEFT JOIN journees j ON j.date = jours.d AND j.statut = 'validee' ORDER BY jours.d",
        )?;
        let serie = stmt
            .query_map(params![debut_serie, date], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        let mut stmt = self
            .conn
            .prepare("SELECT date FROM journees WHERE statut = 'brouillon' ORDER BY date")?;
        let brouillons = stmt
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(Indicateurs {
            date: date.into(),
            jour: self.cumul(date, date)?,
            semaine: self.cumul(&debut_semaine, date)?,
            mois: self.cumul(&debut_mois, date)?,
            meilleurs,
            serie,
            derniere_validee: self.derniere_validee()?,
            brouillons,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::{Base, FicheSaisie, LigneQuantite, ReceptionSaisie};
    use noyau::fiche::SaisieLigne;

    fn base() -> (Base, i64, i64) {
        let mut base = Base::en_memoire().unwrap();
        let ps = base.produits(false).unwrap();
        let id = |nom: &str| ps.iter().find(|p| p.designation() == nom).unwrap().id;
        let (h, v) = (id("Heineken PM"), id("Vodka"));
        base.definir_format(h, 24, None).unwrap();
        base.definir_prix(h, "2026-10-01", 600, None).unwrap();
        base.definir_prix(v, "2026-10-01", 4_500, None).unwrap();
        base.enregistrer_reception(&ReceptionSaisie {
            date: "2026-10-02".into(),
            lignes: vec![LigneQuantite {
                produit_id: h,
                conditionnements: 10,
                bouteilles: 0,
            }],
            ..Default::default()
        })
        .unwrap();
        base.stock_ouverture("2026-10-01", &[(h, 0, 30), (v, 0, 10)])
            .unwrap();
        (base, h, v)
    }

    fn fiche(date: &str, lignes: Vec<(i64, i64, i64)>, recu: i64, depense: i64) -> FicheSaisie {
        FicheSaisie {
            date: date.into(),
            lignes: lignes
                .into_iter()
                .map(|(id, restant, casse)| {
                    (
                        id,
                        SaisieLigne {
                            stock_restant: Some(restant),
                            casse,
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            total_recu: recu,
            depenses: if depense > 0 {
                vec![("Glace".into(), depense)]
            } else {
                vec![]
            },
            ..Default::default()
        }
    }

    #[test]
    fn rapport_de_periode_ventes_categories_et_jours() {
        let (mut base, h, v) = base();
        // 03/10 : 10 Heineken (6 000) + 2 Vodka (9 000) = 15 000 ; reçu 14 000 + 500 de glace.
        base.valider_journee(&fiche(
            "2026-10-03",
            vec![(h, 20, 0), (v, 8, 0)],
            14_000,
            500,
        ))
        .unwrap();
        // 04/10 : 5 Heineken vendues, 1 cassée = 3 000 ; brouillon le 05 non compté.
        base.valider_journee(&fiche("2026-10-04", vec![(h, 14, 1)], 3_000, 0))
            .unwrap();
        base.enregistrer_brouillon(&fiche("2026-10-05", vec![(h, 0, 0)], 0, 0))
            .unwrap();

        let r = base.rapport_periode("2026-10-01", "2026-10-31").unwrap();
        assert_eq!(r.totaux.journees, 2);
        assert_eq!(
            (r.totaux.ventes, r.totaux.recu, r.totaux.depenses),
            (18_000, 17_000, 500)
        );
        assert_eq!(r.totaux.ecart, -500);
        assert_eq!(r.totaux.bouteilles, 17);
        assert_eq!((r.casse, r.recu_depot, r.alimente), (1, 240, 0));
        let hp = r.produits.iter().find(|p| p.produit_id == h).unwrap();
        assert_eq!(
            (hp.bouteilles_vendues, hp.montant, hp.casse, hp.recu_depot),
            (15, 9_000, 1, 240)
        );
        assert_eq!(
            r.categories
                .iter()
                .map(|c| (c.categorie.as_str(), c.montant))
                .collect::<Vec<_>>(),
            [("biere", 9_000), ("vodka", 9_000)]
        );
        assert_eq!(
            r.jours.iter().map(|j| j.date.as_str()).collect::<Vec<_>>(),
            ["2026-10-03", "2026-10-04"]
        );
        assert_eq!(r.depenses, vec![("Glace".to_string(), 500)]);
    }

    #[test]
    fn indicateurs_du_tableau_de_bord() {
        let (mut base, h, v) = base();
        base.valider_journee(&fiche("2026-10-03", vec![(h, 20, 0), (v, 8, 0)], 15_000, 0))
            .unwrap();
        base.valider_journee(&fiche("2026-10-12", vec![(h, 10, 0)], 5_500, 0))
            .unwrap();
        base.enregistrer_brouillon(&fiche("2026-10-13", vec![(h, 5, 0)], 0, 0))
            .unwrap();

        let i = base.indicateurs("2026-10-12").unwrap();
        assert_eq!((i.jour.ventes, i.jour.ecart), (6_000, -500));
        assert_eq!(i.semaine.journees, 1, "le 03 est hors des 7 jours");
        assert_eq!((i.mois.journees, i.mois.ventes), (2, 21_000));
        assert_eq!(i.meilleurs[0].designation, "Heineken PM");
        assert_eq!(i.serie.len(), 30);
        assert_eq!(i.serie.last().unwrap(), &("2026-10-12".to_string(), 6_000));
        assert_eq!(i.derniere_validee.as_deref(), Some("2026-10-12"));
        assert_eq!(i.brouillons, ["2026-10-13"]);
    }
}
