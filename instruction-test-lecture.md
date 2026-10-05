# INSTRUCTION — TEST À BLANC « LECTURE »

Nom de l'instruction : `test-lecture`
Nature : test de l'atelier (lecture seule). AUCUN développement. AUCUN colis.

## Ce que tu dois faire (et rien d'autre)

a. Identifier le commit DISTANT de départ : le nom de la branche par défaut du dépôt et le SHA complet de sa tête (`origin/<branche par défaut>`), ainsi que le SHA de départ de la branche d'instruction.
b. Lire le fichier `VERSION` et donner son contenu exact.
c. Lire `ETAT.md` et recopier, mot pour mot, l'entrée « Dernier colis » ainsi que la première ligne de « Historique ».
d. Lancer la suite de tests existante : `node --test tests/*.test.mjs`.
e. Donner le décompte EXACT repris des lignes de sortie `# tests`, `# pass`, `# fail`.
f. Dire si la branche par défaut paraît protégée, SANS aucune tentative destructive : n'essaie JAMAIS de pousser dessus, pas même en `--dry-run`. Utilise seulement des lectures disponibles (nom de la branche par défaut, règles visibles par les outils dont tu disposes). Si aucune lecture ne permet de conclure, écris `NON DÉTERMINABLE` et dis ce que tu as essayé de lire.
g. Écrire le rapport dans le fichier `automation/rapports/test-lecture.md` (le dossier n'existe pas : crée-le). Format ci-dessous.
h. Faire UN commit contenant uniquement ce rapport, puis le pousser sur la branche d'instruction `instruction/test-lecture`, et nulle part ailleurs.

## Interdits pour ce test
Aucune autre modification : pas de fichier de `app/`, `tests/`, `index.html`, `VERSION`, `ETAT.md`, `package.json`, aucun colis, aucun APK, rien dans `.github/`. Pas de décision architecturale. Pas de relance après échec : si quelque chose échoue, écris le rapport avec le statut `BLOQUE` et une seule question.

## Format du rapport
Le fichier commence par ce front-matter (les clés sont lues par le CI ; garde exactement ces noms) :

```
---
instruction: test-lecture
commit_depart: <SHA complet de la tête de la branche par défaut>
branche_defaut: <nom>
version_lue: <contenu de VERSION>
statut: SUCCES | ECHEC | BLOQUE
tests_total: <nombre>
tests_echecs: <nombre>
mutations: non applicable
---
```

Puis, en Markdown, ces sections :
1. Instruction (une phrase).
2. Commit de départ (SHA, branche par défaut, SHA de départ de la branche d'instruction).
3. Version lue (VERSION et dernière entrée de ETAT.md, recopiées).
4. Fichiers modifiés (doit être exactement : `automation/rapports/test-lecture.md`).
5. Tests (commande, décompte exact, durée si disponible).
6. Mutations (non applicable, ou la raison réelle si tu en as lancé).
7. Protection de la branche par défaut (ce que tu as pu lire, ce que tu n'as pas pu lire).
8. Blocage éventuel et question éventuelle (une seule, précise).
9. ACTION HUMAINE REQUISE (une seule action, ou « aucune »).
