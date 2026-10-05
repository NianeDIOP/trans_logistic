import { prefixeDocument, prochainNumero, type TypeDocument } from '../../core/numerotation'
import { rafraichirInstantanes } from './instantanes'
import type { SqlDatabase } from './migrations'

interface FactureAValider {
  id: number
  type: TypeDocument
  date: string
  statut: string
  numero: string | null
}

/**
 * Attribue le numéro suivant de la séquence (type + préfixe + année de la date du document)
 * et passe le brouillon au statut « emise ». À appeler dans une transaction `BEGIN IMMEDIATE`.
 *
 * Pour une facture, les valeurs recopiées (taux, client, totaux) sont mises à jour une dernière fois ;
 * un avoir garde celles de la facture qu'il annule.
 */
export function attribuerNumero(db: SqlDatabase, factureId: number, valideLe = new Date()): string {
  const facture = db
    .prepare('SELECT id, type, date, statut, numero FROM factures WHERE id = ?')
    .get(factureId) as FactureAValider | undefined
  if (!facture) throw new Error(`Facture introuvable (id ${factureId})`)
  if (facture.statut !== 'brouillon' || facture.numero !== null) {
    throw new Error('Seul un brouillon peut être validé')
  }

  if (facture.type === 'facture') rafraichirInstantanes(db, factureId)

  const entreprise = db.prepare('SELECT prefixe_facture FROM entreprise WHERE id = 1').get() as
    | { prefixe_facture: string }
    | undefined
  if (!entreprise) throw new Error("Paramètres de l'entreprise introuvables")

  const annee = Number(facture.date.slice(0, 4))
  const prefixe = prefixeDocument(entreprise.prefixe_facture, facture.type)
  const existants = (
    db
      .prepare('SELECT numero FROM factures WHERE type = ? AND numero LIKE ?')
      .all(facture.type, `${prefixe}-${annee}-%`) as { numero: string }[]
  ).map((r) => r.numero)
  const numero = prochainNumero(existants, prefixe, annee)

  db.prepare("UPDATE factures SET numero = ?, statut = 'emise', valide_le = ? WHERE id = ?").run(
    numero,
    valideLe.toISOString(),
    factureId
  )
  return numero
}

/**
 * Valide un brouillon dans sa propre transaction `BEGIN IMMEDIATE`, qui verrouille la base en écriture :
 * deux validations simultanées ne peuvent pas obtenir le même numéro, et un échec n'en consomme aucun.
 */
export function validerFacture(db: SqlDatabase, factureId: number, valideLe = new Date()): string {
  db.exec('BEGIN IMMEDIATE')
  try {
    const numero = attribuerNumero(db, factureId, valideLe)
    db.exec('COMMIT')
    return numero
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
