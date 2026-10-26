// === DEBUT_LANGAGE_RAPPELS ===
// v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » (calcul). CALCUL PUR, SYNCHRONE, DÉTERMINISTE (sauf rappelsDesContextes : lecture seule).
//
// QUESTION UNIQUE, posée pour un contexte prospectif dont la retrouvaille est 'retrouvee' (relation R), AVANT l'écriture de ce contexte :
//   « quelles issues déjà vécues par d'AUTRES actes, dont le contexte avait retrouvé exactement R, sont conservées ? »
// Le résultat est un HISTORIQUE restitué (forme : rappel-forme.js), écrit facultativement dans la ligne du contexte. Il n'influence RIEN :
// ni l'acte, ni les attentes, ni l'issue, ni une décision. Aucun score, compte, fréquence, tri, récence, confiance, préférence ni prédiction.
//
// rappelDeLaRetrouvaille(retrouvaille, idActe, lignesContextes, lignesIssues) -> rappel | null
//   retrouvaille : le groupe calculé pour ce contexte (validerRetrouvaille) ; statut autre que 'retrouvee' (abstention, aucune,
//   non-effectuee) : null — aucun rappel, rien n'est lu. Sinon R = relations[0].relation, et :
//   CONTEXTES ÉTRANGERS : les lignes de lignesContextes qui ne portent pas cet acte (ligneDeLActe) ;
//     — un contexte qui porte un groupe retrouvaille illisible ET un rappel : son id va dans nonLues (on ne peut savoir s'il est un maillon) ;
//     — MAILLONS : les contextes étrangers qui portent un rappel et dont la retrouvaille est 'retrouvee' sur exactement R (memesRelations) ;
//   PRECEDENTS : les maillons qu'aucun autre maillon ne cite dans les precedents de son rappel (un rappel hors forme ne cite rien de lisible :
//     il reste précédent et sa restitution le signale) ;
//   CONNUES : les issues restituées (restituerRappel) de chaque précédent ; leurs nonLues sont reprises ;
//   ISSUES : les lignes de lignesIssues (table issuesRetrouvailles) d'autres actes dont le contexte a retrouvé exactement R, absentes de
//     connues (par identité) ; chaque issue : { idIssue: id de la ligne, idContexte, statut: observe.statut }.
//     nonLues reçoit l'id de la ligne si : son contexte est introuvable (aucune ou plusieurs lignes), le groupe retrouvaille de ce contexte est
//     illisible, ou son observe est illisible. Une ligne SANS id : nonLues reçoit l'id de son contexte (si c'est une chaîne non vide et que ce
//     contexte n'est pas établi comme étranger à R) ; une ligne qui ne porte ni id ni contexte lisible ne peut être nommée ni rattachée à R
//     (aucune identité n'est inventée) : elle reste hors du rappel — limite documentée (tout écrivain de Naissance donne un id dérivé).
//   Absence d'issue : rappel complet aux listes vides ; ligne illisible : incomplet, son id dans nonLues — les deux ne se confondent jamais.
// rappelsDesContextes(magasin, retrouvailles, acte) -> Promise<[rappel | null]>  (rang k ↔ retrouvailles[k])
//   Lit contextesProspectifs et issuesRetrouvailles (une fois chacune) SEULEMENT si au moins une retrouvaille est 'retrouvee' ; sinon rien
//   n'est lu et chaque rang vaut null.
// PURETÉ (hors la lecture de rappelsDesContextes) : aucune écriture, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.
import { validerRetrouvaille, ligneDeLActe } from './retrouvaille-forme.js';
import { memesRelations } from './relations-formulees.js';
import { validerRappel, restituerRappel, STATUTS_ISSUE_RAPPEL } from './rappel-forme.js';
import { lireIssuesRetrouvailles } from './connaissances.js';

const NOM = 'rappels';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;

// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}

// Lecture du groupe retrouvaille d'une ligne de contexte : 'sans' (aucun groupe), 'illisible', ou le groupe validé.
function groupeDe(ligne) {
  if (!objetSimple(ligne) || !Object.hasOwn(ligne, 'retrouvaille')) return 'sans';
  try { return validerRetrouvaille(propre(ligne, 'retrouvaille')); } catch { return 'illisible'; }
}
function aRetrouveR(groupe, R) {
  if (!objetSimple(groupe) || groupe.statut !== 'retrouvee') return false;
  try { return memesRelations(groupe.relations[0].relation, R); } catch { return false; }
}
function observeLisible(observe) {
  if (!objetSimple(observe) || !Object.hasOwn(observe, 'statut')) return null;
  if (!Reflect.ownKeys(observe).every((c) => c === 'statut' || c === 'reel')) return null;
  for (const c of Reflect.ownKeys(observe)) if (!('value' in Object.getOwnPropertyDescriptor(observe, c))) return null;
  if (!STATUTS_ISSUE_RAPPEL.includes(observe.statut)) return null;
  const avecReel = observe.statut === 'realisee' || observe.statut === 'autre';
  if (avecReel !== Object.hasOwn(observe, 'reel')) return null;
  return observe.statut;
}

export function rappelDeLaRetrouvaille(retrouvaille, idActe, lignesContextes, lignesIssues) {
  const groupe = validerRetrouvaille(retrouvaille);
  if (!chaineNonVide(idActe)) refuser('idActe doit être une chaîne non vide');
  if (!Array.isArray(lignesContextes) || !Array.isArray(lignesIssues)) refuser('lignesContextes et lignesIssues doivent être des tableaux');
  if (groupe.statut !== 'retrouvee') return null;
  const R = groupe.relations[0].relation;
  const nonLues = [];
  const marquer = (id) => { if (!nonLues.includes(id)) nonLues.push(id); };

  // Contextes étrangers et maillons.
  const maillons = []; // { id, rappel (validé ou null si hors forme) }
  for (const ligne of lignesContextes) {
    if (!objetSimple(ligne) || ligneDeLActe(ligne, idActe)) continue;
    const id = propre(ligne, 'id');
    if (!chaineNonVide(id) || !Object.hasOwn(ligne, 'rappel')) continue;
    const g = groupeDe(ligne);
    if (g === 'illisible') { marquer(id); continue; }
    if (!aRetrouveR(g, R)) continue;
    let rappel = null;
    try { rappel = validerRappel(propre(ligne, 'rappel')); } catch { rappel = null; }
    maillons.push({ id, rappel });
  }
  const cites = new Set();
  for (const m of maillons) if (m.rappel !== null) for (const p of m.rappel.precedents) if (p !== m.id) cites.add(p);
  const precedents = [];
  for (const m of maillons) if (!cites.has(m.id) && !precedents.includes(m.id)) precedents.push(m.id);

  // Connues : restitution des précédents.
  const connues = new Set();
  for (const p of precedents) {
    const r = restituerRappel(p, lignesContextes);
    for (const i of r.issues) connues.add(i.idIssue);
    for (const id of r.nonLues) marquer(id);
  }

  // Issues nouvelles.
  const issues = [];
  for (const ligne of lignesIssues) {
    if (!objetSimple(ligne) || ligneDeLActe(ligne, idActe)) continue;
    const id = propre(ligne, 'id');
    const idContexte = propre(ligne, 'idContexte');
    const contextes = chaineNonVide(idContexte) ? lignesContextes.filter((l) => propre(l, 'id') === idContexte) : [];
    const contexte = contextes.length === 1 ? contextes[0] : null;
    if (contexte !== null && ligneDeLActe(contexte, idActe)) continue;
    const g = contexte === null ? 'introuvable' : groupeDe(contexte);
    if (g !== 'introuvable' && g !== 'illisible' && !aRetrouveR(g, R)) continue; // établi étranger à R
    if (!chaineNonVide(id)) { if (chaineNonVide(idContexte)) marquer(idContexte); continue; }
    if (g === 'introuvable' || g === 'illisible') { marquer(id); continue; }
    const statut = observeLisible(propre(ligne, 'observe'));
    if (statut === null) { marquer(id); continue; }
    if (connues.has(id) || nonLues.includes(id) || issues.some((i) => i.idIssue === id)) continue;
    issues.push({ idIssue: id, idContexte, statut });
  }
  // Une identité non lue n'est jamais en même temps rendue comme issue.
  const rendues = issues.filter((i) => !nonLues.includes(i.idIssue));
  return validerRappel({ statut: nonLues.length > 0 ? 'incomplet' : 'complet', precedents, issues: rendues, nonLues });
}

export async function rappelsDesContextes(magasin, retrouvailles, acte) {
  if (!Array.isArray(retrouvailles)) refuser('retrouvailles doit être un tableau');
  if (!objetSimple(acte) || !chaineNonVide(acte.id)) refuser('acte.id doit être une chaîne non vide');
  const groupes = retrouvailles.map((r) => validerRetrouvaille(r));
  if (!groupes.some((g) => g.statut === 'retrouvee')) return groupes.map(() => null);
  const lignesContextes = await magasin.lireTout('contextesProspectifs');
  const lignesIssues = await lireIssuesRetrouvailles(magasin); // le lecteur existant (connaissances.js), seul à nommer la table
  if (!Array.isArray(lignesContextes) || !Array.isArray(lignesIssues)) refuser('la lecture des tables doit rendre des tableaux');
  return groupes.map((g) => rappelDeLaRetrouvaille(g, acte.id, lignesContextes, lignesIssues));
}
// === FIN_LANGAGE_RAPPELS ===
