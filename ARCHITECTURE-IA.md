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

## Conversation (v0.3.0)
- `app/fournisseurs/` : un adaptateur par fournisseur, même interface :
  `tester({ cle })` → `{ ok, methode, modeles, modeleParDefaut, essais, erreur }` ;
  `envoyer({ historique, cle, methode, modele })` → texte. Inscription dans `registre.js`.
  Erreurs communes : `erreurs.js` (codes cle, acces, region, modele, quota, service, requete, reseau, delai, reponse, bloque, vide).
- `gemini.js` : Google AI Studio, offre gratuite. Aucun format de clé supposé (les clés actuelles commencent par « AQ. »).
  Le test essaie l'en-tête `x-goog-api-key`, puis `?key=`, puis `Authorization: Bearer`, et retient la première méthode acceptée.
  Modèle choisi dans la liste renvoyée par Google (préférence : « flash » stable le plus récent).
- `app/reglages/` : clé nettoyée (espaces, invisibles, guillemets), résumé masqué début…fin + longueur,
  stockage local `naissance-ia.reglages.v1` via `stockage.js` uniquement.
- `app/conversation/` : historique en mémoire vive (40 derniers messages réussis), mise en forme sûre (`texte.js`).

## Identité et mémoire (v0.4.0)
Principe : Naissance = ses données (identité, souvenirs, histoire), sur le téléphone. Le moteur est interchangeable.

- `app/esprit/identite.js` : noyau (nom, personne, nature, principes, langue) + traits (vides ; statut actif|propose|retire).
  Le noyau ne change que par la personne (seul le prénom est modifiable dans l'appli). La consolidation n'y touche jamais.
- `app/esprit/contexte.js` : compose instructions + historique dans des budgets fixes
  (fil 1 500 car., souvenirs 3 000, récents 12 000 / 30 messages), sans connaître le moteur.
- `app/esprit/consolidation.js` (pur) + `app/esprit/esprit.js` (orchestration) :
  - extraction dès 12 messages non analysés (ou 2 au retour après 30 min d'absence) ;
  - résumé quand plus de 36 messages suivent le fil (les 16 derniers ne sont jamais résumés) ;
  - un seul appel `generer` en JSON par rangement ; réponse validée avant application ;
  - échec : rien n'avance, nouvel essai après 5 min.
- Souvenirs ACTIFS immédiatement. Champs : texte, categorie, importance 1-3,
  confiance certain|probable|incertain, source dit|deduit|manuel (jamais modifiée), statut actif|archive,
  origine {de, a}, historique des changements. Opérations du moteur : ajouter, corriger, oublier (= archiver), confirmer.
  Plafond 200 actifs (archivage des moins utiles, jamais des souvenirs manuels).
  Un souvenir modifié par la personne pendant un rangement n'est pas écrasé.
  Présentés au moteur comme « peuvent être inexacts, la personne a raison ».
- `app/memoire/` : `magasin.js` (IndexedDB « naissance-memoire », secours en mémoire vive),
  `memoire.js` (tables journal, souvenirs, resumes, cles{identite, meta, fil, sauvegardeAvantImport}),
  `selection.js`, `transfert.js`, `ecran.js` (écran Mémoire).
- Le journal garde tout ; un échange n'est écrit qu'après la réponse du moteur.
- Réglages et clé restent dans localStorage (`naissance-ia.reglages.v1`), jamais exportés.

## Fiabilité du moteur (v0.4.1)
Question purement technique : l'identité, la mémoire et leur format ne changent pas.
- `app/fournisseurs/fiabilite.js` : `executerAvecRepli` enveloppe chaque demande (conversation et rangement).
  - erreur 503/500 (`service`) : 1 relance sur le même modèle après 2,5 s ;
  - `service`, `delai`, `modele` (404), `quota` : repli vers un autre modèle ;
  - `cle`, `acces`, `region`, `bloque`, `requete` : arrêt immédiat (changer de modèle n'y changerait rien) ;
  - au plus 3 modèles différents par demande (≤ 6 appels dans le pire cas) ;
  - aucun ne répond : erreur `indisponible`, rien n'est écrit au journal.
- `app/fournisseurs/sante.js` : santé observée des modèles dans localStorage `naissance-ia.moteurs.v1`
  (technique, jamais exportée). Mise en pause après échec : service 10 min, délai 10 min, quota 15 min, 404 7 jours.
  Ordre d'essai : modèle choisi (s'il n'est pas en pause), modèles confirmés récemment, puis ordre de préférence.
- Un modèle n'est jugé utilisable que s'il a réellement répondu : le test de clé (Réglages) sonde les modèles
  (`sonder`, appel minimal) jusqu'au premier qui répond (3 au plus). La liste affiche vérifié / en pause / indisponible.
- Repli : le contexte est recomposé avec le nom du moteur réellement utilisé, inscrit au journal ;
  une note discrète s'affiche sous la réponse. Modèle disparu (404) : le modèle de repli devient le choix enregistré.
- Message non envoyé : gardé dans localStorage `naissance-ia.message-en-attente.v1` dès l'envoi,
  effacé seulement après une vraie réponse ; remis dans le champ au redémarrage ; bouton « Réessayer ».
- Interactions API de Google : non adoptée (l'API actuelle fonctionne) ; à étudier séparément.

## Export / import
- Fichier `naissance-<id8>-AAAA-MM-JJ.json` : { format "naissance", schema 1, exporteLe, versionAppli, idNaissance,
  empreinte SHA-256 de JSON(donnees), donnees { cles, journal, souvenirs, resumes } }.
- APK : `@capacitor/filesystem` (cache) puis `@capacitor/share` (menu Partager), appelés par `app/natif.js`
  via `Capacitor.nativePromise`. PWA : téléchargement.
- Import : vérification complète avant toute écriture, avertissements (autre Naissance, fichier plus ancien),
  remplacement atomique, copie de secours de l'état précédent (« Revenir à la mémoire d'avant le dernier import »).
- Rappel d'export après 7 jours. `navigator.storage.persist()` demandé.
- Maison principale : l'APK. La PWA sert aux tests.
