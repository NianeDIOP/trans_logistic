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

// ------------------------------------------------------------------ Dépôt

export interface Fournisseur { id: number; nom: string; telephone: string }

export interface LigneQuantite { produit_id: number; conditionnements: number; bouteilles: number }

export interface LigneMouvementee { produit_id: number; designation: string; bouteilles: number; quantite: string }

export interface OperationDepot {
  id: number
  date: string
  origine: string
  reference: string
  bouteilles: number
  lignes: LigneMouvementee[]
}

export interface MouvementStock {
  date: string
  lieu: 'depot' | 'boutique'
  type_mouvement: string
  quantite: number
  solde_depot: number
  solde_boutique: number
  motif: string
}

// ------------------------------------------------------------------ Fiche du jour

/** Saisie d'une ligne de fiche (champs absents = 0 / non noté). */
export interface SaisieLigne {
  stock_initial: number
  stock_initial_fiche: number | null
  alimentation_conditionnements: number
  alimentation_bouteilles: number
  stock_restant: number | null
  casse: number
  ventes_fiche: number | null
  prix_fiche: number | null
  montant_fiche: number | null
}

export interface FicheSaisie {
  date: string
  lignes: [number, SaisieLigne][]
  total_recu: number
  depenses: [string, number][]
  observations: string
}

export interface LigneFiche {
  produit_id: number
  designation: string
  bt_par_conditionnement: number
  conditionnement: string
  conditionnement_pluriel: string
  stock_initial: number
  alimentation_enregistree: number
  prix: number | null
}

export interface LigneEnregistree {
  produit_id: number
  stock_initial: number
  stock_initial_fiche: number | null
  alimentation: number
  stock_total: number
  stock_restant: number
  casse: number
  ventes: number
  ventes_fiche: number | null
  prix: number
  prix_fiche: number | null
  montant: number
  montant_fiche: number | null
}

export interface JourneeEnregistree {
  date: string
  statut: 'brouillon' | 'validee'
  total_ventes: number
  total_recu: number
  total_depenses: number
  ecart: number
  observations: string
  valide_le: string | null
  lignes: LigneEnregistree[]
  depenses: [string, number][]
  reouvrable: boolean
}

export interface FichePreparee {
  lignes: LigneFiche[]
  existante: JourneeEnregistree | null
  derniere_validee: string | null
}

export interface Calcul {
  alimentation: number
  stock_total: number
  stock_restant: number
  ventes: number
  prix: number
  montant: number
}

export interface ApercuFiche {
  lignes: { produit_id: number; calcul: Calcul; alertes: { bloquante: boolean; message: string }[] }[]
  caisse: { total_ventes: number; total_recu: number; total_depenses: number; ecart: number }
}

export interface JourneeResume {
  date: string
  statut: 'brouillon' | 'validee'
  total_ventes: number
  total_recu: number
  total_depenses: number
  ecart: number
  bouteilles_vendues: number
}

// ------------------------------------------------------------------ Rapports

export interface Cumul { journees: number; ventes: number; recu: number; depenses: number; ecart: number; bouteilles: number }

export interface ActiviteProduit {
  produit_id: number
  designation: string
  categorie: string
  ordre: number
  bouteilles_vendues: number
  montant: number
  casse: number
  recu_depot: number
  alimente: number
}

export interface RapportPeriode {
  du: string
  au: string
  totaux: Cumul
  casse: number
  recu_depot: number
  alimente: number
  produits: ActiviteProduit[]
  categories: { categorie: string; bouteilles: number; montant: number }[]
  jours: JourneeResume[]
  depenses: [string, number][]
}

export interface Indicateurs {
  date: string
  jour: Cumul
  semaine: Cumul
  mois: Cumul
  meilleurs: { designation: string; bouteilles: number; montant: number }[]
  serie: [string, number][]
  derniere_validee: string | null
  brouillons: string[]
}

// ------------------------------------------------------------------ Sécurité et sauvegarde

export interface CopieSauvegarde { nom: string; chemin: string; octets: number }

export interface EtatSecurite {
  protege: boolean
  deverrouille: boolean
  dossier_donnees: string
  dossier_sauvegardes: string
  fichier_reinitialisation: string
  derniere_sauvegarde_externe: string | null
  date_du_jour: string
  copies: CopieSauvegarde[]
}

export interface InfosSauvegarde {
  nom_boutique: string
  version_schema: number
  nb_produits: number
  derniere_journee: string | null
  nb_journees: number
}
