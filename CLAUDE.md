# CLAUDE.md — Application de facturation 2M Logistique et Transport

Ce fichier est lu automatiquement par Claude Code à chaque session.
Il décrit le projet, les règles métier et les conventions à respecter.

## 1. Objectif

Application **desktop Windows**, fonctionnant **hors connexion**, pour générer les factures
de transport de conteneurs de l'entreprise **2M Logistique et Transport** (Sénégal).

Écran d'accueil avec 4 boutons :
1. **Nouvelle facture**
2. **Historique**
3. **Tableau de bord**
4. **Paramètres**

## 2. Stack technique (ne pas changer sans accord)

- Electron + React + Vite + TypeScript
- SQLite via `better-sqlite3` (fichier local dans le dossier `userData` d'Electron)
- PDF : modèle HTML rendu puis `webContents.printToPDF` (format A4)
- Graphiques : Recharts
- Tests : Vitest
- Packaging : electron-builder (cible Windows NSIS `.exe`)
- Langue de l'interface : **français**

## 3. Informations de l'entreprise (valeurs par défaut des Paramètres)

- Raison sociale : 2M LOGISTIQUE ET TRANSPORT
- RC : SNLGA 2021-B991
- NINEA : 008740947 2H2
- Banque : BICIS Louga — N° SN10 07534 007766000006 09
- Siège opérationnel : Dakar
- Adresse : Quartier Thiokhna, Louga
- Email : 2mlogistiquetransport25@gmail.com
- Téléphone : (+221) 77 533 65 33

Toutes ces valeurs sont modifiables dans Paramètres et stockées en base, jamais codées en dur dans le PDF.

## 4. Règles métier (IMPORTANT)

### Montants
- Devise : **franc CFA (FCFA)**, sans décimales.
- Stocker tous les montants en **entiers**. Jamais de `float` pour l'argent.
- Affichage avec séparateur de milliers par espace : `85 100`.

### TVA
- Taux par défaut : **18 %** (paramétrable).
- La TVA s'applique **ligne par ligne** : chaque ligne a un champ `soumis_tva` (booléen).
- Les débours (ex. frais AGS, imprimé) sont **hors TVA**.
- Calcul :
  - `total_ht` = somme de toutes les lignes
  - `base_tva` = somme des lignes où `soumis_tva = true`
  - `total_tva` = arrondi(base_tva × taux)
  - `total_ttc` = total_ht + total_tva

**Cas de test obligatoire** (doit passer) :
| Ligne | Montant | TVA |
|---|---|---|
| Transport Dakar Zone 1, conteneur 20' | 70 000 | oui |
| AGS aller simple | 1 500 | non |
| Imprimé | 1 000 | non |

Résultat attendu : HT = 72 500, TVA = 12 600, TTC = 85 100,
en lettres : « Quatre-vingt-cinq mille cent francs CFA ».

### Montant en lettres
- Fonction `nombreEnLettres(n)` en français, avec tests unitaires.
- Respecter : « quatre-vingts » (avec s seul), « cent » / « cents », « mille » invariable,
  « et un » (vingt et un, trente et un…), traits d'union.
- Couvrir de 0 à 999 999 999.

### Numérotation
- Format : `{prefixe}-{année}-{numéro sur 4 chiffres}`, ex. `2M-2026-0001`.
- Numéro attribué **uniquement à la validation** (pas au brouillon).
- Séquentiel, sans trou, repart à 0001 chaque année. Attribution dans une transaction SQLite.

### Statuts et intégrité
- Statuts : `brouillon`, `emise`, `payee`, `partiellement_payee`, `annulee`.
- Un brouillon est modifiable et supprimable.
- Une facture validée n'est **jamais modifiée ni supprimée**. Pour l'annuler : créer un **avoir**
  (numéro préfixé `AV-`) qui la référence.

## 5. Modèle de données

```sql
entreprise   (id, raison_sociale, rc, ninea, banque, iban, siege, adresse, email, tel,
              logo_path, cachet_path, taux_tva, prefixe_facture)
clients      (id, raison_sociale, adresse, ninea, tel, email, cree_le)
factures     (id, numero, type /*facture|avoir*/, facture_origine_id, date, client_id,
              num_bl, statut, total_ht, base_tva, total_tva, total_ttc, notes, cree_le, valide_le)
lignes       (id, facture_id, ordre, num_conteneur, type_conteneur /*20|40*/, zone,
              nature /*import|export*/, designation, montant_ht, soumis_tva)
zones_tarifs (id, zone, type_conteneur, prix)
paiements    (id, facture_id, date, montant, mode /*especes|cheque|virement|wave|orange_money*/, reference)
```

Gérer les migrations de schéma avec une table `schema_version`.

Tables de paramétrage à ajouter en Phase 3, par une **nouvelle migration** (ne jamais modifier la migration 1) :

```sql
prestations      (id, libelle, prix, soumis_tva, actif, ordre)   -- frais et débours : AGS, imprimé, etc.
types_conteneurs (id, code, libelle, actif, ordre)               -- 20', 40', 40' HC…
natures          (id, code, libelle, actif, ordre)               -- import, export…
modes_paiement   (id, code, libelle, actif, ordre)               -- espèces, chèque, virement, Wave, Orange Money
```
- Ajouter aussi `actif` à `clients` et `zones_tarifs`.
- `entreprise` reçoit les mentions de bas de facture (conditions de paiement, délai).
- Une donnée déjà utilisée par une facture n'est **jamais supprimée** : on la désactive (`actif = 0`).
- Les lignes de facture **recopient** les libellés et les montants au moment de la saisie (instantané). Une
  modification des Paramètres ne change donc jamais une facture existante.

## 6. Écrans

### Nouvelle facture
- Sélection ou création rapide d'un client.
- Champs : date (aujourd'hui par défaut), N° BL.
- Tableau de lignes éditable : N° conteneur, type, zone (liste depuis `zones_tarifs`,
  préremplit le prix), nature, désignation, montant HT, case TVA.
- Totaux et montant en lettres calculés en direct.
- Boutons : Aperçu PDF, Enregistrer brouillon, Valider et générer PDF, Imprimer.

### PDF
- A4, reprend l'en-tête et le pied de page de l'entreprise (logo, RC, NINEA, banque, contacts).
- Bloc client encadré à droite (raison sociale, adresse, N° BL).
- Titre « Facture N° … » et date.
- Tableau : N° TC, Type, Zone de livraison, Nature, Prix HT.
- Tableau TVA (base, taux, montant) + tableau Total HT / Total TTC / Net à payer.
- Montant en lettres sous les totaux.
- Zone cachet et signature.
- Nom de fichier : `Facture_2M-2026-0001_NomClient.pdf`.

### Historique
- Liste paginée, recherche par numéro, client, BL, conteneur, période et statut.
- Actions : ouvrir le PDF, dupliquer, enregistrer un paiement, créer un avoir.

### Tableau de bord
- CA HT et TTC du mois et de l'année, TVA collectée par mois.
- Impayés (montant + liste), top 5 clients, conteneurs par type et par zone.
- Filtre par période.

### Paramètres — principe d'automatisation (IMPORTANT)
**Toute donnée qui entre dans une facture provient des Paramètres.** La saisie d'une facture se fait
par **sélection dans des listes**, avec **préremplissage automatique** ; la saisie libre n'est qu'un
complément exceptionnel.

| Entrée de la facture | Référentiel dans Paramètres | Automatisme à la saisie |
|---|---|---|
| Client | Clients (raison sociale, adresse, NINEA, tél., email) | Recherche + création rapide ; bloc client du PDF rempli tout seul |
| Zone + type de conteneur | Grille zones/tarifs × types de conteneurs | Prix HT prérempli, ligne soumise à TVA |
| Nature | Natures (import/export…) | Liste déroulante |
| Frais et débours (AGS, imprimé…) | Prestations (libellé, prix, soumis à TVA) | Ajout en un clic, prix et case TVA préremplis |
| Taux de TVA | Entreprise (18 % par défaut) | Appliqué aux lignes cochées |
| Numéro de facture | Entreprise (préfixe) + séquence | Attribué à la validation |
| En-tête, pied, logo, cachet, banque | Entreprise | Repris sur le PDF |
| Mode de paiement | Modes de paiement | Liste déroulante (Phase 5) |

Écrans des Paramètres (onglets) :
- Entreprise : infos, logo, cachet, banque, taux de TVA, préfixe, mentions de bas de facture.
- Clients.
- Zones et tarifs.
- Prestations et débours.
- Listes : types de conteneurs, natures, modes de paiement.
- Sauvegarde (copie du fichier .db vers un dossier choisi) et restauration.

Les valeurs de départ (prestations AGS 1 500 et imprimé 1 000 hors TVA, types 20' et 40', import/export,
modes de paiement) sont insérées par la migration, puis restent modifiables.

## 7. Conventions

- Code et noms de variables en anglais ou français cohérent ; **textes UI en français**.
- Logique métier (calculs, numérotation, lettres) dans `src/core/`, testée, sans dépendance à Electron.
- Accès base uniquement dans le processus principal ; le renderer passe par IPC (`preload` + `contextBridge`).
- `contextIsolation: true`, `nodeIntegration: false`.
- Ne jamais committer : `node_modules/`, `dist/`, `release/`, `*.db`, `.env`.

### Identité visuelle (à respecter dans tous les écrans)
- Charte issue du **logo officiel** (`src/renderer/src/assets/logo-2m.png`, fond transparent) :
  **bleu roi et or**. Variables dans `styles.css` (`--bleu-marine`, `--bleu-roi`, `--or`, `--degrade-or`…),
  pas de couleur en dur ailleurs.
- Polices embarquées (hors ligne) : **Montserrat** pour les titres (800 italique pour les grands titres,
  comme le logo), **Source Sans 3** pour les textes et chiffres (chiffres tabulaires).
- Icônes : **Phosphor** (`@phosphor-icons/react`, noms suffixés `Icon`, poids `duotone`), en or sur
  pastille bleue dans les cartes et en-têtes. **Aucun emoji.**
- Fenêtre **sans cadre** (`frame: false`) : barre de titre et boutons Réduire / Agrandir / Fermer dessinés
  par l'application (`TitleBar.tsx`, glyphes dans `components/icons.tsx`).
- Cartes blanches arrondies (10 px), ombre légère, filet or au survol.
- Emblème compact « 2M » (`components/Emblem.tsx`, `build/icon.svg`) pour la barre de titre et l'icône
  Windows ; images de l'installateur NSIS dans `build/`.

## 8. Commandes

```bash
npm install        # installer
npm run dev        # lancer en développement
npm test           # tests
npm run build      # compiler
npm run dist       # générer l'installateur Windows
```

## 9. Façon de travailler

- Une fonctionnalité par session / par branche, puis Pull Request.
- Toujours lancer `npm test` et `npm run build` avant de terminer.
- Mettre à jour la section « Avancement » ci-dessous à la fin de chaque session.

## 10. Avancement

- [x] Phase 1 — Squelette Electron/React/SQLite, écran d'accueil 4 boutons
  - electron-vite (sortie dans `out/`), base `trans_logistic.db` dans `userData`.
  - Migrations dans `src/main/db/migrations.ts` (table `schema_version`), testées avec `node:sqlite`
    pour ne pas dépendre du binaire better-sqlite3 compilé pour Electron.
  - Electron 43 (pas 44) : better-sqlite3 13 fournit des binaires précompilés pour cette version.
  - Electron 43 ne télécharge plus son binaire tout seul : le `postinstall` lance `install-electron`.
  - Taux de TVA stocké en pourcentage entier (`18`).
- [x] Phase 2 — `src/core` : calculs TVA, montant en lettres, numérotation + tests
  - `src/core/` : `montants.ts` (format « 85 100 », lecture de saisie), `tva.ts` (`calculerTotaux`),
    `lettres.ts` (`nombreEnLettres`, `montantEnLettres`), `numerotation.ts` (format, prochain numéro).
  - TVA : arrondi à l'entier le plus proche, demis éloignés de zéro (symétrique pour les avoirs).
  - Lettres : orthographe traditionnelle (« quatre-vingt mille », « quatre-vingts millions »,
    « deux millions de francs CFA »).
  - Avoirs : séquence propre, format `AV-2M-2026-0001`. L'année est celle de la date de la facture.
  - `src/main/db/numerotation.ts` : `validerFacture` attribue le numéro dans une transaction
    `BEGIN IMMEDIATE` et passe la facture en « emise ».
- [ ] Phase 3 — Paramètres (entreprise, clients, zones/tarifs, prestations, listes) — voir « principe d'automatisation »
- [ ] Phase 4 — Nouvelle facture + PDF
- [ ] Phase 5 — Historique, statuts, paiements, avoirs
- [ ] Phase 6 — Tableau de bord
- [ ] Phase 7 — Sauvegarde/restauration, packaging .exe, GitHub Actions
