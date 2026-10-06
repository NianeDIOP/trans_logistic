import { copyFile, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import type { Facture, FactureSaisie } from '../shared/factures'
import { getDatabase } from './db'
import * as F from './db/factures'
import * as H from './db/historique'
import { tableauDeBord } from './db/statistiques'
import { IPC } from '../shared/types'
import { lireEntreprise, listerListe } from './db/parametres'
import { canal } from './ipc-commun'
import { archiverPdf, documentFacture, imprimer, pdfExiste } from './pdf/generer'

/** Chemin du PDF archivé d'une facture validée (régénéré s'il a disparu). */
async function pdfFacture(id: number): Promise<{ facture: Facture; chemin: string }> {
  const db = getDatabase()
  const facture = F.lireFacture(db, id)
  if (facture.statut === 'brouillon') throw new Error("Validez la facture pour obtenir son PDF.")
  if (pdfExiste(facture.pdf_path)) return { facture, chemin: facture.pdf_path }
  const chemin = await archiverPdf(facture, lireEntreprise(db))
  F.definirPdf(db, id, chemin)
  return { facture, chemin }
}

export function registerFacturesHandlers(): void {
  const db = getDatabase

  canal('factures:referentiels', () => F.referentiels(db()))
  canal('factures:lire', (_e, id: number) => F.lireFacture(db(), id))
  canal('factures:enregistrer', (_e, saisie: FactureSaisie) => F.enregistrerBrouillon(db(), saisie))

  canal('factures:valider', async (_e, saisie: FactureSaisie) => {
    const facture = F.enregistrerEtValider(db(), saisie)
    // La facture est validée ; si l'archivage du PDF échoue, il sera refait à la première ouverture.
    try {
      const chemin = await archiverPdf(facture, lireEntreprise(db()))
      F.definirPdf(db(), facture.id, chemin)
    } catch (err) {
      console.error('[factures:valider] archivage du PDF', err)
    }
    return F.lireFacture(db(), facture.id)
  })

  canal('factures:apercu', async (_e, saisie: FactureSaisie) => {
    const facture = F.factureAAfficher(db(), saisie)
    return (await documentFacture(facture, lireEntreprise(db()), 'ecran')).html
  })

  canal('factures:ouvrirPdf', async (_e, id: number) => {
    const { chemin } = await pdfFacture(id)
    const erreur = await shell.openPath(chemin)
    if (erreur) throw new Error(`Impossible d'ouvrir le PDF : ${erreur}`)
  })

  canal('factures:enregistrerCopie', async (event, id: number) => {
    const { chemin } = await pdfFacture(id)
    const fenetre = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.SaveDialogOptions = {
      title: 'Enregistrer une copie du PDF',
      defaultPath: join(app.getPath('documents'), basename(chemin)),
      filters: [{ name: 'Document PDF', extensions: ['pdf'] }]
    }
    const choix = fenetre ? await dialog.showSaveDialog(fenetre, options) : await dialog.showSaveDialog(options)
    if (choix.canceled || !choix.filePath) return null
    await copyFile(chemin, choix.filePath)
    return choix.filePath
  })

  canal('factures:imprimer', async (_e, id: number) => {
    const facture = F.lireFacture(db(), id)
    await imprimer(await documentFacture(facture, lireEntreprise(db()), 'impression'))
  })

  canal('factures:supprimerBrouillon', (_e, id: number) => F.supprimerBrouillon(db(), id))

  canal(IPC.tableauDeBord, (_e, filtre) => tableauDeBord(db(), filtre))

  // Historique, règlements, avoirs
  canal('factures:lister', (_e, filtres) => H.listerFactures(db(), filtres))
  canal('factures:paiements', (_e, id: number) => H.listerPaiements(db(), id))
  canal('factures:modesPaiement', () => listerListe(db(), 'modes_paiement'))
  canal('factures:enregistrerPaiement', (_e, id: number, saisie) => H.enregistrerPaiement(db(), id, saisie))
  canal('factures:supprimerPaiement', (_e, paiementId: number) => H.supprimerPaiement(db(), paiementId))
  canal('factures:supprimer', async (_e, id: number) => {
    const r = H.supprimerFacture(db(), id)
    if (r.pdf_path) await rm(r.pdf_path, { force: true })
    return { numero: r.numero, trou: r.trou }
  })
  canal('factures:creerAvoir', async (_e, id: number, options) => {
    const avoir = H.creerAvoir(db(), id, options)
    try {
      F.definirPdf(db(), avoir.id, await archiverPdf(avoir, lireEntreprise(db())))
    } catch (err) {
      console.error('[factures:creerAvoir] archivage du PDF', err)
    }
    return F.lireFacture(db(), avoir.id)
  })
}
