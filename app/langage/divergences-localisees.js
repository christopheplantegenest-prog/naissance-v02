// === DEBUT_LANGAGE_DIVERGENCES_LOCALISEES ===
// v0.64.23 — « LOCALISER UNE DIVERGENCE DANS LA CONNAISSANCE QUI L'A PRODUITE » (GO ChatGPT « v0.64.23 », 15/10/2026). NIVEAU 1 seulement.
// VUE PURE, SYNCHRONE, DÉTERMINISTE. Aucune écriture, aucune table, aucune croyance nouvelle, aucun score, aucune fréquence, aucune révision.
//
// Elle répond à UNE question : pour une divergence RÉELLE (divergences.js : une production propre, une réaction de Christophe sur CETTE
// production, un attendu canoniquement différent de l'obtenu) et pour CHAQUE appui de cette production :
//   « quels champs de ce fait ont servi de CONTRAINTES (et avec quelles valeurs), quel champ a été DÉLIVRÉ, quelle valeur il a délivrée, et
//     l'attendu peut-il coexister avec ce fait sous l'invariant d'identité du magasin ? »
//
// PROJECTION : jamais déduite (ni égalité de valeurs, ni noms de rôles identiques aux noms de champs, ni texte de la question, ni texteMontre).
// Elle est DÉCLARÉE par la voie qui l'a réalisée — capacité : lecture.projection (registre.js) ; repondre (fait direct) : PROJECTION_REPONDRE_FAIT
// (pont.js) — puis VÉRIFIÉE sur les données HISTORIQUES persistées (arguments de la trace, appuis, obtenu). Déclaration absente, malformée ou
// démentie par les données : ABSTENTION (rien n'est rendu pour cette divergence). Le fait ACTUEL n'est jamais relu.
//
// PORTÉE SUR L'IDENTITÉ — seul invariant réel utilisé : le magasin de faits n'admet qu'UNE valeur sous l'identité cleFait(sujet, relation).
//   'incompatible-sous-identite' : les contraintes couvrent EXACTEMENT { sujet, relation }, le champ délivré est valeur, et l'attendu diffère
//     canoniquement de la valeur délivrée. Sens strict : « l'attendu ne peut pas coexister avec cette valeur sous cette même identité dans le
//     magasin actuel » — ni « le fait est faux », ni « l'attendu est vrai », ni « il faut remplacer ».
//   'indeterminee' : tous les autres cas. Aucun autre degré.
//
// PLUSIEURS APPUIS : une entrée par appui, dans l'ordre persisté, sans choix. `delivreEgaleAttendu` constate seulement l'égalité canonique de la
// valeur délivrée par CET appui et de l'attendu ; la divergence globale (obtenu pluriel) reste rappelée par `obtenu`. On observe des
// contributions ; on n'attribue aucune responsabilité.
//
// localiserDivergences({ divergences, traces }[, capacites[, projectionRepondre]]) -> [entree]
//   entree = { idReponseAttendue, idQuestion, question, [idReponseLocale], [idTrace], voie, appui, projection: { contraintes: [{ champ, valeur,
//              [role] }], delivre }, valeurDelivree, delivreEgaleAttendu, obtenu, attendu, porteeSurIdentite }
// notesLocalisation(appuisActuels, entrees) -> [texte] : une ligne par entrée dont l'appui est l'un des appuis actuels (identité de l'appui).
import { CAPACITES } from './registre.js';
import { canoniser } from './canon.js';
import { identiteAppui } from './divergences.js';
import { PROJECTION_REPONDRE_FAIT } from './pont.js';

const CHAMPS = Object.freeze(['sujet', 'relation', 'valeur']);
const tableau = (x) => (Array.isArray(x) ? x.filter((l) => l && typeof l === 'object') : []);
const estChaine = (x) => typeof x === 'string' && x.length > 0;
const estFait = (a) => a && typeof a === 'object' && CHAMPS.every((c) => typeof a[c] === 'string');
const memeListe = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

// Déclaration bien formée : champs connus, champ délivré non contraint, contraintes sans doublon ; `avecRoles` : chaque contrainte nomme un rôle.
function declarationValide(projection, avecRoles) {
  if (!projection || typeof projection !== 'object' || !Array.isArray(projection.contraintes) || !CHAMPS.includes(projection.delivre)) return false;
  const champs = projection.contraintes.map((c) => c && c.champ);
  if (!champs.length || !champs.every((c) => CHAMPS.includes(c)) || new Set(champs).size !== champs.length || champs.includes(projection.delivre)) return false;
  if (!avecRoles) return true;
  const roles = projection.contraintes.map((c) => c.role);
  return roles.every(estChaine) && new Set(roles).size === roles.length;
}

function portee(projection, valeurDelivree, attendu) {
  const champs = projection.contraintes.map((c) => c.champ);
  const identiteExacte = champs.length === 2 && champs.includes('sujet') && champs.includes('relation');
  return identiteExacte && projection.delivre === 'valeur' && canoniser(valeurDelivree) !== canoniser(attendu) ? 'incompatible-sous-identite' : 'indeterminee';
}

function entree(d, voie, appui, contraintes, delivre) {
  const valeurDelivree = appui[delivre];
  const projection = { contraintes, delivre };
  return {
    idReponseAttendue: d.idReponseAttendue,
    idQuestion: d.idQuestion,
    question: d.question,
    ...(estChaine(d.idReponseLocale) ? { idReponseLocale: d.idReponseLocale } : {}),
    ...(estChaine(d.idTrace) ? { idTrace: d.idTrace } : {}),
    voie,
    appui: { sujet: appui.sujet, relation: appui.relation, valeur: appui.valeur },
    projection,
    valeurDelivree,
    delivreEgaleAttendu: canoniser(valeurDelivree) === canoniser(d.attendu),
    obtenu: [...d.obtenu],
    attendu: d.attendu,
    porteeSurIdentite: portee(projection, valeurDelivree, d.attendu),
  };
}

// Voie Action (trace historique .21 ou réponse locale .22 de provenance action) : la projection de la capacité RÉELLE de la trace, vérifiée.
function localiserAction(d, trace, capacites) {
  if (!trace || trace.voie !== 'action') return [];
  const capacite = capacites[trace.capacite];
  const projection = capacite && capacite.lecture ? capacite.lecture.projection : undefined;
  if (!declarationValide(projection, true)) return []; // déclaration absente ou malformée : abstention
  const args = trace.argumentsUtilises;
  if (!args || typeof args !== 'object') return [];
  // Les rôles déclarés doivent être EXACTEMENT les arguments réellement utilisés (et les rôles de la capacité), avec des valeurs textuelles.
  const roles = projection.contraintes.map((c) => c.role);
  const utilises = Object.keys(args);
  if (roles.length !== utilises.length || !roles.every((r) => utilises.includes(r) && typeof args[r] === 'string')) return [];
  if (Array.isArray(capacite.roles) && (capacite.roles.length !== roles.length || !roles.every((r) => capacite.roles.includes(r)))) return [];
  const appuis = tableau(d.appuis);
  if (!appuis.length || !appuis.every(estFait)) return [];
  // Chaque appui satisfait canoniquement les contraintes déclarées, et le champ délivré de l'ensemble des appuis EST l'obtenu historique (même
  // ordre, même graphie) : le contrat de la capacité est démontré sur CETTE production. Sinon : abstention pour toute la divergence.
  if (!appuis.every((a) => projection.contraintes.every((c) => canoniser(a[c.champ]) === canoniser(args[c.role])))) return [];
  if (!memeListe(appuis.map((a) => a[projection.delivre]), d.obtenu)) return [];
  return appuis.map((a) => entree(d, 'action', a,
    projection.contraintes.map((c) => ({ champ: c.champ, valeur: a[c.champ], role: c.role })), projection.delivre));
}

// Voie repondre (fait direct, réponse locale .22) : l'appui est celui de la réponse locale, lu par son identité ; il délivre son champ déclaré.
function localiserRepondre(d, projection) {
  if (!declarationValide(projection, false)) return [];
  const appuis = tableau(d.appuis);
  if (appuis.length !== 1 || !estFait(appuis[0])) return [];
  const [a] = appuis;
  if (!memeListe([a[projection.delivre]], d.obtenu)) return [];
  return [entree(d, 'repondre', a, projection.contraintes.map((c) => ({ champ: c.champ, valeur: a[c.champ] })), projection.delivre)];
}

export function localiserDivergences({ divergences, traces }, capacites = CAPACITES, projectionRepondre = PROJECTION_REPONDRE_FAIT) {
  const parTrace = new Map(tableau(traces).map((t) => [t.id, t]));
  const sortie = [];
  for (const d of tableau(divergences)) {
    if (!Array.isArray(d.obtenu) || typeof d.attendu !== 'string') continue;
    const voie = d.provenance && typeof d.provenance === 'object' ? d.provenance.voie : (estChaine(d.idTrace) ? 'action' : undefined);
    if (voie === 'action' && estChaine(d.idTrace)) sortie.push(...localiserAction(d, parTrace.get(d.idTrace), capacites));
    else if (voie === 'repondre' && estChaine(d.idReponseLocale)) sortie.push(...localiserRepondre(d, projectionRepondre));
    // toute autre voie : aucune projection déclarée, abstention
  }
  return sortie;
}

// Texte STRUCTUREL et sobre : le champ délivré est nommé, pas interprété. Aucun mot d'évaluation.
const POSSESSIF = Object.freeze({ sujet: 'son sujet', relation: 'sa relation', valeur: 'sa valeur' });
export function notesLocalisation(appuisActuels, entrees) {
  const actuels = new Set(tableau(appuisActuels).filter(estFait).map(identiteAppui));
  return tableau(entrees).filter((e) => estFait(e.appui) && actuels.has(identiteAppui(e.appui))).map((e) => {
    const debut = `Dans ma réponse à « ${e.question === null ? '(question introuvable)' : e.question} », ${e.appui.sujet} → ${e.appui.relation} → ${e.appui.valeur} a fourni ${POSSESSIF[e.projection.delivre]} (${e.valeurDelivree}) ; tu attendais ${e.attendu}.`;
    return e.porteeSurIdentite === 'incompatible-sous-identite'
      ? `${debut} Ces deux valeurs ne peuvent pas coexister sous la même identité de connaissance.`
      : `${debut} La conséquence pour cette connaissance reste indéterminée.`;
  });
}
// === FIN_LANGAGE_DIVERGENCES_LOCALISEES ===
