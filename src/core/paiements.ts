/** Règles des règlements et des statuts de facture. */
import type { StatutFacture } from '../shared/factures'
import type { PaiementSaisie } from '../shared/historique'
import { dateValide } from './facture'

/** Statut d'une facture émise d'après ce qui a été réglé. */
export function statutSelonReglements(totalTtc: number, regle: number): StatutFacture {
  if (regle <= 0) return 'emise'
  return regle >= totalTtc ? 'payee' : 'partiellement_payee'
}

export const LIBELLES_STATUT: Record<StatutFacture, string> = {
  brouillon: 'Brouillon',
  emise: 'Émise',
  partiellement_payee: 'Partiellement payée',
  payee: 'Payée',
  annulee: 'Annulée'
}

/** Erreurs par champ d'un règlement, ou null s'il est valide. */
export function verifierPaiement(
  saisie: PaiementSaisie,
  reste: number
): Partial<Record<keyof PaiementSaisie, string>> | null {
  const erreurs: Partial<Record<keyof PaiementSaisie, string>> = {}
  if (!dateValide(saisie.date)) erreurs.date = 'Date invalide.'
  if (!Number.isSafeInteger(saisie.montant) || saisie.montant <= 0) {
    erreurs.montant = 'Le montant doit être un entier positif.'
  } else if (saisie.montant > reste) {
    erreurs.montant = `Le montant dépasse le reste à payer.`
  }
  if (!saisie.mode) erreurs.mode = 'Choisissez un mode de paiement.'
  return Object.keys(erreurs).length ? erreurs : null
}
