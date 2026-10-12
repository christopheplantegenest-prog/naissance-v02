// === DEBUT_LANGAGE_IDENTITE_EPISODE ===
// v0.63.95 — IDENTITÉ D'UN ÉPISODE, PARTAGÉE (décision ChatGPT « DÉCISION MINI-DESIGN CO-COUVERTURES », 12/10/2026).
// Définition EXTRAITE telle quelle de contexte-prospectif.js (où elle était une constante locale depuis v0.63.72), pour être partagée sans
// être redéfinie par la primitive de co-couverture. Rien n'est changé : même expression, même ordre, aucune validation ajoutée (l'appelant
// fournit un épisode bien formé, sortie de la vue des épisodes).
//
// identiteEpisode(episode) -> [depart, arrivee, ...vers de chaque étape]
//   Les identités persistées des extrémités et des données intermédiaires : deux occurrences distinctes d'un même échange ont des identités
//   distinctes (réceptions, exécutions différentes). Chemin d’identité à segments chaîne.
// PURETÉ : aucune écriture, aucun état ; l'épisode n'est jamais modifié ; un tableau neuf à chaque appel.
export const identiteEpisode = (episode) => [episode.depart, episode.arrivee, ...episode.chemin.map((e) => e.vers)];
// === FIN_LANGAGE_IDENTITE_EPISODE ===
