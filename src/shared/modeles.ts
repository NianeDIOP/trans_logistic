/** Modèles (mises en page) et thèmes de couleurs des factures, choisis dans Paramètres. */

export interface ModeleFacture {
  id: string
  nom: string
  description: string
}

export const MODELES_FACTURE: ModeleFacture[] = [
  { id: 'classique', nom: 'Classique', description: 'Logo et société en tête, client encadré, tableau à en-tête coloré.' },
  { id: 'bandeau', nom: 'Bandeau', description: 'Large bandeau de couleur en tête, très affirmé.' },
  { id: 'epure', nom: 'Épuré', description: 'Sans aplat de couleur : filets fins, grande lisibilité, économe en encre.' },
  { id: 'moderne', nom: 'Moderne', description: 'Titre en grand, client sur fond teinté, net à payer mis en valeur.' },
  { id: 'compact', nom: 'Compact', description: 'Marges et textes resserrés : idéal pour de nombreux conteneurs.' }
]

export interface ThemeFacture {
  id: string
  nom: string
  /** Couleur principale (titres, en-tête du tableau, net à payer). */
  principal: string
  /** Couleur d'accent (filets, montant net). */
  accent: string
  /** Texte sur fond principal. */
  surPrincipal: string
}

export const THEMES_FACTURE: ThemeFacture[] = [
  { id: 'marque', nom: 'Bleu roi et or (2M)', principal: '#0b2569', accent: '#e0a516', surPrincipal: '#ffffff' },
  { id: 'noir_blanc', nom: 'Noir et blanc', principal: '#111111', accent: '#6b6b6b', surPrincipal: '#ffffff' },
  { id: 'ocean', nom: 'Bleu océan', principal: '#0f4c81', accent: '#1fa5b8', surPrincipal: '#ffffff' },
  { id: 'emeraude', nom: 'Vert émeraude', principal: '#0f5d4a', accent: '#c9a227', surPrincipal: '#ffffff' },
  { id: 'bordeaux', nom: 'Bordeaux', principal: '#6d1a36', accent: '#c8a165', surPrincipal: '#ffffff' },
  { id: 'anthracite', nom: 'Anthracite et orange', principal: '#2b2f36', accent: '#e0762f', surPrincipal: '#ffffff' },
  { id: 'violet', nom: 'Violet royal', principal: '#3d2a7a', accent: '#d9a92e', surPrincipal: '#ffffff' },
  { id: 'terracotta', nom: 'Terre cuite', principal: '#8a3b12', accent: '#2f6d70', surPrincipal: '#ffffff' },
  { id: 'marine_rouge', nom: 'Marine et rouge', principal: '#14213d', accent: '#d62828', surPrincipal: '#ffffff' },
  { id: 'sable', nom: 'Sable et brun', principal: '#5c4630', accent: '#b8915f', surPrincipal: '#ffffff' }
]

export const modeleParId = (id: string | undefined): ModeleFacture =>
  MODELES_FACTURE.find((m) => m.id === id) ?? MODELES_FACTURE[0]
export const themeParId = (id: string | undefined): ThemeFacture =>
  THEMES_FACTURE.find((t) => t.id === id) ?? THEMES_FACTURE[0]
