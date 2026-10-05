/**
 * Montants en francs CFA : toujours des entiers (pas de centimes, jamais de flottant).
 */

/** Lève une erreur si `n` n'est pas un entier sûr. */
export function verifierEntier(n: number, nom = 'montant'): void {
  if (!Number.isSafeInteger(n)) {
    throw new TypeError(`Le ${nom} doit être un nombre entier (reçu : ${n})`)
  }
}

/** Affiche un montant avec des espaces comme séparateurs de milliers : 85100 → « 85 100 ». */
export function formatMontant(n: number): string {
  verifierEntier(n)
  const signe = n < 0 ? '-' : ''
  const chiffres = String(Math.abs(n))
  return signe + chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Lit un montant saisi par l'utilisateur (« 85 100 », « 85100 », « 85.100 »).
 * Retourne `null` si la saisie n'est pas un entier valide.
 */
export function lireMontant(saisie: string): number | null {
  const nettoye = saisie.replace(/[\s  .]/g, '')
  if (!/^-?\d+$/.test(nettoye)) return null
  const n = Number(nettoye)
  return Number.isSafeInteger(n) ? n : null
}
