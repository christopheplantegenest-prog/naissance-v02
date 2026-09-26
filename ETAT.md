# État du robot de livraison

Fichier écrit par le robot. Ne pas le modifier.

## Dernier colis

✅ 2026-09-26 16:01 UTC — **v0.18.1** — Constat de variation d'etat par motif (motifsAvecVariationDEtat) : un motif deja constate par le laboratoire est desormais annote 'variation d'etat : oui/non', a partir des donnees deja produites par  (naissance-colis-0_18_1.zip)

Version en ligne : **0.18.1**

## Historique

- ✅ 2026-09-26 16:01 UTC — **v0.18.1** — Constat de variation d'etat par motif (motifsAvecVariationDEtat) : un motif deja constate par le laboratoire est desormais annote 'variation d'etat : oui/non', a partir des donnees deja produites par  (naissance-colis-0_18_1.zip)
- ✅ 2026-09-26 14:17 UTC — **v0.18.0** — Sauvegarde complète mémoire+langage, expériences B1, induction depuis expériences, motifs récurrents et répartition par état ; instrumentation diagnostique temporaire de l'import (à retirer) (naissance-colis-0_18_0.zip)
- ✅ 2026-09-26 13:06 UTC — **v0.17.15** — Sauvegarde complete de Naissance (memoire + langage), format versionne, import atomique par base + rollback -- BUILD DE TEST, NON VALIDE (naissance-colis-0_17_15.zip)
- ❌ 2026-09-26 12:16 UTC — colis **naissance-colis-0_17_14.zip** refusé — version 0.17.14 pas plus grande que la version actuelle 0.17.14
- ✅ 2026-09-26 12:08 UTC — **v0.17.14** — Chronologie brute des etats de comprehension par motif (fonction soeur chronologieMotifs) -- BUILD DE TEST, NON VALIDE (naissance-colis-0_17_14.zip)
- ✅ 2026-09-26 11:39 UTC — **v0.17.13** — BUILD DE TEST, NON VALIDE -- Repartition des motifs par etat de comprehension. Nouvelle fonction pure repartirMotifsParEtat(motifs, etatParId) dans app/langage/induction.js, fonction SOEUR de repererM (naissance-colis-0_17_13.zip)
- ✅ 2026-09-26 10:00 UTC — **v0.17.12** — BUILD DE TEST, NON VALIDE -- Conservation du vecu reel PARTIEL/INCOMPRIS dans B1. Quand une vraie question ('?') produit une tentative langage locale PARTIEL ou INCOMPRIS, ce tour est desormais conser (naissance-colis-0_17_12.zip)
- ✅ 2026-09-26 08:28 UTC — **v0.17.11** — BUILD DE TEST, NON VALIDE -- B3a : reperage neutre de motifs recurrents. induction.js gagne repererMotifs(experiences, {lexique}) (pure, isolee, reutilise candidatsEvalues() existant). Laboratoire : n (naissance-colis-0_17_11.zip)
- ✅ 2026-09-26 06:40 UTC — **v0.17.9** — BUILD DE TEST, NON VALIDE -- pont experiences B1 -> induire() (preparerEntreesInduction, pur, lecture seule) + interface telephone minimale pour selectionner des experiences comme positives/negatives  (naissance-colis-0_17_9.zip)
- ✅ 2026-09-26 05:52 UTC — **v0.17.8** — BUILD DE TEST, NON VALIDE -- B1 (conservation d'experience) + A1 (pont langage extrait, testable) + A2 (B1 branche sur le vrai pont) + diagnostic provisoire lecture seule 'Voir les experiences' dans l (naissance-colis-0_17_8.zip)
- ✅ 2026-09-25 20:16 UTC — **v0.17.7** — Banc d'essai provisoire du pont induction dans le laboratoire : positifs/negatifs/signification, rapport, Confirmer/Annuler (plusieurs hypotheses disjointes confirmees ensemble, vrai conflit = confirm (naissance-colis-0_17_7.zip)
- ✅ 2026-09-25 19:55 UTC — **v0.17.6** — Premier pont induction -> comprehension : table generale gabaritsTypes (gabarit(s) -> signification libre), comprendre() recoit les gabarits appris, apprendreGabaritType() sur le modele d'apprendreReg (naissance-colis-0_17_6.zip)
- ✅ 2026-09-25 19:20 UTC — **v0.17.5** — Moteur d'induction (analyse uniquement) : induire() et passeFinale() dans un nouveau fichier isole, aucun branchement a comprendre()/repondre(), aucune ecriture automatique de connaissance, aucun chan (naissance-colis-0_17_5.zip)
- ✅ 2026-09-25 17:53 UTC — **v0.17.4** — Moteur generique de gabarits (correspondance de sous-sequences {mot}/{role}) + troisieme type VERIFICATION : est-ce que, est-il/elle, es-tu, sont-ils, peut-elle, veux-tu, tous representes comme des do (naissance-colis-0_17_4.zip)
- ❌ 2026-09-25 17:40 UTC — colis **naissance-colis-0_17_5.zip** refusé — vérification échouée : tests automatiques en échec (voir tests.txt)
- ✅ 2026-09-25 14:20 UTC — **v0.17.3** — Type d'enonce, premiere marche : comprendre() expose type = QUESTION_INFORMATION ou AFFIRMATION, calcule sur le groupe pertinent v0.17.2 (presence d'un mot interrogatif) ; champ mort dans cette versio (naissance-colis-0_17_3.zip)
- ✅ 2026-09-25 13:49 UTC — **v0.17.2** — Segmentation + portee : les mots interrogatifs (quel, quelle, combien, qui, ou, comment) decoupent la phrase en groupes, le dernier groupe avec interrogatif est retenu pour chercher le sujet et la rel (naissance-colis-0_17_2.zip)
- ✅ 2026-09-25 12:28 UTC — **v0.17.1** — Coherence des identifiants (faits, sujets, prenoms) : un fait tape avec accent ou majuscule (« telephone ») est maintenant retrouve, sans migration des donnees existantes ; conflit detecte et signale  (naissance-colis-0_17_1.zip)
- ✅ 2026-09-21 20:53 UTC — **v0.17.0** — Le cours : une lecon groupee (bloc texte avec Decor, Exercice, Sonde) enseignee puis testee par des exercices qui passent par repondre() du vrai moteur, sans aucun LLM ; Decor strictement ephemere ; r (naissance-colis-0_17_0.zip)
- ✅ 2026-09-21 19:24 UTC — **v0.16.0** — Enseignement naturel, premiere marche : « Apprends que ma couleur est rouge. » (sujet moi, est/sont, relation connue, valeur litterale, refus clair hors cadre, aucun Gemini, meme apercu + Confirmer/An (naissance-colis-0_16_0.zip)
- ✅ 2026-09-21 16:37 UTC — **v0.15.3** — Correctif : langage/ecran.js expose assurerEsprit et ecrireConnaissance (esprit partage entre le laboratoire et le pont conversationnel) ; sans cela « Apprends : ... » echouait apres Confirmer et tout (naissance-colis-0_15_3.zip)
- ✅ 2026-09-21 15:57 UTC — **v0.15.2** — Correctif : les boutons Confirmer/Annuler du pont conversationnel (Apprends : ...) s'affichent enfin dans la bulle ; conversation/ecran.js ne gerait pas la confirmation renvoyee par main.js (naissance-colis-0_15_2.zip)
- ✅ 2026-09-21 15:36 UTC — **v0.15.1** — Correctif : le pont conversationnel ne repond localement que sur une phrase ressemblant a une question (point d interrogation), jamais sur une affirmation ordinaire meme si comprendre() y trouve un et (naissance-colis-0.15.1.zip)
- ✅ 2026-09-21 11:37 UTC — **v0.14.3** — Les facons de dire deviennent le cinquieme type du canal pedagogique : gabarit fourni tout fait (jamais reconstruit depuis un exemple), aucune liste de roles fermee, meme circuit que les quatre autres (naissance-colis-0.14.3.zip)
- ✅ 2026-09-21 11:08 UTC — **v0.14.2** — Chantier 2 : un patron peut declarer lui-meme les roles dont il a besoin ({xxx} devient litteralement un role cherche en regles), sans que ce nom apparaisse dans le code (naissance-colis-0.14.2.zip)
- ✅ 2026-09-21 10:11 UTC — **v0.14.0** — Retrait cible des connaissances : oublier un seul fait, une propriete, une relation ou desactiver une seule regle, sans cascade et sans reinitialiser le laboratoire (naissance-colis-0.14.0.zip)
- ✅ 2026-09-21 05:11 UTC — **v0.13.2** — Correctif racine : reapprendre une facon de dire deja connue ne cree plus jamais de doublon silencieux (naissance-colis-0.13.2.zip)
- ✅ 2026-09-21 05:02 UTC — **v0.13.1** — Correctif : retirer UNE SEULE facon de dire, sans devoir tout lui faire oublier, pour resoudre un vrai conflit entre deux patrons generaux herites de sessions precedentes (naissance-colis-0.13.1.zip)
- ✅ 2026-09-21 04:48 UTC — **v0.13.0** — Premier enseignement reel par Gemini : professeur ponctuel du canal pedagogique existant, jamais la voix permanente de Naissance (naissance-colis-0.13.0.zip)
- ✅ 2026-09-20 21:50 UTC — **v0.12.0** — Canal pedagogique generalise a quatre types (relation, fait, propriete, regle) : une lecon devient une connaissance interne apres confirmation, via les mecanismes d'apprentissage existants (naissance-colis-0.12.0.zip)
