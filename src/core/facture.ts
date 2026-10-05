/** Règles de saisie d'une facture et utilitaires de présentation. */
import type { FactureSaisie, LigneSaisie } from '../shared/factures'
import type { Prestation } from '../shared/parametres'

export interface ErreursFacture {
  client_id?: string
  date?: string
  lignes?: string
  /** Erreurs par ligne (index de la ligne → message). */
  parLigne: Record<number, string>
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

export function dateValide(date: string): boolean {
  if (!DATE_ISO.test(date)) return false
  const d = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date
}

/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function aujourdhui(maintenant = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`
}

/** « 2026-10-05 » → « 05/10/2026 ». */
export function formatDate(date: string): string {
  const [a, m, j] = date.split('-')
  return `${j}/${m}/${a}`
}

/**
 * Une ligne est un conteneur si elle est marquée comme telle à l'écran,
 * ou à défaut si elle porte une zone ou un type ; sinon ce sont des frais (prestation, débours).
 */
export function estLigneConteneur(l: Pick<LigneSaisie, 'zone' | 'type_conteneur' | 'genre'>): boolean {
  if (l.genre) return l.genre === 'conteneur'
  return l.zone.trim() !== '' || l.type_conteneur !== null
}

/** Ligne qui ne contient encore rien (ignorée à l'enregistrement). */
export function ligneVide(l: LigneSaisie): boolean {
  // La nature seule (préremplie) ne suffit pas à rendre une ligne significative.
  return (
    l.type_conteneur === null &&
    !l.zone.trim() &&
    !l.designation.trim() &&
    !l.num_conteneur.trim() &&
    l.montant_ht === 0
  )
}

/**
 * Vérifie une facture avant enregistrement.
 * `pourValidation` : contrôles complets exigés pour émettre la facture.
 */
export function verifierFacture(saisie: FactureSaisie, pourValidation: boolean): ErreursFacture | null {
  const erreurs: ErreursFacture = { parLigne: {} }
  if (saisie.client_id === null) erreurs.client_id = 'Choisissez un client.'
  if (!dateValide(saisie.date)) erreurs.date = 'Date invalide.'

  const lignes = saisie.lignes.filter((l) => !ligneVide(l))
  if (pourValidation && lignes.length === 0) erreurs.lignes = 'Ajoutez au moins une ligne.'

  saisie.lignes.forEach((l, i) => {
    if (ligneVide(l)) return
    if (!Number.isSafeInteger(l.montant_ht) || l.montant_ht < 0) {
      erreurs.parLigne[i] = 'Montant invalide.'
    } else if (estLigneConteneur(l)) {
      if (pourValidation && (!l.zone.trim() || l.type_conteneur === null)) {
        erreurs.parLigne[i] = 'Indiquez le type de conteneur et la zone.'
      }
    } else if (!l.designation.trim()) {
      erreurs.parLigne[i] = 'Indiquez une désignation.'
    }
    if (pourValidation && !erreurs.parLigne[i] && l.montant_ht === 0) {
      erreurs.parLigne[i] = 'Le montant est à zéro.'
    }
  })

  const aucune =
    !erreurs.client_id && !erreurs.date && !erreurs.lignes && Object.keys(erreurs.parLigne).length === 0
  return aucune ? null : erreurs
}

/**
 * Nom du fichier PDF : Facture_2M-2026-0001_NomClient.pdf
 * (caractères interdits par Windows retirés, espaces remplacés par « _ »).
 */
export function nomFichierFacture(numero: string, client: string, type: 'facture' | 'avoir' = 'facture'): string {
  const propre = (s: string): string =>
    s
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[._]+$/, '')
      .slice(0, 60)
  const nom = propre(client) || 'Client'
  return `${type === 'avoir' ? 'Avoir' : 'Facture'}_${propre(numero)}_${nom}.pdf`
}

/** Nombre de conteneurs saisis (lignes de conteneur non vides). */
export function nombreConteneurs(lignes: LigneSaisie[]): number {
  return lignes.filter((l) => estLigneConteneur(l) && !ligneVide(l)).length
}

/**
 * Recalcule les prestations facturées par conteneur (ex. AGS aller simple) :
 * quantité = nombre de conteneurs, montant = quantité × prix unitaire du catalogue.
 * Si la prestation n'est plus au catalogue, le prix unitaire déjà appliqué est conservé.
 */
export function appliquerPrestationsParConteneur(lignes: LigneSaisie[], prestations: Prestation[]): LigneSaisie[] {
  const n = nombreConteneurs(lignes)
  let modifie = false
  const resultat = lignes.map((l) => {
    if (l.prestation_id === null || estLigneConteneur(l)) return l
    const p = prestations.find((x) => x.id === l.prestation_id)
    const parConteneur = p ? p.par_conteneur : l.quantite !== 1
    if (!parConteneur) return l
    const unitaire = p ? p.prix : l.quantite > 0 ? Math.round(l.montant_ht / l.quantite) : 0
    if (l.quantite === n && l.montant_ht === n * unitaire) return l
    modifie = true
    return { ...l, quantite: n, montant_ht: n * unitaire }
  })
  return modifie ? resultat : lignes
}

/** Lignes ajoutées d'office à une nouvelle facture (prestations « automatiques »). */
export function lignesAutomatiques(prestations: Prestation[]): LigneSaisie[] {
  return prestations
    .filter((p) => p.automatique && p.actif)
    .map((p) => ({
      genre: 'frais' as const,
      num_conteneur: '',
      type_conteneur: null,
      zone: '',
      nature: null,
      designation: p.libelle,
      montant_ht: p.par_conteneur ? 0 : p.prix,
      soumis_tva: p.soumis_tva,
      quantite: p.par_conteneur ? 0 : 1,
      prestation_id: p.id
    }))
}

/**
 * Régime de TVA imposé à une ligne : `true` pour un conteneur (transport, toujours soumis),
 * celui du catalogue pour une prestation (AGS, Imprimé : hors TVA), `null` pour une ligne libre
 * (« Autre »), dont le régime se choisit à la main.
 */
export function regimeTvaImpose(l: LigneSaisie, prestations: Prestation[]): boolean | null {
  if (estLigneConteneur(l)) return true
  const p = l.prestation_id === null ? undefined : prestations.find((x) => x.id === l.prestation_id)
  return p ? p.soumis_tva : null
}
