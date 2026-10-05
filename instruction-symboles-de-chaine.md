# INSTRUCTION — BRIQUE « symbolesDeChaine »

Nom de l'instruction : `symboles-de-chaine`
Nature : petite évolution de code (une primitive pure et dormante). Version cible de la livraison : 0.63.37 (voir « Livraison » : tu ne la réalises PAS).

## Objectif
Introduire la représentation minimale des symboles d'une chaîne sous forme de points de code Unicode.

## Spécification (décidée par l'architecte, à respecter exactement)
- Une fonction pure `symbolesDeChaine(chaine)`.
- Elle décompose avec `Array.from(chaine)` : un élément par point de code Unicode.
- Sortie : un tableau de CHAÎNES, chacune représentant un point de code (par exemple `'a'`, `'é'`, `'😀'`). PAS des entiers.
- Chaîne vide : tableau vide `[]`.
- AUCUNE normalisation (pas de `normalize`, pas de casse, pas de `trim`, pas de suppression d'accents).
- AUCUNE tokenisation (pas de découpage en mots, pas de `split`, pas d'expression régulière).
- Cas Unicode particuliers CONSERVÉS EXACTEMENT : les substituts isolés (ex. `'\uD800'`) ressortent tels quels, un élément chacun, sans erreur ni remplacement. Un caractère hors BMP (emoji) est UN seul élément. Les suites combinantes ne sont pas fusionnées (« e » + accent combinant = deux éléments).
- Entrée qui n'est pas une chaîne : refus explicite par une exception `TypeError` au message clair. Aucune coercition, aucune devinette.
- Primitive DORMANTE : aucun appelant, absente du catalogue d'opérations et de la table, non importée par `main.js`. Aucune persistance, aucun temps, aucun état.

## Hypothèses faites par défaut (à signaler dans le rapport, ne pas les débattre)
- Nouveau module : `app/langage/symboles-de-chaine.js`, export nommé `symbolesDeChaine`.
- Tests dédiés : `tests/symboles-de-chaine.test.mjs`.
Si l'un de ces deux points entre en conflit réel avec l'architecture (par exemple une garde impose un autre emplacement), STOP, statut BLOQUE, UNE question dans le rapport.

## Ce que tu dois faire
a. Fais le point de départ habituel (commit distant de la branche par défaut, version lue).
b. Lis les modules purs voisins (`app/langage/suites-fermees.js`, `constats-valeurs.js`) et les gardes de tests (`tests/suites-fermees.test.mjs`, `tests/execution-sollicitee.test.mjs`, `tests/sollicitation-ui.test.mjs`) pour respecter les conventions.
c. Écris le module et ses tests : ASCII, accents précomposés, accent combinant, emoji hors BMP, substitut isolé, chaîne vide, entrée non chaîne (au moins `undefined`, `null`, nombre, objet), garde de dormance (le fichier n'est importé par aucun autre fichier de `app/`), garde statique (pas de `normalize`, `split`, `trim`, `RegExp`, `toLowerCase`, `toUpperCase`, `codePointAt`, `charAt`, `localeCompare`, ni temps/magasin/async dans le module).
d. Ne conserve les gardes existantes que si elles passent encore. Si l'ajout du fichier fait échouer une garde existante (liste de fichiers, inventaire de modules), tu peux la mettre à jour AU MINIMUM pour tenir compte du nouveau fichier, en le disant dans le rapport. Tu n'affaiblis jamais une interdiction (mots interdits, dormance) et tu n'effaces jamais un test.
e. Lance la suite complète : `node --test tests/*.test.mjs`. Donne le décompte exact repris de `# tests`, `# pass`, `# fail`. Référence avant ton travail : 3550 tests, 0 échec.
f. Aucun comportement existant ne doit changer.

## Interdits
`VERSION`, `ETAT.md`, `package.json`, `index.html`, `.github/`, `signature/`, `android/`, tout fichier `.zip`, aucun colis, aucun APK, aucune modification de `main.js` ou du catalogue. Aucune décision d'architecture.

## Livraison
La livraison 0.63.37 (colis, VERSION) est HORS de ton périmètre : la PR ne peut pas contenir `VERSION` ni de `.zip` (le CI les refuse). Tu produis seulement le module, les tests, et le rapport. Ne fais rien d'autre.

## Rapport
Écris-le dans `automation/rapports/symboles-de-chaine.md`, avec ce front-matter (clés lues par le CI, noms exacts) :

```
---
instruction: symboles-de-chaine
commit_depart: <SHA complet de la tête de la branche par défaut>
branche_defaut: <nom>
version_lue: <contenu de VERSION>
statut: SUCCES | ECHEC | BLOQUE
tests_total: <nombre>
tests_echecs: <nombre>
mutations: non applicable
---
```

Puis, en Markdown : 1. Instruction (une phrase). 2. Commit de départ. 3. Version lue. 4. Fichiers modifiés (liste exacte). 5. Ce qui a été fait (module, signature, comportement). 6. Tests ajoutés et décompte exact (avant/après). 7. Gardes existantes touchées (aucune, ou lesquelles et pourquoi). 8. Hypothèses par défaut utilisées. 9. Points non vérifiés. 10. « ACTION HUMAINE REQUISE : » suivie de « aucune » ou d'UNE question précise.

Un seul commit (module + tests + rapport), poussé uniquement sur `instruction/symboles-de-chaine`.
