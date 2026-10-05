/**
 * Historique des factures, règlements et avoirs.
 */
import { aujourdhui } from '../../core/facture'
import { statutSelonReglements, verifierPaiement } from '../../core/paiements'
import type { Facture } from '../../shared/factures'
import type {
  FiltresHistorique,
  PageHistorique,
  Paiement,
  PaiementSaisie,
  ResumeFacture
} from '../../shared/historique'
import { lireFacture } from './factures'
import type { SqlDatabase } from './migrations'
import { attribuerNumero } from './numerotation'
import { ErreurValidation } from './parametres'

function transaction<T>(db: SqlDatabase, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/* ------------------------------------------------------------------ Liste */

export function listerFactures(db: SqlDatabase, filtres: FiltresHistorique = {}): PageHistorique {
  const conditions: string[] = []
  const params: unknown[] = []

  const recherche = filtres.recherche?.trim()
  if (recherche) {
    const motif = `%${recherche}%`
    conditions.push(
      `(f.numero LIKE ? OR f.client_raison_sociale LIKE ? OR f.num_bl LIKE ?
        OR EXISTS (SELECT 1 FROM lignes l WHERE l.facture_id = f.id AND l.num_conteneur LIKE ?))`
    )
    params.push(motif, motif, motif, motif.toUpperCase())
  }
  if (filtres.du) {
    conditions.push('f.date >= ?')
    params.push(filtres.du)
  }
  if (filtres.au) {
    conditions.push('f.date <= ?')
    params.push(filtres.au)
  }
  if (filtres.statut === 'avoir') {
    conditions.push("f.type = 'avoir'")
  } else if (filtres.statut === 'impayee') {
    conditions.push("f.type = 'facture' AND f.statut IN ('emise', 'partiellement_payee')")
  } else if (filtres.statut) {
    conditions.push("f.type = 'facture' AND f.statut = ?")
    params.push(filtres.statut)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const parPage = Math.min(Math.max(filtres.parPage ?? 25, 1), 200)
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS n FROM factures f ${where}`).get(...params) as { n: number }).n
  )
  const pages = Math.max(1, Math.ceil(total / parPage))
  const page = Math.min(Math.max(filtres.page ?? 1, 1), pages)

  const lignes = db
    .prepare(
      `SELECT f.id, f.numero, f.type, f.date, f.client_raison_sociale, f.num_bl, f.statut, f.total_ttc,
         (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.facture_id = f.id) AS regle,
         COALESCE(
           (SELECT o.numero FROM factures o WHERE o.id = f.facture_origine_id),
           (SELECT a.numero FROM factures a WHERE a.facture_origine_id = f.id AND a.type = 'avoir' LIMIT 1)
         ) AS lie_numero,
         (SELECT COUNT(*) FROM lignes l WHERE l.facture_id = f.id AND l.num_conteneur <> '') AS nb_conteneurs
       FROM factures f ${where}
       ORDER BY f.date DESC, f.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, parPage, (page - 1) * parPage) as ResumeFacture[]

  const sommes = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN f.type = 'facture' AND f.statut NOT IN ('brouillon', 'annulee') THEN f.total_ttc END), 0) AS montant,
         COALESCE(SUM(CASE WHEN f.type = 'facture' AND f.statut IN ('emise', 'partiellement_payee')
           THEN f.total_ttc - (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.facture_id = f.id) END), 0) AS reste
       FROM factures f ${where}`
    )
    .get(...params) as { montant: number; reste: number }

  return {
    lignes,
    total,
    page,
    parPage,
    montant_ttc: Number(sommes.montant),
    reste_a_encaisser: Number(sommes.reste)
  }
}

/* -------------------------------------------------------------- Paiements */

export function listerPaiements(db: SqlDatabase, factureId: number): Paiement[] {
  return db
    .prepare(
      `SELECT p.id, p.facture_id, p.date, p.montant, p.mode, p.reference,
         COALESCE(m.libelle, p.mode) AS mode_libelle
       FROM paiements p LEFT JOIN modes_paiement m ON m.code = p.mode
       WHERE p.facture_id = ? ORDER BY p.date, p.id`
    )
    .all(factureId) as Paiement[]
}

function recalculerStatut(db: SqlDatabase, factureId: number): void {
  const f = db.prepare('SELECT statut, total_ttc FROM factures WHERE id = ?').get(factureId) as {
    statut: string
    total_ttc: number
  }
  if (f.statut === 'brouillon' || f.statut === 'annulee') return
  const { regle } = db
    .prepare('SELECT COALESCE(SUM(montant), 0) AS regle FROM paiements WHERE facture_id = ?')
    .get(factureId) as { regle: number }
  db.prepare('UPDATE factures SET statut = ? WHERE id = ?').run(
    statutSelonReglements(f.total_ttc, Number(regle)),
    factureId
  )
}

/** Enregistre un règlement et met à jour le statut (partiellement payée / payée). */
export function enregistrerPaiement(db: SqlDatabase, factureId: number, saisie: PaiementSaisie): Facture {
  transaction(db, () => {
    const f = lireFacture(db, factureId)
    if (f.type !== 'facture') throw new Error('Un avoir ne reçoit pas de règlement.')
    if (f.statut === 'brouillon') throw new Error("Validez la facture avant d'enregistrer un règlement.")
    if (f.statut === 'annulee') throw new Error('Cette facture est annulée.')
    const reste = f.total_ttc - f.regle
    const mode = db.prepare('SELECT actif FROM modes_paiement WHERE code = ?').get(saisie.mode) as
      | { actif: number }
      | undefined
    const erreurs = verifierPaiement(saisie, reste) ?? {}
    if (!erreurs.mode && (!mode || mode.actif !== 1)) erreurs.mode = 'Mode de paiement inconnu.'
    if (Object.keys(erreurs).length) {
      throw new ErreurValidation('Le règlement est invalide.', erreurs as Record<string, string>)
    }
    db.prepare('INSERT INTO paiements (facture_id, date, montant, mode, reference) VALUES (?, ?, ?, ?, ?)').run(
      factureId,
      saisie.date,
      saisie.montant,
      saisie.mode,
      saisie.reference.trim()
    )
    recalculerStatut(db, factureId)
  })
  return lireFacture(db, factureId)
}

/** Supprime un règlement saisi par erreur et remet le statut à jour. */
export function supprimerPaiement(db: SqlDatabase, paiementId: number): Facture {
  const p = db.prepare('SELECT facture_id FROM paiements WHERE id = ?').get(paiementId) as
    | { facture_id: number }
    | undefined
  if (!p) throw new Error('Règlement introuvable')
  transaction(db, () => {
    const f = db.prepare('SELECT statut FROM factures WHERE id = ?').get(p.facture_id) as { statut: string }
    if (f.statut === 'annulee') throw new Error('Cette facture est annulée : ses règlements sont figés.')
    db.prepare('DELETE FROM paiements WHERE id = ?').run(paiementId)
    recalculerStatut(db, p.facture_id)
  })
  return lireFacture(db, p.facture_id)
}

/* ------------------------------------------------------------------ Avoirs */

/**
 * Annule une facture émise par un avoir : document « AV-… » qui reprend ses lignes et ses montants
 * (mêmes taux et client que la facture), numéroté aussitôt. La facture passe au statut « annulee ».
 */
export function creerAvoir(
  db: SqlDatabase,
  factureId: number,
  options: { date?: string; motif?: string } = {}
): Facture {
  const avoirId = transaction(db, () => {
    const f = lireFacture(db, factureId)
    if (f.type !== 'facture') throw new Error("On ne peut pas annuler un avoir.")
    if (f.statut === 'brouillon') throw new Error('Un brouillon se supprime ; il ne demande pas d’avoir.')
    if (f.statut === 'annulee') throw new Error('Cette facture est déjà annulée.')

    const date = options.date ?? aujourdhui()
    if (date < f.date) throw new Error("L'avoir ne peut pas être antérieur à la facture.")

    const r = db
      .prepare(
        `INSERT INTO factures (type, facture_origine_id, date, client_id, num_bl, notes, taux_tva,
           total_ht, base_tva, total_tva, total_ttc, client_raison_sociale, client_adresse,
           client_ninea, client_tel, client_email)
         VALUES ('avoir', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        f.id, date, f.client_id, f.num_bl, (options.motif ?? '').trim(), f.taux_tva,
        f.total_ht, f.base_tva, f.total_tva, f.total_ttc, f.client_raison_sociale, f.client_adresse,
        f.client_ninea, f.client_tel, f.client_email
      ) as { lastInsertRowid: number | bigint }
    const id = Number(r.lastInsertRowid)

    db.prepare(
      `INSERT INTO lignes (facture_id, ordre, num_conteneur, type_conteneur, type_libelle, zone, nature,
         nature_libelle, designation, montant_ht, soumis_tva, prestation_id)
       SELECT ?, ordre, num_conteneur, type_conteneur, type_libelle, zone, nature, nature_libelle,
         designation, montant_ht, soumis_tva, prestation_id
       FROM lignes WHERE facture_id = ? ORDER BY ordre`
    ).run(id, f.id)

    attribuerNumero(db, id)
    db.prepare("UPDATE factures SET statut = 'annulee' WHERE id = ?").run(f.id)
    return id
  })
  return lireFacture(db, avoirId)
}
