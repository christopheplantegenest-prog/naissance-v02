// v0.64.12 — J1a « ENSEIGNEMENT NATUREL CONFIRMÉ » (décision ChatGPT « MISSION DE DÉVELOPPEMENT v0.64.12 — J1 », 14/10/2026).
// reconnaitreAffirmationPossessive (langage/interpretation.js) : une affirmation possessive ordinaire « Mon chien s'appelle Rex. » devient une
// PROPOSITION de leçon « Fait : moi / chien / Rex. » ; tout ce qui n'est pas suffisamment déterminé est refusé (motif), sans rien écrire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconnaitreAffirmationPossessive, interpreterEnseignement } from '../app/langage/interpretation.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';
import { extraireLecon, apercuLecon } from '../app/langage/lecon.js';
import { chargerEsprit, apprendreMot } from '../app/langage/esprit.js';
import { magasinMemoireVive, TABLES } from '../app/langage/connaissances.js';

const lexique = LEXIQUE_DEPART;
const reconnaitre = (t, lex = lexique) => reconnaitreAffirmationPossessive(t, { lexique: lex });

test('P1. « Mon chien s\'appelle Rex. » → proposition « Fait : moi / chien / Rex. », relation nouvelle, aperçu du canal existant', () => {
  const r = reconnaitre("Mon chien s'appelle Rex.");
  assert.equal(r.ok, true);
  assert.equal(r.phrase, 'Fait : moi / chien / Rex.');
  assert.deepEqual(r.extrait, extraireLecon('Fait : moi / chien / Rex.'), 'extrait identique à la leçon tapée à la main (aller-retour)');
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'chien');
  assert.equal(r.valeur, 'Rex');
  assert.equal(r.relationNouvelle, true);
  assert.equal(apercuLecon(r.extrait), "J'ai compris : moi → chien → Rex. C'est correct ?");
});

test('P2. formes admises : apostrophe typographique, sans point final, s\'appellent avec « mes », relation connue, valeur littérale de plusieurs mots', () => {
  assert.equal(reconnaitre('Mon chien s’appelle Rex').phrase, 'Fait : moi / chien / Rex.');
  assert.equal(reconnaitre("Ma chienne s'appelle Lili.").phrase, 'Fait : moi / chienne / Lili.');
  const enfants = reconnaitre("Mes enfants s'appellent Simon et Léa.");
  assert.equal(enfants.ok, true);
  assert.equal(enfants.relation, 'enfants');
  assert.equal(enfants.valeur, 'Simon et Léa', 'une seule valeur littérale, sans sémantique de liste');
  assert.equal(enfants.relationNouvelle, false, '« enfants » est une relation du lexique de départ');
  assert.equal(reconnaitre("Mon chien s'appelle Rex Junior.").valeur, 'Rex Junior');
  assert.equal(reconnaitre("Mon chèvre s'appelle Blanchette.").relation, 'chèvre', 'la relation garde sa graphie (minuscules)');
  assert.equal(reconnaitre("MON CHIEN S'APPELLE REX").valeur, 'REX', 'la valeur est le texte ORIGINAL');
});

test('P3. une relation apprise par un mot (apprendreMot) donne sa relation, pas le mot', async () => {
  const e = await chargerEsprit(magasinMemoireVive());
  await apprendreMot(e, { motNouveau: 'gamin', motConnu: 'fils' });
  const r = reconnaitre("Mon gamin s'appelle Atem.", e.lexique);
  assert.equal(r.relation, 'fils');
  assert.equal(r.relationNouvelle, false);
});

const REFUS = [
  ["Mon chien s'appelle comment ?", 'question'],
  ["Mon chien s'appelle Rex ?", 'question'],
  ["Comment s'appelle mon chien ?", 'question'],
  ["Mon chien ne s'appelle pas Rex.", 'hors cadre'],
  ["Mon chien s'appelle pas Rex.", 'negation'],
  ["Mon chien s'appelle plus Rex.", 'negation'],
  ["Mon chien s'appelle jamais Rex.", 'negation'],
  ["Mon chien s'appelle ni Rex ni Milo.", 'negation'],
  ["Mon chien s'appelle Rex ou Milo.", 'mot grammatical dans la valeur'],
  ["Mon chien s'appelle peut-être Rex.", 'mot grammatical dans la valeur'],
  ["Mon chien s'appelle Rex. Il est gentil.", 'mot grammatical dans la valeur'],
  ["Paul dit : mon chien s'appelle Rex.", 'hors cadre'],
  ['Il a écrit "mon chien s\'appelle Rex".', 'hors cadre'],
  ["« Mon chien s'appelle Rex »", 'hors cadre'],
  ["Mon chien s'appelle…", 'inacheve'],
  ["Mon chien s'appelle...", 'inacheve'],
  ["Mon chien s'appelle", 'hors cadre'],
  ["Mon chien s'appelle « Rex ».", 'valeur'],
  ["Mon chien s'appelle Rex/Milo.", 'valeur'],
  ["Mon petit chien s'appelle Rex.", 'hors cadre'],
  ["Mon chien, Rex, s'appelle Rex.", 'hors cadre'],
  ["Ton chien s'appelle Rex.", 'hors cadre'],
  ["Mes chats s'appelle Tom.", 'accord'],
  ["Mon chien s'appellent Rex.", 'accord'],
  ["Mon est s'appelle Rex.", 'mot grammatical'],
  ['Bonjour', 'hors cadre'],
  ['', 'hors cadre'],
];
test('P4. refus : questions, négations, citations, discours rapporté, inachevé, alternatives, formes incomplètes ou incohérentes (motif exact)', () => {
  for (const [phrase, motif] of REFUS) {
    const r = reconnaitre(phrase);
    assert.deepEqual(r, { ok: false, motif }, phrase);
  }
});

test('P5. PÉRIMÈTRE RESTREINT documenté : les formes « est » / « sont » sont REPORTÉES (relation-valeur indiscernable d\'une propriété)', () => {
  for (const phrase of ['Ma ville est Cognac.', 'Mon chien est Rex.', 'Mon chien est gentil.', 'Mes enfants sont Simon et Léa.']) {
    assert.deepEqual(reconnaitre(phrase), { ok: false, motif: 'hors cadre' }, phrase);
  }
  // le chemin explicite v0.16 reste disponible, inchangé
  const v016 = interpreterEnseignement('Apprends que ma ville est Cognac.', { lexique });
  assert.equal(v016.ok, true);
  assert.equal(v016.phrase, 'Fait : moi / ville / Cognac.');
});

test('P6. « Apprends que … » (v0.16) est inchangé : il refuse toujours « s\'appelle » et les mots inconnus, avec son message', () => {
  assert.equal(interpreterEnseignement("Apprends que mon chien s'appelle Rex.", { lexique }).ok, false);
  assert.equal(interpreterEnseignement('Apprends que mon chien est Rex.', { lexique }).ok, false);
  assert.equal(interpreterEnseignement('Apprends que ma couleur est rouge.', { lexique }).phrase, 'Fait : moi / couleur / rouge.');
  assert.deepEqual(reconnaitre('Apprends que ma couleur est rouge.'), { ok: false, motif: 'hors cadre' });
});

test('P7. PURETÉ : aucune écriture (magasin témoin intact), entrées jamais modifiées, résultat déterministe', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const avantLexique = JSON.stringify(e.lexique);
  const a = reconnaitre("Mon chien s'appelle Rex.", e.lexique);
  const b = reconnaitre("Mon chien s'appelle Rex.", e.lexique);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(e.lexique), avantLexique);
  for (const t of TABLES) assert.equal((await magasin.lireTout(t)).length, 0, t);
  assert.deepEqual(reconnaitreAffirmationPossessive(null), { ok: false, motif: 'hors cadre' }, 'entrée absente : refus, jamais une exception');
});

test('P8. garde de source : interpretation.js n\'importe ni mémoire, ni esprit, ni modèle ; aucune écriture possible depuis ce module', () => {
  const src = readFileSync(new URL('../app/langage/interpretation.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./bagage.js', './comprendre.js', './lecon.js']);
  assert.doesNotMatch(src, /apprendreFait\(|ecrireConnaissance\(|\.ecrire\(/);
});
