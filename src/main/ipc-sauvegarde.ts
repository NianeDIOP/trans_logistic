import { BrowserWindow } from 'electron'
import { canal } from './ipc-commun'
import {
  choisirSauvegarde,
  examinerSauvegarde,
  infosSauvegarde,
  ouvrirDossierAutomatique,
  restaurer,
  sauvegarderVers
} from './sauvegarde'

export function registerSauvegardeHandlers(): void {
  canal('sauvegarde:infos', () => infosSauvegarde())
  canal('sauvegarde:sauvegarder', (e) => sauvegarderVers(BrowserWindow.fromWebContents(e.sender)))
  canal('sauvegarde:choisir', (e) => choisirSauvegarde(BrowserWindow.fromWebContents(e.sender)))
  canal('sauvegarde:examiner', (_e, chemin: string) => examinerSauvegarde(chemin))
  canal('sauvegarde:restaurer', (_e, chemin: string) => restaurer(chemin))
  canal('sauvegarde:ouvrirDossier', () => ouvrirDossierAutomatique())
}
