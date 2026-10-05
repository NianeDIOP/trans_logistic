import { verifierEntier } from './montants'

export interface LigneMontant {
  montant_ht: number
  soumis_tva: boolean
}

export interface Totaux {
  total_ht: number
  base_tva: number
  total_tva: number
  total_ttc: number
}

/**
 * Arrondi à l'entier le plus proche, les demis s'éloignant de zéro
 * (12 600,5 → 12 601 ; -12 600,5 → -12 601), pour que les avoirs soient symétriques.
 */
function arrondir(numerateur: number, denominateur: number): number {
  const signe = Math.sign(numerateur)
  const abs = Math.abs(numerateur)
  return signe * Math.floor((abs * 2 + denominateur) / (denominateur * 2))
}

/** Montant de TVA sur une base, pour un taux en pourcentage entier (18 = 18 %). */
export function calculerTva(base: number, tauxPourcent: number): number {
  verifierEntier(base, 'montant de la base TVA')
  verifierEntier(tauxPourcent, 'taux de TVA')
  if (tauxPourcent < 0 || tauxPourcent > 100) {
    throw new RangeError(`Taux de TVA invalide : ${tauxPourcent} %`)
  }
  return arrondir(base * tauxPourcent, 100)
}

/**
 * Totaux d'une facture. La TVA s'applique ligne par ligne :
 * seules les lignes `soumis_tva` entrent dans la base ; les débours en sont exclus.
 */
export function calculerTotaux(lignes: readonly LigneMontant[], tauxPourcent: number): Totaux {
  let total_ht = 0
  let base_tva = 0
  for (const ligne of lignes) {
    verifierEntier(ligne.montant_ht, 'montant HT')
    total_ht += ligne.montant_ht
    if (ligne.soumis_tva) base_tva += ligne.montant_ht
  }
  const total_tva = calculerTva(base_tva, tauxPourcent)
  return { total_ht, base_tva, total_tva, total_ttc: total_ht + total_tva }
}
