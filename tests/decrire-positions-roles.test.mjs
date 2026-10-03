// === DEBUT_TEST_DECRIRE_POSITIONS_ROLES ===
// v0.54 — DÉCISION CHATGPT « DESCRIPTION POSITIONNELLE DES RÔLES » (03/10/2026), implémentant le
// contrat figé par le diagnostic du même jour. Primitive PURE, strictement descriptive : décrit,
// pour un couple (forme descriptive F, capacité A), les positions sources HISTORIQUEMENT OBSERVÉES
// pour chaque rôle, à partir UNIQUEMENT de trace.provenancePositions (v0.53, un fait brut, jamais
// recalculé par comparaison de valeurs — le diagnostic a démontré avec le vrai code qu'une telle
// reconstruction peut produire un faux singleton).
//
// AUCUN branchement, AUCUNE invocation, AUCUN choix de capacité, AUCUNE sélection de forme, AUCUNE
// persistance, AUCUN score/confiance/majorité.
//
// Domaine ARTIFICIEL neutre (zaccede/zordre/zorbo/zkelmi...), comme tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decrirePositionsRoles, cooccurrencesSituationAction } from '../app/langage/vue-traces.js';
import { evaluerAction, invoquerAction } from '../app/langage/action.js';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive, apprendreAction } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

// Fabrique une trace voie:'action' au format EXACT de enregistrerTrace() (connaissances.js),
// sans passer par le magasin (diagnostic/test pur).
function traceAction(id, capacite, provenancePositions, argumentsUtilises = {}) {
  return {
    id, sequence: id, horodatage: new Date().toISOString(),
    capacite, voie: 'action', argumentsUtilises,
    provenanceArguments: Object.fromEntries(Object.keys(argumentsUtilises).map((r) => [r, 'texte'])),
    resultat: { etat: 'inconnu' },
    contexte: { texteBrut: 'zx zy zz', tokens: ['zx', 'zy', 'zz'] },
    provenancePositions,
  };
}
function traceComposition(id, capacite) {
  return {
    id, sequence: id, horodatage: new Date().toISOString(),
    capacite, voie: 'composition', argumentsUtilises: {},
    provenanceArguments: {}, resultat: {}, contexte: null, provenancePositions: null,
  };
}
function traceAncienne(id, capacite) {
  // Format ANTÉRIEUR à v0.53 : provenancePositions absent du tout (jamais ajouté après coup).
  return {
    id, sequence: id, horodatage: new Date().toISOString(),
    capacite, voie: 'action', argumentsUtilises: { sujetA: 'zorbo' },
    provenanceArguments: { sujetA: 'texte' }, resultat: { etat: 'inconnu' },
    contexte: { texteBrut: 'zaccede zorbo zordre zkelmi', tokens: ['zaccede', 'zorbo', 'zordre', 'zkelmi'] },
  };
}

// -------------------------------------------------------------------------------------------
// A. 3 traces nouvelles : R->1 trois fois.
// -------------------------------------------------------------------------------------------
test('A. 3 traces R->1 -> tracesAvecRole:3, absences:0, positionsInvalides:0, positions:[{1,3}]', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: 1 }),
    traceAction(2, 'accessibilite', { R: 1 }),
    traceAction(3, 'accessibilite', { R: 1 }),
  ];
  const r = decrirePositionsRoles(traces, [1, 2, 3], 'accessibilite');
  assert.equal(r.capacite, 'accessibilite');
  assert.equal(r.tracesCapacite, 3);
  assert.equal(r.tracesAvecProvenance, 3);
  assert.equal(r.tracesSansProvenance, 0);
  assert.equal(r.idsIntrouvables, 0);
  assert.deepEqual(r.roles, [{
    role: 'R', tracesAvecRole: 3, absences: 0, positionsInvalides: 0, positions: [{ position: 1, occurrences: 3 }],
  }]);
});

// -------------------------------------------------------------------------------------------
// B. 9xR->1, 1xR->2 -- fréquences conservées, aucun choix.
// -------------------------------------------------------------------------------------------
test('B. 9xR->1, 1xR->2 -> les deux positions et fréquences conservées, aucun choix', () => {
  const traces = [];
  for (let i = 1; i <= 9; i += 1) traces.push(traceAction(i, 'accessibilite', { R: 1 }));
  traces.push(traceAction(10, 'accessibilite', { R: 2 }));
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  const roleR = r.roles.find((x) => x.role === 'R');
  assert.deepEqual(roleR.positions, [{ position: 1, occurrences: 9 }, { position: 2, occurrences: 1 }]);
});

// -------------------------------------------------------------------------------------------
// C. 10 traces avec provenance, R présent dans seulement 2 (R->1 puis R->2).
// -------------------------------------------------------------------------------------------
test('C. R présent dans 2 traces sur 10 -> tracesAvecRole:2, absences:8', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: 1 }),
    traceAction(2, 'accessibilite', { R: 2 }),
  ];
  for (let i = 3; i <= 10; i += 1) traces.push(traceAction(i, 'accessibilite', {})); // R absent, mais provenance exploitable
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  assert.equal(r.tracesAvecProvenance, 10);
  const roleR = r.roles.find((x) => x.role === 'R');
  assert.equal(roleR.tracesAvecRole, 2);
  assert.equal(roleR.absences, 8);
});

// -------------------------------------------------------------------------------------------
// D. 99 anciennes sans provenance + 1 nouvelle R->1 -- les 99 restent visibles.
// -------------------------------------------------------------------------------------------
test('D. 99 anciennes sans provenance + 1 nouvelle -> visibles dans tracesSansProvenance, jamais reconstruites', () => {
  const traces = [];
  for (let i = 1; i <= 99; i += 1) traces.push(traceAncienne(i, 'accessibilite'));
  traces.push(traceAction(100, 'accessibilite', { R: 1 }));
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  assert.equal(r.tracesCapacite, 100);
  assert.equal(r.tracesAvecProvenance, 1);
  assert.equal(r.tracesSansProvenance, 99);
  const roleR = r.roles.find((x) => x.role === 'R');
  assert.deepEqual(roleR, { role: 'R', tracesAvecRole: 1, absences: 0, positionsInvalides: 0, positions: [{ position: 1, occurrences: 1 }] });
});

// -------------------------------------------------------------------------------------------
// E. Aucune trace avec provenance -- objet descriptif normal, roles:[].
// -------------------------------------------------------------------------------------------
test('E. aucune trace avec provenance -> objet normal, roles:[], jamais une erreur', () => {
  const traces = [];
  for (let i = 1; i <= 10; i += 1) traces.push(traceAncienne(i, 'accessibilite'));
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  assert.equal(r.tracesCapacite, 10);
  assert.equal(r.tracesAvecProvenance, 0);
  assert.equal(r.tracesSansProvenance, 10);
  assert.deepEqual(r.roles, []);
});

// -------------------------------------------------------------------------------------------
// F. Deux rôles sur la même position -- conservés indépendamment, aucune bijection imposée.
// -------------------------------------------------------------------------------------------
test('F. deux rôles sur la même position -> chacun conservé indépendamment', () => {
  const traces = [traceAction(1, 'accessibilite', { roleA: 1, roleB: 1 })];
  const r = decrirePositionsRoles(traces, [1], 'accessibilite');
  const roleA = r.roles.find((x) => x.role === 'roleA');
  const roleB = r.roles.find((x) => x.role === 'roleB');
  assert.deepEqual(roleA.positions, [{ position: 1, occurrences: 1 }]);
  assert.deepEqual(roleB.positions, [{ position: 1, occurrences: 1 }]);
});

// -------------------------------------------------------------------------------------------
// G. Même rôle à positions différentes via plusieurs traces/actions -- aucun conflit.
// -------------------------------------------------------------------------------------------
test('G. même rôle à positions différentes -> les deux comptées, aucun conflit signalé', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: 1 }),
    traceAction(2, 'accessibilite', { R: 1 }),
    traceAction(3, 'accessibilite', { R: 1 }),
    traceAction(4, 'accessibilite', { R: 1 }),
    traceAction(5, 'accessibilite', { R: 2 }),
    traceAction(6, 'accessibilite', { R: 2 }),
    traceAction(7, 'accessibilite', { R: 2 }),
  ];
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  const roleR = r.roles.find((x) => x.role === 'R');
  assert.deepEqual(roleR.positions, [{ position: 1, occurrences: 4 }, { position: 2, occurrences: 3 }]);
});

// -------------------------------------------------------------------------------------------
// H. Capacité différente dans la même couverture -- n'entre jamais dans tracesCapacite.
// -------------------------------------------------------------------------------------------
test('H. capacité différente dans la couverture -> ignorée, pas une anomalie', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: 1 }),
    traceAction(2, 'confrontation', { sujetA: 1 }),
  ];
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  assert.equal(r.tracesCapacite, 1);
  assert.equal(r.tracesAvecProvenance, 1);
  assert.equal(r.tracesSansProvenance, 0);
});

// -------------------------------------------------------------------------------------------
// I. Capacité demandée absente du registre actuel -- la description fonctionne quand même.
// -------------------------------------------------------------------------------------------
test('I. capacité absente du registre actuel -> décrite normalement, aucune consultation de CAPACITES', () => {
  const traces = [traceAction(1, 'capaciteDisparue', { R: 1 })];
  const r = decrirePositionsRoles(traces, [1], 'capaciteDisparue');
  assert.equal(r.capacite, 'capaciteDisparue');
  assert.equal(r.tracesCapacite, 1);
  assert.deepEqual(r.roles[0].positions, [{ position: 1, occurrences: 1 }]);
});

// -------------------------------------------------------------------------------------------
// J. provenancePositions:null (composition) -- comptée sans provenance.
// -------------------------------------------------------------------------------------------
test('J. provenancePositions:null -> comptée dans tracesSansProvenance', () => {
  const traces = [traceComposition(1, 'recherche'), traceAction(2, 'recherche', { valeur: 0 })];
  const r = decrirePositionsRoles(traces, [1, 2], 'recherche');
  assert.equal(r.tracesCapacite, 2);
  assert.equal(r.tracesAvecProvenance, 1);
  assert.equal(r.tracesSansProvenance, 1);
});

// -------------------------------------------------------------------------------------------
// K. Position invalide (-1, 1.5, "1") -- positionsInvalides augmente, aucune occurrence créée.
// -------------------------------------------------------------------------------------------
test('K. position invalide -> trace et rôle restent présents, positionsInvalides augmente, aucune occurrence', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: -1 }),
    traceAction(2, 'accessibilite', { R: 1.5 }),
    traceAction(3, 'accessibilite', { R: '1' }),
    traceAction(4, 'accessibilite', { R: 2 }), // une seule valide, pour vérifier qu'elle reste comptée
  ];
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  assert.equal(r.tracesAvecProvenance, 4);
  const roleR = r.roles.find((x) => x.role === 'R');
  assert.equal(roleR.tracesAvecRole, 4, 'les 4 traces ont la clé R présente, quelle que soit la validité');
  assert.equal(roleR.positionsInvalides, 3);
  assert.deepEqual(roleR.positions, [{ position: 2, occurrences: 1 }]);
});

// -------------------------------------------------------------------------------------------
// L. Id de couverture introuvable -- idsIntrouvables augmente, pas de throw.
// -------------------------------------------------------------------------------------------
test('L. id introuvable -> idsIntrouvables augmente, aucun throw', () => {
  const traces = [traceAction(1, 'accessibilite', { R: 1 })];
  assert.doesNotThrow(() => decrirePositionsRoles(traces, [1, 'id-fantome'], 'accessibilite'));
  const r = decrirePositionsRoles(traces, [1, 'id-fantome'], 'accessibilite');
  assert.equal(r.idsIntrouvables, 1);
  assert.equal(r.tracesCapacite, 1);
});

// -------------------------------------------------------------------------------------------
// M. Même id dupliqué dans couvertureIds -- compté une seule fois.
// -------------------------------------------------------------------------------------------
test('M. id dupliqué dans couvertureIds -> compté une seule fois', () => {
  const traces = [traceAction(1, 'accessibilite', { R: 1 })];
  const r = decrirePositionsRoles(traces, [1, 1, 1], 'accessibilite');
  assert.equal(r.tracesCapacite, 1);
  assert.deepEqual(r.roles[0].positions, [{ position: 1, occurrences: 1 }]);
});

// -------------------------------------------------------------------------------------------
// N. Ordre des traces permuté -- sortie strictement identique.
// -------------------------------------------------------------------------------------------
test('N. ordre des traces permuté -> sortie strictement identique', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 2 }),
    traceAction(2, 'accessibilite', { sujetA: 1, operateur: 3 }),
  ];
  const ids = [1, 2];
  const r1 = decrirePositionsRoles(traces, ids, 'accessibilite');
  const r2 = decrirePositionsRoles(traces.slice().reverse(), ids, 'accessibilite');
  assert.deepEqual(r1, r2);
});

// -------------------------------------------------------------------------------------------
// O. Ordre des clés de provenancePositions différent -- rôles retournés dans un ordre déterministe.
// -------------------------------------------------------------------------------------------
test('O. ordre des clés différent dans provenancePositions -> rôles triés alphabétiquement en sortie', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetB: 3, sujetA: 1, operateur: 2 }),
    traceAction(2, 'accessibilite', { operateur: 2, sujetA: 1, sujetB: 3 }),
  ];
  const r = decrirePositionsRoles(traces, [1, 2], 'accessibilite');
  assert.deepEqual(r.roles.map((x) => x.role), ['operateur', 'sujetA', 'sujetB']);
});

// -------------------------------------------------------------------------------------------
// P. Invariant : somme(occurrences) + positionsInvalides = tracesAvecRole.
// -------------------------------------------------------------------------------------------
test('P. invariant somme(occurrences) + positionsInvalides = tracesAvecRole', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: 1 }),
    traceAction(2, 'accessibilite', { R: 2 }),
    traceAction(3, 'accessibilite', { R: -1 }),
    traceAction(4, 'accessibilite', { R: 1 }),
  ];
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  const roleR = r.roles.find((x) => x.role === 'R');
  const sommeOccurrences = roleR.positions.reduce((s, p) => s + p.occurrences, 0);
  assert.equal(sommeOccurrences + roleR.positionsInvalides, roleR.tracesAvecRole);
});

// -------------------------------------------------------------------------------------------
// Q. Invariant : tracesAvecRole + absences = tracesAvecProvenance.
// -------------------------------------------------------------------------------------------
test('Q. invariant tracesAvecRole + absences = tracesAvecProvenance', () => {
  const traces = [
    traceAction(1, 'accessibilite', { R: 1 }),
    traceAction(2, 'accessibilite', {}),
    traceAction(3, 'accessibilite', { R: 2 }),
  ];
  const ids = traces.map((t) => t.id);
  const r = decrirePositionsRoles(traces, ids, 'accessibilite');
  const roleR = r.roles.find((x) => x.role === 'R');
  assert.equal(roleR.tracesAvecRole + roleR.absences, r.tracesAvecProvenance);
});

// -------------------------------------------------------------------------------------------
// R. provenancePositions:{} -- comptée dans tracesAvecProvenance, aucun rôle ajouté.
// -------------------------------------------------------------------------------------------
test('R. provenancePositions:{} -> comptée avec provenance, aucun rôle', () => {
  const traces = [traceAction(1, 'accessibilite', {})];
  const r = decrirePositionsRoles(traces, [1], 'accessibilite');
  assert.equal(r.tracesAvecProvenance, 1);
  assert.deepEqual(r.roles, []);
});

// -------------------------------------------------------------------------------------------
// S. INTÉGRATION RÉELLE : provenancePositions issu réellement de invoquerAction() v0.53, intégré
// dans une couverture réellement produite par cooccurrencesSituationAction().
// -------------------------------------------------------------------------------------------
test('S. intégration réelle : provenance issue de invoquerAction(), couverture issue de cooccurrencesSituationAction()', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });

  const exemples = [
    'zaccede zorbo zordre zkelmi',
    'zaccede zfulgo zordre zkelmi',
    'zaccede zorbo zinverse zkelmi',
    'zaccede zorbo zordre zvex',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples });
  assert.equal(evalue.statut, 'validee');
  await ecran.confirmerAction({ operation: 'accessibilite', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut });

  // Deux invocations RÉELLES distinctes (même squelette, position1 variable) -- vueDescriptive()
  // (seuilMin=2 par défaut, induction.js) a besoin d'au moins deux textes pour former un motif.
  await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');
  await ecran.tenterReconnaissanceAction('zaccede zfulgo zordre zkelmi');
  assert.equal(esprit.traces.length, 2);
  assert.deepEqual(esprit.traces[0].provenancePositions, { sujetA: 1, operateur: 2, sujetB: 3 });
  assert.deepEqual(esprit.traces[1].provenancePositions, { sujetA: 1, operateur: 2, sujetB: 3 });

  const vue = cooccurrencesSituationAction(esprit.traces);
  assert.equal(vue.length, 1);
  const element = vue[0];
  assert.deepEqual(element.capacites, [{ capacite: 'accessibilite', occurrences: 2 }]);

  const r = decrirePositionsRoles(esprit.traces, element.couverture, 'accessibilite');
  assert.equal(r.tracesAvecProvenance, 2);
  assert.deepEqual(r.roles, [
    { role: 'operateur', tracesAvecRole: 2, absences: 0, positionsInvalides: 0, positions: [{ position: 2, occurrences: 2 }] },
    { role: 'sujetA', tracesAvecRole: 2, absences: 0, positionsInvalides: 0, positions: [{ position: 1, occurrences: 2 }] },
    { role: 'sujetB', tracesAvecRole: 2, absences: 0, positionsInvalides: 0, positions: [{ position: 3, occurrences: 2 }] },
  ]);
});

// -------------------------------------------------------------------------------------------
// T. CAS DU BUG CONCEPTUEL HISTORIQUE : la primitive ne doit JAMAIS reconstruire une position par
// comparaison de valeur, même quand une telle comparaison produirait une coïncidence trompeuse.
// -------------------------------------------------------------------------------------------
test('T. anti-régression : seules les positions de provenancePositions comptent, jamais une coïncidence de token', () => {
  // 'zordre' apparaît en position 1 (vraie source d'operateur, selon provenancePositions) ET
  // en position 2 (coïncidence pure dans contexte.tokens) -- une reconstruction par égalité de
  // valeur donnerait faussement {1,2}. La primitive ne doit renvoyer QUE {1}, lu directement.
  const trace = {
    id: 1, sequence: 1, horodatage: new Date().toISOString(),
    capacite: 'accessibilite', voie: 'action',
    argumentsUtilises: { operateur: 'zordre', sujetA: 'zordre', sujetB: 'zdelta' },
    provenanceArguments: { operateur: 'texte', sujetA: 'texte', sujetB: 'texte' },
    resultat: { etat: 'inconnu' },
    contexte: { texteBrut: 'zaccede zordre zordre zdelta', tokens: ['zaccede', 'zordre', 'zordre', 'zdelta'] },
    provenancePositions: { operateur: 1, sujetA: 2, sujetB: 3 },
  };
  const r = decrirePositionsRoles([trace], [1], 'accessibilite');
  const roleOperateur = r.roles.find((x) => x.role === 'operateur');
  assert.deepEqual(roleOperateur.positions, [{ position: 1, occurrences: 1 }], 'jamais {1,2} : aucune reconstruction par valeur');
});
// === FIN_TEST_DECRIRE_POSITIONS_ROLES ===
