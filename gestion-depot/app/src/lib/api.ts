// Appels au cœur Rust. Hors de Tauri (aperçu dans un navigateur), une fonction de démonstration
// `window.__demoInvoke` peut être fournie.
import { invoke } from '@tauri-apps/api/core'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    __demoInvoke?: (commande: string, args?: Record<string, unknown>) => Promise<unknown>
  }
}

export async function appel<T>(commande: string, args?: Record<string, unknown>): Promise<T> {
  try {
    if (window.__TAURI_INTERNALS__) return await invoke<T>(commande, args)
    if (window.__demoInvoke) return (await window.__demoInvoke(commande, args)) as T
    throw new Error('Application hors de Tauri : aucune donnée disponible.')
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : e instanceof Error ? e.message : 'Erreur inattendue.')
  }
}
