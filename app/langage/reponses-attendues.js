// === DEBUT_LANGAGE_REPONSES_ATTENDUES ===
// v0.64.19 — « APPRENDRE À UTILISER UNE CONNAISSANCE PAR LA RÉPONSE ATTENDUE » (GO ChatGPT « v0.64.19 », 14/10/2026).
// Christophe montre une QUESTION naturelle (geste « Répondre » sur sa bulle) et la RÉPONSE attendue (« Apprends : Réponse : Hugo. »). Il ne dit
// ni l'opération, ni les positions, ni les rôles. Naissance cherche, parmi ses capacités de LECTURE déclarées, quelle utilisation EXPLIQUE la
// réponse ; elle ne propose une forme générale que si plusieurs exemples indépendants convergent vers UNE SEULE explication structurelle.
//
// CAPACITÉS ADMISSIBLES : celles que le registre fermé DÉCLARE `lecture` (registre.js), à l'exclusion de toute capacité qui propose un fait
// (`proposeFait: true`). Aucun nom de capacité n'est écrit ici.
//
// « EXPLIQUE LA RÉPONSE » (contrat exact) : pour une affectation des jetons de la question aux rôles de la capacité, l'invocation (lecture pure)
// rend un résultat dont la liste DÉCLARÉE des réponses (lecture.reponses) contient EXACTEMENT UNE valeur, et cette valeur est ÉGALE à la réponse
// attendue selon l'identité canonique du moteur (canon.js : canoniser, la même que celle des faits). Aucune sous-chaîne, aucun « contient »,
// aucun score. Zéro valeur : rien n'est expliqué. Plusieurs valeurs : rien n'est expliqué non plus (le résultat ne désigne pas CETTE réponse ;
// aucun choix). Une invocation qui lève n'explique rien.
//
// EXPLICATION = la RÈGLE structurelle qu'elle définit : { operation, n = nombre de jetons, ancres = jetons de TOUTES les autres positions,
// roles = positions affectées (triées), constantes = {} } et son identité (regle-forme.js : identiteRegle). La réponse n'en fait jamais partie.
// Affectations : injectives, sur toutes les positions ; au-delà de LIMITE_JETONS jetons, aucune explication n'est cherchée (abstention).
//
// INDÉPENDANCE DES EXEMPLES : un message n'a qu'UNE réponse attendue (table immuable). Deux messages dont les jetons canoniques sont identiques
// forment UN SEUL exemple (jamais deux preuves) ; s'ils portent des réponses canoniques différentes, l'exemple est CONTRADICTOIRE et ne sert
// jamais. Le représentant d'un exemple est son message de plus petite identité.
//
// INDUCTION (examinerReponseApresSupervision), déclenchée APRÈS l'écriture d'une réponse attendue pour le message M :
//   1. explications du représentant de l'exemple de M, calculées CONTRE L'ÉTAT ACTUEL (revalidation : rien n'est mis en cache) ;
//   2. pour chaque explication candidate, les exemples (non contradictoires) dont l'explication ACTUELLE la contient aussi ;
//   3. une candidate n'est retenue que si au moins DEUX exemples la soutiennent ET que chaque position de rôle y prend au moins deux valeurs
//      canoniques différentes (un rôle jamais varié n'est pas démontré : même logique que v0.64.16) ;
//   4. 0 retenue : abstention ; 2+ : abstention ; 1 : contrat (contratDeRegleRespecte) et obstacles (obstacleDeRegle) de formes-confirmees.js,
//      puis proposition. N'écrit RIEN. Confirmer / Refuser réutilisent confirmerFormeSupervisee / refuserFormeSupervisee (Action validée
//      d'origine induite-supervisee + decisionsFormes).
import { CAPACITES } from './registre.js';
import { canoniser } from './canon.js';
import { tokeniser } from './transformation.js';
import { identiteRegle } from './regle-forme.js';
import { contratDeRegleRespecte, obstacleDeRegle } from './formes-confirmees.js';
import { lireLignesReponsesAttendues } from './connaissances.js';
import { grouperExemples, retenirExplication, formeAvecLettres, plusPetit } from './explication-supervisee.js'; // v0.64.20 — noyau commun extrait

export const LIMITE_JETONS = 12;

// « Réponse : Hugo. » (contenu d'une leçon après « Apprends : ») -> { reponse: 'Hugo' } ; autre forme -> null. Un seul point final est retiré.
// La réponse peut être vide ({ reponse: '' }) : c'est à l'appelant de refuser.
export function extraireReponseAttendue(contenuLecon) {
  const m = /^r[ée]ponse\s*:\s*(.*)$/i.exec(String(contenuLecon || '').trim());
  if (!m) return null;
  return { reponse: m[1].trim().replace(/\.$/, '').trim() };
}

export function capacitesDeLecture(capacites = CAPACITES) {
  return Object.keys(capacites).filter((op) => {
    const c = capacites[op];
    return Boolean(c) && c.proposeFait !== true && Boolean(c.lecture) && typeof c.lecture.reponses === 'function' && typeof c.invoquer === 'function';
  });
}

function affectations(n, k) {
  if (k === 0) return [[]];
  const sortie = [];
  for (const reste of affectations(n, k - 1)) for (let i = 0; i < n; i += 1) if (!reste.includes(i)) sortie.push([...reste, i]);
  return sortie;
}

function explique(capacite, resultat, reponse) {
  let valeurs;
  try { valeurs = capacite.lecture.reponses(resultat); } catch { return false; }
  return Array.isArray(valeurs) && valeurs.length === 1 && typeof valeurs[0] === 'string' && canoniser(valeurs[0]) === canoniser(reponse);
}

// explications(question, reponse, esprit[, capacites]) -> [{ id, regle }], triées par id (ordre sans signification). Lecture seule.
export function explications(question, reponse, esprit, capacites = CAPACITES) {
  const jetons = tokeniser(question);
  if (!jetons.length || jetons.length > LIMITE_JETONS || typeof reponse !== 'string' || !reponse.trim()) return [];
  const sortie = new Map();
  for (const operation of capacitesDeLecture(capacites)) {
    const capacite = capacites[operation];
    for (const positions of affectations(jetons.length, capacite.roles.length)) {
      const argumentsNommes = {};
      capacite.roles.forEach((nom, i) => { argumentsNommes[nom] = jetons[positions[i]]; });
      let resultat;
      try { resultat = capacite.invoquer(esprit, argumentsNommes); } catch { continue; }
      if (!explique(capacite, resultat, reponse)) continue;
      const roles = capacite.roles.map((nom, i) => ({ position: positions[i], nom })).sort((a, b) => a.position - b.position);
      const prises = new Set(positions);
      const ancres = jetons.map((jeton, position) => (prises.has(position) ? null : { position, jeton })).filter(Boolean);
      const regle = { operation, n: jetons.length, ancres, roles, constantes: {} };
      const id = identiteRegle(regle);
      if (!sortie.has(id)) sortie.set(id, { id, regle });
    }
  }
  return [...sortie.values()].sort((a, b) => plusPetit(a.id, b.id));
}

// Exemples indépendants, à partir des lignes telles quelles : [{ cle, representant: { idMessage, question, reponse }, membres, contradictoire }].
// v0.64.20 — le regroupement est celui du noyau commun (explication-supervisee.js : grouperExemples), inchangé. `exclus` (facultatif) : identités de
// messages qui ne sont PAS des questions naturelles (énoncés en réaction à une réponse de Naissance : leur réponse supervisée est une correction,
// examinée par corrections-apprises.js) ; absent = aucune exclusion (comportement v0.64.19).
export function exemplesIndependants(lignesReponses, lignesValeurs, exclus = new Set()) {
  const textes = new Map((Array.isArray(lignesValeurs) ? lignesValeurs : []).filter((v) => v && typeof v === 'object' && typeof v.valeur === 'string').map((v) => [v.id, v.valeur]));
  const exemples = [];
  for (const r of (Array.isArray(lignesReponses) ? lignesReponses : [])) {
    if (!r || typeof r !== 'object' || typeof r.idMessage !== 'string' || typeof r.reponse !== 'string' || !r.reponse.trim() || !textes.has(r.idMessage) || exclus.has(r.idMessage)) continue;
    exemples.push({ idMessage: r.idMessage, texte: textes.get(r.idMessage), resultat: r.reponse });
  }
  return grouperExemples(exemples).map((g) => ({ ...g, representant: { idMessage: g.representant.idMessage, question: g.representant.texte, reponse: g.representant.resultat } }));
}

export function texteProposition(regle, exemples, capacites = CAPACITES) {
  const { lettres, forme } = formeAvecLettres(regle);
  return [
    "J'ai remarqué une forme commune à tes exemples :",
    ...exemples.map((x) => `« ${x.question} » → ${x.reponse}`),
    '',
    'Je propose de comprendre désormais :',
    `« ${forme} »`,
    `comme : ${capacites[regle.operation].lecture.sens(lettres)}.`,
    '',
    'Est-ce correct ?',
  ].join('\n');
}

// examinerReponseApresSupervision(magasin, esprit, idMessage[, capacites]) -> { proposition } | { raison }. N'écrit RIEN.
// raisons : 'aucun-exemple', 'contradiction', 'aucune-explication', 'insuffisant', 'role-non-demontre', 'plusieurs-explications', 'contrat',
// 'deja-decidee', 'deja-couverte', 'squelette-occupe'.
export async function examinerReponseApresSupervision(magasin, esprit, idMessage, capacites = CAPACITES) {
  const { reponses, valeurs, actions, decisions, enonces } = await lireLignesReponsesAttendues(magasin);
  const exclus = messagesEnSituation(enonces);
  if (exclus.has(idMessage)) return { raison: 'aucun-exemple' };
  const exemples = exemplesIndependants(reponses, valeurs, exclus);
  const cible = exemples.find((x) => x.membres.includes(idMessage));
  if (!cible) return { raison: 'aucun-exemple' };
  if (cible.contradictoire) return { raison: 'contradiction' };
  const explicationsDe = (g) => explications(g.representant.question, g.representant.reponse, esprit, capacites);
  // le noyau lit les jetons du représentant par `texte` : alias en lecture seule, aucune donnée nouvelle
  const pourNoyau = (g) => ({ ...g, representant: { ...g.representant, texte: g.representant.question } });
  const groupes = exemples.map(pourNoyau);
  const cibleNoyau = groupes[exemples.indexOf(cible)];
  const verdict = retenirExplication(cibleNoyau, groupes, explicationsDe);
  if (!verdict.explication) return { raison: verdict.raison };
  const { explication: c, soutiens } = verdict;
  const textesExemples = soutiens.map((x) => x.representant.question);
  if (!contratDeRegleRespecte(c.regle, textesExemples)) return { raison: 'contrat' };
  const obstacle = obstacleDeRegle({ actions, decisions }, c.regle, c.id);
  if (obstacle) return { raison: obstacle };
  return {
    proposition: {
      idCandidat: c.id,
      regle: c.regle,
      exemples: textesExemples,
      sources: soutiens.map((x) => x.representant.idMessage),
      texte: texteProposition(c.regle, soutiens.map((x) => x.representant), capacites),
    },
  };
}

// v0.64.20 — messages qui sont des ÉNONCÉS EN RÉACTION à une réponse de Naissance identifiable (énoncé portant l'identité de son message) : leur
// réponse supervisée n'est pas celle d'une question naturelle. Lignes telles quelles ; aucune jointure par le texte.
export function messagesEnSituation(lignesEnonces) {
  return new Set((Array.isArray(lignesEnonces) ? lignesEnonces : []).filter((x) => x && typeof x === 'object' && typeof x.idMessage === 'string' && x.idMessage.length > 0).map((x) => x.idMessage));
}
// === FIN_LANGAGE_REPONSES_ATTENDUES ===
