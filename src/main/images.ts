import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, stat, unlink } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import type { TypeImage } from '../shared/parametres'

const TAILLE_MAX = 5 * 1024 * 1024
const TYPES_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

/** Dossier des images de l'entreprise (logo, cachet), à côté de la base. */
function dossierImages(): string {
  return join(app.getPath('userData'), 'images')
}

export async function imageEnDataUrl(chemin: string | null): Promise<string | null> {
  if (!chemin || !existsSync(chemin)) return null
  const mime = TYPES_MIME[extname(chemin).toLowerCase()]
  if (!mime) return null
  const contenu = await readFile(chemin)
  return `data:${mime};base64,${contenu.toString('base64')}`
}

/**
 * Demande une image à l'utilisateur et la copie dans le dossier de l'application
 * (l'original peut ensuite être déplacé ou supprimé sans effet).
 * Retourne le chemin de la copie, ou null si l'utilisateur annule.
 */
export async function choisirEtCopierImage(
  fenetre: BrowserWindow | null,
  type: TypeImage
): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: type === 'logo' ? 'Choisir le logo' : 'Choisir le cachet',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  }
  const choix = fenetre ? await dialog.showOpenDialog(fenetre, options) : await dialog.showOpenDialog(options)
  if (choix.canceled || choix.filePaths.length === 0) return null

  const source = choix.filePaths[0]
  const ext = extname(source).toLowerCase()
  if (!TYPES_MIME[ext]) throw new Error('Format non pris en charge (PNG, JPEG ou WebP).')
  if ((await stat(source)).size > TAILLE_MAX) throw new Error("L'image dépasse 5 Mo.")

  await mkdir(dossierImages(), { recursive: true })
  const destination = join(dossierImages(), `${type}-${Date.now()}${ext}`)
  await copyFile(source, destination)
  return destination
}

/** Supprime une image copiée par l'application (jamais un fichier en dehors de son dossier). */
export async function supprimerImage(chemin: string | null): Promise<void> {
  if (!chemin) return
  if (!resolve(chemin).startsWith(resolve(dossierImages()))) return
  await unlink(chemin).catch(() => undefined)
}
