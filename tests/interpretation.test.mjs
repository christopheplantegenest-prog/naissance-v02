// v0.16 — « Apprends que ma couleur est rouge. » : interprétation locale d'un cadre très étroit.
// Ces tests importent le VRAI module (app/langage/interpretation.js) et le VRAI moteur du langage ;
// aucun dispatcher « miroir ». Le chemin d'écriture réel (ecrireConnaissance de l'écran) est couvert
// dans ecrans-contrats.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estEnseignementNaturel, interpreterEnseignement } from '../app/langage/interpretation.js';
import { extraireLecon, apercuLecon } from '../app/langage/lecon.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';
import { magasinMemoireVive, cleFait } from '../app/langage/connaissances.js';
import {
  chargerEsprit, repondre, apprendreFait, apprendreRelation, apprendrePropriete, apprendreRegle, apprendrePatron,
} from '../app/langage/esprit.js';

const lex = LEXIQUE_DEPART;
const int = (t, l = lex) => interpreterEnseignement(t, { lexique: l });

test('déclencheur : « Apprends que » seulement, en tête de message', () => {
  assert.equal(estEnseignementNaturel('Apprends que ma couleur est rouge.'), true);
  assert.equal(estEnseignementNaturel('  apprends   que ma couleur est rouge'), true, 'casse et espaces tolérés');
  assert.equal(estEnseignementNaturel('Apprends que'), true, '« Apprends que » seul reçoit un refus clair, pas la conversation ordinaire');
  assert.equal(estEnseignementNaturel('Apprends : Fait : moi / couleur / bleu.'), false, 'la forme « Apprends : » garde son chemin');
  assert.equal(estEnseignementNaturel('Retiens que ma couleur est rouge.'), false, '« Retiens que » reste la mémoire générale');
  assert.equal(estEnseignementNaturel('Ma couleur est rouge.'), false);
  assert.equal(estEnseignementNaturel('Je voudrais que tu apprennes que ma couleur est rouge.'), false, 'jamais au milieu d’une phrase');
  assert.equal(estEnseignementNaturel('Quelle est ma couleur ?'), false);
  assert.equal(estEnseignementNaturel(''), false);
  assert.equal(estEnseignementNaturel(undefined), false);
});

test('message non concerné → null (aucune interprétation, aucune trace)', () => {
  for (const t of ['Retiens que ma couleur est rouge.', 'Ma couleur est rouge.', "J'ai un chat qui s'appelle Pixel", 'Quelle est ma couleur ?', 'Apprends : Fait : moi / couleur / bleu.']) {
    assert.equal(int(t), null, t);
  }
});

test('CAS DE RÉFÉRENCE : « Apprends que ma couleur est rouge. » → Fait : moi / couleur / rouge.', () => {
  const r = int('Apprends que ma couleur est rouge.');
  assert.equal(r.ok, true);
  assert.equal(r.phrase, 'Fait : moi / couleur / rouge.');
  assert.deepEqual(r.extrait, { type: 'fait', donnees: { sujet: 'moi', relation: 'couleur', valeur: 'rouge' } });
  assert.deepEqual([r.sujet, r.relation, r.valeur], ['moi', 'couleur', 'rouge']);
  assert.equal(apercuLecon(r.extrait), 'J\'ai compris : moi → couleur → rouge. C\'est correct ?', 'l’aperçu est exactement celui du canal existant');
});

test('la phrase canonique repasse par extraireLecon() avec exactement les mêmes données', () => {
  const r = int('Apprends que ma couleur est rouge.');
  assert.deepEqual(extraireLecon(r.phrase), r.extrait);
});

test('possessifs ma / mon / mes et copules est / sont', () => {
  const l = { ...lex, ...{ stylo: { role: 'relation', relation: 'stylo' }, crayons: { role: 'relation', relation: 'crayons' } } };
  assert.equal(int('Apprends que mon stylo est un Bic.', l).valeur, 'un Bic');
  assert.equal(int('Apprends que mes crayons sont des Staedtler.', l).valeur, 'des Staedtler');
  assert.equal(int('Apprends que ma ville est Paris.').valeur, 'Paris');
});

test('valeur LITTÉRALE : casse, accents et articles conservés ; ponctuation finale retirée', () => {
  assert.equal(int('Apprends que ma ville est Saint-Étienne.').valeur, 'Saint-Étienne');
  assert.equal(int('Apprends que ma couleur est le bleu').valeur, 'le bleu', 'aucun article retiré, rien deviné');
  assert.equal(int('Apprends que ma couleur est bleue.').valeur, 'bleue', 'aucun accord corrigé : c’est l’aperçu qui le montre');
  assert.equal(int('Apprends que ma couleur est rouge..').valeur, 'rouge', 'double point final : un seul retrait, aucune valeur « rouge. »');
  assert.equal(int('Apprends que ma couleur est rouge . ').valeur, 'rouge');
  assert.equal(int('Apprends que ma couleur est rouge…').valeur, 'rouge');
});

test('une relation apprise devient utilisable ; une relation alias est ramenée à sa relation', () => {
  const l = { ...lex, voiture: { role: 'relation', relation: 'voiture' }, gamin: { role: 'relation', relation: 'fils' } };
  assert.equal(int('Apprends que ma voiture est une Twingo.', l).relation, 'voiture');
  assert.equal(int('Apprends que mon gamin est grand.', l).phrase, 'Fait : moi / fils / grand.');
});

// ---------------------------------------------------------------------------- refus clairs
function refuse(t, motif, l = lex) {
  const r = int(t, l);
  assert.ok(r && r.ok === false, `refus attendu pour : ${t}`);
  assert.equal(r.phrase, undefined);
  assert.equal(r.extrait, undefined);
  assert.match(r.raison, motif, t);
}

test('REFUS — « Apprends que » seul, ou sans contenu', () => {
  refuse('Apprends que', /Dis-moi ce que je dois apprendre/);
  refuse('Apprends que   ', /Dis-moi ce que je dois apprendre/);
});

test('REFUS — pas de copule « est » / « sont »', () => {
  refuse('Apprends que ma couleur rouge', /Je ne trouve pas « est » ou « sont »/);
  refuse("Apprends que ma couleur c'est rouge.", /Je ne trouve pas « est » ou « sont »/);
  refuse("Apprends que mon fils s'appelle Paul.", /Je ne trouve pas « est » ou « sont »/);
  refuse("Apprends que j'habite à Paris.", /Je ne trouve pas « est » ou « sont »/);
});

test('REFUS — sujet autre que « moi » (ta, le, un nom propre…)', () => {
  refuse('Apprends que ta couleur est bleue.', /n'apprends que des choses qui te concernent/);
  refuse('Apprends que le ciel est bleu.', /n'apprends que des choses qui te concernent/);
  refuse('Apprends que Paris est grande.', /n'apprends que des choses qui te concernent/);
  refuse('Apprends que couleur est rouge.', /n'apprends que des choses qui te concernent/);
});

test('REFUS — relation inconnue : le mot est nommé et le moyen de l’apprendre est indiqué', () => {
  refuse('Apprends que mon vélo est rouge.', /Je ne connais pas encore « vélo ».*Apprends : Mot : vélo désigne vélo\./);
  refuse('Apprends que ma Twingo est bleue.', /Je ne connais pas encore « Twingo »/);
});

test('REFUS — possessif seul, ou mot en trop avant la copule (aucun mot ignoré en silence)', () => {
  refuse('Apprends que ma est rouge.', /j'attends le nom d'une information/);
  refuse('Apprends que ma couleur préférée est le bleu.', /sans mot en plus/);
  refuse('Apprends que mon plat préféré est la raclette.', /Je ne connais pas encore « plat »/);
  refuse('Apprends que ma petite couleur est rouge.', /Je ne connais pas encore « petite »/);
});

test('REFUS — valeur vide, ou contenant « / » ou « ? »', () => {
  refuse('Apprends que ma couleur est .', /Il manque ce que je dois retenir/);
  refuse('Apprends que ma couleur est ...', /Il manque ce que je dois retenir/);
  refuse('Apprends que ma couleur est rouge / bleu.', /contient « \/ » ou « \? »/);
  refuse('Apprends que ma couleur est rouge ?', /contient « \/ » ou « \? »/);
});

test('un refus ne modifie rien : le module est pur (aucune écriture possible)', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  const avant = JSON.stringify([...e.faits.entries()]);
  int('Apprends que mon vélo est rouge.', e.lexique);
  int('Apprends que ma couleur est rouge.', e.lexique);
  assert.equal(JSON.stringify([...e.faits.entries()]), avant, 'interpréter n’écrit jamais : seule la confirmation écrit');
});

// ---------------------------------------------------------------------------- avec le vrai moteur
async function baseDeChristophe() {
  // Même préparation que le test « NON-RÉGRESSION EXPLICITE » de langage.test.mjs : la façon de dire
  // générale {possessif}, la règle féminin → ta et la propriété couleur/genre/féminin.
  const m = magasinMemoireVive();
  let e = await chargerEsprit(m);
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta' });
  await apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  return { m, e: await chargerEsprit(m) };
}

test('AVEC LE VRAI MOTEUR : enseigner « ma couleur est rouge » puis la relire par une question ordinaire', async () => {
  const { m, e } = await baseDeChristophe();
  assert.match(repondre(e, 'Quelle est ma couleur ?').texte, /bleu/, 'avant : la valeur précédente');
  const r = interpreterEnseignement('Apprends que ma couleur est rouge.', { lexique: e.lexique });
  assert.equal(r.ok, true);
  await apprendreFait(e, r.extrait.donnees); // ce que fait ecrireConnaissance() pour un « fait », après Confirmer
  assert.match(repondre(e, 'Quelle est ma couleur ?').texte, /^ta couleur, c['’]est rouge\.?$/i, 'valeur remplacée, même façon de dire');
  // Persistance : un esprit rechargé depuis le même magasin (= fermeture complète puis réouverture).
  const e2 = await chargerEsprit(m);
  assert.match(repondre(e2, 'Quelle est ma couleur ?').texte, /rouge/);
  assert.doesNotMatch(repondre(e2, 'Quelle est ma couleur ?').texte, /bleu/);
});

test('AVEC LE VRAI MOTEUR : une relation apprise ensuite par le canal devient enseignable en français', async () => {
  const m = magasinMemoireVive();
  const e = await chargerEsprit(m);
  assert.equal(int('Apprends que mon stylo est un Bic.', e.lexique).ok, false, 'inconnue au départ : refus');
  await apprendreRelation(e, extraireLecon('Mot : stylo désigne stylo.').donnees); // « Apprends : Mot : … » existant
  const r = int('Apprends que mon stylo est un Bic.', e.lexique);
  assert.equal(r.ok, true);
  await apprendreFait(e, r.extrait.donnees);
  assert.equal(e.faits.get(cleFait('moi', 'stylo')).valeur, 'un Bic');
});
