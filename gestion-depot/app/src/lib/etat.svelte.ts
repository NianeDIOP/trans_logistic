// État global de l'interface : identité, présentation (thème), navigation, notifications.
import { appel } from './api'
import { aujourdhui } from './format'
import type { Identite, Presentation, References } from './types'
import { ClipboardList, History, House, PackageSearch, Settings, Warehouse } from '@lucide/svelte'

export type Page = 'accueil' | 'fiche' | 'depot' | 'situation' | 'historique' | 'parametres'
export type Onglet = 'boutique' | 'produits' | 'conditionnements' | 'ouverture' | 'apparence' | 'apropos'

export const global = $state({
  pret: false,
  date: aujourdhui(),
  identite: null as Identite | null,
  presentation: null as Presentation | null,
  references: null as References | null,
  logo: null as string | null
})

/** Modules de l'application, dans l'ordre de la barre de navigation. */
export const MODULES: { page: Page; titre: string; description: string; Icone: typeof House }[] = [
  { page: 'accueil', titre: 'Accueil', description: '', Icone: House },
  { page: 'fiche', titre: 'Fiche du jour', description: 'Saisir la fiche du vendeur, calculer les ventes et contrôler la caisse.', Icone: ClipboardList },
  { page: 'depot', titre: 'Dépôt', description: 'Réceptions fournisseur, alimentations de la boutique, inventaires.', Icone: Warehouse },
  { page: 'situation', titre: 'Situation', description: 'Stock du dépôt et de la boutique, valeur, produits sous le seuil.', Icone: PackageSearch },
  { page: 'historique', titre: 'Historique', description: 'Journées enregistrées, encaissements, rapports et impressions.', Icone: History },
  { page: 'parametres', titre: 'Paramètres', description: 'Boutique, produits et prix, conditionnements, apparence.', Icone: Settings }
]

export const route = $state({ page: 'accueil' as Page, onglet: 'boutique' as Onglet })

/** Navigation ; l'adresse (#/parametres/produits) suit l'écran affiché. */
export function aller(page: Page, onglet?: Onglet): void {
  route.page = page
  if (onglet) route.onglet = onglet
  const h = page === 'parametres' ? `#/parametres/${route.onglet}` : `#/${page}`
  if (location.hash !== h) history.replaceState(null, '', h)
}

export function lireAdresse(): void {
  const [, page, onglet] = location.hash.split('/')
  if (page) route.page = page as Page
  if (onglet) route.onglet = onglet as Onglet
}

// ------------------------------------------------------------------ Notifications

export interface Notification { id: number; genre: 'succes' | 'erreur'; message: string }
export const notifications = $state<Notification[]>([])

export function notifier(message: string, genre: Notification['genre'] = 'succes'): void {
  const id = Date.now() + Math.random()
  notifications.push({ id, genre, message })
  setTimeout(() => retirerNotification(id), genre === 'erreur' ? 6000 : 3500)
}

export function retirerNotification(id: number): void {
  const i = notifications.findIndex((n) => n.id === id)
  if (i >= 0) notifications.splice(i, 1)
}

// ------------------------------------------------------------------ Thème (EF-55)

/** Applique le thème de l'interface : couleurs, mode sombre, taille du texte. */
export function appliquerTheme(p: Presentation, refs: References): void {
  const t = refs.themes.find((x) => x.code === p.theme_interface) ?? refs.themes[0]
  const racine = document.documentElement
  racine.style.setProperty('--p', t.principal)
  racine.style.setProperty('--a', t.accent)
  racine.dataset.mode = p.mode_sombre ? 'sombre' : 'clair'
  racine.dataset.texte = p.grand_texte ? 'grand' : 'normal'
}

export async function chargerGlobal(): Promise<void> {
  const [identite, presentation, references, logo] = await Promise.all([
    appel<Identite>('identite_lire'),
    appel<Presentation>('presentation_lire'),
    appel<References>('references'),
    appel<string | null>('logo_lire')
  ])
  Object.assign(global, { identite, presentation, references, logo, pret: true })
  appliquerTheme(presentation, references)
}
