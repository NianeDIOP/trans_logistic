/**
 * Indicateurs du tableau de bord.
 *
 * Chiffre d'affaires net : factures émises (hors brouillons) moins avoirs, chacun à sa date ;
 * une facture annulée en fin de mois et son avoir le mois suivant s'équilibrent donc sur l'année.
 * Volumes (conteneurs) : factures émises non annulées.
 */
import { aujourdhui } from '../../core/facture'
import { joursEntre, moisEntre } from '../../core/periodes'
import type { Chiffres, TableauDeBord } from '../../shared/tableau'
import type { SqlDatabase } from './migrations'

/** Signe d'un document dans le CA : +1 facture émise, −1 avoir. */
const SIGNE = "CASE f.type WHEN 'avoir' THEN -1 ELSE 1 END"
const COMPTABILISE = "f.statut <> 'brouillon'"
const ACTIVE = "f.type = 'facture' AND f.statut NOT IN ('brouillon', 'annulee')"

function chiffres(db: SqlDatabase, du: string, au: string): Chiffres {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(${SIGNE} * f.total_ht), 0) AS ht,
              COALESCE(SUM(${SIGNE} * f.total_tva), 0) AS tva,
              COALESCE(SUM(${SIGNE} * f.total_ttc), 0) AS ttc
       FROM factures f WHERE ${COMPTABILISE} AND f.date BETWEEN ? AND ?`
    )
    .get(du, au) as Chiffres
  return { ht: Number(r.ht), tva: Number(r.tva), ttc: Number(r.ttc) }
}

export function tableauDeBord(
  db: SqlDatabase,
  filtre: { du?: string; au?: string } = {},
  jour = aujourdhui()
): TableauDeBord {
  const [a, m] = jour.split('-')

  // Période « tout » : du premier document à aujourd'hui (ou au dernier document s'il est postérieur).
  const etendue = db
    .prepare(`SELECT MIN(f.date) AS min, MAX(f.date) AS max FROM factures f WHERE ${COMPTABILISE}`)
    .get() as { min: string | null; max: string | null }
  const du = filtre.du ?? etendue.min ?? `${a}-${m}-01`
  const au = filtre.au ?? (etendue.max && etendue.max > jour ? etendue.max : jour)

  const periode = chiffres(db, du, au)
  const { nb_factures } = db
    .prepare(`SELECT COUNT(*) AS nb_factures FROM factures f WHERE ${ACTIVE} AND f.date BETWEEN ? AND ?`)
    .get(du, au) as { nb_factures: number }
  const { nb_conteneurs } = db
    .prepare(
      `SELECT COUNT(*) AS nb_conteneurs FROM lignes l JOIN factures f ON f.id = l.facture_id
       WHERE ${ACTIVE} AND f.date BETWEEN ? AND ? AND (l.type_conteneur IS NOT NULL OR l.zone <> '')`
    )
    .get(du, au) as { nb_conteneurs: number }

  // Impayés : état à ce jour, indépendant de la période.
  const impayes = (
    db
      .prepare(
        `SELECT f.id, f.numero, f.client_raison_sociale AS client, f.date, f.total_ttc,
           f.total_ttc - (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.facture_id = f.id) AS reste
         FROM factures f
         WHERE f.type = 'facture' AND f.statut IN ('emise', 'partiellement_payee')
         ORDER BY f.date, f.id`
      )
      .all() as { id: number; numero: string; client: string; date: string; total_ttc: number; reste: number }[]
  ).map((i) => ({ ...i, reste: Number(i.reste), jours: Math.max(0, joursEntre(i.date, jour)) }))

  const parMoisBrut = db
    .prepare(
      `SELECT substr(f.date, 1, 7) AS mois,
              SUM(${SIGNE} * f.total_ht) AS ht, SUM(${SIGNE} * f.total_tva) AS tva, SUM(${SIGNE} * f.total_ttc) AS ttc
       FROM factures f WHERE ${COMPTABILISE} AND f.date BETWEEN ? AND ?
       GROUP BY mois`
    )
    .all(du, au) as (Chiffres & { mois: string })[]
  const index = new Map(parMoisBrut.map((r) => [r.mois, r]))
  const parMois = moisEntre(du, au).map((mois) => {
    const r = index.get(mois)
    return { mois, ht: Number(r?.ht ?? 0), tva: Number(r?.tva ?? 0), ttc: Number(r?.ttc ?? 0) }
  })

  const topClients = (
    db
      .prepare(
        `SELECT f.client_id, MAX(f.client_raison_sociale) AS client, SUM(${SIGNE} * f.total_ht) AS ht,
                SUM(CASE WHEN ${ACTIVE} THEN 1 ELSE 0 END) AS nb_factures
         FROM factures f WHERE ${COMPTABILISE} AND f.date BETWEEN ? AND ?
         GROUP BY f.client_id HAVING SUM(${SIGNE} * f.total_ht) > 0
         ORDER BY ht DESC LIMIT 5`
      )
      .all(du, au) as { client: string; ht: number; nb_factures: number }[]
  ).map((c) => ({ client: c.client, ht: Number(c.ht), nb_factures: Number(c.nb_factures) }))

  const conteneursParType = db
    .prepare(
      `SELECT COALESCE(NULLIF(l.type_libelle, ''), l.type_conteneur, 'Non précisé') AS libelle, COUNT(*) AS nombre
       FROM lignes l JOIN factures f ON f.id = l.facture_id
       WHERE ${ACTIVE} AND f.date BETWEEN ? AND ? AND (l.type_conteneur IS NOT NULL OR l.zone <> '')
       GROUP BY libelle ORDER BY nombre DESC, libelle`
    )
    .all(du, au) as { libelle: string; nombre: number }[]

  const conteneursParZone = db
    .prepare(
      `SELECT COALESCE(NULLIF(l.zone, ''), 'Non précisée') AS zone, COUNT(*) AS nombre
       FROM lignes l JOIN factures f ON f.id = l.facture_id
       WHERE ${ACTIVE} AND f.date BETWEEN ? AND ? AND (l.type_conteneur IS NOT NULL OR l.zone <> '')
       GROUP BY zone ORDER BY nombre DESC, zone`
    )
    .all(du, au) as { zone: string; nombre: number }[]

  return {
    jour,
    du,
    au,
    mois: chiffres(db, `${a}-${m}-01`, `${a}-${m}-31`),
    annee: chiffres(db, `${a}-01-01`, `${a}-12-31`),
    periode: { ...periode, nb_factures: Number(nb_factures), nb_conteneurs: Number(nb_conteneurs) },
    impayes: {
      montant: impayes.reduce((s, i) => s + i.reste, 0),
      nombre: impayes.length,
      liste: impayes.sort((x, y) => y.jours - x.jours || y.reste - x.reste).slice(0, 8)
    },
    parMois,
    topClients,
    conteneursParType: conteneursParType.map((c) => ({ ...c, nombre: Number(c.nombre) })),
    conteneursParZone: conteneursParZone.map((c) => ({ ...c, nombre: Number(c.nombre) }))
  }
}
