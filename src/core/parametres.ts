/**
 * Validation et normalisation des saisies des Paramètres.
 * Chaque fonction retourne la valeur nettoyée, ou les erreurs par champ (messages en français).
 */
import type {
  ClientSaisie,
  EntrepriseSaisie,
  PrestationSaisie,
  ZoneSaisie
} from '../shared/parametres'
import { prefixeDocument } from './numerotation'

export type Erreurs<T> = Partial<Record<keyof T, string>>
export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreurs: Erreurs<T> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function nettoyer<T extends Record<string, unknown>>(objet: T): T {
  const copie = { ...objet }
  for (const cle of Object.keys(copie) as (keyof T)[]) {
    const v = copie[cle]
    if (typeof v === 'string') copie[cle] = v.trim().replace(/\s+/g, ' ') as T[keyof T]
  }
  return copie
}

function resultat<T>(valeur: T, erreurs: Erreurs<T>): Resultat<T> {
  return Object.keys(erreurs).length === 0 ? { ok: true, valeur } : { ok: false, erreurs }
}

function prixValide(prix: unknown): boolean {
  return typeof prix === 'number' && Number.isSafeInteger(prix) && prix >= 0
}

export function validerClient(saisie: ClientSaisie): Resultat<ClientSaisie> {
  const v = nettoyer(saisie)
  const erreurs: Erreurs<ClientSaisie> = {}
  if (!v.raison_sociale) erreurs.raison_sociale = 'La raison sociale est obligatoire.'
  if (v.email && !EMAIL.test(v.email)) erreurs.email = 'Adresse email invalide.'
  return resultat(v, erreurs)
}

export function validerPrestation(saisie: PrestationSaisie): Resultat<PrestationSaisie> {
  const v = nettoyer(saisie)
  const erreurs: Erreurs<PrestationSaisie> = {}
  if (!v.libelle) erreurs.libelle = 'Le libellé est obligatoire.'
  if (!prixValide(v.prix)) erreurs.prix = 'Le prix doit être un montant entier positif.'
  return resultat(
    { ...v, soumis_tva: Boolean(v.soumis_tva), par_conteneur: Boolean(v.par_conteneur), automatique: Boolean(v.automatique) },
    erreurs
  )
}

export function validerZone(saisie: ZoneSaisie): Resultat<ZoneSaisie> {
  const zone = saisie.zone.trim().replace(/\s+/g, ' ')
  const erreurs: Erreurs<ZoneSaisie> = {}
  if (!zone) erreurs.zone = 'Le nom de la zone est obligatoire.'
  const prix = Object.entries(saisie.prix)
  if (prix.some(([, p]) => p !== null && !prixValide(p))) {
    erreurs.prix = 'Les prix doivent être des montants entiers positifs.'
  } else if (!prix.some(([, p]) => p !== null)) {
    erreurs.prix = 'Indiquez au moins un prix.'
  }
  return resultat({ zone, prix: saisie.prix }, erreurs)
}

export function validerEntreprise(saisie: EntrepriseSaisie): Resultat<EntrepriseSaisie> {
  const v = nettoyer({ ...saisie, mentions: '' })
  v.mentions = saisie.mentions.trim() // les mentions gardent leurs retours à la ligne
  v.prefixe_facture = v.prefixe_facture.toUpperCase()
  const erreurs: Erreurs<EntrepriseSaisie> = {}
  if (!v.raison_sociale) erreurs.raison_sociale = 'La raison sociale est obligatoire.'
  if (v.email && !EMAIL.test(v.email)) erreurs.email = 'Adresse email invalide.'
  if (!Number.isInteger(v.taux_tva) || v.taux_tva < 0 || v.taux_tva > 100) {
    erreurs.taux_tva = 'Le taux doit être un nombre entier entre 0 et 100.'
  }
  try {
    prefixeDocument(v.prefixe_facture, 'facture')
  } catch {
    erreurs.prefixe_facture = 'Lettres et chiffres uniquement (ex. 2M).'
  }
  if (v.prefixe_facture === 'AV') erreurs.prefixe_facture = 'Le préfixe AV est réservé aux avoirs.'
  return resultat(v, erreurs)
}

/** Code technique stable dérivé d'un libellé : « Orange Money » → « orange_money ». */
export function codeDepuisLibelle(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
