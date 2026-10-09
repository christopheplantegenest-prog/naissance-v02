// === DEBUT_TEST_VALEURS_DONNEES ===
// v0.63.27 — « PERSISTER LA VALEUR DES DONNÉES ÉPHÉMÈRES — MESSAGE UNIQUEMENT — AUCUN RASSEMBLEMENT — AUCUN CHOIX » (décision ChatGPT, 05/10/2026).
// La valeur brute du message vécu est conservée sous l'identité EXACTE de la donnée-message (table 'valeursDonnees', ligne { id, valeur }).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import {
  magasinMemoireVive, enregistrerValeurDonnee, enregistrerObservationPossibilites, ouvrirIndexedDB, nouvelId,
  TABLES, CLE, VERSION_BASE, NOM_BASE,
} from '../app/langage/connaissances.js';
import { traiterTourAvecEnonce, conserverValeurMessage, identifierMessage } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { ACCES_VALEUR_DONNEE } from '../app/langage/valeur-donnee.js';
import * as moduleAcces from '../app/langage/valeur-donnee.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { donneeDeSource } from '../app/langage/donnee-de-source.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { resoudreValeursApplication } from '../app/langage/valeurs-application.js';
import { applicationUnique } from '../app/langage/application-unique.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import {
  SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees,
} from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const CONN = lu('app', 'langage', 'connaissances.js');
const PONT = lu('app', 'langage', 'pont.js');
const MAIN = lu('app', 'main.js');
const T = 'valeursDonnees';
const refuse = async (p) => assert.rejects(p, TypeError);
const gen = () => { let n = 0; return (prefixe) => `${prefixe}-${++n}`; };

// Magasin espion : trace chaque appel.
function espionMagasin(base = magasinMemoireVive()) {
  const appels = [];
  return {
    appels,
    async lireTout(t) { appels.push(['lireTout', t]); return base.lireTout(t); },
    async ecrire(t, o) { appels.push(['ecrire', t]); return base.ecrire(t, o); },
    async supprimer(t, c) { appels.push(['supprimer', t]); return base.supprimer(t, c); },
    async vider() { appels.push(['vider']); return base.vider(); },
    base,
  };
}
const ecritures = (m) => m.appels.filter((a) => a[0] === 'ecrire');

// ============================================================================ A. TABLE
test('A1. table valeursDonnees : déclarée en dernier, clé primaire « id » (= identité de la donnée), pas de seconde identité', () => {
  assert.equal(TABLES.includes(T), true);
  assert.equal(TABLES[TABLES.length - 5], T); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives en dernier // MISE À JOUR DÉLIBÉRÉE v0.63.72 : contextesProspectifs est déclarée après valeursDonnees (avant-dernière)
  assert.equal(CLE[T], 'id');
  assert.equal(new Set(TABLES).size, TABLES.length);
});
test('A2. VERSION_BASE 19, SCHEMA_SAUVEGARDE 9, 22 tables', () => {
  assert.equal(VERSION_BASE, 22); assert.equal(SCHEMA_SAUVEGARDE, 12); assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
});
test('A3. une ligne = exactement { id, valeur } : aucun horodatage, aucun idDonnee, aucune forme', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'bonjour' });
  assert.deepEqual(Object.keys(l), ['id', 'valeur']);
  assert.deepEqual(await m.lireTout(T), [{ id: 'message-1', valeur: 'bonjour' }]);
});

// ============================================================================ B. PRIMITIVE D'ÉCRITURE
test('B1. l\'identité de la ligne est EXACTEMENT celle fournie (aucun nouvelId, aucun préfixe ajouté)', async () => {
  const m = magasinMemoireVive();
  for (const id of ['message-1-abc', 'x', 'Ça va ?', ' espace ']) assert.equal((await enregistrerValeurDonnee(m, { id, valeur: 'v' })).id, id);
  assert.deepEqual((await m.lireTout(T)).map((l) => l.id).sort(), ['Ça va ?', ' espace ', 'message-1-abc', 'x'].sort());
});
test('B2. valeur brute exacte : chaîne vide, Unicode, retours ligne, espaces, texte ressemblant à un marqueur, texte très long', async () => {
  const m = magasinMemoireVive();
  const textes = ['', 'é à ç 🙂 日本語 \u0000 \u202e', 'a\nb\r\nc\t d', '   espaces   ', '__proto__', '{"id":"x"}', '<<<MARQUEUR>>>', 'constructor', 'x'.repeat(100000)];
  for (const [i, valeur] of textes.entries()) {
    const l = await enregistrerValeurDonnee(m, { id: `message-${i}`, valeur });
    assert.equal(l.valeur, valeur);
  }
  const relues = await m.lireTout(T);
  for (const [i, valeur] of textes.entries()) assert.equal(relues.find((l) => l.id === `message-${i}`).valeur, valeur);
});
test('B3. même texte sous deux identités = deux faits distincts (aucune déduplication par valeur)', async () => {
  const m = magasinMemoireVive();
  await enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'bonjour' });
  await enregistrerValeurDonnee(m, { id: 'message-2', valeur: 'bonjour' });
  assert.deepEqual((await m.lireTout(T)).map((l) => l.id).sort(), ['message-1', 'message-2']);
});
test('B4. même id + même valeur : fait déjà vrai, AUCUNE seconde écriture, la ligne existante est rendue', async () => {
  const m = espionMagasin();
  const a = await enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'bonjour' });
  const b = await enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'bonjour' });
  assert.equal(ecritures(m).length, 1);
  assert.equal(b, a);
  assert.equal((await m.base.lireTout(T)).length, 1);
});
test('B5. même id + valeur différente : TypeError, rien d\'écrit, la valeur d\'origine est conservée (jamais de remplacement silencieux)', async () => {
  const m = espionMagasin();
  await enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'bonjour' });
  const avant = ecritures(m).length;
  await refuse(enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'salut' }));
  await refuse(enregistrerValeurDonnee(m, { id: 'message-1', valeur: '' }));
  await refuse(enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'Bonjour' }));
  assert.equal(ecritures(m).length, avant);
  assert.deepEqual(await m.base.lireTout(T), [{ id: 'message-1', valeur: 'bonjour' }]);
});
test('B6. la table n\'est pas un journal : N demandes pour la même identité laissent une seule ligne', async () => {
  const m = magasinMemoireVive();
  for (let i = 0; i < 20; i += 1) await enregistrerValeurDonnee(m, { id: 'message-1', valeur: 'v' });
  assert.equal((await m.lireTout(T)).length, 1);
});
test('B7. entrée invalide : TypeError, AUCUNE écriture (objet, clés closes, chaîne non vide, valeur chaîne)', async () => {
  const m = espionMagasin();
  const mauvaises = [
    undefined, null, 'x', 42, [], [['id', 'valeur']],
    {}, { id: 'a' }, { valeur: 'v' },
    { id: '', valeur: 'v' }, { id: 1, valeur: 'v' }, { id: null, valeur: 'v' },
    { id: 'a', valeur: 1 }, { id: 'a', valeur: null }, { id: 'a', valeur: undefined }, { id: 'a', valeur: ['v'] }, { id: 'a', valeur: { texte: 'v' } }, { id: 'a', valeur: true },
    { id: 'a', valeur: 'v', extra: 1 }, { id: 'a', valeur: 'v', horodatage: 'x' },
    { id: 'a', valeur: 'v', [Symbol('s')]: 1 },
  ];
  for (const e of mauvaises) await refuse(enregistrerValeurDonnee(m, e));
  assert.equal(ecritures(m).length, 0);
});
test('B8. propriétés PROPRES de donnée : accesseur jamais exécuté, héritage refusé', async () => {
  const m = espionMagasin();
  let lectures = 0;
  const piege = { valeur: 'v' }; Object.defineProperty(piege, 'id', { enumerable: true, get() { lectures += 1; return 'a'; } });
  await refuse(enregistrerValeurDonnee(m, piege));
  const piege2 = { id: 'a' }; Object.defineProperty(piege2, 'valeur', { enumerable: true, get() { lectures += 1; return 'v'; } });
  await refuse(enregistrerValeurDonnee(m, piege2));
  await refuse(enregistrerValeurDonnee(m, Object.create({ id: 'a', valeur: 'v' })));
  await refuse(enregistrerValeurDonnee(m, Object.assign(Object.create({ valeur: 'v' }), { id: 'a' })));
  assert.equal(lectures, 0);
  assert.equal(ecritures(m).length, 0);
});
test('B9. la ligne écrite est un objet NEUF : modifier l\'entrée ensuite ne change pas la ligne', async () => {
  const m = magasinMemoireVive();
  const entree = { id: 'a', valeur: 'v' };
  const l = await enregistrerValeurDonnee(m, entree);
  assert.notEqual(l, entree);
  entree.valeur = 'autre';
  assert.deepEqual(await m.lireTout(T), [{ id: 'a', valeur: 'v' }]);
});
test('B10. lecture de la table en échec / non tableau : l\'erreur est rendue, rien n\'est écrit', async () => {
  const base = magasinMemoireVive();
  const ecrits = [];
  const casse = { async lireTout() { throw new Error('lecture HS'); }, async ecrire(t, o) { ecrits.push([t, o]); } };
  await assert.rejects(enregistrerValeurDonnee(casse, { id: 'a', valeur: 'v' }), /lecture HS/);
  const nonTableau = { async lireTout() { return null; }, async ecrire(t, o) { ecrits.push([t, o]); } };
  await refuse(enregistrerValeurDonnee(nonTableau, { id: 'a', valeur: 'v' }));
  assert.deepEqual(ecrits, []);
  assert.deepEqual(await base.lireTout(T), []);
});
test('B11. écriture en échec : l\'erreur est rendue (jamais avalée) ; aucune ligne n\'est prétendue écrite', async () => {
  const m = { async lireTout() { return []; }, async ecrire() { throw new Error('écriture HS'); } };
  await assert.rejects(enregistrerValeurDonnee(m, { id: 'a', valeur: 'v' }), /écriture HS/);
});
test('B12. ne lit et n\'écrit QUE la table valeursDonnees : une lecture, au plus une écriture, aucune suppression', async () => {
  const m = espionMagasin();
  await enregistrerValeurDonnee(m, { id: 'a', valeur: 'v' });
  assert.deepEqual(m.appels, [['lireTout', T], ['ecrire', T]]);
  const m2 = espionMagasin();
  await m2.base.ecrire('journal', { id: 'j', texte: 'bonjour' });
  await m2.base.ecrire('observationsLangage', { id: 'o', texte: 'bonjour' });
  await enregistrerValeurDonnee(m2, { id: 'a', valeur: 'v' });
  assert.deepEqual(m2.appels, [['lireTout', T], ['ecrire', T]]);
});
test('B13. une ancienne ligne exotique dans la table (sans valeur, primitive, accesseur) ne fait pas planter ni ne se laisse « corriger »', async () => {
  const m = espionMagasin();
  await m.base.ecrire(T, { id: 'a' });
  await refuse(enregistrerValeurDonnee(m, { id: 'a', valeur: 'v' }));
  assert.deepEqual(await m.base.lireTout(T), [{ id: 'a' }]);
  const exotique = { async lireTout() { return [null, 'x', 4, { id: 'z', valeur: 'q' }]; }, async ecrire(t, o) { this.o = o; } };
  const r = await enregistrerValeurDonnee(exotique, { id: 'a', valeur: 'v' });
  assert.deepEqual(r, { id: 'a', valeur: 'v' });
});

// ============================================================================ C. LE MESSAGE : conserverValeurMessage
test('C1. conserverValeurMessage lit EXACTEMENT id et texte (descripteurs propres) et appelle enregistrerValeur({ id, valeur })', async () => {
  const lectures = [];
  const cible = Object.freeze({ id: 'message-9', texte: 'bonjour Pixel', autre: 'jamais lu', profond: { a: 1 } });
  const message = new Proxy(cible, {
    getOwnPropertyDescriptor(c, k) { lectures.push(['desc', String(k)]); return Reflect.getOwnPropertyDescriptor(c, k); },
    get(c, k) { lectures.push(['get', String(k)]); return Reflect.get(c, k); },
    ownKeys(c) { lectures.push(['ownKeys']); return Reflect.ownKeys(c); },
    has(c, k) { lectures.push(['has', String(k)]); return Reflect.has(c, k); },
  });
  const recus = [];
  await conserverValeurMessage(message, { enregistrerValeur: async (e) => { recus.push(e); } });
  assert.deepEqual(recus, [{ id: 'message-9', valeur: 'bonjour Pixel' }]);
  assert.deepEqual(Object.keys(recus[0]), ['id', 'valeur']);
  assert.deepEqual(lectures.sort(), [['desc', 'id'], ['desc', 'texte']].sort());
});
test('C2. message invalide : TypeError, enregistrerValeur n\'est PAS appelée (accesseur non exécuté, héritage refusé, non-objet)', async () => {
  let appels = 0; let lectures = 0;
  const enregistrerValeur = async () => { appels += 1; };
  const a1 = { texte: 't' }; Object.defineProperty(a1, 'id', { enumerable: true, get() { lectures += 1; return 'i'; } });
  const a2 = { id: 'i' }; Object.defineProperty(a2, 'texte', { enumerable: true, get() { lectures += 1; return 't'; } });
  for (const m of [null, undefined, 'x', 3, [], { id: 'i' }, { texte: 't' }, a1, a2, Object.create({ id: 'i', texte: 't' })]) await refuse(conserverValeurMessage(m, { enregistrerValeur }));
  await refuse(conserverValeurMessage({ id: 'i', texte: 't' }, {}));
  await refuse(conserverValeurMessage({ id: 'i', texte: 't' }));
  assert.equal(appels, 0); assert.equal(lectures, 0);
});
test('C3. la valeur transmise est le texte TEL QUEL (même référence de chaîne, aucune normalisation), y compris vide', async () => {
  const recus = [];
  for (const texte of ['', '  ', 'a\nb', 'Ça']) await conserverValeurMessage({ id: 'i', texte }, { enregistrerValeur: async (e) => { recus.push(e.valeur); } });
  assert.deepEqual(recus, ['', '  ', 'a\nb', 'Ça']);
});
test('C4. l\'erreur de enregistrerValeur remonte à l\'appelant de conserverValeurMessage (jamais avalée ici)', async () => {
  await assert.rejects(conserverValeurMessage({ id: 'i', texte: 't' }, { enregistrerValeur: async () => { throw new Error('boom'); } }), /boom/);
});

// ============================================================================ D. ORDRE DU TOUR
function tourSpy({ valeur, observer, avecValeur = true, avecIdentite = true, traiterRetour = { reponse: 'ok' } } = {}) {
  const journal = [];
  const options = {
    enregistrerEnonce: async () => { journal.push('enonce'); },
    traiter: async (message) => { journal.push(['traiter', message]); return traiterRetour; },
    nouvelId: avecIdentite ? (p) => { journal.push('identifier'); return `${p}-1`; } : undefined,
    observerPossibilites: observer ? async (message) => { journal.push(['observer', message]); return observer(message); } : undefined,
    enregistrerValeur: avecValeur ? async (e) => { journal.push(['valeur', e]); if (valeur) return valeur(e); return e; } : undefined,
  };
  return { journal, options };
}
test('D1. ORDRE : identifier → valeur → observer → capture d\'énoncé → traitement ; mêmes identité et texte partout', async () => {
  const { journal, options } = tourSpy({ observer: () => {} });
  const res = await traiterTourAvecEnonce('bonjour Pixel', { idTrace: 't1' }, options);
  assert.deepEqual(res, { reponse: 'ok' });
  const noms = journal.map((e) => (Array.isArray(e) ? e[0] : e));
  assert.deepEqual(noms, ['identifier', 'valeur', 'observer', 'enonce', 'traiter']);
  const [, v, o, , t] = journal;
  assert.deepEqual(v[1], { id: 'message-1', valeur: 'bonjour Pixel' });
  assert.equal(o[1].id, 'message-1'); assert.equal(t[1].id, 'message-1');
  assert.equal(o[1], t[1]);
  assert.equal(o[1].texte, 'bonjour Pixel');
});
test('D2. ÉCHEC de conservation (rejet) : AUCUNE observation, le tour continue, résultat inchangé, aucune erreur propagée', async () => {
  const { journal, options } = tourSpy({ valeur: () => { throw new Error('HS'); }, observer: () => {} });
  const res = await traiterTourAvecEnonce('bonjour', { idTrace: 't1' }, options);
  assert.deepEqual(res, { reponse: 'ok' });
  const noms = journal.map((e) => (Array.isArray(e) ? e[0] : e));
  assert.deepEqual(noms, ['identifier', 'valeur', 'enonce', 'traiter']);
});
test('D3. ÉCHEC de conservation par exception SYNCHRONE : même comportement (aucune observation, tour normal)', async () => {
  const journal = [];
  const res = await traiterTourAvecEnonce('bonjour', null, {
    enregistrerEnonce: async () => {}, traiter: async () => ({ r: 1 }), nouvelId: (p) => `${p}-1`,
    observerPossibilites: async () => { journal.push('observer'); },
    enregistrerValeur: () => { throw new Error('sync'); },
  });
  assert.deepEqual(res, { r: 1 }); assert.deepEqual(journal, []);
});
test('D4. ÉCHEC d\'observation APRÈS valeur écrite : la valeur reste (aucun rollback, aucune suppression), le tour continue', async () => {
  const magasin = espionMagasin();
  const res = await traiterTourAvecEnonce('bonjour', null, {
    enregistrerEnonce: async () => {}, traiter: async () => ({ r: 2 }), nouvelId: gen(),
    enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e),
    observerPossibilites: async () => { throw new Error('observation HS'); },
  });
  assert.deepEqual(res, { r: 2 });
  assert.equal((await magasin.base.lireTout(T)).length, 1);
  assert.equal(magasin.appels.some((a) => a[0] === 'supprimer' || a[0] === 'vider'), false);
});
test('D5. observation qui ÉCHOUE sans lever (statut d\'échec) : la valeur reste aussi', async () => {
  const magasin = magasinMemoireVive();
  const message = [];
  await traiterTourAvecEnonce('bonjour', null, {
    enregistrerEnonce: async () => {}, traiter: async (m) => { message.push(m); return 1; }, nouvelId: gen(),
    enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e),
    observerPossibilites: (m) => observerPossibilites(m, { enregistrer: async () => { throw new Error('x'); }, lireExecutions: async () => [] }),
  });
  assert.deepEqual(await magasin.lireTout(T), [{ id: message[0].id, valeur: 'bonjour' }]);
  assert.deepEqual(await magasin.lireTout('observationsPossibilites'), []);
});
test('D6. message NON identifié (pas de générateur) : rien n\'est conservé ; l\'observateur est appelé comme avant (sans message, rien d\'écrit)', async () => {
  const { journal, options } = tourSpy({ observer: () => {}, avecIdentite: false });
  await traiterTourAvecEnonce('bonjour', { idTrace: 't1' }, options);
  const noms = journal.map((e) => (Array.isArray(e) ? e[0] : e));
  assert.deepEqual(noms, ['observer', 'enonce', 'traiter']);
  assert.equal(journal[0][1], null);
});
test('D7. sans enregistrerValeur (ancien appelant) : comportement antérieur inchangé (l\'observation a lieu)', async () => {
  const { journal, options } = tourSpy({ observer: () => {}, avecValeur: false });
  await traiterTourAvecEnonce('bonjour', { idTrace: 't1' }, options);
  assert.deepEqual(journal.map((e) => (Array.isArray(e) ? e[0] : e)), ['identifier', 'observer', 'enonce', 'traiter']);
});
test('D8. la conservation ne change JAMAIS le résultat du tour ni le texte transmis au traitement', async () => {
  const a = tourSpy({ observer: () => {} }); const b = tourSpy({ observer: () => {}, avecValeur: false }); const c = tourSpy({ observer: () => {}, valeur: () => { throw new Error('x'); } });
  const ra = await traiterTourAvecEnonce('t', { idTrace: 'x' }, a.options);
  const rb = await traiterTourAvecEnonce('t', { idTrace: 'x' }, b.options);
  const rc = await traiterTourAvecEnonce('t', { idTrace: 'x' }, c.options);
  assert.deepEqual(ra, rb); assert.deepEqual(ra, rc);
});
test('D9. conservation lente : le tour l\'ATTEND avant d\'observer (ordre strict, pas de course)', async () => {
  const journal = [];
  await traiterTourAvecEnonce('t', null, {
    enregistrerEnonce: async () => {}, traiter: async () => 1, nouvelId: gen(),
    enregistrerValeur: async () => { await new Promise((r) => setTimeout(r, 20)); journal.push('valeur-finie'); },
    observerPossibilites: async () => { journal.push('observer'); },
  });
  assert.deepEqual(journal, ['valeur-finie', 'observer']);
});

// ============================================================================ E. HISTORIQUE RÉEL (chaîne complète)
async function tourReel(magasin, texte, ids) {
  let message = null;
  await traiterTourAvecEnonce(texte, null, {
    enregistrerEnonce: async () => {}, traiter: async (m) => { message = m; return 1; }, nouvelId: ids,
    enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e),
    observerPossibilites: (m) => observerPossibilites(m, {
      enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
      lireExecutions: () => magasin.lireTout('executionsOperations'),
    }),
  });
  return message;
}
test('E1. HISTORIQUE M1/M2 : après disparition des messages vivants, les observations + la table redonnent identité → valeur exactes', async () => {
  const magasin = magasinMemoireVive(); const ids = gen();
  await tourReel(magasin, 'bonjour Pixel', ids);
  await tourReel(magasin, 'salut Pixel', ids);
  // plus aucun objet message : on ne garde que le magasin
  const observations = (await magasin.lireTout('observationsPossibilites')).sort((a, b) => (a.idMessage < b.idMessage ? -1 : 1));
  const valeurs = new Map((await magasin.lireTout(T)).map((l) => [l.id, l.valeur]));
  assert.equal(observations.length, 2);
  assert.deepEqual(observations.map((o) => o.donneesExaminees), [[observations[0].idMessage], [observations[1].idMessage]]);
  assert.equal(valeurs.get(observations[0].donneesExaminees[0]), 'bonjour Pixel');
  assert.equal(valeurs.get(observations[1].donneesExaminees[0]), 'salut Pixel');
  assert.equal(valeurs.size, 2);
});
test('E2. MÊME TEXTE, DEUX MESSAGES : deux identités différentes, deux faits distincts', async () => {
  const magasin = magasinMemoireVive(); const ids = gen();
  const m1 = await tourReel(magasin, 'bonjour', ids); const m2 = await tourReel(magasin, 'bonjour', ids);
  assert.notEqual(m1.id, m2.id);
  const lignes = await magasin.lireTout(T);
  assert.equal(lignes.length, 2);
  assert.deepEqual(lignes.map((l) => l.valeur), ['bonjour', 'bonjour']);
});
test('E3. identité de la ligne = identité de la donnée observée (message.id = observation.idMessage = donneesExaminees = ligne.id)', async () => {
  const magasin = magasinMemoireVive();
  const m = await tourReel(magasin, 'bonjour Pixel', nouvelId);
  const [obs] = await magasin.lireTout('observationsPossibilites'); const [ligne] = await magasin.lireTout(T);
  assert.equal(ligne.id, m.id); assert.equal(obs.idMessage, m.id); assert.deepEqual(obs.donneesExaminees, [m.id]);
  assert.match(m.id, /^message-/);
  assert.equal(obs.possibilites.every((a) => a.donnee === m.id), true);
});
test('E4. les PRODUCTIONS ne sont pas dupliquées : une exécution existante apparaît dans l\'observation mais PAS dans valeursDonnees', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('executionsOperations', { id: 'execution-operation-1', horodatage: 'x', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-0' }], resultat: [{ chemin: [], type: 'chaine', valeur: 'ancien' }] });
  const m = await tourReel(magasin, 'nouveau', gen());
  const [obs] = await magasin.lireTout('observationsPossibilites');
  assert.equal(obs.donneesExaminees.includes('execution-operation-1'), true);
  assert.deepEqual((await magasin.lireTout(T)).map((l) => l.id), [m.id]);
  assert.equal(JSON.stringify(await magasin.lireTout(T)).includes('ancien'), false);
});
test('E5. le tour réel n\'écrit AUCUNE autre table nouvelle : seules observationsPossibilites et valeursDonnees changent', async () => {
  const magasin = magasinMemoireVive();
  await tourReel(magasin, 'bonjour', gen());
  for (const t of TABLES) {
    const n = (await magasin.lireTout(t)).length;
    assert.equal(n, t === T || t === 'observationsPossibilites' ? 1 : 0, t);
  }
});
test('E6. PANNE de la table de valeurs : aucune observation écrite, le tour rend sa réponse normale', async () => {
  const base = magasinMemoireVive();
  const magasin = { lireTout: (t) => base.lireTout(t), ecrire: async (t, o) => { if (t === T) throw new Error('panne valeurs'); return base.ecrire(t, o); } };
  let reponse = null;
  const res = await traiterTourAvecEnonce('bonjour', null, {
    enregistrerEnonce: async () => {}, traiter: async () => { reponse = 'ma réponse'; return { texte: reponse }; }, nouvelId: gen(),
    enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e),
    observerPossibilites: (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }),
  });
  assert.deepEqual(res, { texte: 'ma réponse' });
  assert.deepEqual(await base.lireTout(T), []);
  assert.deepEqual(await base.lireTout('observationsPossibilites'), []);
});
test('E7. MESSAGE NON OBSERVÉ : la valeur peut exister sans observation (contrat = « a existé avec cette valeur », pas « observé avec succès »)', async () => {
  const magasin = magasinMemoireVive();
  await traiterTourAvecEnonce('bonjour', null, {
    enregistrerEnonce: async () => {}, traiter: async () => 1, nouvelId: gen(),
    enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e),
    observerPossibilites: (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: async () => { throw new Error('lecture HS'); } }),
  });
  assert.equal((await magasin.lireTout(T)).length, 1);
  assert.equal((await magasin.lireTout('observationsPossibilites')).length, 0);
});
test('E8. aucune reconstruction rétroactive : journal / observationsLangage / enonces / traces existants ne produisent AUCUNE ligne', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('journal', { id: 'j1', texte: 'ancien message' });
  await magasin.ecrire('observationsLangage', { id: 'ol1', idMessage: 'message-ancien', texte: 'ancien' });
  await magasin.ecrire('enonces', { id: 'e1', idTrace: 't', texte: 'ancien' });
  await magasin.ecrire('traces', { id: 't1', texte: 'ancien' });
  assert.deepEqual(await magasin.lireTout(T), []);
  await tourReel(magasin, 'nouveau', gen());
  assert.deepEqual((await magasin.lireTout(T)).map((l) => l.valeur), ['nouveau']);
});
test('E9. aucune dérivation persistée : la ligne ne contient ni sortie de parcourirStructure, ni jetons, ni longueur', async () => {
  const magasin = magasinMemoireVive();
  await tourReel(magasin, 'bonjour Pixel', gen());
  const [l] = await magasin.lireTout(T);
  assert.deepEqual(Object.keys(l), ['id', 'valeur']);
  assert.equal(typeof l.valeur, 'string');
  assert.equal(l.valeur, 'bonjour Pixel');
});

// ============================================================================ F. PORTEUR HISTORIQUE
test('F1. ACCES_VALEUR_DONNEE = { champ: \'valeur\' }, gelé, distinct de l\'accès du message vivant', () => {
  assert.deepEqual(ACCES_VALEUR_DONNEE, { champ: 'valeur' });
  assert.equal(Object.isFrozen(ACCES_VALEUR_DONNEE), true);
  assert.notDeepEqual(ACCES_VALEUR_DONNEE, DESCRIPTION_SOURCE_MESSAGE.acces);
  assert.deepEqual(Object.keys(moduleAcces), ['ACCES_VALEUR_DONNEE']);
});
test('F2. la ligne persistée sert DIRECTEMENT de porteur à valeurDePorteur → texte exact du message (aucun adaptateur)', async () => {
  const magasin = magasinMemoireVive();
  const message = await tourReel(magasin, 'bonjour Pixel', gen());
  const donnee = donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE);
  const [ligne] = await magasin.lireTout(T);
  assert.equal(valeurDePorteur(ligne, donnee, ACCES_VALEUR_DONNEE), 'bonjour Pixel');
  assert.equal(valeurDePorteur(message, donnee, DESCRIPTION_SOURCE_MESSAGE.acces), 'bonjour Pixel');
});
test('F3. valeurDePorteur refuse la ligne d\'un AUTRE message (identité) et un mauvais champ', async () => {
  const magasin = magasinMemoireVive(); const ids = gen();
  const m1 = await tourReel(magasin, 'bonjour', ids); const m2 = await tourReel(magasin, 'salut', ids);
  const lignes = await magasin.lireTout(T);
  const l1 = lignes.find((l) => l.id === m1.id);
  assert.throws(() => valeurDePorteur(l1, donneeDeSource(m2, DESCRIPTION_SOURCE_MESSAGE), ACCES_VALEUR_DONNEE), TypeError);
  assert.throws(() => valeurDePorteur(l1, donneeDeSource(m1, DESCRIPTION_SOURCE_MESSAGE), { champ: 'texte' }), TypeError);
  assert.throws(() => valeurDePorteur(l1, donneeDeSource(m1, DESCRIPTION_SOURCE_MESSAGE), { champ: 'resultat' }), TypeError);
});
test('F4. valeur vide conservée : valeurDePorteur rend \'\' (et non une erreur)', async () => {
  const magasin = magasinMemoireVive();
  const message = await tourReel(magasin, '', gen());
  const [ligne] = await magasin.lireTout(T);
  assert.equal(valeurDePorteur(ligne, { identite: message.id }, ACCES_VALEUR_DONNEE), '');
});
test('F5. la ligne survit à une sauvegarde / restauration et reste un porteur valide', async () => {
  const magasin = magasinMemoireVive();
  const message = await tourReel(magasin, 'salut é 🙂', gen());
  const memoire = creerMemoire(creerMagasinMemoire());
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage: magasin, idNaissance: 'id', versionAppli: '0.63.27', maintenant: new Date('2026-10-05T12:00:00Z') });
  assert.equal(fichier.objet.schema, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await neuf.ecrire(T, { id: 'residu', valeur: 'à remplacer' });
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const lignes = await neuf.lireTout(T);
  assert.deepEqual(lignes, [{ id: message.id, valeur: 'salut é 🙂' }]);
  assert.equal(valeurDePorteur(lignes[0], { identite: message.id }, ACCES_VALEUR_DONNEE), 'salut é 🙂');
});
test('F6. COMPATIBILITÉ chaîne dormante : la ligne persistée résout les valeurs d\'une application via resoudreValeursApplication (univers historique)', async () => {
  const magasin = magasinMemoireVive();
  const message = await tourReel(magasin, 'bonjour Pixel', gen());
  const [obs] = await magasin.lireTout('observationsPossibilites'); const [ligne] = await magasin.lireTout(T);
  const groupes = groupesDeCandidats(obs.possibilites, DESCRIPTIONS_OPERATIONS);
  assert.equal(applicationUnique(groupes).etat, 'plusieurs'); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : parcourirStructure ET symbolesDeChaine sont déterminées ; le test précise parcourirStructure à la main
  const g = groupes.find((x) => x.operation === 'parcourirStructure');
  const application = { operation: g.operation, liaisons: g.entrees.map((e) => ({ entree: e.entree, donnee: e.donnees[0] })) };
  const univers = [{ donnee: donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE), porteur: ligne, acces: ACCES_VALEUR_DONNEE }];
  const r = resoudreValeursApplication(application, univers);
  assert.equal(r.operation, 'parcourirStructure');
  assert.deepEqual(Object.values(r.valeurs), ['bonjour Pixel']);
});

// ============================================================================ G. PERSISTANCE / MIGRATION
async function etatSauvegarde() {
  const magasinLangage = magasinMemoireVive();
  await enregistrerValeurDonnee(magasinLangage, { id: 'message-1', valeur: 'bonjour Pixel' });
  await enregistrerValeurDonnee(magasinLangage, { id: 'message-2', valeur: 'salut Pixel' });
  await magasinLangage.ecrire('journal', { id: 'j1', texte: 'ancien' });
  return { memoire: creerMemoire(creerMagasinMemoire()), magasinLangage };
}
async function enSchema(fichier, schema, sansTables = []) {
  const f = JSON.parse(fichier.contenu); f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees)); return f;
}
const maintenant = new Date('2026-10-05T12:00:00Z');
test('G1. migration 18 → 19 (IndexedDB simulée) : crée SEULEMENT valeursDonnees, aucune donnée existante touchée', async () => {
  const existants = TABLES.filter((t) => t !== T);
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) {
    nom = n; version = v;
    const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) };
    const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
    return r;
  } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(crees, [[T, 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});
test('G2. sauvegarde schéma 9 : la table est exportée et restaurée à l\'identique (aller-retour, empreinte valide)', async () => {
  const { memoire, magasinLangage } = await etatSauvegarde();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.27', maintenant });
  assert.equal(fichier.objet.schema, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(fichier.objet.donnees.langage[T].map((l) => l.id).sort(), ['message-1', 'message-2']);
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const tri = (l) => l.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  assert.deepEqual(tri(await neuf.lireTout(T)), [{ id: 'message-1', valeur: 'bonjour Pixel' }, { id: 'message-2', valeur: 'salut Pixel' }]);
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});
test('G3. ANCIENNES sauvegardes (schémas 1 à 8, sans la table) : importables, table VIDE, aucune reconstruction depuis le journal', async () => {
  const { memoire, magasinLangage } = await etatSauvegarde();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.27', maintenant });
  for (const schema of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const ancienne = await enSchema(fichier, schema, [T]);
    const lue = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
    assert.equal(lue.ok, true, `schéma ${schema} : ${lue.erreur}`);
    assert.deepEqual(lue.donnees.langage[T], []);
    assert.deepEqual(lue.donnees.langage.journal, [{ id: 'j1', texte: 'ancien' }]);
    const neuf = magasinMemoireVive();
    await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
    assert.deepEqual(await neuf.lireTout(T), []);
  }
});
test('G4. schéma courant (9) STRICT : sans la table = refus « incomplet » ; schéma futur (10) = refus « plus récente »', async () => {
  const { memoire, magasinLangage } = await etatSauvegarde();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.27', maintenant });
  const incomplet = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 12, [T])), { tablesMemoire: TABLES_MEMOIRE }); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : schéma courant 11 : schéma courant 10 (+ contextesProspectifs) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(incomplet.ok, false); assert.match(incomplet.erreur, /incomplet.*valeursDonnees/);
  const futur = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 13)), { tablesMemoire: TABLES_MEMOIRE }); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : courant 11, futur 12 // MISE À JOUR DÉLIBÉRÉE v0.63.72 : le schéma courant est 10 (+ contextesProspectifs) ; le futur refusé est 11 // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(futur.ok, false); assert.match(futur.erreur, /plus récente/);
});
test('G5. migrerDonnees : complète par [] pour un schéma < 9 seulement ; ne fabrique jamais de ligne', () => {
  for (const s of [1, 5, 8]) assert.deepEqual(migrerDonnees({ faits: [] }, [T], s)[T], []);
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees({ faits: [] }, [T], 12), T), false); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : complétée pour un schéma < 11 // MISE À JOUR DÉLIBÉRÉE v0.63.72 : la table n'est complétée que pour un schéma < 10 ; 9 est désormais un ancien schéma (complété) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(migrerDonnees({ [T]: [{ id: 'z', valeur: 'q' }] }, [T], 8)[T], [{ id: 'z', valeur: 'q' }]);
});
test('G6. une ligne falsifiée dans le fichier est détectée par l\'empreinte', async () => {
  const { memoire, magasinLangage } = await etatSauvegarde();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.27', maintenant });
  const f = JSON.parse(fichier.contenu); f.donnees.langage[T][0].valeur = 'falsifiée';
  assert.equal((await lireSauvegardeComplete(JSON.stringify(f), { tablesMemoire: TABLES_MEMOIRE })).ok, false);
});

// ============================================================================ H. TEST DORMANT « PIXEL » (non-tautologie future)
test('H1. depuis la seule table persistée, une observation de structure retrouve l\'ancre commune « Pixel » (aucun branchement actif)', async () => {
  const magasin = magasinMemoireVive(); const ids = gen();
  const m1 = await tourReel(magasin, 'bonjour Pixel', ids); const m2 = await tourReel(magasin, 'salut Pixel', ids);
  const lignes = await magasin.lireTout(T);
  const v1 = lignes.find((l) => l.id === m1.id).valeur; const v2 = lignes.find((l) => l.id === m2.id).valeur;
  const elements = [{ id: m1.id, texte: v1 }, { id: m2.id, texte: v2 }];
  const r = decrireStructureIdentifiee(elements);
  assert.equal(r.rapport.ok, true);
  assert.deepEqual(r.rapport.ancres, [{ position: 1, jeton: 'Pixel' }]);
  assert.deepEqual(r.rapport.positionsVariables, [0]);
  assert.deepEqual(r.rapport.diversite['0'].valeursDistinctes, ['bonjour', 'salut']);
  assert.deepEqual(r.couverture, [m1.id, m2.id].sort());
});
test('H2. la valeur n\'est pas devinée : sans la table, rien ne permet de retrouver le texte (message.id seul, observations seules)', async () => {
  const magasin = magasinMemoireVive();
  await tourReel(magasin, 'bonjour Pixel', gen());
  const [obs] = await magasin.lireTout('observationsPossibilites');
  assert.equal(JSON.stringify(obs).includes('Pixel'), false);
  assert.equal(JSON.stringify(await magasin.lireTout('journal')).includes('Pixel'), false);
});

// ============================================================================ I. GARDES STATIQUES / DORMANCE
test('I1. seul connaissances.js nomme la table ; pont.js, main.js, observateur et conversation ne la nomment pas', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes(T)).map(rel).sort();
  assert.deepEqual(nommant, ['app/langage/connaissances.js', 'app/langage/executions-vecues.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.83 : la lecture de valeursDonnees pour la chaîne prospective et l'affichage passe désormais par executions-vecues.js (lecture seule) ; attentes-du-tour.js et execution-sollicitee.js ne la nomment plus // MISE À JOUR DÉLIBÉRÉE v0.63.78 (jalon 1) : attentes-du-tour.js LIT la table (lireTout) pour calculer l'issue des attentes du lot, présentation seule, aucune écriture // MISE À JOUR DÉLIBÉRÉE v0.63.72 : execution-sollicitee.js LIT la table (lireTout) pour calculer le contexte prospectif avant l'issue ; aucune écriture hors de la primitive
});
test('I2. la SEULE écriture active de valeursDonnees est la primitive (une écriture, une lecture, aucune autre opération)', () => {
  const a = CONN.indexOf('// === FAIT PERSISTANT « LA DONNÉE D AVAIT CETTE VALEUR »'); const b = CONN.indexOf('// === FAIT PERSISTANT D\'EXÉCUTION D\'UNE OPÉRATION');
  assert.ok(a > 0 && b > a);
  const code = sansCommentaires(CONN.slice(a, b));
  assert.equal((code.match(/magasin\.ecrire\(/g) || []).length, 1);
  assert.match(code, /magasin\.ecrire\('valeursDonnees', objet\)/);
  assert.equal((code.match(/magasin\.lireTout\(/g) || []).length, 1);
  assert.match(code, /magasin\.lireTout\('valeursDonnees'\)/);
  assert.equal(/magasin\.(supprimer|vider|remplacerTout|lire\()/.test(code), false);
  assert.equal(/nouvelId|Date\b|Math\.random|horodatage|JSON|structuredClone|Proxy|\beval\b|new\s+Function|import\s*\(/.test(code), false);
  const ecrituresApp = fichiersJs(join(RACINE, 'app')).filter((f) => /\.ecrire\('valeursDonnees'/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(ecrituresApp, ['app/langage/connaissances.js']);
});
test('I3. la primitive n\'importe ni parcourirStructure, ni structure, ni groupes, ni application, ni désignation, ni exécution', () => {
  const a = CONN.indexOf('// === FAIT PERSISTANT « LA DONNÉE D AVAIT CETTE VALEUR »'); const b = CONN.indexOf('// === FAIT PERSISTANT D\'EXÉCUTION D\'UNE OPÉRATION');
  const code = sansCommentaires(CONN.slice(a, b));
  assert.equal(/parcourirStructure|decrireStructure|produireConstats|groupesDeCandidats|applicationUnique|resoudreValeursApplication|invoquerOperation|enregistrerDesignation|enregistrerExecutionOperation|observationsPossibilites|executionsOperations|valeurDePorteur|DESCRIPTIONS_OPERATIONS/.test(code), false);
  const imports = (CONN.match(/^import\b[^;]*;/gm) || []).join('\n');
  assert.equal(/structure-identifiee|parcours-structure|groupes-candidats|application-unique|valeurs-application|invocation-operations|designation|acces-valeur|valeur-donnee/.test(imports), false);
});
test('I4. pont.js : conserverValeurMessage ne dérive, ne compare, ne rassemble rien et ne nomme aucun mécanisme d\'action', () => {
  const a = PONT.indexOf('export async function conserverValeurMessage('); const corps = PONT.slice(a, PONT.indexOf('\n}\n', a));
  const code = sansCommentaires(corps);
  assert.equal(/parcourirStructure|decrireStructure|groupesDeCandidats|applicationUnique|resoudreValeursApplication|invoquerOperation|enregistrerDesignation|enregistrerExecutionOperation|valeurDePorteur|\.trim\(|\.length|\.split\(|\.match\(|\.slice\(|toLowerCase|JSON|Date\b|Math\.|localStorage|indexedDB|magasin/.test(code), false);
  assert.equal(/parcourirStructure|decrireStructure|groupesDeCandidats|applicationUnique|resoudreValeursApplication|invoquerOperation|enregistrerDesignation|enregistrerExecutionOperation|valeurDePorteur/.test(sansCommentaires(PONT)), false);
  assert.equal(/connaissances/.test(PONT.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n')), false);
});
test('I5. main.js : enregistrerValeur injecté UNE fois dans traiterTourAvecEnonce, via la primitive réelle ; la table n\'est pas nommée', () => {
  assert.equal((MAIN.match(/enregistrerValeur:/g) || []).length, 1);
  assert.match(MAIN, /enregistrerValeurDonnee as enregistrerValeurDonneeReelle/);
  assert.match(MAIN, /enregistrerValeur: async \(entree\) => \{\n\s+const e = await ecranLangage\.assurerEsprit\(\);\n\s+return enregistrerValeurDonneeReelle\(e\.magasin, entree\);\n\s+\},/);
  const debut = MAIN.indexOf('await traiterTourAvecEnonce('); /* MISE À JOUR DÉLIBÉRÉE v0.63.35 */ const fin = MAIN.indexOf('surJugement:');
  assert.ok(debut > 0 && fin > debut && MAIN.slice(debut, fin).includes('enregistrerValeur:'));
  assert.equal(MAIN.includes(T), false);
  assert.equal((MAIN.match(/'executionsOperations'/g) || []).length, 1);
});
test('I6. DORMANCE de l\'accès : aucun fichier d\'app n\'importe valeur-donnee.js ; il ne contient ni import ni fonction', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (rel(f) === 'app/langage/valeur-donnee.js') continue;
    // MISE À JOUR DÉLIBÉRÉE v0.63.48 : resoudre-identites.js (dormant, jamais importé) importe la SEULE constante ACCES_VALEUR_DONNEE pour déclarer l'accès de la ligne de message qu'il rend.
    if (rel(f) === 'app/langage/resoudre-identites.js') { assert.equal(/from '\.\/valeur-donnee\.js'/.test(readFileSync(f, 'utf8')), true); continue; }
    // MISE À JOUR DÉLIBÉRÉE v0.63.65 : empreinte-categorie-message.js importe la SEULE constante ACCES_VALEUR_DONNEE pour empreinter l'accès historique du contrat de la catégorie message (source unique).
    if (rel(f) === 'app/langage/empreinte-categorie-message.js') { assert.equal(/from '\.\/valeur-donnee\.js'/.test(readFileSync(f, 'utf8')), true); continue; }
    assert.equal(/valeur-donnee|ACCES_VALEUR_DONNEE/.test(readFileSync(f, 'utf8')), false, rel(f));
  }
  for (const autre of ['app/index.html', 'app/sw.js', 'app/manifest.webmanifest']) {
    let src; try { src = lu(...autre.split('/')); } catch { continue; }
    assert.equal(/valeur-donnee/.test(src), false, autre);
  }
  const src = lu('app', 'langage', 'valeur-donnee.js');
  assert.equal(/^\s*import\b|function|=>/m.test(sansCommentaires(src)), false);
  assert.deepEqual(sansCommentaires(src).match(/^export .*$/gm), ["export const ACCES_VALEUR_DONNEE = Object.freeze({ champ: 'valeur' });"]);
});
test('I7. DORMANCE des étapes suivantes : depuis main.js, le graphe d\'imports n\'atteint toujours pas les mécanismes d\'action ni de rassemblement', () => {
  const vus = new Set();
  const visiter = (f) => {
    if (vus.has(f)) return; vus.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^\s*import\b[^;]*?from\s+'(\.[^']+)'/gm)) { const c = resolve(dirname(f), m[1]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations|environnement-conversation)\.js$/.test(c))) visiter(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js (l'émission est un acte prospectif : ce module vivant atteint la chaîne .72/.74 comme execution-sollicitee.js ; exclu du parcours au même titre)
  };
  visiter(join(RACINE, 'app', 'main.js'));
  const atteints = [...vus].map(rel);
  // MISE À JOUR DÉLIBÉRÉE v0.63.65 : 'valeur-donnee' n'est plus interdit à l'ATTEINTE : l'observateur vivant calcule la preuve de la catégorie message, dont le contrat empreinte la constante
  // ACCES_VALEUR_DONNEE (un objet gelé, sans fonction ni import : vérifié par I6). Seul empreinte-categorie-message.js l'importe ; aucun mécanisme d'accès (acces-valeur) n'est atteint.
  for (const interdit of ['groupes-candidats', 'application-unique', 'valeurs-application', 'invocation-operations', 'table-operations', 'structure-identifiee', 'acces-valeur', 'parcours-structure']) {
    assert.equal(atteints.some((f) => f.includes(interdit)), false, interdit);
  }
  assert.deepEqual(atteints.filter((f) => f.includes('valeur-donnee')), ['app/langage/valeur-donnee.js']);
  assert.equal(/enregistrerDesignation|enregistrerExecutionOperation/.test(sansCommentaires(MAIN)), false);
});
test('I8. le pont n\'a toujours qu\'une seule sortie vers l\'observation : traiterTourAvecEnonce n\'appelle ni exécution ni désignation', () => {
  const a = PONT.indexOf('export async function traiterTourAvecEnonce('); const corps = sansCommentaires(PONT.slice(a, PONT.indexOf('\n}\n', a)));
  assert.equal(/designation|execution|invoquer|application|groupes|parcourir/i.test(corps), false);
  assert.equal((corps.match(/await conserverValeurMessage\(/g) || []).length, 1);
});
test('I9. identifierMessage inchangé : { id, texte } gelé, jamais persisté par lui-même', () => {
  const m = identifierMessage('t', { nouvelId: gen() });
  assert.deepEqual(m, { id: 'message-1', texte: 't' }); assert.equal(Object.isFrozen(m), true);
  const a = PONT.indexOf('export function identifierMessage('); const corps = PONT.slice(a, PONT.indexOf('\n}\n', a));
  assert.equal(/ecrire|magasin|enregistrer/.test(corps), false);
});
// === FIN_TEST_VALEURS_DONNEES ===
