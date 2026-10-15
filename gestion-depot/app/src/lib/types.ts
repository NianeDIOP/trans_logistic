// Types échangés avec le cœur Rust (commandes Tauri). Montants en FCFA entiers, quantités en bouteilles.

export interface Identite {
  nom_commercial: string
  slogan: string
  adresse: string
  telephones: string
  email: string
  ninea: string
  rc: string
  logo_path: string | null
}

export interface Presentation {
  modele_document: string
  theme_document: string
  theme_interface: string
  mode_sombre: boolean
  grand_texte: boolean
  entete_logo: string
  entete_elements: string[]
  pied_page: string
}

export interface Theme { code: string; nom: string; principal: string; accent: string }
export interface ModeleDocument { code: string; nom: string; description: string }
export interface Libelle { code: string; libelle: string }

export interface References {
  themes: Theme[]
  modeles: ModeleDocument[]
  elements_entete: Libelle[]
  positions_logo: string[]
  categories: Libelle[]
}

export interface Accueil {
  identite: Identite
  formats_a_confirmer: number
  produits_sans_prix: number
  nb_produits: number
  bouteilles_depot: number
  bouteilles_boutique: number
  valeur_stock: number
  produits_sous_seuil: number
}

export interface Conditionnement {
  id: number
  singulier: string
  pluriel: string
  abreviation: string
  par_defaut: boolean
  actif: boolean
  nb_produits: number
}

export interface ConditionnementSaisie { singulier: string; pluriel: string; abreviation: string }

export interface Produit {
  id: number
  designation: string
  nom: string
  contenance: string
  categorie: string
  conditionnement_id: number | null
  conditionnement: string
  conditionnement_pluriel: string
  bt_par_conditionnement: number
  format_a_confirmer: boolean
  seuil_depot_conditionnements: number
  seuil_boutique_bt: number
  actif: boolean
  prix: number | null
  prix_lisible: string | null
}

export interface ProduitSaisie {
  nom: string
  contenance: string
  categorie: string
  conditionnement_id: number | null
  bt_par_conditionnement: number
  seuil_depot_conditionnements: number
  seuil_boutique_bt: number
  actif: boolean
}

export interface PrixDate { date_debut: string; prix_vente: number; prix_achat_conditionnement: number | null }

export interface LigneSituation {
  produit_id: number
  designation: string
  categorie: string
  bt_par_conditionnement: number
  conditionnement: string
  depot: number
  boutique: number
  total: number
  depot_lisible: string
  depot_court: string
  total_court: string
  prix: number | null
  valeur: number
  alerte_depot: boolean
  alerte_boutique: boolean
}

export interface Ouverture { date: string | null; lignes: [number, number, number][] }
