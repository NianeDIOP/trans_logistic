/**
 * Données des exports CSV de l'historique : mêmes filtres que la liste à l'écran, toutes pages confondues.
 */
import { dateCsv, type TableCsv } from '../../core/csv'
import { LIBELLES_STATUT } from '../../core/paiements'
import type { StatutFacture } from '../../shared/factures'
import type { FiltresHistorique } from '../../shared/historique'
import { filtreHistorique } from './historique'
import type { SqlDatabase } from './migrations'

function libelleStatut(type: string, statut: StatutFacture): string {
  if (type === 'avoir') return statut === 'brouillon' ? 'Avoir (brouillon)' : 'Avoir'
  return LIBELLES_STATUT[statut] ?? statut
}

/** Une ligne par facture ou avoir. */
export function exportFactures(db: SqlDatabase, filtres: FiltresHistorique): TableCsv {
  const { where, params } = filtreHistorique(filtres)
  const rangs = db
    .prepare(
      `SELECT f.numero, f.type, f.date, f.client_raison_sociale AS client, f.num_bl, f.statut,
         f.total_ht, f.base_tva, f.total_tva, f.total_ttc,
         (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.facture_id = f.id) AS regle,
         COALESCE(
           (SELECT o.numero FROM factures o WHERE o.id = f.facture_origine_id),
           (SELECT a.numero FROM factures a WHERE a.facture_origine_id = f.id AND a.type = 'avoir' LIMIT 1)
         ) AS lie,
         (SELECT COUNT(*) FROM lignes l WHERE l.facture_id = f.id AND l.num_conteneur <> '') AS conteneurs
       FROM factures f ${where}
       ORDER BY f.date, f.id`
    )
    .all(...params) as {
    numero: string | null
    type: string
    date: string
    client: string
    num_bl: string
    statut: StatutFacture
    total_ht: number
    base_tva: number
    total_tva: number
    total_ttc: number
    regle: number
    lie: string | null
    conteneurs: number
  }[]

  return {
    entetes: [
      'N°', 'Type', 'Date', 'Client', 'N° BL', 'Statut', 'Conteneurs',
      'Total HT (FCFA)', 'Base TVA (FCFA)', 'TVA (FCFA)', 'Total TTC (FCFA)',
      'Réglé (FCFA)', 'Reste à payer (FCFA)', 'Document lié'
    ],
    lignes: rangs.map((r) => {
      const aEncaisser = r.type === 'facture' && (r.statut === 'emise' || r.statut === 'partiellement_payee')
      return [
        r.numero ?? '(brouillon)',
        r.type === 'avoir' ? 'Avoir' : 'Facture',
        dateCsv(r.date),
        r.client,
        r.num_bl,
        libelleStatut(r.type, r.statut),
        Number(r.conteneurs),
        r.total_ht,
        r.base_tva,
        r.total_tva,
        r.total_ttc,
        Number(r.regle),
        aEncaisser ? r.total_ttc - Number(r.regle) : 0,
        r.lie ?? ''
      ]
    })
  }
}

/** Une ligne par ligne de facture (conteneurs, AGS, imprimé…). */
export function exportLignes(db: SqlDatabase, filtres: FiltresHistorique): TableCsv {
  const { where, params } = filtreHistorique(filtres)
  const rangs = db
    .prepare(
      `SELECT f.numero, f.type, f.date, f.client_raison_sociale AS client, f.num_bl, f.statut,
         l.num_conteneur, COALESCE(NULLIF(l.type_libelle, ''), l.type_conteneur) AS type_conteneur,
         l.zone, COALESCE(NULLIF(l.nature_libelle, ''), l.nature) AS nature, l.designation,
         l.quantite, l.montant_ht, l.soumis_tva
       FROM lignes l JOIN factures f ON f.id = l.facture_id
       ${where}
       ORDER BY f.date, f.id, l.ordre, l.id`
    )
    .all(...params) as {
    numero: string | null
    type: string
    date: string
    client: string
    num_bl: string
    statut: StatutFacture
    num_conteneur: string
    type_conteneur: string | null
    zone: string
    nature: string | null
    designation: string
    quantite: number
    montant_ht: number
    soumis_tva: number
  }[]

  return {
    entetes: [
      'N° facture', 'Date', 'Client', 'N° BL', 'Statut', 'N° TC', 'Type', 'Zone de livraison',
      'Nature', 'Désignation', 'Quantité', 'Montant HT (FCFA)', 'Soumis à TVA'
    ],
    lignes: rangs.map((r) => [
      r.numero ?? '(brouillon)',
      dateCsv(r.date),
      r.client,
      r.num_bl,
      libelleStatut(r.type, r.statut),
      r.num_conteneur,
      r.type_conteneur ?? '',
      r.zone,
      r.nature ?? '',
      r.designation,
      Number(r.quantite),
      r.montant_ht,
      r.soumis_tva === 1
    ])
  }
}
