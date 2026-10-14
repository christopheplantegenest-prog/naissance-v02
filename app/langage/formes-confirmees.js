// === DEBUT_LANGAGE_FORMES_CONFIRMEES ===
// v0.64.17 — « CONFIRMER UNE FORME INDUITE ET LA RENDRE ACTIVE » (GO ChatGPT « v0.64.17 », 14/10/2026), jalon E2.
// D'une FAMILLE supervisée déterminée (formes-supervisees.js, inchangé) à une RÈGLE proposée à Christophe, puis, s'il CONFIRME, à une Action
// de capacité de fait (v0.64.18 : proposerFait ou proposerFaitComplet) validée d'origine 'induite-supervisee' ; s'il REFUSE, à une décision persistée qui empêche de reproposer la même règle.
//
// RACCORD CODÉ (et seulement lui) : une famille de manifestations de FAITS se convertit vers une capacité DE FAIT du registre fermé.
// v0.64.18 — les capacités de fait sont celles que registre.js DÉCLARE `proposeFait: true` (aujourd'hui proposerFait : sujet constant ;
// proposerFaitComplet : sujet porté par le texte). La compatibilité est vérifiée STRUCTURELLEMENT contre ce que CHAQUE capacité de fait
// déclare : les champs « role » de la famille = exactement ses rôles, les champs « constanteCandidate » = exactement ses constantes, chacun
// avec UNE valeur, et aucun autre champ. Une seule capacité compatible : elle est retenue ; aucune : pas de proposition ; deux ou plus :
// ABSTENTION. Les noms de champs d'un fait SONT les noms déclarés de la capacité (contrat v0.64.13) : aucun mot français, aucune connaissance
// linguistique n'intervient. Toute autre famille (champ ambigu « roleOuConstante », inexpliqué…) : aucune proposition.
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

export const ORIGINE_INDUITE = 'induite-supervisee';
const LETTRES = ['X', 'Y', 'Z', 'W'];
const memesListes = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
const constantesDeclarees = (capacite) => (Array.isArray(capacite.constantes) ? [...capacite.constantes] : []);

// v0.64.18 — capacités de fait ADMISSIBLES : celles, et seulement celles, que le registre fermé DÉCLARE `proposeFait: true`. Aucun nom de
// capacité n'est écrit ici ; l'ordre du registre n'est jamais lu comme une préférence (voir capaciteDeFaitCompatible).
export function capacitesDeFait(capacites = CAPACITES) {
  return Object.keys(capacites).filter((operation) => capacites[operation] && capacites[operation].proposeFait === true);
}

// Contrat EXACT d'UNE capacité contre UNE famille déterminée : rôles de la famille = rôles déclarés, constantes candidates = constantes
// déclarées, chaque constante avec UNE valeur. (Le contrôle « aucun champ inexpliqué » est fait une fois, avant, pour toutes.)
function contratRespecte(famille, capacite) {
  const champs = Object.keys(famille.champs);
  const roles = champs.filter((c) => famille.champs[c].etat === 'role');
  const constantes = champs.filter((c) => famille.champs[c].etat === 'constanteCandidate');
  if (!memesListes(roles, [...capacite.roles]) || !memesListes(constantes, constantesDeclarees(capacite))) return 'incompatible';
  if (!constantes.every((c) => famille.champs[c].valeurs.length === 1)) return 'constante-indeterminee';
  return null;
}

// v0.64.18 — confronte une famille DÉTERMINÉE à TOUTES les capacités de fait déclarées : { ok: true, operation } si UNE SEULE respecte
// exactement son contrat ; sinon { ok: false, raison } : 'famille-non-determinee', 'champ-non-conforme' (un champ ni rôle ni constante
// candidate), 'incompatible' / 'constante-indeterminee' (aucune), 'plusieurs-capacites' (deux ou plus : ABSTENTION — jamais la première du
// registre, ni l'ancienne, ni la nouvelle, ni par ordre lexical). `capacites` n'est injectable que pour les tests (registre réel par défaut).
export function capaciteDeFaitCompatible(famille, capacites = CAPACITES) {
  if (!famille || famille.etat !== 'determinee') return { ok: false, raison: 'famille-non-determinee' };
  const champs = Object.keys(famille.champs);
  if (!champs.every((c) => famille.champs[c].etat === 'role' || famille.champs[c].etat === 'constanteCandidate')) return { ok: false, raison: 'champ-non-conforme' };
  const verdicts = capacitesDeFait(capacites).map((operation) => ({ operation, ecart: contratRespecte(famille, capacites[operation]) }));
  const compatibles = verdicts.filter((v) => v.ecart === null);
  if (compatibles.length > 1) return { ok: false, raison: 'plusieurs-capacites' };
  if (compatibles.length === 1) return { ok: true, operation: compatibles[0].operation };
  return { ok: false, raison: verdicts.some((v) => v.ecart === 'constante-indeterminee') ? 'constante-indeterminee' : 'incompatible' };
}

// Règle de la famille pour la capacité CHOISIE (capaciteDeFaitCompatible) : constantes = valeurs uniques des constantes que CETTE capacité
// déclare ({} si elle n'en déclare aucune).
export function regleDeLaFamille(famille, operation, capacites = CAPACITES) {
  const capacite = capacites[operation];
  const roles = Object.keys(famille.champs).filter((c) => famille.champs[c].etat === 'role')
    .map((nom) => ({ position: famille.champs[nom].position, nom })).sort((a, b) => a.position - b.position);
  const constantes = {};
  for (const c of constantesDeclarees(capacite)) constantes[c] = famille.champs[c].valeurs[0];
  const ancres = famille.signature.map((x, position) => (Object.hasOwn(x, 'jeton') ? { position, jeton: x.jeton } : null)).filter(Boolean);
  return { operation, n: famille.signature.length, ancres, roles, constantes };
}

// Les constantes ne sont transmises à evaluerAction / apprendreAction QUE si la règle en porte : une capacité sans constante les refuse
// (contrat exact v0.64.13, action.js inchangé), et l'identité de règle traite « absentes » comme {} (regle-forme.js).
const avecConstantes = (regle) => (Object.keys(regle.constantes).length ? { constantes: { ...regle.constantes } } : {});

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

// v0.64.18→19 — extraits TELS QUELS d'examinerFormeApresSupervision (comportement identique), pour être partagés avec l'inducteur de formes de
// question (reponses-attendues.js) : une règle candidate est soumise aux MÊMES contrôles, quelle que soit la supervision qui l'a fait naître.
// contratDeRegleRespecte(regle, exemples) : evaluerAction (action.js, inchangé) contrôle le CONTRAT ; ok exigé, positions des rôles et ancres
// recalculées sur les exemples identiques à la règle. Son statut n'est pas lu.
export function contratDeRegleRespecte(regle, exemples) {
  const evaluation = evaluerAction({ operation: regle.operation, roles: regle.roles.map((r) => r.nom), ...avecConstantes(regle), exemples });
  if (!evaluation.ok) return false;
  return JSON.stringify(evaluation.roles) === JSON.stringify(regle.roles)
    && JSON.stringify(calculerAncres({ n: evaluation.n, exemples: evaluation.exemples })) === JSON.stringify(regle.ancres);
}
// obstacleDeRegle({ actions, decisions }, regle, idCandidat) -> null | 'deja-decidee' | 'deja-couverte' | 'squelette-occupe' (lignes telles quelles).
export function obstacleDeRegle({ actions, decisions }, regle, idCandidat) {
  if ((decisions || []).some((d) => d && d.idCandidat === idCandidat)) return 'deja-decidee';
  const actives = (actions || []).filter((a) => a && (a.statut === 'validee' || a.statut === 'incertaine')).map((a) => ({ action: a, regle: regleSure(a) })).filter((x) => x.regle);
  if (actives.some((x) => x.action.statut === 'validee' && identiteSure(x.regle) === idCandidat)) return 'deja-couverte';
  if (actives.some((x) => memeSquelette(x.regle, regle) && identiteSure(x.regle) !== idCandidat)) return 'squelette-occupe';
  return null;
}

export async function examinerFormeApresSupervision(magasin, idMessage) {
  const { manifestations, valeurs, actions, decisions } = await lireLignesFormesSupervisees(magasin);
  const vue = formesSupervisees(manifestations, valeurs);
  const touchees = vue.familles.filter((f) => f.membres.includes(idMessage));
  if (touchees.length !== 1) return { raison: touchees.length === 0 ? 'aucune-famille' : 'plusieurs-familles' };
  const [famille] = touchees;
  if (famille.etat !== 'determinee') return { raison: `famille-${famille.etat}` };
  const compat = capaciteDeFaitCompatible(famille);
  if (!compat.ok) return { raison: compat.raison };
  const regle = regleDeLaFamille(famille, compat.operation);
  const idCandidat = identiteRegle(regle);
  const textes = new Map(valeurs.map((v) => [v.id, v.valeur]));
  const exemples = famille.membres.map((id) => textes.get(id));
  if (!contratDeRegleRespecte(regle, exemples)) return { raison: 'contrat' };
  const obstacle = obstacleDeRegle({ actions, decisions }, regle, idCandidat);
  if (obstacle) return { raison: obstacle };
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
    statut: 'validee', origine: ORIGINE_INDUITE, ...avecConstantes(regle),
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
