/** Types partagés entre le processus principal, le preload et le renderer. */
import type {
  Client,
  ClientSaisie,
  ElementListe,
  EntrepriseSaisie,
  NomListe,
  Prestation,
  PrestationSaisie,
  ResultatSuppression,
  TypeImage,
  Zone,
  ZoneSaisie
} from './parametres'
import type { Facture, FactureSaisie, Referentiels } from './factures'
import type { FiltresHistorique, PageHistorique, Paiement, PaiementSaisie } from './historique'
import type { TableauDeBord } from './tableau'
import type { ApercuSauvegarde, InfosSauvegarde } from './sauvegarde'

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
  /** Mentions de bas de facture (conditions de paiement…), sur plusieurs lignes. */
  mentions: string
  /** Mise en page des factures (voir `MODELES_FACTURE`). */
  modele_facture: string
  /** Thème de couleurs des factures (voir `THEMES_FACTURE`). */
  theme_facture: string
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

/**
 * Réponse d'un appel IPC : les erreurs de saisie traversent le pont sous forme de données
 * (message général + erreurs par champ) plutôt que d'exceptions.
 */
export type Reponse<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; erreurs?: Record<string, string> }

type R<T> = Promise<Reponse<T>>

export interface ParametresApi {
  entreprise: {
    lire(): R<Entreprise>
    modifier(saisie: EntrepriseSaisie): R<Entreprise>
    /** Image en data URL, ou null si aucune image n'est définie. */
    lireImage(type: TypeImage): R<string | null>
    /** Ouvre le sélecteur de fichier ; null si l'utilisateur annule. */
    choisirImage(type: TypeImage): R<string | null>
    retirerImage(type: TypeImage): R<null>
    definirPresentation(modele: string, theme: string): R<Entreprise>
    /** HTML d'aperçu (page A4) d'une facture dans le modèle et le thème donnés. */
    apercuModele(modele: string, theme: string): R<string>
  }
  clients: {
    lister(options?: { recherche?: string; inclureInactifs?: boolean }): R<Client[]>
    creer(saisie: ClientSaisie): R<Client>
    modifier(id: number, saisie: ClientSaisie): R<Client>
    supprimer(id: number): R<ResultatSuppression>
    reactiver(id: number): R<null>
  }
  zones: {
    lister(inclureInactifs?: boolean): R<Zone[]>
    enregistrer(ancienNom: string | null, saisie: ZoneSaisie): R<Zone>
    supprimer(nom: string): R<ResultatSuppression>
    reactiver(nom: string): R<null>
  }
  prestations: {
    lister(inclureInactifs?: boolean): R<Prestation[]>
    creer(saisie: PrestationSaisie): R<Prestation>
    modifier(id: number, saisie: PrestationSaisie): R<Prestation>
    supprimer(id: number): R<ResultatSuppression>
    reactiver(id: number): R<null>
  }
  listes: {
    lister(nom: NomListe, inclureInactifs?: boolean): R<ElementListe[]>
    ajouter(nom: NomListe, libelle: string): R<ElementListe>
    renommer(nom: NomListe, id: number, libelle: string): R<ElementListe>
    supprimer(nom: NomListe, id: number): R<ResultatSuppression>
    reactiver(nom: NomListe, id: number): R<null>
  }
}

/** Canaux IPC des Paramètres : « parametres:<groupe>:<action> ». */
export const CANAUX_PARAMETRES = {
  entreprise: ['lire', 'modifier', 'lireImage', 'choisirImage', 'retirerImage', 'definirPresentation', 'apercuModele'],
  clients: ['lister', 'creer', 'modifier', 'supprimer', 'reactiver'],
  zones: ['lister', 'enregistrer', 'supprimer', 'reactiver'],
  prestations: ['lister', 'creer', 'modifier', 'supprimer', 'reactiver'],
  listes: ['lister', 'ajouter', 'renommer', 'supprimer', 'reactiver']
} as const satisfies { [G in keyof ParametresApi]: readonly (keyof ParametresApi[G])[] }

export interface FacturesApi {
  referentiels(): R<Referentiels>
  lire(id: number): R<Facture>
  /** Enregistre (ou met à jour) un brouillon. */
  enregistrer(saisie: FactureSaisie): R<Facture>
  /** Enregistre, attribue le numéro et archive le PDF. */
  valider(saisie: FactureSaisie): R<Facture>
  /** HTML de l'aperçu (page A4) calculé depuis la saisie, sans enregistrer. */
  apercu(saisie: FactureSaisie): R<string>
  /** Ouvre le PDF dans la visionneuse de Windows. */
  ouvrirPdf(id: number): R<null>
  /** Enregistre une copie du PDF à l'emplacement choisi ; null si annulé. */
  enregistrerCopie(id: number): R<string | null>
  imprimer(id: number): R<null>
  supprimerBrouillon(id: number): R<null>
  /** Historique filtré et paginé. */
  lister(filtres: FiltresHistorique): R<PageHistorique>
  paiements(id: number): R<Paiement[]>
  modesPaiement(): R<ElementListe[]>
  enregistrerPaiement(id: number, saisie: PaiementSaisie): R<Facture>
  supprimerPaiement(paiementId: number): R<Facture>
  /** Annule la facture par un avoir (numéroté et archivé) ; retourne l'avoir. */
  creerAvoir(id: number, options: { date: string; motif: string }): R<Facture>
  /** Supprime définitivement une facture ou un avoir (et son PDF archivé). */
  supprimer(id: number): R<{ numero: string | null; trou: boolean }>
}

export const CANAUX_FACTURES = [
  'referentiels', 'lire', 'enregistrer', 'valider', 'apercu',
  'ouvrirPdf', 'enregistrerCopie', 'imprimer', 'supprimerBrouillon',
  'lister', 'paiements', 'modesPaiement', 'enregistrerPaiement', 'supprimerPaiement', 'creerAvoir',
  'supprimer'
] as const satisfies readonly (keyof FacturesApi)[]

/** API exposée au renderer via `contextBridge` (window.api). */
export interface Api {
  getAppInfo(): Promise<AppInfo>
  getEntreprise(): Promise<Entreprise>
  window: WindowApi
  parametres: ParametresApi
  factures: FacturesApi
  tableauDeBord(filtre: { du?: string; au?: string }): R<TableauDeBord>
  sauvegarde: SauvegardeApi
}

export interface SauvegardeApi {
  infos(): R<InfosSauvegarde>
  /** Sauvegarde vers un dossier choisi ; chemin du fichier créé, ou null si annulé. */
  sauvegarder(): R<string | null>
  /** Choix d'un fichier à restaurer ; aperçu de son contenu, ou null si annulé. */
  choisir(): R<ApercuSauvegarde | null>
  examiner(chemin: string): R<ApercuSauvegarde>
  /** Remplace la base et redémarre l'application. */
  restaurer(chemin: string): R<null>
  ouvrirDossier(): R<null>
  /** Export de tout le contenu en JSON (fichier choisi) ; chemin, ou null si annulé. */
  exporterJson(): R<string | null>
  /** Choix d'un export JSON ; résumé de son contenu, ou null si annulé. */
  choisirJson(): R<(ResumeImport & { chemin: string }) | null>
  /** Remplace toutes les données par celles de l'export. */
  importerJson(chemin: string): R<ResumeImport>
}

export interface ResumeImport {
  version: number
  exporte_le: string
  raison_sociale: string
  nb_clients: number
  nb_factures: number
  nb_paiements: number
}

export const CANAUX_SAUVEGARDE = [
  'infos', 'sauvegarder', 'choisir', 'examiner', 'restaurer', 'ouvrirDossier',
  'exporterJson', 'choisirJson', 'importerJson'
] as const satisfies readonly (keyof SauvegardeApi)[]

/** Noms des canaux IPC. */
export const IPC = {
  appInfo: 'app:info',
  entrepriseGet: 'entreprise:get',
  tableauDeBord: 'tableau:lire',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximizedChanged: 'window:maximized-changed'
} as const
