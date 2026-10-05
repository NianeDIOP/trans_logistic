/**
 * Sauvegarde et restauration de la base SQLite.
 *
 * - Sauvegarde : copie cohérente de la base ouverte (`db.backup`), sans arrêter l'application.
 * - Sauvegarde automatique : au démarrage, une fois par 24 h, dans userData/sauvegardes (10 conservées).
 * - Restauration : vérification du fichier, copie de sécurité de la base actuelle, remplacement,
 *   puis redémarrage de l'application.
 */
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import Database from 'better-sqlite3'
import { nomFichierSauvegarde, sauvegardeAutoDue, sauvegardesASupprimer } from '../core/sauvegarde'
import type { ApercuSauvegarde, FichierSauvegarde, InfosSauvegarde } from '../shared/sauvegarde'
import { cheminBase, closeDatabase, getDatabase } from './db'
import { MIGRATIONS } from './db/migrations'
import { apercuBase } from './db/verification'

export function dossierAutomatique(): string {
  return join(app.getPath('userData'), 'sauvegardes')
}

async function copieCoherente(destination: string): Promise<void> {
  await getDatabase().backup(destination)
}

async function listerAutomatiques(): Promise<FichierSauvegarde[]> {
  if (!existsSync(dossierAutomatique())) return []
  const noms = (await readdir(dossierAutomatique())).filter((n) => n.endsWith('.db'))
  const fichiers = await Promise.all(
    noms.map(async (nom) => {
      const chemin = join(dossierAutomatique(), nom)
      const s = await stat(chemin)
      return { nom, chemin, date: s.mtime.toISOString(), taille: s.size }
    })
  )
  return fichiers.sort((a, b) => b.nom.localeCompare(a.nom))
}

export async function infosSauvegarde(): Promise<InfosSauvegarde> {
  return { dossierAutomatique: dossierAutomatique(), automatiques: await listerAutomatiques() }
}

/** Sauvegarde automatique si la dernière a plus de 24 h ; ne garde que les 10 plus récentes. */
export async function sauvegardeAutomatique(): Promise<void> {
  try {
    const existantes = await listerAutomatiques()
    const derniere = existantes.find((f) => !f.nom.includes('avant-restauration'))
    if (!sauvegardeAutoDue(derniere ? new Date(derniere.date) : null, new Date())) return
    await mkdir(dossierAutomatique(), { recursive: true })
    await copieCoherente(join(dossierAutomatique(), nomFichierSauvegarde(new Date())))
    const noms = (await readdir(dossierAutomatique())).filter((n) => !n.includes('avant-restauration'))
    for (const nom of sauvegardesASupprimer(noms, 10)) await rm(join(dossierAutomatique(), nom), { force: true })
  } catch (err) {
    console.error('[sauvegarde automatique]', err)
  }
}

/** Demande un dossier et y copie la base ; retourne le chemin du fichier créé, ou null si annulé. */
export async function sauvegarderVers(fenetre: BrowserWindow | null): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choisir le dossier de sauvegarde (clé USB, disque externe…)',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Sauvegarder ici'
  }
  const choix = fenetre ? await dialog.showOpenDialog(fenetre, options) : await dialog.showOpenDialog(options)
  if (choix.canceled || choix.filePaths.length === 0) return null
  const destination = join(choix.filePaths[0], nomFichierSauvegarde(new Date()))
  await copieCoherente(destination)
  return destination
}

/** Ouvre un fichier de sauvegarde en lecture seule et le vérifie. */
export function examinerSauvegarde(chemin: string): ApercuSauvegarde {
  let base: Database.Database | null = null
  try {
    base = new Database(chemin, { readonly: true, fileMustExist: true })
    const a = apercuBase(base)
    return { chemin, ...a, plusRecente: a.version > MIGRATIONS.length }
  } catch (err) {
    const message = (err as Error).message
    throw new Error(
      message.includes('2M Facturation') || message.includes('endommagé')
        ? message
        : "Ce fichier n'est pas une sauvegarde valide de 2M Facturation."
    )
  } finally {
    base?.close()
  }
}

/** Demande un fichier de sauvegarde et en retourne l'aperçu, ou null si annulé. */
export async function choisirSauvegarde(fenetre: BrowserWindow | null): Promise<ApercuSauvegarde | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choisir la sauvegarde à restaurer',
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde 2M Facturation', extensions: ['db'] }]
  }
  const choix = fenetre ? await dialog.showOpenDialog(fenetre, options) : await dialog.showOpenDialog(options)
  if (choix.canceled || choix.filePaths.length === 0) return null
  return examinerSauvegarde(choix.filePaths[0])
}

/**
 * Remplace la base par la sauvegarde puis redémarre l'application.
 * La base actuelle est d'abord copiée dans les sauvegardes automatiques (« avant-restauration »).
 */
export async function restaurer(chemin: string): Promise<void> {
  const apercu = examinerSauvegarde(chemin)
  if (apercu.plusRecente) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'application : mettez-la à jour d'abord.")
  }
  await mkdir(dossierAutomatique(), { recursive: true })
  const securite = join(dossierAutomatique(), nomFichierSauvegarde(new Date(), 'avant-restauration'))
  await copieCoherente(securite)

  // Copie dans un fichier temporaire puis remplacement, base fermée.
  const cible = cheminBase()
  const temporaire = `${cible}.restauration`
  await copyFile(chemin, temporaire)
  closeDatabase()
  for (const suffixe of ['-wal', '-shm']) await rm(`${cible}${suffixe}`, { force: true })
  await copyFile(temporaire, cible)
  await rm(temporaire, { force: true })

  app.relaunch()
  app.exit(0)
}

export async function ouvrirDossierAutomatique(): Promise<void> {
  await mkdir(dossierAutomatique(), { recursive: true })
  await shell.openPath(dossierAutomatique())
}

