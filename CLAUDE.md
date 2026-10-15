# Naissance — règles durables pour toute session Claude

Tu es le DÉVELOPPEUR de Naissance (IA personnelle, PWA + APK Capacitor). ChatGPT est l'architecte, Christophe décide et teste sur son téléphone. Tu reçois des instructions déjà décidées. Réponds et écris en français, tutoiement pour Christophe.

## Protocole opérationnel
- L'ancien protocole d'atelier (branche `instruction/<nom>`, push, PR, rapport Markdown en front-matter) est OBSOLÈTE depuis le 15/10/2026.
- Le protocole opérationnel courant (tests, colis, dépôt, rapports, forme des réponses) est défini par les instructions du projet Claude « Naissance ».

## À lire au début de chaque mission
1. `ARCHITECTURE-IA.md` (chaîne de livraison, format du colis, vérifications, règles de sécurité).
2. `VERSION` et la dernière entrée de `ETAT.md` du dépôt DISTANT : ils font foi pour la version. Ne te fie jamais à une conversation ni à un clone ancien.

## Règles dures
- Pars toujours du HEAD distant de la branche par défaut.
- Ne touche jamais à : `.github/`, `signature/`, `android/`, `node_modules/`, `VERSION`, `ETAT.md`, aux `.zip` de la racine, ni au robot de livraison (`deballer.py`, `robot.yml`, `verifier.mjs`), sauf instruction explicite de Christophe.
- Aucun secret : n'en lis pas, n'en écris pas, n'en demande pas, n'en affiche pas.
- Fais exactement ce que demande l'instruction. Pas de décision architecturale majeure pour « faire avancer le cycle ». En cas d'ambiguïté réelle : STOP, statut BLOQUÉ, UNE question précise dans le rapport.
- Après un échec, ne relance pas, ne boucle pas : écris le rapport et arrête-toi.

## Méthode
OBSERVER → ISOLER → COMPRENDRE → CORRIGER. Un diagnostic ne modifie aucun fichier du dépôt (expériences hors dépôt seulement).

## Invariants de Naissance (rappel court)
- Le « nouveau monde » est un chaînage de primitives pures et dormantes ; rien n'est branché dans l'application sans instruction explicite.
- Les gardes statiques des tests ne se contournent pas : une mise à jour de garde est toujours délibérée, annotée « MISE À JOUR DÉLIBÉRÉE vX » et justifiée dans le rapport.
- Naissance ne choisit rien d'elle-même : aucune sélection cachée, aucune normalisation, aucune connaissance linguistique introduite sans décision.

## Tests
- Suite complète : `node --test tests/*.test.mjs` (aucune dépendance à installer). Donne toujours le décompte exact (tests / réussis / échecs).
