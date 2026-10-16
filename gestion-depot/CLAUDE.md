# CLAUDE.md — Gestion Dépôt et Boutique

Projet **distinct** de « 2M Facturation » (dossier parent). Ne rien importer, partager ni copier de l'autre
projet (code, couleurs, logo, textes, base). Les règles du `CLAUDE.md` racine ne s'appliquent pas ici.

## Référence
Le cahier des charges fait foi : `docs/cahier-des-charges-v1.1.pdf`. Les codes `RG-xx` (règles de gestion),
`EF-xx` (fonctionnelles) et `ET-xx` (techniques) y renvoient ; les citer dans le code et les tests.

## Métier en bref
- Fournisseur → **dépôt** (conditionnements de 6, 12 ou 24 bouteilles) → **boutique** (bouteilles) → clients.
- Le nom du conditionnement est **paramétrable** (caisse par défaut, carton, pack, casier…) — RG-05.
  Ne jamais écrire « carton » ou « caisse » en dur dans l'interface : utiliser le conditionnement du produit.
- Fiche journalière par produit : ST = SI + AL ; V = ST − SR − casse ; M = V × PU.
- Caisse : écart = (reçu + dépenses) − total des ventes (négatif = manquant).
- 29 produits initiaux (`noyau::catalogue`), formats et prix à confirmer par le propriétaire.

## Présentation (décidée avec le propriétaire)
- **Pas de barre latérale.** Fenêtre sans cadre : barre de titre dessinée (`BarreTitre.svelte`), puis barre de
  navigation horizontale permanente (`Navigation.svelte`) ; raccourcis : chiffres 1 à 5, Échap = accueil.
- **Angles droits** : cartes, boutons, champs, fenêtres modales sans arrondi (`--rayon: 0`).
- Accueil : liste numérotée des modules + indicateurs de stock. Identité propre (émeraude et ambre par défaut,
  police Manrope, icônes Lucide) : s'inspirer du principe de 2M Facturation, **jamais en copier le modèle**.
- Couleurs uniquement via `--p` / `--a` (thème choisi dans Paramètres → Apparence) et les variables de `app.css`.

## Règles techniques
- Rust (édition 2024), workspace Cargo : `crates/noyau` (pur, sans E/S), `crates/donnees` (SQLite via rusqlite),
  `app/src-tauri` (Tauri 2 : commandes seulement, aucune règle métier). Interface : `app/` (Svelte 5 + Vite + TS).
- **Quantités en bouteilles entières (`i64`)**, **montants en FCFA entiers (`i64`)**. Jamais de flottant.
- Le stock n'est pas stocké : c'est la somme de la table `mouvements`. Corriger = mouvement inverse.
- Toute écriture qui touche le stock se fait dans une transaction.
- Migrations versionnées (`schema_version`) ; une migration publiée n'est jamais modifiée.
- Dates `AAAA-MM-JJ` en base, `JJ/MM/AAAA` à l'écran. Textes de l'interface en français.
- Avant de terminer : `cargo fmt --all`, `cargo clippy --all-targets` (zéro avertissement), `cargo test`,
  puis dans `app/` : `npm run check` (zéro avertissement) et `npm run build`.
- Essai de bout en bout sous Linux : `cargo run -p donnees --example demo -- <dossier>` crée une base fictive ;
  `GD_DONNEES=<dossier> GD_ECRAN=parametres/produits target/debug/gestion-depot-app` (avec `vite preview --port 1420`).

## Avancement
- [x] Lot 1a — Cœur métier (`noyau`) : conversions et affichage des conditionnements, calculs et contrôles
  de la fiche (RG-10 à RG-13), caisse, catalogue initial. 17 tests.
- [x] Lot 1b — Données (`donnees`) : schéma complet (identité, présentation/thèmes, conditionnements,
  produits, prix datés, fournisseurs, réceptions, alimentations, journées, dépenses, inventaires,
  mouvements, journal), catalogue initial, stock d'ouverture, réceptions, alimentations (RG-14),
  inventaires, brouillon et validation de journée (RG-20, RG-21), situation des stocks. 11 tests.
- [x] Lot 1c — Application Tauri 2 : fenêtre sans cadre, navigation horizontale, accueil, situation des stocks,
  paramètres (boutique et logo, produits / formats / prix datés / seuils / ordre, conditionnements, stock
  d'ouverture, apparence : 8 thèmes, mode sombre, grand texte, modèles et en-têtes de documents avec aperçu).
  Données ajoutées : `donnees::parametres` (identité, présentation, conditionnements, produits, prix). 35 tests.
- [x] Lot 2 — Écrans Dépôt (`pages/Depot.svelte` + `pages/depot/`) : réceptions fournisseur (création rapide
  de fournisseur), alimentations de la boutique (stock du dépôt affiché, RG-14), inventaire dépôt ou boutique
  (théorique, compté, écart), fiche de stock d'un produit avec soldes. Saisie commune : `TableQuantites.svelte`.
- [x] Lot 3 — Fiche du jour (`pages/Fiche.svelte`) : saisie dans l'ordre de la fiche papier, Entrée = ligne
  suivante, calculs et alertes en direct par le cœur Rust (`fiche_apercu`), contrôle facultatif des chiffres
  du vendeur, caisse (reçu, dépenses, écart), brouillon, validation, réouverture de la dernière journée avec
  motif (RG-22, `donnees::consultations`). Historique (`pages/Historique.svelte`) : journées par période,
  totaux, écart cumulé ; un clic ouvre la fiche (`aller('fiche', undefined, date)`, adresse `#/fiche/AAAA-MM-JJ`).
  La base de démonstration contient deux semaines de fiches (13 validées, 1 brouillon). 38 tests.
- [x] Lot 4 — Rapports (`donnees::rapports` : rapport de période, indicateurs ; seules les journées validées
  comptent). Accueil = tableau de bord (jour / 7 jours / mois, histogramme 30 jours, meilleurs produits, rappel
  des brouillons). Historique → onglet « Rapport de période ». Impressions : `composants/Apercu.svelte` (aperçu
  A4 déplacé sous `<body>`, couleurs et mise en page modifiables, `@page` avec pied numéroté « page x / y »,
  `window.print()` → imprimante ou « Microsoft Print to PDF ») + feuille `documents.css` ; documents dans
  `pages/documents/` (fiche vierge paysage, situation du jour, rapport de période, mouvements du dépôt) et dans
  Situation, Fiche de stock, Inventaire (feuille de comptage, rapport d'écarts). Excel : `src-tauri/src/excel.rs`
  (rust_xlsxwriter, nombres bruts, en-têtes figés, filtres) + `lib/excel.ts` (fenêtre « Enregistrer sous »).
  Rendu imprimé vérifié avec Chromium (Playwright, `page.pdf`) : même moteur que WebView2.
- [x] Lot 5 — `donnees::securite` : mot de passe Argon2 dans `parametres` (ET-10 ; oubli = fichier
  `REINITIALISER-MOT-DE-PASSE.txt` dans le dossier des données), sauvegarde = `VACUUM INTO` + table
  `fichiers_joints` (logo) dans un seul fichier `.gdsauv` (ET-12, ET-13), copie automatique quotidienne au
  démarrage, 30 conservées (ET-11), vérification puis restauration avec copie « avant-restauration » (logo
  replacé dans le dossier d'images local). Application : verrou (`Etat.deverrouille`, `base()` refuse tant que
  verrouillé, `base_libre()` pour l'identité et l'apparence), écran `pages/Verrou.svelte`, bouton Verrouiller,
  onglet Paramètres → Sauvegarde et sécurité, rappel hebdomadaire sur l'accueil, journal des erreurs
  `journal-erreurs.log` (ET-06, `src-tauri/src/journal.rs`). 45 tests.
- [x] Version 1.0.0. Installateur : `.github/workflows/gestion-depot.yml` (tests sur Ubuntu, NSIS sur
  `windows-latest`, artefact `Gestion-Depot-Setup`, joint à la Release pour un tag `gestion-depot-*`, distinct
  des tags `v*` de 2M). WebView2 : `downloadBootstrapper` silencieux (rien à télécharger à la construction).
  Les exécutions GitHub Actions du dépôt échouent en 3 s sans démarrer (problème de compte, depuis le 6/10) :
  l'installateur se construit aussi depuis Linux avec MinGW (`--target x86_64-pc-windows-gnu`, voir README),
  vérifié sous Wine (`LANG=C.UTF-8` obligatoire, sinon les noms accentués échouent) : installation silencieuse
  `/S`, raccourcis Bureau et menu Démarrer, lancement de l'exécutable.
