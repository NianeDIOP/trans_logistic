/** Types de l'historique, des paiements et des avoirs. */
import type { StatutFacture } from './factures'

export interface FiltresHistorique {
  /** Numéro, client, N° BL ou N° de conteneur. */
  recherche?: string
  /** Bornes de date incluses (AAAA-MM-JJ). */
  du?: string
  au?: string
  /** Statut, ou « avoir » pour n'afficher que les avoirs. */
  statut?: StatutFacture | 'avoir' | 'impayee'
  page?: number
  parPage?: number
}

export interface ResumeFacture {
  id: number
  numero: string | null
  type: 'facture' | 'avoir'
  date: string
  client_raison_sociale: string
  num_bl: string
  statut: StatutFacture
  total_ttc: number
  /** Total des règlements enregistrés. */
  regle: number
  /** Numéro de la facture annulée (pour un avoir) ou de l'avoir qui l'annule (pour une facture). */
  lie_numero: string | null
  nb_conteneurs: number
}

export interface PageHistorique {
  lignes: ResumeFacture[]
  total: number
  page: number
  parPage: number
  /** Totaux sur l'ensemble du filtre (factures uniquement, hors brouillons et annulées). */
  montant_ttc: number
  reste_a_encaisser: number
}

export interface Paiement {
  id: number
  facture_id: number
  date: string
  montant: number
  mode: string
  mode_libelle: string
  reference: string
}

export interface PaiementSaisie {
  date: string
  montant: number
  mode: string
  reference: string
}
