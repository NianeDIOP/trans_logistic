import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../shared/types'

const api: Api = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  getEntreprise: () => ipcRenderer.invoke(IPC.entrepriseGet)
}

contextBridge.exposeInMainWorld('api', api)
