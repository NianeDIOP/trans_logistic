import { valeur } from './format'
import type { LigneQuantite, Produit } from './types'

/** Saisies vides pour une liste de produits. */
export function saisiesVides(produits: Produit[]): Record<number, { cond: string; bt: string }> {
  return Object.fromEntries(produits.map((p) => [p.id, { cond: '', bt: '' }]))
}

/** Lignes non nulles à envoyer ; erreur si une saisie est invalide. */
export function lignesSaisies(saisies: Record<number, { cond: string; bt: string }>): LigneQuantite[] {
  const lignes: LigneQuantite[] = []
  for (const [id, s] of Object.entries(saisies)) {
    const c = valeur(s.cond)
    const b = valeur(s.bt)
    if (Number.isNaN(c) || Number.isNaN(b) || c < 0 || b < 0) throw new Error('Les quantités doivent être des nombres entiers positifs.')
    if (c || b) lignes.push({ produit_id: Number(id), conditionnements: c, bouteilles: b })
  }
  if (!lignes.length) throw new Error('Aucune quantité saisie.')
  return lignes
}
