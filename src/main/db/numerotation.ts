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
 * Valide un brouillon : lui attribue le numéro suivant de sa séquence (type + préfixe + année
 * de la date de facture) et le passe au statut « emise ».
 *
 * Les valeurs recopiées (taux, client, totaux) sont mises à jour une dernière fois.
 * Le tout se fait dans une transaction `BEGIN IMMEDIATE`, qui verrouille la base en écriture :
 * deux validations simultanées ne peuvent pas obtenir le même numéro, et un échec n'en consomme aucun.
 */
export function validerFacture(db: SqlDatabase, factureId: number, valideLe = new Date()): string {
  db.exec('BEGIN IMMEDIATE')
  try {
    const facture = db
      .prepare('SELECT id, type, date, statut, numero FROM factures WHERE id = ?')
      .get(factureId) as FactureAValider | undefined
    if (!facture) throw new Error(`Facture introuvable (id ${factureId})`)
    if (facture.statut !== 'brouillon' || facture.numero !== null) {
      throw new Error('Seul un brouillon peut être validé')
    }

    // Dernière mise à jour des valeurs recopiées (taux, client, totaux) avant de figer la facture.
    rafraichirInstantanes(db, factureId)

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

    db.prepare(
      "UPDATE factures SET numero = ?, statut = 'emise', valide_le = ? WHERE id = ?"
    ).run(numero, valideLe.toISOString(), factureId)

    db.exec('COMMIT')
    return numero
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
