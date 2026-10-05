/** Types partagés entre le processus principal, le preload et le renderer. */

export interface Entreprise {
  id: number
  raison_sociale: string
  rc: string
  ninea: string
  banque: string
  iban: string
  siege: string
  adresse: string
  email: string
  tel: string
  logo_path: string | null
  cachet_path: string | null
  /** Pourcentage entier : 18 = 18 %. */
  taux_tva: number
  prefixe_facture: string
}

export interface AppInfo {
  version: string
  schemaVersion: number
}

/** Commandes de la fenêtre (barre de titre personnalisée). */
export interface WindowApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  /** Abonnement aux changements agrandi / restauré. Retourne la fonction de désabonnement. */
  onMaximizedChange(callback: (maximized: boolean) => void): () => void
}

/** API exposée au renderer via `contextBridge` (window.api). */
export interface Api {
  getAppInfo(): Promise<AppInfo>
  getEntreprise(): Promise<Entreprise>
  window: WindowApi
}

/** Noms des canaux IPC. */
export const IPC = {
  appInfo: 'app:info',
  entrepriseGet: 'entreprise:get',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximizedChanged: 'window:maximized-changed'
} as const
