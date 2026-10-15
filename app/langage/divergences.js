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
//
// v0.64.22 — CIBLE MODERNE : un énoncé qui porte idReponseLocale est lu EXCLUSIVEMENT par sa réponse locale (table 'reponsesLocales') : question,
// obtenu et appuis y sont déjà HISTORIQUES (fixés au moment de la réponse, aucune lecture de capacité, aucune reconstruction). Le chemin par la
// trace reste réservé aux énoncés SANS idReponseLocale (v0.64.20/.21) : une réaction à une réponse Action .22 (qui porte aussi idTrace) ne produit
// donc jamais deux divergences. Divergence moderne = { idReponseAttendue, idReponseLocale, idQuestion, question, provenance, [idTrace, idAction si
// provenance Action], obtenu, attendu, appuis }. Deux divergences d'un même appui restent deux conséquences distinctes (question → attendu chacune).
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
export function divergencesDeReponses({ reponses, enonces, traces, valeurs, reponsesLocales }, capacites = CAPACITES) {
  const parTrace = new Map(tableau(traces).map((t) => [t.id, t]));
  const parLocale = new Map(tableau(reponsesLocales).map((r) => [r.id, r]));
  const textes = new Map(tableau(valeurs).filter((v) => typeof v.valeur === 'string').map((v) => [v.id, v.valeur]));
  const parMessage = new Map();
  for (const x of tableau(enonces)) if (estChaine(x.idMessage)) parMessage.set(x.idMessage, [...(parMessage.get(x.idMessage) || []), x]);
  const sortie = [];
  const ordre = new Map(); // v0.64.22 — clé de présentation interne (jamais exposée) : moment de la réponse produite, puis son identité.
  // v0.64.22 — CIBLE d'un énoncé, choisie par l'énoncé lui-même : idReponseLocale → réponse locale EXCLUSIVEMENT (son idTrace éventuel n'est
  // jamais relu ici) ; sinon → trace (chemin historique). `questionValide(idQ)` exprime la condition de rattachement propre à chaque étape.
  const cible = (enonce, questionValide) => {
    if (!enonce) return null;
    if (estChaine(enonce.idReponseLocale)) {
      const l = parLocale.get(enonce.idReponseLocale);
      return l && estChaine(l.idQuestion) && questionValide(l.idQuestion) ? { locale: l } : null;
    }
    const t = parTrace.get(enonce.idTrace);
    return t && estChaine(t.idMessage) && questionValide(t.idMessage) ? { trace: t } : null;
  };
  for (const r of tableau(reponses)) {
    if (!estChaine(r.idMessage) || typeof r.reponse !== 'string' || !r.reponse.trim()) continue;
    const parLecon = estChaine(r.idLecon) ? enonceUnique(parMessage, r.idLecon) : null;
    const trouvee = cible(parLecon, (q) => q === r.idMessage) || cible(enonceUnique(parMessage, r.idMessage), (q) => q !== r.idMessage);
    if (!trouvee) continue;
    if (trouvee.locale) {
      const locale = trouvee.locale;
      if (!Array.isArray(locale.obtenu)) continue;
      if (locale.obtenu.length === 1 && typeof locale.obtenu[0] === 'string' && canoniser(locale.obtenu[0]) === canoniser(r.reponse)) continue; // concordance
      const p = locale.provenance && typeof locale.provenance === 'object' ? locale.provenance : {};
      ordre.set(r.idMessage, [String(locale.horodatage || ''), locale.id]);
      sortie.push({
        idReponseAttendue: r.idMessage,
        idReponseLocale: locale.id,
        idQuestion: locale.idQuestion,
        question: textes.has(locale.idQuestion) ? textes.get(locale.idQuestion) : null,
        provenance: { ...p },
        ...(p.voie === 'action' && estChaine(p.idTrace) ? { idTrace: p.idTrace } : {}),
        ...(p.voie === 'action' && estChaine(p.idAction) ? { idAction: p.idAction } : {}),
        obtenu: [...locale.obtenu],
        attendu: r.reponse,
        appuis: tableau(locale.appuis).map((a) => ({ sujet: a.sujet, relation: a.relation, valeur: a.valeur })),
      });
      continue;
    }
    const { trace } = trouvee;
    const capacite = capacites[trace.capacite];
    if (!capacite || !capacite.lecture || typeof capacite.lecture.reponses !== 'function') continue;
    let obtenu;
    try { obtenu = capacite.lecture.reponses(trace.resultat); } catch { continue; }
    if (!Array.isArray(obtenu)) continue;
    if (obtenu.length === 1 && typeof obtenu[0] === 'string' && canoniser(obtenu[0]) === canoniser(r.reponse)) continue; // concordance
    ordre.set(r.idMessage, [String(trace.horodatage || ''), trace.id]);
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
  // Ordre de PRÉSENTATION seulement (aucun choix, aucun effet sur le contenu) : moment où la réponse corrigée a été produite (horodatage de la
  // réponse locale ou de la trace historique), puis son identité, puis la réponse attendue. v0.64.21 : identité de la trace seule.
  const cle = (d) => ordre.get(d.idReponseAttendue);
  return sortie.sort((a, b) => plusPetit(cle(a)[0], cle(b)[0]) || plusPetit(cle(a)[1], cle(b)[1]) || plusPetit(a.idReponseAttendue, b.idReponseAttendue));
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
