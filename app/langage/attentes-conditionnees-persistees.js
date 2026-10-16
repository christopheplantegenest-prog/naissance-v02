// === DEBUT_LANGAGE_ATTENTES_CONDITIONNEES_PERSISTEES ===
// v0.64.28 — « VOIR LES ATTENTES CONDITIONNÉES ÉCRITES AVANT LEUR ISSUE » (GO ChatGPT « GO DÉVELOPPEMENT v0.64.28 », 15/10/2026). Jalon
// d'OBSERVATION : aucune acquisition cognitive, aucune écriture. Lu UNIQUEMENT par le pont Diagnostic de main.js (garde statique,
// tests/attentes-conditionnees-persistees.test.mjs) : aucun tour de conversation, aucun lot, aucune décision ne le lit.
//
// Deux lectures STRICTEMENT séparées, dans deux fonctions qui ne reçoivent pas les mêmes entrées :
//
// relireAttentesConditionnees(lignesAttentes, actes) -> { attentes: [E], illisibles: [{ rang, idAttente, erreur }] }   — AVANT L'ISSUE
//   lignesAttentes : la table attentesProspectives ENTIÈRE. Seul critère d'inclusion : la ligne, lue par rolesDeLAttente (les deux formes
//     persistées), porte preuve.fondation. Aucun filtre de lot, de tour, de date, d'opération ni de provenance ; aucun tri ; aucune
//     déduplication (deux relations identiques = deux entrées) ; ordre = celui de la table, sans signification.
//   actes : { designations, emissions, observations } — les trois tables entières ; seuls id, origine (désignation) et environnement
//     (émission) sont lus. La provenance de l'acte est cherchée APRÈS la sélection (references.idDesignation), jamais pour sélectionner.
//   E = { occurrence: { idAttente, horodatage, idObservation },
//         acte: { idActe, table: 'designations' | 'emissions' | 'observations' | 'aucune', origine?, environnement?, operation },
//         avantIssue: { statut: 'ecrit-avant-issue', relation | null [, relationAbsente: 'ligne-anterieure-a-la-relation'], chemin, constat,
//                       fondation: [{ conditions, couverture, constats, temoinUnique }], idContexte,
//                       reconnaissance | null [, reconnaissanceAbsente: 'ligne-anterieure-a-la-reconnaissance'] } }
//     MISE À JOUR DÉLIBÉRÉE v0.64.29 : reconnaissance = le groupe écrit à K0 par l'enregistrement (formulationsAnterieures, nonComparees),
//     recopié sans recalcul ; null pour une ligne écrite avant v0.64.29 (jamais reconstruite).
//     Tout est COPIÉ de la ligne persistée à K0 : la relation d'une ligne plate .64.1–.64.4 (fondation sans relation) reste null, jamais
//     reconstruite ; operation = dernière étape de description.structure, recopiée ; temoinUnique = (couverture.length === 1), simple
//     propriété descriptive de la couverture persistée.
//   illisibles : lignes que rolesDeLAttente refuse, fondation hors forme, ou acte trouvé dans plusieurs tables — rendues, jamais masquées.
//   Cette fonction ne reçoit ni le vécu ni les contextes : elle ne PEUT rien recalculer.
//
// relireIssuesAujourdhui(lignesAttentes, lignesContextes, vecu) -> [{ idAttente, aujourdhui }]                         — AUJOURD'HUI
//   Même sélection (fondation présente, ligne lisible), même ordre. vecu = { valeurs, executions, descriptions } (sortie de
//   lireExecutionsVecues). L'issue est celle de issuesDeLAttenteProspective (autorité existante, inchangée), une par conséquence :
//   aujourdhui = { issues: [{ idExecution, horodatageExecution, statut, reel? }] } — issues [] = « sans issue » (aucune conséquence),
//               distinct de 'absente' (le chemin engagé manque dans l'issue) ; plusieurs issues restent plusieurs issues ;
//             | { erreur } — contexte introuvable ou refus de la vue, pour CETTE attente seulement.
//   horodatageExecution est recopié de la ligne d'exécution vécue : INFORMATIF, rien ne le compare ni n'en dépend.
//   Cette fonction ne rend ni relation ni fondation.
//
// CE QUI N'EST JAMAIS FAIT : recalculer une fondation ou une relation, créer ou modifier une attente, choisir, classer, compter pour
// décider, fusionner, identifier deux relations, donner une valence à une issue.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { rolesDeLAttente } from './roles-attente.js';
import { issuesDeLAttenteProspective } from './issue-attente-prospective.js';

const NOM = 'attentesConditionneesPersistees';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const tableau = (x, nom) => (Array.isArray(x) ? x : refuser(`${nom} doit être un tableau`));
const message = (erreur) => (erreur && typeof erreur.message === 'string' ? erreur.message : String(erreur));
const chaineOuNull = (x) => (typeof x === 'string' ? x : null);

// Sélection commune aux deux lectures : { rang, ligne, roles } des lignes lisibles qui portent une fondation, et les lignes illisibles.
function selection(lignesAttentes) {
  const retenues = [];
  const illisibles = [];
  lignesAttentes.forEach((ligne, rang) => {
    let roles;
    try {
      roles = rolesDeLAttente(ligne);
    } catch (erreur) {
      illisibles.push({ rang, idAttente: objetSimple(ligne) && typeof ligne.id === 'string' ? ligne.id : null, erreur: message(erreur) });
      return;
    }
    if (!Object.hasOwn(roles.preuve, 'fondation')) return;
    const { fondation } = roles.preuve;
    const { structure } = roles.description;
    if (!Array.isArray(fondation) || fondation.length === 0 || !fondation.every((f) => objetSimple(f) && Array.isArray(f.couverture) && Array.isArray(f.constats) && Array.isArray(f.conditions))) {
      illisibles.push({ rang, idAttente: roles.occurrence.id, erreur: 'fondation hors forme' });
      return;
    }
    if (!Array.isArray(structure) || structure.length === 0 || !objetSimple(structure[structure.length - 1]) || typeof structure[structure.length - 1].operation !== 'string') {
      illisibles.push({ rang, idAttente: roles.occurrence.id, erreur: 'structure hors forme' });
      return;
    }
    retenues.push({ rang, ligne, roles });
  });
  return { retenues, illisibles };
}

function indexer(lignes, nom) {
  const parId = new Map();
  for (const l of tableau(lignes, nom)) if (objetSimple(l) && typeof l.id === 'string') parId.set(l.id, l);
  return parId;
}

export function relireAttentesConditionnees(lignesAttentes, actes) {
  tableau(lignesAttentes, 'lignesAttentes');
  if (!objetSimple(actes)) refuser('actes doit être un objet { designations, emissions, observations }');
  const tables = ['designations', 'emissions', 'observations'];
  for (const cle of Object.keys(actes)) if (!tables.includes(cle)) refuser(`actes porte une table inconnue (${cle})`);
  const index = Object.fromEntries(tables.map((t) => [t, indexer(actes[t], `actes.${t}`)]));
  const { retenues, illisibles } = selection(lignesAttentes);
  const attentes = [];
  for (const { rang, roles } of retenues) {
    const { occurrence, description, preuve, references } = roles;
    const idActe = references.idDesignation;
    const trouvees = tables.filter((t) => index[t].has(idActe));
    if (trouvees.length > 1) { illisibles.push({ rang, idAttente: occurrence.id, erreur: 'acte trouvé dans plusieurs tables' }); continue; }
    const table = trouvees.length === 1 ? trouvees[0] : 'aucune';
    const acte = { idActe, table };
    if (table === 'designations' && typeof index.designations.get(idActe).origine === 'string') acte.origine = index.designations.get(idActe).origine;
    if (table === 'emissions' && typeof index.emissions.get(idActe).environnement === 'string') acte.environnement = index.emissions.get(idActe).environnement;
    acte.operation = description.structure[description.structure.length - 1].operation;
    const avantIssue = { statut: 'ecrit-avant-issue', relation: Object.hasOwn(description, 'relation') ? structuredClone(description.relation) : null };
    if (avantIssue.relation === null) avantIssue.relationAbsente = 'ligne-anterieure-a-la-relation';
    avantIssue.chemin = structuredClone(description.chemin);
    avantIssue.constat = structuredClone(description.constat);
    avantIssue.fondation = preuve.fondation.map((f) => ({ conditions: structuredClone(f.conditions), couverture: structuredClone(f.couverture), constats: structuredClone(f.constats), temoinUnique: f.couverture.length === 1 }));
    avantIssue.idContexte = references.idContexte;
    // v0.64.29 — reconnaissance écrite à K0 : RECOPIÉE telle quelle, jamais recalculée (cette vue ne connaît pas l'égalité des relations).
    avantIssue.reconnaissance = Object.hasOwn(roles, 'reconnaissance') ? structuredClone(roles.reconnaissance) : null;
    if (avantIssue.reconnaissance === null) avantIssue.reconnaissanceAbsente = 'ligne-anterieure-a-la-reconnaissance';
    attentes.push({ occurrence: { idAttente: occurrence.id, horodatage: chaineOuNull(occurrence.horodatage), idObservation: chaineOuNull(occurrence.idObservation) }, acte, avantIssue });
  }
  return { attentes, illisibles };
}

export function relireIssuesAujourdhui(lignesAttentes, lignesContextes, vecu) {
  tableau(lignesAttentes, 'lignesAttentes');
  tableau(lignesContextes, 'lignesContextes');
  if (!objetSimple(vecu)) refuser('vecu doit être la sortie de lireExecutionsVecues');
  const valeurs = tableau(vecu.valeurs, 'vecu.valeurs');
  const executions = tableau(vecu.executions, 'vecu.executions');
  const descriptions = tableau(vecu.descriptions, 'vecu.descriptions');
  const { retenues } = selection(lignesAttentes);
  return retenues.map(({ ligne, roles }) => {
    const idAttente = roles.occurrence.id;
    const contextes = lignesContextes.filter((c) => objetSimple(c) && c.id === roles.references.idContexte);
    if (contextes.length !== 1) return { idAttente, aujourdhui: { erreur: contextes.length === 0 ? 'contexte introuvable' : 'contexte présent plusieurs fois' } };
    let issues;
    try {
      issues = issuesDeLAttenteProspective(ligne, contextes[0], valeurs, executions, descriptions);
    } catch (erreur) {
      return { idAttente, aujourdhui: { erreur: message(erreur) } };
    }
    return {
      idAttente,
      aujourdhui: {
        issues: issues.map((i) => {
          const idExecution = i.issue === null ? null : i.issue.idExecution;
          const execution = executions.find((e) => objetSimple(e) && e.id === idExecution);
          const sortie = { idExecution, horodatageExecution: execution ? chaineOuNull(execution.horodatage) : null, statut: Object.hasOwn(i, 'statut') ? i.statut : null };
          if (Object.hasOwn(i, 'reel')) sortie.reel = structuredClone(i.reel);
          return sortie;
        }),
      },
    };
  });
}
// === FIN_LANGAGE_ATTENTES_CONDITIONNEES_PERSISTEES ===
