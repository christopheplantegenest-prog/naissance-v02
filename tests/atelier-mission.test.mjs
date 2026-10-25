// v0.65.2 — AT-3 « DOSSIER DE MISSION + RAPPORT DE RETOUR » (GO « AUTORISATION AT-3 », 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF —
// aucune acquisition. Preuves : dossier identique octet pour octet à données égales, empreinte de référence figée, ordre des clés sans
// effet, ensembles triés et listes ordonnées conservées, refus sans correction des données non canoniques, limite en octets, aucune
// injection de section, rapport strictement structurel (3 statuts, clés en double refusées, identité, périmètre, interdit prioritaire),
// aucune sortie d'acceptation, pureté, dormance, aucun couplage, base / schéma / tables inchangés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/mission.js';
import { construireMission, verifierRapport } from '../app/atelier/mission.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATELIER = join(RACINE, 'app', 'atelier');
const CHEMIN = join(ATELIER, 'mission.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const sha256 = (t) => createHash('sha256').update(Buffer.from(t, 'utf8')).digest('hex');

const SHA = '7a6b634e9c0d1f2a3b4c5d6e7f8091a2b3c4d5e6';
const REF = Object.freeze({
  chantier: 'atelier-demo',
  objectif: 'Démontrer la construction d\'un dossier de mission déterministe.',
  base: { sha: SHA, version: '0.65.1' },
  jalon: { id: 'mission-1', titre: 'Dossier de démonstration', comportement: 'Le dossier liste ce qui est attendu.\n\nRien n\'est branché.' },
  tentative: 2,
  criteres: ['Le dossier est identique à données égales.', 'Une donnée irrégulière est refusée.'],
  tests: ['Égalité octet pour octet.', 'Refus des textes non canoniques.'],
  autorises: ['tests/atelier-mission.test.mjs', 'app/atelier/'],
  interdits: ['app/atelier/budget.js', 'app/atelier/chantier.js'],
  frontieres: ['Aucun écran.', 'Aucune persistance.'],
  decisions: [{ id: 'D-007', texte: 'Atelier : OUTILLAGE NON COGNITIF.\nClaude produit des candidats.' }, { id: 'D-001', texte: 'Naissance n\'est pas un wrapper de LLM.' }],
});
// MISE À JOUR DÉLIBÉRÉE seulement : toute évolution du protocole atelier-mission-1 change cette empreinte et le nom du protocole.
const EMPREINTE_REF = '8906e5a33e27646a181b9f1465b47bafd0945d7d57427bfa5eef1c1fc81cac9a';
const avec = (patch) => ({ ...structuredClone(REF), ...patch });
const BRANCHE = 'atelier/atelier-demo/mission-1/2';
const RAPPORT = Object.freeze({
  protocole: 'atelier-rapport-1', chantier: 'atelier-demo', jalon: 'mission-1', tentative: 2, base: { sha: SHA, version: '0.65.1' },
  statut: 'candidat', candidat: { branche: BRANCHE, sha: 'b'.repeat(40) },
  fichiers: { crees: ['app/atelier/mission.js'], modifies: ['tests/atelier-mission.test.mjs'], supprimes: [] },
  tests: { total: 5302, reussis: 5302, echecs: 0 }, divergences: [], question: null, motif: null,
});
const rapport = (patch = {}) => JSON.stringify({ ...structuredClone(RAPPORT), ...patch });
const BLOQUE = { statut: 'bloque', candidat: null, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: null, question: 'Quel fichier ?' };
const ECHEC = { statut: 'echec', candidat: null, tests: { total: 10, reussis: 8, echecs: 2 }, motif: 'Deux tests échouent.' };
function nonConforme(texte, motif, d = REF) {
  const r = verifierRapport(d, texte);
  assert.equal(r.structure, 'non-conforme', `refus attendu (${motif})`);
  assert.match(r.raison, motif);
  return r;
}
const refusMission = (d, motif) => assert.throws(() => construireMission(d), (e) => e instanceof TypeError && motif.test(e.message));

// ------------------------------------------------------------------------------------------------ dossier
test('dossier de référence : sections dans l\'ordre, LF seulement, fin exacte, empreinte SHA-256 figée', () => {
  const t = construireMission(REF);
  const entetes = t.split('\n').filter((l) => l.startsWith('== '));
  assert.deepEqual(entetes, ['== IDENTITÉ ==', '== RÈGLES PERMANENTES DE L\'ATELIER ==', '== OBJECTIF DU CHANTIER ==', '== JALON ==', '== CRITÈRES D\'ACCEPTATION ==', '== TESTS EXIGÉS ==', '== PÉRIMÈTRE ==', '== FRONTIÈRES DU JALON ==', '== DÉCISIONS ACTIVES À RESPECTER ==', '== RAPPORT DE RETOUR ==']);
  assert.ok(t.startsWith('MISSION ATELIER — protocole atelier-mission-1\nOUTILLAGE NON COGNITIF — aucune acquisition de Naissance.\n\n== IDENTITÉ ==\n'));
  assert.ok(t.endsWith('}\n\nFIN DE MISSION\n'));
  assert.equal(t.includes('\r'), false);
  assert.equal(t.includes('\t'), false);
  assert.match(t, /\nchantier : atelier-demo\njalon : mission-1\ntentative : 2\nbase\.sha : 7a6b634e9c0d1f2a3b4c5d6e7f8091a2b3c4d5e6\nbase\.version : 0\.65\.1\nbranche du candidat : atelier\/atelier-demo\/mission-1\/2\n/);
  assert.equal(sha256(t), EMPREINTE_REF);
});
test('égalité octet pour octet : deux constructions, une copie profonde, un aller-retour JSON', () => {
  const a = Buffer.from(construireMission(REF), 'utf8');
  for (const d of [REF, structuredClone(REF), JSON.parse(JSON.stringify(REF))]) assert.ok(Buffer.from(construireMission(d), 'utf8').equals(a));
});
test('l\'ordre des clés de l\'appelant n\'a aucun effet, à tous les niveaux', () => {
  const inverse = (o) => (Array.isArray(o) ? o.map(inverse) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, inverse(v)])) : o);
  const d = inverse(structuredClone(REF));
  assert.notDeepEqual(Object.keys(d), Object.keys(REF));
  assert.equal(construireMission(d), construireMission(REF));
});
test('chaque donnée pertinente change le dossier', () => {
  const ref = construireMission(REF);
  const variantes = [
    { chantier: 'atelier-autre' }, { objectif: 'Autre objectif.' }, { base: { sha: 'c'.repeat(40), version: '0.65.1' } }, { base: { sha: SHA, version: '0.65.2' } },
    { jalon: { ...REF.jalon, id: 'mission-2' } }, { jalon: { ...REF.jalon, titre: 'Autre titre' } }, { jalon: { ...REF.jalon, comportement: 'Autre.' } },
    { tentative: 3 }, { criteres: ['Un seul.'] }, { tests: ['Un autre test.'] }, { autorises: ['app/atelier/'] }, { interdits: [] },
    { frontieres: ['Aucun réseau.'] }, { decisions: [{ id: 'D-007', texte: 'Autre texte.' }] },
  ];
  const vus = new Set([ref]);
  for (const v of variantes) {
    const t = construireMission(avec(v));
    assert.equal(vus.has(t), false, JSON.stringify(v));
    vus.add(t);
  }
});
test('champs obligatoires manquants refusés un par un ; facultatifs absents = listes vides', () => {
  for (const k of ['chantier', 'objectif', 'base', 'jalon', 'tentative', 'criteres', 'tests', 'autorises']) {
    const d = structuredClone(REF); delete d[k];
    refusMission(d, new RegExp(`clé absente ${k}`));
  }
  for (const [k, sous] of [['base', 'sha'], ['base', 'version'], ['jalon', 'id'], ['jalon', 'titre'], ['jalon', 'comportement']]) {
    const d = structuredClone(REF); delete d[k][sous];
    refusMission(d, new RegExp(`${k} : clé absente ${sous}`));
  }
  const sans = structuredClone(REF); delete sans.interdits; delete sans.frontieres; delete sans.decisions;
  const t = construireMission(sans);
  assert.equal(t, construireMission({ ...sans, interdits: [], frontieres: [], decisions: [] }));
  assert.match(t, /\ninterdits pour ce jalon \(en plus des zones permanentes\) :\n\(aucun\)\n\n== FRONTIÈRES DU JALON ==\n\(aucune frontière propre au jalon\)\n\n== DÉCISIONS ACTIVES À RESPECTER ==\n\(aucune\)\n/);
  for (const k of ['interdits', 'frontieres', 'decisions']) refusMission(avec({ [k]: undefined }), new RegExp(`${k} : liste attendue`));
});
test('clés inconnues refusées (premier niveau et imbriquées) ; raison indépendante de l\'ordre', () => {
  refusMission(avec({ mode: 'x' }), /donnees : clé inconnue mode/);
  refusMission(avec({ jalon: { ...REF.jalon, note: 1 } }), /jalon : clé inconnue note/);
  refusMission(avec({ base: { ...REF.base, branche: 'x' } }), /base : clé inconnue branche/);
  refusMission(avec({ decisions: [{ id: 'D-007', texte: 'x', statut: 'ACTIVE' }] }), /clé inconnue statut/);
  const msg = (d) => { try { construireMission(d); } catch (e) { return e.message; } return null; };
  assert.equal(msg({ zeta: 1, ...structuredClone(REF), alpha: 2 }), msg({ alpha: 2, ...structuredClone(REF), zeta: 1 }));
  assert.match(msg({ zeta: 1, ...structuredClone(REF), alpha: 2 }), /clé inconnue alpha, zeta/);
});
test('types et formats invalides refusés', () => {
  for (const t of [0, -1, 1.5, '2', null, NaN]) refusMission(avec({ tentative: t }), /tentative/);
  for (const s of ['7a6b634', SHA.toUpperCase(), `${SHA}0`, 'g'.repeat(40), 7]) refusMission(avec({ base: { sha: s, version: '0.65.1' } }), /base\.sha/);
  for (const v of ['0.65', 'v0.65.1', '0.65.01', '0.65.1 ', 65]) refusMission(avec({ base: { sha: SHA, version: v } }), /base\.version/);
  for (const id of ['Atelier', 'a_b', 'a--b', '-a', 'a/b', '', 'a'.repeat(41), 3]) {
    refusMission(avec({ chantier: id }), /chantier/);
    refusMission(avec({ jalon: { ...REF.jalon, id } }), /jalon\.id/);
  }
  for (const k of ['criteres', 'tests', 'autorises']) refusMission(avec({ [k]: 'x' }), new RegExp(`${k} : liste attendue`));
  refusMission(avec({ jalon: [] }), /jalon : objet attendu/);
  refusMission(null, /donnees : objet attendu/);
  refusMission(avec({ decisions: [{ id: 'D-7', texte: 'x' }] }), /D-xxx/);
});
test('textes non canoniques refusés, jamais corrigés', () => {
  const nfd = 'De\u0301montrer.';
  const mauvais = ['', ' Démontrer.', 'Démontrer. ', 'a\r\nb', 'a\rb', 'a\tb', 'a\u0000b', 'a\u2028b', 'a\u2029b', '\ud800', nfd, 'a\n== FAUSSE SECTION ==', 'a\nFIN DE MISSION', '\na', 'a\n', 'a \nb', 'a\n b', 7];
  for (const v of mauvais) {
    refusMission(avec({ objectif: v }), /objectif/);
    refusMission(avec({ jalon: { ...REF.jalon, comportement: v } }), /jalon\.comportement/);
  }
  for (const v of ['a\nb', '== X ==', 'FIN DE MISSION', ' x', nfd]) {
    refusMission(avec({ jalon: { ...REF.jalon, titre: v } }), /jalon\.titre/);
    refusMission(avec({ criteres: [v] }), /criteres\[0\]/);
    refusMission(avec({ frontieres: [v] }), /frontieres\[0\]/);
  }
  refusMission(avec({ jalon: { ...REF.jalon, titre: 'x'.repeat(121) } }), /120/);
  refusMission(avec({ objectif: 'x'.repeat(2001) }), /2000/);
  refusMission(avec({ criteres: ['x'.repeat(301)] }), /300/);
  // la forme NFC du même texte est acceptée telle quelle
  assert.match(construireMission(avec({ objectif: nfd.normalize('NFC') })), /\nDémontrer\.\n/);
});
test('listes : ordre conservé pour critères, tests et frontières ; ensembles triés ; doublons et bornes refusés', () => {
  const t = construireMission(REF);
  assert.match(t, /1\. Le dossier est identique à données égales\.\n2\. Une donnée irrégulière est refusée\./);
  const inverse = construireMission(avec({ criteres: [...REF.criteres].reverse() }));
  assert.notEqual(inverse, t);
  assert.notEqual(construireMission(avec({ tests: [...REF.tests].reverse() })), t);
  assert.notEqual(construireMission(avec({ frontieres: [...REF.frontieres].reverse() })), t);
  // ensembles : l'ordre d'entrée ne change rien
  assert.equal(construireMission(avec({ autorises: [...REF.autorises].reverse(), interdits: [...REF.interdits].reverse(), decisions: [...REF.decisions].reverse() })), t);
  assert.match(t, /autorisés :\n- app\/atelier\/\n- tests\/atelier-mission\.test\.mjs\n/);
  assert.match(t, /\[D-001\]\n {2}Naissance n'est pas un wrapper de LLM\.\n\n\[D-007\]\n {2}Atelier : OUTILLAGE NON COGNITIF\.\n {2}Claude produit des candidats\.\n/);
  refusMission(avec({ criteres: ['a', 'a'] }), /criteres : doublon/);
  refusMission(avec({ tests: ['a', 'b', 'a'] }), /tests : doublon/);
  refusMission(avec({ autorises: ['app/', 'app/'] }), /autorises : doublon/);
  refusMission(avec({ decisions: [{ id: 'D-001', texte: 'a' }, { id: 'D-001', texte: 'b' }] }), /decisions : doublon « D-001 »/);
  refusMission(avec({ criteres: [] }), /criteres : 1 à 20/);
  refusMission(avec({ tests: Array.from({ length: 21 }, (_, i) => `t${i}`) }), /tests : 1 à 20/);
  refusMission(avec({ decisions: Array.from({ length: 11 }, (_, i) => ({ id: `D-0${10 + i}`, texte: 'x' })) }), /decisions : 0 à 10/);
});
test('périmètre : syntaxe du robot, zones permanentes, autorisé couvert par une interdiction refusé', () => {
  for (const p of ['../x', '/app/x', 'a\\b', 'a//b', 'a:b', './a', 'a/./b', 'a/../b', 'a b', 'é.js', '', 'x'.repeat(201)]) refusMission(avec({ autorises: [p] }), /autorises\[0\]/);
  for (const p of ['.github/', '.github/workflows/robot.yml', '.GitHub/x', 'signature/', 'android/x', 'node_modules/', '.git/', 'VERSION', 'ETAT.md', 'app/version.js', 'sw.js', 'app/sw.js', 'colis.zip', 'Colis.ZIP', 'signature']) {
    refusMission(avec({ autorises: [p], interdits: [] }), /zone permanente/);
  }
  refusMission(avec({ autorises: ['app/atelier/budget.js'], interdits: ['app/atelier/'] }), /couvert par l'interdiction « app\/atelier\/ »/);
  refusMission(avec({ autorises: ['app/'], interdits: ['app/'] }), /couvert par l'interdiction/);
  // une interdiction plus étroite à l'intérieur d'une autorisation large est acceptée (et gagnera au rapport)
  assert.match(construireMission(avec({ autorises: ['app/'], interdits: ['app/atelier/budget.js'] })), /- app\/\n/);
  refusMission(avec({ interdits: ['a//b'] }), /interdits\[0\]/);
});
test('taille : au plus 16 000 octets UTF-8 (et non caractères)', () => {
  // dossier rempli exactement à 16 000 octets : décisions ASCII de 1 500 caractères, puis l'objectif ajusté au caractère près
  const octets = (d) => Buffer.byteLength(construireMission(d), 'utf8');
  const essai = (d) => { try { return octets(d); } catch { return Infinity; } };
  const decisions = [];
  while (essai(avec({ objectif: 'x', decisions: [...decisions, { id: `D-${100 + decisions.length}`, texte: 'e'.repeat(1500) }] })) < 16000) decisions.push({ id: `D-${100 + decisions.length}`, texte: 'e'.repeat(1500) });
  const n = 16000 - octets(avec({ objectif: 'x', decisions })) + 1;
  assert.ok(n > 1 && n <= 2000, String(n));
  const juste = avec({ objectif: 'x'.repeat(n), decisions });
  assert.equal(octets(juste), 16000);
  assert.throws(() => construireMission(avec({ objectif: 'x'.repeat(n + 1), decisions })), (e) => e instanceof TypeError && /16001 octets UTF-8, plus de 16000/.test(e.message));
  // même nombre de caractères, mais « é » vaut 2 octets : refusé alors que le texte compte moins de 16 000 caractères
  const accents = avec({ objectif: 'é'.repeat(n), decisions });
  assert.throws(() => construireMission(accents), /octets UTF-8, plus de 16000/);
  assert.ok(construireMission(juste).length < 16000, 'le dossier accentué refusé a le même nombre de caractères, moins de 16 000');
});
test('contenu exigé présent : candidat isolé, main, aucune acquisition validée, ambiguïté, zones permanentes, gabarit pré-rempli', () => {
  const t = construireMission(REF);
  for (const m of [/CANDIDAT ISOLÉ/, /Tu ne touches jamais à main/, /tu ne décides jamais qu'une acquisition de Naissance est validée/, /Ambiguïté réelle : n'invente rien\. Rends le statut bloque avec UNE question précise\./, /\.git\/, \.github\/, signature\/, android\/, node_modules\/, VERSION, ETAT\.md, app\/version\.js, sw\.js, app\/sw\.js, tout \.zip à la racine/, /Une interdiction gagne toujours sur une autorisation plus large/, /MISE À JOUR DÉLIBÉRÉE vX/]) assert.match(t, m);
  const gabarit = JSON.parse(t.slice(t.indexOf('\n{\n') + 1, t.lastIndexOf('\n}\n') + 2));
  assert.deepEqual(gabarit, { protocole: 'atelier-rapport-1', chantier: 'atelier-demo', jalon: 'mission-1', tentative: 2, base: { sha: SHA, version: '0.65.1' }, statut: 'candidat | bloque | echec', candidat: { branche: BRANCHE, sha: '<sha du candidat>' }, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: { total: 0, reussis: 0, echecs: 0 }, divergences: [], question: null, motif: null });
});
test('aucun mode ni transport : un seul paramètre, aucun mot de mode, une donnée « mode » est refusée', () => {
  assert.equal(construireMission.length, 1);
  assert.equal(verifierRapport.length, 2);
  assert.doesNotMatch(SRC, /\bauto\b|\bmanuel\b|\boff\b/i);
  for (const k of ['mode', 'transport', 'quand', 'modele']) refusMission(avec({ [k]: 'x' }), /clé inconnue/);
});

// ------------------------------------------------------------------------------------------------ rapport
test('rapport « candidat » valide : conforme, gelé, statut annoncé seulement', () => {
  const r = verifierRapport(REF, rapport());
  assert.equal(r.structure, 'conforme');
  assert.equal(r.statutAnnonce, 'candidat');
  assert.deepEqual(Object.keys(r).sort(), ['rapport', 'statutAnnonce', 'structure']);
  assert.deepEqual(r.rapport, RAPPORT);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.rapport) && Object.isFrozen(r.rapport.fichiers.crees));
  // espaces JSON aux deux bouts et mise en forme libre admis
  assert.equal(verifierRapport(REF, `\n  ${JSON.stringify(RAPPORT, null, 4)}\n\n`).structure, 'conforme');
});
test('rapports « bloque » et « echec » valides : conformes', () => {
  assert.equal(verifierRapport(REF, rapport(BLOQUE)).statutAnnonce, 'bloque');
  assert.equal(verifierRapport(REF, rapport(ECHEC)).statutAnnonce, 'echec');
  assert.equal(verifierRapport(REF, rapport({ ...ECHEC, tests: null, fichiers: { crees: [], modifies: [], supprimes: [] } })).structure, 'conforme');
  assert.equal(verifierRapport(REF, rapport({ divergences: ['Un test de plus que prévu.'] })).structure, 'conforme');
});
test('mauvaise identité refusée : chantier, jalon, tentative', () => {
  nonConforme(rapport({ chantier: 'atelier-autre' }), /chantier : « atelier-demo » attendu/);
  nonConforme(rapport({ jalon: 'mission-2' }), /jalon : « mission-1 » attendu/);
  for (const t of [1, 3, '2', 2.0000001, null]) nonConforme(rapport({ tentative: t }), /tentative : 2 attendu/);
  nonConforme(rapport({ protocole: 'atelier-rapport-2' }), /protocole/);
});
test('mauvaise base refusée : sha et version', () => {
  nonConforme(rapport({ base: { sha: 'c'.repeat(40), version: '0.65.1' } }), /base\.sha/);
  nonConforme(rapport({ base: { sha: SHA.slice(0, 7), version: '0.65.1' } }), /base\.sha/);
  nonConforme(rapport({ base: { sha: SHA, version: '0.65.2' } }), /base\.version/);
  nonConforme(rapport({ base: { sha: SHA } }), /base : clé absente version/);
  nonConforme(rapport({ base: SHA }), /base : objet attendu/);
});
test('statut inconnu refusé', () => {
  for (const s of ['accepte', 'valide', 'acquisition', 'Candidat', 'CANDIDAT', '', null, 1, ['candidat']]) nonConforme(rapport({ statut: s }), /statut inconnu/);
});
test('clé inconnue ou absente refusée (aucune clé d\'acceptation possible)', () => {
  for (const k of ['accepte', 'acquisition', 'valide', 'cout', 'frontieres']) nonConforme(rapport({ [k]: true }), new RegExp(`rapport : clé inconnue ${k}`));
  for (const k of Object.keys(RAPPORT)) {
    const r = structuredClone(RAPPORT); delete r[k];
    nonConforme(JSON.stringify(r), new RegExp(`rapport : clé absente ${k}`));
  }
  nonConforme(rapport({ candidat: { branche: BRANCHE, sha: 'b'.repeat(40), accepte: true } }), /candidat : clé inconnue accepte/);
  nonConforme(rapport({ tests: { total: 1, reussis: 1, echecs: 0, ignores: 0 } }), /tests : clé inconnue ignores/);
});
test('clé JSON en double refusée, même à valeur identique, à la racine et imbriquée', () => {
  const t = rapport();
  nonConforme(t.replace('"statut":"candidat"', '"statut":"echec","statut":"candidat"'), /clé en double « statut »/);
  nonConforme(t.replace('"statut":"candidat"', '"statut":"candidat","statut":"candidat"'), /clé en double « statut »/);
  nonConforme(t.replace('"echecs":0', '"echecs":3,"echecs":0'), /clé en double « echecs »/);
  nonConforme(t.replace('"version":"0.65.1"', '"version":"0.65.1","\\u0076ersion":"0.65.1"'), /clé en double « version »/);
  // une chaîne qui contient des guillemets, des accolades ou une virgule n'est pas une clé
  assert.equal(verifierRapport(REF, rapport({ divergences: ['texte "statut": {a, b} [c]', 'x\\y'] })).structure, 'conforme');
  // le même nom dans deux objets différents n'est pas un doublon
  assert.equal(verifierRapport(REF, rapport()).structure, 'conforme');
});
test('texte illisible, vide, trop grand ou racine non objet refusé', () => {
  nonConforme('', /vide/);
  nonConforme('  \n ', /vide/);
  nonConforme(null, /vide ou absent/);
  nonConforme('{"protocole": ', /JSON illisible/);
  nonConforme('```json\n{}\n```', /JSON illisible/);
  nonConforme('[]', /racine/);
  nonConforme('"candidat"', /racine/);
  nonConforme(rapport({ divergences: Array.from({ length: 9 }, () => 'é'.repeat(1000)) }), /16000 octets/);
});
test('exigences de chaque statut', () => {
  nonConforme(rapport({ fichiers: { crees: [], modifies: [], supprimes: [] } }), /au moins un fichier/);
  nonConforme(rapport({ tests: { total: 10, reussis: 9, echecs: 1 } }), /echecs = 0/);
  nonConforme(rapport({ tests: { total: 10, reussis: 9, echecs: 0 } }), /reussis = total/);
  nonConforme(rapport({ tests: { total: 0, reussis: 0, echecs: 0 } }), /total >= 1/);
  nonConforme(rapport({ tests: null }), /statut candidat : tests/);
  nonConforme(rapport({ candidat: null }), /statut candidat : « candidat »/);
  nonConforme(rapport({ candidat: { branche: 'atelier/atelier-demo/mission-1/1', sha: 'b'.repeat(40) } }), /candidat\.branche : « atelier\/atelier-demo\/mission-1\/2 » attendue/);
  nonConforme(rapport({ candidat: { branche: 'main', sha: 'b'.repeat(40) } }), /candidat\.branche/);
  nonConforme(rapport({ candidat: { branche: BRANCHE, sha: 'B'.repeat(40) } }), /candidat\.sha/);
  nonConforme(rapport({ question: 'Pourquoi ?' }), /question et motif doivent valoir null/);
  nonConforme(rapport({ ...BLOQUE, question: null }), /statut bloque : question attendu/);
  nonConforme(rapport({ ...BLOQUE, question: '   ' }), /question : null ou texte non vide/);
  nonConforme(rapport({ ...BLOQUE, candidat: RAPPORT.candidat }), /statut bloque : candidat doit valoir null/);
  nonConforme(rapport({ ...BLOQUE, motif: 'x' }), /statut bloque : motif doit valoir null/);
  nonConforme(rapport({ ...ECHEC, motif: null }), /statut echec : motif attendu/);
  nonConforme(rapport({ ...ECHEC, question: 'x' }), /statut echec : question doit valoir null/);
});
test('fichiers : syntaxe, dossier, doublons, zones permanentes, interdit prioritaire, hors périmètre', () => {
  const f = (crees, modifies = [], supprimes = []) => rapport({ fichiers: { crees, modifies, supprimes } });
  nonConforme(f(['app/atelier/x.js', 'app/atelier/x.js']), /doublon « app\/atelier\/x\.js »/);
  nonConforme(f(['app/atelier/x.js'], [], ['app/atelier/x.js']), /doublon/);
  nonConforme(f(['app/atelier/']), /est un dossier/);
  for (const p of ['../x.js', '/app/atelier/x.js', 'app\\atelier\\x.js', 'app//atelier/x.js', 'app/atelier/x y.js', 7]) nonConforme(f([p]), /fichiers\.crees/);
  // interdiction explicite plus étroite : gagne sur l'autorisation app/atelier/
  nonConforme(f(['app/atelier/budget.js']), /« app\/atelier\/budget\.js » est interdit pour ce jalon/);
  nonConforme(f([], ['app/atelier/chantier.js']), /interdit pour ce jalon/);
  const large = avec({ autorises: ['app/', 'tests/'], interdits: ['app/atelier/budget.js'] });
  for (const p of ['app/version.js', 'app/sw.js']) nonConforme(f([p]), /zone permanente/, large);
  nonConforme(f(['app/atelier/budget.js']), /interdit pour ce jalon/, large);
  nonConforme(f(['.github/workflows/robot.yml']), /zone permanente/);
  nonConforme(f(['VERSION']), /zone permanente/);
  nonConforme(f(['app/main.js']), /hors du périmètre autorisé/);
  nonConforme(f(['tests/autre.test.mjs']), /hors du périmètre autorisé/);
  nonConforme(f(['app/atelierx.js']), /hors du périmètre autorisé/);
  nonConforme(rapport({ fichiers: { crees: 'x', modifies: [], supprimes: [] } }), /fichiers\.crees : liste attendue/);
  nonConforme(rapport({ fichiers: { crees: [], modifies: [] } }), /fichiers : clé absente supprimes/);
  assert.equal(verifierRapport(large, f(['app/main.js', 'tests/x.test.mjs'])).structure, 'conforme');
});
test('nombres de tests invalides refusés', () => {
  for (const v of [-1, 1.5, '3', null, 2 ** 53]) nonConforme(rapport({ tests: { total: v, reussis: 1, echecs: 0 } }), /tests\.total/);
  nonConforme(rapport({ ...ECHEC, tests: { total: 3, reussis: 2, echecs: 2 } }), /reussis \+ echecs > total/);
  nonConforme(rapport({ divergences: [''] }), /divergences/);
  nonConforme(rapport({ divergences: [3] }), /divergences/);
  nonConforme(rapport({ divergences: 'aucune' }), /divergences/);
});
test('aucune sortie d\'acceptation : seulement « conforme » ou « non-conforme »', () => {
  const sorties = [rapport(), rapport(BLOQUE), rapport(ECHEC), rapport({ statut: 'accepte' }), rapport({ accepte: true }), '{}', 'x'].map((t) => verifierRapport(REF, t));
  for (const s of sorties) {
    assert.ok(['conforme', 'non-conforme'].includes(s.structure));
    assert.ok(s.statutAnnonce === undefined || ['candidat', 'bloque', 'echec'].includes(s.statutAnnonce));
    assert.equal(Object.hasOwn(s, 'accepte') || Object.hasOwn(s, 'valide') || Object.hasOwn(s, 'acquisition'), false);
  }
  assert.doesNotMatch(CODE, /['"`](accepte|acceptee|valide|validee|acquisition|pret)['"`]/);
});
test('déterminisme : même entrée → même réponse et même raison ; données de mission invalides → TypeError', () => {
  for (const t of [rapport(), rapport({ statut: 'x' }), rapport({ fichiers: { crees: ['app/main.js'], modifies: [], supprimes: [] } })]) {
    assert.deepEqual(verifierRapport(REF, t), verifierRapport(structuredClone(REF), t));
  }
  assert.deepEqual(verifierRapport(REF, rapport({ zz: 1, aa: 2 })).raison, 'rapport : clé inconnue aa, zz');
  assert.throws(() => verifierRapport(avec({ tentative: 0 }), rapport()), TypeError);
  assert.throws(() => verifierRapport(null, rapport()), TypeError);
});
test('le gabarit du dossier, rempli, est conforme : dossier et vérificateur s\'accordent', () => {
  const t = construireMission(REF);
  const g = JSON.parse(t.slice(t.indexOf('\n{\n') + 1, t.lastIndexOf('\n}\n') + 2));
  assert.equal(verifierRapport(REF, JSON.stringify(g)).structure, 'non-conforme');
  g.statut = 'candidat'; g.candidat.sha = 'd'.repeat(40); g.fichiers.crees.push('app/atelier/nouveau.js'); g.tests = { total: 1, reussis: 1, echecs: 0 };
  assert.equal(verifierRapport(REF, JSON.stringify(g)).structure, 'conforme');
});

// ------------------------------------------------------------------------------------------------ gardes statiques
test('pureté : aucun import, aucune horloge, aucun hasard, aucune persistance, aucun réseau, aucun DOM', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['construireMission', 'verifierRapport']);
  assert.doesNotMatch(CODE, /\bimport\b|\brequire\(/);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /magasin/, /lireTout/, /ecrire/, /enregistrer/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/, /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./, /TextEncoder/, /\bcrypto\b/]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  assert.ok(SRC.split('\n').length < 350);
});
test('aucun couplage entre modules de l\'atelier, dans les deux sens', () => {
  assert.equal(/chantier\.js|budget\.js/.test(SRC), false);
  for (const m of ['chantier.js', 'budget.js']) assert.equal(readFileSync(join(ATELIER, m), 'utf8').includes('mission.js'), false, m);
});
test('dormance : hors app/atelier/, seul main.js atteint l\'atelier, par l\'import dynamique de ecran.js', () => { // MISE À JOUR DÉLIBÉRÉE v0.65.3 (titre)
  // MISE À JOUR DÉLIBÉRÉE v0.65.3 (AT-4 branche l'écran de l'atelier) : la dormance totale est REMPLACÉE, non supprimée, par une preuve
  // plus étroite : hors de app/atelier/, seul app/main.js mentionne l'atelier, et seulement par l'import dynamique unique
  // « import('./atelier/ecran.js') » (aucun import statique) ; index.html ne contient que la section #atelier vide et l'entrée des Réglages ;
  // sw.js ignore toujours l'atelier.
  const dehors = fichiersJs(join(RACINE, 'app')).filter((f) => !f.startsWith(join(RACINE, 'app', 'atelier') + sep) && /chantier\.js|budget\.js|\bmission\.js|montants\.js|atelier\//.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f));
  assert.deepEqual(dehors, [join('app', 'main.js')]);
  const codeMain = readFileSync(join(RACINE, 'app', 'main.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  assert.deepEqual(codeMain.match(/[^\s(]*atelier\/[^\s)]*/g), ["'./atelier/ecran.js'"]);
  assert.equal(codeMain.split("import('./atelier/ecran.js')").length, 2);
  assert.doesNotMatch(codeMain, /^\s*import\b[^;(]*atelier/m);
  assert.equal(readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8').includes('atelier'), false);
  const SECTION = '<section id="atelier" class="panneau" hidden aria-label="Atelier de développement">\n    <header class="entete">\n      <button type="button" class="bouton-secondaire" data-fermer-panneau>← Retour</button>\n      <h2>Atelier</h2>\n    </header>\n    <div class="contenu-reglages" data-atelier-contenu></div>\n  </section>';
  const ENTREE = '<button type="button" class="bouton-secondaire" data-ouvrir-atelier>Atelier de développement →</button>';
  const html = readFileSync(join(RACINE, 'app', 'index.html'), 'utf8');
  assert.equal(html.split(SECTION).length, 2);
  assert.equal(html.split(ENTREE).length, 2);
  assert.doesNotMatch(html.replace(SECTION, '').replace(ENTREE, ''), /atelier/i);
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables', () => {
  assert.equal(VERSION_BASE, 30); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 20); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
});
