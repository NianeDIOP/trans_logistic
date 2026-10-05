import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { IPC, type AppInfo, type Entreprise } from '../shared/types'
import { getDatabase, getSchemaVersion } from './db'

function senderWindow(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    schemaVersion: getSchemaVersion()
  }))

  ipcMain.handle(IPC.entrepriseGet, (): Entreprise => {
    return getDatabase().prepare('SELECT * FROM entreprise WHERE id = 1').get() as Entreprise
  })

  // Barre de titre personnalisée
  ipcMain.on(IPC.windowMinimize, (event) => senderWindow(event)?.minimize())
  ipcMain.on(IPC.windowToggleMaximize, (event) => {
    const win = senderWindow(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.windowClose, (event) => senderWindow(event)?.close())
  ipcMain.handle(IPC.windowIsMaximized, (event) => senderWindow(event)?.isMaximized() ?? false)
}
