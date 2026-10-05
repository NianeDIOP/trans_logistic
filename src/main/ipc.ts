import { app, ipcMain } from 'electron'
import { IPC, type AppInfo, type Entreprise } from '../shared/types'
import { getDatabase, getSchemaVersion } from './db'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    schemaVersion: getSchemaVersion()
  }))

  ipcMain.handle(IPC.entrepriseGet, (): Entreprise => {
    return getDatabase().prepare('SELECT * FROM entreprise WHERE id = 1').get() as Entreprise
  })
}
