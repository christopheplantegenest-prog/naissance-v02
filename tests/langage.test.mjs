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

import { extraireLecon, FORME_LECON } from '../app/langage/lecon.js';

test('canal pédagogique — extraction purement structurelle : le vocabulaire absurde marche IDENTIQUEMENT au vrai', async () => {
  const reel = extraireLecon('Pour possessif_toi : si genre vaut féminin, on dit ta.');
  const absurde = extraireLecon('Pour xyzz : si grbl vaut zorx, on dit qud.');
  assert.deepEqual(Object.keys(reel), Object.keys(absurde), 'même structure extraite, quel que soit le contenu');
  assert.deepEqual(absurde, { role: 'xyzz', conditions: [{ propriete: 'grbl', valeur: 'zorx' }], resultat: 'qud' });
  // Preuve directe qu'aucun mot grammatical n'est reconnu spécialement : aucune des chaînes
  // « genre », « féminin », « masculin », « possessif », « ta », « ton » n'apparaît dans le code.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const chemin = fileURLToPath(new URL('../app/langage/lecon.js', import.meta.url));
  const source = readFileSync(chemin, 'utf8');
  for (const mot of ['genre', 'féminin', 'feminin', 'masculin', 'possessif', "'ta'", "'ton'"]) {
    assert.ok(!source.toLowerCase().includes(mot), `« ${mot} » n'apparaît nulle part dans lecon.js`);
  }
});

test('canal pédagogique — une leçon mal formée est refusée proprement, jamais devinée', () => {
  assert.equal(extraireLecon('Bonjour, comment vas-tu ?'), null);
  assert.equal(extraireLecon('Pour possessif_toi : si genre vaut féminin, alors ta.'), null, 'sans « on dit » : refusée');
  assert.equal(extraireLecon('Quand un nom féminin appartient à la personne à qui tu parles, on utilise « ta ».'), null, 'phrase libre : refusée, pas devinée');
  assert.equal(extraireLecon(''), null);
  assert.equal(extraireLecon('Pour : si vaut , on dit .'), null, 'emplacements vides : refusée');
});

test('canal pédagogique — tolère la ponctuation finale et les espaces, sans changer la structure reconnue', () => {
  assert.deepEqual(extraireLecon('Pour role2 : si nombre vaut plusieurs, on dit des'),
    { role: 'role2', conditions: [{ propriete: 'nombre', valeur: 'plusieurs' }], resultat: 'des' });
  assert.deepEqual(extraireLecon('  pour   ROLE  :  SI valeur vaut  test ,  ON DIT  ok . '),
    { role: 'ROLE', conditions: [{ propriete: 'valeur', valeur: 'test' }], resultat: 'ok' });
});

test('FORME_LECON documente le gabarit exact attendu (utile pour l’écran)', () => {
  assert.match(FORME_LECON, /Pour.*si.*vaut.*on dit/);
});

test('LE TEST DÉCISIF v0.11 — une règle arrivée par LEÇON PÉDAGOGIQUE, composée et transférée après redémarrage', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);

  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });

  // La règle n'est PAS construite via le formulaire structuré : elle arrive par une phrase.
  const lecon = 'Pour possessif_toi : si genre vaut féminin, on dit ta.';
  const extrait = extraireLecon(lecon);
  assert.ok(extrait, 'la leçon est reconnue');
  // Étape de confirmation (simulée comme le fera l'écran) : rien n'est enregistré avant.
  assert.equal(e.regles.filter((r) => r.statut === 'validee').length, 0);
  const appris = await apprendreRegle(e, { ...extrait, origine: 'apprise-lecon', exemple: lecon });
  assert.equal(appris.objet.origine, 'apprise-lecon');
  assert.equal(appris.objet.exemples[0], lecon, 'la phrase de la leçon reste tracée comme exemple');

  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });

  // Séparément : voiture, jamais associée à « ta » nulle part, ni dans la leçon ni ailleurs.
  await apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await apprendreFait(e, { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' });
  assert.ok(!lecon.toLowerCase().includes('voiture'), 'garantie vérifiable : « voiture » n’apparaît pas dans la leçon elle-même');

  // REDÉMARRAGE COMPLET.
  e = await chargerEsprit(m);

  const couleur = repondre(e, 'Quelle est ma couleur ?');
  assert.match(couleur.texte, /^ta couleur/i);
  const transfert = repondre(e, 'Quelle est ma voiture ?');
  assert.match(transfert.texte, /^ta voiture/i, 'TRANSFERT : règle apprise par LEÇON, composée avec une propriété séparée, sur un cas jamais lié aux deux');
  assert.equal(transfert.regleUtilisee.origine, 'apprise-lecon');
});

test('canal pédagogique — deuxième leçon, sur une notion différente, MÊME code, vocabulaire inventé', async () => {
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  // Rien à voir avec le possessif : un accord de nombre imaginaire, pour prouver la généralité.
  const lecon = 'Pour marque_nombre : si nombre vaut plusieurs, on dit floop.';
  const extrait = extraireLecon(lecon);
  assert.deepEqual(extrait, { role: 'marque_nombre', conditions: [{ propriete: 'nombre', valeur: 'plusieurs' }], resultat: 'floop' });
  await apprendreRegle(e, { ...extrait, origine: 'apprise-lecon', exemple: lecon });
  e = await chargerEsprit(m);
  const r = appliquerRegles(e.regles, { role: 'marque_nombre', proprietesDuMot: new Map([['nombre', 'plusieurs']]) });
  assert.equal(r.resultat, 'floop', 'même extracteur, même apprendreRegle, une notion grammaticale totalement différente');
});

test('canal pédagogique — annulation : rien n’est enregistré si la confirmation est refusée', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  const extrait = extraireLecon('Pour possessif_toi : si genre vaut féminin, on dit ta.');
  assert.ok(extrait);
  // On n'appelle simplement jamais apprendreRegle : c'est tout le mécanisme d'annulation.
  assert.equal((await m.lireTout('regles')).length, 0);
  assert.equal(e.regles.filter((r) => r.statut === 'validee').length, 0);
});
