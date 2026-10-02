// === DEBUT_LANGAGE_REGISTRE ===
// v0.38.0 — DÉCISION CHATGPT « LOT B2 : ACTION INTERNE APPRISE » (02/10). Le REGISTRE FERMÉ des
// opérations internes que Naissance a le droit d'invoquer via une action apprise (action.js).
//
// SÉCURITÉ ARCHITECTURALE, ABSOLUE (décision explicite) : une donnée APPRISE (voir action.js) ne
// porte jamais qu'une CLÉ STABLE de cet objet (une chaîne choisie par le CODE, jamais dérivée d'une
// donnée apprise), jamais un nom de fonction JavaScript, jamais un chemin de module, jamais un appel
// à eval. CAPACITES est un objet LITTÉRAL, codé à la main, gelé (Object.freeze, y compris chaque
// entrée) : rien, nulle part, ne peut y ajouter ou retirer une capacité à l'exécution. Ajouter une
// future capacité est un changement DE CE FICHIER (une nouvelle entrée), jamais une conséquence d'un
// apprentissage.
//
// Chaque entrée déclare :
//   - roles    : l'ensemble EXACT des noms de rôle que cette capacité attend (action.js refuse toute
//                action dont les rôles nommés ne correspondent pas exactement — ni manquant, ni en
//                trop, jamais une correction silencieuse d'un nom mal orthographié).
//   - invoquer : la fonction réellement appelée, (esprit, argumentsNommes) -> résultat. Un simple
//                adaptateur vers la primitive réelle (confrontation.js, inchangée) : la traduction
//                entre rôles nommés et la forme exacte attendue par la fonction réelle vit ICI,
//                jamais dans action.js (qui reste générique, ignorant de ce que « confrontation »
//                signifie), ni dans confrontation.js (qui reste ignorant de l'existence d'un
//                apprentissage).
//   - representer : (résultat) -> texte, MINIMAL et NEUTRE (décision ChatGPT « LOT B3 : RACCORD
//                CONVERSATIONNEL », 02/10 : « ne construis pas une génération linguistique complexe
//                pour embellir ces quatre états »). Même raison d'être que `invoquer` ci-dessus : la
//                forme exacte du résultat d'UNE capacité précise (ici, { etat, valeurA, valeurB } --
//                confrontation.js) n'est connue nulle part ailleurs que son adaptateur dans CE
//                fichier -- jamais dans action.js (générique), jamais dans ecran.js (qui se contente
//                d'appeler capacite.representer(resultat), quelle que soit la capacité invoquée).
//
// POINT OUVERT, explicitement signalé (pas réglé ici) : confronterToutes() (confrontation.js) attend
// une LISTE de relations (`relations`), alors que l'extraction B1 ne fournit qu'UN jeton par position
// variable. La capacité ci-dessous n'expose donc que confronter() — comparaison sur UNE SEULE
// relation, nommée symétriquement des deux côtés (cheminA = cheminB = [relation]), le cas direct déjà
// illustré dans le cadrage de B (« Compare zalpha et zbeta sur zcouleur »). Exposer confronterToutes()
// (plusieurs relations à la fois) demanderait un rôle de type LISTE que B1/B2 ne produisent pas
// aujourd'hui — une vraie question architecturale, remontée séparément, jamais bricolée ici.
import { confronter } from './confrontation.js';
import { proprietesCommunes, sujetsAvec } from './selection.js';
import { deduire } from './deduction.js';

const MOTS_ETAT_CONFRONTATION = Object.freeze({
  egal: 'égal', different: 'différent', inconnu: 'inconnu', conflit: 'conflit',
});

// v0.41 — DÉCISION CHATGPT « PROCHAINE CAPACITÉ GÉNÉRALE DE RAISONNEMENT » (02/10) : deux nouvelles
// entrées, toutes deux adossées à selection.js (ÉNUMÉRATION des faits déjà connus, jamais une liste
// fournie par la conversation). Mêmes formes de rôles, simples, à un seul jeton, que « confrontation »
// ci-dessus -- ZÉRO changement nécessaire à B1 (extraction.js) ou B2 (action.js) : une liste de
// relations n'est jamais demandée au texte appris, le point ouvert documenté plus haut (confirmation
// ci-dessous) reste donc entier pour confronterToutes() elle-même, mais n'empêche pas ces deux
// capacités d'exister.
function fmtListe(liste) {
  return liste.length ? liste.map((l) => l.relation).join(', ') : 'aucune';
}

export const CAPACITES = Object.freeze({
  confrontation: Object.freeze({
    roles: Object.freeze(['sujetA', 'sujetB', 'relation']),
    invoquer: (esprit, { sujetA, sujetB, relation }) => confronter(esprit, {
      sujetA, cheminA: [relation], sujetB, cheminB: [relation],
    }),
    representer: (resultat) => `Résultat (confrontation locale) : ${MOTS_ETAT_CONFRONTATION[resultat.etat] || resultat.etat}.`,
  }),
  proprietesCommunes: Object.freeze({
    roles: Object.freeze(['sujetA', 'sujetB']),
    invoquer: (esprit, { sujetA, sujetB }) => proprietesCommunes(esprit, { sujetA, sujetB }),
    // MINIMAL et NEUTRE (même principe que confrontation ci-dessus, LOT B3) : les noms de relation
    // seulement, jamais une phrase construite autour des valeurs.
    representer: (resultat) => `Résultat (propriétés communes, local) : identiques (${fmtListe(resultat.identiques)}) ;`
      + ` différentes (${fmtListe(resultat.differentes)}) ;`
      + ` uniquement sujetA (${fmtListe(resultat.uniquementA)}) ;`
      + ` uniquement sujetB (${fmtListe(resultat.uniquementB)}).`,
  }),
  recherche: Object.freeze({
    roles: Object.freeze(['relation', 'valeur']),
    invoquer: (esprit, { relation, valeur }) => ({ sujets: sujetsAvec(esprit, { relation, valeur }) }),
    representer: (resultat) => (resultat.sujets.length
      ? `Résultat (recherche locale) : ${resultat.sujets.join(', ')}.`
      : 'Résultat (recherche locale) : aucun sujet trouvé.'),
  }),
  // v0.42 — DÉCISION CHATGPT « DÉDUCTION DÉTERMINISTE MULTI-FAITS » (02/10) : adossée à deduction.js
  // (lui-même une réutilisation stricte, sans modification, de regles.js + selection.js — voir
  // l'en-tête de deduction.js). Mêmes formes de rôles simples, à un seul jeton, que les capacités
  // ci-dessus -- ZÉRO changement nécessaire à B1/B2. MINIMAL et NEUTRE (même principe que les
  // capacités ci-dessus, LOT B3) : les trois états d'appliquerRegles() restitués tels quels, jamais
  // un choix arbitraire masqué derrière une formulation.
  deduction: Object.freeze({
    roles: Object.freeze(['sujet', 'role']),
    invoquer: (esprit, { sujet, role }) => deduire(esprit, { sujet, role }),
    representer: (resultat) => {
      if (resultat.conflit) return 'Résultat (déduction locale) : conflit entre plusieurs règles également spécifiques.';
      if (resultat.resultat === null) return 'Résultat (déduction locale) : aucune règle applicable.';
      return `Résultat (déduction locale) : ${resultat.resultat}.`;
    },
  }),
});
// === FIN_LANGAGE_REGISTRE ===
