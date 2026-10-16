# Gestion Dépôt et Boutique

Application de bureau Windows, **hors connexion**, développée en **Rust**, pour une boutique de boissons :

- stock du **dépôt** en caisses (ou cartons, packs… : nom paramétrable) et en bouteilles ;
- stock de la **boutique** en bouteilles ;
- saisie et contrôle de la **fiche journalière** remplie à la main par le vendeur ;
- **caisse du jour** : total des ventes, argent reçu, dépenses, écart ;
- situation actuelle, historique, rapports, impressions (PDF) et export Excel ;
- tableau de bord, fiche vierge à imprimer pour le vendeur ;
- mot de passe, sauvegardes automatiques et sur clé USB, restauration, changement d'ordinateur.

Un seul utilisateur : le propriétaire.

> Projet **indépendant** de « 2M Facturation » (le reste de ce dépôt) : code, base de données, identité,
> installateur et documentation séparés. Rien n'est partagé.

## Documents

- [Cahier des charges v1.1](docs/cahier-des-charges-v1.1.pdf)

## Organisation

```
gestion-depot/
├── crates/noyau     règles de gestion pures (conversions, fiche, contrôles, caisse) + tests
├── crates/donnees   base SQLite : schéma, migrations, stocks, réceptions, alimentations, journées + tests
├── app/             interface (Svelte 5) et application de bureau (app/src-tauri, Tauri 2)
└── docs/            cahier des charges
```

## Installer (version prête)

L'installateur est construit automatiquement par GitHub Actions (workflow « Gestion Dépôt — tests et
installateur Windows ») :
- à chaque modification sur `main` : artefact **Gestion-Depot-Setup** de l'exécution ;
- pour une version (tag `gestion-depot-1.0.0`, etc.) : fichier `.exe` joint à la page **Releases** du dépôt.

Double-cliquer sur le `.exe`. Installateur non signé : à l'avertissement de Windows, « Informations
complémentaires » puis « Exécuter quand même ».

Données : `%APPDATA%\sn.niane.gestion-depot\` (base, logo, sauvegardes automatiques, journal des erreurs).

## Construire l'installateur depuis Linux (sans Windows)

```bash
sudo apt-get install gcc-mingw-w64-x86-64 nsis
rustup target add x86_64-pc-windows-gnu
cd gestion-depot/app && npm ci && npm run tauri build -- --target x86_64-pc-windows-gnu
```

Résultat : `gestion-depot/target/x86_64-pc-windows-gnu/release/bundle/nsis/Gestion Dépôt et Boutique_<version>_x64-setup.exe`
(WebView2Loader.dll est inclus ; si le moteur WebView2 manque sur le PC, l'installateur le télécharge).

## Construire l'installateur soi-même sur Windows

Une fois sur le PC Windows (une seule fois) :
1. Installer **Rust** : https://rustup.rs (choisir les options par défaut).
2. Installer **Visual Studio Build Tools**, charge de travail « Développement Desktop en C++ ».
3. Node.js est déjà installé (utilisé pour 2M Facturation).

Puis, à chaque nouvelle version :

```bash
cd gestion-depot\app
npm ci
npm run tauri build
```

L'installateur se trouve dans `gestion-depot\target\release\bundle\nsis\`.
Pour essayer sans installer : `npm run tauri dev`.

## Commandes

```bash
cd gestion-depot
cargo test           # tous les tests
cargo clippy --all-targets
cargo fmt --all
cd app && npm run check && npm run build
```

Conception : Niane Diop · 77 158 89 03
