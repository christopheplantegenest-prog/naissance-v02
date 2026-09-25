# État du robot de livraison

Fichier écrit par le robot. Ne pas le modifier.

## Dernier colis

✅ 2026-09-25 13:49 UTC — **v0.17.2** — Segmentation + portee : les mots interrogatifs (quel, quelle, combien, qui, ou, comment) decoupent la phrase en groupes, le dernier groupe avec interrogatif est retenu pour chercher le sujet et la rel (naissance-colis-0_17_2.zip)

Version en ligne : **0.17.2**

## Historique

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
- ✅ 2026-09-20 21:15 UTC — **v0.11.0** — Canal pedagogique : une lecon a forme fixe devient une regle interne apres confirmation ; correctif de normalisation accent/casse dans le moteur de regles (naissance-colis-0.11.0.zip)
- ✅ 2026-09-20 19:13 UTC — **v0.10.2** — Correctif : la base du langage n'avait jamais recu ses deux nouvelles tables sur un appareil deja utilise en v0.9.0 (numero de version oublie) (naissance-colis-0.10.2.zip)
- ✅ 2026-09-20 17:22 UTC — **v0.10.1** — Correctif : une question ne reste plus jamais sans reponse en silence ; deux facons de dire a egale specificite ne sont plus choisies au hasard (naissance-colis-0.10.1.zip)
- ✅ 2026-09-20 17:03 UTC — **v0.10.0** — Regles linguistiques comme donnees : proprietes, moteur de regles generique, composition et transfert d'un choix grammatical jamais enseigne directement (naissance-colis-0.10.0.zip)
- ✅ 2026-09-20 15:55 UTC — **v0.9.0** — Prototype du langage propre a Naissance : comprendre, repondre et apprendre sans modele de langage, dans une base isolee (naissance-colis-0.9.0.zip)
- ✅ 2026-09-20 06:34 UTC — **v0.8.0** — Banc comparatif de solutions : sept façons d'utiliser le même LFM2, sur une mémoire de test isolée (naissance-colis-0.8.0.zip)
- ✅ 2026-09-19 20:53 UTC — **v0.7.7** — Correctif du classificateur : le premier mot d'une phrase n'est plus pris pour une invention géographique ; rapports toujours recalculés depuis les réponses brutes (naissance-colis-0.7.7.zip)
- ✅ 2026-09-19 20:29 UTC — **v0.7.6** — Grand banc : copie des données brutes expérience par expérience (le tout d'un coup était trop long à envoyer) (naissance-colis-0.7.6.zip)
- ✅ 2026-09-19 20:02 UTC — **v0.7.5** — Correctif du grand banc : substitution de {personne} réparée, garde anti-gabarit, campagne corrigée séparée de l'ancienne (naissance-colis-0.7.5.zip)
- ✅ 2026-09-19 15:20 UTC — **v0.7.4** — Grand banc autonome de diagnostic : six expériences contrôlées, journal persistant séparé, reprise après fermeture (naissance-colis-0.7.4.zip)
- ✅ 2026-09-19 09:45 UTC — **v0.7.3** — Diagnostic approfondi (2) : classement corrigé, trace de sélection visible, graine fixable, conditions expérimentales identité/3e personne (naissance-colis-0.7.3.zip)
- ✅ 2026-09-19 05:16 UTC — **v0.7.2** — Diagnostic approfondi du moteur local : protocoles d'épreuves, souvenirs imposés, classement des erreurs (naissance-colis-0.7.2.zip)
- ✅ 2026-09-18 17:40 UTC — **v0.7.1** — Diagnostic du moteur local : contexte court, souvenirs présentés simplement, mesures détaillées et banc d'essai intégré (naissance-colis-0.7.1.zip)
- ✅ 2026-09-18 12:24 UTC — **v0.7.0** — Premier moteur local (LFM2-350M Q4_0 via llama.cpp, lecture seule) et modes local/externe (naissance-colis-0.7.0.zip)
- ❌ 2026-09-18 12:12 UTC — colis **naissance-colis-0.7.0.zip** refusé — la commande « /home/runner/work/naissance-v02/naissance-v02/android/gradlew assembleRelease --no-daemon » a échoué (code 1)
- ❌ 2026-09-17 11:00 UTC — colis **naissance-colis-0.7.0.zip** refusé — la commande « /home/runner/work/naissance-v02/naissance-v02/android/gradlew assembleRelease --no-daemon » a échoué (code 1)
