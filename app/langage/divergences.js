// === DEBUT_LANGAGE_DIVERGENCES ===
// v0.64.21 — « RATTACHER UNE CORRECTION AUX CONNAISSANCES QUI ONT PRODUIT LA RÉPONSE » (GO ChatGPT « v0.64.21 », 15/10/2026).
// VUE PURE, SYNCHRONE, DÉTERMINISTE. Aucune écriture, aucune table, aucun mot « erreur » : une DIVERGENCE dit seulement
//   « l'exécution T a produit R1 ; la réponse attendue CONFIRMÉE pour sa question était R2 ; R1 ne vaut pas exactement R2 ».
// Elle ne dit jamais qu'un fait est faux, ni pourquoi.
//
// RATTACHEMENT (identités persistées seulement, jamais par le texte) — une réponse attendue r est rattachée à une trace T si :
//   - correction comprise (v0.64.20) : r.idLecon est le message d'un énoncé (unique) sur T, et T.idMessage === r.idMessage (la question) ;
//   - correction supervisée (échafaudage v0.64.20) : r.idMessage est le message d'un énoncé (unique) sur T, et T porte une question différente.
// OBTENU : la liste déclarée par la capacité de T (lecture.reponses, registre.js) sur T.resultat PERSISTÉ. Concordance = exactement une valeur,
// canoniquement égale à R2 (même contrat que l'explication v0.64.19) ; sinon divergence. Capacité sans lecture : rien (aucune lecture inventée).
// APPUIS : ceux PERSISTÉS dans T à l'exécution (trace.appuis), copiés tels quels ; une trace qui n'en porte pas (antérieure à v0.64.21, autre voie)
// donne une divergence SANS appuis — jamais reconstruits depuis l'état actuel. idAction : seulement s'il est persisté dans T.
//
// HISTOIRE D'UNE CONNAISSANCE QUI RESSERT : historiqueDesAppuis(appuisActuels, divergences) rend, pour CHAQUE appui actuel (sans choix, dans
// l'ordre reçu, doublons fusionnés) qui figure parmi les appuis historiques d'au moins une divergence, toutes ces divergences. Identité d'un
// appui = identité du fait (cleFait : sujet + relation canoniques, connaissances.js) + valeur canonique : un fait dont la valeur a changé depuis
// n'a PAS l'histoire de l'ancien (l'histoire n'est pas réécrite), et des mots seulement voisins ne correspondent jamais.
import { CAPACITES } from './registre.js';
import { canoniser } from './canon.js';
import { cleFait } from './connaissances.js';

const tableau = (x) => (Array.isArray(x) ? x.filter((l) => l && typeof l === 'object') : []);
const plusPetit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const estChaine = (x) => typeof x === 'string' && x.length > 0;
export const identiteAppui = (a) => [cleFait(a.sujet, a.relation), canoniser(a.valeur)].join('\u0001');

function enonceUnique(parMessage, idMessage) {
  const liste = parMessage.get(idMessage);
  return liste && liste.length === 1 ? liste[0] : null;
}

// divergencesDeReponses({ reponses, enonces, traces, valeurs }[, capacites]) -> [divergence], triées (idTrace, idReponseAttendue).
// divergence = { idReponseAttendue, idTrace, idQuestion, question, [idAction], obtenu: [..], attendu, appuis: [{ sujet, relation, valeur }] }
export function divergencesDeReponses({ reponses, enonces, traces, valeurs }, capacites = CAPACITES) {
  const parTrace = new Map(tableau(traces).map((t) => [t.id, t]));
  const textes = new Map(tableau(valeurs).filter((v) => typeof v.valeur === 'string').map((v) => [v.id, v.valeur]));
  const parMessage = new Map();
  for (const x of tableau(enonces)) if (estChaine(x.idMessage)) parMessage.set(x.idMessage, [...(parMessage.get(x.idMessage) || []), x]);
  const sortie = [];
  for (const r of tableau(reponses)) {
    if (!estChaine(r.idMessage) || typeof r.reponse !== 'string' || !r.reponse.trim()) continue;
    let trace = null;
    const parLecon = estChaine(r.idLecon) ? enonceUnique(parMessage, r.idLecon) : null;
    if (parLecon) { const t = parTrace.get(parLecon.idTrace); if (t && t.idMessage === r.idMessage) trace = t; }
    if (!trace) {
      const parReaction = enonceUnique(parMessage, r.idMessage);
      if (parReaction) { const t = parTrace.get(parReaction.idTrace); if (t && estChaine(t.idMessage) && t.idMessage !== r.idMessage) trace = t; }
    }
    if (!trace) continue;
    const capacite = capacites[trace.capacite];
    if (!capacite || !capacite.lecture || typeof capacite.lecture.reponses !== 'function') continue;
    let obtenu;
    try { obtenu = capacite.lecture.reponses(trace.resultat); } catch { continue; }
    if (!Array.isArray(obtenu)) continue;
    if (obtenu.length === 1 && typeof obtenu[0] === 'string' && canoniser(obtenu[0]) === canoniser(r.reponse)) continue; // concordance
    sortie.push({
      idReponseAttendue: r.idMessage,
      idTrace: trace.id,
      idQuestion: trace.idMessage,
      question: textes.has(trace.idMessage) ? textes.get(trace.idMessage) : null,
      ...(estChaine(trace.idAction) ? { idAction: trace.idAction } : {}),
      obtenu: [...obtenu],
      attendu: r.reponse,
      appuis: Array.isArray(trace.appuis) ? trace.appuis.map((a) => ({ sujet: a.sujet, relation: a.relation, valeur: a.valeur })) : [],
    });
  }
  return sortie.sort((a, b) => plusPetit(a.idTrace, b.idTrace) || plusPetit(a.idReponseAttendue, b.idReponseAttendue));
}

// historiqueDesAppuis(appuisActuels, divergences) -> [{ appui, divergences: [..] }] (appuis sans histoire omis ; aucun choix).
export function historiqueDesAppuis(appuisActuels, divergences) {
  const vus = new Set();
  const sortie = [];
  for (const appui of tableau(appuisActuels)) {
    if (!['sujet', 'relation', 'valeur'].every((c) => typeof appui[c] === 'string')) continue;
    const cle = identiteAppui(appui);
    if (vus.has(cle)) continue;
    vus.add(cle);
    const concernees = tableau(divergences).filter((d) => tableau(d.appuis).some((h) => identiteAppui(h) === cle));
    if (concernees.length) sortie.push({ appui: { sujet: appui.sujet, relation: appui.relation, valeur: appui.valeur }, divergences: concernees });
  }
  return sortie;
}

// Une note par appui concerné ; toutes les divergences de cet appui sont citées.
export function notesHistoire(historique) {
  return tableau(historique).map(({ appui, divergences }) => {
    const cas = divergences.map((d) => `« ${d.question === null ? '(question introuvable)' : d.question} » → tu attendais ${d.attendu}`);
    const debut = `Ce que je sais ici (${appui.sujet} → ${appui.relation} → ${appui.valeur}) a déjà contribué à `;
    return cas.length === 1
      ? `${debut}une réponse que tu as corrigée : ${cas[0]}.`
      : `${debut}des réponses que tu as corrigées : ${cas.join(' ; ')}.`;
  });
}
// === FIN_LANGAGE_DIVERGENCES ===
