// === DEBUT_LANGAGE_COMPRENDRE ===
// COMPRENDRE : transformer une phrase en intention structurée.
// Entièrement déterministe : aucun appel à LFM2, aucun hasard. La même phrase donne toujours
// le même résultat, et on peut toujours expliquer pourquoi.
//
// ATTENTION — découpage PROPRE à ce module, volontairement différent de motsCles()
// (memoire/selection.js) : ici on GARDE les mots d'une ou deux lettres et les mots « vides ».
// « mon » et « ton » ne sont pas du bruit : ce sont eux qui disent de QUI on parle, et les
// confondre est exactement le défaut qu'on cherche à ne plus reproduire.

import { ROLES, LEXIQUE_DEPART, GABARITS_VERIFICATION_DEPART } from './bagage.js';

// Découpe en mots en conservant tout ce qui a du sens. L'apostrophe sépare (« j'habite » → j, habite)
// car elle cache souvent un pronom. Les accents sont retirés pour comparer, la casse ignorée.
export function decouper(phrase) {
  return String(phrase || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, "'")
    .split(/[^a-z0-9']+/)
    .flatMap((m) => m.split("'"))
    .filter(Boolean);
}

// v0.22 — DÉCISION CHATGPT « SUJETS CONNUS À PLUSIEURS MOTS » : un sujet réellement appris peut
// être composé de PLUSIEURS mots (« département de la Charente »). sujetsConnus/prenomsConnus
// contiennent déjà la forme canonique COMPLÈTE (canoniser(sujet), jamais découpée -- voir canon.js
// et esprit.js), donc chercher un sujet CONNU dans la phrase revient à chercher, parmi toutes les
// séquences CONTIGUËS de `mots`, laquelle (une fois rejointe par un simple espace) égale l'une des
// valeurs connues. Règle déterministe en cas de chevauchement : la correspondance connue la PLUS
// LONGUE l'emporte (une préférence purement syntaxique, jamais un score de confiance ni une
// notion d'importance) ; si plusieurs séquences DE MÊME longueur maximale mais de valeurs
// DIFFÉRENTES correspondent toutes deux, c'est une ambiguïté réelle : on NE DEVINE PAS, on rend
// « aucune séquence » (jamais un choix arbitraire dépendant de l'ordre d'un Set ou d'IndexedDB).
// LIMITE CONNUE, documentée plutôt que masquée (tests/sujets-composes.test.mjs, test 1) : un sujet
// contenant une apostrophe ou un tiret (« la mer d'Olis ») n'est pas couvert -- decouper() sépare
// ces caractères en tokens distincts, alors que canoniser() (qui produit la forme stockée) les
// conserve dans le mot ; recoller les tokens par un simple espace ne peut alors jamais reproduire
// cette forme sans inventer une troisième définition de « même texte ».
// v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES », étape 1 : factorisation du cœur de
// l'ancienne trouverSequenceConnue() (comportement et résultat STRICTEMENT inchangés pour tout appel
// sans options) pour que trouverRelation() (plus bas) puisse, en plus, EXCLURE certains mots d'un
// segment d'UN SEUL token (voir exclureSegmentUnique) et lire le DÉTAIL de l'ambiguïté éventuelle
// (candidats, pas seulement « trouvé ou non ») -- jamais une seconde logique de recherche de séquence.
function trouverSequenceConnueDetail(mots, ensembles, { exclureSegmentUnique } = {}) {
  let meilleureLongueur = 0;
  let meilleure = null;
  // v0.63.1 — PROVENANCE : position (indice de début dans `mots`) de la PREMIÈRE occurrence de la séquence
  // retenue, relevée à l'instant exact où `meilleure` est choisie. Pure observation : aucune comparaison
  // ni aucun choix ne la lit.
  let debutMeilleure = -1;
  const valeursALaMeilleureLongueur = new Set();
  for (let debut = 0; debut < mots.length; debut += 1) {
    for (let fin = mots.length; fin > debut; fin -= 1) {
      const longueur = fin - debut;
      if (longueur === 1 && exclureSegmentUnique && exclureSegmentUnique(mots[debut])) continue;
      const segment = mots.slice(debut, fin).join(' ');
      if (!ensembles.some((e) => e.has(segment))) continue;
      if (longueur > meilleureLongueur) {
        meilleureLongueur = longueur;
        valeursALaMeilleureLongueur.clear();
        valeursALaMeilleureLongueur.add(segment);
        meilleure = segment;
        debutMeilleure = debut;
      } else if (longueur === meilleureLongueur) {
        valeursALaMeilleureLongueur.add(segment);
      }
      break; // la plus longue fin possible pour ce début est déjà trouvée : les plus courtes,
             // pour ce même début, ne peuvent jamais battre une longueur déjà égalée ailleurs.
    }
  }
  return { longueur: meilleureLongueur, candidats: valeursALaMeilleureLongueur, meilleure, debut: debutMeilleure };
}

// v0.63.1 — renvoie la séquence retenue AVEC sa position ({ valeur, debut, longueur }), ou null. Même décision
// qu'avant (aucune séquence, ou ambiguïté réelle -> null) : seule la position est ajoutée.
function trouverSequenceConnueAvecPosition(mots, ensembles) {
  const { longueur, candidats, meilleure, debut } = trouverSequenceConnueDetail(mots, ensembles);
  if (longueur === 0) return null;
  if (candidats.size > 1) return null; // ambiguïté réelle : jamais de choix arbitraire.
  return { valeur: meilleure, debut, longueur };
}

// Qui est le sujet de la question, d'après les petits mots ?
//   « ma couleur »  → moi (celui qui parle)
//   « ta couleur »  → naissance
//   « tu t'appelles » → naissance
//   sinon, si un prénom connu apparaît → cette personne
//   sinon, si un sujet déjà appris apparaît → ce sujet (v0.21, DÉCISION CHATGPT « DÉBLOQUER LA
//   RÉUTILISATION », Piste A : sujetsConnus est dérivé des connaissances RÉELLEMENT apprises —
//   voir esprit.js — jamais d'un mot simplement rencontré dans une phrase ; v0.22, étendu aux
//   sujets à plusieurs mots via trouverSequenceConnue() ci-dessus).
// v0.63.1 — PROVENANCE : renvoie { valeur, debut, longueur } (positions dans le tableau reçu), ou null. La
// DÉCISION est strictement celle d'avant : le PREMIER mot-personne rencontré l'emporte (les suivants ne sont
// jamais consultés), à défaut la séquence connue la plus longue (ambiguïté -> null).
function trouverSujetAvecPosition(mots, lexique, prenomsConnus, sujetsConnus) {
  for (let i = 0; i < mots.length; i += 1) {
    const e = lexique[mots[i]];
    if (!e) continue;
    if (possedeRole(e, ROLES.POSSESSIF_MOI) || possedeRole(e, ROLES.PRONOM_MOI)) return { valeur: 'moi', debut: i, longueur: 1 };
    if (possedeRole(e, ROLES.POSSESSIF_TOI) || possedeRole(e, ROLES.PRONOM_TOI)) return { valeur: 'naissance', debut: i, longueur: 1 };
  }
  return trouverSequenceConnueAvecPosition(mots, [prenomsConnus, sujetsConnus]);
}
// La valeur seule (utilisée par groupePertinent pour sa condition de fusion) : même résultat qu'avant v0.63.1.
function trouverSujet(mots, lexique, prenomsConnus, sujetsConnus) {
  const r = trouverSujetAvecPosition(mots, lexique, prenomsConnus, sujetsConnus);
  return r ? r.valeur : null;
}

// Quelle information est demandée ? Portée par un nom (« fils »), éventuellement à plusieurs mots
// (« se situe en »), ou par un verbe (« habites »).
// v0.22 — DÉCISION CHATGPT « CORRECTION GÉNÉRALE DES UNITÉS LINGUISTIQUES MULTI-MOTS » : DEUX
// mécanismes coexistent désormais, dans cet ordre, car ils couvrent deux situations réelles
// DIFFÉRENTES, aucune ne pouvant remplacer l'autre :
//   1. recherche de SÉQUENCE CONNUE (trouverSequenceConnue, la même primitive que pour le sujet)
//      dans relationsConnues : couvre le cas où le NOM de la relation, à un ou plusieurs mots, est
//      littéralement recopié dans la phrase (« population », mais aussi une relation composée
//      reprise mot pour mot) -- et c'est cette recherche qui permet le départage chevauchement
//      court/long et l'abstention en cas d'ambiguïté réelle (voir tests/relations-composees.test.mjs,
//      tests 5 et 6) ;
//   2. À DÉFAUT, le mot-DÉCLENCHEUR lexical de rôle RELATION (mécanisme déjà existant AVANT ce
//      chantier, restauré ici tel quel) : un mot du lexique (« se », déclaré via apprendreRelation)
//      IMPLIQUE une relation -- éventuellement composée, jamais tronquée depuis le correctif côté
//      écriture -- sans que cette relation soit recopiée mot pour mot dans la phrase. INDISPENSABLE
//      au cas réel « Où se situe le département de la Charente ? » : le français élide la
//      préposition finale de « se situe en » dans cette tournure -- seule une séquence « se situe
//      le » apparaît, jamais « se situe en » -- la recherche de séquence seule (1.) ne suffit donc
//      pas, exactement comme pour les VERBES et INTERROGATIFS ci-dessous, qui suivent le même
//      principe de déclenchement et restent inchangés.
// Les NOMS/RELATIONS passent avant les VERBES, et c'est important : dans « Comment s'appelle mon
// fils ? », le verbe « appelle » désigne le nom, mais l'information réellement demandée est « fils »
// (le fils de celui qui parle). Sans cette priorité, elle répondrait le prénom de Christophe
// au lieu de celui de son fils.
// v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES », étape 1 (fiabiliser trouverRelation) :
// un mot qui, PARTOUT AILLEURS dans le moteur, ne joue jamais le rôle de nom de relation (voir
// bagage.js : les possessifs/pronoms désignent toujours le SUJET, jamais l'information demandée ; un
// VERBE_CONJUGUE « sert UNIQUEMENT au moteur de gabarits ... jamais lu ailleurs » ; un PRONOM_3E «
// ne désigne NI moi NI naissance ») ne doit jamais, par simple coïncidence de graphie avec une
// relation enseignée par ailleurs (ex. une relation nommée littéralement « est »), être compté comme
// une occurrence de CETTE relation dans la phrase. Sans ce garde-fou, le mot grammatical « est » de
// « est-ce que » entre en collision avec la relation "est" d'un fait totalement sans rapport, et
// produit une ambiguïté qui n'existe que par accident de graphie (cas réel : « Est-ce qu'un pommier
// peut produire un fruit ? », avec une relation "est" et une relation "produire" toutes deux
// apprises par ailleurs).
// v0.34 — DÉCISION CHATGPT « CHANTIER v0.34.0 », LOT 1 : exportée pour qu'esprit.js (apprendreMot/
// apprendreRelation) puisse savoir, au moment d'écrire une entrée, quels rôles comptent comme
// « structurels » et doivent donc être CONSERVÉS plutôt qu'effacés -- une seule définition partagée,
// jamais une seconde liste qui pourrait diverger.
export const ROLES_JAMAIS_RELATION = new Set([
  ROLES.POSSESSIF_MOI, ROLES.POSSESSIF_TOI, ROLES.PRONOM_MOI, ROLES.PRONOM_TOI,
  ROLES.VERBE_CONJUGUE, ROLES.PRONOM_3E,
]);
// v0.34 — LOT 1 : une entrée lexicale peut désormais porter, en plus de son rôle ACTIF (`role` --
// celui qu'un nouvel apprentissage vient de lui donner), une liste `rolesConserves` de rôles
// STRUCTURELS hérités d'avant cet apprentissage (voir esprit.js, apprentissage cumulatif). Tout
// endroit qui doit reconnaître un rôle structurel consulte les DEUX -- jamais seulement `role` --
// via ce seul point de vérité, pour ne jamais diverger entre les différents appelants.
export function possedeRole(entree, role) {
  return !!(entree && (entree.role === role || (entree.rolesConserves && entree.rolesConserves.includes(role))));
}
function estMotStructurelNonRelationnel(mot, lexique) {
  const e = lexique[mot];
  if (!e) return false;
  if (ROLES_JAMAIS_RELATION.has(e.role)) return true;
  return !!(e.rolesConserves && e.rolesConserves.some((r) => ROLES_JAMAIS_RELATION.has(r)));
}

// Mêmes rôles que trouverRelation() ci-dessous consulte pour une relation PORTÉE PAR UN MOT (par
// opposition à une séquence littérale identique au nom de la relation) -- centralisé ici pour que
// relationsNommeesDistinctes() (chantier composition, plus bas) consulte exactement les mêmes rôles,
// jamais une liste séparée qui pourrait diverger.
const ROLES_PORTEURS_DE_RELATION = [ROLES.RELATION, ROLES.VERBE, ROLES.INTERROGATIF];

// v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES », étape 1 : PLUSIEURS mots distincts
// porteurs d'une relation DIFFÉRENTE (mécanisme de secours, ci-dessous) ne doivent jamais être
// départagés en choisissant arbitrairement le premier rencontré dans l'ordre de la phrase -- c'était
// le défaut avant ce chantier, et il pouvait renvoyer une relation CONFIANTE mais non voulue dès
// qu'une phrase nommait deux relations connues. Même garde-fou qu'au mécanisme par séquence :
// ambiguïté réelle → abstention explicite, jamais de choix arbitraire.
// v0.63.1 — PROVENANCE : renvoie les mots porteurs d'une relation POUR CE RÔLE, avec leur position
// ({ debut, relation }, dans l'ordre de la phrase). La décision (ensemble des relations distinctes) est
// exactement celle d'avant : seule la position de chaque porteur est conservée en plus.
function motsPorteursDeRelation(mots, lexique, role) {
  const porteurs = [];
  for (let i = 0; i < mots.length; i += 1) {
    const e = lexique[mots[i]];
    if (e && e.relation && e.role === role) porteurs.push({ debut: i, relation: e.relation });
  }
  return porteurs;
}

// v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES » : une séquence de mots, ANCRÉE à la
// position COURANTE (contrairement à trouverSequenceConnueDetail, qui balaie TOUTES les positions de
// départ pour ne garder que la plus longue trouvée n'importe où), qui correspond EXACTEMENT au nom
// d'une relation déjà connue -- à cette position précise, la plus longue correspondance l'emporte.
function sequenceAncreeAuDebut(mots, ensemble) {
  for (let fin = mots.length; fin > 0; fin -= 1) {
    const segment = mots.slice(0, fin).join(' ');
    if (ensemble.has(segment)) return { longueur: fin, segment };
  }
  return null;
}

// v0.35 — DÉCISION CHATGPT « CHANTIER v0.35.0 » : SEUL POINT DE VÉRITÉ pour « quelles séquences de
// mots, correspondant LITTÉRALEMENT au nom d'une relation déjà connue, sont présentes dans la
// phrase ». Avant ce chantier, trouverRelation() cherchait la séquence la plus LONGUE n'importe où
// dans la phrase (trouverSequenceConnueDetail, balayage global par position de départ, meilleure
// longueur globale retenue), alors que relationsNommeesDistinctes() balayait déjà, séparément, de
// GAUCHE À DROITE pour trouver TOUTES les occurrences distinctes non chevauchantes. Diagnostic
// automatisé n°2 (axe 6, cas zdiag) : quand la phrase nomme deux relations CONNUES de longueurs
// DIFFÉRENTES, le balayage global de trouverRelation() ne voit AUCUNE concurrence (la plus longue
// l'emporte sans même être comparée à l'autre, de longueur différente) -- un état COMPRIS était alors
// produit directement, court-circuitant tenterComposition() (esprit.js), qui n'est tenté QUE depuis la
// branche PARTIEL de repondre(). Résultat : une réponse locale confiante mais FAUSSE (la valeur
// intermédiaire).
//
// sequencesNommeesPresentes() remplace désormais, dans les DEUX mécanismes, le balayage par position
// de départ : TOUTES les occurrences distinctes et NON CHEVAUCHANTES, de GAUCHE À DROITE (la plus
// longue correspondance à chaque position ancrée) -- une relation multi-mots reste reconnue comme UNE
// unité (la correspondance la plus longue à une position donnée l'emporte toujours sur son propre
// sous-fragment, v0.22, non-régression), et deux relations de longueurs différentes sont désormais
// TOUTES LES DEUX vues, quelle que soit laquelle est la plus longue (correctif zdiag). Aucune notion
// d'ordre n'est décidée ici (v0.33, inchangé) : c'est toujours à resoudreChemin()/tenterComposition()
// de découvrir, parmi les ordres possibles, lequel correspond à une chaîne de faits réelle.
//
// trouverRelation() ET relationNommeeAPosition() (v0.40, voir plus bas) consultent cette MÊME
// primitive pour la détection de séquence -- c'est la divergence sur CE point précis qui causait le
// bug zdiag -- mais chacune garde, SANS LA MODIFIER, sa propre façon validée de combiner ce résultat
// avec le mécanisme de secours par mot-déclencheur (relationsPorteesParMot / vérification mot-à-mot),
// car les deux usages ont des besoins légitimement différents :
//   - trouverRelation() (UNE relation, pour la résolution simple) ne consulte le mot-déclencheur QUE
//     si AUCUNE séquence nommée n'est présente du tout (comportement exactement inchangé depuis
//     v0.33) -- sinon, la présence du mot-déclencheur « fils » devrait s'effacer inutilement devant
//     « appelle » coïncidant par ailleurs avec une relation enseignée sans rapport. Si plusieurs
//     séquences DISTINCTES sont présentes (zdiag), l'exclusion du garde-fou structurel (collision de
//     pure graphie) ne s'applique QU'ENTRE elles, exactement comme avant pour l'ambiguïté de même
//     longueur -- une ambiguïté réelle entraîne toujours une abstention (null), jamais un choix
//     arbitraire : c'est précisément ce qui fait retomber comprendre() sur l'état PARTIEL (jamais
//     COMPRIS) dès qu'une phrase contient réellement plusieurs relations distinctes non résolues --
//     l'invariant de fiabilité demandé par ce chantier.
//   - relationNommeeAPosition()/relationsNommeesEnOrdre() (TOUTES les occurrences, pour la
//     composition, v0.40) décident, à CHAQUE position, UNE SEULE FOIS, entre séquence nommée et
//     mot-déclencheur (la séquence l'emporte quand elle est utilisable) -- voir leur propre
//     commentaire, plus bas, pour la raison précise de ce changement par rapport à l'union
//     inconditionnelle des deux canaux qui prévalait avant v0.40.
// v0.63.1 — PROVENANCE : mêmes occurrences que ci-dessus (même balayage, même pas), mais chacune est
// conservée avec sa POSITION ({ segment, debut, longueur }) au lieu d'être dédupliquée dans un Set. Les
// décisions de trouverRelation() travaillent toujours sur l'ensemble des segments DISTINCTS (inchangé).
function occurrencesNommeesPresentes(mots, ensemble) {
  const trouvees = [];
  let i = 0;
  while (i < mots.length) {
    const trouve = sequenceAncreeAuDebut(mots.slice(i), ensemble);
    if (!trouve) { i += 1; continue; }
    trouvees.push({ segment: trouve.segment, debut: i, longueur: trouve.longueur });
    i += trouve.longueur;
  }
  return trouvees;
}

// v0.63.1 — PROVENANCE DE LA RELATION. Renvoie { valeur, sources, ecartees } :
//   valeur   : EXACTEMENT ce que renvoyait trouverRelation() avant v0.63.1 (null en cas d'abstention) ;
//   sources  : les occurrences ({ debut, longueur }, dans le tableau reçu) qui portent la relation RETENUE --
//              TOUTES les occurrences de cette relation (« est » trois fois = trois plages), car la
//              décision ne retient qu'UNE relation distincte, quel que soit le nombre de ses occurrences ;
//   ecartees : les occurrences réellement considérées puis écartées pendant CETTE décision, avec
//              { debut, longueur, valeur, raison } ; la raison est celle de la branche explicite du code :
//              'structurelle' (mot grammatical d'un seul mot écarté parce que plusieurs séquences distinctes
//              sont présentes) ou 'ambigue' (plusieurs relations de contenu distinctes en concurrence ->
//              abstention). Les mots-déclencheurs jamais consultés (une séquence nommée existait) ne sont
//              PAS des candidats écartés : ils n'ont pas été considérés.
function trouverRelationAvecProvenance(mots, lexique, relationsConnues) {
  const occurrences = occurrencesNommeesPresentes(mots, relationsConnues);
  const sequences = new Set(occurrences.map((o) => o.segment));
  if (sequences.size > 0) {
    if (sequences.size > 1) {
      // Ambiguïté entre plusieurs séquences nommées DISTINCTES (même longueur comme avant ce
      // chantier, OU longueurs différentes -- correctif zdiag) : écarte PARMI ELLES SEULEMENT celles
      // qui ne jouent structurellement jamais le rôle de relation ailleurs dans le moteur (collision de
      // pure graphie, v0.33) ; une vraie concurrence entre relations DE CONTENU reste un conflit réel.
      const genuines = [...sequences].filter((c) => !(c.split(' ').length === 1 && estMotStructurelNonRelationnel(c, lexique)));
      const retenue = genuines.length === 1 ? genuines[0] : null;
      const ecartees = [];
      for (const o of occurrences) {
        if (!genuines.includes(o.segment)) ecartees.push({ debut: o.debut, longueur: o.longueur, valeur: o.segment, raison: 'structurelle' });
        else if (retenue === null) ecartees.push({ debut: o.debut, longueur: o.longueur, valeur: o.segment, raison: 'ambigue' });
      }
      const sources = retenue === null ? [] : occurrences.filter((o) => o.segment === retenue).map((o) => ({ debut: o.debut, longueur: o.longueur }));
      return { valeur: retenue, sources, ecartees };
    }
    // une seule séquence trouvée : légitime telle quelle, même structurelle.
    return { valeur: [...sequences][0], sources: occurrences.map((o) => ({ debut: o.debut, longueur: o.longueur })), ecartees: [] };
  }
  // Mécanismes de secours (mot-déclencheur), inchangés : consultés UNIQUEMENT quand aucune séquence
  // nommée n'est présente du tout -- jamais en complément d'une séquence déjà trouvée.
  for (const role of ROLES_PORTEURS_DE_RELATION) {
    const porteurs = motsPorteursDeRelation(mots, lexique, role);
    const distinctes = new Set(porteurs.map((p) => p.relation));
    if (distinctes.size > 1) {
      return { valeur: null, sources: [], ecartees: porteurs.map((p) => ({ debut: p.debut, longueur: 1, valeur: p.relation, raison: 'ambigue' })) };
    }
    if (distinctes.size === 1) {
      return { valeur: [...distinctes][0], sources: porteurs.map((p) => ({ debut: p.debut, longueur: 1 })), ecartees: [] };
    }
  }
  return { valeur: null, sources: [], ecartees: [] };
}

// v0.64.12 — J1b « GARDE CONTRE L'IGNORANCE SILENCIEUSE » (décision ChatGPT « MISSION DE DÉVELOPPEMENT v0.64.12 — J1 », 14/10/2026).
// Défaut supprimé : un mot INCONNU placé juste après un possessif (« mon chat », « ton chat ») était ignoré, et la relation venait d'un AUTRE mot
// (le verbe « appelle » → nom, ou une relation nommée ailleurs) : « Comment s'appelle mon chat ? » rendait le nom de Christophe. Le groupe possessif
// désigne pourtant l'objet de la question : s'il est inconnu, aucune relation ne peut lui être attribuée honnêtement.
// GARDE STRUCTURELLE, non globale : elle ne s'applique que si un possessif (moi ou toi) est IMMÉDIATEMENT suivi, dans le groupe pertinent, d'un mot
// qui n'est ni dans le lexique, ni un prénom connu, ni un sujet connu, ni le début d'une relation connue (relationsConnues, y compris celles que
// les faits confirmés font connaître). Un mot inconnu ailleurs dans la phrase ne change rien. Rend l'indice de ce mot, ou -1.
// Conséquence documentée : « mon petit chien » (adjectif inconnu entre le possessif et la relation) devient une abstention prudente.
export function indicePossessifSuiviDInconnu(groupe, lexique, prenomsConnus, sujetsConnus, relationsConnues) {
  for (let i = 0; i + 1 < groupe.length; i += 1) {
    const e = lexique[groupe[i]];
    if (!(possedeRole(e, ROLES.POSSESSIF_MOI) || possedeRole(e, ROLES.POSSESSIF_TOI))) continue;
    const suivant = groupe[i + 1];
    if (lexique[suivant] || prenomsConnus.has(suivant) || sujetsConnus.has(suivant)) continue;
    if (sequenceAncreeAuDebut(groupe.slice(i + 1), relationsConnues)) continue;
    return i + 1;
  }
  return -1;
}

// v0.40 — DÉCISION CHATGPT « PROCHAINE ÉTAPE : RELATIONS RÉPÉTÉES » : avant ce chantier,
// relationsNommeesDistinctes() renvoyait un Set, qui dit QUELLES relations sont nommées, sans jamais
// dire COMBIEN DE FOIS. C'est pourtant TOUJOURS elle (via ce Set) qui alimentait
// comprendre()/relationsNommees, la SEULE donnée que consulte tenterComposition() (esprit.js) : une
// relation « devient » citée deux fois dans la phrase ne comptait donc que pour UNE occurrence, et
// resoudreChemin() ne recevait jamais un chemin [devient, devient, produit] à essayer, même si
// resoudreChemin()/permutations() eux-mêmes n'ont besoin d'AUCUN changement pour suivre un tel chemin
// (déjà génériques sur un tableau de longueur et de répétitions quelconques).
//
// relationNommeeAPosition()/relationsNommeesEnOrdre() (ci-dessous) remplacent désormais ce Set par un
// tableau qui conserve l'ORDRE et les RÉPÉTITIONS RÉELLEMENT PRÉSENTES dans la phrase --
// SANS simplement empiler les deux canaux (séquence nommée + mot-déclencheur) l'un après l'autre : un
// même mot EST SOUVENT à la fois une séquence nommée d'un seul mot ET un mot-déclencheur du même nom
// (c'est le cas normal pour toute relation apprise d'un seul mot), et les empiler séparément créerait
// une FAUSSE répétition pour une relation mentionnée UNE SEULE fois dans la phrase -- exactement la
// dérive que ce chantier interdit explicitement ("ne pas simplement remplacer un Set par une liste si
// cela crée des faux enchaînements"). relationNommeeAPosition() décide donc, à CHAQUE position ancrée,
// UNE SEULE fois, laquelle des deux sources s'applique ici (la séquence nommée l'emporte toujours
// quand elle existe et n'est pas un mot structurel pur, exactement la préférence déjà en vigueur dans
// trouverRelation() ci-dessus) ; relationsNommeesEnOrdre() balaie ensuite TOUTE la phrase, de GAUCHE À
// DROITE, SANS CHEVAUCHEMENT, en avançant du nombre de mots réellement consommés à chaque position.
function relationNommeeAPosition(mots, lexique, relationsConnues) {
  const seq = sequenceAncreeAuDebut(mots, relationsConnues);
  const sequenceUtilisable = seq && !(seq.longueur === 1 && estMotStructurelNonRelationnel(seq.segment, lexique));
  if (sequenceUtilisable) return { longueur: seq.longueur, relation: seq.segment };
  const mot = mots[0];
  if (!estMotStructurelNonRelationnel(mot, lexique)) {
    const e = lexique[mot];
    if (e && e.relation && ROLES_PORTEURS_DE_RELATION.includes(e.role)) return { longueur: 1, relation: e.relation };
  }
  return null;
}

function relationsNommeesEnOrdre(mots, lexique, relationsConnues) {
  const trouvees = [];
  let i = 0;
  while (i < mots.length) {
    const trouve = relationNommeeAPosition(mots.slice(i), lexique, relationsConnues);
    if (!trouve) { i += 1; continue; }
    trouvees.push(trouve.relation);
    i += trouve.longueur;
  }
  return trouvees;
}

// v0.17.2 — SEGMENTATION + PORTÉE : chaque mot de rôle INTERROGATIF démarre un nouveau groupe (lui
// inclus) ; tout ce qui précède appartient au(x) groupe(s) précédent(s). Sert à isoler la VRAIE
// question d'une phrase qui contient aussi une adresse à Naissance (« Tu sais quel est mon
// manteau ? ») ou une autre proposition (« La lampe est blanche. Quel est mon manteau ? ») — sans
// avoir besoin de ponctuation, absente ou peu fiable en dictée vocale.
function grouperParInterrogatif(mots, lexique) {
  const groupes = [];
  let courant = [];
  for (const m of mots) {
    const estInterrogatif = possedeRole(lexique[m], ROLES.INTERROGATIF);
    if (estInterrogatif && courant.length) { groupes.push(courant); courant = [m]; }
    else courant.push(m);
  }
  if (courant.length) groupes.push(courant);
  return groupes;
}

// Le groupe où chercher sujet et relation : le DERNIER groupe qui contient un interrogatif (la
// question réellement posée, généralement la plus proche de la fin) ; s'il n'y en a aucun, la
// phrase ENTIÈRE — comportement strictement inchangé pour toute phrase sans mot interrogatif.
//
// v0.34 — DÉCISION CHATGPT « CHANTIER v0.34.0 », LOT 2 « INTERROGATIF ≠ RELATIF » : un mot de rôle
// INTERROGATIF peut aussi être un RELATIF ordinaire à l'intérieur d'une clause déjà commencée (« ...
// quoi QUI peut produire... », diagnostic post-v0.33, famille 3) -- rien dans bagage.js ne distingue
// les deux usages du même mot, et ce chantier REFUSE explicitement d'ajouter une règle spécifique
// («si "qui" est précédé d'un nom...»). Le signal retenu, général et déjà disponible : un groupe qui
// OUVRE réellement une clause interrogative autonome doit pouvoir y désigner SON PROPRE sujet (exactement
// comme « quel est MON manteau » le fait) -- sinon, le mot n'ouvrait pas une clause indépendante, il
// continuait une structure déjà en cours, et il n'aurait jamais dû couper le sujet qui le précédait.
// Mécanique : si le DERNIER groupe interrogatif ne porte lui-même aucun sujet reconnu, il est fusionné
// avec le groupe précédent (un groupe à la fois, en remontant), jusqu'à ce qu'un sujet apparaisse ou
// qu'il ne reste plus rien à fusionner -- dans ce dernier cas, le résultat est exactement `mots` (la
// phrase entière), donc toujours une abstention saine si aucun sujet n'existe nulle part, jamais un
// choix arbitraire. AUCUNE connaissance du mot « qui » : le même mécanisme vaut pour tout autre mot de
// rôle INTERROGATIF utilisé comme relatif. Pour toute phrase déjà validée avant ce lot, le dernier
// groupe interrogatif portait déjà son propre sujet (c'est précisément ce qui le rendait pertinent) :
// zéro régression, la fusion ne se déclenche jamais dans ces cas.
// v0.63.1 — PROVENANCE : renvoie { groupe, debut } où `debut` est l'indice, dans `mots`, du premier token du
// groupe retenu. Le groupe est TOUJOURS un suffixe contigu de `mots` (les groupes sont une partition
// contiguë et la fusion remonte vers la gauche) : `debut` est donc le nombre de tokens des groupes qui le
// précèdent -- compté ici, à l'instant où la fusion s'arrête. Le groupe retenu est celui d'avant, inchangé.
function groupePertinent(mots, lexique, prenomsConnus, sujetsConnus) {
  const groupes = grouperParInterrogatif(mots, lexique);
  const indicesAvecInterrogatif = groupes
    .map((g, i) => (g.some((m) => possedeRole(lexique[m], ROLES.INTERROGATIF)) ? i : -1))
    .filter((i) => i >= 0);
  if (!indicesAvecInterrogatif.length) return { groupe: mots, debut: 0 };
  let indice = indicesAvecInterrogatif[indicesAvecInterrogatif.length - 1];
  let fusionne = groupes[indice];
  while (!trouverSujet(fusionne, lexique, prenomsConnus, sujetsConnus) && indice > 0) {
    indice -= 1;
    fusionne = [...groupes[indice], ...fusionne];
  }
  let debut = 0;
  for (let i = 0; i < indice; i += 1) debut += groupes[i].length;
  return { groupe: fusionne, debut };
}

// v0.17.4 — MOTEUR GÉNÉRIQUE DE GABARITS : ne connaît AUCUN mot ni AUCUNE règle du français. Une
// CONTRAINTE est { mot } (un mot exact) ou { role } (n'importe quel mot de ce rôle dans le lexique) ;
// un GABARIT est une suite ORDONNÉE de contraintes. correspondContrainte teste une seule position ;
// contientGabarit cherche le gabarit comme sous-séquence CONTIGUË, n'importe où dans `mots`. Les
// FORMES françaises qui utilisent ce moteur (GABARITS_VERIFICATION_DEPART) vivent dans bagage.js —
// en ajouter une nouvelle ne touche jamais ces deux fonctions.
function correspondContrainte(mot, contrainte, lexique) {
  if (contrainte.mot) return mot === contrainte.mot;
  if (contrainte.role) return possedeRole(lexique[mot], contrainte.role);
  return false;
}
// v0.63.1 — PROVENANCE : renvoie l'indice de la PREMIÈRE position où le gabarit correspond, ou -1. Même
// parcours qu'avant (de gauche à droite, arrêt à la première correspondance) : « contient » = indice >= 0.
function positionGabarit(mots, gabarit, lexique) {
  for (let i = 0; i + gabarit.length <= mots.length; i += 1) {
    if (gabarit.every((contrainte, j) => correspondContrainte(mots[i + j], contrainte, lexique))) return i;
  }
  return -1;
}

// v0.17.3 — TYPE D'ÉNONCÉ, minimal : QUESTION_INFORMATION si le groupe pertinent contient un mot
// interrogatif (même rôle et même groupe que groupePertinent ci-dessus — rien de nouveau ajouté au
// lexique), sinon AFFIRMATION par défaut. AUCUNE autre distinction dans cette version : ni négation,
// ni vérification (« est-ce que », inversion — non détectées, resteraient AFFIRMATION), ni valeur
// proposée. `type` n'est encore lu nulle part ailleurs : exposer la compréhension SANS changer la
// réponse, volontairement (voir ARCHITECTURE-IA.md).
export const QUESTION_INFORMATION = 'question_information';
export const AFFIRMATION = 'affirmation';
export const VERIFICATION = 'verification';
// v0.17.4 — troisième type. QUESTION_INFORMATION reste PRIORITAIRE (testé en premier, comme avant ce
// chantier) : un interrogatif présent l'emporte toujours, aucune régression sur v0.17.2/v0.17.3.
// VERIFICATION est ensuite reconnu si le groupe pertinent correspond à l'UN des gabarits de
// bagage.js. v0.17.6 — ENSUITE SEULEMENT, une éventuelle connaissance APPRISE (gabaritsTypesAppris,
// une collection GÉNÉRALE « gabarit(s) → signification », jamais limitée à VERIFICATION — voir
// esprit.js/connaissances.js) est essayée, dans l'ordre où elle a été apprise ; sa signification est
// une chaîne LIBRE, pas une des trois constantes ci-dessus. Sinon, AFFIRMATION par défaut, comme avant.
// Un gabarit dont le statut n'est plus 'validee' (remplacé) n'est jamais utilisé — même principe que
// regles.js (appliquerRegles) : le filtre par statut vit ici, pas chez l'appelant.
// v0.63.1 — PROVENANCE DU TYPE : renvoie { type, source } où `source` = { debut, longueur } (positions dans
// le tableau `groupe` reçu) de l'élément RÉELLEMENT utilisé : le PREMIER mot interrogatif (de gauche à droite)
// pour QUESTION_INFORMATION ; la plage exacte du premier gabarit qui correspond (gabarit de départ puis
// gabarit appris, dans l'ordre d'avant) pour VERIFICATION ou un type appris ; null pour l'AFFIRMATION par
// défaut, qui n'a aucun élément du texte pour origine (on n'invente aucune provenance). La décision du type
// est celle d'avant, branche par branche.
function trouverType(groupe, lexique, gabaritsTypesAppris) {
  const iInterrogatif = groupe.findIndex((m) => possedeRole(lexique[m], ROLES.INTERROGATIF));
  if (iInterrogatif >= 0) return { type: QUESTION_INFORMATION, source: { debut: iInterrogatif, longueur: 1 } };
  for (const gabarit of GABARITS_VERIFICATION_DEPART) {
    const p = positionGabarit(groupe, gabarit, lexique);
    if (p >= 0) return { type: VERIFICATION, source: gabarit.length > 0 ? { debut: p, longueur: gabarit.length } : null };
  }
  for (const g of gabaritsTypesAppris) {
    if (g.statut !== 'validee') continue;
    for (const gabarit of (g.gabarits || [])) {
      const p = positionGabarit(groupe, gabarit, lexique);
      if (p >= 0) return { type: g.signification, source: gabarit.length > 0 ? { debut: p, longueur: gabarit.length } : null };
    }
  }
  return { type: AFFIRMATION, source: null };
}

export const COMPRIS = 'compris';
export const PARTIEL = 'partiel';
export const INCOMPRIS = 'incompris';

// Résultat : { etat, sujet, relation, mots, motsInconnus }
//   compris   : on sait de qui on parle ET quelle information est demandée.
//   partiel   : on a l'un des deux seulement — on peut le dire, et ça devient matière à apprendre.
//   incompris : ni l'un ni l'autre.
export function comprendre(phrase, { lexique = LEXIQUE_DEPART, prenomsConnus = new Set(), sujetsConnus = new Set(), relationsConnues = new Set(), gabaritsTypesAppris = [] } = {}) {
  const mots = decouper(phrase);
  // v0.17.2 — sujet et relation sont cherchés dans le groupe PERTINENT (voir groupePertinent
  // ci-dessus), jamais dans toute la phrase telle quelle : c'est la seule différence avec avant ce
  // chantier. Sans aucun mot interrogatif, le groupe pertinent EST la phrase entière — comportement
  // identique à avant.
  const { groupe, debut: debutGroupe } = groupePertinent(mots, lexique, prenomsConnus, sujetsConnus);
  const resultatType = trouverType(groupe, lexique, gabaritsTypesAppris);
  const resultatSujet = trouverSujetAvecPosition(groupe, lexique, prenomsConnus, sujetsConnus);
  const relationTrouvee = trouverRelationAvecProvenance(groupe, lexique, relationsConnues);
  // v0.64.12 — J1b : la relation trouvée est ÉCARTÉE (raison « possessif-inconnu ») si le groupe possessif est inconnu ; ses occurrences
  // passent dans `ecartees`, la provenance de la relation devient null. Hors de ce cas, résultat strictement identique à avant.
  const garde = indicePossessifSuiviDInconnu(groupe, lexique, prenomsConnus, sujetsConnus, relationsConnues) >= 0;
  const resultatRelation = garde && relationTrouvee.valeur !== null
    ? { valeur: null, sources: [], ecartees: [...relationTrouvee.ecartees, ...relationTrouvee.sources.map((o) => ({ debut: o.debut, longueur: o.longueur, valeur: relationTrouvee.valeur, raison: 'possessif-inconnu' }))] }
    : relationTrouvee;
  const type = resultatType.type;
  const sujet = resultatSujet ? resultatSujet.valeur : null;
  const relation = resultatRelation.valeur;
  // v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES » : calculé TOUJOURS (coût négligeable),
  // mais n'est exploité QUE par esprit.js/repondre(), en secours, quand le chemin normal (sujet +
  // UNE relation) n'aboutit pas -- champ purement ADDITIF, ne change rien à `etat`/`relation`
  // ci-dessus ni à aucun comportement déjà validé.
  // v0.40 — DÉCISION CHATGPT « RELATIONS RÉPÉTÉES » : un TABLEAU (relationsNommeesEnOrdre), plus un
  // Set dédupliqué -- une relation nommée deux fois dans la phrase compte désormais pour deux
  // occurrences, dans l'ordre où elles apparaissent ; une relation nommée une seule fois continue de
  // donner un tableau de longueur 1, exactement comme avant (zéro régression sur toute phrase qui ne
  // nomme chaque relation qu'une fois).
  // v0.64.12 — J1b : sous la même garde, aucune relation nommée n'est rendue (la composition de repondre() ne peut pas contourner la garde :
  // « la couleur du chien de mon voisin » ne compose plus moi → chien → couleur).
  const relationsNommees = garde ? [] : relationsNommeesEnOrdre(groupe, lexique, relationsConnues);
  const motsInconnus = mots.filter((m) => !lexique[m] && !prenomsConnus.has(m) && !sujetsConnus.has(m));
  let etat = INCOMPRIS;
  if (sujet && relation) etat = COMPRIS;
  else if (sujet || relation) etat = PARTIEL;
  const resultat = { etat, type, sujet, relation, mots, motsInconnus, relationsNommees };
  // v0.63.1 — PROVENANCE DE L'ANALYSE : faits que cette fonction connaît PENDANT son exécution et jetait
  // jusqu'ici. Convention unique : toutes les positions référencent le tableau `mots` ci-dessus (index
  // zéro-based, `longueur` = nombre de tokens ; la fin est debut + longueur). Contenu :
  //   groupe   : { debut } -- indice du premier token du groupe pertinent (c'est un suffixe de `mots`) ;
  //   type     : { debut, longueur } du token ou de la plage de gabarit qui a produit le type, ou null ;
  //   sujet    : { debut, longueur } du token ou de la séquence qui a produit `sujet`, ou null ;
  //   relation : liste NON vide de { debut, longueur } -- les occurrences de la relation retenue, ou null ;
  //   ecartees : occurrences reconnues puis écartées pendant la décision de relation,
  //              { debut, longueur, valeur, raison } (raison = branche explicite du code, voir
  //              trouverRelationAvecProvenance).
  // Elle décrit la SOURCE TEXTUELLE, pas la valeur résultante (« ou » -> « ville »). Purement descriptive :
  // AUCUNE fonction de décision ne la lit. Propriété NON ÉNUMÉRABLE et gelée, exprès : plusieurs appelants
  // recopient la compréhension par `{ ...comprehension }` (pont.js) dans des tables lues par l'apprentissage
  // (experiences) ; une propriété énumérable s'y écrirait et changerait ces tables. Seul l'observateur
  // (pont.js) la lit, par son nom.
  const ajouterPos = (p) => ({ debut: debutGroupe + p.debut, longueur: p.longueur });
  const provenanceAnalyse = {
    groupe: { debut: debutGroupe },
    type: resultatType.source ? ajouterPos(resultatType.source) : null,
    sujet: resultatSujet ? ajouterPos(resultatSujet) : null,
    relation: resultatRelation.sources.length ? resultatRelation.sources.map((s) => ({ debut: s.debut + debutGroupe, longueur: s.longueur })) : null,
    ecartees: resultatRelation.ecartees.map((x) => ({ debut: x.debut + debutGroupe, longueur: x.longueur, valeur: x.valeur, raison: x.raison })),
  };
  Object.freeze(provenanceAnalyse.groupe);
  if (provenanceAnalyse.type) Object.freeze(provenanceAnalyse.type);
  if (provenanceAnalyse.sujet) Object.freeze(provenanceAnalyse.sujet);
  if (provenanceAnalyse.relation) { provenanceAnalyse.relation.forEach(Object.freeze); Object.freeze(provenanceAnalyse.relation); }
  provenanceAnalyse.ecartees.forEach(Object.freeze);
  Object.freeze(provenanceAnalyse.ecartees);
  Object.freeze(provenanceAnalyse);
  Object.defineProperty(resultat, 'provenanceAnalyse', { value: provenanceAnalyse, enumerable: false, writable: false, configurable: false });
  return resultat;
}

// Explication lisible de ce qu'elle a compris — pour que Christophe voie DANS QUOI elle se trompe.
export function expliquer(c) {
  if (c.etat === COMPRIS) return `J'ai compris : sujet « ${c.sujet} », information « ${c.relation} ».`;
  if (c.etat === PARTIEL) {
    if (c.sujet && !c.relation) return `Je vois de qui on parle (« ${c.sujet} ») mais pas quelle information est demandée.`;
    return `Je vois quelle information est demandée (« ${c.relation} ») mais pas de qui on parle.`;
  }
  return `Je n'ai rien reconnu${c.motsInconnus.length ? ` — mots inconnus : ${c.motsInconnus.join(', ')}` : ''}.`;
}
// === FIN_LANGAGE_COMPRENDRE ===
