// === DEBUT_LANGAGE_COMPOSITION ===
// v0.43 — DÉCISION CHATGPT « RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES RÉSULTATS » (02/10),
// architecture B retenue : conserver le DERNIER résultat de CHAQUE capacité (jamais un historique,
// jamais une liste), et permettre à une LIAISON APPRISE (donnée, jamais codée en dur pour une paire
// particulière) de désigner un champ scalaire explicite d'une capacité SOURCE comme valeur d'un rôle
// explicite d'une capacité CIBLE. DEUX MÉCANISMES STRICTEMENT SÉPARÉS, comme demandé :
//   1. CONSERVER/RÉFÉRENCER (enregistrerResultat ci-dessous) — un simple effet de bord, sans savoir
//      ni se soucier qu'une liaison existe ou non.
//   2. LIAISON APPRISE (evaluerLiaison, valeurLiee) — une donnée + une lecture, qui ne DÉCLENCHENT
//      JAMAIS, par leur seule existence, l'invocation d'une capacité cible : AUCUN orchestrateur
//      implicite ici. C'est TOUJOURS un appel explicite à invoquerAvecLiaisons() (ci-dessous) qui
//      déclenche une invocation -- jamais un effet de bord de enregistrerResultat() ou
//      d'apprendreLiaison() (connaissances.js).
//
// GÉNÉRALITÉ, vérifiée par construction : ce fichier ne connaît AUCUN nom de capacité particulier
// (pas de « confrontation », pas de « deduction » câblés en dur) -- tout passe par les noms déjà
// enregistrés dans le registre fermé (CAPACITES, registre.js) et par les champs du quadruplet appris
// (capaciteSource, champ, capaciteCible, role), fournis par l'appelant. Une future cinquième
// capacité serait immédiatement composable, sans aucun changement à ce fichier.
//
// N'ÉCRIT JAMAIS dans la mémoire persistée (esprit.magasin) : esprit.derniersResultats est un simple
// Map en mémoire, le temps de la session, posé directement sur l'esprit déjà chargé une seule fois
// (voir ecran.js, assurer()) -- EXACTEMENT la même discipline que esprit.conflitsFaits/esprit.faits
// eux-mêmes ne sont jamais réécrits en dehors d'un rechargement complet, et la même discipline de
// non-persistance que resoudreChemin()/deduire() (jamais un résultat dérivé permanent).
import { CAPACITES } from './registre.js';

function estScalaire(v) {
  return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

// --- ÉVALUATION PURE D'UNE LIAISON (jamais de persistance ici, même principe que evaluerAction()) -
// Ne vérifie QUE ce que le registre fermé déclare déjà : capaciteSource et capaciteCible existent,
// et role fait partie des rôles D'ENTRÉE déclarés par capaciteCible. Le CHAMP lui-même n'est JAMAIS
// validé ici, et ne peut pas l'être par avance : aucune capacité ne déclare la FORME de son résultat
// dans le registre (seulement ses rôles d'entrée) -- sa présence et sa scalarité ne peuvent être
// vérifiées qu'à l'instant où un résultat réel existe (voir valeurLiee() ci-dessous), jamais ici.
export function evaluerLiaison({
  capaciteSource, champ, capaciteCible, role,
}) {
  if (!CAPACITES[capaciteSource]) {
    return { ok: false, raison: 'capacite_source_inconnue', detail: `« ${capaciteSource} » n'est pas une opération interne autorisée.` };
  }
  if (!CAPACITES[capaciteCible]) {
    return { ok: false, raison: 'capacite_cible_inconnue', detail: `« ${capaciteCible} » n'est pas une opération interne autorisée.` };
  }
  if (!champ) return { ok: false, raison: 'champ_manquant', detail: 'il manque le nom du champ à transmettre.' };
  if (!CAPACITES[capaciteCible].roles.includes(role)) {
    return {
      ok: false,
      raison: 'role_inconnu',
      detail: `« ${capaciteCible} » attend les rôles {${CAPACITES[capaciteCible].roles.join(', ')}}, pas « ${role} ».`,
    };
  }
  return { ok: true };
}

// --- MÉCANISME 1 : CONSERVER / RÉFÉRENCER --------------------------------------------------------
// UN SEUL résultat gardé par capacité : le dernier invoqué EFFACE le précédent pour cette même
// capacité -- jamais un historique, jamais une liste de résultats conservés (architecture B,
// explicitement retenue contre l'architecture C). Un simple effet de bord, qui ne lit ni ne
// consulte jamais esprit.liaisons : ce mécanisme ignore totalement qu'une liaison existe ou non.
export function enregistrerResultat(esprit, capacite, resultat) {
  if (!esprit.derniersResultats) esprit.derniersResultats = new Map();
  esprit.derniersResultats.set(capacite, resultat);
}

// --- MÉCANISME 2 : LIAISON APPRISE → LECTURE SEULE (jamais une invocation ici) -------------------
// Cherche, parmi les liaisons VALIDÉES déjà enseignées (esprit.liaisons), celle qui désigne
// explicitement (capaciteCible, role). ABSTENTION EXPLICITE, jamais une valeur devinée ni partielle,
// dans chacun de ces cas : aucune liaison enseignée pour ce (capaciteCible, role) ; aucun résultat
// encore conservé pour la capaciteSource qu'elle désigne ; le champ désigné est absent de ce
// résultat ; ou sa valeur n'est pas scalaire (jamais une liste, jamais un objet -- conforme à la
// consigne de ce chantier : aucune itération, aucune liste traitée ici).
export function valeurLiee(esprit, { capaciteCible, role }) {
  const liaison = (esprit.liaisons || []).find((l) => l.statut === 'validee'
    && l.capaciteCible === capaciteCible && l.role === role);
  if (!liaison) return { ok: false, raison: 'aucune_liaison' };
  const derniersResultats = esprit.derniersResultats;
  if (!derniersResultats || !derniersResultats.has(liaison.capaciteSource)) {
    return { ok: false, raison: 'aucun_resultat', liaison };
  }
  const resultatSource = derniersResultats.get(liaison.capaciteSource);
  const valeur = resultatSource ? resultatSource[liaison.champ] : undefined;
  if (valeur === undefined) return { ok: false, raison: 'champ_absent', liaison };
  if (!estScalaire(valeur)) return { ok: false, raison: 'champ_non_scalaire', liaison };
  return { ok: true, valeur, liaison };
}

// --- INVOCATION EXPLICITE « AVEC LIAISONS » -------------------------------------------------------
// Invoque UNE capacité du registre fermé (désignée par son nom, jamais par un objet « action »
// apprise via B1/B2 -- aucun squelette textuel n'entre en jeu ici, cette invocation est TOUJOURS
// explicite, jamais une reconnaissance naturelle devinée) en résolvant CHAQUE rôle qu'elle attend :
//   - une valeur EXPLICITE fournie par l'appelant (argumentsExplicites) a TOUJOURS priorité ;
//   - à défaut, une liaison validée peut fournir la valeur (valeurLiee()) ;
//   - si ni l'un ni l'autre : abstention EXPLICITE pour ce rôle précis -- JAMAIS une invocation
//     partielle, jamais une valeur par défaut devinée.
// C'est le SEUL endroit qui déclenche réellement une invocation à partir d'une liaison : son
// existence seule (valeurLiee()) ne provoque jamais rien -- il faut TOUJOURS cet appel explicite,
// jamais un effet de bord automatique d'enregistrerResultat()/apprendreLiaison() (aucun
// orchestrateur implicite, conformément à la décision ChatGPT de ce chantier).
export function invoquerAvecLiaisons(esprit, { operation, argumentsExplicites = {} }) {
  const capacite = CAPACITES[operation];
  if (!capacite) return { ok: false, raison: 'operation_inconnue' };
  const argumentsNommes = {};
  // v0.46 — `provenances` ajouté de façon ADDITIVE (observation passive des tentatives de
  // raisonnement, chantier séparé) : CE LOOP sait déjà, pour chaque rôle, s'il vient d'un argument
  // explicite ou d'une liaison résolue — une information jusqu'ici calculée puis aussitôt perdue.
  // Ne change RIEN au comportement existant (résolution, priorité explicite > liaison, abstention
  // identiques) ; composition.js n'écrit toujours jamais dans esprit.magasin (voir en-tête du
  // fichier) — seul ecran.js, qui a accès au magasin, décide d'observer ou non ce résultat.
  const provenances = {};
  for (const role of capacite.roles) {
    if (Object.prototype.hasOwnProperty.call(argumentsExplicites, role)) {
      argumentsNommes[role] = argumentsExplicites[role];
      provenances[role] = 'explicite';
      continue;
    }
    const liee = valeurLiee(esprit, { capaciteCible: operation, role });
    if (!liee.ok) return { ok: false, raison: 'role_non_resolu', detail: { role, raison: liee.raison } };
    argumentsNommes[role] = liee.valeur;
    provenances[role] = 'liaison';
  }
  const resultat = capacite.invoquer(esprit, argumentsNommes);
  enregistrerResultat(esprit, operation, resultat);
  return {
    ok: true, resultat, arguments: argumentsNommes, provenanceArguments: provenances,
  };
}
// === FIN_LANGAGE_COMPOSITION ===
