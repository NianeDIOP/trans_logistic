/**
 * Numérotation des factures : {prefixe}-{année}-{séquence sur 4 chiffres}, ex. 2M-2026-0001.
 * Les avoirs ont leur propre séquence, préfixée « AV- » : AV-2M-2026-0001.
 * La séquence est continue (sans trou) et repart à 1 chaque année.
 */

export type TypeDocument = 'facture' | 'avoir'

export const PREFIXE_AVOIR = 'AV'

/** Préfixe complet selon le type de document : « 2M » ou « AV-2M ». */
export function prefixeDocument(prefixe: string, type: TypeDocument): string {
  const p = prefixe.trim()
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(p)) {
    throw new Error(`Préfixe de facture invalide : « ${prefixe} »`)
  }
  return type === 'avoir' ? `${PREFIXE_AVOIR}-${p}` : p
}

export function formatNumero(prefixe: string, annee: number, sequence: number): string {
  if (!Number.isInteger(annee) || annee < 2000 || annee > 9999) {
    throw new RangeError(`Année invalide : ${annee}`)
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Numéro de séquence invalide : ${sequence}`)
  }
  return `${prefixe}-${annee}-${String(sequence).padStart(4, '0')}`
}

/** Séquence d'un numéro s'il appartient au préfixe et à l'année donnés, sinon `null`. */
export function lireSequence(numero: string, prefixe: string, annee: number): number | null {
  const debut = `${prefixe}-${annee}-`
  if (!numero.startsWith(debut)) return null
  const reste = numero.slice(debut.length)
  return /^\d{4,}$/.test(reste) ? Number(reste) : null
}

/**
 * Prochain numéro à attribuer, d'après les numéros déjà attribués
 * (on peut passer tous les numéros existants : ceux d'un autre préfixe ou d'une autre année sont ignorés).
 */
export function prochainNumero(
  numerosExistants: Iterable<string>,
  prefixe: string,
  annee: number
): string {
  let max = 0
  for (const numero of numerosExistants) {
    const seq = lireSequence(numero, prefixe, annee)
    if (seq !== null && seq > max) max = seq
  }
  return formatNumero(prefixe, annee, max + 1)
}
