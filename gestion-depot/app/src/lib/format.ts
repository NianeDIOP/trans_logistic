// Mise en forme pour l'écran : montants FCFA, nombres, dates.

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 27000 → « 27 000 » (espace fine insécable comme séparateur). */
export function fcfa(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return nombre.format(n).replace(/\s/g, ' ')
}

export const entier = fcfa

/** Date du jour au format AAAA-MM-JJ (fuseau local). */
export function aujourdhui(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** AAAA-MM-JJ → JJ/MM/AAAA. */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, j] = iso.split('-')
  return `${j}/${m}/${a}`
}

/** AAAA-MM-JJ → « mercredi 15 octobre 2026 ». */
export function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Lecture d'une saisie numérique (« 27 000 », vide → null). */
export function lireEntier(saisie: string): number | null {
  const t = saisie.replace(/\s/g, '')
  if (t === '') return null
  return /^-?\d+$/.test(t) ? Number(t) : NaN
}

/** Accord simple : 1 bouteille, 2 bouteilles. */
export function accord(n: number, singulier: string, pluriel: string): string {
  return Math.abs(n) >= 2 ? pluriel : singulier
}

/** Décale une date AAAA-MM-JJ de n jours. */
export function decalerDate(iso: string, jours: number): string {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(a, m - 1, j + jours)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** « 30 caisses + 5 bt » à partir de bouteilles et du format. */
export function enConditionnements(bt: number, parCond: number, singulier: string, pluriel: string): string {
  const signe = bt < 0 ? '−' : ''
  const n = Math.abs(bt)
  const c = Math.floor(n / parCond)
  const r = n % parCond
  if (c === 0) return `${signe}${r} bt`
  const nom = c >= 2 ? pluriel : singulier
  return r ? `${signe}${c} ${nom} + ${r} bt` : `${signe}${c} ${nom}`
}

/** Valeur numérique d'un champ (vide → 0 ; invalide → NaN). */
export function valeur(s: string): number {
  const n = lireEntier(s)
  return n === null ? 0 : n
}
