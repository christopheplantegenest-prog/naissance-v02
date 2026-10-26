// === DEBUT_LANGAGE_RAPPEL_FORME ===
// v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » : FORME STRICTE du groupe `rappel` d'une ligne de contexte prospectif, et RESTITUTION d'une
// chaîne de rappels déjà écrite. Séparée du calcul (rappels.js) pour que l'écrivain (connaissances.js, enregistrerContexteProspectif) et la
// relecture Diagnostic n'importent QUE la forme : ni le présent, ni le vécu, ni la table des issues ne leur sont accessibles.
//
//   rappel = { statut: 'complet' | 'incomplet',
//              precedents: [idContexte],                                   (maillons antérieurs de la chaîne, cités par identité)
//              issues: [{ idIssue, idContexte, statut }],                  (statut : realisee | autre | absente | incomplete)
//              nonLues: [id] }                                             (ce qui n'a pas pu être lu, par identité)
//
// validerRappel(g) -> copie neuve validée ; TypeError si la forme ou la cohérence n'est pas exacte :
//   clés exactes, données propres (jamais un accesseur) ; identités chaînes non vides ; aucune répétition dans precedents, dans les idIssue
//   des issues, ni dans nonLues ; chaque issue exactement { idIssue, idContexte, statut } ; 'incomplet' ⇔ nonLues non vide.
// restituerRappel(idContexte, lignesContextes) -> { statut, issues, nonLues }
//   Parcourt le maillon idContexte puis, de proche en proche, tous ses precedents (chacun au plus une fois) dans lignesContextes (la table
//   contextesProspectifs telle quelle) et réunit les issues de leurs rappels, sans doublon d'identité. Résultat 'incomplet', l'identité
//   concernée dans nonLues, si : un maillon est introuvable (aucune ligne, ou plusieurs lignes, portant cet id), n'a pas de rappel, ou porte
//   un rappel hors forme ; ou si un même idIssue apparaît avec deux contenus différents (il est alors retiré des issues : aucun des deux
//   contenus n'est retenu). Ordre : celui du parcours, sans signification.
// AUCUN score, compte, fréquence, tri, récence, confiance, préférence, prédiction ni décision.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.

const NOM = 'rappel';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;

export const STATUTS_RAPPEL = Object.freeze(['complet', 'incomplet']);
export const STATUTS_ISSUE_RAPPEL = Object.freeze(['realisee', 'autre', 'absente', 'incomplete']);

const CLES = Object.freeze(['statut', 'precedents', 'issues', 'nonLues']);
const CLES_ISSUE = Object.freeze(['idIssue', 'idContexte', 'statut']);

function clesExactes(o, attendues, nom) {
  if (!objetSimple(o)) refuser(`${nom} doit être un objet`);
  const cles = Reflect.ownKeys(o);
  for (const k of cles) {
    if (!attendues.includes(k)) refuser(`${nom} : clé étrangère « ${String(k)} »`);
    if (!('value' in Object.getOwnPropertyDescriptor(o, k))) refuser(`${nom} : « ${String(k)} » est un accesseur`);
  }
  for (const k of attendues) if (!Object.hasOwn(o, k)) refuser(`${nom} : « ${k} » manque`);
}
function identites(liste, nom) {
  if (!Array.isArray(liste)) refuser(`${nom} doit être un tableau`);
  const copie = [];
  for (let i = 0; i < liste.length; i += 1) {
    if (!Object.hasOwn(liste, i) || !('value' in Object.getOwnPropertyDescriptor(liste, i))) refuser(`${nom}[${i}] doit être une donnée`);
    if (!chaineNonVide(liste[i])) refuser(`${nom} ne contient que des identités (chaînes non vides)`);
    copie.push(liste[i]);
  }
  if (new Set(copie).size !== copie.length) refuser(`${nom} ne répète aucune identité`);
  return copie;
}

export function validerRappel(g) {
  clesExactes(g, CLES, 'le groupe');
  const { statut, precedents, issues, nonLues } = g;
  if (!STATUTS_RAPPEL.includes(statut)) refuser(`statut inconnu « ${String(statut)} »`);
  const copiePrecedents = identites(precedents, 'precedents');
  const copieNonLues = identites(nonLues, 'nonLues');
  if (!Array.isArray(issues)) refuser('issues doit être un tableau');
  const copieIssues = [];
  for (let i = 0; i < issues.length; i += 1) {
    if (!Object.hasOwn(issues, i) || !('value' in Object.getOwnPropertyDescriptor(issues, i))) refuser(`issues[${i}] doit être une donnée`);
    const issue = issues[i];
    clesExactes(issue, CLES_ISSUE, `issues[${i}]`);
    if (!chaineNonVide(issue.idIssue) || !chaineNonVide(issue.idContexte)) refuser(`issues[${i}] : idIssue et idContexte sont des chaînes non vides`);
    if (!STATUTS_ISSUE_RAPPEL.includes(issue.statut)) refuser(`issues[${i}] : statut inconnu « ${String(issue.statut)} »`);
    copieIssues.push({ idIssue: issue.idIssue, idContexte: issue.idContexte, statut: issue.statut });
  }
  if (new Set(copieIssues.map((x) => x.idIssue)).size !== copieIssues.length) refuser('issues ne répète aucune identité');
  if ((statut === 'incomplet') !== (copieNonLues.length > 0)) refuser('« incomplet » ⇔ nonLues non vide');
  return { statut, precedents: copiePrecedents, issues: copieIssues, nonLues: copieNonLues };
}

// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}
const memeContenu = (a, b) => a.idContexte === b.idContexte && a.statut === b.statut;

export function restituerRappel(idContexte, lignesContextes) {
  if (!chaineNonVide(idContexte)) refuser('idContexte doit être une chaîne non vide');
  if (!Array.isArray(lignesContextes)) refuser('lignesContextes doit être un tableau');
  const issues = []; // { idIssue, idContexte, statut }
  const nonLues = [];
  const enConflit = new Set();
  const marquer = (id) => { if (!nonLues.includes(id)) nonLues.push(id); };
  const vus = new Set();
  const aParcourir = [idContexte];
  while (aParcourir.length > 0) {
    const id = aParcourir.shift();
    if (vus.has(id)) continue;
    vus.add(id);
    const portees = lignesContextes.filter((l) => propre(l, 'id') === id);
    if (portees.length !== 1) { marquer(id); continue; } // introuvable (ou identité non unique : aucune ligne n'est choisie)
    const ligne = portees[0];
    if (!objetSimple(ligne) || !Object.hasOwn(ligne, 'rappel')) { marquer(id); continue; } // sans rappel
    let rappel;
    try { rappel = validerRappel(propre(ligne, 'rappel')); } catch { marquer(id); continue; } // hors forme
    for (const issue of rappel.issues) {
      if (enConflit.has(issue.idIssue)) continue;
      const deja = issues.findIndex((x) => x.idIssue === issue.idIssue);
      if (deja === -1) { issues.push(issue); continue; }
      if (memeContenu(issues[deja], issue)) continue;
      issues.splice(deja, 1); // deux contenus pour une même identité : aucun n'est retenu
      enConflit.add(issue.idIssue);
      marquer(issue.idIssue);
    }
    for (const p of rappel.precedents) if (!vus.has(p)) aParcourir.push(p);
  }
  return { statut: nonLues.length > 0 ? 'incomplet' : 'complet', issues, nonLues };
}
// === FIN_LANGAGE_RAPPEL_FORME ===
