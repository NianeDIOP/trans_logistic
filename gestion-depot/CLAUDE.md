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

## Règles techniques
- Rust (édition 2024), workspace Cargo : `crates/noyau` (pur, sans E/S), `crates/donnees` (SQLite via rusqlite).
- **Quantités en bouteilles entières (`i64`)**, **montants en FCFA entiers (`i64`)**. Jamais de flottant.
- Le stock n'est pas stocké : c'est la somme de la table `mouvements`. Corriger = mouvement inverse.
- Toute écriture qui touche le stock se fait dans une transaction.
- Migrations versionnées (`schema_version`) ; une migration publiée n'est jamais modifiée.
- Dates `AAAA-MM-JJ` en base, `JJ/MM/AAAA` à l'écran. Textes de l'interface en français.
- Avant de terminer : `cargo fmt --all`, `cargo clippy --all-targets` (zéro avertissement), `cargo test`.

## Avancement
- [x] Lot 1a — Cœur métier (`noyau`) : conversions et affichage des conditionnements, calculs et contrôles
  de la fiche (RG-10 à RG-13), caisse, catalogue initial. 17 tests.
- [x] Lot 1b — Données (`donnees`) : schéma complet (identité, présentation/thèmes, conditionnements,
  produits, prix datés, fournisseurs, réceptions, alimentations, journées, dépenses, inventaires,
  mouvements, journal), catalogue initial, stock d'ouverture, réceptions, alimentations (RG-14),
  inventaires, brouillon et validation de journée (RG-20, RG-21), situation des stocks. 11 tests.
- [ ] Lot 1c — Application Tauri 2 : fenêtre, accueil, paramètres (produits, formats, prix, conditionnements,
  identité, en-têtes, thèmes).
- [ ] Lot 2 — Écrans Dépôt (réceptions, alimentations, inventaire, fiche de stock).
- [ ] Lot 3 — Écran Fiche journalière, caisse, historique, réouverture tracée (RG-22).
- [ ] Lot 4 — Tableau de bord, rapports, impressions PDF, export Excel, fiche vierge.
- [ ] Lot 5 — Mot de passe, sauvegardes, export complet, installateur Windows.
