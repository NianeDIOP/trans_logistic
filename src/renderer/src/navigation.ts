import {
  ChartLineUpIcon,
  ClockCounterClockwiseIcon,
  FilePlusIcon,
  GearSixIcon,
  type Icon
} from '@phosphor-icons/react'

export type Ecran = 'accueil' | 'nouvelle-facture' | 'historique' | 'tableau-de-bord' | 'parametres'

export interface EntreeMenu {
  ecran: Exclude<Ecran, 'accueil'>
  titre: string
  description: string
  Icone: Icon
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
    Icone: FilePlusIcon,
    touche: 'N',
    phase: 4
  },
  {
    ecran: 'historique',
    titre: 'Historique',
    description: 'Retrouver une facture, suivre les règlements, émettre un avoir.',
    Icone: ClockCounterClockwiseIcon,
    touche: 'H',
    phase: 5
  },
  {
    ecran: 'tableau-de-bord',
    titre: 'Tableau de bord',
    description: "Chiffre d'affaires, TVA collectée, impayés et activité par zone.",
    Icone: ChartLineUpIcon,
    touche: 'T',
    phase: 6
  },
  {
    ecran: 'parametres',
    titre: 'Paramètres',
    description: 'Société, clients, grille des tarifs par zone et sauvegardes.',
    Icone: GearSixIcon,
    touche: ',',
    phase: 3
  }
]
