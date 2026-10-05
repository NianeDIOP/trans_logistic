/** Règles des sauvegardes (noms de fichiers, rotation des sauvegardes automatiques). */

const p2 = (n: number): string => String(n).padStart(2, '0')

/** « 2M-Facturation_2026-10-05_14h30.db » (heure locale). */
export function nomFichierSauvegarde(date: Date, suffixe = ''): string {
  const j = `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`
  const h = `${p2(date.getHours())}h${p2(date.getMinutes())}`
  return `2M-Facturation_${j}_${h}${suffixe ? `_${suffixe}` : ''}.db`
}

/** Une sauvegarde automatique est due si la dernière date de plus de 24 h (ou n'existe pas). */
export function sauvegardeAutoDue(derniere: Date | null, maintenant: Date): boolean {
  return derniere === null || maintenant.getTime() - derniere.getTime() >= 24 * 3600 * 1000
}

/**
 * Fichiers à supprimer pour ne garder que les `garder` sauvegardes automatiques les plus récentes.
 * Les noms contiennent la date : l'ordre alphabétique est l'ordre chronologique.
 */
export function sauvegardesASupprimer(noms: string[], garder = 10): string[] {
  const triees = noms.filter((n) => /^2M-Facturation_.*\.db$/.test(n)).sort()
  return triees.slice(0, Math.max(0, triees.length - garder))
}
