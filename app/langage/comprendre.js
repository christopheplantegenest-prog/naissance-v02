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
      } else if (longueur === meilleureLongueur) {
        valeursALaMeilleureLongueur.add(segment);
      }
      break; // la plus longue fin possible pour ce début est déjà trouvée : les plus courtes,
             // pour ce même début, ne peuvent jamais battre une longueur déjà égalée ailleurs.
    }
  }
  return { longueur: meilleureLongueur, candidats: valeursALaMeilleureLongueur, meilleure };
}

function trouverSequenceConnue(mots, ensembles) {
  const { longueur, candidats, meilleure } = trouverSequenceConnueDetail(mots, ensembles);
  if (longueur === 0) return null;
  if (candidats.size > 1) return null; // ambiguïté réelle : jamais de choix arbitraire.
  return meilleure;
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
function trouverSujet(mots, lexique, prenomsConnus, sujetsConnus) {
  for (const m of mots) {
    const e = lexique[m];
    if (!e) continue;
    if (e.role === ROLES.POSSESSIF_MOI || e.role === ROLES.PRONOM_MOI) return 'moi';
    if (e.role === ROLES.POSSESSIF_TOI || e.role === ROLES.PRONOM_TOI) return 'naissance';
  }
  return trouverSequenceConnue(mots, [prenomsConnus, sujetsConnus]);
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
const ROLES_JAMAIS_RELATION = new Set([
  ROLES.POSSESSIF_MOI, ROLES.POSSESSIF_TOI, ROLES.PRONOM_MOI, ROLES.PRONOM_TOI,
  ROLES.VERBE_CONJUGUE, ROLES.PRONOM_3E,
]);
function estMotStructurelNonRelationnel(mot, lexique) {
  const e = lexique[mot];
  return !!(e && ROLES_JAMAIS_RELATION.has(e.role));
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
function relationsPorteesParMot(mots, lexique, role) {
  const trouvees = new Set();
  for (const m of mots) {
    const e = lexique[m];
    if (e && e.relation && e.role === role) trouvees.add(e.relation);
  }
  return trouvees;
}

function trouverRelation(mots, lexique, relationsConnues) {
  // Mécanisme 1 : une séquence de mots qui correspond EXACTEMENT au nom d'une relation déjà connue.
  // AUCUNE exclusion à ce stade : un mot structurel reste un candidat tout à fait légitime quand
  // RIEN d'autre ne lui fait concurrence (« Une pomme est un fruit ? » → "est" doit continuer à
  // fonctionner seul, exactement comme avant ce chantier).
  const { longueur, candidats, meilleure } = trouverSequenceConnueDetail(mots, [relationsConnues]);
  if (longueur > 0) {
    if (candidats.size > 1) {
      // Ambiguïté entre plusieurs candidats : avant de s'abstenir, écarte PARMI EUX SEULEMENT ceux
      // qui ne jouent structurellement jamais le rôle de relation ailleurs dans le moteur (voir
      // estMotStructurelNonRelationnel) -- une vraie concurrence entre deux relations DE CONTENU
      // reste un conflit réel (abstention), mais une collision de pure graphie avec un mot
      // grammatical (« est » de « est-ce que ») ne doit pas faire perdre une relation par ailleurs
      // non ambiguë (cas réel : « Est-ce qu'un pommier peut produire un fruit ? », où "est" ne
      // concurrence "produire" que par accident d'orthographe).
      const candidatsGenuins = [...candidats].filter((c) => !(c.split(' ').length === 1 && estMotStructurelNonRelationnel(c, lexique)));
      return candidatsGenuins.length === 1 ? candidatsGenuins[0] : null;
    }
    return meilleure;
  }
  // Mécanismes de secours (mot-déclencheur), dans cet ordre de priorité, chacun avec le même
  // garde-fou d'ambiguïté qu'au mécanisme 1 : un interrogatif peut porter la relation à lui seul
  // (« Où est-ce que j'habite ? » → ville).
  for (const role of ROLES_PORTEURS_DE_RELATION) {
    const trouvees = relationsPorteesParMot(mots, lexique, role);
    if (trouvees.size > 1) return null;
    if (trouvees.size === 1) return [...trouvees][0];
  }
  return null;
}

// v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES », étape 2 : l'ENSEMBLE (non ordonné, sans
// position privilégiée) des noms de relation DISTINCTS explicitement présents dans la phrase --
// relations à UN SEUL mot seulement (limite assumée, documentée : une relation à plusieurs mots,
// comme « se situe en », n'est pas couverte ici -- hors de ce chantier, voir le rapport de
// continuité). Réutilise EXACTEMENT les mêmes critères que trouverRelation() ci-dessus (même
// exclusion des mots structurels, mêmes rôles porteurs de relation) UNION l'appartenance littérale
// directe à relationsConnues (couvre une relation qui n'a jamais reçu de mot dédié via « Mot : X
// désigne Y », mais existe seulement parce qu'un Fait l'utilise déjà). Ne décide JAMAIS d'un ordre :
// c'est à la résolution (esprit.js, resoudreChemin via tenterComposition) de découvrir, parmi les
// ordres possibles, lequel correspond réellement à une chaîne de faits existante -- jamais une
// notion de grammaire (quel mot vient « avant » l'autre dans la phrase) n'est nécessaire ici.
function relationsNommeesDistinctes(mots, lexique, relationsConnues) {
  const trouvees = new Set();
  for (const m of mots) {
    if (estMotStructurelNonRelationnel(m, lexique)) continue;
    const e = lexique[m];
    if (e && e.relation && ROLES_PORTEURS_DE_RELATION.includes(e.role)) { trouvees.add(e.relation); continue; }
    if (relationsConnues.has(m)) trouvees.add(m);
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
    const estInterrogatif = lexique[m] && lexique[m].role === ROLES.INTERROGATIF;
    if (estInterrogatif && courant.length) { groupes.push(courant); courant = [m]; }
    else courant.push(m);
  }
  if (courant.length) groupes.push(courant);
  return groupes;
}

// Le groupe où chercher sujet et relation : le DERNIER groupe qui contient un interrogatif (la
// question réellement posée, généralement la plus proche de la fin) ; s'il n'y en a aucun, la
// phrase ENTIÈRE — comportement strictement inchangé pour toute phrase sans mot interrogatif.
function groupePertinent(mots, lexique) {
  const groupes = grouperParInterrogatif(mots, lexique);
  const avecInterrogatif = groupes.filter((g) => g.some((m) => lexique[m] && lexique[m].role === ROLES.INTERROGATIF));
  return avecInterrogatif.length ? avecInterrogatif[avecInterrogatif.length - 1] : mots;
}

// v0.17.4 — MOTEUR GÉNÉRIQUE DE GABARITS : ne connaît AUCUN mot ni AUCUNE règle du français. Une
// CONTRAINTE est { mot } (un mot exact) ou { role } (n'importe quel mot de ce rôle dans le lexique) ;
// un GABARIT est une suite ORDONNÉE de contraintes. correspondContrainte teste une seule position ;
// contientGabarit cherche le gabarit comme sous-séquence CONTIGUË, n'importe où dans `mots`. Les
// FORMES françaises qui utilisent ce moteur (GABARITS_VERIFICATION_DEPART) vivent dans bagage.js —
// en ajouter une nouvelle ne touche jamais ces deux fonctions.
function correspondContrainte(mot, contrainte, lexique) {
  if (contrainte.mot) return mot === contrainte.mot;
  if (contrainte.role) return !!(lexique[mot] && lexique[mot].role === contrainte.role);
  return false;
}
function contientGabarit(mots, gabarit, lexique) {
  for (let i = 0; i + gabarit.length <= mots.length; i += 1) {
    if (gabarit.every((contrainte, j) => correspondContrainte(mots[i + j], contrainte, lexique))) return true;
  }
  return false;
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
function trouverType(groupe, lexique, gabaritsTypesAppris) {
  if (groupe.some((m) => lexique[m] && lexique[m].role === ROLES.INTERROGATIF)) return QUESTION_INFORMATION;
  if (GABARITS_VERIFICATION_DEPART.some((gabarit) => contientGabarit(groupe, gabarit, lexique))) return VERIFICATION;
  for (const g of gabaritsTypesAppris) {
    if (g.statut !== 'validee') continue;
    if ((g.gabarits || []).some((gabarit) => contientGabarit(groupe, gabarit, lexique))) return g.signification;
  }
  return AFFIRMATION;
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
  const groupe = groupePertinent(mots, lexique);
  const type = trouverType(groupe, lexique, gabaritsTypesAppris);
  const sujet = trouverSujet(groupe, lexique, prenomsConnus, sujetsConnus);
  const relation = trouverRelation(groupe, lexique, relationsConnues);
  // v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES » : calculé TOUJOURS (coût négligeable),
  // mais n'est exploité QUE par esprit.js/repondre(), en secours, quand le chemin normal (sujet +
  // UNE relation) n'aboutit pas -- champ purement ADDITIF, ne change rien à `etat`/`relation`
  // ci-dessus ni à aucun comportement déjà validé.
  const relationsNommees = [...relationsNommeesDistinctes(groupe, lexique, relationsConnues)];
  const motsInconnus = mots.filter((m) => !lexique[m] && !prenomsConnus.has(m) && !sujetsConnus.has(m));
  let etat = INCOMPRIS;
  if (sujet && relation) etat = COMPRIS;
  else if (sujet || relation) etat = PARTIEL;
  return { etat, type, sujet, relation, mots, motsInconnus, relationsNommees };
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
