/** Données du tableau de bord. Montants en FCFA (entiers). */

export interface Chiffres {
  ht: number
  tva: number
  ttc: number
}

export interface ImpayeResume {
  id: number
  numero: string
  client: string
  date: string
  total_ttc: number
  reste: number
  /** Ancienneté en jours à la date du tableau de bord. */
  jours: number
}

export interface TableauDeBord {
  /** Date de référence (aujourd'hui). */
  jour: string
  /** Bornes effectives de la période (premier et dernier jour). */
  du: string
  au: string
  mois: Chiffres
  annee: Chiffres
  periode: Chiffres & { nb_factures: number; nb_conteneurs: number }
  impayes: { montant: number; nombre: number; liste: ImpayeResume[] }
  /** Un point par mois de la période, mois vides compris. */
  parMois: (Chiffres & { mois: string })[]
  topClients: { client: string; ht: number; nb_factures: number }[]
  conteneursParType: { libelle: string; nombre: number }[]
  conteneursParZone: { zone: string; nombre: number }[]
}
