# Guide de démarrage — Projet trans_logistic

Application desktop de facturation pour **2M Logistique et Transport**.

- Dépôt GitHub : https://github.com/NianeDIOP/trans_logistic
- Développement : **Claude Code (sessions cloud)** avec le crédit de 100 $ (expire le 5 novembre)
- Tests de l'application : **sur votre PC Windows**

Suivez ce guide dans l'ordre. Les étapes 1 à 4 se font **une seule fois**.

---

## Comment ça marche (à lire d'abord)

```
 Votre PC (local)                 GitHub                     Claude Code (cloud)
 ────────────────                 ──────                     ───────────────────
 Vous testez l'app   ◄── git pull ──  Le code est   ◄── Pull Request ──  Claude écrit
 (npm run dev)                        stocké ici                        le code
                     ── git push ──►                ── lit le dépôt ──►
```

- **GitHub** est le point central : tout le code y est stocké.
- **Claude Code cloud** travaille directement sur le dépôt GitHub. Il ne voit pas votre PC.
- **Votre PC** sert à lancer et tester l'application (une session cloud ne peut pas afficher
  une fenêtre Windows).

Règle d'or : **avant de travailler en local, toujours faire `git pull`**.

---

## Étape 1 — Installer les outils sur votre PC

| Outil | Lien | Remarque |
|---|---|---|
| Git | https://git-scm.com/download/win | Garder les options par défaut (inclut « Git Credential Manager ») |
| Node.js **LTS** | https://nodejs.org | Prendre la version LTS, cocher « Automatically install the necessary tools » |
| VS Code | https://code.visualstudio.com | Éditeur pour voir le code |

Vérification : ouvrez **PowerShell** et tapez :

```powershell
git --version
node --version
npm --version
```

Les trois commandes doivent afficher un numéro de version. Sinon, redémarrez le PC et réessayez.

---

## Étape 2 — Configurer Git (une seule fois)

Dans PowerShell, remplacez par votre nom et l'email de votre compte GitHub :

```powershell
git config --global user.name "Niane DIOP"
git config --global user.email "votre-email@exemple.com"
git config --global init.defaultBranch main
```

---

## Étape 3 — Récupérer le dépôt sur votre PC

Choisissez un dossier de travail simple, **sans espaces ni accents**, par exemple `C:\projets`.

```powershell
mkdir C:\projets
cd C:\projets
git clone https://github.com/NianeDIOP/trans_logistic.git
cd trans_logistic
```

- Si le dépôt est vide, Git affiche « You appear to have cloned an empty repository ». **C'est normal.**
- À la première connexion, une fenêtre de navigateur s'ouvre pour vous connecter à GitHub. Acceptez.

Votre dossier de travail est maintenant : **`C:\projets\trans_logistic`**.
C'est **le seul dossier** dans lequel vous travaillez pour ce projet.

---

## Étape 4 — Ajouter les fichiers de base et les envoyer sur GitHub

### 4.1 Copier les fichiers

Placez à la racine de `C:\projets\trans_logistic` :

- `CLAUDE.md` (le cahier des charges, lu automatiquement par Claude Code)
- `GUIDE_DEMARRAGE.md` (ce guide)

### 4.2 Créer le fichier `.gitignore`

Créez un fichier nommé exactement `.gitignore` (avec le point) à la racine, avec ce contenu :

```gitignore
# Dépendances et compilation
node_modules/
dist/
dist-electron/
release/
out/

# Données (JAMAIS sur GitHub)
*.db
*.db-journal
*.sqlite
sauvegardes/

# Secrets et système
.env
.env.*
.DS_Store
Thumbs.db

# Éditeur et journaux
.vscode/
*.log
```

### 4.3 Envoyer sur GitHub

```powershell
cd C:\projets\trans_logistic
git add .
git commit -m "Ajout du cahier des charges et du guide"
git push -u origin main
```

Vérifiez sur https://github.com/NianeDIOP/trans_logistic : les fichiers doivent apparaître.

---

## Étape 5 — Connecter Claude Code au dépôt

1. Ouvrez Claude Code dans sa version web (cloud).
2. Connectez votre compte GitHub quand c'est demandé et autorisez l'accès au dépôt **trans_logistic**.
3. Sélectionnez le dépôt **NianeDIOP/trans_logistic** pour démarrer une session.

Le crédit de 100 $ s'applique automatiquement aux sessions cloud.

---

## Étape 6 — Le cycle de travail (à répéter pour chaque phase)

### A. Dans Claude Code (cloud)

Ouvrez **une nouvelle session par phase** et donnez la demande correspondante :

| Phase | Demande à copier |
|---|---|
| 1 | Lis CLAUDE.md et réalise la Phase 1 : squelette Electron + React + TypeScript + SQLite avec l'écran d'accueil à 4 boutons. Crée une Pull Request. |
| 2 | Lis CLAUDE.md et réalise la Phase 2 : `src/core` avec calcul TVA, montant en lettres et numérotation, avec tests. Le cas 72 500 / 12 600 / 85 100 doit passer. Crée une Pull Request. |
| 3 | Lis CLAUDE.md et réalise la Phase 3 : écran Paramètres (entreprise, clients, zones/tarifs). Crée une Pull Request. |
| 4 | Lis CLAUDE.md et réalise la Phase 4 : écran Nouvelle facture et génération du PDF. Crée une Pull Request. |
| 5 | Lis CLAUDE.md et réalise la Phase 5 : Historique, statuts, paiements et avoirs. Crée une Pull Request. |
| 6 | Lis CLAUDE.md et réalise la Phase 6 : Tableau de bord. Crée une Pull Request. |
| 7 | Lis CLAUDE.md et réalise la Phase 7 : sauvegarde/restauration, installateur .exe et GitHub Actions. Crée une Pull Request. |

### B. Sur GitHub

1. Ouvrez l'onglet **Pull requests** du dépôt.
2. Ouvrez la Pull Request créée par Claude, lisez le résumé.
3. Cliquez sur **Merge pull request** puis **Confirm merge**.

### C. Sur votre PC

```powershell
cd C:\projets\trans_logistic
git pull
npm install
npm run dev
```

- `git pull` récupère le nouveau code.
- `npm install` installe les dépendances (nécessaire quand de nouvelles ont été ajoutées).
- `npm run dev` lance l'application.

Testez. Si quelque chose ne va pas, notez-le précisément pour la session suivante.

### D. Signaler un problème à Claude

Mauvais exemple : « ça ne marche pas ».
Bon exemple : « Dans Nouvelle facture, avec les lignes 70 000 (TVA), 1 500 et 1 000 (sans TVA),
le TTC affiche 85 550 au lieu de 85 100. »

Si une erreur s'affiche dans PowerShell, **copiez le message d'erreur complet** dans la demande.

---

## Commandes utiles

| Commande | Rôle |
|---|---|
| `git pull` | Récupérer les derniers changements depuis GitHub |
| `git status` | Voir les fichiers modifiés localement |
| `npm install` | Installer les dépendances |
| `npm run dev` | Lancer l'application en mode développement |
| `npm test` | Lancer les tests |
| `npm run dist` | Créer l'installateur Windows (.exe) dans `release/` |

---

## Si vous modifiez vous-même un fichier en local

Exemple : vous changez un texte ou le logo.

```powershell
git pull
git add .
git commit -m "Description courte de la modification"
git push
```

Faites toujours `git pull` **avant** de modifier, pour éviter les conflits avec le travail de Claude.

---

## Problèmes fréquents

| Problème | Solution |
|---|---|
| `git` ou `npm` non reconnu | Redémarrer le PC après l'installation |
| `git push` refusé (« rejected ») | Faire `git pull` puis refaire `git push` |
| Erreur à `npm install` avec `better-sqlite3` | Réinstaller Node.js LTS en cochant « Automatically install the necessary tools » |
| L'app ne démarre pas après un `git pull` | Refaire `npm install` puis `npm run dev` |
| Conflit Git (`CONFLICT`) | Ne rien forcer ; copier le message et demander de l'aide |

---

## Règles importantes

1. **Ne jamais envoyer la base de données (`.db`) ni de vraies données clients sur GitHub.**
   Le `.gitignore` les bloque ; ne le supprimez pas.
2. Le dépôt doit rester **privé** (Settings → General → Danger Zone → Change visibility).
3. **Une phase = une session = une Pull Request.** Des demandes précises consomment moins de crédit.
4. Le crédit expire le **5 novembre** : visez les phases 1 à 4 dans les deux premières semaines.
5. Sauvegardez régulièrement la base de données de l'application (fonction prévue en Phase 7).

---

## Suivi de l'avancement

Cochez au fur et à mesure (la même liste existe dans CLAUDE.md, que Claude met à jour) :

- [ ] Étapes 1 à 5 : installation et connexion
- [ ] Phase 1 — Squelette et écran d'accueil
- [ ] Phase 2 — Calculs, montant en lettres, numérotation
- [ ] Phase 3 — Paramètres
- [ ] Phase 4 — Nouvelle facture et PDF
- [ ] Phase 5 — Historique, paiements, avoirs
- [ ] Phase 6 — Tableau de bord
- [ ] Phase 7 — Sauvegarde, installateur, GitHub Actions
