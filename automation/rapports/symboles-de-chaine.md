---
instruction: symboles-de-chaine
commit_depart: 10c2e7db73bd43f5468c4dabe71f299e721b067c
branche_defaut: main
version_lue: 0.63.36
statut: SUCCES
tests_total: 3562
tests_echecs: 0
mutations: non applicable
---

# Rapport — symboles-de-chaine

## 1. Instruction
Introduire la primitive pure et dormante `symbolesDeChaine(chaine)` : points de code Unicode d'une chaîne, sous forme de chaînes.

## 2. Commit de départ
`10c2e7db73bd43f5468c4dabe71f299e721b067c` (tête de `main`, ancêtre de la branche d'instruction ; pas de rebase nécessaire). Branche d'instruction à `045f1487bbb7d22cefd73f3209e6776340d23e7c` avant mon commit.

## 3. Version lue
`VERSION` = 0.63.36 ; dernière entrée de `ETAT.md` : v0.63.36 (APK, aucun changement de code).

## 4. Fichiers modifiés
- `app/langage/symboles-de-chaine.js` (nouveau)
- `tests/symboles-de-chaine.test.mjs` (nouveau)
- `automation/rapports/symboles-de-chaine.md` (ce rapport)

## 5. Ce qui a été fait
Module `app/langage/symboles-de-chaine.js`, export nommé `symbolesDeChaine(chaine)` : `TypeError` explicite si `typeof chaine !== 'string'`, sinon `Array.from(chaine)`. Chaîne vide → `[]`. Aucune normalisation, aucune tokenisation, substituts isolés conservés, emoji = un élément, combinants non fusionnés. Aucun import, aucun appelant, absent du catalogue et de la table, non importé par `main.js`.

## 6. Tests ajoutés et décompte
12 tests dans `tests/symboles-de-chaine.test.mjs` : ASCII, précomposés, combinant, emoji hors BMP, substituts isolés, chaîne vide, type de sortie, absence de normalisation, refus (undefined, null, nombre, booléen, objet, tableau, symbole, bigint, fonction, `new String`), dormance, garde statique (mots interdits, temps/magasin/async, pas d'import, pas de littéral d'expression régulière).
Décompte `node --test tests/*.test.mjs` :
- avant (référence de l'instruction) : 3550 tests, 0 échec
- après : `# tests 3562`, `# pass 3562`, `# fail 0`

## 7. Gardes existantes touchées
Aucune. Les gardes de dormance/liste existantes passent sans modification.

## 8. Hypothèses par défaut utilisées
Module `app/langage/symboles-de-chaine.js` (export `symbolesDeChaine`) et tests `tests/symboles-de-chaine.test.mjs` : aucun conflit avec les gardes.

## 9. Points non vérifiés
Le CI de la PR n'a pas été observé ; la livraison (colis, VERSION 0.63.37) est hors périmètre. Les commentaires du module évitent volontairement les mots interdits.

## 10. ACTION HUMAINE REQUISE
aucune
