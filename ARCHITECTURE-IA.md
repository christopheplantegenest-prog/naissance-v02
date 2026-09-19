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

## Grand banc autonome de diagnostic (v0.7.4) — instrument de mesure, pas de correction
Toujours LFM2-350M Q4_0 inchangé, aucune correction de la sélection, des rôles, des inventions,
de l'aveu d'ignorance ou du moteur local. Réglages → Moteur local → Diagnostic → Grand banc autonome.
- Plan de 160 essais (`grand-banc-plan.js`), déterministe, six expériences qui font varier UNE
  propriété à la fois : variabilité (graine fixe vs graines variées, référence de bruit), identité
  (normale / très courte / aucune, mêmes graines entre conditions — la longueur réelle de chaque
  condition est mesurée et publiée telle quelle plutôt que forcée par du remplissage, pour ne pas
  introduire le biais que ce remplissage créerait lui-même), personne grammaticale (1re / 2e / 3e,
  souvenir imposé, mêmes graines), fait fourni (4 catégories × 3 variantes), information absente
  (4 catégories × graine fixe/variée), complétion après un fait vrai (géographique vs non).
- Journal persistant dans une base IndexedDB SÉPARÉE (`naissance-banc-diagnostic`,
  `grand-banc-stockage.js`) : aucun lien avec `naissance-memoire`, l'effacer ou la supprimer n'a
  aucune conséquence sur Naissance. Un essai est enregistré immédiatement après sa génération,
  jamais en fin de lot.
- Exécution par lots de 8 (`grand-banc.js`, `executerLot`), pause de 2,5 s entre deux lots. La
  reprise relit simplement le journal et saute tout essai déjà présent : « Lancer » et « Reprendre »
  sont le même bouton, à réappuyer après toute fermeture ou arrêt.
- Classements affinés propres à deux expériences (`grand-banc-classement.js`), construits sur les
  `details` déjà calculés par `classer()` (classement.js inchangé) : information absente (aveu,
  clarification, refus, invention, proposition imaginative assumée, autre — plusieurs marqueurs
  possibles par réponse) ; complétion après un fait vrai (arrêtée, ajout stylistique, ajout
  géographique, autre fait inventé).
- Rapport en deux niveaux, copiables dans le presse-papiers : synthèse (essais prévus/réalisés,
  échecs, répartition par catégorie, répétabilité à graine fixe) et données brutes (chaque essai,
  question, préfixe exact envoyé, réponse brute complète, jamais rien supprimé même si aberrant).
- `identiteCourte` ajoutée dans `contexte-local.js`, à côté de `sansIdentite` (v0.7.1) : condition
  expérimentale du banc uniquement, jamais engagée en conversation normale.
- Aucun changement de schéma IndexedDB de la mémoire de Naissance ; `ecran.js` (banc rapide) non
  modifié.

## Diagnostic approfondi (v0.7.3) — corrections du diagnostic lui-même, pas du moteur
Construite à partir des résultats réels de la v0.7.2 (souvenir imposé, types, longueur, rôles).
- `classement.js` : un vrai bug corrigé (le motif « Je suis... » n'avait pas le drapeau « i » et ratait
  systématiquement les débuts de phrase, toujours en majuscule) ; reprise d'un souvenir élargie aux
  mots-clés significatifs (motsCles), pas seulement noms propres/nombres (« La couleur préférée de
  Christophe est le bleu » n'est plus classé à tort « hors sujet ») ; inventions détectées aussi en
  minuscules (« la tradition chrétienne », « la province ») en excluant les variantes de conjugaison
  proches (habite/habites n'est jamais une invention) et les mots de la formule d'aveu d'ignorance
  elle-même (« sais » n'est pas une invention quand on dit qu'on ne sait pas) ; nouvelle catégorie
  « fait juste, mauvaise personne » (le cas le plus fréquent observé) ; nouveau motif d'appropriation
  « j'ai » (sans « je suis » explicite). Le classement reste approximatif et documenté comme tel ;
  la réponse brute est toujours conservée.
- `contexte-local.js` : trace de sélection complète — les souvenirs jamais candidats (aucun mot commun,
  ex. « appelle » / « appelles ») restent désormais visibles dans la trace avec leurs propres mots-clés,
  au lieu de disparaître silencieusement ; sans changer la sélection réelle. Condition expérimentale
  `sansIdentite` (retire la phrase d'identité du préfixe) — réservée au banc, jamais en conversation
  normale.
- `protocoles.js` : épreuve « Où habite {personne} ? » (question à la 3e personne) ajoutée au groupe
  Rôles ; nouveau groupe Identité (même question + même souvenir imposé, avec et sans la phrase
  d'identité) pour tester si l'amorce « Je suis {ia} de {personne}… » en vient.
- Graine de génération fixable de bout en bout (natif → Java → pont → moteur → banc → réglage dans
  Réglages → Moteur local → Diagnostic) : laissée vide, comportement inchangé (aléatoire). Fixée, la
  même graine s'applique à tous les essais d'un lancement du banc — à contexte identique, la réponse
  doit alors être identique, ce qui sépare l'effet du contexte de celui du tirage aléatoire.
- Rapport du banc : souvenirs écartés affichés avec leurs mots-clés et ceux de la question ; ligne
  « Graine fixée à… » quand elle est utilisée.
- Toujours aucune action sur le moteur (LFM2-350M Q4_0 inchangé), aucun changement de schéma.

## Diagnostic approfondi (v0.7.2) — OBSERVER → ISOLER → COMPRENDRE
Aucune solution nouvelle : cette version sert à cartographier les limites de LFM2-350M Q4_0 (inchangé).
- `app/moteur-local/protocoles.js` : épreuves en DONNÉES, par groupe —
  rôles (paires « je » / « tu » sur le nom, le lieu, la couleur), formulations d'un même fait,
  types de faits (lieu, prénom, couleur, nombre), souvenir imposé écrit de trois façons
  (3e personne / tutoiement / brut), information absente, longueur de réponse (20 contre 60 jetons).
- Souvenirs imposés (`souvenirsImposes`) et absence forcée (`sansSouvenirs`) dans le contexte local :
  ils court-circuitent la sélection pour distinguer « souvenir non retrouvé » de « souvenir ignoré ».
  Trace : statut `imposé`. Limite de jetons réglable par épreuve.
- `app/moteur-local/classement.js` : classement automatique et APPROXIMATIF en sept catégories
  (bonne, ignorance reconnue, souvenir non retrouvé, souvenir ignoré, confusion des rôles, invention,
  hors sujet) ; détecte la reprise d'un élément distinctif du souvenir, les éléments inventés
  (noms propres et nombres absents de l'invite) et les marques de confusion de rôle. La réponse brute
  est toujours conservée pour relecture humaine.
- Rapport : moyennes, classement global et par groupe, STABILITÉ (mêmes épreuves répétées :
  nombre de réponses différentes), puis le détail de chaque essai. Copiable.
- Le banc n'écrit toujours rien : ni journal, ni souvenirs, ni mesures courantes.

## Diagnostic du moteur local (v0.7.1)
Constat du 18/09 sur le téléphone : LFM2-350M retrouve parfois le bon souvenir puis invente autour,
parfois ne l'utilise pas du tout. Cette version sert à SAVOIR d'où vient le problème, sans changer de modèle.
- Deux variantes de contexte, choisies dans Réglages → Moteur local → Diagnostic :
  - « court » (défaut) : préfixe = identité minimale seule (≈ 100 jetons, stable donc toujours en cache) ;
    dans la suite : date, dernier échange, puis un bloc de souvenirs JUSTE AVANT la question
    (« Informations vraies sur {personne}, à utiliser telles quelles, sans rien ajouter »),
    ou, si aucun souvenir ne correspond, la consigne de dire qu'elle ne sait pas.
    Au plus 3 souvenirs, choisis par mots communs avec la question. Réponse ≤ 60 jetons.
  - « complet » : le contexte de la v0.7.0, gardé comme référence de comparaison.
- Échantillonnage plus strict (température 0,15, top-k 20, min-p 0,1), transmis jusqu'au code natif.
- Trace technique par réponse locale (`naissance-ia.diagnostic-local.v1`, 20 dernières, jamais exportée) :
  souvenirs sélectionnés, injectés ou écartés et pourquoi, jetons estimés par partie, jetons réels,
  cache, temps d'identité, de suite, premier mot, vitesses. Visible seulement dans la zone Diagnostic.
- Banc d'essai intégré (`app/moteur-local/banc.js`) : liste de questions modifiable, 1 à 3 répétitions,
  rapport chiffré copiable. Il n'écrit RIEN : ni journal, ni souvenirs, ni mesure « dernière réponse ».
- Aucune voie rapide, aucun index, aucun outil, aucun changement IndexedDB : même modèle LFM2-350M Q4_0.

## Moteur local (v0.7.0) — INTÉGRER → MESURER → OBSERVER
Principe : LFM2 n'est pas Naissance ; c'est un moteur cognitif local, au même titre que Gemini est un moteur externe.
- Modèle : LFM2-350M Q4_0 (≈ 218 Mo), téléchargé une fois par l'appli depuis Hugging Face, jamais dans l'APK,
  GitHub ou un colis. Vérifié (taille annoncée, en-tête GGUF, SHA-256 enregistré), chargeable, déchargeable, supprimable.
- Natif (`outils-android/moteur-local/`) : llama.cpp b6100 (version validée par le banc `banc-llm`), armeabi-v7a,
  NEON + VFPv4, sans OpenMP ni llamafile ; `naissance_llm.cpp` (JNI) + module Capacitor `MoteurLocal`
  (`MoteurLocalPlugin.java`, `Natif.java`, paquet `fr.naissance.moteurlocal`).
  Le robot n'est pas modifié : `outils-android/preparer.mjs` clone llama.cpp, copie les sources,
  ajoute `externalNativeBuild` + `abiFilters 'armeabi-v7a'` au build.gradle et enregistre le module dans MainActivity ;
  Gradle compile la bibliothèque pendant la construction de l'APK.
- Invite en deux parties : PRÉFIXE stable (identité compacte, jour, souvenirs essentiels) + SUITE.
  L'état du modèle après le préfixe est mis en cache (mémoire + fichier `prefixe-<empreinte>.etat`),
  relu au lieu d'être recalculé. Contexte 1 024, réponse ≤ 120 jetons, 4 fils.
- `app/esprit/contexte-local.js` : budget ≈ 700 jetons (préfixe ≤ 380, suite ≤ 320) :
  identité compacte (premières phrases des principes), message, dernier échange raccourci,
  au plus quelques souvenirs (importance 3 dans le préfixe, pertinents dans la suite). Jamais toute la mémoire.
- `app/esprit/aiguillage.js` : modes Local seulement / Local d'abord / Externe d'abord / Externe seulement
  (défaut : Externe seulement). « Local d'abord » prudent : programmation, actions, actualité, connaissances
  précises, textes longs, calculs, plusieurs questions, messages > 280 caractères → moteur externe (avec note).
  Échec local → moteur externe (note) sauf en « Local seulement » ; annulation → aucun repli.
  « Externe d'abord » : repli local si les moteurs externes sont indisponibles.
- Lecture seule : aucune action, aucun rangement par le moteur local (rangement désactivé en « Local seulement »).
- « Demander à un modèle plus fort » sous chaque réponse locale : même question, moteur externe, sans montrer
  la réponse locale ; la nouvelle question porte `reprise` dans le journal (champ facultatif, pas de migration).
- Mesures locales (localStorage `naissance-ia.mesures-local.v1`, 30 dernières) : cache, jetons lus, premier mot,
  lecture et écriture en jetons/s ; moteur réel inscrit au journal.
- Sécurité : mémoire libre < 280 Mo → pas de chargement ; un arrêt brutal pendant une opération locale suspend
  le moteur local au redémarrage (Réglages → Réactiver). Retour à la v0.6.1 : mode « Externe seulement » ou suppression du modèle.
- Aucun changement de schéma (IndexedDB v2, export schéma 2).

## Économie et confort (v0.6.1)
Orientation retenue pour la suite : local d'abord → modèle propre/local quand possible → modèle externe
quand la tâche le dépasse. Rien de ce qui suit ne rend Gemini plus indispensable : compteur, pauses,
progression et annulation sont génériques ; seul l'adaptateur sait lire les erreurs de quota de Google.
- Quotas : `traduireErreurGoogle` lit `QuotaFailure` (quotaId …PerDay… / …PerMinute…) et `RetryInfo`
  → `e.quota = { periode, reessayerDansMs }`.
- Santé (`sante.js`) : chaque échec porte `jusqua`. Quota du jour → pause jusqu'à la remise à zéro
  (minuit, heure du Pacifique ≈ 9 h en France) ; par minute → délai indiqué par Google.
  Pauses longues (quota du jour, modèle disparu) : aucun appel avant la reprise, même si tout est en pause.
  Pauses courtes (saturation, lenteur) : un seul essai de secours si rien d'autre n'est disponible.
- Attentes : conversation 40 s, génération 60 s, sonde 15 s par appel ; budget de 75 s par demande
  avant de renoncer à essayer un autre modèle.
- Progression : `surEtape` (essai, relance, repli, action) → phrase dans la bulle d'attente (`libelleEtape`).
- Annuler : `AbortController` transmis jusqu'à la requête ; une annulation n'est jamais une panne du modèle ;
  rien n'est écrit au journal ; les actions déjà faites sont signalées.
- Compteur local `naissance-ia.appels.v1` (`compteur.js`) : appels de génération par journée de quota,
  par type (conversation, rangement, vérification) et par modèle, via un fetch enveloppé. Affiché dans Réglages.
- Rangements automatiques : seuils 24 messages non analysés / 50 après le fil / 10 au retour d'une absence ;
  au plus un toutes les 3 h ; aucun au-delà de 12 appels externes dans la journée ; un seul appel résume
  et analyse tout ce qui est prêt. « Ranger maintenant » passe outre ces limites.
- Style : après une action, réponse directe à la personne (tutoiement), sans réciter la formulation interne
  (consigne dans le contexte et dans le résultat de l'action).

## Voix (v0.5.0)
- `app/voix/voix.js` : même interface pour l'APK et la PWA : `ecouteDisponible`, `ecouter` → texte,
  `arreterEcoute`, `lectureDisponible`, `lire(texte)`, `arreterLecture`.
  - APK : `@capacitor-community/speech-recognition` (SpeechRecognizer d'Android, sans fenêtre ;
    fenêtre de dictée Google en dernier recours) et `@capacitor-community/text-to-speech` (synthèse Android),
    appelés par `Capacitor.nativePromise` (`app/natif.js`).
  - PWA : Web Speech API du navigateur.
- Permission du micro demandée seulement à l'appui sur le micro. Aucune écoute permanente, aucun mot de réveil.
- La dictée remplit le champ ; rien n'est envoyé sans la personne. Aucun son n'est gardé ; le journal ne contient que le texte.
- `app/voix/outils-voix.js` (pur) : texte à prononcer (sans mise en forme, liens, code, émojis), découpage ≤ 3 000 car.,
  erreurs traduites (permission, rien, reseau, micro, service, annule).
- Préférence `naissance-ia.voix.v1` { lectureAuto } (technique, jamais exportée), réglable dans Réglages → Voix.
- `outils-android/preparer.mjs` (appelé par le robot) : ajoute RECORD_AUDIO et les `<queries>`
  RecognitionService / TTS_SERVICE au manifeste (sans doublon).
- Dictée : service vocal du téléphone (souvent Google, réseau nécessaire sauf français hors connexion).
  Lecture : moteur de synthèse d'Android, en général hors connexion.

## Actions (v0.6.0)
Principe : le moteur DEMANDE, Naissance CONTRÔLE, la personne AUTORISE si nécessaire, le programme EXÉCUTE.
Le moteur n'a jamais accès à la mémoire ni aux API Android.
- `app/actions/catalogue.js` : actions déclarées (nom, description, schéma des paramètres, niveau, valider, executer,
  resumer, noter). Niveaux : `libre` (interne, réversible, exécutée directement), `accord` (confirmation de la
  personne avant CHAQUE exécution), `bloquee` (jamais exécutée, jamais proposée).
  v0.6 : une seule action réelle, `retenir` (libre). Ajouter une action = une entrée de plus dans le catalogue.
- `app/actions/schema.js` : contrôle générique (champs inconnus refusés, obligatoires, types, énumérations).
- `app/actions/retenir.js` : { information, categorie, importance, confiance } → souvenir source `demande`
  (« retenu à la demande de … », confiance par défaut certain). Anti-doublon : égalité, inclusion, mots-clés
  (≥ 75 %), nombres identiques exigés → « déjà connu » + confirmation, sans doublon.
- `app/actions/executeur.js` : une session par message. Refus journalisés (inconnue, bloquée, invalide, limite,
  sans accord). Limites : 3 actions exécutées, 8 demandes par message ; 3 tours moteur ↔ actions par essai
  (dernier tour forcé en texte). Une action déjà exécutée n'est JAMAIS rejouée (même empreinte → résultat précédent),
  y compris après un changement de moteur ; le nouveau moteur reçoit la liste des actions déjà faites.
- Gemini (`converser`, API generateContent) : `tools.functionDeclarations` (types en majuscules),
  `functionCallingConfig` AUTO puis NONE au dernier tour ; parts du modèle renvoyées telles quelles
  (signatures de réflexion), puis `functionResponse` { name, id, response }.
- Journal : table IndexedDB `actions` { id, date, messageId, nom, parametres, niveau, statut
  (executee | deja-faite | refusee | invalide | echec), resultat, moteur }, liée à la question une fois l'échange écrit.
- Notes discrètes sous la réponse ; si la réponse échoue après une action, l'erreur le signale.
- Écran Mémoire : « Actions récentes ».
- La consolidation automatique est inchangée ; les souvenirs `demande` sont protégés comme les manuels.

## Amendements d'identité
- `AMENDEMENTS` (esprit/identite.js) : modifications du noyau validées par la personne, appliquées une seule fois
  aux identités existantes (`identite.amendements`), avec trace dans `changements` (par : personne).
- 2026-09-16 : capacités (la voix) et principe « ne jamais promettre de retenir une information ».
- 2026-09-16 (v0.6) : « ne dis que tu as retenu une information que si ton action retenir a réellement réussi ».
- 2026-09-16 (v0.6.1) : capacités — elle peut agir sur sa propre mémoire grâce aux actions proposées
  par le programme ; pas d'autres outils.
  Les capacités d'action sont décrites au moteur dans le contexte (technique), pas dans le noyau.

## Export / import
- Fichier `naissance-<id8>-AAAA-MM-JJ.json` : { format "naissance", schema 2, exporteLe, versionAppli, idNaissance,
  empreinte SHA-256 de JSON(donnees), donnees { cles, journal, souvenirs, resumes, actions } }.
  Les fichiers en schéma 1 (v0.4–v0.5) restent importables (actions vides). IndexedDB version 2 (table actions ajoutée).
- APK : `@capacitor/filesystem` (cache) puis `@capacitor/share` (menu Partager), appelés par `app/natif.js`
  via `Capacitor.nativePromise`. PWA : téléchargement.
- Import : vérification complète avant toute écriture, avertissements (autre Naissance, fichier plus ancien),
  remplacement atomique, copie de secours de l'état précédent (« Revenir à la mémoire d'avant le dernier import »).
- Rappel d'export après 7 jours. `navigator.storage.persist()` demandé.
- Maison principale : l'APK. La PWA sert aux tests.
