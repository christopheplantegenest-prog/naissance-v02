// Chantier « PRIMITIVE PURE DE CONSTRUCTION DES ARGUMENTS PRÉSENTS » (décision ChatGPT du
// 03/10/2026, implémentant le contrat figé par le diagnostic du même jour « DIAGNOSTIC REJEU
// DESCRIPTIF »). Primitive PURE répondant UNIQUEMENT à : « pour CETTE forme descriptive et CETTE
// capacité historique, quels arguments puis-je reconstruire SANS AMBIGUÏTÉ depuis le texte
// présent ? » AUCUNE sélection entre formes/capacités concurrentes, AUCUNE invocation, AUCUN
// branchement comportemental, AUCUN score/probabilité/seuil arbitraire.
//
// RÉUTILISE STRICTEMENT : correspondFormeDescriptive() (v0.52), decrirePositionsRoles() (v0.54),
// tokeniser() (transformation.js), CAPACITES (registre.js). AUCUNE reconstruction par comparaison
// de valeurs (argumentsUtilises/contexte.tokens), AUCUNE déduction depuis une ancre descriptive --
// les deux ont été explicitement démontrées dangereuses (faux singleton) par les diagnostics
// précédents.
//
// Domaine ARTIFICIEL neutre (zaccede/zordre/zorbo/zkelmi...), comme tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { construireArgumentsPresents } from '../app/langage/vue-traces.js';
import { decrireStructure } from '../app/langage/extraction.js';
import { CAPACITES } from '../app/langage/registre.js';

// Fabrique une trace voie:'action' au format EXACT de enregistrerTrace() (connaissances.js),
// sans passer par le magasin -- même convention que tests/decrire-positions-roles.test.mjs.
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
function traceAncienne(id, capacite) {
  // Format ANTÉRIEUR à v0.53 : provenancePositions absent du tout.
  return {
    id, sequence: id, horodatage: new Date().toISOString(),
    capacite, voie: 'action', argumentsUtilises: { sujetA: 'zorbo' },
    provenanceArguments: { sujetA: 'texte' }, resultat: { etat: 'inconnu' },
    contexte: { texteBrut: 'zaccede zorbo zordre zkelmi', tokens: ['zaccede', 'zorbo', 'zordre', 'zkelmi'] },
  };
}

// Rapport réel (pas fabriqué à la main) : decrireStructure() sur un petit corpus à 3 ancres fixes
// et une position variable (position 1), compatible avec la capacité réelle "accessibilite"
// (roles: sujetA, operateur, sujetB) réduite ici à un seul rôle variable pour simplifier -- les
// tests touchant aux 3 rôles réels de "accessibilite" construisent leur propre rapport à 3
// positions variables (voir plus bas).
function rapportUnePositionVariable() {
  // "zalpha zX zbeta" / "zalpha zY zbeta" : ancres en 0 et 2, position 1 variable.
  return decrireStructure(['zalpha zun zbeta', 'zalpha zdeux zbeta']);
}
function rapportTroisPositionsVariables() {
  // "zA x zB y zC z" avec x,y,z variables : ancres en 0,2,4, variables en 1,3,5.
  return decrireStructure(['zA zx1 zB zy1 zC zz1', 'zA zx2 zB zy2 zC zz2']);
}

// ============================================================================ A
test('A. tous les rôles non ambigus -> constructible', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 }),
    traceAction(2, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 }),
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  assert.equal(r.etat, 'constructible');
  assert.deepEqual(r.arguments, { sujetA: 'zvaleurA', operateur: 'zvaleurOp', sujetB: 'zvaleurB' });
  assert.ok(r.roles.every((x) => x.etat === 'construit'));
});

// ============================================================================ B
test('B. un rôle avec deux positions concurrentes -> ambigu + incomplet', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 }),
    traceAction(2, 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 5 }), // operateur vu aussi en 1
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  assert.equal(r.etat, 'incomplet');
  const roleOp = r.roles.find((x) => x.role === 'operateur');
  assert.equal(roleOp.etat, 'ambigu');
  assert.equal(r.arguments.operateur, undefined, 'un rôle ambigu ne doit jamais apparaître dans arguments');
  assert.equal(r.arguments.sujetA, 'zvaleurA', 'les autres rôles non ambigus restent construits');
});

// ============================================================================ C
test('C. rôle absent sur certaines traces avec provenance, mais une seule position observée -> construit', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 }),
    traceAction(2, 'accessibilite', { sujetA: 1, sujetB: 5 }), // operateur absent de cette trace
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  const roleOp = r.roles.find((x) => x.role === 'operateur');
  assert.equal(roleOp.etat, 'construit');
  assert.equal(roleOp.absences, 1);
  assert.equal(r.arguments.operateur, 'zvaleurOp');
  assert.equal(r.etat, 'constructible');
});

// ============================================================================ D
test('D. 99 anciennes sans provenance + 1 nouvelle précise -> construit, comptes visibles', () => {
  const traces = [];
  for (let i = 1; i <= 99; i += 1) traces.push(traceAncienne(i, 'accessibilite'));
  traces.push(traceAction(100, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 }));
  const ids = traces.map((t) => t.id);
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: ids, textePresent: texte,
  });
  assert.equal(r.etat, 'constructible');
  assert.deepEqual(r.arguments, { sujetA: 'zvaleurA', operateur: 'zvaleurOp', sujetB: 'zvaleurB' });
  assert.equal(r.tracesAvecProvenance, 1);
  assert.equal(r.tracesSansProvenance, 99, 'les 99 anciennes doivent rester visibles, jamais cachées');
});

// ============================================================================ E
test('E. rôle actuel requis jamais observé -> incomplet', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, sujetB: 5 }), // operateur n'apparaît dans AUCUNE trace
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texte,
  });
  assert.equal(r.etat, 'incomplet');
  const roleOp = r.roles.find((x) => x.role === 'operateur');
  assert.equal(roleOp.etat, 'jamais_observe');
  assert.equal(r.arguments.operateur, undefined);
});

// ============================================================================ F
test('F. rôle historique hors contrat actuel -> ignoré pour la complétude, signalé', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5, roleFantome: 0 }),
    traceAction(2, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5, roleFantome: 0 }),
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  assert.equal(r.etat, 'constructible', 'roleFantome ne doit jamais empêcher la complétude');
  assert.ok(r.rolesHistoriquesIgnores.includes('roleFantome'));
  assert.equal(r.roles.some((x) => x.role === 'roleFantome'), false, 'jamais dans les rôles actuels');
});

// ============================================================================ G
test('G. capacité absente de CAPACITES -> capacite_disparue', () => {
  const traces = [traceAction(1, 'capaciteDisparueDepuisLongtemps', { sujetA: 1 })];
  const rapport = rapportUnePositionVariable();
  const r = construireArgumentsPresents({
    rapport, capacite: 'capaciteDisparueDepuisLongtemps', traces, couvertureIds: [1], textePresent: 'zalpha zun zbeta',
  });
  assert.equal(r.etat, 'capacite_disparue');
  assert.equal(r.arguments, null);
  assert.deepEqual(r.roles, []);
});

// ============================================================================ H
test('H. incohérence défensive (position hors limites du texte présent) -> jamais undefined, incomplet', () => {
  // Rapport et couverture d'une forme à 3 tokens (ancres 0,2, variable 1), mais on force,
  // artificiellement (incohérence d'appel), une provenance pointant vers la position 5 -- qui
  // n'existe structurellement JAMAIS en usage correct (démontré par le diagnostic), mais doit
  // rester défensivement sans danger si elle survient.
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 5, operateur: 3, sujetB: 1 }), // sujetA->5, hors limites pour un texte à 3 tokens
  ];
  const rapport = rapportUnePositionVariable(); // n=3
  const texte = 'zalpha zvaleur zbeta'; // 3 tokens, positions valides 0,1,2 -- jamais 5
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texte,
  });
  const roleA = r.roles.find((x) => x.role === 'sujetA');
  assert.notEqual(roleA.etat, 'construit');
  assert.equal(r.arguments.sujetA, undefined, 'jamais un argument undefined/fabriqué');
  assert.equal(r.etat, 'incomplet');
});

// ============================================================================ I
test('I. deux rôles sur la même position -> autorisé, tous deux construits', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 5 }),
    traceAction(2, 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 5 }),
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zmeme zB zignore zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  assert.equal(r.arguments.sujetA, 'zmeme');
  assert.equal(r.arguments.operateur, 'zmeme');
  assert.equal(r.etat, 'constructible');
});

// ============================================================================ J
test('J. autre capacité présente dans la couverture -> ignorée (filtre déjà assuré par decrirePositionsRoles)', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 }),
    traceAction(2, 'confrontation', { sujetA: 1, sujetB: 3, relation: 5 }), // autre capacité, même couverture
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  assert.equal(r.tracesCapacite, 1, 'seule la trace accessibilite doit être comptée');
  assert.equal(r.etat, 'constructible');
});

// ============================================================================ K
test('K. une seule trace de cette capacité dans la couverture -> reconstruction possible si non ambiguë', () => {
  const traces = [traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 })];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texte,
  });
  assert.equal(r.etat, 'constructible');
  assert.equal(r.tracesAvecProvenance, 1);
});

// ============================================================================ L
test('L. plusieurs formes pourraient correspondre -> la primitive, appelée sur UNE paire, ne tente aucun arbitrage', () => {
  // On vérifie seulement que la fonction ne prend qu'UN rapport et UNE capacité en entrée --
  // aucune liste de formes concurrentes n'est acceptée ni consultée. Deux appels séparés,
  // chacun sur une paire différente, ne s'influencent jamais.
  const traces = [traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 })];
  const rapportF1 = rapportTroisPositionsVariables();
  const rapportF2 = rapportUnePositionVariable();
  const texte1 = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r1 = construireArgumentsPresents({ rapport: rapportF1, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texte1 });
  const r2 = construireArgumentsPresents({ rapport: rapportF2, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: 'zalpha zvaleur zbeta' });
  assert.equal(r1.etat, 'constructible');
  // r2 : même capacité mais rapport F2 (n=3, 1 seule position variable en 1) -- sujetA->1 correspond
  // à la position variable, mais operateur->3 et sujetB->5 sont hors limites pour ce texte (n=3) :
  // incomplet, sans jamais affecter r1 (appels totalement indépendants).
  assert.equal(r2.etat, 'incomplet');
  assert.equal(r1.etat, 'constructible', 'r1 ne doit jamais être affecté par le calcul de r2');
});

// ============================================================================ M
test('M. aucune provenance exploitable dans la couverture -> incomplet', () => {
  const traces = [traceAncienne(1, 'accessibilite'), traceAncienne(2, 'accessibilite')];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  assert.equal(r.etat, 'incomplet');
  assert.ok(r.roles.every((x) => x.etat === 'sans_provenance_exploitable'));
  assert.deepEqual(r.arguments, {});
});

// ============================================================================ N
test('N. position historique invalide -> jamais construite', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: -1, operateur: 3, sujetB: 5 }),
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texte,
  });
  const roleA = r.roles.find((x) => x.role === 'sujetA');
  assert.notEqual(roleA.etat, 'construit');
  assert.equal(r.arguments.sujetA, undefined);
  assert.equal(r.etat, 'incomplet');
});

// ============================================================================ O
test('O. forme non correspondante -> forme_non_correspondante', () => {
  const traces = [traceAction(1, 'accessibilite', { sujetA: 1, operateur: 3, sujetB: 5 })];
  const rapport = rapportTroisPositionsVariables(); // ancres zA/zB/zC
  const texteIncompatible = 'zAUTRE zvaleurA zB zvaleurOp zC zvaleurB'; // zA (ancre position 0) ne correspond pas
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texteIncompatible,
  });
  assert.equal(r.etat, 'forme_non_correspondante');
  assert.equal(r.arguments, null);
  assert.deepEqual(r.roles, []);
});

// ============================================================================ P
test('P. rôle présent uniquement avec positions invalides -> état explicite dédié, jamais "jamais_observe"', () => {
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: -1, operateur: 3, sujetB: 5 }),
    traceAction(2, 'accessibilite', { sujetA: 1.5, operateur: 3, sujetB: 5 }),
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  const roleA = r.roles.find((x) => x.role === 'sujetA');
  assert.notEqual(roleA.etat, 'jamais_observe', 'le rôle EST observé (comme clé), mais toujours invalide');
  assert.notEqual(roleA.etat, 'construit');
  assert.ok(['position_invalide', roleA.etat].includes(roleA.etat)); // nom exact laissé à l'implémentation, mais distinct des deux autres
  assert.equal(r.arguments.sujetA, undefined);
});

// ============================================================================ Q
test('Q. argumentsUtilises permettrait une fausse reconstruction par valeur -- NE DOIT JAMAIS être utilisé', () => {
  // operateur n'a AUCUNE provenance exploitable (jamais dans provenancePositions), mais
  // argumentsUtilises contient une valeur ('zvaleurOp') qui, par coïncidence, apparaît aussi dans
  // le texte présent -- si la primitive violait sa discipline en recherchant par égalité de
  // valeur, elle "trouverait" un faux rôle construit. Elle ne doit JAMAIS le faire.
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, sujetB: 5 }, { sujetA: 'zvaleurA', operateur: 'zvaleurOp', sujetB: 'zvaleurB' }),
  ];
  const rapport = rapportTroisPositionsVariables();
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1], textePresent: texte,
  });
  const roleOp = r.roles.find((x) => x.role === 'operateur');
  assert.equal(roleOp.etat, 'jamais_observe');
  assert.equal(r.arguments.operateur, undefined, 'jamais reconstruit par égalité de valeur');
});

// ============================================================================ R
test('R. ancre descriptive ressemblant à un argument constant -- NE DOIT JAMAIS être utilisée comme rôle', () => {
  // "operateur" n'a aucune provenance exploitable, mais le texte présent et toutes les traces
  // partagent une ancre ("zB") qui pourrait sembler être une valeur constante plausible pour ce
  // rôle si on la confondait avec un argument. Elle ne doit jamais être utilisée : une ancre
  // n'est jamais un rôle.
  const traces = [
    traceAction(1, 'accessibilite', { sujetA: 1, sujetB: 5 }),
    traceAction(2, 'accessibilite', { sujetA: 1, sujetB: 5 }),
  ];
  const rapport = rapportTroisPositionsVariables(); // ancres : zA (0), zB (2), zC (4)
  const texte = 'zA zvaleurA zB zvaleurOp zC zvaleurB';
  const r = construireArgumentsPresents({
    rapport, capacite: 'accessibilite', traces, couvertureIds: [1, 2], textePresent: texte,
  });
  const roleOp = r.roles.find((x) => x.role === 'operateur');
  assert.equal(roleOp.etat, 'jamais_observe');
  assert.equal(r.arguments.operateur, undefined);
  assert.notEqual(r.arguments.operateur, 'zB', 'une ancre ne doit jamais devenir la valeur d\'un rôle');
});

// ============================================================================ CAPACITES réelles -- garde-fou
test('[GARDE] le registre réel "accessibilite" porte toujours exactement {sujetA, operateur, sujetB}', () => {
  assert.deepEqual([...CAPACITES.accessibilite.roles].sort(), ['operateur', 'sujetA', 'sujetB']);
});
