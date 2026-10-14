// === DEBUT_LANGAGE_FORMES_CONFIRMEES ===
// v0.64.17 — « CONFIRMER UNE FORME INDUITE ET LA RENDRE ACTIVE » (GO ChatGPT « v0.64.17 », 14/10/2026), jalon E2.
// D'une FAMILLE supervisée déterminée (formes-supervisees.js, inchangé) à une RÈGLE proposée à Christophe, puis, s'il CONFIRME, à une Action
// proposerFait validée d'origine 'induite-supervisee' ; s'il REFUSE, à une décision persistée qui empêche de reproposer la même règle.
//
// RACCORD UNIQUE ET CODÉ (et seulement lui) : une famille de manifestations de FAITS se convertit vers la capacité OPERATION_FORME_FAIT
// ('proposerFait'). La compatibilité est vérifiée STRUCTURELLEMENT contre ce que cette capacité DÉCLARE dans le registre fermé (registre.js) :
// les champs « role » de la famille = exactement ses rôles, les champs « constanteCandidate » = exactement ses constantes, chacun avec UNE
// valeur, et aucun autre champ. Les noms de champs d'un fait SONT les noms déclarés de la capacité (contrat v0.64.13) : aucun mot français,
// aucune connaissance linguistique n'intervient. Toute autre famille (sujet porté par une position, champ ambigu, inexpliqué…) : aucune proposition.
//
// CONVERSION : la règle est construite DIRECTEMENT depuis la famille (aucune leçon « Action : … » fabriquée) : operation, n = longueur de la
// signature, ancres = jetons littéraux de la signature, rôles = positions déterminées (noms des champs), constantes = valeurs uniques des
// constantes candidates, exemples = textes des membres résolus par leur identité. evaluerAction (action.js, inchangé) contrôle le CONTRAT
// (opération, rôles, constantes, arité, squelette, positions) : ok exigé, positions et ancres identiques à la règle. Son `statut`
// (positionsDistinguees) N'EST PAS lu : pour une forme supervisée, c'est « famille déterminée + confirmation humaine explicite » qui autorise
// 'validee'. positionsDistinguees n'est ni modifié ni réimposé.
//
// examinerFormeApresSupervision(magasin, idMessage) -> { proposition } | { raison }
//   Seul déclencheur prévu : main.js, juste APRÈS l'écriture réussie de la manifestation reference-explicite de idMessage. Ne considère QUE la
//   famille dont idMessage est membre (zéro ou plusieurs : abstention). Ne propose que si : famille 'determinee', compatible, aucune décision
//   pour son idCandidat, aucune Action 'validee' de même règle (« déjà couverte » — même apprise à la main), et aucune Action active
//   ('validee' ou 'incertaine') d'une AUTRE règle sur le MÊME squelette (apprendreAction la remplacerait : abstention). N'écrit RIEN.
//   proposition = { idCandidat, regle, exemples, sources, texte }.
// confirmerFormeSupervisee(magasin, proposition) -> { action, decision, echecDecision }
//   Revérifie qu'aucune décision n'existe et que la règle n'est pas déjà couverte, puis : 1. apprendreAction (statut 'validee', origine
//   'induite-supervisee') ; 2. SEULEMENT ensuite, la décision 'confirmee' avec idAction (le validateur refuse une décision sans Action réelle de
//   cette règle). Si 2 échoue : l'Action reste active (elle empêche la reproposition) ; l'échec est rendu dans echecDecision (provenance
//   dégradée, pas incohérence). Si apprendreAction fusionne dans une Action INACTIVE ('incertaine') de MÊME règle, ses exemples sont complétés
//   par ceux de la famille (même règle, aucun exemple étranger), son statut devient 'validee' et son origine historique est CONSERVÉE (jamais
//   réétiquetée) : la décision porte la provenance de la confirmation.
// refuserFormeSupervisee(magasin, proposition) -> decision   : UNE écriture, la décision 'refusee'. Rien d'autre n'est touché.
// texteProposition(famille, exemples) -> texte affiché (aucune position, aucun nom interne ; la constante est visible).
import { formesSupervisees } from './formes-supervisees.js';
import { CAPACITES } from './registre.js';
import { evaluerAction } from './action.js';
import { reassembler, calculerAncres } from './transformation.js';
import { identiteRegle, regleDeLAction } from './regle-forme.js';
import { apprendreAction, enregistrerDecisionForme, lireLignesFormesSupervisees } from './connaissances.js';

export const OPERATION_FORME_FAIT = 'proposerFait';
export const ORIGINE_INDUITE = 'induite-supervisee';
const LETTRES = ['X', 'Y', 'Z', 'W'];
const memesListes = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

export function compatibiliteProposerFait(famille) {
  if (!famille || famille.etat !== 'determinee') return { ok: false, raison: 'famille-non-determinee' };
  const capacite = CAPACITES[OPERATION_FORME_FAIT];
  const declares = { roles: [...capacite.roles], constantes: Array.isArray(capacite.constantes) ? [...capacite.constantes] : [] };
  const champs = Object.keys(famille.champs);
  const roles = champs.filter((c) => famille.champs[c].etat === 'role');
  const constantes = champs.filter((c) => famille.champs[c].etat === 'constanteCandidate');
  if (roles.length + constantes.length !== champs.length) return { ok: false, raison: 'champ-non-conforme' };
  if (!memesListes(roles, declares.roles) || !memesListes(constantes, declares.constantes)) return { ok: false, raison: 'incompatible' };
  if (!constantes.every((c) => famille.champs[c].valeurs.length === 1)) return { ok: false, raison: 'constante-indeterminee' };
  return { ok: true };
}

export function regleDeLaFamille(famille) {
  const capacite = CAPACITES[OPERATION_FORME_FAIT];
  const roles = Object.keys(famille.champs).filter((c) => famille.champs[c].etat === 'role')
    .map((nom) => ({ position: famille.champs[nom].position, nom })).sort((a, b) => a.position - b.position);
  const constantes = {};
  for (const c of capacite.constantes) constantes[c] = famille.champs[c].valeurs[0];
  const ancres = famille.signature.map((x, position) => (Object.hasOwn(x, 'jeton') ? { position, jeton: x.jeton } : null)).filter(Boolean);
  return { operation: OPERATION_FORME_FAIT, n: famille.signature.length, ancres, roles, constantes };
}

export function texteProposition(famille, exemples) {
  const roles = Object.keys(famille.champs).filter((c) => famille.champs[c].etat === 'role')
    .sort((a, b) => famille.champs[a].position - famille.champs[b].position);
  const lettre = Object.fromEntries(roles.map((c, i) => [c, LETTRES[i]]));
  const forme = reassembler(famille.signature.map((x) => (Object.hasOwn(x, 'jeton') ? x.jeton : lettre[x.champ])));
  const sens = ['sujet', 'relation', 'valeur'].map((c) => (lettre[c] !== undefined ? lettre[c] : famille.champs[c].valeurs[0])).join(' → ');
  return [
    "J'ai remarqué une forme commune à tes exemples :",
    ...exemples.map((t) => `« ${t} »`),
    '',
    'Je propose de comprendre désormais :',
    `« ${forme} »`,
    `comme : ${sens}.`,
    '',
    'Est-ce correct ?',
  ].join('\n');
}

const memeSquelette = (a, b) => a.n === b.n && JSON.stringify(a.ancres) === JSON.stringify(b.ancres);
function regleSure(action) { try { return regleDeLAction(action); } catch { return null; } }
function identiteSure(regle) { try { return regle ? identiteRegle(regle) : null; } catch { return null; } }

export async function examinerFormeApresSupervision(magasin, idMessage) {
  const { manifestations, valeurs, actions, decisions } = await lireLignesFormesSupervisees(magasin);
  const vue = formesSupervisees(manifestations, valeurs);
  const touchees = vue.familles.filter((f) => f.membres.includes(idMessage));
  if (touchees.length !== 1) return { raison: touchees.length === 0 ? 'aucune-famille' : 'plusieurs-familles' };
  const [famille] = touchees;
  if (famille.etat !== 'determinee') return { raison: `famille-${famille.etat}` };
  const compat = compatibiliteProposerFait(famille);
  if (!compat.ok) return { raison: compat.raison };
  const regle = regleDeLaFamille(famille);
  const idCandidat = identiteRegle(regle);
  const textes = new Map(valeurs.map((v) => [v.id, v.valeur]));
  const exemples = famille.membres.map((id) => textes.get(id));
  // contrôle du CONTRAT par evaluerAction ; son statut n'est pas lu
  const evaluation = evaluerAction({ operation: regle.operation, roles: regle.roles.map((r) => r.nom), constantes: { ...regle.constantes }, exemples });
  if (!evaluation.ok) return { raison: 'contrat' };
  if (JSON.stringify(evaluation.roles) !== JSON.stringify(regle.roles)
    || JSON.stringify(calculerAncres({ n: evaluation.n, exemples: evaluation.exemples })) !== JSON.stringify(regle.ancres)) return { raison: 'contrat' };
  if (decisions.some((d) => d && d.idCandidat === idCandidat)) return { raison: 'deja-decidee' };
  const actives = actions.filter((a) => a && (a.statut === 'validee' || a.statut === 'incertaine')).map((a) => ({ action: a, regle: regleSure(a) })).filter((x) => x.regle);
  if (actives.some((x) => x.action.statut === 'validee' && identiteSure(x.regle) === idCandidat)) return { raison: 'deja-couverte' };
  if (actives.some((x) => memeSquelette(x.regle, regle) && identiteSure(x.regle) !== idCandidat)) return { raison: 'squelette-occupe' };
  return { proposition: { idCandidat, regle, exemples, sources: [...famille.membres], texte: texteProposition(famille, exemples) } };
}

async function dejaTraitee(magasin, idCandidat) {
  const { actions, decisions } = await lireLignesFormesSupervisees(magasin);
  if (decisions.some((d) => d && d.idCandidat === idCandidat)) return 'deja-decidee';
  if (actions.some((a) => a && a.statut === 'validee' && identiteSure(regleSure(a)) === idCandidat)) return 'deja-couverte';
  return null;
}

export async function confirmerFormeSupervisee(magasin, proposition) {
  const { idCandidat, regle, exemples, sources } = proposition;
  const deja = await dejaTraitee(magasin, idCandidat);
  if (deja) throw new Error(deja === 'deja-decidee' ? 'Cette forme a déjà reçu ta réponse.' : 'Cette forme est déjà connue : rien n\'a été changé.');
  const { objet: action } = await apprendreAction(magasin, {
    operation: regle.operation, roles: regle.roles, n: regle.n, exemples: exemples.map((entree) => ({ entree })),
    statut: 'validee', origine: ORIGINE_INDUITE, constantes: { ...regle.constantes },
  });
  try {
    const decision = await enregistrerDecisionForme(magasin, { idCandidat, decision: 'confirmee', sources, idAction: action.id });
    return { action, decision, echecDecision: null };
  } catch (echecDecision) {
    return { action, decision: null, echecDecision };
  }
}

// decisionsIncoherentes(lignesDecisions, lignesActions) -> [idCandidat…] : décisions 'confirmee' dont l'Action est absente, non validée, ou
// d'une autre règle (possible seulement par import d'une sauvegarde : l'écriture le refuse). VUE PURE : elle EXPOSE l'incohérence, ne recrée
// rien et ne réinterprète aucune décision (une telle règle n'est pas non plus reproposée : sa décision existe). Triée, sans signification.
export function decisionsIncoherentes(lignesDecisions, lignesActions) {
  const parId = new Map((Array.isArray(lignesActions) ? lignesActions : []).filter((a) => a && typeof a === 'object').map((a) => [a.id, a]));
  return (Array.isArray(lignesDecisions) ? lignesDecisions : [])
    .filter((d) => d && d.decision === 'confirmee')
    .filter((d) => { const a = parId.get(d.idAction); return !a || a.statut !== 'validee' || identiteSure(regleSure(a)) !== d.idCandidat; })
    .map((d) => d.idCandidat).sort();
}

export async function refuserFormeSupervisee(magasin, proposition) {
  return enregistrerDecisionForme(magasin, { idCandidat: proposition.idCandidat, decision: 'refusee', sources: proposition.sources });
}
// === FIN_LANGAGE_FORMES_CONFIRMEES ===
