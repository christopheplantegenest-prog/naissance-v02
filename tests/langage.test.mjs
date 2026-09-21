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

// --- v0.10 : règles comme données, propriétés, composition, transfert d'un choix grammatical ---
import {
  apprendreRelation, apprendrePropriete, apprendreRegle, PHRASE_NE_SAIS_PAS_DIRE, PHRASE_CONFLIT,
} from '../app/langage/esprit.js';
import { plusSpecifiques, signatureConditions, appliquerRegles } from '../app/langage/regles.js';

test('v0.10 — non-régression explicite : sans dynamiserPossessif, fabriquerGabarit se comporte EXACTEMENT comme en v0.9', () => {
  const g1 = fabriquerGabarit("Ton fils s'appelle Atem.", 'Atem', 'fils');
  assert.equal(g1, "Ton fils s'appelle {valeur}.", '« Ton » reste figé : apprendre une règle n’a pas rendu muet ce qui marchait déjà');
  const g2 = fabriquerGabarit("Ton fils s'appelle Atem.", 'Atem', 'fils', { portee: 'toutes' });
  assert.equal(g2, "Ton {relation} s'appelle {valeur}.");
});

test('moteur de règles (regles.js) : la plus spécifique gagne, un conflit est rendu, jamais deviné', () => {
  const regles = [
    { role: 'r', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta', statut: 'validee' },
    { role: 'r', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton', statut: 'validee' },
  ];
  assert.equal(appliquerRegles(regles, { role: 'r', proprietesDuMot: new Map([['genre', 'feminin']]) }).resultat, 'ta');
  assert.equal(appliquerRegles(regles, { role: 'r', proprietesDuMot: new Map([['genre', 'masculin']]) }).resultat, 'ton');
  assert.equal(appliquerRegles(regles, { role: 'r', proprietesDuMot: new Map() }).resultat, null, 'aucune propriété : aucune règle ne s’applique');
  const enConflit = [...regles, { role: 'r', conditions: [{ propriete: 'forme', valeur: 'ronde' }], resultat: 'sa', statut: 'validee' }];
  const r = appliquerRegles(enConflit, { role: 'r', proprietesDuMot: new Map([['genre', 'feminin'], ['forme', 'ronde']]) });
  assert.equal(r.resultat, null);
  assert.equal(r.conflit, true);
  assert.equal(r.candidats.length, 2);
  // Statut : une règle 'candidate' (réservé à un futur enseignement externe) n'est jamais appliquée.
  const candidate = [{ role: 'r', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta', statut: 'candidate' }];
  assert.equal(appliquerRegles(candidate, { role: 'r', proprietesDuMot: new Map([['genre', 'feminin']]) }).resultat, null);
});

test('plusSpecifiques : principe partagé, utilisé aussi bien par les patrons que par les règles', () => {
  assert.deepEqual(plusSpecifiques([{ v: 1 }, { v: 3 }, { v: 2 }], (x) => x.v), [{ v: 3 }]);
  assert.deepEqual(plusSpecifiques([{ v: 3 }, { v: 3 }], (x) => x.v), [{ v: 3 }, { v: 3 }], 'égalité : les deux sont rendus, pas un choix arbitraire');
});

test('apprendreRelation : un mot totalement nouveau devient une information cherchable', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  // « ma » suffit à situer le sujet ; sans « voiture » comme relation connue, c'est PARTIEL, pas incompris.
  assert.equal(comprendre('Quelle est ma voiture ?', { lexique: e.lexique }).etat, PARTIEL);
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  const c = comprendre('Quelle est ma voiture ?', { lexique: e.lexique });
  assert.equal(c.sujet, 'moi');
  assert.equal(c.relation, 'voiture');
});

test('apprendrePropriete : persiste et devient disponible pour le moteur de règles', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  assert.equal(e.proprietes.get('voiture').get('genre'), 'feminin');
  e = await chargerEsprit(m); // persistance après redémarrage
  assert.equal(e.proprietes.get('voiture').get('genre'), 'feminin', 'la propriété survit au rechargement depuis la base');
});

test('apprendreRegle : réapprendre les MÊMES conditions remplace la règle (version), garde l’historique', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  const r1 = await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  assert.equal(r1.objet.statut, 'validee');
  assert.equal(r1.objet.precedente, null);
  const r2 = await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'la' }); // correction
  assert.equal(r2.objet.precedente, r1.objet.id, 'la nouvelle version pointe vers l’ancienne : historique conservé');
  e = await chargerEsprit(m);
  const actives = e.regles.filter((r) => r.statut === 'validee' && r.role === 'possessif_toi');
  assert.equal(actives.length, 1, 'une seule règle active pour ce rôle/ces conditions après redémarrage');
  assert.equal(actives[0].resultat, 'la');
  assert.equal(e.regles.find((r) => r.id === r1.objet.id).statut, 'remplacee', 'l’ancienne reste en base, marquée remplacée — jamais supprimée');
});

test('apprendreRegle : DEUX règles à conditions différentes ne se remplacent pas, elles cohabitent', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton' });
  assert.equal(e.regles.filter((r) => r.statut === 'validee').length, 2);
});

test('signatureConditions : stable quel que soit l’ordre des conditions', () => {
  assert.equal(
    signatureConditions([{ propriete: 'genre', valeur: 'feminin' }, { propriete: 'nombre', valeur: 'singulier' }]),
    signatureConditions([{ propriete: 'nombre', valeur: 'singulier' }, { propriete: 'genre', valeur: 'feminin' }]),
  );
});

test('LE TEST DÉCISIF v0.10 — règle + propriété apprises séparément, combinées sur un mot jamais associé aux deux, après redémarrage', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);

  // La règle est apprise en enseignant une phrase sur COULEUR — jamais sur voiture.
  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta', exemple: 'ta couleur' });
  const patron = await apprendrePatron(e, {
    correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true,
  });
  assert.equal(patron.objet.gabarit, '{possessif} {relation}, c’est {valeur}.', 'le possessif appris est {possessif}, pas figé « Ta »');

  // Séparément : voiture est déclarée, on lui donne SA propriété, et un fait — jamais liés à « ta ».
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' });

  // Garantie vérifiable : « voiture » n’apparaît nulle part dans la règle qui va s’appliquer.
  const regleActive = e.regles.find((r) => r.role === 'possessif_toi' && r.statut === 'validee');
  assert.ok(!JSON.stringify(regleActive).toLowerCase().includes('voiture'), 'la règle n’a jamais mentionné « voiture »');

  // REDÉMARRAGE COMPLET.
  e = await chargerEsprit(m);

  const couleur = repondre(e, 'Quelle est ma couleur ?');
  assert.match(couleur.texte, /^ta couleur/i, 'ce qui a été montré directement fonctionne toujours');

  const transfert = repondre(e, 'Quelle est ma voiture ?');
  assert.match(transfert.texte, /^ta voiture/i,
    'TRANSFERT : composition règle+propriété jamais enseignée ensemble, après redémarrage');
  assert.equal(transfert.regleUtilisee.id, regleActive.id, 'c’est bien la règle apprise sur « couleur » qui a servi ici');
});

test('contrôle négatif : un mot masculin ne déclenche jamais la règle du féminin', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  await apprendreRelation(e, { mot: 'fils', relation: 'fils' });
  await apprendrePropriete(e, { mot: 'fils', propriete: 'genre', valeur: 'masculin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton' });
  e = await chargerEsprit(m);
  const r = repondre(e, 'Quel est mon fils ?');
  assert.match(r.texte, /^ton fils/i);
  assert.ok(!/^ta /i.test(r.texte), '« ta » ne fuit jamais vers un mot masculin');
});

test('aucune règle disponible : réponse honnête, jamais une invention', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  // « chapeau » : relation connue, fait connu, mais AUCUNE propriété donc aucune règle ne peut s'appliquer.
  await apprendreRelation(e, { mot: 'chapeau', relation: 'chapeau' });
  await apprendreFait(e, { sujet: 'moi', relation: 'chapeau', valeur: 'un feutre' });
  e = await chargerEsprit(m);
  const r = repondre(e, 'Quel est mon chapeau ?');
  assert.equal(r.texte, PHRASE_NE_SAIS_PAS_DIRE);
  assert.equal(r.regleManquante, true);
});

test('conflit de règles à égale spécificité : jamais de choix arbitraire, c’est dit explicitement', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreRelation(e, { mot: 'robot', relation: 'robot' });
  await apprendrePropriete(e, { mot: 'robot', propriete: 'genre', valeur: 'feminin' });
  await apprendrePropriete(e, { mot: 'robot', propriete: 'forme', valeur: 'ronde' });
  await apprendreFait(e, { sujet: 'moi', relation: 'robot', valeur: 'Orbe' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'forme', valeur: 'ronde' }], resultat: 'sa' });
  await apprendrePatron(e, { correction: 'Ta robot, c’est Orbe.', sujet: 'moi', relation: 'robot', portee: 'toutes', dynamiserPossessif: true });
  e = await chargerEsprit(m);
  const r = repondre(e, 'Quel est mon robot ?');
  assert.equal(r.texte, PHRASE_CONFLIT);
  assert.equal(r.conflit, true);
  assert.equal(r.candidats.length, 2);
});

test('isolement : les tables v0.10 vivent dans la même base isolée, toujours séparée de la mémoire réelle', async () => {
  const { TABLES, NOM_BASE } = await import('../app/langage/connaissances.js');
  assert.ok(TABLES.includes('proprietes') && TABLES.includes('regles'));
  assert.equal(NOM_BASE, 'naissance-langage');
});

// --- v0.10.1 : deux façons de dire à égale spécificité ne sont jamais choisies au hasard ---
test('conflit entre deux façons de dire générales : jamais résolu en silence, jamais choisi par ordre d’apprentissage', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  // Le patron v0.9 (déjà en place chez Christophe) puis un nouveau patron v0.10, tout aussi général.
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  await apprendrePatron(e, { correction: "Ton fils s'appelle Atem.", sujet: 'moi', relation: 'fils', portee: 'toutes' });
  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  e = await chargerEsprit(m);
  const r = repondre(e, 'Quelle est ma couleur ?');
  assert.equal(r.conflitPatron, true, 'détecté comme un vrai conflit, pas une réponse fausse silencieuse');
  assert.match(r.texte, /se contredisent/);
  assert.doesNotMatch(r.texte, /Ton couleur/, 'jamais la réponse bancale qu’aurait donné un choix par ordre d’apprentissage');
});

test('deux façons de dire à égale spécificité mais IDENTIQUES : ce n’est pas un conflit', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendrePatron(e, { correction: 'La couleur est bleu.', sujet: 'moi', relation: 'couleur' });
  const r = repondre(e, 'Quelle est ma couleur ?');
  assert.equal(r.conflitPatron, undefined);
  assert.equal(r.texte, 'La couleur est {valeur}.'.replace('{valeur}', 'bleu'));
});

// --- v0.11 : correctif de normalisation (accent/casse) + canal pédagogique ---
import { normaliserTexte } from '../app/langage/regles.js';

test('correctif : une propriété et une règle qui diffèrent seulement par l’accent ou la casse se rejoignent quand même', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'Féminin' }); // majuscule + accent
  await apprendreRegle(e, { role: 'POSSESSIF_TOI', conditions: [{ propriete: 'Genre', valeur: 'feminin' }], resultat: 'ta' }); // casse/accent différents des deux côtés
  const r = appliquerRegles(e.regles, { role: 'possessif_toi', proprietesDuMot: e.proprietes.get('couleur') });
  assert.equal(r.resultat, 'ta', 'la règle se déclenche malgré l’écart d’accent et de casse — plus d’échec silencieux');
});

test('correctif : le résultat produit garde son orthographe exacte, seule la comparaison est normalisée', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  const r = await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'féminin' }], resultat: 'Ta' });
  assert.equal(r.objet.resultat, 'Ta', 'le résultat n’est jamais mis en minuscule ni dépouillé de ses accents : il sert à produire du texte, pas à comparer');
});

import { extraireLecon, apercuLecon, TYPES_LECON } from '../app/langage/lecon.js';

const LECON_ABSURDE = {
  relation: 'Mot : xyzz désigne grbl.',
  fait: 'Fait : xyzz / grbl / zorx.',
  propriete: 'Propriété : xyzz / grbl / zorx.',
  regle: 'Pour xyzz : si grbl vaut zorx, on dit qud.',
};

// Dispatch minimal, reproduisant exactement ce que fait l'écran après confirmation : réutilise
// TELLES QUELLES les fonctions d'apprentissage existantes, aucune n'est réécrite pour v0.12.
async function confirmer(esprit, { type, donnees }, texteLecon) {
  if (type === 'relation') return apprendreRelation(esprit, donnees);
  if (type === 'fait') return apprendreFait(esprit, donnees);
  if (type === 'propriete') return apprendrePropriete(esprit, { ...donnees, origine: 'apprise-lecon' });
  if (type === 'regle') return apprendreRegle(esprit, { ...donnees, origine: 'apprise-lecon', exemple: texteLecon });
  throw new Error('type inconnu');
}

test('extraction correcte des quatre types, sur un exemple réel', () => {
  assert.deepEqual(extraireLecon('Mot : voiture désigne voiture.'),
    { type: 'relation', donnees: { mot: 'voiture', relation: 'voiture' } });
  assert.deepEqual(extraireLecon('Fait : moi / voiture / une Twingo.'),
    { type: 'fait', donnees: { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' } });
  assert.deepEqual(extraireLecon('Propriété : voiture / genre / féminin.'),
    { type: 'propriete', donnees: { mot: 'voiture', propriete: 'genre', valeur: 'féminin' } });
  assert.deepEqual(extraireLecon('Pour possessif_toi : si genre vaut féminin, on dit ta.'),
    { type: 'regle', donnees: { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'féminin' }], resultat: 'ta' } });
});

test('vocabulaire absurde : les quatre types reconnaissent la STRUCTURE, jamais le contenu', async () => {
  for (const [type, lecon] of Object.entries(LECON_ABSURDE)) {
    const extrait = extraireLecon(lecon);
    assert.equal(extrait.type, type, `« ${lecon} » reconnue comme ${type}`);
    assert.ok(Object.values(extrait.donnees).some((v) => JSON.stringify(v).includes('xyzz') || JSON.stringify(v).includes('grbl')
      || JSON.stringify(v).includes('zorx') || JSON.stringify(v).includes('qud')), 'le contenu absurde est bien extrait, pas rejeté');
  }
  // Preuve directe qu'aucun mot du domaine n'est reconnu spécialement, pour les QUATRE types.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = readFileSync(fileURLToPath(new URL('../app/langage/lecon.js', import.meta.url)), 'utf8').toLowerCase();
  for (const mot of ['genre', 'féminin', 'feminin', 'masculin', 'possessif', "'ta'", "'ton'", 'voiture', 'couleur']) {
    assert.ok(!source.includes(mot), `« ${mot} » n'apparaît nulle part dans lecon.js`);
  }
});

test('une phrase ne peut jamais correspondre à plusieurs types (mots-clés de tête distincts)', () => {
  const cas = Object.values(LECON_ABSURDE);
  for (const lecon of cas) {
    const correspondances = Object.keys(TYPES_LECON).filter((type) => {
      const r = extraireLecon(lecon);
      return r && r.type === type;
    });
    assert.equal(correspondances.length, 1, `« ${lecon} » ne correspond qu'à un seul type`);
  }
  // Vérification structurelle supplémentaire : les quatre mots-clés de tête sont bien distincts.
  const tetes = new Set(Object.values(LECON_ABSURDE).map((l) => l.split(/[:\s]/)[0].toLowerCase()));
  assert.equal(tetes.size, 4);
});

test('leçon mal formée ou libre : refusée proprement, jamais devinée, pour les quatre types', () => {
  assert.equal(extraireLecon('Bonjour, comment vas-tu ?'), null);
  assert.equal(extraireLecon('Mot : voiture ressemble à un véhicule.'), null, 'sans « désigne » : refusée');
  assert.equal(extraireLecon('Fait : moi et voiture et une Twingo.'), null, 'sans les barres obliques : refusée');
  assert.equal(extraireLecon('Propriété voiture genre féminin'), null, 'sans le « : » ni les barres : refusée');
  assert.equal(extraireLecon('Pour possessif_toi : si genre vaut féminin, alors ta.'), null, 'sans « on dit » : refusée');
  assert.equal(extraireLecon('Quand un nom féminin appartient à la personne à qui tu parles, on utilise « ta ».'), null, 'phrase libre : refusée');
  assert.equal(extraireLecon(''), null);
  assert.equal(extraireLecon('Mot : désigne .'), null, 'emplacements vides : refusée');
});

test('confirmation → dispatch vers la fonction d’apprentissage existante correspondante, pour chaque type', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);

  await confirmer(e, extraireLecon('Mot : voiture désigne voiture.'));
  assert.equal(e.lexique.voiture.relation, 'voiture', 'apprendreRelation a bien été appelée');

  await confirmer(e, extraireLecon('Fait : moi / voiture / une Twingo.'));
  assert.equal(e.faits.get('moi|voiture').valeur, 'une Twingo', 'apprendreFait a bien été appelée');

  await confirmer(e, extraireLecon('Propriété : voiture / genre / féminin.'));
  assert.equal(e.proprietes.get('voiture').get('genre'), 'feminin', 'apprendrePropriete a bien été appelée (accent normalisé comme d’habitude)');

  const lecon = 'Pour possessif_toi : si genre vaut féminin, on dit ta.';
  const r = await confirmer(e, extraireLecon(lecon), lecon);
  assert.equal(r.objet.origine, 'apprise-lecon', 'apprendreRegle a bien été appelée, avec la bonne provenance');
  assert.equal(r.objet.exemples[0], lecon);
});

for (const [type, lecon] of Object.entries(LECON_ABSURDE)) {
  test(`annulation (${type}) : aucune écriture si la confirmation n'a jamais lieu`, async () => {
    const m = magasinMemoireVive();
    const e = await chargerEsprit(m);
    const extrait = extraireLecon(lecon);
    assert.ok(extrait, 'la leçon est bien reconnue et prête à être confirmée');
    assert.ok(apercuLecon(extrait), 'un aperçu est disponible avant toute écriture');
    // Le mécanisme d'annulation, c'est simplement de ne jamais appeler confirmer().
    assert.equal((await m.lireTout('faits')).length, 0);
    assert.equal((await m.lireTout('proprietes')).length, 0);
    assert.equal((await m.lireTout('regles')).length, 0);
    assert.equal(Object.keys(e.lexique).length, tailleBagage().mots, 'le lexique n’a pas grossi');
  });
}

test('persistance après redémarrage, pour les quatre types', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await confirmer(e, extraireLecon('Mot : voiture désigne voiture.'));
  await confirmer(e, extraireLecon('Fait : moi / voiture / une Twingo.'));
  await confirmer(e, extraireLecon('Propriété : voiture / genre / féminin.'));
  const lecon = 'Pour possessif_toi : si genre vaut féminin, on dit ta.';
  await confirmer(e, extraireLecon(lecon), lecon);

  e = await chargerEsprit(m); // redémarrage : tout relu depuis la base, rien gardé en mémoire vive
  assert.equal(e.lexique.voiture.relation, 'voiture');
  assert.equal(e.faits.get('moi|voiture').valeur, 'une Twingo');
  assert.equal(e.proprietes.get('voiture').get('genre'), 'feminin');
  assert.equal(e.regles.find((r) => r.origine === 'apprise-lecon' && r.statut === 'validee').resultat, 'ta');
});

test('LE SCÉNARIO FINAL v0.12 — relation, fait, propriété et règle reçus PAR LEÇON ; le patron reste un prérequis appris séparément', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);

  // Prérequis explicite, appris avec le mécanisme ACTUEL (hors canal, comme convenu) : la façon
  // de dire. Sans lui, aucune phrase ne saurait utiliser le possessif calculé — ce n'est pas ce
  // qu'on teste ici, mais sans quoi le scénario échouerait pour une raison étrangère au sujet.
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });

  // À partir d'ici, tout passe par le canal pédagogique — plus aucun formulaire interne.
  const lecons = [
    'Mot : couleur désigne couleur.',
    'Propriété : couleur / genre / féminin.',
    'Pour possessif_toi : si genre vaut féminin, on dit ta.',
  ];
  for (const l of lecons) await confirmer(e, extraireLecon(l), l);
  assert.match(repondre(e, 'Quelle est ma couleur ?').texte, /^ta couleur/i, 'fonctionne sur couleur, entièrement enseigné par leçon (sauf le patron, prérequis)');

  const leconsVoiture = [
    'Mot : voiture désigne voiture.',
    'Fait : moi / voiture / une Twingo.',
    'Propriété : voiture / genre / féminin.',
  ];
  for (const l of leconsVoiture) await confirmer(e, extraireLecon(l), l);
  assert.ok(!leconsVoiture.some((l) => l.toLowerCase().includes('ta ')), 'garantie vérifiable : « ta » et « voiture » ne sont jamais associés dans ces leçons');

  // REDÉMARRAGE COMPLET.
  e = await chargerEsprit(m);
  const transfert = repondre(e, 'Quelle est ma voiture ?');
  assert.match(transfert.texte, /^ta voiture/i,
    'Relation, fait, propriété et règle ont été reçus par le canal pédagogique. Le patron de formulation était un prérequis appris séparément.');
});

test('non-régression : les patrons restent délibérément hors du canal pédagogique', () => {
  assert.equal(Object.keys(TYPES_LECON).includes('patron'), false);
  assert.equal(extraireLecon('Ton fils s’appelle Atem.'), null, 'une correction de patron n’est reconnue par aucun des quatre gabarits');
});

// --- v0.13 : Gemini comme professeur ponctuel — jamais fiable par défaut ---
import { construireContrat, demanderEnseignement } from '../app/langage/gemini-professeur.js';
import { reconstruireLeconRegle } from '../app/langage/lecon.js';

test('construireContrat : bâti depuis TYPES_LECON, jamais recopié à la main — les quatre formes sont présentes', () => {
  const c = construireContrat({ sujet: 'le possessif masculin' });
  for (const forme of Object.values(TYPES_LECON)) assert.ok(c.includes(forme), `« ${forme} » figure dans le contrat`);
  assert.match(c, /le possessif masculin/);
  assert.match(c, /"lecons"/);
  assert.match(c, /"note"/);
});

test('construireContrat : les exemples connus, quand fournis, apparaissent dans le contrat', () => {
  const c = construireContrat({ sujet: 'x', exemplesConnus: ['Pour possessif_toi : si genre vaut féminin, on dit ta.'] });
  assert.match(c, /si genre vaut féminin, on dit ta/);
  const sansExemple = construireContrat({ sujet: 'x' });
  assert.doesNotMatch(sansExemple, /féminin/);
});

test('reconstruireLeconRegle : reconstruit depuis les champs structurés, pas depuis un texte éventuellement absent', () => {
  const regle = { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'féminin' }], resultat: 'ta', exemples: [] };
  assert.equal(reconstruireLeconRegle(regle), 'Pour possessif_toi : si genre vaut féminin, on dit ta.');
});

test('demanderEnseignement : ligne valide reconnue exactement comme une leçon tapée à la main', async () => {
  const appelerGemini = async () => ({ lecons: ['Pour possessif_toi : si genre vaut masculin, on dit ton.'], note: 'Note pour Christophe.' });
  const r = await demanderEnseignement({ sujet: 'le possessif masculin', appelerGemini });
  assert.equal(r.reconnues.length, 1);
  assert.equal(r.reconnues[0].extrait.type, 'regle');
  assert.deepEqual(r.reconnues[0].extrait.donnees, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton' });
  assert.equal(r.note, 'Note pour Christophe.');
  assert.equal(r.rejetees.length, 0);
});

test('demanderEnseignement : ligne invalide refusée, sans bloquer les lignes valides du même lot', async () => {
  const appelerGemini = async () => ({
    lecons: ['Pour possessif_toi : si genre vaut masculin, on dit ton.', 'Une explication libre, pas un gabarit.'],
    note: null,
  });
  const r = await demanderEnseignement({ sujet: 'x', appelerGemini });
  assert.equal(r.reconnues.length, 1);
  assert.deepEqual(r.rejetees, ['Une explication libre, pas un gabarit.']);
});

test('demanderEnseignement : note bavarde jamais confondue avec une leçon, jamais apprenable', async () => {
  const appelerGemini = async () => ({ lecons: ['Pour possessif_toi : si genre vaut masculin, on dit ton.'], note: 'Cette règle vient du français standard, avec quelques exceptions régionales à noter.' });
  const r = await demanderEnseignement({ sujet: 'x', appelerGemini });
  assert.equal(r.reconnues.length, 1, 'la note ne se retrouve jamais parmi les candidats à apprendre');
  assert.equal(r.note.includes('exceptions régionales'), true);
});

test('demanderEnseignement : tableau vide — aucune leçon, sans erreur', async () => {
  const r = await demanderEnseignement({ sujet: 'x', appelerGemini: async () => ({ lecons: [], note: 'Rien à ajouter pour l’instant.' }) });
  assert.deepEqual(r.reconnues, []);
  assert.deepEqual(r.rejetees, []);
  assert.equal(r.note, 'Rien à ajouter pour l’instant.');
});

test('demanderEnseignement : JSON valide mais pédagogiquement inutilisable (pas de « lecons ») — jamais une invention', async () => {
  const r = await demanderEnseignement({ sujet: 'x', appelerGemini: async () => ({ texte: 'oups, mauvaise forme' }) });
  assert.deepEqual(r.reconnues, []);
  assert.deepEqual(r.rejetees, []);
});

test('demanderEnseignement : une panne du professeur (réseau, pas de modèle configuré) n’est jamais avalée en silence', async () => {
  await assert.rejects(
    () => demanderEnseignement({ sujet: 'x', appelerGemini: async () => { throw new Error("Aucun modèle externe n'est configuré."); } }),
    /Aucun modèle externe/,
  );
});

test('LE TEST DÉCISIF v0.13 — enseignement reçu de Gemini, confirmé, transféré, redémarré, UTILISÉ SANS NOUVEL APPEL', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);

  // Prérequis, préparés en dehors de tout appel à Gemini — exactement comme le patron en v0.12.
  await apprendreRelation(e, { mot: 'stylo', relation: 'stylo' });
  await apprendreFait(e, { sujet: 'moi', relation: 'stylo', valeur: 'un Bic' });
  await apprendrePropriete(e, { mot: 'stylo', propriete: 'genre', valeur: 'masculin' });
  await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });

  // UN appel à Gemini, compté précisément — jamais plus.
  let appels = 0;
  const appelerGemini = async () => { appels++; return { lecons: ['Pour possessif_toi : si genre vaut masculin, on dit ton.'], note: 'En français, « ton » précède un nom masculin.' }; };
  const { reconnues } = await demanderEnseignement({ sujet: 'le possessif masculin', appelerGemini });
  assert.equal(reconnues.length, 1);
  assert.equal(appels, 1);

  // Confirmation explicite (comme le fera l'écran), avec la bonne provenance tracée.
  const r = await ecrireConnaissance(e, reconnues[0].extrait, { origine: 'apprise-gemini' });
  assert.equal(r.objet.origine, 'apprise-gemini');

  // Garantie de non-triche : « stylo » n'apparaît nulle part dans ce que Gemini a réellement transmis.
  assert.ok(!JSON.stringify(reconnues[0].extrait).toLowerCase().includes('stylo'));

  // REDÉMARRAGE COMPLET.
  e = await chargerEsprit(m);

  const reponse = repondre(e, 'Quel est mon stylo ?');
  assert.match(reponse.texte, /^ton stylo/i, 'utilise la règle apprise de Gemini, composée avec une propriété apprise séparément');
  assert.equal(reponse.regleUtilisee.origine, 'apprise-gemini');
  assert.equal(appels, 1, 'AUCUN nouvel appel à Gemini au moment de répondre : la connaissance est locale');
});

// Petit dispatcher local, miroir de celui d'ecran.js, pour tester le chemin de confirmation
// indépendamment de l'écran (mêmes fonctions d'apprentissage, jamais réécrites).
async function ecrireConnaissance(e, { type, donnees }, { origine, exemple } = {}) {
  if (type === 'relation') return apprendreRelation(e, donnees);
  if (type === 'fait') return apprendreFait(e, donnees);
  if (type === 'propriete') return apprendrePropriete(e, { ...donnees, origine: origine || 'apprise-christophe' });
  if (type === 'regle') return apprendreRegle(e, { ...donnees, origine: origine || 'apprise-christophe', exemple: exemple || null });
  throw new Error('type inconnu');
}

// --- v0.13.1 : retrait ciblé d'une seule façon de dire, sans « tout lui faire oublier » ---
import { oublierPatron } from '../app/langage/esprit.js';

test('oublierPatron : retire UNE SEULE façon de dire, jamais rien d’autre, et résout un conflit réel', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  const ancien = await apprendrePatron(e, { correction: "Ton fils s'appelle Atem.", sujet: 'moi', relation: 'fils', portee: 'toutes' });
  await apprendreRelation(e, { mot: 'stylo', relation: 'stylo' });
  await apprendrePropriete(e, { mot: 'stylo', propriete: 'genre', valeur: 'masculin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'stylo', valeur: 'un Bic' });
  await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton' });

  // Le conflit existe bel et bien : deux façons générales incompatibles.
  assert.equal(repondre(e, 'Quel est mon stylo ?').conflitPatron, true);

  const r = await oublierPatron(e, ancien.objet.id);
  assert.match(r.explication, /Ton \{relation\} s'appelle \{valeur\}/);

  // Plus de conflit : la bonne façon de dire s'applique seule.
  const apres = repondre(e, 'Quel est mon stylo ?');
  assert.equal(apres.conflitPatron, undefined);
  assert.match(apres.texte, /^ton stylo/i);

  // Persistance : après redémarrage, la façon de dire retirée reste absente.
  e = await chargerEsprit(m);
  assert.ok(!e.patrons.some((p) => p.id === ancien.objet.id));
  assert.equal(e.patrons.filter((p) => p.relation === '*' && p.gabarit.includes('possessif')).length, 1, 'la bonne façon de dire (possessif calculé) reste');
  assert.ok(!e.patrons.some((p) => p.gabarit.includes("s'appelle")), 'la façon de dire retirée ne réapparaît pas après redémarrage');
});

test('oublierPatron : une façon de dire inconnue est signalée, rien n’est modifié', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await assert.rejects(() => oublierPatron(e, 'patron-inexistant'), /Je ne connais pas/);
});

// --- v0.13.2 : réapprendre une façon de dire déjà connue ne crée jamais de doublon ---
test('apprendrePatron : réapprendre EXACTEMENT la même façon de dire ne crée pas de doublon', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'stylo', valeur: 'un Bic' });
  const r1 = await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });
  const r2 = await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });
  assert.equal(r1.objet.id, r2.objet.id, 'la deuxième fois renvoie la même façon de dire, sans en créer une autre');
  assert.match(r2.explication, /Je connais déjà cette façon de dire/);
  assert.equal(e.patrons.filter((p) => p.gabarit === r1.objet.gabarit).length, 1, 'un seul exemplaire en mémoire, même après avoir « réappris » trois fois');
  await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });
  assert.equal(e.patrons.filter((p) => p.gabarit === r1.objet.gabarit).length, 1);
});

test('apprendrePatron : deux corrections qui produisent le MÊME gabarit ne dupliquent pas non plus', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  await apprendreFait(e, { sujet: 'moi', relation: 'stylo', valeur: 'un Bic' });
  // Une correction différente en surface, mais qui donne exactement le même gabarit généralisé.
  const r = await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });
  assert.match(r.explication, /Je connais déjà cette façon de dire/);
  assert.equal(e.patrons.filter((p) => p.relation === '*' && p.sujet === 'moi').length, 1);
});

// --- v0.14 : retrait ciblé des connaissances, sans cascade, réversible ---
import { oublierFait, oublierPropriete, oublierRelation, oublierRegle } from '../app/langage/esprit.js';

test('CAS 1 — FAIT : retirer un seul fait, persistant après redémarrage, les autres intacts', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  const r = await oublierFait(e, { sujet: 'moi', relation: 'couleur' });
  assert.match(r.explication, /moi → couleur → bleu/);
  assert.equal(e.faits.has('moi|couleur'), false);
  assert.equal(e.faits.get('moi|fils').valeur, 'Atem');
  e = await chargerEsprit(m);
  assert.equal(e.faits.has('moi|couleur'), false);
  assert.equal(e.faits.get('moi|fils').valeur, 'Atem', 'le fait voisin est toujours là après redémarrage');
});

test('CAS 2 — PROPRIÉTÉ : retirer une seule propriété, les autres intactes, persistant', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'nombre', valeur: 'singulier' });
  await apprendrePropriete(e, { mot: 'stylo', propriete: 'genre', valeur: 'masculin' });
  await oublierPropriete(e, { mot: 'voiture', propriete: 'genre' });
  assert.equal(e.proprietes.get('voiture').has('genre'), false);
  assert.equal(e.proprietes.get('voiture').get('nombre'), 'singulier');
  assert.equal(e.proprietes.get('stylo').get('genre'), 'masculin');
  e = await chargerEsprit(m);
  assert.equal(e.proprietes.get('voiture').has('genre'), false);
  assert.equal(e.proprietes.get('voiture').get('nombre'), 'singulier');
  assert.equal(e.proprietes.get('stylo').get('genre'), 'masculin', 'les propriétés voisines survivent au redémarrage');
});

test('CAS 3 — RELATION : retirer un seul mot, les autres relations restent utilisables, persistant', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await apprendreRelation(e, { mot: 'stylo', relation: 'stylo' });
  await oublierRelation(e, 'voiture');
  assert.equal(comprendre('Quelle est ma voiture ?', { lexique: e.lexique }).relation, null);
  assert.equal(comprendre('Quel est mon stylo ?', { lexique: e.lexique }).relation, 'stylo', 'la relation voisine reste comprise');
  e = await chargerEsprit(m);
  assert.equal(e.lexique.voiture, undefined);
  assert.equal(e.lexique.stylo.relation, 'stylo');
});

test('un mot du bagage de départ ne peut pas être oublié (n’y survivrait pas à un redémarrage)', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await assert.rejects(() => oublierRelation(e, 'fils'), /bagage de départ/);
  assert.ok(e.lexique.fils, 'toujours là après la tentative refusée');
});

test('CAS 4 — RÈGLE : désactiver une seule règle, les autres restent actives, historique conservé', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  const feminin = await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton' });
  const r = await oublierRegle(e, feminin.objet.id);
  assert.match(r.explication, /désactivé/);
  assert.equal(e.regles.find((x) => x.id === feminin.objet.id).statut, 'desactivee');
  assert.equal(appliquerRegles(e.regles, { role: 'possessif_toi', proprietesDuMot: new Map([['genre', 'feminin']]) }).resultat, null, 'plus utilisée');
  assert.equal(appliquerRegles(e.regles, { role: 'possessif_toi', proprietesDuMot: new Map([['genre', 'masculin']]) }).resultat, 'ton', 'l’autre règle reste active');
  e = await chargerEsprit(m);
  const relue = e.regles.find((x) => x.id === feminin.objet.id);
  assert.equal(relue.statut, 'desactivee', 'le statut désactivé persiste après redémarrage');
  assert.deepEqual(relue.conditions, [{ propriete: 'genre', valeur: 'feminin' }], 'aucune donnée perdue : ni conditions ni résultat');
});

test('CAS 5 — PATRON : oublierPatron continue de fonctionner sans régression', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  const p = await apprendrePatron(e, { correction: "Ton fils s'appelle Atem.", sujet: 'moi', relation: 'fils' });
  const r = await oublierPatron(e, p.objet.id);
  assert.match(r.explication, /oublié cette façon de dire/);
  assert.equal(e.patrons.some((x) => x.id === p.objet.id), false);
});

test('CAS 6 — COMPOSITION : une connaissance retirée n’influence plus la réponse ; la voisine fonctionne toujours', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' });
  await apprendreRelation(e, { mot: 'stylo', relation: 'stylo' });
  await apprendrePropriete(e, { mot: 'stylo', propriete: 'genre', valeur: 'masculin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'stylo', valeur: 'un Bic' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'masculin' }], resultat: 'ton' });
  await apprendrePatron(e, { correction: 'Ta voiture, c’est une Twingo.', sujet: 'moi', relation: 'voiture', portee: 'toutes', dynamiserPossessif: true });
  assert.match(repondre(e, 'Quelle est ma voiture ?').texte, /^ta voiture/i);
  assert.match(repondre(e, 'Quel est mon stylo ?').texte, /^ton stylo/i);

  await oublierFait(e, { sujet: 'moi', relation: 'voiture' });
  assert.equal(repondre(e, 'Quelle est ma voiture ?').texte, 'Je ne sais pas.', 'plus de réponse pour voiture');
  assert.match(repondre(e, 'Quel est mon stylo ?').texte, /^ton stylo/i, 'stylo, non touché, continue de fonctionner');
});

test('CAS 7 — RÉVERSIBILITÉ : retirer une relation, réenseigner UNIQUEMENT la relation, le fait déjà là redevient utilisable sans le retaper', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await apprendreFait(e, { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' });
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await oublierRelation(e, 'voiture');
  // « ma » suffit à situer le sujet même sans relation connue : c'est PARTIEL, pas incompris
  // (même constat déjà fait pendant la validation v0.10).
  assert.equal(comprendre('Quelle est ma voiture ?', { lexique: e.lexique }).etat, PARTIEL);
  // Le fait et la propriété n'ont pas bougé, ils sont juste devenus inaccessibles.
  assert.equal(e.faits.get('moi|voiture').valeur, 'une Twingo');
  assert.equal(e.proprietes.get('voiture').get('genre'), 'feminin');
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' }); // on ne retape ni le fait ni la propriété
  e = await chargerEsprit(m);
  const r = repondre(e, 'Quelle est ma voiture ?');
  assert.equal(r.fait.valeur, 'une Twingo', 'immédiatement réutilisable, sans avoir rien retapé d’autre que la relation');
});

test('CAS 8 — HISTORIQUE : une règle désactivée reste lisible dans la mémoire, avec son statut', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  const r = await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await oublierRegle(e, r.objet.id);
  e = await chargerEsprit(m);
  const relue = e.regles.find((x) => x.id === r.objet.id);
  assert.ok(relue, 'toujours présente en mémoire, jamais supprimée');
  assert.equal(relue.statut, 'desactivee');
  assert.equal(relue.resultat, 'ta', 'contenu intact, consultable');
});

test('une règle déjà remplacée ou déjà désactivée ne peut pas être « désactivée » une deuxième fois', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  const r1 = await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'la' }); // remplace r1
  await assert.rejects(() => oublierRegle(e, r1.objet.id), /Je ne connais pas cette règle active/);
});
