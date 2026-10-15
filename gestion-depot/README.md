# Gestion Dépôt et Boutique

Application de bureau Windows, **hors connexion**, développée en **Rust**, pour une boutique de boissons :

- stock du **dépôt** en caisses (ou cartons, packs… : nom paramétrable) et en bouteilles ;
- stock de la **boutique** en bouteilles ;
- saisie et contrôle de la **fiche journalière** remplie à la main par le vendeur ;
- **caisse du jour** : total des ventes, argent reçu, dépenses, écart ;
- situation actuelle, historique, rapports, impressions.

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

## Construire l'installateur Windows

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
