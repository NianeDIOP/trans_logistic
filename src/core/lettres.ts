/**
 * Écriture des nombres en lettres, orthographe traditionnelle française :
 * traits d'union sous cent, « et un », « quatre-vingts », « cents », « mille » invariable.
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf'
]

const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

export const MAXIMUM = 999_999_999

/**
 * 1 à 99. `final` : le nombre termine l'expression (ou précède un nom comme « millions »),
 * ce qui autorise le « s » de « quatre-vingts ».
 */
function moinsDeCent(n: number, final: boolean): string {
  if (n < 20) return UNITES[n]
  // 70-79 et 90-99 se construisent sur soixante et quatre-vingt.
  const base = n < 70 ? Math.floor(n / 10) : n < 80 ? 6 : 8
  const reste = n - (base === 8 ? 80 : base * 10)
  const dizaine = base === 8 ? 'quatre-vingt' : DIZAINES[base]

  if (reste === 0) return base === 8 && final ? 'quatre-vingts' : dizaine
  // « et » pour 21, 31, 41, 51, 61 et 71 ; pas pour 81 ni 91.
  if ((reste === 1 || reste === 11) && base !== 8) return `${dizaine} et ${UNITES[reste]}`
  return `${dizaine}-${UNITES[reste]}`
}

/** 1 à 999. */
function moinsDeMille(n: number, final: boolean): string {
  const centaines = Math.floor(n / 100)
  const reste = n % 100
  const mots: string[] = []
  if (centaines > 0) {
    const pluriel = centaines > 1 && reste === 0 && final
    mots.push(centaines === 1 ? 'cent' : `${UNITES[centaines]} ${pluriel ? 'cents' : 'cent'}`)
  }
  if (reste > 0) mots.push(moinsDeCent(reste, final))
  return mots.join(' ')
}

/** Nombre entier de 0 à 999 999 999 en lettres (minuscules). */
export function nombreEnLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAXIMUM) {
    throw new RangeError(`Nombre hors limites (0 à ${MAXIMUM}) : ${n}`)
  }
  if (n === 0) return UNITES[0]

  const millions = Math.floor(n / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1000)
  const unites = n % 1000
  const mots: string[] = []

  if (millions > 0) {
    // « million » est un nom : « quatre-vingts millions », « deux cents millions ».
    mots.push(`${moinsDeMille(millions, true)} ${millions > 1 ? 'millions' : 'million'}`)
  }
  if (milliers > 0) {
    // « mille » est invariable et ne prend pas « un » ; « quatre-vingt mille », « deux cent mille ».
    mots.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`)
  }
  if (unites > 0) mots.push(moinsDeMille(unites, true))

  return mots.join(' ')
}

/**
 * Montant en toutes lettres pour la facture :
 * 85100 → « Quatre-vingt-cinq mille cent francs CFA ».
 */
export function montantEnLettres(n: number): string {
  const negatif = n < 0
  const lettres = nombreEnLettres(Math.abs(n))
  const devise = Math.abs(n) <= 1 ? 'franc CFA' : 'francs CFA'
  // « deux millions de francs » : « de » après un nombre rond de millions.
  const liaison = Math.abs(n) >= 1_000_000 && Math.abs(n) % 1_000_000 === 0 ? ' de' : ''
  const texte = `${negatif ? 'moins ' : ''}${lettres}${liaison} ${devise}`
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}
