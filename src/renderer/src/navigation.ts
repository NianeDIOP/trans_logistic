import type { ComponentType } from 'react'
import {
  IconHistorique,
  IconNouvelleFacture,
  IconParametres,
  IconTableauDeBord
} from './components/icons'

export type Ecran = 'accueil' | 'nouvelle-facture' | 'historique' | 'tableau-de-bord' | 'parametres'

export interface EntreeMenu {
  ecran: Exclude<Ecran, 'accueil'>
  titre: string
  description: string
  Icone: ComponentType<{ size?: number }>
  /** Touche utilisée avec Ctrl pour ouvrir l'écran depuis n'importe où. */
  touche: string
  phase: number
}

/** Les 4 modules de l'écran d'accueil, dans l'ordre d'affichage. */
export const MENU: EntreeMenu[] = [
  {
    ecran: 'nouvelle-facture',
    titre: 'Nouvelle facture',
    description: 'Établir une facture de transport : client, conteneurs, zones et montants.',
    Icone: IconNouvelleFacture,
    touche: 'N',
    phase: 4
  },
  {
    ecran: 'historique',
    titre: 'Historique',
    description: 'Retrouver une facture, suivre les règlements, émettre un avoir.',
    Icone: IconHistorique,
    touche: 'H',
    phase: 5
  },
  {
    ecran: 'tableau-de-bord',
    titre: 'Tableau de bord',
    description: "Chiffre d'affaires, TVA collectée, impayés et activité par zone.",
    Icone: IconTableauDeBord,
    touche: 'T',
    phase: 6
  },
  {
    ecran: 'parametres',
    titre: 'Paramètres',
    description: 'Société, clients, grille des tarifs par zone et sauvegardes.',
    Icone: IconParametres,
    touche: ',',
    phase: 3
  }
]
