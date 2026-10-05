/** Types des factures (partagés main / preload / renderer). */
import type { Client, ElementListe, Prestation, Zone } from './parametres'

export type StatutFacture = 'brouillon' | 'emise' | 'payee' | 'partiellement_payee' | 'annulee'

/** Ligne saisie : un conteneur transporté, ou une prestation / un débours du catalogue. */
export interface LigneSaisie {
  num_conteneur: string
  /** Code du type (référentiel) ; null pour une prestation. */
  type_conteneur: string | null
  zone: string
  /** Code de la nature (référentiel) ; null pour une prestation. */
  nature: string | null
  designation: string
  montant_ht: number
  soumis_tva: boolean
  /** Prestation du catalogue dont la ligne est issue. */
  prestation_id: number | null
  /**
   * Nature de la ligne à l'écran (non enregistrée) : conteneur ou frais.
   * À défaut, déduite de la présence d'une zone ou d'un type.
   */
  genre?: 'conteneur' | 'frais'
}

export interface FactureSaisie {
  /** Brouillon déjà enregistré, ou null pour une nouvelle facture. */
  id: number | null
  client_id: number | null
  /** Date au format AAAA-MM-JJ. */
  date: string
  num_bl: string
  notes: string
  lignes: LigneSaisie[]
}

export interface Ligne extends LigneSaisie {
  id: number
  ordre: number
  /** Libellés recopiés au moment de la saisie. */
  type_libelle: string
  nature_libelle: string
}

export interface Facture {
  id: number
  numero: string | null
  type: 'facture' | 'avoir'
  facture_origine_id: number | null
  date: string
  client_id: number
  num_bl: string
  statut: StatutFacture
  taux_tva: number
  total_ht: number
  base_tva: number
  total_tva: number
  total_ttc: number
  notes: string
  client_raison_sociale: string
  client_adresse: string
  client_ninea: string
  client_tel: string
  client_email: string
  pdf_path: string | null
  cree_le: string
  valide_le: string | null
  lignes: Ligne[]
}

/** Tout ce que l'écran de saisie doit proposer, en un seul appel. */
export interface Referentiels {
  clients: Client[]
  types: ElementListe[]
  natures: ElementListe[]
  zones: Zone[]
  prestations: Prestation[]
  taux_tva: number
  prefixe_facture: string
}
