import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  CANAUX_FACTURES,
  CANAUX_SAUVEGARDE,
  CANAUX_PARAMETRES,
  IPC,
  type Api,
  type FacturesApi,
  type ParametresApi,
  type SauvegardeApi
} from '../shared/types'

/** Construit l'API des Paramètres : chaque méthode appelle le canal « parametres:<groupe>:<action> ». */
function apiParametres(): ParametresApi {
  const api: Record<string, Record<string, unknown>> = {}
  for (const [groupe, actions] of Object.entries(CANAUX_PARAMETRES)) {
    api[groupe] = {}
    for (const action of actions) {
      api[groupe][action] = (...args: unknown[]) =>
        ipcRenderer.invoke(`parametres:${groupe}:${action}`, ...args)
    }
  }
  return api as unknown as ParametresApi
}

function apiFactures(): FacturesApi {
  const api: Record<string, unknown> = {}
  for (const action of CANAUX_FACTURES) {
    api[action] = (...args: unknown[]) => ipcRenderer.invoke(`factures:${action}`, ...args)
  }
  return api as unknown as FacturesApi
}

function apiSauvegarde(): SauvegardeApi {
  const api: Record<string, unknown> = {}
  for (const action of CANAUX_SAUVEGARDE) {
    api[action] = (...args: unknown[]) => ipcRenderer.invoke(`sauvegarde:${action}`, ...args)
  }
  return api as unknown as SauvegardeApi
}

const api: Api = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  getEntreprise: () => ipcRenderer.invoke(IPC.entrepriseGet),
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
    onMaximizedChange: (callback) => {
      const listener = (_event: IpcRendererEvent, maximized: boolean): void => callback(maximized)
      ipcRenderer.on(IPC.windowMaximizedChanged, listener)
      return () => ipcRenderer.removeListener(IPC.windowMaximizedChanged, listener)
    }
  },
  parametres: apiParametres(),
  factures: apiFactures(),
  tableauDeBord: (filtre) => ipcRenderer.invoke(IPC.tableauDeBord, filtre),
  sauvegarde: apiSauvegarde()
}

contextBridge.exposeInMainWorld('api', api)
