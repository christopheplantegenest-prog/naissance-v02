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
