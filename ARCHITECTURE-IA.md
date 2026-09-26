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

## B1 + A1 + A2 -- conservation d'experience, branchee sur le vrai pont (BUILD DE TEST 0.17.8, NON VALIDE)
BUILD DE TEST uniquement -- pas encore une version stable. En attente de validation reelle sur le
telephone de Christophe (voir procedure de validation transmise separement).

- B1 (`app/langage/connaissances.js`) : nouvelle table `experiences` (VERSION_BASE 3 -> 4, migration
  additive seule -- aucune table existante touchee). Deux fonctions : `enregistrerExperience(magasin,
  {texteRecu, texteRepondu, date, source, referenceMemoire})` ecrit un FACTUEL immuable ;
  `ajouterInterpretation(magasin, idExperience, {origine, donnees})` ajoute, sans jamais l'ecraser, une
  interpretation a une experience existante (`donnees` libre, sans schema fixe). `referenceMemoire`
  garde EXPLICITEMENT `{idQuestion, idReponse}` -- jamais reconstruit par `idQuestion+1`.
- A1 (`app/langage/pont.js`, nouveau) : extraction structurelle de la decision « le laboratoire
  repond-il a ce tour ? », auparavant en ligne dans main.js (non testable : aucun export, couplage
  direct a document/window). `tenterPontLangage(texte, deps)` est exportee, a dependances injectees ;
  caracterisation prouvant un comportement identique au code d'origine.
- A2 (meme fichier) : quand le pont repond avec certitude (COMPRIS), l'echange est aussi conserve
  comme experience B1, avec une interpretation `origine: 'comprendre'` reprenant TEL QUEL
  `local.comprehension` (jamais recalcule par un second appel a `repondre()` -- garde-fou statique
  comptant les appels reels dans pont.js, car un moteur deterministe rend cette mutation invisible par
  simple comparaison de valeur).
- `app/main.js` : n'importe plus `repondre`/`COMPRIS` directement depuis `esprit.js` ; appelle
  `tenterPontLangage()` avec les dependances reelles (`assurerEsprit`, `journaliser` =
  `journaliserEchangeLaboratoire` -- desormais RETOURNE `[idQuestion, idReponse]` au lieu de les
  jeter --, `enregistrerExperience`, `ajouterInterpretation`).
- Diagnostic provisoire (« Voir les expériences ») : `app/index.html` (bloc `<details
  data-langage-experiences>`, meme famille que les blocs existants) + `app/langage/ecran.js`
  (cablage : un bouton, deux affichages). LECTURE SEULE stricte -- appelle uniquement
  `magasin.lireTout('experiences')`, deja utilise ailleurs pour lire ; aucune ecriture possible,
  aucun apprentissage, aucun changement du comportement conversationnel. Pourra disparaitre des qu'un
  vrai ecran existera.
- Tests : `tests/experiences.test.mjs`, `tests/pont-langage.test.mjs`, `tests/pont-experience.test.mjs`,
  `tests/experiences-ecran.test.mjs`. Mutations verifiees a la main (ids de reference intervertis,
  origine remplacee par un numero de version, second appel a repondre(), suppression de
  l'enregistrement) : toutes detectees. Suite complete : 521/521.

## Banc d'essai du pont induction (v0.17.7) -- outil provisoire dans le laboratoire
Decide avec Christophe (25/09) pour rendre le pont v0.17.6 testable sur telephone, sans grosse
interface. Diagnostic separe du codage (feu vert distinct apres le seul diagnostic, methode OBSERVER
-> ISOLER -> COMPRENDRE -> CORRIGER).
- app/index.html : un bloc `<details data-langage-induction>` de plus dans le laboratoire (sur le
  gabarit exact du bloc « Donner un cours », v0.17) -- positifs/negatifs (une phrase par ligne),
  signification (texte libre), Lancer/Confirmer/Annuler, rapport ; plus un mini « Tester une phrase »
  (texte + bouton + `type` affiche).
- app/langage/ecran.js : deux imports de plus (`induire` depuis induction.js, `apprendreGabaritType`
  depuis esprit.js), et le cablage seul -- AUCUNE logique d'induction ni de comprehension recopiee,
  seulement des appels aux fonctions existantes et du formatage d'affichage (formaterRapportInduction
  est un simple mise en texte du rapport deja calcule par induire(), pas une reimplementation).
- REGLE IMPORTANTE, DECIDEE PAR CHRISTOPHE : plusieurs hypotheses SURES et DISJOINTES ne sont PAS un
  conflit -- Confirmer les apprend TOUTES sous la meme signification, sans aucun selecteur d'hypothese
  dans l'interface (s'appuie sur une garantie deja presente dans induire() : les hypotheses retenues
  ne se chevauchent jamais entre elles ; un vrai chevauchement va dans les conflits, jamais dans les
  hypotheses). Confirmer reste INACTIF des qu'un conflit existe QUELQUE PART dans le rapport, meme si
  une hypothese sure existe AUSSI dans ce meme rapport -- verifie explicitement par un test combinant
  les deux dans un seul corpus (le premier corpus, trop simple, ne l'exercait pas reellement).
- GARDE-FOUS RESPECTES : aucune logique metier recopiee ; le moteur v0.17.5/6 (induction.js, esprit.js,
  comprendre.js, connaissances.js) INCHANGE, verifie par diff contre le vrai depot reconstruit ; aucun
  branchement a la conversation (main.js, conversation/ecran.js inchanges) ; aucune modification de
  Cours ni du canal pedagogique (cours.js, lecon.js inchanges).
- METHODE SUIVIE : 10 tests ecrits AVANT codage (patron exact de tests/cours-ecran.test.mjs : faux DOM
  minimal, vrai magasin, vrai moteur, aucun navigateur), rouge confirme sur l'etat reel v0.17.6 (8/9
  echecs pour de bonnes raisons). Apres codage : 10/10 verts, suite complete 486 tests. 4 mutations
  ciblees sur le cablage (Confirmer actif malgre un conflit, une seule hypothese apprise au lieu de
  toutes, Annuler qui ecrirait quand meme, le mini-test qui n'appellerait plus le vrai repondre())
  toutes detectees.
- PREUVE CONSERVEE COMME TESTS PERMANENTS (tests/induction-ecran.test.mjs) : scenario A (plusieurs
  hypotheses disjointes, inversion-tu + inversion-il/elle/on, confirmees ensemble sous la meme
  signification) ; scenario B (une hypothese sure ET un vrai conflit dans le meme rapport, Confirmer
  reste inactif) ; Annuler n'ecrit rien ; Confirmer persiste ; phrase temoin jamais dans le corpus :
  affirmation avant, SALUTATION apres confirmation, SALUTATION apres un rechargement complet simule.
- OUTIL VOLONTAIREMENT PROVISOIRE : ne devient jamais un passage oblige, pourra etre retire sans
  toucher au moteur v0.17.5/6, en attendant un eventuel apprentissage naturel dans la conversation.
- VALIDATION TELEPHONE : a la livraison, NON encore validee.

## Premier pont induction -> comprehension (v0.17.6) -- gabarit(s) -> signification, general
Decide avec Christophe (25/09) apres un diagnostic architectural complet du chemin reel d'une phrase
(decouverte : `type` ne disparaissait jamais apres comprendre(), il survivait jusqu'a
`r.comprehension.type` a chaque appel de repondre() -- simplement jamais lu). Correction architecturale
IMPOSEE avant codage : la connaissance persistante devait etre GENERALE (gabarit(s) -> signification
libre), jamais nommee ou limitee a VERIFICATION -- pour ne jamais inscrire une categorie cablee dans
l'architecture persistante.
- app/langage/connaissances.js : nouvelle 6e table `gabaritsTypes` (meme patron que les 5 existantes :
  faits/lexique/patrons/proprietes/regles), VERSION_BASE 2->3 (mise a niveau additive, ne cree QUE la
  table manquante, comme au passage a la v2).
- app/langage/comprendre.js : comprendre()/trouverType() acceptent un 3e parametre optionnel
  `gabaritsTypesAppris` (defaut `[]`, donc AUCUNE regression possible), une collection `{gabarits,
  signification}` essayee APRES le bagage fige (INTERROGATIF puis GABARITS_VERIFICATION_DEPART,
  tous deux INCHANGES) -- jamais avant, jamais a la place. Le filtre par statut ('validee' seulement)
  vit ici, meme principe que appliquerRegles() (regles.js) pour les regles.
- app/langage/esprit.js : chargerEsprit() charge et fusionne cette nouvelle table (meme patron que le
  lexique) ; repondre() transmet la liste fusionnee a comprendre(). Nouvelle fonction
  apprendreGabaritType(), calquee EXACTEMENT sur apprendreRegle() (dedup par signature de candidats,
  remplacement en place, statut valide/remplacee, historique via `precedent`) -- reutilise ENFIN pour
  de vrai les champs `exemples`/`testsReussis`/`testsEchoues`, presents mais morts depuis leur creation
  dans le modele des regles.
- app/langage/induction.js : INCHANGE, aucune ligne touchee. La signification est attachee par
  l'appelant au moment de la confirmation (apprendreGabaritType), jamais par induire() lui-meme.
- POINT D'ENTREE : AUCUN nouveau fichier, AUCUN ecran. Le pont est l'usage conjoint de deux fonctions
  deja a la bonne taille : induire() (rapport, jamais d'ecriture) puis apprendreGabaritType()
  (confirmation explicite, seule a ecrire) -- le plus petit point d'entree possible.
- PREUVE DECISIVE, CONSERVEE COMME TEST PERMANENT (tests/pont-induction.test.mjs) : un gabarit
  REELLEMENT absent du bagage initial (le mot « salut », jamais QUESTION_INFORMATION deja cable) comme
  marqueur d'une signification illustrative arbitraire « SALUTATION ». Chaine complete prouvee : avant
  apprentissage, une phrase temoin jamais vue reste AFFIRMATION ; induire() decouvre le gabarit a partir
  de positifs/negatifs explicites (aucune memoire d'experiences) ; avant confirmation ET en cas
  d'annulation, aucune ecriture, comportement strictement inchange ; apres confirmation, la meme phrase
  temoin est classee SALUTATION ; apres un RECHARGEMENT COMPLET (nouvel objet esprit, meme magasin,
  simulant un vrai redemarrage), la connaissance survit ; reapprendre le meme gabarit avec une AUTRE
  signification remplace l'ancienne, jamais les deux actives a la fois.
- GARDE-FOUS RESPECTES : aucun apprentissage automatique, aucun declenchement autonome, aucune memoire
  d'experiences, Cours et lecon.js INCHANGES (aucune nouvelle syntaxe du canal pedagogique), aucune
  nouvelle categorie de `type` cablee, aucun apprentissage de nouveaux roles, negation non touchee.
- METHODE SUIVIE : 13 tests ecrits AVANT codage, rouge confirme par erreur d'import sur l'etat reel
  v0.17.5 (dependot GitHub effectivement telecharge, pas une reconstruction locale -- voir l'incident du
  17.4/17.5 jamais livres, resolu juste avant ce chantier). Apres codage : 13/13 verts, suite complete
  476 tests. 5 mutations ciblees (non-chargement, non-passage a comprendre(), perte de la signification,
  utilisation d'un gabarit remplace, ecriture sans confirmation complete) toutes detectees.
- INCHANGES, verifies : main.js, cours.js, ecran.js, canon.js, bagage.js, lecon.js, interpretation.js,
  induction.js.
- VALIDATION TELEPHONE : a la livraison, NON encore validee.
- HORS CHANTIER, VOLONTAIREMENT NON TOUCHE : tout ecran reel pour ce pont, toute detection de conflit
  semantique entre deux confirmations, tout le reste des limites deja listees en v0.17.5.

## Gabarits + VERIFICATION (v0.17.4) — moteur generique, formes francaises en donnees
Decide avec Christophe (25/09) apres verification architecturale explicite (prototype execute, hors depot,
avant feu vert) : separer un MOTEUR GENERIQUE de correspondance de sous-sequences (aucun mot ni regle
francaise en dur) des DONNEES qui l'utilisent pour representer deux familles francaises de VERIFICATION.
- MOTEUR (langage/comprendre.js) : une CONTRAINTE est { mot } (mot exact) ou { role } (n'importe quel mot de
  ce role) ; un GABARIT est une suite ORDONNEE de contraintes ; contientGabarit() cherche un gabarit comme
  SOUS-SEQUENCE CONTIGUE de `mots` (fenetre glissante). Zero mot francais dans ce code (garanti par un test
  statique). trouverType() : QUESTION_INFORMATION PRIORITAIRE (comme v0.17.3, inchange, teste en premier) ;
  sinon VERIFICATION si le groupe pertinent correspond a un gabarit de bagage.js ; sinon AFFIRMATION.
- DONNEES (bagage.js) : deux nouveaux roles, JAMAIS lus par trouverSujet/trouverRelation — VERBE_CONJUGUE
  (est, es, sont, peut, veux) et PRONOM_3E (il, elle, on, ils, elles ; ne designent NI moi NI naissance).
  « est » est passee du role IGNORE (aucun effet avant ce chantier) a VERBE_CONJUGUE — verifie sans effet de
  bord (aucun test ni mecanisme ne lisait ROLES.IGNORE pour « est » specifiquement). GABARITS_VERIFICATION_DEPART :
  [est,ce,que] (« est-ce que ») ; [VERBE_CONJUGUE, PRONOM_3E] et [VERBE_CONJUGUE, PRONOM_TOI] (inversion :
  couvre est-il/elle, es-tu, sont-ils, peut-elle, veux-tu... et toute forme future ajoutee comme simple donnee).
- PREUVE QUE C'EST BIEN UN SEUL MECANISME, PAS DEUX RUSTINES : « es-tu », « sont-ils », « peut-elle », « veux-tu »
  ajoutes SANS toucher une ligne du moteur, uniquement par des entrees de lexique — verifie par un test dedie
  et par le controle de mutation (retirer le gabarit d'inversion, ou le role VERBE_CONJUGUE de ces mots, casse
  les tests correspondants, jamais le moteur lui-meme).
- LIMITE CONNUE, VOLONTAIREMENT NON TRAITEE : le « -t- » euphonique (a-t-il, va-t-il, parle-t-il) — decouper()
  separe ce « t » en un troisieme jeton isole, ce qui casse l'adjacence stricte qu'un gabarit exige. Ce n'est
  PAS une limite du moteur de gabarits (qui reste general) : c'est un probleme de decoupage en amont, non
  corrige ici (decouper() explicitement non modifie, comme demande).
- `type` reste un CHAMP MORT : repondre() (esprit.js) ne le lit toujours pas (verifie par test statique).
  AUCUN changement de comportement de reponse dans cette version.
- HORS CHANTIER, VOLONTAIREMENT NON TOUCHE : negation/polarite, valeur proposee, comparaison avec le fait
  connu, reponses oui/non, demandes indirectes, routage main.js, LFM2, le « -t- » euphonique.
- METHODE SUIVIE : 6 tests ROUGE (les 6 formes visees) + verrous v0.17.2/v0.17.3 + pieges (mot isole
  insuffisant, adjacence stricte requise) EXECUTES REELLEMENT sur l'etat 0.17.3 AVANT codage : echec confirme
  par erreur d'import (VERIFICATION n'existait pas). Puis codage ; 19/19 tests du chantier verts, 31/31 verrous
  des deux chantiers precedents inchanges ; suite complete 449 tests. 6 mutations de controle (3 sur le
  moteur : fenetre non contigue, contrainte {role} neutralisee, priorite inversee ; 3 sur les donnees : gabarit
  d'inversion retire, roles VERBE_CONJUGUE retires des nouvelles formes, PRONOM_3E fusionne a tort dans
  trouverSujet) toutes detectees.
- INCHANGES : esprit.js, cours.js, ecran.js, main.js, canon.js, connaissances.js, decouper() (non modifie,
  comme demande explicitement).
- VALIDATION TELEPHONE : voir le rapport de continuite — a la livraison, NON encore validee. Rappel : `type`
  n'est lu par rien, donc rien n'est observable dans l'application pour ce chantier (meme situation qu'en v0.17.3).

## Moteur d'induction (v0.17.5) — analyse uniquement, premiere integration
Decide avec Christophe (25/09) apres trois audits architecturaux et plusieurs prototypes jetables (hors
depot, tous supprimes) explicitement construits pour REFUTER l'idee plutot que la confirmer. Deux echecs
reels rencontres en cours de route ont change la conception finale : un bug de recherche (s'arreter au
premier n donnant n'importe quel candidat, meme faible, au lieu du meilleur sur tous les n) ; et un
departage alphabetique qui donnait l'illusion d'un determinisme propre alors qu'il masquait un choix
arbitraire. La decouverte decisive : deux hypotheses a egalite de couverture ne sont un VRAI conflit que
si leurs ensembles couverts se CHEVAUCHENT reellement — une simple coincidence numerique entre deux
sous-familles DISJOINTES n'en est pas un.
- app/langage/induction.js (NOUVEAU) : fonction PURE et ISOLEE, induire(positifs, negatifs, options) →
  { hypotheses, conflits, inexpliques }. Candidats n-grammes MIXTES mot-exact/role-connu (ROLES.IGNORE
  exclu des candidats-role) ; recherche GLOBALE sur tous les positifs restants (jamais une seule graine) ;
  meilleur par couverture puis longueur, AUCUN autre critere ; a egalite, regroupement par ENSEMBLE COUVERT
  exact — des groupes DISJOINTS coexistent tous comme hypotheses separees, un CHEVAUCHEMENT reel est un
  conflit explicite qui arrete la decouverte, rien n'est tranche automatiquement ; des candidats au meme
  ensemble couvert restent un GROUPE de synonymes, jamais departages arbitrairement ; seuil de couverture
  minimale (jamais une regle sur un seul exemple) ; positifs sans candidat viable = inexpliques.
  passeFinale(positifsOriginaux, hypotheses) : reteste independamment tous les positifs contre toutes les
  hypotheses retenues, revele un exemple qui en satisferait plusieurs a la fois (etat 'ambigu'), jamais
  assigne en silence pendant la decouverte gloutonne.
- GARDE-FOU ABSOLU, verifie par tests statiques : induction.js n'importe ni n'appelle esprit.js,
  connaissances.js, ecran.js ni cours.js ; comprendre.js et esprit.js ne referencent jamais induction.js.
  Cette version NE modifie PAS les connaissances automatiquement, N'alimente PAS comprendre()/repondre(),
  N'ajoute AUCUNE nouvelle forme au canal pedagogique, NE reclame PAS automatiquement de nouveaux exemples,
  NE tranche AUCUN conflit. Un moteur d'analyse, un rapport observable — meme excellent, rien n'est appris
  automatiquement dans cette version.
- METHODE SUIVIE : 12 tests ecrits AVANT codage, transformant les PROPRIETES demontrees par les prototypes
  (pas leurs details precis) en tests permanents ; executes REELLEMENT sur l'etat 0.17.4 (rouge confirme par
  erreur d'import). Apres codage : 14/14 verts, suite complete 463 tests. Deux incidents corriges en cours
  de route et documentes : un test de passe finale mal construit (corpus creant un vrai chevauchement des la
  decouverte, correctement rejete par le moteur — corrige en separant decouverte propre et passe finale sur
  un exemple externe) ; une cle interne sans rapport avec les faits entree en collision avec un test statique
  d'un chantier anterieur (v0.17.1, cleFait) — corrige dans le seul fichier induction.js. 5 mutations ciblees
  (retrait du controle de chevauchement, departage arbitraire reintroduit, retrait du seuil minimal, retrait
  de la passe finale, logique disjoint/chevauchant inversee) toutes detectees.
- INCHANGES, verifies octet pour octet : main.js, comprendre.js, esprit.js, cours.js, ecran.js, bagage.js.
- VALIDATION TELEPHONE : sans objet pour cette version — rien n'est encore observable dans l'application,
  induction.js n'est appele par rien (aucun branchement, comme demande).
- HORS CHANTIER, VOLONTAIREMENT NON TOUCHE : tout usage reel du rapport d'induction, toute nouvelle forme
  du canal pedagogique, toute integration a Cours ou a comprendre()/repondre().

## Type d'enonce (v0.17.3) — QUESTION_INFORMATION / AFFIRMATION
Decide avec Christophe (25/09), chantier resserre en deux temps : d'abord seulement le TYPE (negation/polarite
explicitement reportee, sur observation d'un piege : « Mon manteau, pas de doute, est bleu. » montrerait qu'un
simple mot NEGATION ne suffit pas a determiner la polarite reelle — son propre diagnostic de portee viendra
plus tard, separement).
- MECANISME MINIMAL : comprendre() expose un nouveau champ `type` (QUESTION_INFORMATION | AFFIRMATION),
  calcule sur le MEME groupe pertinent que sujet/relation (v0.17.2) : QUESTION_INFORMATION si ce groupe
  contient un mot de role INTERROGATIF (le meme role deja utilise pour le groupage), sinon AFFIRMATION.
  Aucune nouvelle entree de lexique. `type` est un CHAMP MORT dans cette version : repondre() (esprit.js) ne
  le lit pas (verifie par un test statique) ; AUCUN changement de comportement de reponse.
- app/langage/comprendre.js SEUL fichier modifie : deux constantes exportees (QUESTION_INFORMATION,
  AFFIRMATION), une fonction trouverType(), une ligne dans comprendre().
- HORS CHANTIER, VOLONTAIREMENT NON TOUCHE : negation/polarite ; VERIFICATION (« est-ce que », inversion —
  ces phrases ne contiennent aujourd'hui AUCUN mot interrogatif, restent donc classees AFFIRMATION, faux mais
  honnetement faux, aucune fausse certitude) ; valeur proposee ; demandes indirectes ; routage main.js ; repondre().
- METHODE SUIVIE : 4 tests ROUGE + 2 pieges ecrits et EXECUTES REELLEMENT sur l'etat 0.17.2 (pas seulement
  simules) : echec confirme par erreur d'import (QUESTION_INFORMATION/AFFIRMATION n'existaient pas), preuve que
  ce n'etait pas deja present. Puis codage ; 9/9 nouveaux tests verts, 22/22 tests de segmentation inchanges ;
  suite complete 430 tests. 4 mutations de controle : 2 detectees (mecanisme neutralise, ponctuation substituee
  au role interrogatif), 2 non detectees mais EXPLIQUEES comme non significatives (valeurs des deux constantes
  interverties ensemble = simple renommage ; calcul sur le groupe pertinent vs sur toute la phrase : pour ce
  champ BINAIRE precis, mathematiquement equivalents par construction du groupage v0.17.2 — le groupe pertinent
  est TOUJOURS le dernier groupe contenant un interrogatif s'il en existe un dans la phrase).
- INCHANGES : tous les autres fichiers (esprit.js, cours.js, ecran.js, main.js, canon.js, connaissances.js,
  bagage.js…).
- VALIDATION TELEPHONE : voir le rapport de continuite — a la livraison, NON encore validee.

## Segmentation + portee (v0.17.2) — une premiere capacite generale de comprehension
Decide avec Christophe (25/09) apres trois campagnes de diagnostic (systeme de Cours + conversation reelle) :
comprendre() traitait toute la phrase comme un sac de mots (premier sujet trouve, premiere relation trouvee,
sur TOUTE la phrase, sans structure). Symptome type : « Tu sais quel est mon manteau ? » -> « tu » rencontre
avant « mon » -> sujet=naissance (faux).
- DECOUVERTE PREALABLE [PROUVEE] : decouper() (comprendre.js) JETTE toute la ponctuation (le point de
  « La lampe est blanche. Quel est mon manteau ? » disparait des jetons). Une segmentation fondee sur la
  ponctuation est donc impossible sans toucher decouper(), et de toute facon peu fiable en dictee vocale.
- MECANISME RETENU, volontairement minimal : chaque mot de role INTERROGATIF (quel, quelle, combien, qui, ou,
  comment) demarre un nouveau groupe ; le DERNIER groupe qui en contient un est retenu (la question reellement
  posee) ; sujet et relation sont cherches UNIQUEMENT dans ce groupe (trouverSujet/trouverRelation reutilisees
  telles quelles, non modifiees). Sans aucun interrogatif dans la phrase : un seul groupe = la phrase entiere,
  comportement STRICTEMENT identique a avant ce chantier. N'a besoin d'aucune ponctuation.
- app/langage/comprendre.js SEUL fichier modifie : deux fonctions ajoutees (grouperParInterrogatif,
  groupePertinent) ; comprendre() calcule le groupe pertinent puis appelle trouverSujet/trouverRelation dessus
  au lieu de toute la phrase. motsInconnus reste calcule sur TOUTE la phrase (inchange).
- ERREUR DE CADRAGE CORRIGEE AVANT CODAGE (decouverte par Christophe, verifiee par Claude en simulant le
  mecanisme avant de coder) : « Tu peux me rappeler mon téléphone » avait ete classee a tort comme corrigee par
  ce mecanisme. Elle ne contient AUCUN mot interrogatif : le mecanisme ne peut rien pour elle. RETIREE du
  perimetre, gardee comme echec connu pour un chantier futur (demande indirecte sans interrogatif, meme famille
  que le futur chantier « type d'enonce »).
- HORS CHANTIER, VOLONTAIREMENT NON TOUCHE : negation, affirmation/verification, valeurs proposees, fautes
  d'orthographe, singulier/pluriel, sujets generiques (rester limite a moi/naissance/prenoms), routage main.js
  sans « ? », LFM2, segmentation par ponctuation.
- METHODE SUIVIE : 5 tests ROUGE + 1 piege ecrits et verifies rouges sur l'etat 0.17.1 AVANT tout codage (6/22
  rouges, 16/22 deja verts) ; puis codage ; puis 22/22 verts ; suite complete 421 tests ; 4 mutations de
  controle (mecanisme retire, premier groupe au lieu du dernier, mauvais point de coupe, motsInconnus restreint
  au groupe) toutes detectees.
- INCHANGES : tous les autres fichiers (esprit.js, cours.js, ecran.js, main.js, canon.js, connaissances.js…).
- VALIDATION TELEPHONE : voir le rapport de continuite — a la livraison, NON encore validee.

## Coherence des identifiants (v0.17.1) — le bug du « telephone »
Constate en usage reel (21/09) : le premier vrai cours de vocabulaire echouait sur « telephone » (accent) alors
que 4 autres mots (sans accent) reussissaient. Diagnostic complet fait AVANT tout codage (voir le rapport de
diagnostic) : les FAITS gardaient la graphie tapee (accents, majuscules) pour leur IDENTITE de recherche, alors
que le lexique, les proprietes, les regles et les facons de dire directes etaient deja canoniques (sans accent,
minuscules) via decouper(). « Fait : moi / telephone / un TCL. » restait donc introuvable par
« Quel est mon telephone ? », dont la relation comprise est « telephone ». Meme bug pour les sujets en majuscule
(« Fait : Moi / ... ») et les prenoms accentues ou capitalises (Marie, Aurelie).
- PRINCIPE : une seule fonction d'IDENTITE (canoniser, dans le nouveau app/langage/canon.js, pur, sans import),
  utilisee par cleFait (connaissances.js) pour RANGER et RETROUVER un fait, un sujet, un prenom. Elle reprend
  exactement ce que decouper()[0] calcule deja pour un mot simple, mais SANS jamais decouper ni tronquer :
  « cœur » reste « cœur » (pas « c »), « Jean-Pierre » devient « jean-pierre » (pas deux mots separes),
  « porte-monnaie » n'est pas reduit a « porte ». Une future reconnaissance d'expressions a plusieurs mots reste
  donc possible. canoniser() NE modifie JAMAIS une VALEUR : seule l'identite (sujet, relation) est canonique ;
  les champs des lignes de faits restent la graphie EXACTEMENT tapee (affichage encore sans accent : lot B,
  separe, non fait ici — voir Hors chantier).
- app/langage/connaissances.js : cleFait(sujet, relation) = canoniser(sujet)+'|'+canoniser(relation). POINT
  UNIQUE de fabrication de cette identite dans tout app/ (garde par un test statique).
- app/langage/esprit.js — CHARGEMENT (chargerEsprit), SANS AUCUNE MIGRATION : les lignes de faits APPRISES sont
  regroupees par IDENTITE (jamais par leur clef stockee telle quelle) ; le bagage de depart garde la priorite la
  plus basse (un fait appris de meme identite le remplace toujours, comme avant, sans jamais creer de conflit
  avec le depart) ; pour chaque identite persistee : une seule valeur → servie ; plusieurs valeurs STRICTEMENT
  differentes (rognage seulement, jamais normalisees pour decider) → CONFLIT. prenomsConnus reconstruit depuis
  TOUTES les lignes (y compris en conflit) sous forme canonique. diagnosticFaits { lignes, conflits,
  ancienneGraphie } pour l'affichage du laboratoire (nombre de LIGNES, pas d'identites).
- ECRITURE (apprendreFait) : sujet/relation/valeur restent EXACTEMENT ce qui est tape. Une ligne EXISTANTE pour
  cette identite est REMPLACEE EN PLACE (meme clef stockee, aucun doublon cree) ; sinon une NOUVELLE ligne est
  creee avec l'identite canonique comme clef. Ecriture sur une identite deja EN CONFLIT : REFUSEE (base
  inchangee), tant que le conflit n'est pas resolu a la main.
- RETRAIT (oublierFait) : avec { sujet, relation } comme avant, retire la ligne servie — refuse clairement si
  l'identite est en conflit (jamais de suppression arbitraire), en listant les valeurs candidates. Avec en plus
  { cle }, retire UNE ligne precise par sa clef stockee (utilise par le panneau pour chaque ligne d'un conflit).
- apprendrePatron (chemin par correction) : la relation et le sujet sont desormais ranges sous leur IDENTITE
  canonique (comme le compare candidatsPatron a la lecture) ; la recherche litterale dans la phrase de correction
  (fabriquerGabarit) fonctionne dans les deux sens car elle etait deja insensible a l'accent et a la casse.
- app/langage/ecran.js (laboratoire) : compteur de faits = nombre de LIGNES (diagnosticFaits.lignes), avec
  « N conflit(s) de faits » et « N fait(s) enregistre(s) sous une ancienne graphie » affiches seulement si N>0 ;
  « Ce qu'elle sait » et « Gerer ce qu'elle sait » listent aussi chaque conflit marque [CONFLIT], une ligne par
  valeur candidate, chacune avec son propre bouton Oublier (par clef precise).
- app/langage/cours.js : statutElement d'un fait renvoie 'conflit' (jamais 'nouveau' ni 'remplace') quand
  l'identite est deja en conflit ; Vérifier le refuse alors avec un message clair, rien n'est ecrit. Nouveau
  classement CONFLIT_FAITS (DONNEES) pour un exercice ou une sonde touchant une identite en conflit — distinct de
  FAIT_MANQUANT. Le rapport liste les valeurs candidates du conflit.
- INCHANGES : main.js, la conversation, le pont, « Retiens que », « Apprends que » (sa relation vient deja du
  lexique, donc deja canonique), lecon.js, comprendre.js, regles.js, bagage.js, gemini-professeur.js. Aucune
  nouvelle table, VERSION_BASE inchangee.
- METHODE SUIVIE (comme demande) : 30+29+9+8 tests ecrits D'ABORD (tests/canon.test.mjs, identifiants.test.mjs,
  identifiants-ecran.test.mjs, + ajouts dans cours.test.mjs), lances sur l'etat 0.17.0 non corrige : tous les cas
  marques [ROUGE ATTENDU] echouaient (19/29 dans identifiants.test.mjs), tous les [VERROU] passaient deja — cela
  confirme a la fois le bug et l'absence de regression AVANT tout codage. Puis correction, puis re-verification :
  tout au vert (397 tests avec les 320 precedents), controle par mutation (retirer le refus d'ecriture sur
  conflit, resservir une ligne au hasard, ne pas retrouver le fait au chargement, canoniser une valeur, etc.).
- HORS CHANTIER, VOLONTAIREMENT (a garder pour un futur chantier separe) : (1) LOT B — affichage accentue
  (« ton telephone » au lieu de « ton telephone » sans accent) : necessite une etiquette d'affichage distincte
  de l'identite dans le lexique, non ajoutee ici pour ne pas agrandir ce chantier, mais explicitement rendue
  possible (rien n'ecrase la graphie tapee, l'identite est toujours RECALCULEE au chargement, jamais stockee
  comme verite) ; (2) troncature du lexique par decouper(...)[0] : « cœur » → « c », « porte-monnaie » → « porte »,
  « l'ami » → « l » — inchange, connu depuis le 21/09 ; (3) aucune garde sur le vocabulaire de depart :
  « Mot : la designe la. » ecrase toujours « la » ; (4) reconnaissance d'expressions/prenoms a plusieurs mots
  dans une phrase (« Jean-Pierre » range mais pas reconnu comme sujet) ; (5) « X de Y », mot arbitraire comme
  sujet, « Est-ce que ma chaise est noire ? » ; (6) persistance des lecons du cours ; pont/routage de main.js.
- VALIDATION TELEPHONE : voir le rapport de continuite — a la livraison, NON encore validee sur le telephone.

## Le « cours » (v0.17.0) — enseigner un lot, le tester avec le VRAI moteur, diagnostiquer
Decide avec Christophe (21/09) : une LECON GROUPEE (qu'il prepare avec ChatGPT ou Claude, plus tard Gemini) est enseignee puis
testee par des exercices qui passent par repondre() — jamais Gemini, jamais LFM2, jamais une imitation du moteur — pour savoir ce
qui manque REELLEMENT : des DONNEES, une capacite du MOTEUR, une AMBIGUITE, ou un probleme plus haut, dans le pont / routage de
main.js, que ces exercices ne voient pas. Premiere experience volontairement petite (5 elements). Gemini n'est plus indispensable.
- PRINCIPE : une ORCHESTRATION au-dessus des cinq types existants, jamais un sixieme moteur d'apprentissage. L'enseignement passe
  par le MEME dispatcher que le pont et le laboratoire (ecrireConnaissance de langage/ecran.js, INJECTE dans cours.js) ; les
  exercices par repondre() de esprit.js, la meme fonction que main.js appelle.
- NOUVEAU MODULE app/langage/cours.js (pur : ni DOM, ni reseau, ni LLM ; n'importe que esprit, comprendre, regles, connaissances,
  lecon, bagage — un test statique l'exige). Fonctions : lireCours, verifierCours, donnerCours, testerCours, statutElement, classer,
  normaliserReponse, formaterRapport, formaterApercu.
- FORMAT DU BLOC (une ligne par element ; lignes vides et « # » ignorees ; puces « - » « • » « 1. » toleres ; « → » = « => ») :
  « Lecon : titre » et « Source : nom » (facultatifs) ; une des CINQ formes d'enseignement telle quelle ; « Decor : <une forme> »
  (TEMPORAIRE) ; « Exercice : question => reponse attendue » (compte dans le verdict) ; « Sonde : question » (observation seule,
  jamais comptee). Toute ligne inconnue est refusee AVEC son numero avant toute execution. Plafonds : 50 lignes d'enseignement,
  30 exercices + sondes.
- « Verifier » : AUCUNE ecriture reelle. Copie ephemere de la base (six tables copiees dans un magasin memoire), statut de chaque
  element (nouveau / deja connu (sautee) / remplace X par Y), rejeu de tout l'enseignement et du Decor sur la copie : les erreurs
  de logique sortent avant toute ecriture reelle. Une photo de controle des six tables prouve que la verification n'a rien ecrit.
- « Confirmer la lecon » (UNE confirmation) : ecriture reelle dans l'ordre du bloc ; tout element IDENTIQUE deja connu est SAUTE
  (une regle identique reecrite creerait des versions « remplacee » : constate en v0.14) ; puis exercices sur une copie RECHARGEE
  depuis le vrai magasin (= fermer / rouvrir) + Decor applique sur la copie SEULEMENT ; photo de controle avant / apres. Vraie
  atomicite IMPOSSIBLE (une transaction par ecriture, pas d'ecriture groupee) : si une ecriture echoue, arret net, rapport PARTIELLE
  exact, exercices non lances.
- « Tester seulement » : ignore l'enseignement, copie ephemere de l'etat reel + Decor + exercices, n'ecrit RIEN. Sert a retester
  apres une modification du moteur (il faut recoller le bloc : aucune lecon n'est conservee en v0.17).
- LE DECOR est strictement ephemere : jamais ecrit dans la vraie memoire ; le rapport affirme ou DENONCE (« NON — ANOMALIE ») que le
  vrai magasin est reste inchange pendant la verification, le Decor et les exercices.
- COMPARAISON des reponses : texte normalise (casse, accents, apostrophes ’ / ', espaces, ponctuation finale), rien de plus tolerant.
- VERDICT : VALIDEE si au moins un exercice et zero echec ; sinon ECHOUEE (n echecs) ; PARTIELLE ; SANS EXERCICE. Une lecon echouee
  RESTE apprise. Les sondes ne comptent jamais.
- CLASSEMENT des echecs et des sondes (heuristique, dans cet ordre, a partir des champs deja renvoyes par repondre) : relation trouvee
  mais sujet vide → SUJET_NON_REPRESENTABLE (MOTEUR : seuls « moi », « naissance » et les prenoms connus sont des sujets) ; mots
  inconnus → VOCABULAIRE (DONNEES) ; conflit de regles / de facons de dire → DONNEES contradictoires ; regle manquante → DONNEES
  (propriete genre ou regle du possessif) ; aucun fait → FAIT_MANQUANT (DONNEES) ; reponse produite avec PLUSIEURS mots-relations
  dans la question → AMBIGUITE (le moteur retient la premiere relation) ; sinon reponse differente → A EXAMINER.
- RAPPORT copiable (bouton « Copier le rapport », navigator.clipboard.writeText) : version, date, mode, verdict, elements et statuts,
  Decor (marque temporaire), et pour chaque exercice / sonde : question, attendu, produit, et les donnees BRUTES (etat, sujet,
  relation, mots inconnus, fait retrouve, facon de dire, regle utilisee, conflits, regle manquante, mots-relations de la question,
  proprietes de la relation) + classement. Ligne fixe : « NON OBSERVE par ces exercices : le pont / routage de main.js (regle du « ? »,
  marqueurs « Apprends », aiguillage vers un LLM). »
- INTERFACE : un bloc « Donner un cours (v0.17) » dans « Son langage a elle » (app/index.html) : textarea, boutons Verifier /
  Confirmer la lecon / Tester seulement / Copier le rapport. Cablage dans langage/ecran.js ; le retour de monterEcranLangage NE
  change PAS (rafraichir, assurerEsprit, ecrireConnaissance) ; parametre facultatif « copier » injectable comme dans les autres ecrans.
- INCHANGES : main.js, la conversation, le pont, « Retiens que », « Apprends que », « Apprends : », esprit.js, lecon.js,
  comprendre.js, regles.js, connaissances.js (aucune nouvelle table, VERSION_BASE inchangee), gemini-professeur.js.
- TESTS AJOUTES : tests/cours.test.mjs (21 tests, vrai dispatcher et vrai moteur, aucun « miroir ») et tests/cours-ecran.test.mjs
  (9 tests : controle statique de tous les selecteurs data-langage-… d'ecran.js dans index.html — garde contre un plantage au montage
  du laboratoire —, scenario complet avec les vrais gestionnaires). Controle par mutation (hors depot) : Decor ecrit pour de vrai,
  identique reecrit, exercice qui n'appelle pas repondre, comparaison trop tolerante, mauvais classement, element HTML manquant,
  Confirmer sans garde, import reseau, Verifier qui ecrit, integrite truquee (verification / donner / tester), sonde comptee.
- DECOUVERTES DE CADRAGE (prouvees le 21/09 avec les vrais modules) : (1) « Quel est mon stylo » sans « ? » est bien compris par le
  MOTEUR : le garde-fou du « ? » est dans le PONT (main.js), pas dans le moteur ; (2) un MOT ne peut pas etre sujet (« Quel est le
  contraire de chaud ? ») ; (3) « Quelle est la couleur de mon livre ? » repond avec la couleur de Christophe (premiere relation du
  lexique) : reponse fausse et confiante ; (4) un mot enseigne sans propriete genre donne « pas de regle pour ca » ; (5) reenseigner
  une regle identique cree des versions « remplacee ».
- LIMITES CONNUES (non traitees volontairement, on veut les OBSERVER) : le texte du cours n'est pas conserve si l'appli se recharge ; pas
  de persistance des lecons ni d'etats stockes ; pas d'atomicite reelle ; classement heuristique ; le pont / routage n'est pas observe.
- VALIDATION TELEPHONE : voir le rapport de continuite — a la livraison, NON encore validee sur le telephone.

## Enseignement naturel, premiere marche (v0.16.0) — « Apprends que ma couleur est rouge. »
Objectif : enseigner a Naissance en francais simple dans la conversation, SANS taper « Apprends : Fait : moi / couleur / bleu. ».
Decide avec Christophe (21/09) : declencheur « Apprends que… » ; « Retiens que… » reste l'action retenir (souvenirs, memoire
generale), STRICTEMENT inchange.
- PRINCIPE : une couche d'ENTREE, jamais un second moteur d'apprentissage. La phrase devient UNE lecon du canal existant
  (« Fait : moi / couleur / rouge. »), repasse par extraireLecon(), puis apercuLecon(), la confirmation humaine (Confirmer /
  Annuler, contrat { confirmation: { onOui, onNon } } de conversation/ecran.js) et ecrireConnaissance() — rien de cela n'est reecrit.
- PERIMETRE VOLONTAIREMENT MINIMAL : declencheur « Apprends que » en tete de message (jamais d'inference sur une phrase ordinaire) ;
  sujet « moi » seulement (ma / mon / mes) ; copule « est » ou « sont » seulement ; relation DEJA CONNUE du lexique seulement ;
  valeur conservee LITTERALEMENT (prise dans le texte original : comprendre() passe en minuscules et retire les accents) ;
  aucun appel a Gemini ni a un modele ; hors cadre = REFUS CLAIR (un message marque ne retombe jamais silencieusement dans la
  conversation ordinaire).
- NOUVEAU MODULE app/langage/interpretation.js (pur, sans DOM) : estEnseignementNaturel(texte) (test bon marche) et
  interpreterEnseignement(texte, { lexique }) → null (non concerne) | { ok:false, raison } | { ok:true, phrase, extrait, sujet,
  relation, valeur }. Le groupe avant la copule doit etre EXACTEMENT [possessif moi] + [relation connue] ; aucun mot en trop n'est
  ignore en silence. Aller-retour : la phrase canonique doit ressortir de extraireLecon() avec exactement les memes donnees.
  Refus : pas de contenu, pas de copule, sujet autre que « moi », relation inconnue (le mot est nomme et la facon de l'apprendre
  indiquee), possessif seul, mot en trop (« ma couleur preferee »), valeur vide, valeur contenant « / » ou « ? ».
- app/main.js : le bloc « apercu + Confirmer / Annuler » de « Apprends : » est sorti dans une fonction locale proposerLecon()
  (comportement IDENTIQUE) et partage entre « Apprends : <forme> » et « Apprends que ». La branche « Apprends que » est testee AVANT
  le marqueur « Apprends : » et avant le test du « ? ». Origine d'ecriture inchangee : 'apprise-conversation'.
- app/sw.js : './langage/interpretation.js' ajoute a la coquille hors ligne.
- INCHANGES : conversation/ecran.js, langage/ecran.js, lecon.js, esprit.js, aiguillage.js, actions/retenir.js, gemini-professeur.js.
- TESTS AJOUTES (320 au total avec les 293 existants) :
  · tests/interpretation.test.mjs — vrai module + vrai moteur : declencheur, non-concerne → null, cas de reference, aller-retour,
    valeur litterale, refus clairs, module pur, ecriture puis relecture (« ta couleur, c'est rouge. ») et persistance.
  · tests/ecrans-contrats.test.mjs — ferme les DEUX trous de la v0.15 avec les VRAIS fichiers (faux DOM) : exports de
    monterEcranLangage, chaque ecranLangage.X de main.js existe, ecrireConnaissance reel, boutons Confirmer / Annuler / echec de
    conversation/ecran.js, controle statique imports / exports de tout app/.
  Controle par mutation (hors depot) : retirer les deux exports de langage/ecran.js (bug reel de la 0.15.2), revenir au
  conversation/ecran.js de la 0.15.1 (bug reel de la 0.15.1), importer un nom inexistant, ignorer un mot en trop, capter
  « Retiens que », passer la valeur en minuscules : chacun fait echouer au moins un test.
- LIMITE CONNUE : la branche ajoutee dans main.js n'est pas testable en unitaire (script de demarrage : DOM et await au niveau du
  module). Elle est couverte par le test de fumee du robot (demarrage sans erreur), par le controle statique des imports et par
  la validation sur telephone. Les tests de langage.test.mjs utilisent toujours des dispatchers « miroirs » : les nouveaux tests
  ne les remplacent pas.
- LIMITES DU CADRE (non traitees volontairement) : pas de correction d'accord (« bleue » reste « bleue », visible dans l'apercu) ;
  pas de bouton « corriger » (Annuler puis retaper) ; « s'appelle », « j'habite », les sujets autres que « moi », les relations
  inconnues (« mon velo ») sont refuses ; pas d'oubli ni de correction conversationnels ; Gemini comme traducteur = etape ulterieure
  seulement si un besoin reel apparait.
- VALIDATION TELEPHONE : voir ETAT.md et le rapport de continuite — a la livraison, NON encore validee sur le telephone.

## Correctif (v0.15.3) — langage/ecran.js n'exposait pas assurerEsprit / ecrireConnaissance
Constate par Christophe sur telephone (APK 0.15.2) : les boutons Confirmer/Annuler s'affichent, mais
Confirmer donnait « ecranLangage.assurerEsprit is not a function ».
- CAUSE, verifiee dans l'APK livree : langage/ecran.js se terminait par `return { rafraichir: dessiner }`.
  Les deux fonctions dont main.js a besoin — `assurer` (l'esprit partage) et `ecrireConnaissance` — existaient
  bien a l'interieur, mais n'etaient pas exposees : comme pour conversation/ecran.js (v0.15.2), la modification
  decrite en v0.15.0 n'etait pas dans le depot.
- CONSEQUENCE PLUS LARGE : main.js appelle aussi assurerEsprit pour tout message contenant « ? » (v0.15.1) :
  toute question avec un point d'interrogation levait donc la meme erreur dans la conversation ordinaire
  (0.15.0 a 0.15.2). Corrige par le meme changement.
- CORRECTIF, langage/ecran.js SEULEMENT, une ligne : `return { rafraichir: dessiner, assurerEsprit: assurer,
  ecrireConnaissance };` — fonctions internes existantes, non reecrites, aucun second esprit.
- Verifie de bout en bout avec le vrai moteur du langage (magasin en memoire) : « Apprends : Mot : chat
  designe animal. » → apercu → ecrireConnaissance → lexique ecrit ; assurerEsprit renvoie le MEME objet a
  chaque appel ; une question avec « ? » ne leve plus d'exception. Controle statique de tous les imports/exports
  de app/ : aucun autre export manquant.
- Ecart cosmetique connu, non corrige : une reponse du laboratoire porte le badge « moteur local » au lieu de
  « ce qu'elle a appris » (decrit en v0.15.0, jamais code dans conversation/ecran.js).
- A retenir : trois fichiers touches par la v0.15.0 (main.js, conversation/ecran.js, langage/ecran.js) n'ont pas
  ete livres ensemble ; verifier l'APK reelle plutot que le seul rapport du robot.

## Correctif (v0.15.2) — les boutons Confirmer/Annuler n'etaient pas dans conversation/ecran.js
Constate par Christophe sur telephone (APK 0.15.1) : « Apprends : Mot : animal désigne animal. » affichait
l'apercu « J'ai compris : ... C'est correct ? » SANS boutons ; le « oui » tape partait comme un message
ordinaire (reponse du moteur local a cote).
- CAUSE, verifiee dans l'APK livree : main.js renvoyait bien { texte, confirmation: { onOui, onNon } },
  mais le conversation/ecran.js livre ne contenait AUCUN code pour `confirmation` — l'ajout generique decrit
  dans la section v0.15.0 n'etait pas dans le depot. Ni les tests unitaires ni les verifications e2e ne
  couvraient ce module : a garder en tete pour toute future modification d'ecran.js.
- CORRECTIF, dans conversation/ecran.js SEULEMENT : afficherMessage accepte options.confirmation ; deux boutons
  (Confirmer, style principal ; Annuler) dans la barre d'actions de la bulle, avec les classes existantes
  (aucun changement de styles.css). Au clic : les deux boutons sont desactives, onOui/onNon est appele, les
  boutons disparaissent et le texte rendu s'affiche dans une nouvelle bulle. Si l'appel echoue : boutons
  reactives + message « Ça n'a pas pu se faire : ... ». envoyerTexte transmet resultat.confirmation.
- Verifie par une simulation de la conversation (faux DOM) sur 4 cas : Confirmer, Annuler, echec de onOui,
  reponse ordinaire sans boutons.
- Limites connues : une proposition non confirmee disparait au rechargement ; taper « oui » dans le champ ne
  confirme pas (c'est un message ordinaire).

## Correctif (v0.15.1) — ne jamais intercepter une phrase qui n'est pas une question
Trouve en testant (pas anticipe dans l'analyse) : comprendre() peut atteindre l'etat COMPRIS sur une
phrase qui n'EST PAS une question — « J'ai un chat qui s'appelle Pixel » (une simple presentation)
est compris comme une question sur « mon nom » (sujet par defaut sans possessif explicite, relation
« nom » detectee via « s'appelle »), et repondait « Je ne sais pas. » au lieu de laisser la
conversation l'accueillir normalement. Pas un defaut du moteur pedagogique lui-meme, jamais concu
pour trier question/affirmation — ce tri revient au pont, pas a lui.
- Restreint dans main.js SEULEMENT (aucun changement a comprendre()/esprit.js/regles.js) : le
  laboratoire n'est essaye en premier que si le message contient un point d'interrogation. Couvre
  l'usage reel vise (« Quelle est la couleur de mon vélo ? ») sans jamais intercepter une
  affirmation ordinaire.
- Trouve grace au test de non-regression explicitement demande par Christophe (« conversation
  ordinaire inconnue du laboratoire ») sur la suite de regression large existante (6 messages
  varies), pas par l'analyse prealable — la valeur de garder cette suite a jour.

## Premier pont conversation <-> canal pedagogique (v0.15.0)
Objectif : enseigner depuis la conversation normale (« Apprends : ... »), confirmer par boutons
DANS le fil, et que le savoir devienne reellement utilisable ensuite dans une question ordinaire —
sans marqueur pour interroger. Decision explicite de Christophe : relier reellement les deux
memoires (jusque-la separees a dessein), pas seulement enseigner depuis la conversation.
- DECOUVERTE STRUCTURANTE, avant tout codage : naissance-langage (laboratoire) et naissance-memoire
  (vraie conversation) sont DEUX BASES SEPAREES, deux objets esprit differents. La conversation
  normale (esprit.repondre(), LFM2/Gemini) n'a aucune connaissance de ce que le laboratoire sait.
  Router l'ENSEIGNEMENT ne suffit pas a rendre le savoir utilisable en LECTURE : deux problemes
  distincts, resolus separement ci-dessous.
- OPTION RETENUE POUR LA LECTURE (comparee a l'injection dans le prompt LLM, ecartee : plus grosse,
  touche esprit/esprit.js, cout de quota croissant) : sur un message ORDINAIRE, essayer
  langage.repondre() EN PREMIER ; s'il atteint l'etat COMPRIS (pas partiel), utiliser sa reponse
  directement, sans appeler le LLM du tout ; sinon, chemin de conversation strictement inchange.
  Compromis assume et documente : le risque de faux declenchement grandit legerement avec le
  vocabulaire enseigne (un mot enseigne devient « special » pour toute question qui le mentionne
  dans une forme reconnue) — trait de caractere voulu (previsible sur ce qu'elle sait vraiment), pas
  un defaut cache.
- UN SEUL ESPRIT PARTAGE : monterEcranLangage (langage/ecran.js) expose desormais assurerEsprit et
  ecrireConnaissance (deux fonctions deja internes, EXPOSEES, jamais reecrites) sur l'objet qu'elle
  retourne. Le pont conversationnel (main.js) les appelle directement — jamais un second exemplaire
  independant de la meme base en memoire, qui aurait pu diverger silencieusement entre laboratoire
  et conversation jusqu'au redemarrage.
- MARQUEUR : « Apprends : <leçon> » (case et espace tolerants), verifie AVANT tout appel au LLM,
  dans le seul wrapper repondre() de main.js — ni conversation/ecran.js, ni esprit/esprit.js, ni
  aucun fichier du laboratoire n'ont ete touches pour cette partie. La leçon repasse par
  extraireLecon() (v0.14.3, inchangee, generique aux cinq types) exactement comme dans le
  laboratoire ou venant de Gemini. Si la forme n'est pas reconnue : refus clair, jamais de tentative
  de deviner, jamais un passage silencieux au LLM pour un message explicitement marque.
- CONFIRMATION DANS LE FIL : ajout GENERIQUE a afficherMessage (conversation/ecran.js) — deux
  boutons Confirmer/Annuler attaches a une bulle, sur le modele deja existant de « Demander a un
  modele plus fort ». Ce module ne sait toujours rien du langage pedagogique : il sait seulement
  afficher un oui/non et appeler ce qu'on lui a donne (onOui/onNon, definis dans main.js). L'etat
  temporaire vit entierement dans la fermeture JavaScript des deux boutons — rien de persiste avant
  confirmation, rien a construire pour la survie a un redemarrage (une proposition non confirmee
  disparait proprement au rechargement, comme le bouton de reprise deja existant).
- ORIGINE « apprise-conversation » (nouvelle valeur, aucun changement de schema) pour distinguer ce
  chemin des trois deja traces (apprise-christophe, apprise-lecon, apprise-gemini).
- HISTORIQUE : une decouverte technique pendant l'implementation, jugee necessaire a corriger sans
  toucher a esprit/esprit.js — la persistance du fil dans naissance-memoire (memoire.ajouterEchange)
  se fait normalement A L'INTERIEUR d'esprit.repondre(), qu'on contourne ici. Appelee directement
  depuis main.js (memoire deja accessible a ce niveau), UNIQUEMENT une fois l'echange resolu (apres
  confirmation ou annulation, ou immediatement pour une reponse directe du laboratoire) — jamais
  l'apercu lui-meme, pour ne pas laisser une proposition annulee ressembler a une reponse actee dans
  l'historique.
- BADGE DISTINCT : une reponse du laboratoire porte « ce qu'elle a appris », jamais « moteur local »
  (LFM2) — deux mecanismes differents, deux etiquettes.
- AUCUNE NOUVELLE TABLE, VERSION_BASE du langage inchangee (toujours 2).

## Les facons de dire, cinquieme type du canal pedagogique (v0.14.3)
Objectif : supprimer la derniere preparation technique rencontree dans les tests xyzz/grbl (v0.14.1)
— installer un patron a la main via un bouton de laboratoire. Desormais : Mot, Fait, Propriete,
Regle, et maintenant Facon de dire, cinq types recus par exactement le meme circuit
(reconnaissance -> extraction -> apercu -> confirmation humaine -> ecriture).
- DECOUVERTE STRUCTURANTE, EN TRACANT apprendrePatron()/fabriquerGabarit() : le mecanisme existant
  ne sait faire qu'UNE chose — reconstruire un gabarit depuis un EXEMPLE CONCRET, en cherchant le
  texte de la valeur dans la phrase. Le cas {possessif} n'est reconnaissable QUE parce qu'un
  mecanisme dedie (dynamiserPossessif) sait chercher un mot du lexique ayant le role
  possessif_toi/possessif_moi — entierement specifique a ces deux roles, non generalisable. Pour un
  role arbitraire (le resultat d'une regle jamais vue, comme "ZAP"), rien ne permet de deviner quel
  mot d'une phrase le represente. CONSEQUENCE : le canal pedagogique enseigne le GABARIT DIRECTEMENT
  (emplacements deja ecrits), jamais un exemple a reconstruire.
- apprendrePatronDirect() (esprit.js), a cote d'apprendrePatron() historique, INCHANGEE — aucune
  refonte, un pur ajout. Les deux partagent desormais une meme fonction interne d'ecriture
  (ecrirePatron), pour qu'une seule definition de "meme patron" gouverne la deduplication des deux
  chemins.
- N'A PAS BESOIN qu'un fait preexiste (contrairement a apprendrePatron, qui en a besoin pour
  verifier un exemple) : un patron peut donc etre appris AVANT sa regle, ou apres — l'ordre n'a
  jamais d'importance, teste dans les deux sens.
- validerGabaritDirect() : accolades appariees, aucun emplacement vide, {valeur} obligatoire, noms
  d'emplacement dans EXACTEMENT la meme syntaxe que celle reconnue au moment de repondre
  (emplacementsDynamiques) — sinon un nom mal ecrit resterait silencieusement dans une future
  reponse, un risque reel trouve en concevant cette validation.
- Cinquieme gabarit ajoute a TYPES_LECON : « Facon de dire : <relation ou *> / <sujet> / <gabarit>. »
  Le contrat envoye a Gemini l'inclut AUTOMATIQUEMENT (construit depuis TYPES_LECON) — AUCUN
  changement dans gemini-professeur.js.
- Retrait : oublierPatron() (v0.13.1) fonctionne deja identiquement, sans changement, sur un patron
  appris par n'importe lequel des deux chemins.
- AUCUNE NOUVELLE TABLE, VERSION_BASE inchangee (toujours 2).

## Roles dynamiques dans un patron (v0.14.1) — chantier 2 sur les trois identifies
Objectif : un patron declare lui-meme, par le NOM de son emplacement, quel role chercher en
regles — sans qu'aucun nom grammatical (genre, possessif, ou n'importe quel autre) n'apparaisse
dans le code de repondre()/esprit.js. Avant ce chantier, un seul cas etait cable en dur :
« {possessif} » declenchant une recherche de role possessif_toi/possessif_moi selon qui parle.
- emplacementsDynamiques(gabarit) : repere tout {xxx} qui n'est ni {valeur} ni {relation} — aucune
  liste de roles grammaticaux predefinie.
- remplirGabarit() remplace remplirAvecPossessif() : pour CHAQUE emplacement dynamique trouve,
  appelle appliquerRegles() avec LE NOM DE L'EMPLACEMENT LUI-MEME comme role (deja pleinement
  generique depuis v0.10 — verifie a l'inspection, aucun changement necessaire dans regles.js).
  SEULE EXCEPTION, EXPLICITE ET VOLONTAIRE : {possessif} garde son comportement historique exact
  (choix possessif_toi/possessif_moi selon qui parle), cable a la main a cote du mecanisme
  generique — le nom seul de l'emplacement ne porte pas l'information « qui parle », et casser ce
  cas aurait detruit toutes les façons de dire deja validees sur le telephone. Addition pure,
  aucune migration de patron necessaire.
- Comportement en absence de regle ou en cas de conflit : STRICTEMENT le meme qu'avant pour
  {possessif} (PHRASE_NE_SAIS_PAS_DIRE / PHRASE_CONFLIT), desormais applique uniformement a
  n'importe quel role dynamique — jamais un emplacement laisse tel quel dans une phrase, jamais un
  choix arbitraire entre deux regles qui se contredisent.
- PREUVE PAR VOCABULAIRE ABSURDE (deux roles distincts, xyzz puis grbl, MEME code entre les deux),
  test de transfert (une regle de role arbitraire apprise sur un mot s'applique a un second mot
  jamais vu), et lecture du code source verifiant qu'aucun des deux mots n'y figure comme cas
  special.
- Volontairement HORS PERIMETRE (comme demande) : canal pedagogique pour les patrons, regles
  multi-conditions enseignables, migration des patrons existants, toute nouvelle grammaire.
- AUCUNE NOUVELLE TABLE, VERSION_BASE inchangee (toujours 2).

## Retrait cible des connaissances (v0.14.0) — chantier 1 sur les trois identifies
Objectif : pouvoir retirer precisement UNE connaissance devenue fausse sans « Tout lui faire
oublier », qui efface tout. Prerequis avant d'elargir l'apprentissage (chantier 2 a venir).
- Quatre nouvelles fonctions dans esprit.js (oublierFait, oublierPropriete, oublierRelation,
  oublierRegle), a cote de oublierPatron (v0.13.1, inchangee) — logique pure, separee de l'ecran,
  directement appelable plus tard par un futur interprete conversationnel.
- SEMANTIQUE PAR TYPE, VALIDEE AVANT CODAGE : faits/proprietes/relations → suppression physique
  ciblee (ces types n'ont jamais eu de notion d'historique) ; regles → JAMAIS de suppression
  physique, nouveau statut 'desactivee' (distinct de 'validee' et 'remplacee'), l'historique et la
  chaine precedente restent intacts ; appliquerRegles() n'a nécessité aucun changement, il ignorait
  deja tout ce qui n'est pas 'validee'.
- AUCUNE CASCADE, VERIFIE PAR INSPECTION : les cinq tables ne se referencent jamais entre elles par
  pointeur, seulement par egalite de texte. Retirer une relation laisse ses faits et proprietes
  intacts mais inaccessibles ; les reenseigner n'est jamais necessaire, reenseigner SEULEMENT la
  relation suffit a tout rendre de nouveau utilisable (reversibilite testee explicitement).
- Un mot du bagage de depart ne peut pas etre oublie : il n'existe pas en base, un retrait
  n'y survivrait pas a un redemarrage — refuse clairement plutot que de laisser croire a un oubli
  qui ne tient pas.
- Panneau unique « Gerer ce qu'elle sait » (remplace « Gerer les facons de dire »), cinq sections a
  la suite, un bouton Oublier par element apprenable — pas de gestionnaire de base complexe.
- AUCUNE NOUVELLE TABLE, VERSION_BASE inchangee (toujours 2).

## Correctif racine (v0.13.2) — plus de doublon silencieux de facon de dire
Capture de Christophe : QUATRE facons de dire « apprises », quasi identiques a l'oeil
(« {possessif} {relation}, c'est {valeur}. »), en conflit entre elles. Pas l'ancien patron de v0.9
soupconne au depart : de simples doublons accumules, notamment via le bouton « Prerequis » du mode
test (v0.13) clique plusieurs fois au fil des essais, puisque apprendrePatron() n'a jamais verifie
si une facon de dire IDENTIQUE existait deja avant d'en creer une nouvelle.
- apprendrePatron() : reapprendre EXACTEMENT la meme facon de dire (meme relation, meme sujet, meme
  gabarit final) ne cree plus de doublon — renvoie l'existante avec un message clair, sans ecriture.
- Corrige la CAUSE, pas seulement le symptome deja traite en v0.13.1 (panneau de retrait manuel,
  toujours utile pour les doublons deja accumules sur les appareils deja utilises).

## Correctif (v0.13.1) — retirer une seule façon de dire
Signale par Christophe : après avoir enseigne la regle du possessif masculin (v0.13), sa question
de test s'est heurtee a un vrai conflit — « J'ai appris deux facons de dire ca qui se
contredisent... » — entre le patron general herite de la validation v0.9
(« Ton {relation} s'appelle {valeur}. ») et celui de v0.12/v0.13
(« {possessif} {relation}, c'est {valeur}. »). Comportement CORRECT (aucun choix arbitraire), mais
aucun moyen n'existait de resoudre le conflit sans « Tout lui faire oublier », qui efface tout.
- oublierPatron() (esprit.js) + supprimer() (connaissances.js, les deux magasins) : retire UNE
  SEULE facon de dire par son identifiant, sans toucher a rien d'autre. Les regles ont deja un
  mecanisme de version (memes conditions -> remplace) ; les patrons n'en ont pas, d'ou ce retrait
  cible plutot qu'un remplacement automatique.
- Panneau « Gerer les facons de dire » (ecran.js) : liste chaque facon de dire avec son origine ;
  seules les apprises (pas celle de depart) peuvent etre oubliees, avec confirmation.
- Aucune nouvelle table, VERSION_BASE inchangee.

## Premier professeur Gemini (v0.13.0) — le canal pedagogique recoit un enseignement externe
Objectif demontre : OBJECTIF D'APPRENTISSAGE → GEMINI PROFESSEUR → LEÇON → CANAL PEDAGOGIQUE
EXISTANT (v0.12, inchange) → CONFIRMATION → CONNAISSANCE LOCALE → REDEMARRAGE → UTILISATION SANS
GEMINI. Sujet valide : le possessif MASCULIN (« ton »), symetrique du feminin deja experimente,
seul rappel realiste utilise par repondre() aujourd'hui.
- AUCUNE NOUVELLE TUYAUTERIE GEMINI : reutilise integralement fournisseurs/gemini.js (generer, JSON
  force, parsing tolerant) et moteurExterne() (main.js) — memes reglages, meme cle, meme modele,
  meme relance/repli. Seul ajout : une methode enseigner() sur moteurExterne(), identique a
  generer() a l'exception du type d'appel compte ('enseignement', ajoute a compteur.js).
- CONTRAT CONSTRUIT DEPUIS TYPES_LECON (lecon.js), jamais recopie a la main — un futur changement
  de gabarit ne peut pas faire diverger silencieusement ce que Gemini croit pouvoir enseigner et ce
  que Naissance sait reellement lire. Reponse demandee : {"lecons": [...], "note": "..."} — "note"
  n'est JAMAIS apprise, c'est le seul endroit ou Gemini peut etre bavard.
- GEMINI N'EST JAMAIS FIABLE PAR DEFAUT : chaque ligne de "lecons" repasse par le MEME
  extraireLecon() (v0.12, inchange) qu'une lecon tapee par Christophe. Une ligne qui ne correspond
  a aucun des quatre gabarits est rejetee individuellement, sans bloquer les autres. Confirmation
  humaine conservee, leçon par leçon, meme UI que v0.11/v0.12 (fonction ecrireConnaissance()
  partagee entre les deux chemins pour ne rien dupliquer).
- EXEMPLE DYNAMIQUE DANS LE CONTRAT (reconstruireLeconRegle, lecon.js) : si une regle possessif_toi
  existe deja, sa phrase est reconstruite depuis ses champs structures (jamais un texte tape qui
  pourrait etre absent) et montree a Gemini comme modele de vocabulaire (meme role, meme propriete)
  — sans jamais dispenser de la revérification structurelle.
- TERRAIN FUTUR (candidat → verification → validation) laisse EN L'ETAT, non construit : statut
  'candidate', exemples, testsReussis, testsEchoues existent deja depuis v0.10, toujours vides.
- LIMITE ASSUMEE, NON CORRIGEE : faits et relations n'ont toujours pas de champ origine (v0.12) —
  un fait/relation enseigne par Gemini n'est pas distingue d'un enseignement manuel dans
  « Ce qu'elle sait ». Seules regles et proprietes tracent apprise-gemini.
- MODE TEST (v0.13) : trois boutons qui PREREMPLISSENT les champs (prerequis du mot « stylo »,
  sujet a demander a Gemini, question finale) — chaque ecriture reste un geste explicite a
  confirmer, rien n'est automatise ni cache.
- AUCUNE NOUVELLE TABLE, VERSION_BASE INCHANGEE (toujours 2).

## Canal pedagogique generalise (v0.12.0) — quatre types, un seul mecanisme
Objectif : passer de « canal pedagogique → regle » a « canal pedagogique → relation / fait /
propriete / regle », selon le type de lecon recue. Aucune nouvelle capacite semantique : les quatre
mecanismes d'apprentissage (apprendreRelation, apprendreFait, apprendrePropriete, apprendreRegle)
existaient deja depuis v0.9/v0.10 ; seul un routeur commun est nouveau.
- QUATRE GABARITS FIXES (`langage/lecon.js`), chacun reconnu par un mot-cle de tete distinct :
  « Mot : X désigne Y. » (relation), « Fait : X / Y / Z. » (fait), « Propriété : X / Y / Z. »
  (propriete), et le gabarit de regle de v0.11 inchange. Les quatre tetes etant distinctes, une
  phrase ne peut structurellement correspondre qu'a un seul type — verifie par un test dedie, sans
  logique de desambiguisation separee a construire.
- DECOUVERTE FAITE PENDANT L'ANALYSE, AVANT CODAGE : la liste initiale de Christophe (fait/relation,
  propriete, regle) melangeait deux mecanismes distincts sous un seul nom, et omettait le patron
  (la facon de dire) necessaire au test final — signale et corrige dans le protocole avant de coder,
  pour ne pas livrer un prototype qui echoue son propre test decisif.
- « PATRON » RESTE DELIBEREMENT HORS DU CANAL : son mecanisme (fabriquerGabarit, reverse-ingenierie
  d'une phrase entiere) est trop different des quatre autres pour l'y forcer sans abstraction
  artificielle — decision explicite de Christophe, testee par une assertion de non-regression.
- DISPATCH SANS RIEN REECRIRE : apprendreRelation/apprendreFait/apprendrePropriete/apprendreRegle
  sont appelees telles quelles apres confirmation ; extraireLecon renvoie exactement la forme que
  chacune attend, aucune transformation intermediaire. Limite assumee et signalee : faits et
  relations n'ont pas de champ « origine » (contrairement a propriete/regle) — les etendre aurait
  demande de reecrire ces deux fonctions, ce que Christophe a explicitement demande d'eviter sauf
  necessite ; un fait ou une relation enseigne par lecon n'est donc pas distingue visuellement d'un
  enseignement manuel dans « Ce qu'elle sait ».
- CONFIRMATION REUTILISEE TELLE QUELLE (v0.11) : aucune ecriture avant confirmation explicite, pour
  les quatre types. apercuLecon() adapte simplement le texte affiche au type reconnu.
- SCENARIO FINAL REJOUE ENTIEREMENT PAR LECONS (sauf le patron, prerequis assume et enseigne
  separement comme convenu) : relation, fait et propriete de « voiture », plus la regle du
  possessif, tous recus par le canal ; « ta »/« voiture » jamais associes dans aucune lecon ;
  transfert confirme apres redemarrage complet.
- AUCUNE NOUVELLE TABLE, VERSION_BASE INCHANGEE (toujours 2) : verifie explicitement par un test qui
  reconstitue une vraie base v0.11 existante (six tables, donnees reelles) avant d'appliquer v0.12.

## Canal pedagogique (v0.11.0) — leçon a forme fixe → regle interne
Objectif : « une connaissance exprimee dans un petit langage pedagogique controle peut etre
transformee en regle interne, confirmee, memorisee, puis utilisee dans une situation nouvelle. »
Etape intermediaire ASSUMEE : pas de comprehension du francais libre.
- CORRECTIF PREALABLE (demande avant de baser v0.11 dessus) : regles.js comparait les valeurs de
  propriete par egalite stricte, sans normaliser accents/casse, alors que comprendre.js le fait
  partout ailleurs — une regle pouvait echouer EN SILENCE si « feminin » avait ete tape une fois
  avec l'accent et une fois sans. normaliserTexte() (regles.js) applique desormais la meme
  normalisation des DEUX cotes : a l'ecriture (apprendrePropriete, apprendreRegle, esprit.js) ET a
  la comparaison (conditionsSatisfaites, appliquerRegles) — les anciennes donnees deja enregistrees
  sans cette normalisation continuent de fonctionner, pas seulement les nouvelles. Le resultat d'une
  regle (le mot produit, ex. « ta ») n'est JAMAIS normalise : normaliser sert a comparer, jamais a
  produire du texte.
- CANAL PEDAGOGIQUE (`langage/lecon.js`, extraireLecon) : un gabarit fixe et unique,
  « Pour <role> : si <propriete> vaut <valeur>, on dit <resultat>. » Reconnu par ses mots
  d'echafaudage (Pour/si/vaut/on dit) UNIQUEMENT — aucun mot grammatical (genre, feminin, ta...)
  n'apparait dans le code d'extraction ; verifie par un test qui lit le fichier source et cherche
  ces chaines. Une phrase qui ne respecte pas la forme est refusee, jamais devinee.
- CONFIRMATION OBLIGATOIRE avant tout apprentissage : Naissance affiche ce qu'elle a extrait
  (role/condition/resultat) et attend une confirmation explicite. Rien n'est ecrit en base avant
  cette confirmation — l'annulation ne laisse aucune trace.
- REUTILISATION INTEGRALE d'apprendreRegle (v0.10) pour la persistance : extraireLecon renvoie
  exactement la forme attendue par apprendreRegle, aucune transformation intermediaire necessaire.
  Nouvelle valeur d'origine : 'apprise-lecon' (la phrase source reste tracee dans « exemples »).
- PREUVE DE GENERALITE : teste avec un vocabulaire entierement absurde (« Pour xyzz : si grbl vaut
  zorx, on dit qud. ») ET avec une deuxieme leçon sur une notion grammaticale sans rapport, via le
  meme code inchange — sinon ce serait la preuve d'une reconnaissance de vocabulaire, pas d'une
  structure.
- TEST DE COMPOSITION COMPLET REJOUE : la regle du test v0.10 (couleur/voiture) arrive cette fois
  par une leçon plutot que par le formulaire, transferee apres redemarrage complet, avec la meme
  garantie verifiee (« voiture » absent de la leçon elle-meme).
- AUCUNE NOUVELLE TABLE : la regle confirmee est ecrite dans la table « regles » deja existante
  depuis v0.10 (VERSION_BASE reste a 2). Verifie explicitement par un test qui reconstitue une VRAIE
  base v0.10.2 (avec ses tables et ses donnees, pas un profil neuf) avant d'appliquer v0.11 dessus —
  la lecon du 20/09 n'est pas retombee dans le meme piege.

## Correctif (v0.10.2) — la vraie cause de l'ecran vide, trouvee grace au message d'erreur
Le message d'erreur revele par le garde-fou de la v0.10.1 (« Failed to execute 'transaction'...
object stores was not found ») a montre la vraie cause : `naissance-langage` existait deja, a la
version 1, sur le telephone de Christophe (creee et utilisee pendant la validation de v0.9.0, avec
seulement 4 tables). v0.10.0 a ajoute « proprietes » et « regles » au CODE sans jamais incrementer
`VERSION_BASE` — IndexedDB ne recree les tables manquantes que si le numero de version demande est
SUPERIEUR a celui deja enregistre sur l'appareil. Sans ce numero, ces deux tables n'ont jamais ete
creees sur un appareil deja utilise, alors qu'un profil totalement neuf ne montrait rien (les tests
avant livraison partaient toujours d'une base neuve, jamais d'une v0.9.0 reellement deja utilisee).
- `VERSION_BASE` : 1 → 2. Meme mecanisme deja utilise dans memoire/magasin.js (v0.6.0, table
  « actions ») : la mise a niveau ne cree que les tables manquantes, rien d'existant n'est touche.
- Nouveau test qui aurait du exister des le depart : une base v1 reconstituee avec SEULEMENT les 4
  tables d'origine et de vraies donnees v0.9.0, mise a jour vers v0.10.2, verifiee sans erreur et
  les donnees anciennes toujours intactes.
- Le garde-fou de la v0.10.1 (une question n'echoue plus jamais en silence) reste en place : c'est
  lui qui a permis de trouver cette cause en une seule capture d'ecran plutot qu'en tatonnant.

## Correctif (v0.10.1) — plus jamais de reponse silencieuse
Signale par Christophe : « Quelle est ma couleur ? » ne donnait AUCUNE reponse (aucune bulle, pas
meme fausse) apres avoir enseigne une regle de possessif sur « couleur » alors qu'un patron general
sur « fils » existait deja depuis v0.9.
- Trouve en marge, et corrige : deux facons de dire (patrons) a egale specificite etaient
  departagees en silence par ORDRE D'APPRENTISSAGE (la plus ancienne l'emportait), exactement le
  choix arbitraire que le moteur de regles refuse deja. repondre() detecte maintenant ce cas et
  repond « J'ai appris deux facons de dire ca qui se contredisent... » plutot que de trancher seul —
  visible, jamais une reponse fausse silencieuse.
- Trouve en creusant : l'identifiant d'un patron ('portee toutes') ne dependait que de Date.now(),
  risque de collision si deux patrons naissent dans la meme milliseconde (id ajoute au hasard en plus).
- GARDE-FOU AJOUTE (le vrai correctif pour le symptome de Christophe) : la question posee a
  Naissance n'echoue plus jamais en silence — toute exception imprevue affiche desormais un message
  au lieu de laisser l'ecran sans reponse. Si le probleme signale n'etait pas le conflit de patrons
  ci-dessus, ce message revelera la vraie cause au prochain essai.

## Regles comme donnees (v0.10.0) — composition et transfert d'un choix grammatical
Objectif unique : prouver qu'une regle linguistique peut etre une DONNEE modifiable, combinee avec
une propriete apprise separement, et utilisee dans une situation jamais enseignee directement.
- DEUX NOUVELLES TABLES dans la meme base isolee `naissance-langage` : `proprietes`
  ({mot, propriete, valeur, origine}, ex. voiture/genre/feminin) et `regles`
  ({id, role, conditions:[{propriete,valeur}], resultat, origine, statut, precedente, exemples,
  creee, modifiee}). Aucune relation-graphe (gamin --equivalent--> fils) construite : le format est
  pret, l'exercice reste hors scope v0.10, comme demande.
- MOTEUR GENERIQUE (`langage/regles.js`, `appliquerRegles`) : jamais de condition JS ecrite a la
  main pour une regle grammaticale precise. `plusSpecifiques()` EXTRAIT le principe deja present
  dans `choisirPatron()` (v0.9) — plusieurs candidats, le plus specifique gagne — et le partage
  entre patrons et regles, SANS fusionner leurs deux formats de donnees (patrons : specificite par
  relation/sujet ; regles : nombre de conditions satisfaites). Choix documente : fusion complete
  jugee non "propre" par rapport au risque sur le code v0.9 deja valide.
- CONFLIT JAMAIS TRANCHE EN SILENCE : deux regles a egale specificite donnant des resultats
  differents renvoient un etat explicite (`PHRASE_CONFLIT`), jamais un choix arbitraire.
  Absence de regle applicable → `PHRASE_NE_SAIS_PAS_DIRE`, jamais une invention.
- VERSIONNAGE LEGER : reapprendre EXACTEMENT les memes conditions pour le meme role REMPLACE la
  regle (statut 'remplacee', `precedente` pointe vers l'ancienne) au lieu d'en ajouter une
  concurrente ; deux conditions differentes cohabitent sans se remplacer. Aucune table d'historique
  separee : la chaine de `precedente` suffit.
- PROVENANCE GENERALISEE, GEMINI NON BRANCHE : origine accepte deja 'apprise-gemini', statut deja
  'candidate' (jamais appliquee par le moteur) — le format accueille un futur enseignement externe
  sans migration de schema, mais rien n'appelle Gemini en v0.10.
- CORRECTIF DECOUVERT PENDANT L'IMPLEMENTATION, AVANT LIVRAISON : la detection automatique d'un mot
  possessif dans une correction cassait des patrons v0.9 deja valides (« Ton fils s'appelle Atem. »
  devenait injouable sans regle enseignee). Rendue OPTIONNELLE (`dynamiserPossessif`, desactivee par
  defaut) : le comportement v0.9 est intact pour tout patron enseigne sans cette option explicite.
  Confirme par les 15 tests v0.9 d'origine, qui repassent tous sans modification.
- TEST DECISIF (durci par rapport a la proposition initiale) : la regle feminin→ta est enseignee en
  corrigeant une phrase sur « couleur » — jamais « voiture » — puis voiture/genre/feminin et le fait
  associe sont enseignes separement. Verification programmee que le mot « voiture » n'apparait nulle
  part dans la regle active. Apres redemarrage complet, la question sur la voiture produit « ta
  voiture… », jamais montre sous cette forme. Controle negatif (mot masculin → « ton », jamais
  « ta »), et cas sans regle disponible → reponse honnete, jamais d'invention.

## Langage propre a Naissance (v0.9.0) — prototype sans modele de langage
Question posee : peut-on donner a Naissance un petit systeme de comprehension et de langage qui lui
appartient, capable d'APPRENDRE et de reutiliser durablement, sans dependre d'un LLM ?
Origine : le banc v0.8.0 a montre que les seules reponses parfaites des 84 essais venaient des
phrases de secours construites par Naissance elle-meme, pas de LFM2.
- ISOLE : base IndexedDB `naissance-langage` (faits, lexique, patrons, journal), distincte de
  `naissance-memoire`. Aucun lien avec la memoire reelle, la conversation, ni LFM2 (qui reste
  installe et disponible). On peut tout effacer sans risque.
- BAGAGE DE DEPART VOLONTAIREMENT PETIT (~60 mots, 1 fait, 1 seul patron « valeur seule »), pour que
  toute capacite nouvelle soit necessairement acquise et non pre-ecrite. Ce n'est pas le vocabulaire
  definitif : c'est un choix experimental.
- DECOUPAGE PROPRE (`langage/comprendre.js`) qui CONSERVE les petits mots, contrairement a
  `motsCles()` (memoire/selection.js) qui jette les mots de moins de 4 lettres et « mon/ton/mes/tes ».
  C'est ce qui permet enfin de distinguer « ma couleur » de « ta couleur » — le defaut que LFM2
  n'a jamais corrige sur 160 essais. Les noms de relation passent avant les verbes, sinon
  « Comment s'appelle mon fils ? » repondrait le prenom de Christophe au lieu de celui du fils.
- TROIS CHOSES APPRENABLES, toutes stockees en base, jamais dans le code : un FAIT, un MOT
  (rattache a un mot connu), un PATRON (extrait d'une correction, en remplacant la valeur connue
  par un emplacement ; `portee: 'toutes'` remplace aussi le nom de la relation, ce qui autorise le
  transfert). Un gabarit n'est jamais devine : la valeur doit figurer dans la correction.
- CRITERE DECISIF = LE TRANSFERT : apprendre sur une relation, redemarrer, reutiliser sur une AUTRE.
  Verifie par test automatise (« Ton fils s'appelle Atem. » appris sur `fils` produit ensuite
  « Ton ville s'appelle Marcillac-Lanville. » sur `ville`, jamais montree). La phrase est fautive :
  c'est assume a ce stade, et c'est justement la preuve d'une generalisation reelle.
- JOURNAL DES FORMULATIONS NON TRAITEES : trois etats (compris / partiel / incompris) plus
  « comprise mais fait inconnu », avec les mots inconnus et le nombre de repetitions. Matiere
  d'apprentissage pour plus tard ; rien n'en est fait automatiquement.
- PLAFOND CONNU ET ASSUME : elle ne comprend que ce qui ressemble a ce qu'elle connait. Aucune
  generalisation a une tournure vraiment inedite. Le journal sert justement a mesurer cette frontiere.

## Banc comparatif de solutions (v0.8.0) — COMPRENDRE → TESTER → COMPARER
Fin de la phase d'observation pure. Objectif : « jusqu'où peut-on améliorer la fiabilité de
LFM2-350M en changeant la manière dont Naissance l'utilise, sans toucher au modèle ? »
Le modèle, la mémoire réelle, les prompts normaux et l'architecture de Naissance restent inchangés :
le banc construit ses contextes de toutes pièces et passe à côté de `contexteLocalPourEssai`
(qui, lui, lit la vraie mémoire) — aucune refonte n'a été nécessaire.
- Mémoire de test ISOLÉE (`solutions-memoire.js`) : 12 faits en dur (identité de Christophe et de
  Naissance, lieu, couleur, nombre, deux relations, préférence, événement, ville de naissance, et
  deux couleurs de proches pour permettre une confusion observable). Jamais lue depuis IndexedDB,
  jamais écrite : la mémoire réelle n'est ni utilisée ni modifiée. 12 questions couvrant les neuf
  catégories et les trois personnes grammaticales, dont 3 sans réponse en mémoire.
- Sept conditions (`solutions-approches.js`), mêmes faits / mêmes questions / même graine fixe :
  témoin (comportement actuel), A1 préparation structurée, A2 sortie contrainte (valeur seule),
  A3 trois petites inférences (sorties intermédiaires toutes conservées), A4 vérification
  déterministe après coup (réponse brute jamais réécrite), A5 fait protégé (la valeur vient de
  Naissance ; si le modèle l'altère, phrase de secours construite), A6 représentation intermédiaire.
- CONSTAT D'ARCHITECTURE SIGNALÉ AVANT CODAGE : A1 et A6 sont quasi équivalentes dans notre système
  (même pipeline, même nombre d'appels, seule la syntaxe du bloc change) — gardées comme deux
  variantes d'écriture d'une même idée, pas comme deux architectures distinctes.
- ASYMÉTRIE MESURÉE À PART : sur une information absente, A1/A2/A5/A6 constatent le manque sans
  appeler le modèle (0 inférence, invention structurellement impossible) ; le témoin, A3 et A4
  l'appellent toujours. C'est une différence de nature, pas de qualité de réponse.
- 8 mesures par essai, dont le nombre d'appels et le temps : une approche à 3 inférences n'est
  jamais présentée comme équivalente à une approche à 1. Journal partagé avec le grand banc
  (identifiants préfixés « solutions/ ») ; l'effacement ne retire que ces essais-là.
- Volume : 7 × 12 = 84 essais, ~96 appels au modèle (A3 en fait 3 par question, quatre approches 0
  sur les questions absentes), soit environ 10 à 15 minutes. Aucun gagnant désigné par Claude :
  le rapport livre les chiffres et les sorties brutes.

## Correctif du classificateur (v0.7.7) — le premier mot d'une phrase n'est plus une invention
Bug trouvé le 20/09 en relisant à la main les données brutes de la campagne corrigée : dans
`motsInventes` (classement.js, v0.7.3), le premier mot de chaque phrase — toujours en majuscule en
français, qu'il s'agisse d'un nom propre ou non — n'était jamais exclu, contrairement à l'ancienne
fonction `elementsDistinctifs` du même fichier qui le fait déjà correctement. Conséquence observée :
« Votre fils est généralement appelé "Atem" dans la langue arabe. » — sans lieu inventé — était
classé « géographique » à cause du seul mot « Votre » en tête de phrase, mal repéré comme un nom de
lieu par `classerCompletion` (grand-banc-classement.js).
- `motsInventes` exclut désormais le premier mot de chaque phrase (nouvelle fonction
  `premiersMotsDePhrase`), au même titre que `elementsDistinctifs` — un seul correctif, à la source,
  qui répare du même coup `classer()`, `classerAbsence` et `classerCompletion` (tous construits sur
  la même liste d'inventions). Audit du reste du fichier : aucun autre endroit ne comportait ce biais.
- Les rapports (`rapportSynthese`, `rapportBrut`) ne font plus jamais confiance au champ « categorie »
  stocké : une nouvelle fonction `reclasser` reconstruit le contexte exact à partir des champs déjà
  enregistrés (préfixe, éléments, souvenirs imposés, réponse brute) et relance uniquement le
  classement — sans la moindre inférence LFM2 — à chaque génération de rapport. Une correction future
  du classificateur profitera donc automatiquement à toutes les campagnes déjà enregistrées, y
  compris celles bogguées par le correctif d'identité (v0.7.5), sans jamais les modifier en base :
  la réponse brute reste la seule chose qui ne change jamais.
- Limite connue, non corrigée ici (hors du bug demandé) : `classerCompletion` ne distingue pas un
  ajout purement stylistique d'une fausse affirmation non géographique (ex. « dans la langue arabe »
  tombe dans « stylistique », faute d'un moyen fiable de la reconnaître comme un fait inventé sans
  viser un lieu). La réponse brute reste, comme toujours, la référence finale.

## Confort du grand banc (v0.7.6) — copie des données brutes une expérience à la fois
Les données brutes des 160 essais en un seul texte étaient trop longues à coller dans un message.
« Copier les données brutes » est remplacé par un choix d'expérience (menu déroulant) + « Copier
cette expérience » : un texte nettement plus court à chaque fois, une expérience à la fois. La
synthèse (courte) reste copiée d'un coup comme avant. Rien d'autre ne change.

## Correctif du grand banc (v0.7.5) — {personne} jamais substitué, corrigé
Audit complet du 20/09, après découverte du bug dans les données de la campagne du 19/09 : le
gabarit littéral « {personne} » (4 constantes de fait + 6 questions à la 3e personne, dans
grand-banc-plan.js) n'était JAMAIS remplacé par « Christophe » avant d'atteindre le moteur —
genererPlan() ne recevait aucune identité, contrairement à protocoles.js (épreuves du banc rapide)
qui fait ce remplacement depuis la v0.7.2. Aucun « {ia} » n'était utilisé dans ce fichier ; les
autres accolades trouvées par l'audit sont de l'interpolation `${...}` JavaScript ordinaire, déjà
résolue avant l'écriture — pas un gabarit oublié.
- `genererPlan(identite, { version })` substitue désormais réellement {personne}/{ia} (même
  mécanisme que protocoles.js). Un `version` optionnel préfixe l'identifiant des essais des
  5 expériences affectées (tout sauf « absence », non concernée par le bug) — ex.
  `corrige-2026-09-19/variabilite/fixe/1` — pour qu'une campagne corrigée ne recouvre JAMAIS les
  anciennes données bogguées dans le journal : les deux cohabitent, jamais d'écrasement.
- Garde de sécurité (`placeholderNonResolu`, `executerLot`) : si la question ou un souvenir imposé
  contient encore un `{mot}` non résolu, l'essai n'est PAS envoyé au moteur — enregistré directement
  en échec de préparation, avec le texte fautif. Propre à l'instrument de diagnostic, sans effet sur
  la conversation normale.
- Aperçu avant lancement (« Vérifier les stimuli ») : montre la question et le souvenir imposé
  RÉELLEMENT résolus d'un essai représentatif de chacune des six expériences.
- Les rapports (synthèse, données brutes) ne portent plus que sur les essais du journal dont
  l'identifiant appartient au plan courant : les anciennes entrées bogguées, conservées mais hors
  du nouveau plan, n'y apparaissent plus mélangées aux nouvelles.
- Aucun autre changement : mêmes questions, mêmes souvenirs (une fois substitués), mêmes graines,
  mêmes répétitions, même échantillonnage, mêmes catégories — pour que l'ancienne et la nouvelle
  campagne restent comparables sur tout le reste.

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
