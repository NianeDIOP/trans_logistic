import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type Api } from '../shared/types'

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
  }
}

contextBridge.exposeInMainWorld('api', api)
