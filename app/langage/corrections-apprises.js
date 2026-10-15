// === DEBUT_LANGAGE_CORRECTIONS_APPRISES ===
// v0.64.20 — « APPRENDRE LA FORME D'UNE CORRECTION NATURELLE » (GO ChatGPT « v0.64.20 », 15/10/2026).
// NOUVEAU CLIENT du noyau commun (explication-supervisee.js), pas un troisième inducteur : seul le CONTENU d'une explication change.
//
// SITUATION (le contexte fait partie du sens appris) : un message E est EN SITUATION si et seulement si un énoncé porte son identité (idMessage,
// écrit par pont.js au moment de la réaction) ET que cet énoncé répond à une TRACE de voie 'action' qui porte l'identité de la QUESTION Q ayant
// produit cette réponse locale (idMessage de la trace, écrit par main.js). Chaîne entièrement persistante : Q → trace → énoncé E. Aucune
// jointure par le texte, l'ordre ou « le dernier message ». Hors situation : rien n'est jamais examiné ni reconnu.
// v0.64.22 — la question se lit aussi sur la CIBLE moderne de l'énoncé : une RÉPONSE LOCALE (table reponsesLocales, voie Action ou repondre),
// exclusivement quand l'énoncé en porte une. Chaîne : Q → réponse locale → énoncé E. Même forme apprise, même sens, aucun autre effet.
//
// EXEMPLE SUPERVISÉ (échafaudage) : une réponse attendue (table reponsesAttendues, v0.64.19, inchangée) écrite pour un message EN SITUATION
// (« Apprends : Réponse : Zoé. » avec Répondre sur E). Le programme ne connaît le sens d'AUCUN mot de E.
// EXPLICATION : l'acte pédagogique reponseAttendue (actes-pedagogiques.js) explique E/R pour chaque position i dont le jeton est canoniquement
// égal à R (canon.js) : règle { operation: 'reponseAttendue', n, ancres = toutes les autres positions, roles: [reponse@i], constantes: {} }.
// INDUCTION : celle du noyau (indépendance, ≥ 2 exemples soutenant UNE explication, rôle varié ; sinon abstention).
// ACTIVATION : la règle n'est PAS une Action (elle serait reconnue partout, hors situation) ; c'est la DÉCISION confirmée (decisionsFormes) qui
// porte la règle. Refus : décision refusée. Une forme active ne sert QUE dans sa situation (reconnaitreCorrection).
// AUCUN effet sur les faits, les Actions ou les capacités : le seul effet possible, après confirmation de Christophe, est une réponse attendue.
import { canoniser } from './canon.js';
import { tokeniser } from './transformation.js';
import { identiteRegle } from './regle-forme.js';
import { ACTES_PEDAGOGIQUES } from './actes-pedagogiques.js';
import { grouperExemples, retenirExplication, formeAvecLettres, ancresCoherentes, valeursSelonRegle, plusPetit } from './explication-supervisee.js';
import { lireLignesCorrections, enregistrerDecisionForme } from './connaissances.js';

export const ACTE_CORRECTION = 'reponseAttendue';
const tableau = (x) => (Array.isArray(x) ? x.filter((l) => l && typeof l === 'object') : []);

// situationsDeReaction(lignesEnonces, lignesTraces[, lignesReponsesLocales]) -> Map(idMessage de E -> situation). Un message porté par plusieurs
// énoncés (anormal) n'est pas en situation : aucun choix.
// v0.64.22 — DEUX chemins EXCLUSIFS, choisis par l'énoncé lui-même (jamais par le texte) :
//   - MODERNE : l'énoncé porte idReponseLocale → la question est celle de la RÉPONSE LOCALE (reponseLocale.idQuestion), quelle que soit sa voie
//     (Action ou repondre) ; situation { idReponseLocale, idQuestion[, idTrace si provenance Action] }. Réponse locale introuvable : hors situation
//     (le chemin historique n'est JAMAIS tenté pour cet énoncé : aucune double conséquence) ;
//   - HISTORIQUE : énoncé sans idReponseLocale → trace voie 'action' portant la question (comportement v0.64.20 inchangé) ; { idTrace, idQuestion }.
export function situationsDeReaction(lignesEnonces, lignesTraces, lignesReponsesLocales = []) {
  const traces = new Map(tableau(lignesTraces).map((t) => [t.id, t]));
  const locales = new Map(tableau(lignesReponsesLocales).map((r) => [r.id, r]));
  const parMessage = new Map();
  for (const x of tableau(lignesEnonces)) {
    if (typeof x.idMessage !== 'string' || !x.idMessage) continue;
    parMessage.set(x.idMessage, [...(parMessage.get(x.idMessage) || []), x]);
  }
  const sortie = new Map();
  for (const [idMessage, enonces] of parMessage) {
    if (enonces.length !== 1) continue;
    if (typeof enonces[0].idReponseLocale === 'string' && enonces[0].idReponseLocale) {
      const r = locales.get(enonces[0].idReponseLocale);
      if (!r || typeof r.idQuestion !== 'string' || !r.idQuestion || r.idQuestion === idMessage) continue;
      const p = r.provenance && typeof r.provenance === 'object' ? r.provenance : {};
      sortie.set(idMessage, { idReponseLocale: r.id, idQuestion: r.idQuestion, ...(p.voie === 'action' && typeof p.idTrace === 'string' ? { idTrace: p.idTrace } : {}) });
      continue;
    }
    const trace = traces.get(enonces[0].idTrace);
    if (!trace || trace.voie !== 'action' || typeof trace.idMessage !== 'string' || !trace.idMessage || trace.idMessage === idMessage) continue;
    sortie.set(idMessage, { idTrace: trace.id, idQuestion: trace.idMessage });
  }
  return sortie;
}

// explicationsCorrection(texte, resultat) -> [{ id, regle }] : une par position dont le jeton vaut canoniquement le résultat supervisé.
export function explicationsCorrection(texte, resultat) {
  const jetons = tokeniser(texte);
  const [role] = ACTES_PEDAGOGIQUES[ACTE_CORRECTION].roles;
  if (typeof resultat !== 'string' || !resultat.trim()) return [];
  const sortie = [];
  jetons.forEach((jeton, i) => {
    if (canoniser(jeton) !== canoniser(resultat)) return;
    if (canoniser(ACTES_PEDAGOGIQUES[ACTE_CORRECTION].produit({ [role]: jeton })) !== canoniser(resultat)) return;
    const regle = { operation: ACTE_CORRECTION, n: jetons.length, ancres: jetons.map((j, p) => (p === i ? null : { position: p, jeton: j })).filter(Boolean), roles: [{ position: i, nom: role }], constantes: {} };
    sortie.push({ id: identiteRegle(regle), regle });
  });
  return sortie.sort((a, b) => plusPetit(a.id, b.id));
}

const formesActives = (decisions) => tableau(decisions).filter((d) => d.decision === 'confirmee' && d.regle && d.regle.operation === ACTE_CORRECTION);

export function texteProposition(regle, exemples) {
  const { lettres, forme } = formeAvecLettres(regle);
  return [
    "J'ai remarqué une forme commune à tes corrections :",
    ...exemples.map((x) => `« ${x.texte} » → ${x.resultat}`),
    '',
    'Je propose de comprendre désormais, quand tu réponds ainsi à l\'une de mes réponses :',
    `« ${forme} »`,
    `comme ${ACTES_PEDAGOGIQUES[ACTE_CORRECTION].sens(lettres)}.`,
    '',
    'Est-ce correct ?',
  ].join('\n');
}

// examinerCorrectionApresSupervision(magasin, idMessage) -> { proposition } | { raison }. N'écrit RIEN.
// raisons : 'hors-situation', 'aucun-exemple', 'contradiction', 'aucune-explication', 'insuffisant', 'role-non-demontre', 'plusieurs-explications',
// 'contrat', 'deja-decidee', 'squelette-occupe'.
export async function examinerCorrectionApresSupervision(magasin, idMessage) {
  const { reponses, valeurs, enonces, traces, decisions, reponsesLocales } = await lireLignesCorrections(magasin);
  const situations = situationsDeReaction(enonces, traces, reponsesLocales);
  if (!situations.has(idMessage)) return { raison: 'hors-situation' };
  const textes = new Map(tableau(valeurs).filter((v) => typeof v.valeur === 'string').map((v) => [v.id, v.valeur]));
  const exemples = tableau(reponses)
    .filter((r) => typeof r.idMessage === 'string' && situations.has(r.idMessage) && textes.has(r.idMessage) && typeof r.reponse === 'string' && r.reponse.trim())
    .map((r) => ({ idMessage: r.idMessage, texte: textes.get(r.idMessage), resultat: r.reponse }));
  const groupes = grouperExemples(exemples);
  const cible = groupes.find((g) => g.membres.includes(idMessage));
  if (!cible) return { raison: 'aucun-exemple' };
  if (cible.contradictoire) return { raison: 'contradiction' };
  const verdict = retenirExplication(cible, groupes, (g) => explicationsCorrection(g.representant.texte, g.representant.resultat));
  if (!verdict.explication) return { raison: verdict.raison };
  const { explication: c, soutiens } = verdict;
  const textesExemples = soutiens.map((g) => g.representant.texte);
  if (!ancresCoherentes(c.regle, textesExemples)) return { raison: 'contrat' };
  if (tableau(decisions).some((d) => d.idCandidat === c.id)) return { raison: 'deja-decidee' };
  const memeSquelette = (r) => r.n === c.regle.n && JSON.stringify(r.ancres) === JSON.stringify(c.regle.ancres);
  if (formesActives(decisions).some((d) => d.idCandidat !== c.id && memeSquelette(d.regle))) return { raison: 'squelette-occupe' };
  return {
    proposition: {
      idCandidat: c.id,
      regle: c.regle,
      exemples: textesExemples,
      sources: soutiens.map((g) => g.representant.idMessage),
      texte: texteProposition(c.regle, soutiens.map((g) => g.representant)),
    },
  };
}

// Confirmer : UNE écriture, la décision 'confirmee' qui PORTE la règle (connaissances.js la valide : acte déclaré, identité exacte, immuable).
export async function confirmerFormeCorrection(magasin, proposition) {
  return enregistrerDecisionForme(magasin, { idCandidat: proposition.idCandidat, decision: 'confirmee', sources: proposition.sources, regle: proposition.regle });
}
export async function refuserFormeCorrection(magasin, proposition) {
  return enregistrerDecisionForme(magasin, { idCandidat: proposition.idCandidat, decision: 'refusee', sources: proposition.sources });
}

// reconnaitreCorrection(magasin, { idMessage, texte }) -> { reconnue: false, raison } | { reconnue: true, idQuestion, question, reponse, idForme }.
// N'écrit RIEN. Exige la SITUATION (E en réaction à une réponse locale identifiable) ; une seule forme active doit correspondre (sinon abstention).
export async function reconnaitreCorrection(magasin, { idMessage, texte }) {
  const { valeurs, enonces, traces, decisions, reponsesLocales } = await lireLignesCorrections(magasin);
  const situation = situationsDeReaction(enonces, traces, reponsesLocales).get(idMessage);
  if (!situation) return { reconnue: false, raison: 'hors-situation' };
  const correspondances = formesActives(decisions).map((d) => ({ d, v: valeursSelonRegle(d.regle, texte) })).filter((x) => x.v);
  if (correspondances.length !== 1) return { reconnue: false, raison: correspondances.length ? 'ambigu' : 'aucune-forme' };
  const question = tableau(valeurs).find((v) => v.id === situation.idQuestion);
  if (!question || typeof question.valeur !== 'string') return { reconnue: false, raison: 'question-introuvable' };
  const [{ d, v }] = correspondances;
  const reponse = ACTES_PEDAGOGIQUES[ACTE_CORRECTION].produit(v);
  if (typeof reponse !== 'string' || !reponse.trim()) return { reconnue: false, raison: 'aucune-reponse' };
  return { reconnue: true, idQuestion: situation.idQuestion, question: question.valeur, reponse, idForme: d.idCandidat };
}
// === FIN_LANGAGE_CORRECTIONS_APPRISES ===
