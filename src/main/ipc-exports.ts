import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { aujourdhui } from '../core/facture'
import { nomFichierCsv, sectionsCsv, sectionsTableauDeBord, tableImpayes, versCsv } from '../core/csv'
import type { FiltresHistorique } from '../shared/historique'
import type { ExportHistorique, ExportTableau } from '../shared/types'
import { getDatabase } from './db'
import { exportFactures, exportLignes } from './db/exports'
import { tableauDeBord } from './db/statistiques'
import { canal } from './ipc-commun'

/** Dossier du dernier export, proposé au suivant (Documents au premier). */
let dernierDossier: string | null = null

/** Demande où enregistrer puis écrit le CSV ; chemin du fichier, ou null si annulé. */
async function enregistrerCsv(fenetre: BrowserWindow | null, nom: string, contenu: () => string): Promise<string | null> {
  const options: Electron.SaveDialogOptions = {
    title: 'Exporter en CSV (Excel)',
    defaultPath: join(dernierDossier ?? app.getPath('documents'), nom),
    filters: [{ name: 'Fichier CSV (Excel)', extensions: ['csv'] }]
  }
  const choix = fenetre ? await dialog.showSaveDialog(fenetre, options) : await dialog.showSaveDialog(options)
  if (choix.canceled || !choix.filePath) return null
  await writeFile(choix.filePath, contenu(), 'utf8')
  dernierDossier = dirname(choix.filePath)
  return choix.filePath
}

export function registerExportsHandlers(): void {
  const db = getDatabase

  canal('exports:historique', (e, filtres: FiltresHistorique, genre: ExportHistorique) => {
    const nom = nomFichierCsv(genre === 'lignes' ? 'Lignes_factures' : 'Factures', aujourdhui(), filtres.du, filtres.au)
    return enregistrerCsv(BrowserWindow.fromWebContents(e.sender), nom, () =>
      versCsv(genre === 'lignes' ? exportLignes(db(), filtres) : exportFactures(db(), filtres))
    )
  })

  canal('exports:tableau', (e, filtre: { du?: string; au?: string }, genre: ExportTableau) => {
    const t = tableauDeBord(db(), filtre)
    const fenetre = BrowserWindow.fromWebContents(e.sender)
    if (genre === 'impayes') {
      return enregistrerCsv(fenetre, nomFichierCsv('Impayes', t.jour), () => versCsv(tableImpayes(t)))
    }
    if (genre === 'factures') {
      // Documents comptabilisés de la période (brouillons exclus), comme le chiffre d'affaires.
      const filtres = { du: t.du, au: t.au }
      return enregistrerCsv(fenetre, nomFichierCsv('Factures', t.jour, t.du, t.au), () => {
        const table = exportFactures(db(), filtres)
        return versCsv({ ...table, lignes: table.lignes.filter((l) => l[0] !== '(brouillon)') })
      })
    }
    return enregistrerCsv(fenetre, nomFichierCsv('Tableau_de_bord', t.jour, t.du, t.au), () =>
      sectionsCsv(sectionsTableauDeBord(t))
    )
  })

  canal('exports:afficher', (_e, chemin: string) => shell.showItemInFolder(chemin))
}
