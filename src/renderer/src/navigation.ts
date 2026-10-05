export type Ecran = 'accueil' | 'nouvelle-facture' | 'historique' | 'tableau-de-bord' | 'parametres'

export interface EntreeMenu {
  ecran: Exclude<Ecran, 'accueil'>
  titre: string
  description: string
  icone: string
  phase: number
}

/** Les 4 boutons de l'écran d'accueil, dans l'ordre d'affichage. */
export const MENU: EntreeMenu[] = [
  {
    ecran: 'nouvelle-facture',
    titre: 'Nouvelle facture',
    description: 'Créer une facture de transport de conteneurs',
    icone: '📝',
    phase: 4
  },
  {
    ecran: 'historique',
    titre: 'Historique',
    description: 'Rechercher, consulter et suivre les factures',
    icone: '📚',
    phase: 5
  },
  {
    ecran: 'tableau-de-bord',
    titre: 'Tableau de bord',
    description: "Chiffre d'affaires, TVA, impayés et statistiques",
    icone: '📊',
    phase: 6
  },
  {
    ecran: 'parametres',
    titre: 'Paramètres',
    description: 'Entreprise, clients, zones et tarifs, sauvegarde',
    icone: '⚙️',
    phase: 3
  }
]
