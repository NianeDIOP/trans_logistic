export interface FichierSauvegarde {
  nom: string
  chemin: string
  /** Date de modification (ISO). */
  date: string
  taille: number
}

export interface InfosSauvegarde {
  dossierAutomatique: string
  automatiques: FichierSauvegarde[]
}

export interface ApercuSauvegarde {
  chemin: string
  version: number
  raison_sociale: string
  nb_factures: number
  nb_clients: number
  derniere_facture: string | null
  /** La sauvegarde vient d'une version plus récente de l'application. */
  plusRecente: boolean
}
