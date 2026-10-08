// === DEBUT_LANGAGE_EXPERIENCES_ATTENTES ===
// v0.63.76 — « RENDRE LES ISSUES D'ATTENTE OBSERVABLES COMME EXPÉRIENCES » (décision ChatGPT, 08/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « parmi les attentes prospectives persistées, lesquelles ont eu une issue réelle, et comment présenter chacune comme UNE expérience homogène
//     { critère disponible avant, engagement avant, observation après } que les primitives générales (constats par chemin, couvertures) peuvent parcourir ? »
//
// Elle factorise UNIQUEMENT la composition attente → contexte référencé → issueDeLAttenteProspective → élément observable. Elle ne réimplémente ni
// l'ancrage, ni l'égalité des constats, ni les statuts (realisee / autre / absente) : tout cela vient de issueDeLAttenteProspective.
//
// experiencesDAttentes(lignesAttentes, lignesContextes, lignesValeurs, lignesExecutions, descriptions) -> { experiences, sansIssue }
//   lignesAttentes : lignes persistées de attentesProspectives ; lignesContextes : lignes persistées de contextesProspectifs (chaque attente doit
//   y trouver son contexte, sinon TypeError) ; le reste : le magasin actuel, transmis tel quel à issueDeLAttenteProspective.
//   UNITÉ : une expérience = UNE attente persistée AYANT une issue réelle ; identité = l'identifiant persistant de l'attente. Rien n'est fusionné.
//   EXPÉRIENCE = { id, idContexte, idDesignation, idExecution, critere, avant, apres }
//     critere : { structure, chemin }              — ce qui était disponible AVANT le résultat et qui ne dépend pas de l'issue ;
//     avant   : { constat, temoinsContexte, unitesIssues } — l'engagement écrit avant l'issue et ce qui l'a fondé (copies de l'attente) ;
//     apres   : { statut[, reel] }                   — l'observation APRÈS : statut de l'issue de l'attente et le constat réel s'il existe
//               ('absente' : aucun reel, l'absence porte sur le chemin). Le constat attendu N'EST PAS dans le critère : il reste une condition
//               supplémentaire que l'observateur peut ajouter (regroupement B) ou non (regroupement A).
//   sansIssue : [id] des attentes dont l'issue est null (aucune exécution pour leur désignation). Elles ne sont PAS des expériences (rien n'est
//     advenu : rien à observer après) et leur absence d'issue n'est jamais transformée en statut ; la liste permet de les retrouver.
//   ORDRE : celui de lignesAttentes (l'ordre persistant de la table). Il est explicitement NON SÉMANTIQUE : aucune lecture ne doit en dépendre ;
//   les régularités se lisent par couvertures (identités), jamais par position.
//
// elementsDExperiences(experiences) -> [{ chemin: [id], contenu: { critere, avant, apres } }]
//   La forme d'entrée EXACTE de la vue des constats par chemin (et du producteur de constats structurels) : chaque expérience devient un élément dont l'identité (le témoin)
//   est [id de l'attente] et le contenu les trois parties. La vue des constats par chemin lit alors, sans aucun nom de champ, les constats à ['apres','statut'],
//   ['apres','reel','type'], ['apres','reel','valeur'], ['avant','constat','valeur'], … avec leurs couvertures (quelles attentes portent chaque
//   observation). Aucune primitive statistique n'est ajoutée : les constantes, variables et absences sont celles de l'algèbre des couvertures.
//
// regrouperExperiences(experiences, selecteurs) -> [{ cle, couverture, experiences }]
//   selecteurs : chemins de propriété (tableaux de clés) lus dans chaque expérience ; deux expériences sont du même groupe si les valeurs lues sont
//   structurellement égales (même forme JSON, primitives par Object.is). Exemples : [['critere']] (regroupement A : structure + chemin),
//   [['critere'], ['avant','constat']] (regroupement B : + constat attendu). cle : les valeurs lues (copies) ; couverture : les identités [id] des
//   expériences du groupe (canonique) ; experiences : les expériences mêmes. Ordre des groupes : première rencontre (non sémantique). Aucun
//   regroupement n'est privilégié : la fonction répond à la question qu'on lui pose.
// INTERDITS RESPECTÉS : aucun choix, préférence, score, confiance, récompense, renforcement ; aucune attente supprimée ni réécrite ; aucune lecture
// par un mécanisme vivant ; aucun contexte prospectif engendré sur ces expériences (matériau consultable, pas une boucle).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { issueDeLAttenteProspective } from './issue-attente-prospective.js';
import { normaliserCouverture } from './couverture-occurrences.js';

const NOM = 'experiencesDAttentes';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  if (objet === null || typeof objet !== 'object') refuser(`${nom} doit être un objet`);
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

// Égalité structurelle de valeurs JSON : tableaux ordonnés, objets par ensemble de clés propres, primitives par Object.is.
function memeContenu(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => memeContenu(x, b[i]));
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && memeContenu(a[k], b[k]));
}

export function experiencesDAttentes(lignesAttentes, lignesContextes, lignesValeurs, lignesExecutions, descriptions) {
  if (!Array.isArray(lignesAttentes) || !Array.isArray(lignesContextes)) refuser('lignesAttentes et lignesContextes doivent être des tableaux');
  const experiences = [];
  const sansIssue = [];
  for (let rang = 0; rang < lignesAttentes.length; rang += 1) {
    const attente = lignesAttentes[rang];
    const idContexte = lirePropre(attente, 'idContexte', `lignesAttentes[${rang}]`);
    const contexte = lignesContextes.find((c) => c !== null && typeof c === 'object' && c.id === idContexte);
    if (contexte === undefined) refuser(`lignesAttentes[${rang}] référence un contexte « ${idContexte} » absent de lignesContextes`);
    const issue = issueDeLAttenteProspective(attente, contexte, lignesValeurs, lignesExecutions, descriptions);
    if (issue.issue === null) { sansIssue.push(issue.idAttente); continue; }
    const apres = { statut: issue.statut };
    if (Object.hasOwn(issue, 'reel')) apres.reel = issue.reel;
    experiences.push({
      id: issue.idAttente, idContexte: issue.idContexte, idDesignation: issue.idDesignation, idExecution: issue.issue.idExecution,
      critere: { structure: issue.structure, chemin: issue.chemin },
      avant: { constat: issue.constat, temoinsContexte: issue.temoinsContexte, unitesIssues: issue.unitesIssues },
      apres,
    });
  }
  return { experiences, sansIssue };
}

export function elementsDExperiences(experiences) {
  if (!Array.isArray(experiences)) refuser('experiences doit être un tableau');
  return experiences.map((e, rang) => ({
    chemin: [lirePropre(e, 'id', `experiences[${rang}]`)],
    contenu: structuredClone({ critere: lirePropre(e, 'critere', `experiences[${rang}]`), avant: lirePropre(e, 'avant', `experiences[${rang}]`), apres: lirePropre(e, 'apres', `experiences[${rang}]`) }),
  }));
}

export function regrouperExperiences(experiences, selecteurs) {
  if (!Array.isArray(experiences)) refuser('experiences doit être un tableau');
  if (!Array.isArray(selecteurs) || selecteurs.length === 0 || !selecteurs.every((s) => Array.isArray(s) && s.length > 0)) refuser('selecteurs doit être un tableau non vide de chemins de propriété non vides');
  const lire = (e, rang) => selecteurs.map((s) => s.reduce((o, cle, k) => lirePropre(o, cle, `experiences[${rang}].${s.slice(0, k).join('.') || '(racine)'}`), e));
  const groupes = [];
  experiences.forEach((e, rang) => {
    const id = lirePropre(e, 'id', `experiences[${rang}]`);
    const valeurs = lire(e, rang);
    let groupe = groupes.find((g) => memeContenu(g.cle, valeurs));
    if (groupe === undefined) { groupe = { cle: structuredClone(valeurs), identites: [], experiences: [] }; groupes.push(groupe); }
    groupe.identites.push([id]);
    groupe.experiences.push(e);
  });
  return groupes.map((g) => ({ cle: g.cle, couverture: normaliserCouverture(g.identites), experiences: g.experiences }));
}
// === FIN_LANGAGE_EXPERIENCES_ATTENTES ===
