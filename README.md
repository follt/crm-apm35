# CRM APM35

Application desktop de gestion commerciale pour SARL bâtiment (plâtrerie, isolation, jointement, menuiserie). Clients, catalogue, devis, factures, relances, PDF pro et envoi email direct depuis l'app.

**Stack** : Electron + React + TypeScript + SQLite (better-sqlite3) + PDFKit + Nodemailer. 100 % local — aucune donnée ne sort de l'ordinateur sauf pour l'envoi d'emails SMTP.

---

## Installation (utilisateur final)

### Windows

1. Télécharger la dernière version sur la page [Releases](../../releases/latest) → fichier `CRM-APM35-Setup-<version>.exe`
2. Double-cliquer sur l'installateur
3. **Windows SmartScreen** va afficher "Cette application n'a pas été reconnue par Microsoft Defender" :
   - Cliquer sur **"Informations complémentaires"**
   - Puis **"Exécuter quand même"**
4. Choisir le dossier d'installation, laisser les raccourcis par défaut
5. L'app se lance automatiquement après l'installation

### macOS

1. Télécharger le fichier `CRM APM35-<version>-<arch>.dmg` depuis [Releases](../../releases/latest)
2. Ouvrir le DMG, glisser l'app dans le dossier **Applications**
3. Au premier lancement : **clic droit** sur l'app → **Ouvrir** → **Ouvrir** (pour contourner l'avertissement "développeur non identifié")

---

## Première utilisation

L'app démarre avec des données de démo (clients + catalogue). Pour partir vierge :

**Paramètres → Entreprise → bas de page → "Tout effacer (+ catalogue)"**

Puis :
1. Remplir les infos entreprise (raison sociale, SIRET, adresse, IBAN, etc.)
2. Uploader un **logo bannière** (pour les PDF) et une **icône carrée** (pour la sidebar)
3. Configurer le **SMTP** (onglet Email) avec un Gmail + [mot de passe d'application](https://myaccount.google.com/apppasswords)
4. Créer clients, catalogue, premier devis

Les données sont stockées localement dans :
- **Windows** : `%APPDATA%\CRM APM35\`
- **macOS** : `~/Library/Application Support/CRM APM35/`

**Backup** = copier ce dossier (inclut la BDD SQLite, les PDF générés, le logo).

---

## Publier une nouvelle version (pour envoyer à quelqu'un)

Les installers Windows et macOS sont générés automatiquement par GitHub Actions à chaque push d'un tag `v*`. Procédure :

```bash
# 1. (optionnel) Mettre à jour l'icône de l'app
#    Remplacer build/icon.png par votre PNG carré (512×512 minimum).
#    Cette icône sert pour :
#    — l'icône de l'installeur (EXE/DMG)
#    — le raccourci bureau + menu Démarrer
#    — l'icône dans la barre des tâches Windows / le Dock macOS

# 2. Bump la version
npm version patch   # 0.1.0 → 0.1.1 (ou minor / major)

# 3. Push commit + tag
git push origin main --tags
```

Le workflow GitHub compile sur Windows + macOS en parallèle (~8-12 min), publie les installers sur la page **Releases** du repo. Le lien direct à envoyer :

```
https://github.com/<votre-user>/<votre-repo>/releases/latest
```

Côté destinataire : 1 clic → télécharge l'installeur → double-clic → install → ça y est.

### Changer l'icône de l'app

L'icône qui apparaît **sur le bureau, dans la barre des tâches, dans l'installeur** est lue depuis `build/icon.png` au moment du build.

Pour la changer :

1. Préparer un PNG carré (idéalement 512×512 px ou plus, fond transparent)
2. Remplacer `build/icon.png` par votre fichier
3. `git add build/icon.png && git commit -m "update icon"`
4. Bumper la version + push tag (voir ci-dessus)

L'icône affichée **dans l'app** (sidebar en haut à gauche) est **séparée** et modifiable depuis l'app elle-même : *Paramètres → Entreprise → Icône d'application*. Pas besoin de rebuild pour ça.

---

## Développement

```bash
npm install
npm run dev        # Vite + Electron en watch mode
```

Build production :
```bash
npm run build      # compile renderer + main vers dist/ et dist-electron/
```

Packager un installer localement (nécessite la plateforme cible installée) :
```bash
npm run dist:mac   # macOS DMG → release/
npm run dist:win   # Windows EXE → release/
```

---

## Sécurité

- `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true`
- Preload → **allowlist stricte** des canaux IPC
- `shell:open-file` limité aux `.pdf` du dossier `userData/pdfs/`
- Mot de passe SMTP chiffré via **Electron safeStorage** (DPAPI sur Windows, Keychain sur macOS)
- CSP stricte dans `index.html`
- `setWindowOpenHandler` → bloque ouverture de fenêtres externes
- Pas de code signing — installer non signé, avertissement SmartScreen/Gatekeeper au premier lancement à contourner manuellement

---

## Licence

Propriétaire — usage interne SARL APM35.
