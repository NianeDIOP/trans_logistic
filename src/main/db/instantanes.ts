import { calculerTotaux } from '../../core/tva'
import type { SqlDatabase } from './migrations'

/**
 * Recopie dans la facture les valeurs du moment : taux de TVA, coordonnées du client,
 * et recalcule les totaux à partir des lignes. Appelé à chaque enregistrement d'un brouillon
 * et une dernière fois à la validation ; ensuite la facture ne change plus.
 * Doit être appelé dans une transaction.
 */
export function rafraichirInstantanes(db: SqlDatabase, factureId: number): void {
  const facture = db.prepare('SELECT client_id FROM factures WHERE id = ?').get(factureId) as
    | { client_id: number }
    | undefined
  if (!facture) throw new Error(`Facture introuvable (id ${factureId})`)

  const client = db
    .prepare('SELECT raison_sociale, adresse, ninea, tel, email FROM clients WHERE id = ?')
    .get(facture.client_id) as
    | { raison_sociale: string; adresse: string; ninea: string; tel: string; email: string }
    | undefined
  if (!client) throw new Error('Client introuvable')

  const { taux_tva } = db.prepare('SELECT taux_tva FROM entreprise WHERE id = 1').get() as {
    taux_tva: number
  }
  const lignes = db
    .prepare('SELECT montant_ht, soumis_tva FROM lignes WHERE facture_id = ?')
    .all(factureId) as { montant_ht: number; soumis_tva: number }[]
  const t = calculerTotaux(
    lignes.map((l) => ({ montant_ht: l.montant_ht, soumis_tva: l.soumis_tva === 1 })),
    taux_tva
  )

  db.prepare(
    `UPDATE factures SET taux_tva = ?, total_ht = ?, base_tva = ?, total_tva = ?, total_ttc = ?,
       client_raison_sociale = ?, client_adresse = ?, client_ninea = ?, client_tel = ?, client_email = ?
     WHERE id = ?`
  ).run(
    taux_tva, t.total_ht, t.base_tva, t.total_tva, t.total_ttc,
    client.raison_sociale, client.adresse, client.ninea, client.tel, client.email,
    factureId
  )
}
