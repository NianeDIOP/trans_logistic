/** Types des référentiels gérés dans Paramètres (partagés main / preload / renderer). */

export interface Client {
  id: number
  raison_sociale: string
  adresse: string
  ninea: string
  tel: string
  email: string
  actif: boolean
  cree_le: string
}
export type ClientSaisie = Pick<Client, 'raison_sociale' | 'adresse' | 'ninea' | 'tel' | 'email'>

/** Une zone de livraison et ses prix par type de conteneur (code du type → prix HT). */
export interface Zone {
  zone: string
  actif: boolean
  prix: Record<string, number>
}
export interface ZoneSaisie {
  zone: string
  prix: Record<string, number | null>
}

export interface Prestation {
  id: number
  libelle: string
  prix: number
  soumis_tva: boolean
  actif: boolean
  ordre: number
}
export type PrestationSaisie = Pick<Prestation, 'libelle' | 'prix' | 'soumis_tva'>

/** Listes simples : types de conteneurs, natures, modes de paiement. */
export type NomListe = 'types_conteneurs' | 'natures' | 'modes_paiement'
export interface ElementListe {
  id: number
  code: string
  libelle: string
  actif: boolean
  ordre: number
}

/**
 * Résultat d'une suppression : une donnée déjà utilisée par une facture
 * n'est jamais supprimée, elle est désactivée.
 */
export type ResultatSuppression = 'supprime' | 'desactive'

export type EntrepriseSaisie = {
  raison_sociale: string
  rc: string
  ninea: string
  banque: string
  iban: string
  siege: string
  adresse: string
  email: string
  tel: string
  taux_tva: number
  prefixe_facture: string
  mentions: string
}

export type TypeImage = 'logo' | 'cachet'
