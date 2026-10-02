// === DEBUT_LANGAGE_ACTION ===
// v0.38.0 — DÉCISION CHATGPT « LOT B2 : ACTION INTERNE APPRISE » (02/10), deuxième des trois lots de
// la primitive B. Ce fichier construit la couche GÉNÉRALE qui relie un squelette appris (B1,
// extraction.js) à une CAPACITÉ INTERNE AUTORISÉE (registre.js), via une correspondance explicite
// entre positions variables et noms de rôle. Reste volontairement ignorant de ce qu'est
// « confrontation » : rien ici ne mentionne cette capacité par son nom en dehors d'un import du
// registre fermé — une future deuxième capacité n'exigerait aucun changement de ce fichier.
//
// AUCUN raccord à comprendre()/repondre() (lot B3, séparé) : ce fichier est pur et isolé comme
// extraction.js/transformation.js, à UNE exception près, volontaire et minimale — invoquerAction()
// reçoit un `esprit` (déjà chargé par esprit.js) pour le transmettre tel quel à la capacité invoquée
// (confronter() en a besoin pour lire esprit.faits) ; ce fichier ne lit ni n'écrit jamais lui-même
// dans cet esprit, et n'importe jamais comprendre.js.
import { tokeniser, calculerAncres } from './transformation.js';
import { construireSquelette, extraireVariables } from './extraction.js';
import { CAPACITES } from './registre.js';

// --- INDÉPENDANCE DES RÔLES VARIABLES (INCERTITUDE) --------------------------------------------
// Décision ChatGPT déjà prise (cadrage B) : quand les exemples ne permettent pas encore de
// distinguer deux positions variables l'une de l'autre (elles varient TOUJOURS ensemble dans
// l'échantillon fourni), l'action reste INCERTAINE — jamais invocable — jusqu'à ce qu'un exemple
// supplémentaire démontre qu'elles peuvent varier indépendamment. Même esprit que `certaine` dans
// transformation.js (LOT 1, anti-sur-généralisation), mais une question structurellement différente
// (là : un littéral inséré coïncide-t-il avec un jeton supprimé ? ici : deux positions variables
// forment-elles vraiment deux degrés de liberté séparés ?) — donc un calcul séparé, pas une
// réutilisation de `certaine`.
// Deux positions i,j sont DISTINGUÉES s'il existe, parmi tous les exemples pris deux à deux, au
// moins une paire où EXACTEMENT L'UNE des deux positions change (jamais les deux à la fois, jamais
// aucune des deux) : la preuve qu'elles ne sont pas structurellement liées dans l'échantillon connu.
function positionsDistinguees(positionsVariables, exemplesTokenises) {
  for (let a = 0; a < positionsVariables.length; a += 1) {
    for (let b = a + 1; b < positionsVariables.length; b += 1) {
      const pi = positionsVariables[a];
      const pj = positionsVariables[b];
      let demontre = false;
      for (let x = 0; x < exemplesTokenises.length && !demontre; x += 1) {
        for (let y = 0; y < exemplesTokenises.length && !demontre; y += 1) {
          if (x === y) continue;
          const iChange = exemplesTokenises[x][pi] !== exemplesTokenises[y][pi];
          const jChange = exemplesTokenises[x][pj] !== exemplesTokenises[y][pj];
          if (iChange !== jChange) demontre = true; // l'une change sans l'autre : preuve d'indépendance.
        }
      }
      if (!demontre) return false;
    }
  }
  return true; // zéro ou une seule position variable : rien à distinguer, trivialement certain.
}

function positionsVariablesDe(n, exemplesObjets) {
  const ancrees = new Set(calculerAncres({ n, exemples: exemplesObjets }).map((a) => a.position));
  const variables = [];
  for (let i = 0; i < n; i += 1) if (!ancrees.has(i)) variables.push(i);
  return variables;
}

// --- ÉVALUATION PURE D'UNE ACTION (jamais de persistance ici) -----------------------------------
// Renvoie { ok:false, raison, detail } (opération inconnue, rôles dupliqués, rôles incorrects,
// arité rôles/positions incompatible, ou l'échec déjà renvoyé par construireSquelette()) ou
// { ok:true, n, exemples, roles:[{position,nom}], statut:'validee'|'incertaine' }.
export function evaluerAction({ operation, roles, exemples }) {
  const capacite = CAPACITES[operation];
  if (!capacite) {
    return { ok: false, raison: 'operation_inconnue', detail: `« ${operation} » n'est pas une opération interne autorisée.` };
  }
  const rolesFournis = Array.isArray(roles) ? roles : [];
  if (new Set(rolesFournis).size !== rolesFournis.length) {
    return { ok: false, raison: 'roles_dupliques', detail: 'un même nom de rôle est utilisé plusieurs fois.' };
  }
  const attendus = new Set(capacite.roles);
  const fournis = new Set(rolesFournis);
  const correspondent = attendus.size === fournis.size && [...attendus].every((r) => fournis.has(r));
  if (!correspondent) {
    return {
      ok: false,
      raison: 'roles_incorrects',
      detail: `cette opération attend exactement {${capacite.roles.join(', ')}}, reçu {${rolesFournis.join(', ')}}.`,
    };
  }
  const squelette = construireSquelette(exemples);
  if (!squelette.ok) return squelette; // 'insuffisant' ou 'arites_incompatibles', jamais réinterprété ici.
  const { n, exemples: exemplesObjets } = squelette.squelette;
  const positionsVariables = positionsVariablesDe(n, exemplesObjets);
  if (positionsVariables.length !== rolesFournis.length) {
    return {
      ok: false,
      raison: 'arite_roles_incompatible',
      detail: `${rolesFournis.length} rôle(s) nommé(s) pour ${positionsVariables.length} position(s) réellement variable(s) dans ces exemples.`,
    };
  }
  const rolesPositionnes = positionsVariables.map((position, idx) => ({ position, nom: rolesFournis[idx] }));
  const exemplesTokenises = exemplesObjets.map((e) => tokeniser(e.entree));
  const statut = positionsDistinguees(positionsVariables, exemplesTokenises) ? 'validee' : 'incertaine';
  return {
    ok: true, n, exemples: exemplesObjets, roles: rolesPositionnes, statut,
  };
}

// --- RECONNAISSANCE (hors invocation) -----------------------------------------------------------
// Ne considère QUE les actions VALIDÉES : une action 'incertaine' ou 'remplacee' ne participe jamais
// à la reconnaissance, même si elle correspondrait structurellement — c'est la MÊME discipline que
// l'invocation (ci-dessous), redondante par sécurité (defense in depth), jamais la seule barrière.
export function reconnaitreActions(actions, entreeTexte) {
  const candidates = (actions || []).filter((a) => a.statut === 'validee'
    && extraireVariables({ n: a.n, exemples: a.exemples }, entreeTexte) != null);
  if (!candidates.length) return { etat: 'aucune' };
  if (candidates.length > 1) return { etat: 'ambigu', actions: candidates };
  return { etat: 'unique', action: candidates[0] };
}

// --- INVOCATION -----------------------------------------------------------------------------
// Refuse TOUJOURS : une action non 'validee' (incertaine ou remplacée), une entrée qui ne correspond
// pas à son squelette, ou une opération absente du registre (défensif — ne devrait jamais arriver
// pour une action construite via evaluerAction(), mais une action pourrait provenir d'ailleurs, par
// exemple une ligne corrompue ou antérieure à un retrait de capacité).
export function invoquerAction(action, esprit, entreeTexte) {
  if (action.statut !== 'validee') return { ok: false, raison: 'incertaine' };
  const capacite = CAPACITES[action.operation];
  if (!capacite) return { ok: false, raison: 'operation_inconnue' };
  const squelette = { n: action.n, exemples: action.exemples };
  const variables = extraireVariables(squelette, entreeTexte);
  if (!variables) return { ok: false, raison: 'squelette_non_reconnu' };
  const argumentsNommes = {};
  for (const { position, nom } of action.roles) argumentsNommes[nom] = variables[position];
  // v0.46 — `arguments` ajouté de façon ADDITIVE au retour (observation passive des tentatives de
  // raisonnement, chantier séparé) : les arguments RÉELLEMENT utilisés pour cette invocation, déjà
  // calculés ci-dessus mais jusqu'ici jamais exposés à l'appelant. Ne change RIEN au comportement
  // existant (ok/resultat inchangés) ; action.js reste ignorant de ce qu'une trace est, de ce qu'un
  // magasin est, et n'écrit toujours jamais lui-même dans cet esprit (voir en-tête du fichier) — seul
  // ecran.js, qui a accès au magasin, décide d'observer ou non ce résultat.
  return { ok: true, resultat: capacite.invoquer(esprit, argumentsNommes), arguments: argumentsNommes };
}

// --- RECONNAISSANCE + INVOCATION, COMBINÉES (pour les tests hors conversation / futur B3) --------
// N'invoque JAMAIS en cas d'ambiguïté ou d'absence de correspondance : seule une reconnaissance
// 'unique' se poursuit jusqu'à l'invocation.
export function reconnaitreEtInvoquer(actions, esprit, entreeTexte) {
  const reco = reconnaitreActions(actions, entreeTexte);
  if (reco.etat !== 'unique') return reco;
  return { etat: 'unique', ...invoquerAction(reco.action, esprit, entreeTexte) };
}

// --- REPRÉSENTATION CONVERSATIONNELLE D'UN RÉSULTAT (LOT B3, v0.39.0) ---------------------------
// action.js reste ignorant de ce qu'une capacité particulière renvoie (voir en-tête du fichier) :
// cette fonction ne fait que retrouver, dans le registre FERMÉ, l'adaptateur `representer` que CETTE
// capacité a déclaré pour SON résultat (confrontation.js : { etat, valeurA, valeurB }, voir
// registre.js) -- jamais une mise en forme devinée ici. Défensif (chaîne neutre) si une capacité ne
// déclare pas encore de representer(), pour ne jamais faire planter le pont conversationnel.
export function representerResultatAction(action, resultat) {
  const capacite = CAPACITES[action.operation];
  if (!capacite || typeof capacite.representer !== 'function') return 'Résultat (action locale) : indisponible.';
  return capacite.representer(resultat);
}
// === FIN_LANGAGE_ACTION ===
