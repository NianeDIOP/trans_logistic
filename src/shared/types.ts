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

/** API exposée au renderer via `contextBridge` (window.api). */
export interface Api {
  getAppInfo(): Promise<AppInfo>
  getEntreprise(): Promise<Entreprise>
}

/** Noms des canaux IPC. */
export const IPC = {
  appInfo: 'app:info',
  entrepriseGet: 'entreprise:get'
} as const
