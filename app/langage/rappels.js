// === DEBUT_LANGAGE_RAPPELS ===
// v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » (chantier ticket-28, jalon rappel-calcul). CALCUL du groupe `rappel` d'un contexte prospectif
// dont la retrouvaille est 'retrouvee'. Rien d'autre : ni score, ni compte, ni fréquence, ni tri, ni récence, ni confiance, ni préférence,
// ni prédiction, ni décision. Le rappel est l'HISTORIQUE de ce qui est déjà arrivé après la même relation retrouvée ; il n'influence rien.
//
// rappelDeLaRetrouvaille(retrouvaille, idActe, lignesContextes, lignesIssues) -> rappel | null
//   retrouvaille : le groupe calculé pour ce contexte (validé par validerRetrouvaille) ; statut autre que 'retrouvee' → null (aucun rappel).
//   R = relations[0].relation (la relation retrouvée, unique par la forme).
//   MAILLONS : les lignes de contextes d'AUTRES actes (ligneDeLActe faux) qui portent un rappel et dont la retrouvaille a retrouvé EXACTEMENT R
//     (validerRetrouvaille + memesRelations : la seule égalité de relation).
//   PRECEDENTS : les maillons qu'aucun autre maillon ne cite dans ses precedents (la chaîne se relit par eux, restituerRappel).
//   CONNUES : les issues restituées des precedents (restituerRappel).
//   ISSUES : les lignes d'issues vécues d'AUTRES actes dont le contexte a retrouvé exactement R, et qui ne sont pas déjà dans connues.
//   NONLUES : une ligne sans id (le nom de sa table, ou pour une issue vécue la famille 'issue-retrouvaille' de ses identités, tient lieu
//     d'identité : aucune identité n'est inventée), un contexte introuvable ou non
//     unique, un groupe illisible (retrouvaille hors forme, ou rappel porté sans retrouvaille 'retrouvee'), un observe illisible, une relation
//     non parcourable, un même idIssue à deux contenus, et les nonLues des rappels restitués. incomplet ⇔ nonLues non vide.
//   Le premier acte (aucun maillon, aucune issue) a un rappel COMPLET aux listes vides : absence d'issue connue, distincte d'une ligne illisible.
// rappelsDesContextes(magasin, retrouvailles, acte) -> [rappel | null]  (rang k ↔ retrouvailles[k])
//   Les tables des contextes et des issues vécues ne sont lues, une fois chacune, QUE si au moins une retrouvaille est 'retrouvee' ;
//   les issues vécues le sont par le seul lecteur officiel lireIssuesRetrouvailles (connaissances.js), jamais par la table nommée ici.
// PURETÉ (rappelDeLaRetrouvaille) : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.
import { validerRetrouvaille, ligneDeLActe } from './retrouvaille-forme.js';
import { memesRelations } from './relations-formulees.js';
import { validerRappel, restituerRappel, STATUTS_ISSUE_RAPPEL } from './rappel-forme.js';
import { lireIssuesRetrouvailles } from './connaissances.js'; // le LECTEUR officiel des issues vécues (jamais l'écrivain) : rappels.js ne nomme pas la table

const NOM = 'rappels';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;
const TABLE_CONTEXTES = 'contextesProspectifs';
// Une ligne d'issue vécue sans id : la FAMILLE de ses identités (préfixe 'issue-retrouvaille' que connaissances.js donne à chaque id d'issue)
// tient lieu d'identité dans nonLues ; aucune identité individuelle n'est inventée.
const FAMILLE_ISSUES = 'issue-retrouvaille';

// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}
const memeIssue = (a, b) => a.idContexte === b.idContexte && a.statut === b.statut;

// La ligne de contexte a-t-elle retrouvé exactement R ? 'oui' | 'non' | 'illisible'.
function aRetrouveR(ligne, R) {
  let groupe;
  try { groupe = validerRetrouvaille(propre(ligne, 'retrouvaille')); } catch { return 'illisible'; }
  if (groupe.statut !== 'retrouvee') return 'illisible'; // rappel ou issue vécue sans retrouvaille 'retrouvee' : incohérent avec l'écrivain
  try { return memesRelations(R, groupe.relations[0].relation) ? 'oui' : 'non'; } catch { return 'illisible'; }
}

export function rappelDeLaRetrouvaille(retrouvaille, idActe, lignesContextes, lignesIssues) {
  const groupe = validerRetrouvaille(retrouvaille);
  if (!chaineNonVide(idActe)) refuser('idActe doit être une chaîne non vide');
  if (!Array.isArray(lignesContextes) || !Array.isArray(lignesIssues)) refuser('lignesContextes et lignesIssues doivent être des tableaux');
  if (groupe.statut !== 'retrouvee') return null;
  const R = groupe.relations[0].relation;
  const nonLues = [];
  const noterNonLue = (id) => { if (!nonLues.includes(id)) nonLues.push(id); };

  // maillons : contextes d'autres actes portant un rappel et ayant retrouvé exactement R
  const maillons = []; // { id, cites }
  for (const ligne of lignesContextes) {
    if (ligneDeLActe(ligne, idActe)) continue;
    if (propre(ligne, 'rappel') === undefined) continue;
    const id = propre(ligne, 'id');
    if (!chaineNonVide(id)) { noterNonLue(TABLE_CONTEXTES); continue; }
    const verdict = aRetrouveR(ligne, R);
    if (verdict === 'illisible') { noterNonLue(id); continue; }
    if (verdict === 'non' || maillons.some((m) => m.id === id)) continue;
    let cites = [];
    try { cites = validerRappel(propre(ligne, 'rappel')).precedents; } catch { noterNonLue(id); }
    maillons.push({ id, cites });
  }
  const precedents = maillons.filter((m) => !maillons.some((o) => o.id !== m.id && o.cites.includes(m.id))).map((m) => m.id);

  // connues : issues restituées des precedents
  const connues = [];
  const enConflit = new Set();
  for (const p of precedents) {
    const restitue = restituerRappel(p, lignesContextes);
    for (const x of restitue.nonLues) noterNonLue(x);
    for (const issue of restitue.issues) {
      const deja = connues.find((u) => u.idIssue === issue.idIssue);
      if (deja === undefined) connues.push(issue);
      else if (!memeIssue(deja, issue)) enConflit.add(issue.idIssue);
    }
  }

  // issues : lignes d'issues vécues d'autres actes dont le contexte a retrouvé exactement R, pas déjà connues
  const issues = [];
  for (const ligne of lignesIssues) {
    if (ligneDeLActe(ligne, idActe)) continue;
    const id = propre(ligne, 'id');
    if (!chaineNonVide(id)) { noterNonLue(FAMILLE_ISSUES); continue; }
    const idContexte = propre(ligne, 'idContexte');
    if (!chaineNonVide(idContexte)) { noterNonLue(id); continue; }
    const contextes = lignesContextes.filter((l) => propre(l, 'id') === idContexte);
    if (contextes.length !== 1) { noterNonLue(id); continue; } // introuvable, ou identité non unique : aucun contexte n'est choisi
    const verdict = aRetrouveR(contextes[0], R);
    if (verdict === 'illisible') { noterNonLue(id); continue; }
    if (verdict === 'non') continue;
    const statut = propre(propre(ligne, 'observe'), 'statut');
    if (!STATUTS_ISSUE_RAPPEL.includes(statut)) { noterNonLue(id); continue; }
    const issue = { idIssue: id, idContexte, statut };
    const deja = connues.find((u) => u.idIssue === id) || issues.find((u) => u.idIssue === id);
    if (deja === undefined) issues.push(issue);
    else if (!memeIssue(deja, issue)) enConflit.add(id);
  }
  for (const id of enConflit) noterNonLue(id);
  return validerRappel({
    statut: nonLues.length > 0 ? 'incomplet' : 'complet',
    precedents,
    issues: issues.filter((u) => !enConflit.has(u.idIssue)),
    nonLues,
  });
}

export async function rappelsDesContextes(magasin, retrouvailles, acte) {
  if (!Array.isArray(retrouvailles)) refuser('retrouvailles doit être un tableau');
  if (!objetSimple(acte) || !chaineNonVide(acte.id)) refuser('acte.id doit être une chaîne non vide');
  const groupes = retrouvailles.map((r) => validerRetrouvaille(r));
  if (!groupes.some((g) => g.statut === 'retrouvee')) return groupes.map(() => null); // aucune table n'est lue
  if (!magasin || typeof magasin.lireTout !== 'function') refuser('magasin.lireTout indisponible');
  const lignesContextes = await magasin.lireTout(TABLE_CONTEXTES);
  const lignesIssues = await lireIssuesRetrouvailles(magasin);
  return groupes.map((g) => rappelDeLaRetrouvaille(g, acte.id, lignesContextes, lignesIssues));
}
// === FIN_LANGAGE_RAPPELS ===
