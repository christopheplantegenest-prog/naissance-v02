// === DEBUT_TEST_PREUVE_SUBSTITUTION_DEPUIS_TEMOIN ===
// CHANTIER v0.59.0 — PREUVE PURE DE SUBSTITUTION DEPUIS LE VÉCU (décision ChatGPT du 03/10/2026,
// implémentant le contrat figé par le diagnostic « DIAGNOSTIC DROIT DE TENTER UN REJEU » du même
// jour). Domaine ARTIFICIEL neutre partout, comme pour tous les chantiers précédents de ce projet.
//
// preuveSubstitutionDepuisTemoin() décrit, pour UNE invocation présente déjà reconstruite
// (argumentsPresents, issue de construireArgumentsPresents()), si elle constitue un REJEU EXACT
// d'au moins un témoin historique, une SUBSTITUTION DÉMONTRÉE depuis au moins un témoin (en
// réutilisant STRICTEMENT preuveIndependanceRoles(), jamais recalculée), ou si elle reste
// NON DÉMONTRÉE. AUCUNE invocation réelle, AUCUN branchement, AUCUN choix comportemental.

import test from 'node:test';
import assert from 'node:assert/strict';
import { decrireStructure } from '../app/langage/extraction.js';
import {
  preuveIndependanceRoles,
  preuveSubstitutionDepuisTemoin,
} from '../app/langage/vue-traces.js';

let compteurId = 0;
function traceAction(texteBrut, capacite, provenancePositions) {
  compteurId += 1;
  const t = {
    id: compteurId,
    sequence: compteurId,
    horodatage: '2000-01-01T00:00:00.000Z',
    capacite,
    voie: 'action',
    argumentsUtilises: {},
    provenanceArguments: {},
    resultat: { peuImporte: true },
    contexte: { texteBrut, tokens: [] },
  };
  if (provenancePositions !== undefined) t.provenancePositions = provenancePositions;
  return t;
}
function traceAncienne(texteBrut, capacite) {
  return traceAction(texteBrut, capacite, undefined);
}

function verdictsParId(resultat) {
  const m = new Map();
  for (const t of resultat.temoins) m.set(t.id, t);
  return m;
}

// ---------------------------------------------------------------------------------------------
// A. FORME VARIABLE + INVOCATION EXACTEMENT IDENTIQUE À UNE TRACE → "rejeu_exact"
// ---------------------------------------------------------------------------------------------
test('A. invocation identique rôle par rôle à une trace historique -> etat "rejeu_exact"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' }; // identique à t1

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'rejeu_exact');
  const v = verdictsParId(r);
  assert.equal(v.get(t1.id).verdict, 'rejeu_exact');
  assert.deepEqual(v.get(t1.id).delta, []);
});

// ---------------------------------------------------------------------------------------------
// B. FORME ENTIÈREMENT ANCRÉE + TEXTE IDENTIQUE → "rejeu_exact"
// ---------------------------------------------------------------------------------------------
test('B. forme entièrement ancrée (doublon exact), invocation identique -> "rejeu_exact"', () => {
  const texte = 'zaccede zorbo zordre zkelmi';
  const t1 = traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure([texte, texte]);
  assert.deepEqual(rapport.positionsVariables, []);
  const argumentsPresents = { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' };

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'rejeu_exact');
});

// ---------------------------------------------------------------------------------------------
// C. UNE SEULE VARIABLE, VALEUR NOUVELLE → "substitution_demontree"
// ---------------------------------------------------------------------------------------------
test('C. une seule position variable, valeur présente jamais vue -> "substitution_demontree" (section 6 : aucune paire à inventer)', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede zalpha zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1]);
  const argumentsPresents = { sujetA: 'ZJAMAISVU', operateur: 'zordre', sujetB: 'zkelmi' };

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree');
  const v = verdictsParId(r);
  assert.equal(v.get(t1.id).verdict, 'substitution_demontree');
  assert.deepEqual(v.get(t1.id).delta, ['sujetA']);
});

// ---------------------------------------------------------------------------------------------
// D. DEUX VARIABLES, UN RÔLE CHANGE, PAIRE DISTINGUÉE → "substitution_demontree"
// ---------------------------------------------------------------------------------------------
test('D. deux rôles variables, un seul change par rapport au témoin, paire distinguée -> "substitution_demontree"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul varie
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1]);
  // precondition : un seul rôle variable ici, testé isolément en C -- D veut DEUX variables ; on en ajoute une.
  const t3 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur seul varie
  const traces2 = [t1, t2, t3];
  const rapport2 = decrireStructure(traces2.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport2.positionsVariables, [1, 2]);
  const indep = preuveIndependanceRoles({ rapport: rapport2, capacite: 'accessibilite', traces: traces2, couvertureIds: traces2.map((t) => t.id) });
  assert.equal(indep.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetA').etat, 'distinguee', 'précondition');

  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' }; // vs t1 : sujetA seul change (valeur jamais vue)
  const r = preuveSubstitutionDepuisTemoin({ rapport: rapport2, capacite: 'accessibilite', traces: traces2, couvertureIds: traces2.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree');
  const v = verdictsParId(r);
  assert.equal(v.get(t1.id).verdict, 'substitution_demontree');
  assert.deepEqual(v.get(t1.id).delta, ['sujetA']);
});

// ---------------------------------------------------------------------------------------------
// E. DEUX VARIABLES, UN RÔLE CHANGE, PAIRE NON DISTINGUÉE → "non_demontree"
// ---------------------------------------------------------------------------------------------
test('E. deux rôles variables, un seul change, mais la paire nécessaire est "non_distinguee" -> etat "non_demontree"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA ET operateur changent ENSEMBLE -> jamais isolés
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2]);
  const indep = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(indep.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetA').etat, 'non_distinguee', 'précondition');

  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' }; // vs t1 : sujetA seul change
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'non_demontree');
  const v = verdictsParId(r);
  assert.equal(v.get(t1.id).verdict, 'non_demontree');
  assert.deepEqual(v.get(t1.id).delta, ['sujetA']);
});

// ---------------------------------------------------------------------------------------------
// F. TROIS VARIABLES, UN RÔLE CHANGE, INDÉPENDANT DES DEUX AUTRES → démontrée
// ---------------------------------------------------------------------------------------------
test('F. trois rôles variables, un seul change, démontré indépendant des deux autres -> "substitution_demontree"', () => {
  const base = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v1 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul
  const v2 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur seul
  const v3 = traceAction('zaccede zorbo zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetB seul
  const traces = [base, v1, v2, v3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);

  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' }; // vs base : sujetA seul change
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree');
});

// ---------------------------------------------------------------------------------------------
// G. TROIS VARIABLES, UN RÔLE CHANGE, UNE PAIRE NÉCESSAIRE MANQUE → non démontrée
// ---------------------------------------------------------------------------------------------
test('G. trois rôles variables, un seul change par rapport au témoin, mais sa paire avec un rôle resté fixe manque -> "non_demontree"', () => {
  const base = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v1 = traceAction('zaccede ztoro zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA & operateur changent ENSEMBLE -> (sujetA,operateur) jamais isolés
  const v2 = traceAction('zaccede zorbo zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetB seul
  const traces = [base, v1, v2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);
  const indep = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(indep.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetA').etat, 'non_distinguee', 'précondition');

  // Présent : sujetA seul change (vs base) -- mais sujetA n'a JAMAIS été démontré indépendant d'operateur,
  // un rôle resté fixe ici (operateur = zordre, inchangé) -- la paire nécessaire manque.
  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'non_demontree');
});

// ---------------------------------------------------------------------------------------------
// H. DEUX RÔLES CHANGENT, INDÉPENDANCE MUTUELLE + VIS-À-VIS DES AUTRES → démontrée
// ---------------------------------------------------------------------------------------------
test('H. deux rôles changent simultanément, mutuellement indépendants ET indépendants du rôle resté fixe -> "substitution_demontree"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul (vs t1)
  const t3 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur seul (vs t1)
  const traces = [t1, t2, t3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2]);

  const argumentsPresents = { sujetA: 'ztoro', operateur: 'zautre', sujetB: 'zkelmi' }; // vs t1 : sujetA ET operateur changent
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree');
  const v = verdictsParId(r);
  assert.deepEqual(v.get(t1.id).delta.slice().sort(), ['operateur', 'sujetA']);
});

// ---------------------------------------------------------------------------------------------
// I. DEUX RÔLES CHANGENT, INDÉPENDANCE ENTRE EUX SEULEMENT MAIS PAS AVEC UN TROISIÈME FIXE → non démontrée
// ---------------------------------------------------------------------------------------------
test('I. deux rôles changent, indépendants entre eux, mais pas démontrés indépendants d\'un troisième rôle resté fixe -> "non_demontree"', () => {
  const base = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v1 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul (vs base)
  const v4 = traceAction('zaccede zorbo zautre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur ET sujetB changent TOUJOURS ensemble (vs base) -> jamais isolés entre eux
  const traces = [base, v1, v4];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);
  const indep = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(indep.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetA').etat, 'distinguee', 'précondition : operateur/sujetA distinguée (via base/v1)');
  assert.equal(indep.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetB').etat, 'non_distinguee', 'précondition : operateur/sujetB jamais isolés (ils ne changent qu\'ensemble, via v4)');

  // Présent : sujetA ET operateur changent (vs le témoin base), sujetB reste fixe (zkelmi, comme base) -- la
  // paire (sujetA,operateur) est bien distinguée, mais operateur n'est PAS démontré indépendant de sujetB
  // (resté fixe sous ce témoin) -> ce témoin, et tous les autres, doivent échouer à démontrer.
  const argumentsPresents = { sujetA: 'ztoro', operateur: 'zautre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'non_demontree');
});

// ---------------------------------------------------------------------------------------------
// J/K. RECOMBINAISON DE VALEURS CONNUES / VALEUR TOTALEMENT NOUVELLE → MÊME STANDARD
// ---------------------------------------------------------------------------------------------
test('J. recombinaison de deux valeurs déjà connues séparément -> se ramène à une substitution simple via le meilleur témoin', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA=zorbo, operateur=zordre
  const t2 = traceAction('zaccede ztoro zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA=ztoro, operateur=zautre
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  // sujetA=zorbo (connu via t1) + operateur=zautre (connu via t2) -- combinaison jamais vue ensemble.
  const argumentsPresents = { sujetA: 'zorbo', operateur: 'zautre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  // vs t1 : seul operateur change (zordre->zautre) ; vs t2 : seul sujetA change (ztoro->zorbo).
  // Dans les deux cas, Δ = UN SEUL rôle -- la primitive doit retomber sur une substitution simple.
  assert.equal(r.etat, 'non_demontree', 'precondition : (sujetA,operateur) n\'a jamais été isolée, donc même en Δ=1 la preuve manque ici');
  const v = verdictsParId(r);
  assert.deepEqual(v.get(t1.id).delta, ['operateur']);
  assert.deepEqual(v.get(t2.id).delta, ['sujetA']);
});

test('K. valeur totalement nouvelle à une position : exige exactement la même preuve qu\'une recombinaison (section 11 du diagnostic)', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul varie -> sujetA distinguee d'operateur/sujetB
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'ZVALEURJAMAISVUE', operateur: 'zordre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree', 'même standard que pour une recombinaison de valeurs déjà connues');
});

// ---------------------------------------------------------------------------------------------
// L. TÉMOIN EXACT + AUTRES TÉMOINS SEULEMENT SUBSTITUTION → ÉTAT GLOBAL "rejeu_exact"
// ---------------------------------------------------------------------------------------------
test('L. un témoin donne un rejeu exact, un autre seulement une substitution -> etat global "rejeu_exact" (priorité sémantique)', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' }; // identique à t1 -> rejeu exact via t1 ; substitution via t2 (sujetA change)

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'rejeu_exact');
  const v = verdictsParId(r);
  assert.equal(v.get(t1.id).verdict, 'rejeu_exact');
  assert.equal(v.get(t2.id).verdict, 'substitution_demontree', 'le témoin t2 reste conservé de façon descriptive');
});

// ---------------------------------------------------------------------------------------------
// M. TÉMOIN POSITIF + NOMBREUX TÉMOINS NÉGATIFS → POSITIF CONSERVÉ, AUCUNE MAJORITÉ
// ---------------------------------------------------------------------------------------------
test('M. un seul témoin démontrant une substitution parmi dix négatifs -> preuve positive conservée, aucune majorité', () => {
  const traces = [];
  for (let i = 0; i < 10; i += 1) {
    // dix témoins "confondus" : sujetA et operateur changent toujours ENSEMBLE
    const texte = i % 2 === 0 ? 'zaccede zorbo zordre zkelmi' : 'zaccede ztoro zautre zkelmi';
    traces.push(traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }));
  }
  const isolant = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul vs le premier
  traces.push(isolant);
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));

  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree', 'la preuve positive isolée doit suffire malgré dix témoins négatifs');
});

// ---------------------------------------------------------------------------------------------
// N/O/P. TÉMOINS INEXPLOITABLES
// ---------------------------------------------------------------------------------------------
test('N. trace sans provenance -> témoin inexploitable, neutre (ni preuve ni réfutation)', () => {
  const old = traceAncienne('zaccede zorbo zordre zkelmi', 'accessibilite');
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [old, t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' };

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  const v = verdictsParId(r);
  assert.equal(v.get(old.id).verdict, 'inexploitable');
  assert.equal(r.etat, 'substitution_demontree', 'la trace ancienne neutre ne doit ni aider ni nuire');
});

test('O. rôle absent de la provenance d\'une capacité (global) -> aucune preuve ne peut jamais être établie, "non_demontree" partout', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2 }); // sujetB jamais mentionné
  const t2 = traceAction('zaccede ztoro zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' };

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.ok(r.rolesNonFiables.some((x) => x.role === 'sujetB'));
  assert.equal(r.etat, 'non_demontree');
  for (const t of r.temoins) assert.equal(t.verdict, 'inexploitable');
});

test('P. position invalide pour un rôle (global) -> témoins jamais exploitables pour ce rôle, "non_demontree"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: -1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: -1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'ztoro', operateur: 'zordre', sujetB: 'zkelmi' };

  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.ok(r.rolesNonFiables.some((x) => x.role === 'sujetA' && x.raison === 'position_invalide'));
  assert.equal(r.etat, 'non_demontree');
});

// ---------------------------------------------------------------------------------------------
// Q. argumentsUtilises N'EST JAMAIS LU
// ---------------------------------------------------------------------------------------------
test('Q. modifier argumentsUtilises des traces ne change jamais le résultat', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'ZNOUVEAU', operateur: 'zordre', sujetB: 'zkelmi' };
  const r1 = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });

  const tracesAlterees = traces.map((t) => ({ ...t, argumentsUtilises: { sujetA: 'FAUX', operateur: 'FAUX', sujetB: 'FAUX' } }));
  const r2 = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces: tracesAlterees, couvertureIds: tracesAlterees.map((t) => t.id), argumentsPresents });
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// R. ORDRE ACCIDENTEL DES TRACES → RÉSULTAT DÉTERMINISTE ÉQUIVALENT
// ---------------------------------------------------------------------------------------------
test('R. permutation de l\'ordre des traces/couvertureIds -> résultat identique', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t3 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2, t3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'ztoro', operateur: 'zordre', sujetB: 'zkelmi' };

  const r1 = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  const tracesMelangees = [t3, t1, t2];
  const idsMelanges = [t3.id, t1.id, t2.id];
  const r2 = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces: tracesMelangees, couvertureIds: idsMelanges, argumentsPresents });
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// S. DEUX RÔLES PARTAGEANT LA MÊME POSITION → RESPECTER "meme_position" DE v0.58
// ---------------------------------------------------------------------------------------------
test('S. deux rôles variables partageant la même position -> jamais fabriquer une indépendance, "non_demontree" si l\'un change', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zvase', 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const indep = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  const paireMeme = indep.paires.find((p) => (p.roleA === 'operateur' && p.roleB === 'sujetA'));
  assert.equal(paireMeme.etat, 'meme_position', 'précondition');

  // Présent : sujetA change (vs t1), operateur et sujetA partagent la même position -- si operateur change aussi
  // de la même façon (lisant littéralement le même jeton), la paire reste "meme_position", jamais "distinguee".
  const argumentsPresents = { sujetA: 'ztoro', operateur: 'ztoro', sujetB: 'zkelmi' }; // vs t1 : sujetA ET operateur "changent" (même jeton lu)
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'non_demontree', 'la paire "meme_position" ne doit jamais être confondue avec "distinguee"');
});

// ---------------------------------------------------------------------------------------------
// T. AUCUNE VARIABLE MAIS Δ ARTIFICIELLEMENT NON VIDE → NE PAS CONCLURE PAR VACUITÉ
// ---------------------------------------------------------------------------------------------
test('T. forme entièrement ancrée mais argumentsPresents incohérent avec l\'ancre -> incohérence honnêtement signalée, jamais une fabrication', () => {
  const texte = 'zaccede zorbo zordre zkelmi';
  const t1 = traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure([texte, texte]);
  assert.deepEqual(rapport.positionsVariables, []);

  // argumentsPresents délibérément incohérent avec l'ancre réelle (ne devrait jamais arriver en usage
  // correct, puisque correspondFormeDescriptive() l'aurait déjà refusé -- cas défensif uniquement).
  const argumentsPresents = { sujetA: 'ZINCOHERENT', operateur: 'zordre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.notEqual(r.etat, 'substitution_demontree', 'jamais une fabrication par vacuité sur une position ancrée');
  assert.notEqual(r.etat, 'rejeu_exact', 'une incohérence réelle avec l\'ancre ne doit jamais ressortir comme un rejeu exact');
  const v = verdictsParId(r);
  assert.equal(v.get(t1.id).verdict, 'inexploitable');
  assert.equal(v.get(t1.id).raison, 'incoherence_ancrage');
});

// ---------------------------------------------------------------------------------------------
// U. CONTRE-EXEMPLE TERNAIRE 001/010/100 → 101 : LIMITE PAIRWISE EXPLICITEMENT DOCUMENTÉE
// ---------------------------------------------------------------------------------------------
test('U. corpus ternaire (001/010/100) : 101 est "substitution_demontree" sous le standard pairwise -- limite connue et ASSUMÉE, jamais résolue ici', () => {
  // On réutilise la capacité "accessibilite" avec sujetA/operateur/sujetB comme A/B/C binaires.
  const obs1 = traceAction('zaccede z0 zordre z0', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // A=0,B(operateur anchor n/a)... -- voir ci-dessous, on encode A,B,C via 3 positions variables réelles
  // Encodage réel : positions 1(sujetA),2(operateur),3(sujetB) portent chacune soit "z0" soit "z1".
  // obs1 = (A,B,C) = (0,0,1) ; obs2 = (0,1,0) ; obs3 = (1,0,0).
  const o1 = traceAction('zaccede z0 zB0 zC1', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const o2 = traceAction('zaccede z0 zB1 zC0', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const o3 = traceAction('zaccede z1 zB0 zC0', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [o1, o2, o3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);
  const indep = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  for (const p of indep.paires) assert.equal(p.etat, 'distinguee', `précondition : (${p.roleA},${p.roleB}) doit être "distinguee" sur ce corpus ternaire`);

  // Présent = (1,0,1) = "101" -- jamais observé, violerait une contrainte ternaire cachée
  // (« au plus un 1 parmi les trois ») si elle existait réellement -- mais le standard pairwise
  // actuellement adopté ne peut PAS la détecter.
  const argumentsPresents = { sujetA: 'z1', operateur: 'zB0', sujetB: 'zC1' }; // vs o3=(1,0,0) : seul sujetB change (0->1)
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id), argumentsPresents });
  assert.equal(r.etat, 'substitution_demontree', 'sous le standard pairwise ADOPTÉ (identique à positionsDistinguees()), ce cas EST démontré -- ceci ne constitue PAS une preuve d\'absence de contrainte d\'ordre supérieur (limite assumée, voir diagnostic DROIT DE TENTER, section F/G)');
});

// ---------------------------------------------------------------------------------------------
// V. CAPACITÉ ABSENTE DU REGISTRE ACTUEL → ÉTAT DESCRIPTIF HONNÊTE
// ---------------------------------------------------------------------------------------------
test('V. capacité disparue du registre actuel -> état "capacite_disparue", aucune fabrication', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'zoperation-disparue', { sujetA: 1 });
  const traces = [t1];
  const rapport = decrireStructure([t1.contexte.texteBrut, 'zaccede zalpha zordre zkelmi']);
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'zoperation-disparue', traces, couvertureIds: [t1.id], argumentsPresents: { sujetA: 'zorbo' } });
  assert.equal(r.etat, 'capacite_disparue');
  assert.deepEqual(r.temoins, []);
});

// ---------------------------------------------------------------------------------------------
// W. COUVERTURE AVEC IDS INTROUVABLES → VISIBLES/NEUTRES
// ---------------------------------------------------------------------------------------------
test('W. un id de couvertureIds introuvable dans les traces -> comptabilisé, neutre, jamais un crash', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const argumentsPresents = { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: [t1.id, t2.id, 999999], argumentsPresents });
  assert.equal(r.idsIntrouvables, 1);
  assert.equal(r.etat, 'rejeu_exact');
});

// ---------------------------------------------------------------------------------------------
// X. [GARDE] ANTI-NORMATIVITÉ
// ---------------------------------------------------------------------------------------------
test('[GARDE] X. aucun score/confiance/fréquence/majorité/succès/résultat ne doit jamais intervenir dans la sortie', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1];
  const rapport = decrireStructure([t1.contexte.texteBrut, 'zaccede zalpha zordre zkelmi']);
  const argumentsPresents = { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' };
  const r = preuveSubstitutionDepuisTemoin({ rapport, capacite: 'accessibilite', traces, couvertureIds: [t1.id], argumentsPresents });
  const serialise = JSON.stringify(r).toLowerCase();
  for (const motInterdit of ['score', 'confiance', 'frequen', 'majorit', 'succes', 'resultat', 'reward']) {
    assert.ok(!serialise.includes(motInterdit), `le mot interdit "${motInterdit}" ne doit jamais apparaître dans la sortie`);
  }
});
// === FIN_TEST_PREUVE_SUBSTITUTION_DEPUIS_TEMOIN ===
