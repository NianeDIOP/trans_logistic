import { ipcMain } from 'electron'
import type { Reponse } from '../shared/types'
import { ErreurValidation } from './db/parametres'

type Gestionnaire = (event: Electron.IpcMainInvokeEvent, ...args: never[]) => unknown

/** Enregistre un canal IPC : le résultat (ou l'erreur) est converti en `Reponse`. */
export function canal(nom: string, fn: Gestionnaire): void {
  ipcMain.handle(nom, async (event, ...args): Promise<Reponse<unknown>> => {
    try {
      const data = await fn(event, ...(args as never[]))
      return { ok: true, data: data === undefined ? null : data }
    } catch (err) {
      if (err instanceof ErreurValidation) {
        return { ok: false, message: err.message, erreurs: err.erreurs }
      }
      console.error(`[${nom}]`, err)
      return { ok: false, message: (err as Error).message || 'Erreur inattendue.' }
    }
  })
}
