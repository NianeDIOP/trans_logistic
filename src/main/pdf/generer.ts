/**
 * Génération des PDF de facture avec le moteur de rendu de Chromium (fenêtre invisible).
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import logoDefaut from '../../../resources/logo-2m.png?asset'
import montserrat700 from '../../../resources/fonts/montserrat-latin-700-normal.woff2?asset'
import montserrat800i from '../../../resources/fonts/montserrat-latin-800-italic.woff2?asset'
import sourceSans400 from '../../../resources/fonts/source-sans-3-latin-400-normal.woff2?asset'
import sourceSans600 from '../../../resources/fonts/source-sans-3-latin-600-normal.woff2?asset'
import { nomFichierFacture } from '../../core/facture'
import type { Facture } from '../../shared/factures'
import type { Entreprise } from '../../shared/types'
import { imageEnDataUrl } from '../images'
import { modeleFacture, type DocumentPdf, type ModeRendu, type RessourcesPdf } from './modele'

let polices: string | null = null

async function policesCss(): Promise<string> {
  if (polices) return polices
  const face = async (famille: string, poids: number, style: string, fichier: string): Promise<string> =>
    `@font-face{font-family:'${famille}';font-weight:${poids};font-style:${style};` +
    `src:url(data:font/woff2;base64,${(await readFile(fichier)).toString('base64')}) format('woff2')}`
  polices = (
    await Promise.all([
      face('Montserrat', 700, 'normal', montserrat700),
      face('Montserrat', 800, 'italic', montserrat800i),
      face('Source Sans 3', 400, 'normal', sourceSans400),
      face('Source Sans 3', 600, 'normal', sourceSans600)
    ])
  ).join('\n')
  return polices
}

async function ressources(entreprise: Entreprise): Promise<RessourcesPdf> {
  return {
    policesCss: await policesCss(),
    logo:
      (await imageEnDataUrl(entreprise.logo_path)) ??
      `data:image/png;base64,${(await readFile(logoDefaut)).toString('base64')}`,
    cachet: await imageEnDataUrl(entreprise.cachet_path)
  }
}

export async function documentFacture(
  facture: Facture,
  entreprise: Entreprise,
  mode: ModeRendu,
  presentation?: { modele?: string; theme?: string }
): Promise<DocumentPdf> {
  return modeleFacture(facture, entreprise, await ressources(entreprise), mode, presentation)
}

/** Charge un document dans une fenêtre invisible (sans script) et exécute `action`. */
async function avecFenetre<T>(html: string, action: (fenetre: BrowserWindow) => Promise<T>): Promise<T> {
  const fichier = join(tmpdir(), `2m-facture-${process.pid}-${Date.now()}.html`)
  await writeFile(fichier, html, 'utf8')
  const fenetre = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await fenetre.loadFile(fichier)
    return await action(fenetre)
  } finally {
    if (!fenetre.isDestroyed()) fenetre.destroy()
    await rm(fichier, { force: true })
  }
}

export async function genererPdf(doc: DocumentPdf): Promise<Buffer> {
  return avecFenetre(doc.html, (f) =>
    f.webContents.printToPDF({
      pageSize: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: doc.pied
    })
  )
}

/** Ouvre la boîte de dialogue d'impression de Windows pour le document. */
export async function imprimer(doc: DocumentPdf): Promise<void> {
  await avecFenetre(
    doc.html,
    (f) =>
      new Promise<void>((resoudre, rejeter) => {
        f.webContents.print({ silent: false, printBackground: true }, (succes, raison) => {
          // Une annulation par l'utilisateur n'est pas une erreur.
          if (succes || raison === 'cancelled' || raison === 'Print job canceled') resoudre()
          else rejeter(new Error(`Impression impossible : ${raison}`))
        })
      })
  )
}

/** Dossier d'archive des PDF validés : userData/factures/<année>/. */
export function cheminArchive(facture: Facture): string {
  if (!facture.numero) throw new Error("Une facture sans numéro n'est pas archivée")
  return join(
    app.getPath('userData'),
    'factures',
    facture.date.slice(0, 4),
    nomFichierFacture(facture.numero, facture.client_raison_sociale, facture.type)
  )
}

/** Génère et archive le PDF d'une facture validée ; retourne son chemin. */
export async function archiverPdf(facture: Facture, entreprise: Entreprise): Promise<string> {
  const chemin = cheminArchive(facture)
  const pdf = await genererPdf(await documentFacture(facture, entreprise, 'pdf'))
  await mkdir(join(chemin, '..'), { recursive: true })
  await writeFile(chemin, pdf)
  return chemin
}

export function pdfExiste(chemin: string | null): chemin is string {
  return chemin !== null && existsSync(chemin)
}
