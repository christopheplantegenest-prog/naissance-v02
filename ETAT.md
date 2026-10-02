# État du robot de livraison

Fichier écrit par le robot. Ne pas le modifier.

## Dernier colis

✅ 2026-10-02 20:15 UTC — **v0.44.0** — Comparateur logique general : accessibilite transitive. Nouvelle capacite isolee du registre ferme (accessibilite.js) repondant a 'en suivant uniquement une relation donnee (operateur), repetee autant (colis-0_44_0.zip)

Version en ligne : **0.44.0**

## Historique

- ✅ 2026-10-02 20:15 UTC — **v0.44.0** — Comparateur logique general : accessibilite transitive. Nouvelle capacite isolee du registre ferme (accessibilite.js) repondant a 'en suivant uniquement une relation donnee (operateur), repetee autant (colis-0_44_0.zip)
- ✅ 2026-10-02 19:35 UTC — **v0.43.1** — CORRECTIF URGENT v0.43.0 - la nouvelle table 'liaisons' avait ete ajoutee sans incrementer VERSION_BASE (IndexedDB) : sur un appareil possedant deja la base (donc tous les appareils reels), le nouveau (naissance-colis-0_43_1.zip)
- ✅ 2026-10-02 19:26 UTC — **v0.43.0** — REFERENCABILITE ET REUTILISATION SCALAIRE DES RESULTATS - architecture B retenue par ChatGPT : le dernier resultat de CHAQUE capacite du registre est desormais conserve (en memoire, le temps de la ses (naissance-colis-0_43_0.zip)
- ✅ 2026-10-02 18:53 UTC — **v0.42.0** — DEDUCTION DETERMINISTE MULTI-FAITS - nouvelle capacite (deduction, deduction.js) qui applique les REGLES deja enseignees (appliquerRegles(), mecanisme existant depuis le tout debut du prototype) aux F (naissance-colis-0_42_0.zip)
- ✅ 2026-10-02 17:24 UTC — **v0.41.0** — PROCHAINE CAPACITE GENERALE DE RAISONNEMENT - nouvelle primitive interne : ENUMERATION des faits deja connus (selection.js), la ou jusqu'ici chaque mecanisme (composition, confrontation) exigeait deja (naissance-colis-0_41_0.zip)
- ✅ 2026-10-02 17:03 UTC — **v0.40.0** — RELATIONS REPETEES - la composition peut desormais parcourir un chemin qui emprunte plusieurs fois la MEME relation (ex. devient -> devient -> produit), pas seulement des relations distinctes. compren (naissance-colis-0_40_0.zip)
- ✅ 2026-10-02 16:30 UTC — **v0.39.0** — LOT B3 - raccord conversationnel de l'action interne apprise. CORRECTIF (colis precedent rejete : app/langage/connaissances.js reel sur GitHub etait reste a VERSION_BASE 7, LOT B2 - registre.js/action (naissance-colis-0_39_0b.zip)
- ❌ 2026-10-02 16:20 UTC — colis **naissance-colis-0_39_0.zip** refusé — vérification échouée : tests automatiques en échec (voir tests.txt)
- ✅ 2026-10-02 15:49 UTC — **v0.37.0** — LOT B1 — extraction pure. Nouveau module app/langage/confrontation.js NON touche ; nouveau fichier app/langage/extraction.js : construireSquelette()/extraireVariables(), reutilise strictement tokenise (naissance-colis-0_37_0.zip)
- ✅ 2026-10-02 15:30 UTC — **v0.36.0** — Primitive interne de confrontation (app/langage/confrontation.js) : confronterValeurs/confronter/confronterToutes, reutilise resoudreChemin(). Aucun raccord langage. 17 tests, suite 1034/1034 verte. (naissance-colis-0_36_0.zip)
- ❌ 2026-10-02 15:21 UTC — colis **naissance-colis-0_36_0.zip** refusé — action inconnue « appliquer »
- ✅ 2026-10-02 14:54 UTC — **v0.35.1** — Repackage de la v0.35.0 avec apk=true (la v0.35.0 avait été livrée par erreur sans APK, seulement en PWA) : aucun changement fonctionnel, mêmes fichiers (comprendre.js, tests/unification-relations-v03 (naissance-colis-0_35_1.zip)
- ❌ 2026-10-02 14:38 UTC — colis **naissance-colis-0_35_0.zip** refusé — version 0.35.0 pas plus grande que la version actuelle 0.35.0
- ✅ 2026-10-02 14:30 UTC — **v0.35.0** — Unification de la détection des relations (comprendre.js) : trouverRelation() et relationsNommeesDistinctes() partagent désormais un seul mécanisme de recherche de séquence (sequencesNommeesPresentes) (naissance-colis-0_35_0.zip)
- ✅ 2026-10-02 13:21 UTC — **v0.34.0** — Decision ChatGPT 'CHANTIER v0.34.0' -- trois lots corrigeant des limitations STRUCTURELLES reperees par le diagnostic automatise post-v0.33 (pas de nouvelles regles francaises au cas par cas). LOT 1 - (naissance-colis-0_34_0.zip)
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
