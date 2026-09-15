# Naissance (IA personnelle) — architecture

Document de référence pour Claude et ChatGPT. L'utilisateur ne touche jamais au code.

## Chaîne de livraison
- Un colis = un fichier .zip envoyé à la RACINE du dépôt (GitHub → Add file → Upload files → Commit).
- Le robot (`.github/workflows/`) contrôle, applique, vérifie, publie. Résultat dans `ETAT.md`.
- Le robot n'est jamais modifié par un colis : mise à jour manuelle uniquement.

## Format d'un colis
- `_livraison.json` à la racine du zip :
  `{ "version": "X.Y.Z", "description": "…", "apk": false, "supprimer": ["chemin/a/effacer"] }`
- `version` doit être plus grande que celle du fichier `VERSION`.
- Chaque fichier du zip remplace entièrement l'ancien ; les fichiers absents du zip ne bougent pas.
- Retour arrière : `{ "action": "retour", "cible": "0.1.0", "version": "0.1.1" }` (rien d'autre dans le zip).
- Interdits dans un colis : `.git/`, `.github/`, `signature/`, `node_modules/`, `android/`,
  `ETAT.md`, `VERSION`, un .zip à la racine, `..`, chemins absolus, liens.
- La version s'injecte seule dans toute ligne de `app/*.js` marquée `VERSION_AUTO`, dans `VERSION` et `package.json`.

## Vérifications avant validation
Syntaxe JS (app/, tests/, outils-android/), JSON, tests `tests/**/*.test.mjs`,
puis ouverture de `app/` dans Chromium : aucune erreur JS, aucun fichier manquant,
`document.documentElement.dataset.demarrage === "ok"`, version visible dans `[data-version]`.

## Organisation du code
- `app/` : l'application (PWA) et le contenu de l'APK (webDir Capacitor). Modules JS natifs, sans outil de construction.
- Petits modules à marqueurs uniques (`// === DEBUT_… ===` / `// === FIN_… ===`).
- `tests/` : tests automatiques (non publiés).
- `outils-android/preparer.mjs` (facultatif) : adapte le projet Android généré (permissions…) avant compilation.
- APK : `"apk": true` dans le colis ; signé avec `signature/naissance.jks` (créée par le robot, dépôt public assumé).

## Mémoire (décision reportée)
Pas encore implémentée. Toute future mémoire passera par un seul module `app/memoire/`
exposant au minimum `exporter()` → un fichier JSON et `importer(fichier)`,
pour pouvoir passer de la PWA à l'APK (stockages séparés) sans rien perdre.
Aucune clé d'API ne doit jamais entrer dans le dépôt : elle sera saisie dans l'appli et gardée sur le téléphone.
