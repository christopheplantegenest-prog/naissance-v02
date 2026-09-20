import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decouper, comprendre, COMPRIS, PARTIEL, INCOMPRIS } from '../app/langage/comprendre.js';
import { chargerEsprit, repondre, apprendreFait, apprendreMot, apprendrePatron, fabriquerGabarit, choisirPatron } from '../app/langage/esprit.js';
import { magasinMemoireVive, noterIncomprise, cleFait } from '../app/langage/connaissances.js';
import { LEXIQUE_DEPART, tailleBagage } from '../app/langage/bagage.js';
import { motsCles } from '../app/memoire/selection.js';

test('bagage de départ : volontairement petit, pour que tout le reste soit de l’apprentissage', () => {
  const t = tailleBagage();
  assert.ok(t.mots <= 70, `lexique de départ petit (${t.mots} mots)`);
  assert.equal(t.patrons, 1, 'une seule façon de dire au départ : la valeur seule');
  assert.ok(t.faits <= 2, 'presque aucun fait au départ');
});

test('découpage : garde les petits mots que motsCles() jette — c’est tout l’enjeu', () => {
  const phrase = 'Quelle est ma couleur ?';
  const mots = decouper(phrase);
  assert.ok(mots.includes('ma'), '« ma » est conservé ici…');
  assert.ok(!motsCles(phrase).has('ma'), '…alors que motsCles() le jette');
  assert.deepEqual(decouper("Où est-ce que j'habite ?"), ['ou', 'est', 'ce', 'que', 'j', 'habite']);
  assert.ok(decouper("Comment s'appelle mon fils ?").includes('mon'));
});

test('compréhension : distingue « ma » de « ta » — le défaut que LFM2 n’a jamais su corriger', () => {
  const moi = comprendre('Quelle est ma couleur ?');
  const toi = comprendre('Quelle est ta couleur ?');
  assert.equal(moi.sujet, 'moi');
  assert.equal(toi.sujet, 'naissance');
  assert.equal(moi.relation, 'couleur');
  assert.equal(toi.relation, 'couleur');
  assert.notEqual(moi.sujet, toi.sujet, 'deux questions de même forme, deux sujets différents');
});

test('compréhension : « mon fils » demande le fils, pas le nom de celui qui parle', () => {
  const c = comprendre("Comment s'appelle mon fils ?");
  assert.equal(c.sujet, 'moi');
  assert.equal(c.relation, 'fils', 'le nom (« fils ») l’emporte sur le verbe (« appelle »)');
  assert.equal(comprendre('Comment je m’appelle ?').relation, 'nom', 'sans nom de relation, le verbe décide');
});

test('compréhension : les trois états, dont la frontière du non compris', () => {
  assert.equal(comprendre("Où est-ce que j'habite ?").etat, COMPRIS);
  assert.equal(comprendre('Quelle est ma pointure ?').etat, PARTIEL, 'sujet connu, information inconnue');
  assert.equal(comprendre('Zorglub blblb ?').etat, INCOMPRIS);
  assert.ok(comprendre('Quelle est ma pointure ?').motsInconnus.includes('pointure'));
});

test('répondre : ne sait rien au départ, puis retrouve le fait appris', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  assert.equal(repondre(e, "Comment s'appelle mon fils ?").texte, 'Je ne sais pas.');
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  const r = repondre(e, "Comment s'appelle mon fils ?");
  assert.equal(r.texte, 'Atem', 'la valeur seule suffit : c’est une réussite');
  assert.equal(r.fait.valeur, 'Atem');
});

test('répondre : ne confond jamais le fait de Christophe et le sien', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreFait(e, { sujet: 'naissance', relation: 'couleur', valeur: 'rouge' });
  assert.equal(repondre(e, 'Quelle est ma couleur ?').texte, 'bleu');
  assert.equal(repondre(e, 'Quelle est ta couleur ?').texte, 'rouge');
});

test('apprendre un mot : un terme nouveau prend le sens d’un terme connu', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  assert.equal(comprendre('Comment s’appelle mon gamin ?', { lexique: e.lexique }).relation, 'nom', 'avant : « gamin » est inconnu');
  await apprendreMot(e, { motNouveau: 'gamin', motConnu: 'fils' });
  e = await chargerEsprit(m); // rechargement depuis la base
  assert.equal(repondre(e, 'Comment s’appelle mon gamin ?').texte, 'Atem', 'après redémarrage, « gamin » est compris');
});

test('fabriquerGabarit : n’invente jamais — la valeur doit figurer dans la correction', () => {
  assert.equal(fabriquerGabarit("Ton fils s'appelle Atem.", 'Atem', 'fils'), "Ton fils s'appelle {valeur}.");
  assert.equal(fabriquerGabarit('Une phrase sans la valeur.', 'Atem', 'fils'), null);
  assert.equal(fabriquerGabarit("Ton fils s'appelle Atem.", 'Atem', 'fils', { portee: 'toutes' }), "Ton {relation} s'appelle {valeur}.");
  assert.equal(fabriquerGabarit('Il se nomme Atem.', 'Atem', 'fils', { portee: 'toutes' }), null, 'sans le mot « fils », pas de généralisation honnête');
});

test('LE TEST DÉCISIF — apprendre sur une relation, redémarrer, réutiliser sur une AUTRE', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  await apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Marcillac-Lanville' });
  // Avant : elle répond la valeur nue, pour les deux.
  assert.equal(repondre(e, "Comment s'appelle mon fils ?").texte, 'Atem');
  assert.equal(repondre(e, "Où est-ce que j'habite ?").texte, 'Marcillac-Lanville');
  // On ne lui montre QUE le cas du fils.
  await apprendrePatron(e, { correction: "Ton fils s'appelle Atem.", sujet: 'moi', relation: 'fils', portee: 'toutes' });
  // REDÉMARRAGE : tout est relu depuis la base, rien ne reste en mémoire vive.
  e = await chargerEsprit(m);
  assert.equal(repondre(e, "Comment s'appelle mon fils ?").texte, "Ton fils s'appelle Atem.", 'ce qu’on lui a montré');
  const transfert = repondre(e, "Où est-ce que j'habite ?");
  assert.equal(transfert.texte, "Ton ville s'appelle Marcillac-Lanville.",
    'TRANSFERT : appliqué à « ville », qu’on ne lui a jamais montrée (phrase fautive, mais c’est bien une généralisation)');
  assert.equal(transfert.patron.origine, 'appris');
});

test('patron limité à une relation : n’est PAS transféré ailleurs', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  await apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Marcillac-Lanville' });
  await apprendrePatron(e, { correction: "Ton fils s'appelle Atem.", sujet: 'moi', relation: 'fils' });
  e = await chargerEsprit(m);
  assert.equal(repondre(e, "Comment s'appelle mon fils ?").texte, "Ton fils s'appelle Atem.");
  assert.equal(repondre(e, "Où est-ce que j'habite ?").texte, 'Marcillac-Lanville', 'la ville garde la valeur seule : pas de transfert abusif');
});

test('apprendre un patron sans connaître le fait est refusé', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await assert.rejects(() => apprendrePatron(e, { correction: "Ton fils s'appelle Atem.", sujet: 'moi', relation: 'fils' }), /apprends-moi d'abord le fait/);
});

test('choisirPatron : le patron d’une relation précise l’emporte sur le général', () => {
  const patrons = [
    { id: 'a', relation: '*', sujet: '*', gabarit: '{valeur}' },
    { id: 'b', relation: 'ville', sujet: '*', gabarit: 'Tu habites à {valeur}.' },
  ];
  assert.equal(choisirPatron(patrons, { sujet: 'moi', relation: 'ville' }).id, 'b');
  assert.equal(choisirPatron(patrons, { sujet: 'moi', relation: 'couleur' }).id, 'a');
});

test('journal : garde les phrases non comprises, compte les répétitions, ne double jamais', async () => {
  const m = magasinMemoireVive();
  await noterIncomprise(m, { phrase: 'Zorglub ?', etat: INCOMPRIS, sujet: null, relation: null, motsInconnus: ['zorglub'] });
  await noterIncomprise(m, { phrase: 'zorglub ?', etat: INCOMPRIS, sujet: null, relation: null, motsInconnus: ['zorglub'] });
  const j = await m.lireTout('journal');
  assert.equal(j.length, 1, 'une seule entrée pour la même phrase');
  assert.equal(j[0].fois, 2);
  assert.deepEqual(j[0].motsInconnus, ['zorglub']);
});

test('isolement : la base du langage ne porte pas le nom de la mémoire réelle', async () => {
  const { NOM_BASE } = await import('../app/langage/connaissances.js');
  const magasinReel = await import('../app/memoire/magasin.js');
  assert.notEqual(NOM_BASE, magasinReel.NOM_BASE, 'deux bases distinctes : aucun risque pour la mémoire de Christophe');
  assert.equal(NOM_BASE, 'naissance-langage');
});
