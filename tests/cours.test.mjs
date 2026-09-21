// v0.17 — LE « COURS » (app/langage/cours.js) : lecture d'un bloc, enseignement groupé, exercices passés par le
// VRAI moteur (repondre), diagnostic, rapport. Aucun dispatcher « miroir » : l'écriture passe par le VRAI
// ecrireConnaissance de langage/ecran.js (monté avec un faux DOM universel) ; les exercices par le vrai repondre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  lireCours, verifierCours, donnerCours, testerCours, statutElement, etiquetteStatut, classer,
  normaliserReponse, instantane, cloner, formaterRapport, formaterApercu, verdictDe, NOTE_PONT, LIMITES,
} from '../app/langage/cours.js';
import { chargerEsprit, repondre, PARTIEL } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { extraireLecon } from '../app/langage/lecon.js';

// Faux DOM universel : suffit pour monter langage/ecran.js et récupérer son vrai dispatcher ecrireConnaissance.
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

function monter(magasin) {
  return monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
}

// Base « à la Christophe » : ce que ses captures montrent (règles ton / tes / ta actives, façon de dire générale
// avec {possessif}, propriété couleur/genre, une couleur, un mot d'essai).
async function baseChristophe(fabrique = (m) => m) {
  const reel = magasinMemoireVive();
  const ecran = monter(fabrique(reel));
  const esprit = await ecran.assurerEsprit();
  for (const l of [
    'Mot : stylo désigne stylo.',
    'Fait : moi / couleur / rouge.',
    'Fait : moi / stylo / un Bic.',
    'Propriété : couleur / genre / féminin.',
    'Pour possessif_toi : si genre vaut masculin, on dit ton.',
    'Pour possessif_toi : si nombre vaut pluriel, on dit tes.',
    'Pour possessif_toi : si genre vaut féminin, on dit ta.',
    "Façon de dire : * / moi / {possessif} {relation}, c'est {valeur}.",
  ]) await ecran.ecrireConnaissance(esprit, extraireLecon(l), { origine: 'apprise-conversation', exemple: l });
  return { magasin: reel, ecran, esprit, ecrire: ecran.ecrireConnaissance };
}

const COURS_ESSAI = `Leçon : mes objets
Source : Claude
Mot : livre désigne livre.
Propriété : livre / genre / masculin.
Mot : montre désigne montre.
Propriété : montre / genre / féminin.
Pour possessif_toi : si genre vaut féminin, on dit ta.
Décor : Fait : moi / livre / un roman.
Décor : Fait : moi / montre / une Casio.
Décor : Mot : contraire désigne contraire.
Décor : Fait : chaud / contraire / froid.
Exercice : Quel est mon livre ? => ton livre, c'est un roman.
Exercice : Quelle est ma montre ? => ta montre, c'est une Casio.
Exercice : Dis-moi quel est mon livre. => ton livre, c'est un roman.
Exercice : Quelle est ma bicyclette ? => Je n'ai pas compris.
Sonde : Quelle est la couleur de mon livre ?
Sonde : Quel est le contraire de chaud ?
`;

// ------------------------------------------------------------------------------------ LECTURE
test('LECTURE — le bloc de la leçon d’essai : titre, source, 5 éléments, 4 lignes de Décor, 4 exercices, 2 sondes', () => {
  const l = lireCours(COURS_ESSAI);
  assert.equal(l.ok, true);
  assert.deepEqual(l.erreurs, []);
  assert.equal(l.titre, 'mes objets');
  assert.equal(l.source, 'Claude');
  assert.equal(l.enseignement.length, 5);
  assert.equal(l.decor.length, 4);
  assert.equal(l.exercices.length, 4);
  assert.equal(l.sondes.length, 2);
  assert.deepEqual(l.enseignement[0].extrait, { type: 'relation', donnees: { mot: 'livre', relation: 'livre' } });
  assert.deepEqual(l.exercices[0], { ligne: 12, question: 'Quel est mon livre ?', attendu: "ton livre, c'est un roman." });
  assert.deepEqual(l.sondes[1], { ligne: 17, question: 'Quel est le contraire de chaud ?' });
});

test('LECTURE — tolérances : puces, numéros, « → », lignes vides, commentaires, apostrophes typographiques', () => {
  const l = lireCours(`# un commentaire

- Mot : livre désigne livre.
• Propriété : livre / genre / masculin.
1. Décor : Fait : moi / livre / un roman.
2) Exercice : Quel est mon livre ? → ton livre, c’est un roman.
Sonde : Quelle est la couleur de mon livre ?`);
  assert.equal(l.ok, true, JSON.stringify(l.erreurs));
  assert.equal(l.enseignement.length, 2);
  assert.equal(l.decor.length, 1);
  assert.equal(l.exercices[0].attendu, 'ton livre, c’est un roman.');
  assert.equal(l.sondes.length, 1);
});

test('LECTURE — chaque ligne inconnue est refusée AVEC son numéro, sans rien exécuter', () => {
  const l = lireCours('Leçon : x\nMot livre désigne livre.\nExercice : Quel est mon livre ?\nDécor : bonjour\nSonde : Quel est mon livre ? => rien\nSonde :\nPropriété : livre / genre / masculin.');
  assert.equal(l.ok, false);
  assert.deepEqual(l.erreurs.map((e) => e.ligne), [2, 3, 4, 5, 6]);
  assert.match(l.erreurs[0].raison, /Ligne non reconnue/);
  assert.match(l.erreurs[1].raison, /il manque « => »/);
  assert.match(l.erreurs[2].raison, /cinq formes/);
  assert.match(l.erreurs[3].raison, /pas de réponse attendue/);
  assert.match(l.erreurs[4].raison, /doit contenir une question/);
});

test('LECTURE — titre ou source en double, bloc vide, plafonds', () => {
  assert.equal(lireCours('Leçon : a\nLeçon : b').ok, false);
  assert.equal(lireCours('Source : a\nSource : b').ok, false);
  assert.match(lireCours('').erreurs[0].raison, /ne contient rien/);
  assert.match(lireCours('# rien\n\n').erreurs[0].raison, /ne contient rien/);
  const trop = Array.from({ length: LIMITES.enseignement + 1 }, (_, i) => `Fait : moi / c${i} / v${i}.`).join('\n');
  assert.match(lireCours(trop).erreurs[0].raison, /Trop de lignes d'enseignement/);
  const tropEx = Array.from({ length: LIMITES.exercices + 1 }, (_, i) => `Sonde : Quelle est ma couleur ${i} ?`).join('\n');
  assert.match(lireCours(tropEx).erreurs[0].raison, /Trop d'exercices/);
});

test('un bloc refusé n’écrit RIEN et n’exécute rien (vérifier, donner, tester)', async () => {
  const b = await baseChristophe();
  const avant = await instantane(b.magasin);
  const mauvais = 'Mot livre désigne livre.\nExercice : Quel est mon livre ?';
  for (const f of [verifierCours, donnerCours, testerCours]) {
    const r = await f(mauvais, b);
    assert.equal(r.ok, false);
    assert.deepEqual(r.erreurs.map((e) => e.ligne), [1, 2]);
  }
  assert.equal(await instantane(b.magasin), avant);
  assert.match(formaterRapport(await donnerCours(mauvais, b), { version: 'x' }), /NON EXÉCUTÉ \(erreurs de lecture\)/);
});

// ------------------------------------------------------------------------------------ STATUTS
test('STATUTS — nouveau / déjà connu / remplace, pour les cinq types', async () => {
  const b = await baseChristophe();
  const s = (ligne) => statutElement(b.esprit, extraireLecon(ligne));
  // relation
  assert.equal(s('Mot : livre désigne livre.').statut, 'nouveau');
  assert.equal(s('Mot : stylo désigne stylo.').statut, 'connu');
  assert.equal(s('Mot : couleur désigne couleur.').statut, 'connu', 'mot du bagage de départ');
  assert.deepEqual(s('Mot : stylo désigne crayon.'), { statut: 'remplace', detail: { avant: 'stylo', apres: 'crayon' } });
  // fait
  assert.equal(s('Fait : moi / livre / un roman.').statut, 'nouveau');
  assert.equal(s('Fait : moi / couleur / rouge.').statut, 'connu');
  assert.deepEqual(s('Fait : moi / couleur / vert.'), { statut: 'remplace', detail: { avant: 'rouge', apres: 'vert' } });
  // propriété
  assert.equal(s('Propriété : livre / genre / masculin.').statut, 'nouveau');
  assert.equal(s('Propriété : couleur / genre / féminin.').statut, 'connu');
  assert.equal(s('Propriété : couleur / genre / masculin.').statut, 'remplace');
  // règle
  assert.equal(s('Pour possessif_toi : si genre vaut féminin, on dit ta.').statut, 'connu');
  assert.equal(s('Pour possessif_toi : si genre vaut féminin, on dit ma.').statut, 'remplace');
  assert.equal(s('Pour possessif_toi : si genre vaut neutre, on dit son.').statut, 'nouveau');
  // façon de dire
  assert.equal(s("Façon de dire : * / moi / {possessif} {relation}, c'est {valeur}.").statut, 'connu');
  assert.equal(s('Façon de dire : * / moi / Voici {valeur}.').statut, 'nouveau');
  assert.equal(etiquetteStatut(s('Mot : stylo désigne stylo.')), 'déjà connu (sautée)');
  assert.equal(etiquetteStatut(s('Fait : moi / couleur / vert.')), 'remplace « rouge » par « vert »');
  assert.equal(etiquetteStatut(s('Mot : livre désigne livre.')), 'nouveau');
});

// ------------------------------------------------------------------------------------ VÉRIFIER / DONNER
test('VÉRIFIER — aucune écriture réelle ; comptes et statuts de la leçon d’essai', async () => {
  const b = await baseChristophe();
  const avant = await instantane(b.magasin);
  const v = await verifierCours(COURS_ESSAI, b);
  assert.equal(v.ok, true);
  assert.deepEqual(v.comptes, { nouveaux: 4, connus: 1, remplacent: 0 });
  assert.deepEqual([v.decor, v.exercices, v.sondes], [4, 4, 2]);
  assert.deepEqual(v.elements.map((e) => e.etiquette), ['nouveau', 'nouveau', 'nouveau', 'nouveau', 'déjà connu (sautée)']);
  assert.equal(await instantane(b.magasin), avant, 'vérifier n’écrit rien dans le vrai magasin');
  assert.equal(b.esprit.lexique.livre, undefined, 'ni dans l’esprit réel');
  assert.match(formaterApercu(v), /5 éléments d'enseignement : 4 nouveaux, 1 déjà connu, 0 remplacent/);
});

test('VÉRIFIER — une erreur de logique sort au rejeu, AVANT toute écriture réelle', async () => {
  const b = await baseChristophe();
  const avant = await instantane(b.magasin);
  const mauvais = 'Mot : livre désigne livre.\nFaçon de dire : * / moi / {valeur.\nMot : montre désigne montre.';
  const v = await verifierCours(mauvais, b);
  assert.equal(v.ok, false);
  assert.equal(v.erreurs[0].ligne, 2);
  assert.match(v.erreurs[0].raison, /rejeu de contrôle : Une accolade ouvrante/);
  const r = await donnerCours(mauvais, b);
  assert.equal(r.ok, false);
  assert.equal(await instantane(b.magasin), avant, 'aucune ligne n’a été écrite pour de vrai, pas même la première');
  assert.equal(b.esprit.lexique.livre, undefined);
});

test('DONNER — la leçon d’essai : 4 écrits, 1 sautée, 0 règle « remplacée », exercices 4/4, VALIDÉE, sondes classées', async () => {
  const b = await baseChristophe();
  const remplaceesAvant = b.esprit.regles.filter((r) => r.statut === 'remplacee').length;
  const res = await donnerCours(COURS_ESSAI, b);
  assert.equal(res.ok, true);
  assert.deepEqual(res.elements.map((e) => e.action), ['ecrite', 'ecrite', 'ecrite', 'ecrite', 'sautee']);
  assert.equal(b.esprit.regles.filter((r) => r.statut === 'remplacee').length, remplaceesAvant, 'la règle identique n’a pas été réécrite');
  assert.equal(res.verdict.code, 'VALIDEE');
  assert.equal(res.verdict.texte, 'VALIDÉE (4/4 exercices)');
  assert.deepEqual(res.compteurs, { exercices: 4, reussis: 4, sondes: 2 });
  assert.deepEqual(res.resultats.filter((r) => r.type === 'exercice').map((r) => r.produit), [
    "ton livre, c'est un roman.", "ta montre, c'est une Casio.", "ton livre, c'est un roman.", "Je n'ai pas compris.",
  ]);
  const [s1, s2] = res.resultats.filter((r) => r.type === 'sonde');
  assert.equal(s1.produit, "ta couleur, c'est rouge.", 'réponse fausse et confiante : la couleur de Christophe');
  assert.equal(s1.classement.code, 'AMBIGUITE');
  assert.deepEqual(s1.brut.motsRelationsDansLaQuestion, ['couleur', 'livre']);
  assert.equal(s2.produit, "Je n'ai pas compris.");
  assert.equal(s2.classement.code, 'SUJET_NON_REPRESENTABLE');
  assert.equal(s2.classement.categorie, 'MOTEUR');
  assert.equal(s2.brut.sujet, null);
  assert.equal(s2.brut.relation, 'contraire');
  assert.equal(res.integrite.inchange, true);
  assert.equal(b.esprit.lexique.livre.relation, 'livre');
  assert.equal(b.esprit.proprietes.get('montre').get('genre'), 'feminin');
});

test('LE DÉCOR n’entre JAMAIS dans la vraie mémoire (leçon réussie, exercice en échec, test seulement)', async () => {
  const decorAbsent = async (b) => {
    assert.equal(b.esprit.faits.has('moi|livre'), false);
    assert.equal(b.esprit.faits.has('moi|montre'), false);
    assert.equal(b.esprit.faits.has('chaud|contraire'), false);
    assert.equal(b.esprit.lexique.contraire, undefined);
    const dur = await chargerEsprit(b.magasin);
    assert.equal(dur.faits.has('moi|livre'), false, 'ni dans le magasin, relu à neuf');
    assert.equal(dur.lexique.contraire, undefined);
  };
  const b1 = await baseChristophe();
  await donnerCours(COURS_ESSAI, b1); await decorAbsent(b1);
  const b2 = await baseChristophe();
  const r2 = await donnerCours(COURS_ESSAI.replace("ton livre, c'est un roman.\nExercice : Quelle est ma montre", "ton livre, c'est un polar.\nExercice : Quelle est ma montre"), b2);
  assert.equal(r2.verdict.code, 'ECHOUEE');
  await decorAbsent(b2);
  const b3 = await baseChristophe();
  const avant = await instantane(b3.magasin);
  await testerCours(COURS_ESSAI, b3);
  assert.equal(await instantane(b3.magasin), avant);
  await decorAbsent(b3);
});

test('INTÉGRITÉ — si le Décor contaminait la vraie mémoire, le rapport le DÉNONCE (donner et tester)', async () => {
  const b = await baseChristophe();
  // Simulation d'un bug : pendant l'application du Décor, quelque chose écrit dans le VRAI magasin.
  const contaminant = async (esprit, extrait, options) => {
    const r = await b.ecrire(esprit, extrait, options);
    if (String(options.origine).endsWith('-decor')) await b.magasin.ecrire('faits', { cle: 'moi|fuite', sujet: 'moi', relation: 'fuite', valeur: 'x' });
    return r;
  };
  const bv = await baseChristophe();
  const contaminantV = async (esprit, extrait, options) => {
    const r = await bv.ecrire(esprit, extrait, options);
    if (String(options.origine).endsWith('-decor')) await bv.magasin.ecrire('faits', { cle: 'moi|fuite', sujet: 'moi', relation: 'fuite', valeur: 'x' });
    return r;
  };
  const verif = await verifierCours(COURS_ESSAI, { ...bv, ecrire: contaminantV });
  assert.equal(verif.inchange, false, 'la vérification qui écrirait dans le vrai magasin est détectée');
  assert.match(formaterApercu(verif), /ANOMALIE : la vérification a modifié la vraie mémoire/);
  assert.equal((await verifierCours(COURS_ESSAI, await baseChristophe())).inchange, true);
  const donne = await donnerCours(COURS_ESSAI, { ...b, ecrire: contaminant });
  assert.equal(donne.integrite.inchange, false);
  assert.match(formaterRapport(donne, { version: 'x' }), /vrai magasin inchangé pendant le Décor et les exercices : NON — ANOMALIE/);
  const b2 = await baseChristophe();
  const contaminant2 = async (esprit, extrait, options) => {
    const r = await b2.ecrire(esprit, extrait, options);
    if (String(options.origine).endsWith('-decor')) await b2.magasin.ecrire('faits', { cle: 'moi|fuite', sujet: 'moi', relation: 'fuite', valeur: 'x' });
    return r;
  };
  const teste = await testerCours(COURS_ESSAI, { ...b2, ecrire: contaminant2 });
  assert.equal(teste.integrite.inchange, false);
});

test('PERSISTANCE — un esprit rechargé à neuf sur le même magasin réussit les exercices (hors Décor)', async () => {
  const b = await baseChristophe();
  await donnerCours(COURS_ESSAI, b);
  const dur = await chargerEsprit(b.magasin);
  assert.equal(dur.lexique.livre.role, 'relation');
  assert.equal(dur.proprietes.get('livre').get('genre'), 'masculin');
  assert.equal(repondre(dur, 'Quelle est ma bicyclette ?').texte, "Je n'ai pas compris.");
  assert.equal(repondre(dur, 'Quel est mon livre ?').texte, 'Je ne sais pas.', 'le mot est appris, mais le fait de test n’a pas survécu : c’était un Décor');
  const test = await testerCours(COURS_ESSAI, { magasin: b.magasin, ecrire: b.ecrire });
  assert.equal(test.verdict.code, 'VALIDEE', 'et « Tester seulement » sur ce vrai état donne le même verdict');
});

test('IDEMPOTENCE — redonner le même cours : tout est sauté, magasin strictement identique', async () => {
  const b = await baseChristophe();
  await donnerCours(COURS_ESSAI, b);
  const avant = await instantane(b.magasin);
  const remplacees = b.esprit.regles.filter((r) => r.statut === 'remplacee').length;
  const deuxieme = await donnerCours(COURS_ESSAI, b);
  assert.deepEqual(deuxieme.elements.map((e) => e.action), ['sautee', 'sautee', 'sautee', 'sautee', 'sautee']);
  assert.equal(await instantane(b.magasin), avant);
  assert.equal(b.esprit.regles.filter((r) => r.statut === 'remplacee').length, remplacees);
  assert.equal(deuxieme.verdict.code, 'VALIDEE');
});

test('UNE RÈGLE DIFFÉRENTE est bien écrite (elle remplace, l’historique est conservé)', async () => {
  const b = await baseChristophe();
  const v = await verifierCours('Pour possessif_toi : si genre vaut féminin, on dit ma.', b);
  assert.deepEqual(v.comptes, { nouveaux: 0, connus: 0, remplacent: 1 });
  const res = await donnerCours('Pour possessif_toi : si genre vaut féminin, on dit ma.', b);
  assert.equal(res.elements[0].action, 'ecrite');
  assert.match(res.elements[0].explication, /remplacé ma règle précédente/);
  assert.equal(b.esprit.regles.filter((r) => r.statut === 'validee' && r.resultat === 'ma').length, 1);
  assert.equal(res.verdict.code, 'SANS_EXERCICE');
});

test('« TESTER SEULEMENT » — n’écrit rien, ignore l’enseignement, dit la cause quand le savoir manque (DONNÉES)', async () => {
  const b = await baseChristophe();
  const avant = await instantane(b.magasin);
  const res = await testerCours(COURS_ESSAI, b);
  assert.equal(await instantane(b.magasin), avant);
  assert.equal(res.mode, 'TEST SEULEMENT');
  assert.ok(res.elements.every((e) => e.action === 'ignoree'));
  assert.equal(res.verdict.code, 'ECHOUEE', 'la leçon n’a pas été donnée : « livre » est inconnu');
  const premier = res.resultats[0];
  assert.equal(premier.ok, false);
  assert.equal(premier.classement.code, 'VOCABULAIRE');
  assert.equal(premier.classement.categorie, 'DONNÉES');
  assert.ok(premier.brut.motsInconnus.includes('livre'));
  assert.equal(res.integrite.inchange, true);
});

test('UN EXERCICE EN ÉCHEC : la leçon reste apprise, verdict ÉCHOUÉE, rapport avec attendu, produit et champs bruts', async () => {
  const b = await baseChristophe();
  const cours = 'Mot : livre désigne livre.\nPropriété : livre / genre / masculin.\nDécor : Fait : moi / livre / un roman.\nExercice : Quel est mon livre ? => ton livre, c\'est un polar.\nExercice : Quel est mon livre ? => ton livre, c\'est un roman.';
  const res = await donnerCours(cours, b);
  assert.equal(res.verdict.texte, 'ÉCHOUÉE (1 échec sur 2)');
  assert.equal(b.esprit.lexique.livre.relation, 'livre', 'rien n’est désappris');
  const ko = res.resultats[0];
  assert.equal(ko.ok, false);
  assert.equal(ko.classement.code, 'REPONSE_DIFFERENTE');
  const rapport = formaterRapport(res, { version: '9.9.9', date: '2026-09-21T00:00:00.000Z' });
  assert.match(rapport, /❌ ligne 4 — Exercice : Quel est mon livre \?/);
  assert.match(rapport, /attendu : ton livre, c'est un polar\./);
  assert.match(rapport, /produit : ton livre, c'est un roman\./);
  assert.match(rapport, /brut {4}: état=compris ; sujet=moi ; relation=livre ; mots inconnus=\[\] ; fait=moi→livre→un roman/);
  assert.match(rapport, /propriétés de « livre »=genre=masculin/);
});

// ------------------------------------------------------------------------------------ COMPARAISON
test('COMPARAISON — normalisée (casse, accents, apostrophes, espaces, point final) mais jamais plus tolérante', () => {
  const eq = (a, b) => normaliserReponse(a) === normaliserReponse(b);
  assert.ok(eq("ton livre, c’est un roman.", "Ton livre, c'est un roman"));
  assert.ok(eq('TA MONTRE, C\'EST UNE CASIO !', "ta montre, c'est une Casio."));
  assert.ok(eq('Je n’ai pas compris.', "je n'ai pas compris"));
  assert.ok(eq('un  roman', 'un roman'));
  assert.ok(eq('élève', 'eleve'));
  assert.ok(!eq("ton livre, c'est un roman.", "ton livre, c'est un polar."));
  assert.ok(!eq("ton livre, c'est un roman.", "ta livre, c'est un roman."));
  assert.ok(!eq('un roman', 'un roman noir'));
});

// ------------------------------------------------------------------------------------ CLASSEMENT
test('CLASSEMENT — un cas construit pour chaque catégorie, à partir des champs réels de repondre()', async () => {
  const b = await baseChristophe();
  const A = await cloner(b.magasin);
  const e = A.esprit;
  const ecrire = (l) => b.ecrire(e, extraireLecon(l), { origine: 'test', exemple: l });
  await ecrire('Mot : table désigne table.');
  await ecrire('Fait : moi / table / ronde.');
  await ecrire('Mot : crayon désigne crayon.');
  await ecrire('Mot : contraire désigne contraire.');
  await ecrire('Fait : chaud / contraire / froid.');
  await ecrire('Mot : livre désigne livre.');
  await ecrire('Fait : moi / livre / un roman.');
  const c = (q, ok = null) => { const r = repondre(e, q); return classer(r, { relations: [...new Set(q.toLowerCase().match(/[a-zé]+/g))].filter((m) => e.lexique[m] && e.lexique[m].role === 'relation'), ok }); };
  assert.equal(c('Quelle est ma bicyclette ?').code, 'VOCABULAIRE');
  assert.equal(c('Quelle est ma bicyclette ?').categorie, 'DONNÉES');
  assert.equal(c('Quel est mon crayon ?').code, 'FAIT_MANQUANT');
  assert.equal(c('Quelle est ma table ?').code, 'REGLE_MANQUANTE', 'le fait est connu, la propriété genre manque');
  assert.equal(c('Quel est le contraire de chaud ?').code, 'SUJET_NON_REPRESENTABLE');
  assert.equal(c('Quel est le contraire de chaud ?').categorie, 'MOTEUR');
  assert.equal(c('Quelle est la couleur de mon livre ?').code, 'AMBIGUITE');
  assert.equal(c('Quelle est la couleur de mon livre ?').categorie, 'AMBIGUÏTÉ');
  assert.equal(c('Quelle est ma ?').code, 'COMPREHENSION_INCOMPLETE');
  assert.equal(repondre(e, 'Quelle est ma ?').etat, PARTIEL);
  assert.equal(c('Quelle est ma couleur ?', false).code, 'REPONSE_DIFFERENTE');
  assert.equal(c('Quelle est ma couleur ?', true).code, 'OK');
  assert.equal(c('Quelle est ma couleur ?').code, 'REPONSE_PRODUITE');
  // conflits de règles / de façons de dire : deux données qui se contredisent
  await ecrire('Propriété : table / genre / féminin.');
  await ecrire('Propriété : table / nombre / singulier.');
  await ecrire('Pour possessif_toi : si nombre vaut singulier, on dit ton.');
  assert.equal(c('Quelle est ma table ?').code, 'CONFLIT_REGLES');
  const B = await cloner(b.magasin);
  const ecrireB = (l) => b.ecrire(B.esprit, extraireLecon(l), { origine: 'test', exemple: l });
  await ecrireB('Mot : table désigne table.'); await ecrireB('Fait : moi / table / ronde.');
  await ecrireB('Façon de dire : * / moi / A {valeur}.'); await ecrireB('Façon de dire : * / moi / B {valeur}.');
  assert.equal(classer(repondre(B.esprit, 'Quelle est ma table ?'), {}).code, 'CONFLIT_FACONS_DE_DIRE');
});

// ------------------------------------------------------------------------------------ PANNE
test('PANNE D’ÉCRITURE à la 3e écriture réelle : arrêt net, rapport PARTIELLE exact, exercices non lancés', async () => {
  let armee = false; let n = 0;
  const b = await baseChristophe((m) => ({
    lireTout: (t) => m.lireTout(t), supprimer: (t, k) => m.supprimer(t, k), vider: () => m.vider(), fermer: () => m.fermer(),
    ecrire: async (t, o) => { if (armee && ++n === 3) throw new Error('disque plein'); return m.ecrire(t, o); },
  }));
  armee = true;
  const res = await donnerCours(COURS_ESSAI, b);
  assert.equal(res.ok, true);
  assert.equal(res.partielle, true);
  assert.deepEqual(res.elements.map((e) => e.action), ['ecrite', 'ecrite', 'erreur', 'non_ecrite', 'non_ecrite']);
  assert.equal(res.erreurEcriture.ligne, 5);
  assert.match(res.erreurEcriture.raison, /disque plein/);
  assert.equal(res.verdict.code, 'PARTIELLE');
  assert.deepEqual(res.resultats, [], 'les exercices ne sont pas lancés sur une leçon à moitié écrite');
  assert.equal(res.integrite.inchange, null);
  const rapport = formaterRapport(res, { version: 'x' });
  assert.match(rapport, /Verdict : PARTIELLE/);
  assert.match(rapport, /ÉCRITURE INTERROMPUE ligne 5 : disque plein/);
  assert.match(rapport, /NON ÉCRIT — ligne 6/);
  assert.match(rapport, /sans objet \(exercices non lancés\)/);
});

// ------------------------------------------------------------------------------------ RAPPORT
test('RAPPORT — toutes les rubriques, la version, les données brutes, la ligne « NON OBSERVÉ », le Décor marqué temporaire', async () => {
  const b = await baseChristophe();
  const res = await donnerCours(COURS_ESSAI, b);
  const r = formaterRapport(res, { version: '0.17.0', date: '2026-09-21T10:00:00.000Z' });
  for (const morceau of [
    'RAPPORT DE COURS — Naissance v0.17.0', 'Date : 2026-09-21T10:00:00.000Z', 'Mode : ENSEIGNEMENT + EXERCICES',
    'Leçon : mes objets · Source : Claude', 'Verdict : VALIDÉE (4/4 exercices)', 'Exercices : 4/4 réussis · Sondes : 2 (observation, hors verdict)',
    'Intégrité : vrai magasin inchangé pendant le Décor et les exercices : oui',
    '--- ENSEIGNEMENT (5 éléments)', '[nouveau] écrit — ligne 3 : Mot : livre désigne livre.', '[déjà connu (sautée)] sauté — ligne 7',
    '--- DÉCOR (temporaire : appliqué à la copie de test seulement, jamais écrit dans la vraie mémoire)', 'ligne 8 : Fait : moi / livre / un roman.',
    '--- EXERCICES', '✅ ligne 12 — Exercice : Quel est mon livre ?', '--- SONDES (observation, jamais comptées dans le verdict)',
    '👁 ligne 16 — Sonde : Quelle est la couleur de mon livre ?', 'attendu : (observation, aucune réponse attendue)',
    'classement : AMBIGUÏTÉ — AMBIGUITE : plusieurs mots-relations dans la question (couleur, livre) ; le moteur a retenu « couleur »',
    'classement : MOTEUR — SUJET_NON_REPRESENTABLE', 'mots-relations dans la question=[couleur, livre]', 'façon de dire=« {possessif} {relation}, c\'est {valeur}. »',
    'règle utilisée=genre=masculin → ton', NOTE_PONT,
  ]) assert.ok(r.includes(morceau), `manque dans le rapport : ${morceau}`);
  assert.ok(!/appris|retenu/i.test(r.split('--- DÉCOR')[1].split('--- EXERCICES')[0]), 'le Décor n’est jamais présenté comme appris');
  assert.match(NOTE_PONT, /pont \/ routage de main\.js/);
  assert.equal(verdictDe([], {}).code, 'SANS_EXERCICE');
});

// ------------------------------------------------------------------------------------ AUCUN LLM
test('STATIQUE — cours.js n’importe que des modules purs du langage : aucun réseau, aucun LLM, aucun DOM', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'cours.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const importes = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(importes, ['./bagage.js', './comprendre.js', './connaissances.js', './esprit.js', './lecon.js', './regles.js']);
  for (const interdit of ['fournisseurs', 'moteur-local', '../esprit/', 'reglages', 'gemini', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator', 'document', 'window', 'localStorage', 'appelerGemini']) {
    assert.ok(!code.includes(interdit), `cours.js ne doit pas contenir « ${interdit} »`);
  }
  assert.match(code, /repondre\(esprit, item\.question\)/, 'les exercices passent par repondre()');
});
