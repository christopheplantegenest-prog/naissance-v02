# État du robot de livraison

Fichier écrit par le robot. Ne pas le modifier.

## Dernier colis

✅ 2026-10-02 12:16 UTC — **v0.33.0** — Decision ChatGPT 'DECISION APRES DIAGNOSTIC COMPOSITION' (A+C dans un meme chantier). ETAPE 1 -- fiabiliser trouverRelation() (comprendre.js) : un mot structurel/grammatical (possessifs, pronoms, VERB (naissance-colis-0_33_0.zip)

Version en ligne : **0.33.0**

## Historique

- ✅ 2026-10-02 12:16 UTC — **v0.33.0** — Decision ChatGPT 'DECISION APRES DIAGNOSTIC COMPOSITION' (A+C dans un meme chantier). ETAPE 1 -- fiabiliser trouverRelation() (comprendre.js) : un mot structurel/grammatical (possessifs, pronoms, VERB (naissance-colis-0_33_0.zip)
- ✅ 2026-09-27 17:37 UTC — **v0.32.0** — Decision ChatGPT 'APPRENTISSAGE DU RETRAIT D'AFFIXES', suite au diagnostic sur l'echec de l'enseignement inverse 'zamalotu => malo / zaturotu => turo' (intention 'retirez'), qui echouait malgre le suc (naissance-colis-0_32_0.zip)
- ✅ 2026-09-27 17:09 UTC — **v0.31.0** — Decision ChatGPT 'EXTENSION GENERALE PREFIXE + X + SUFFIXE', suite au diagnostic sur l'echec de l'enseignement 'malo => zamalotu / turo => zaturotu' (intention 'kora'). Cause exacte trouvee : relation (naissance-colis-0_31_0.zip)
- ✅ 2026-09-27 16:30 UTC — **v0.30.1** — Correctif ChatGPT 'PRESERVER LES SQUELETTES DISTINCTS', suite a la limite decouverte pendant le TDD de v0.30.0 : deux formulations enseignees separement sous une meme intention pouvaient partager exac (naissance-colis-0_30_1.zip)
- ✅ 2026-09-27 16:07 UTC — **v0.30.0** — Chantier 'RACCORDEMENT COMPRENSION -> INTENTION -> TRANSFORMATION' (decision ChatGPT du 27/09/2026, suite a v0.29). Naissance reconnait desormais elle-meme une phrase NATURELLE, jamais tapee avant, SA (naissance-colis-0_30_0.zip)
- ✅ 2026-09-27 14:33 UTC — **v0.29.0** — Chantier 'SELECTION CONTEXTUELLE PAR INTENTION' (decision ChatGPT du 27/09/2026, suite a l'observation reelle : chat/chien => chats/chiens et petit/grand => petite/grande, toutes deux legitimes et cer (naissance-colis-0_29_0.zip)
- ✅ 2026-09-27 14:01 UTC — **v0.28.1** — Correctif immediat sur la v0.28.0 (decision ChatGPT 'STOP ARCHITECTURAL : LOT 1 CASSE UNE COMPOSITION DEJA VALIDEE', trouve pendant la validation telephone du chantier GRAND DIAGNOSTIC). Symptome : ap (naissance-colis-0_28_1.zip)
- ✅ 2026-09-27 13:34 UTC — **v0.28.0** — Chantier 'GRAND DIAGNOSTIC' (decision ChatGPT du 27/09/2026, suite au rapport A-H) : trois lots livres ensemble. LOT 1 (anti-sur-generalisation) : une transformation dont un litteral insere coincide,  (naissance-colis-0_28_0.zip)
- ✅ 2026-09-27 12:45 UTC — **v0.27.0** — Extension du chantier Eduquer plutot que programmer (diagnostic du 27/09 sur Tu chantes => Est-ce que tu chantes ?, Il dort => Est-ce qu'il dort ?) : la primitive de transformation n'apprenait que des (naissance-colis-0_27_0.zip)
- ✅ 2026-09-27 12:14 UTC — **v0.26.0** — Eduquer plutot que programmer : nouvelle capacite generale d'APPRENTISSAGE DE TRANSFORMATIONS a partir de plusieurs exemples entree => sortie (aucun code specifique a la grammaire francaise, aucune ne (naissance-colis-0_26_0.zip)
- ❌ 2026-09-27 11:46 UTC — colis **naissance-colis-0_26_0.zip** refusé — vérification échouée : tests automatiques en échec (voir tests.txt)
- ✅ 2026-09-27 10:54 UTC — **v0.25.0** — Proposition spontanee d'apprentissage : apres chaque nouvelle experience de conversation, Naissance examine seule (sans ouvrir le labo) si le vecu recent contient une regularite suffisamment nette et  (naissance-colis-0_25_0.zip)
- ✅ 2026-09-27 09:29 UTC — **v0.24.0** — Raccord experiences -> induction : le vecu reel (conversations deja enregistrees) alimente maintenant induire() via un motif repere par repererMotifs(). Nouveau petit outil dans le labo (numero de mot (naissance-colis-0_24_0.zip)
- ✅ 2026-09-27 08:56 UTC — **v0.23.0** — Fermeture de la chaine apprentissage -> comportement : une signification apprise (induction/gabaritsTypes) peut desormais produire une reponse enseignee dans repondre(), via un Fait ordinaire (sujet = (naissance-colis-0_23_0.zip)
- ✅ 2026-09-27 08:13 UTC — **v0.22.0** — Sujets ET relations connues a plusieurs mots (fin du chantier) : reconnaissance, ecriture des proprietes/patrons directs, plus de troncature au premier mot. Cas reel departement de la Charente / se si (naissance-colis-0_22_0.zip)
- ✅ 2026-09-27 06:28 UTC — **v0.21.1** — Correctif : les relations inédites proposées par Gemini dans un cours (« se situe en », « tourne autour de »...) n'étaient jamais enregistrées comme mots du lexique quand Gemini ne proposait que des l (naissance-colis-0.21.1.zip)
- ❌ 2026-09-27 06:16 UTC — colis **naissance-colis-0.21.1.zip** refusé — vérification échouée : tests automatiques en échec (voir tests.txt)
- ✅ 2026-09-27 05:44 UTC — **v0.21.0** — Assimilation d'un cours (Voie A) : prose libre -> Gemini decompose -> candidats revalides localement -> apercu -> validation globale (Cours : / Valide le cours.) -> ecriture via les primitives existan (naissance-colis-0.21.0.zip)
- ✅ 2026-09-26 21:06 UTC — **v0.20.1** — Documentation seulement : jalon FONDATIONS DE L'APPRENTISSAGE fige dans ARCHITECTURE-IA.md (vision, methode, roles, boucle validee, limites, etat technique). Aucun code fonctionnel modifie. (naissance-colis-0_20_1.zip)
- ✅ 2026-09-26 20:43 UTC — **v0.20.0** — Fin des fondations : formation automatique des hypotheses sur jugement (plus de clic laboratoire requis) et exploitation d'une contradiction (reexamen automatique du vecu, hypothese plus precise si le (naissance-colis-0_20_0.zip)
- ✅ 2026-09-26 17:20 UTC — **v0.19.0** — Boucle d'apprentissage : hypotheses formees sur un jugement humain facultatif (correct/incorrect), attente posee avant tout jugement, confrontation tracee. Comparaison du vecu (comparerMotifs) egaleme (naissance-colis-0_19_0.zip)
- ✅ 2026-09-26 16:01 UTC — **v0.18.1** — Constat de variation d'etat par motif (motifsAvecVariationDEtat) : un motif deja constate par le laboratoire est desormais annote 'variation d'etat : oui/non', a partir des donnees deja produites par  (naissance-colis-0_18_1.zip)
- ✅ 2026-09-26 14:17 UTC — **v0.18.0** — Sauvegarde complète mémoire+langage, expériences B1, induction depuis expériences, motifs récurrents et répartition par état ; instrumentation diagnostique temporaire de l'import (à retirer) (naissance-colis-0_18_0.zip)
- ✅ 2026-09-26 13:06 UTC — **v0.17.15** — Sauvegarde complete de Naissance (memoire + langage), format versionne, import atomique par base + rollback -- BUILD DE TEST, NON VALIDE (naissance-colis-0_17_15.zip)
- ❌ 2026-09-26 12:16 UTC — colis **naissance-colis-0_17_14.zip** refusé — version 0.17.14 pas plus grande que la version actuelle 0.17.14
- ✅ 2026-09-26 12:08 UTC — **v0.17.14** — Chronologie brute des etats de comprehension par motif (fonction soeur chronologieMotifs) -- BUILD DE TEST, NON VALIDE (naissance-colis-0_17_14.zip)
- ✅ 2026-09-26 11:39 UTC — **v0.17.13** — BUILD DE TEST, NON VALIDE -- Repartition des motifs par etat de comprehension. Nouvelle fonction pure repartirMotifsParEtat(motifs, etatParId) dans app/langage/induction.js, fonction SOEUR de repererM (naissance-colis-0_17_13.zip)
- ✅ 2026-09-26 10:00 UTC — **v0.17.12** — BUILD DE TEST, NON VALIDE -- Conservation du vecu reel PARTIEL/INCOMPRIS dans B1. Quand une vraie question ('?') produit une tentative langage locale PARTIEL ou INCOMPRIS, ce tour est desormais conser (naissance-colis-0_17_12.zip)
- ✅ 2026-09-26 08:28 UTC — **v0.17.11** — BUILD DE TEST, NON VALIDE -- B3a : reperage neutre de motifs recurrents. induction.js gagne repererMotifs(experiences, {lexique}) (pure, isolee, reutilise candidatsEvalues() existant). Laboratoire : n (naissance-colis-0_17_11.zip)
- ✅ 2026-09-26 06:40 UTC — **v0.17.9** — BUILD DE TEST, NON VALIDE -- pont experiences B1 -> induire() (preparerEntreesInduction, pur, lecture seule) + interface telephone minimale pour selectionner des experiences comme positives/negatives  (naissance-colis-0_17_9.zip)
