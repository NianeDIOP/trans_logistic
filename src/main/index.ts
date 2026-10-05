import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/types'
import { closeDatabase, openDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { registerParametresHandlers } from './ipc-parametres'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: '2M Facturation',
    icon,
    // Fenêtre sans cadre : la barre de titre est dessinée par l'application.
    frame: false,
    backgroundColor: '#f4f2ed',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  const notifyMaximized = (): void =>
    win.webContents.send(IPC.windowMaximizedChanged, win.isMaximized())
  win.on('maximize', notifyMaximized)
  win.on('unmaximize', notifyMaximized)

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    openDatabase()
  } catch (err) {
    dialog.showErrorBox(
      'Erreur de base de données',
      `Impossible d'ouvrir la base de données.\n\n${(err as Error).message}`
    )
    app.quit()
    return
  }

  registerIpcHandlers()
  registerParametresHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => closeDatabase())
