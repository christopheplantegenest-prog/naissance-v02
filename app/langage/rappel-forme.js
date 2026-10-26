// === DEBUT_LANGAGE_RAPPEL_FORME ===
// v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » (chantier ticket-28, jalon rappel-calcul). FORME STRICTE du groupe `rappel` et RESTITUTION
// de la chaîne des rappels. Séparée du calcul (rappels.js) : l'écrivain (connaissances.js, enregistrerContexteProspectif) et la relecture
// Diagnostic n'importent QUE ce module ; ni le magasin, ni le présent, ni les attentes ne leur sont accessibles ici.
//
//   rappel = { statut: 'complet' | 'incomplet',
//              precedents: [idContexte],                         (maillons antérieurs cités : la chaîne se relit par eux)
//              issues: [{ idIssue, idContexte, statut }],         (statut d'issue : realisee | autre | absente | incomplete)
//              nonLues: [id] }                                    (ce qui n'a pas pu être lu ; incomplet ⇔ nonLues non vide)
//
// validerRappel(g) -> copie neuve validée ; TypeError si la forme n'est pas exacte : clés exactes (données propres, jamais d'accesseur),
//   identités chaînes non vides sans répétition (precedents, idIssue, nonLues), statut d'issue connu, incomplet ⇔ nonLues non vide.
//   Un rappel complet aux listes vides est une ABSENCE D'ISSUE connue ; il se distingue d'un rappel incomplet (quelque chose n'a pas été lu).
// restituerRappel(idContexte, lignesContextes) -> { statut, issues, nonLues }
//   Parcourt le maillon idContexte puis tous ses precedents (chacun une fois), et réunit leurs issues sans doublon d'identité. Un maillon
//   introuvable (ou dont l'identité n'est pas unique dans les lignes), sans rappel, ou dont le rappel est hors forme : son id va dans nonLues.
//   Les nonLues d'un rappel relu sont reprises telles quelles. Un même idIssue porté avec deux contenus différents : aucun des deux n'est
//   retenu (aucune sélection), l'idIssue va dans nonLues. Ordre de la sortie = ordre de parcours, sans signification.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.

const NOM = 'rappel';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;

export const STATUTS_RAPPEL = Object.freeze(['complet', 'incomplet']);
export const STATUTS_ISSUE_RAPPEL = Object.freeze(['realisee', 'autre', 'absente', 'incomplete']);

const CLES = Object.freeze(['statut', 'precedents', 'issues', 'nonLues']);
const CLES_ISSUE = Object.freeze(['idIssue', 'idContexte', 'statut']);

function clesExactes(o, cles, nom) {
  if (!objetSimple(o)) refuser(`${nom} doit être un objet`);
  const propres = Reflect.ownKeys(o);
  for (const k of propres) {
    if (!cles.includes(k)) refuser(`${nom} : clé étrangère « ${String(k)} »`);
    if (!('value' in Object.getOwnPropertyDescriptor(o, k))) refuser(`${nom} : « ${String(k)} » est un accesseur`);
  }
  for (const k of cles) if (!Object.hasOwn(o, k)) refuser(`${nom} : « ${k} » manque`);
}
function identites(liste, nom) {
  if (!Array.isArray(liste)) refuser(`${nom} doit être un tableau`);
  for (const id of liste) if (!chaineNonVide(id)) refuser(`${nom} ne contient que des identités (chaînes non vides)`);
  if (new Set(liste).size !== liste.length) refuser(`${nom} ne répète aucune identité`);
}

export function validerRappel(g) {
  clesExactes(g, CLES, 'le groupe');
  const { statut, precedents, issues, nonLues } = g;
  if (!STATUTS_RAPPEL.includes(statut)) refuser(`statut inconnu « ${String(statut)} »`);
  identites(precedents, 'precedents');
  identites(nonLues, 'nonLues');
  if (!Array.isArray(issues)) refuser('issues doit être un tableau');
  issues.forEach((issue, i) => {
    clesExactes(issue, CLES_ISSUE, `issues[${i}]`);
    if (!chaineNonVide(issue.idIssue) || !chaineNonVide(issue.idContexte)) refuser(`issues[${i}] : idIssue et idContexte sont des identités (chaînes non vides)`);
    if (!STATUTS_ISSUE_RAPPEL.includes(issue.statut)) refuser(`issues[${i}] : statut d'issue inconnu « ${String(issue.statut)} »`);
  });
  identites(issues.map((issue) => issue.idIssue), 'issues (idIssue)');
  if ((statut === 'incomplet') !== (nonLues.length > 0)) refuser('incomplet si et seulement si nonLues n\'est pas vide');
  return {
    statut,
    precedents: [...precedents],
    issues: issues.map((issue) => ({ idIssue: issue.idIssue, idContexte: issue.idContexte, statut: issue.statut })),
    nonLues: [...nonLues],
  };
}

// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}
const memeIssue = (a, b) => a.idContexte === b.idContexte && a.statut === b.statut;

export function restituerRappel(idContexte, lignesContextes) {
  if (!chaineNonVide(idContexte)) refuser('idContexte doit être une chaîne non vide');
  if (!Array.isArray(lignesContextes)) refuser('lignesContextes doit être un tableau');
  const issues = []; // { idIssue, idContexte, statut }
  const nonLues = [];
  const enConflit = new Set();
  const noterNonLue = (id) => { if (!nonLues.includes(id)) nonLues.push(id); };
  const vus = new Set();
  const aParcourir = [idContexte];
  while (aParcourir.length > 0) {
    const id = aParcourir.shift();
    if (vus.has(id)) continue;
    vus.add(id);
    const lignes = lignesContextes.filter((l) => propre(l, 'id') === id);
    if (lignes.length !== 1) { noterNonLue(id); continue; } // introuvable, ou identité non unique : aucune ligne n'est choisie
    const brut = propre(lignes[0], 'rappel');
    if (brut === undefined) { noterNonLue(id); continue; }
    let rappel;
    try { rappel = validerRappel(brut); } catch { noterNonLue(id); continue; }
    for (const x of rappel.nonLues) noterNonLue(x);
    for (const issue of rappel.issues) {
      const deja = issues.find((u) => u.idIssue === issue.idIssue);
      if (deja === undefined) issues.push(issue);
      else if (!memeIssue(deja, issue)) enConflit.add(issue.idIssue);
    }
    for (const p of rappel.precedents) if (!vus.has(p)) aParcourir.push(p);
  }
  for (const id of enConflit) noterNonLue(id);
  const retenues = issues.filter((u) => !enConflit.has(u.idIssue));
  return { statut: nonLues.length > 0 ? 'incomplet' : 'complet', issues: retenues, nonLues };
}
// === FIN_LANGAGE_RAPPEL_FORME ===
