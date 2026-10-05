/** Périodes de filtrage (historique, tableau de bord). Dates au format AAAA-MM-JJ. */
import { aujourdhui } from './facture'

export type Periode = 'tout' | 'mois' | 'mois-precedent' | 'trimestre' | 'annee' | 'annee-precedente' | 'douze-mois' | 'perso'

const p2 = (n: number): string => String(n).padStart(2, '0')

/** Dernier jour d'un mois (1 à 12). */
export function finDeMois(annee: number, mois: number): string {
  return `${annee}-${p2(mois)}-${p2(new Date(Date.UTC(annee, mois, 0)).getUTCDate())}`
}

/** Bornes incluses d'une période prédéfinie, relativement à la date `jour`. */
export function bornesPeriode(periode: Periode, jour = aujourdhui()): { du?: string; au?: string } {
  const [a, m] = jour.split('-').map(Number)
  switch (periode) {
    case 'mois':
      return { du: `${a}-${p2(m)}-01`, au: finDeMois(a, m) }
    case 'mois-precedent': {
      const [ap, mp] = m === 1 ? [a - 1, 12] : [a, m - 1]
      return { du: `${ap}-${p2(mp)}-01`, au: finDeMois(ap, mp) }
    }
    case 'trimestre': {
      const debut = Math.floor((m - 1) / 3) * 3 + 1
      return { du: `${a}-${p2(debut)}-01`, au: finDeMois(a, debut + 2) }
    }
    case 'annee':
      return { du: `${a}-01-01`, au: `${a}-12-31` }
    case 'annee-precedente':
      return { du: `${a - 1}-01-01`, au: `${a - 1}-12-31` }
    case 'douze-mois': {
      const [ad, md] = m === 12 ? [a, 1] : [a - 1, m + 1]
      return { du: `${ad}-${p2(md)}-01`, au: finDeMois(a, m) }
    }
    default:
      return {}
  }
}

/** Mois (AAAA-MM) couverts par l'intervalle, bornes incluses. */
export function moisEntre(du: string, au: string): string[] {
  let [a, m] = du.split('-').map(Number)
  const [af, mf] = au.split('-').map(Number)
  const mois: string[] = []
  while (a < af || (a === af && m <= mf)) {
    mois.push(`${a}-${p2(m)}`)
    m += 1
    if (m === 13) {
      m = 1
      a += 1
    }
    if (mois.length > 240) break // garde-fou : 20 ans
  }
  return mois
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « 2026-03 » → « mars 26 » (court) ou « mars 2026 » (long). */
export function libelleMois(mois: string, long = false): string {
  const [a, m] = mois.split('-').map(Number)
  return long ? `${MOIS_LONGS[m - 1]} ${a}` : `${MOIS_COURTS[m - 1]} ${String(a).slice(2)}`
}

/** Nombre de jours entiers entre deux dates (b − a). */
export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}
