// v0.64.12 — J1 : SCÉNARIO DE BOUT EN BOUT sur le moteur de langage réel (magasin mémoire, rechargement), contrôles C1 à C10.
// La CONFIRMATION est le bouton existant : proposerLecon (main.js) → onOui → ecranLangage.ecrireConnaissance(e, extrait) → branche « fait » →
// apprendreFait(e, { ...donnees, origine }). main.js et langage/ecran.js n'étant pas importables ici (DOM), ce chemin est vérifié par lecture de
// source (C0), puis rejoué par l'appel qu'il fait réellement : apprendreFait(e, { ...extrait.donnees, origine: 'apprise-conversation' }).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconnaitreAffirmationPossessive, interpreterEnseignement } from '../app/langage/interpretation.js';
import { chargerEsprit, repondre, apprendreFait, COMPRIS, PARTIEL } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { extraireLecon } from '../app/langage/lecon.js';

const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const proposer = (e, texte) => reconnaitreAffirmationPossessive(texte, { lexique: e.lexique });
const confirmer = (e, proposition) => apprendreFait(e, { ...proposition.extrait.donnees, origine: 'apprise-conversation' });
async function faits(magasin) { return (await magasin.lireTout('faits')).map((f) => [f.sujet, f.relation, f.valeur]); }

test('C0. le chemin de confirmation réel est bien celui rejoué ici (lecture de source)', () => {
  const main = sansCommentaires(readFileSync(new URL('../app/main.js', import.meta.url), 'utf8'));
  const ecran = sansCommentaires(readFileSync(new URL('../app/langage/ecran.js', import.meta.url), 'utf8'));
  assert.match(main, /onOui: async \(\) => \{[\s\S]*?ecranLangage\.ecrireConnaissance\(e, extrait, \{ origine: 'apprise-conversation', exemple: contenuLecon \}\)/);
  assert.match(main, /onNon: async \(\) => \{\s*const reponseFinale = "D'accord, je n'ai rien retenu\.";/);
  assert.match(ecran, /if \(type === 'fait'\) return apprendreFait\(e, \{ \.\.\.donnees, origine: origine \|\| 'apprise-christophe' \}\);/);
});

test('Scénario principal : « Mon chien s\'appelle Rex. » → proposition → Confirmer → « Comment s\'appelle mon chien ? » = « Rex », après redémarrage aussi', async () => {
  const magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  const p = proposer(e, "Mon chien s'appelle Rex.");
  assert.equal(p.ok, true);
  assert.deepEqual(await faits(magasin), [], 'rien n\'est écrit par la proposition');
  await confirmer(e, p);
  assert.deepEqual(await faits(magasin), [['moi', 'chien', 'Rex']], 'UNE seule écriture : le fait');
  assert.equal((await magasin.lireTout('lexique')).length, 0, 'aucune ligne de lexique : la relation est connue par le fait');
  let r = repondre(e, "Comment s'appelle mon chien ?");
  assert.equal(r.etat, COMPRIS);
  assert.equal(r.texte, 'Rex');
  e = await chargerEsprit(magasin); // C5 — redémarrage
  r = repondre(e, "Comment s'appelle mon chien ?");
  assert.equal(r.texte, 'Rex');
});

test('C1. sans connaissance : aucune réponse inventée (avec le nom de Christophe connu, ni « Christophe » ni « Rex »)', async () => {
  const e = await chargerEsprit(magasinMemoireVive());
  await apprendreFait(e, { sujet: 'moi', relation: 'nom', valeur: 'Christophe' });
  const r = repondre(e, "Comment s'appelle mon chien ?");
  assert.equal(r.etat, PARTIEL);
  assert.ok(!['Christophe', 'Rex'].includes(r.texte));
});

test('C2. remplacement : Milo confirmé après Rex → « Milo » (contrat existant de remplacement, même identité)', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  await confirmer(e, proposer(e, "Mon chien s'appelle Rex."));
  await confirmer(e, proposer(e, "Mon chien s'appelle Milo."));
  assert.equal(repondre(e, "Comment s'appelle mon chien ?").texte, 'Milo');
  assert.deepEqual(await faits(magasin), [['moi', 'chien', 'Milo']]);
});

test('C3. information non pertinente : un chat inconnu ne récupère ni le nom de Christophe ni celui du chien', async () => {
  const e = await chargerEsprit(magasinMemoireVive());
  await apprendreFait(e, { sujet: 'moi', relation: 'nom', valeur: 'Christophe' });
  await confirmer(e, proposer(e, "Mon chien s'appelle Rex."));
  const r = repondre(e, "Comment s'appelle mon chat ?");
  assert.equal(r.etat, PARTIEL);
  assert.ok(!['Christophe', 'Rex'].includes(r.texte));
});

test('C4. contradiction : deux lignes différentes → abstention existante ; une nouvelle confirmation est alors refusée sans rien écrire', async () => {
  const magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  await confirmer(e, proposer(e, "Mon chien s'appelle Rex."));
  await magasin.ecrire('faits', { cle: 'autre-surface', sujet: 'moi', relation: 'chien', valeur: 'Milo', origine: 'apprise-christophe' });
  e = await chargerEsprit(magasin);
  assert.match(repondre(e, "Comment s'appelle mon chien ?").texte, /ne pas choisir au hasard/);
  const avant = await faits(magasin);
  await assert.rejects(() => confirmer(e, proposer(e, "Mon chien s'appelle Max.")), /plusieurs réponses différentes/);
  assert.deepEqual(await faits(magasin), avant);
});

test('C6. « Ma ville est Cognac » : forme « est » REPORTÉE (aucune proposition J1) ; le même mécanisme fonctionne avec « s\'appelle » et avec « Apprends que »', async () => {
  const e = await chargerEsprit(magasinMemoireVive());
  assert.deepEqual(proposer(e, 'Ma ville est Cognac.'), { ok: false, motif: 'hors cadre' }, 'report documenté, contrôle NON présenté comme réussi');
  await confirmer(e, proposer(e, "Ma ville s'appelle Cognac."));
  assert.equal(repondre(e, 'Quelle est ma ville ?').texte, 'Cognac');
  const e2 = await chargerEsprit(magasinMemoireVive());
  const v016 = interpreterEnseignement('Apprends que ma ville est Cognac.', { lexique: e2.lexique });
  await apprendreFait(e2, { ...v016.extrait.donnees, origine: 'apprise-conversation' });
  assert.equal(repondre(e2, 'Quelle est ma ville ?').texte, 'Cognac');
});

test('C7 / C8. Annuler ou ne pas confirmer : aucun fait, aucune relation ; au redémarrage, rien n\'est connu', async () => {
  const magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  const p = proposer(e, "Mon chien s'appelle Rex.");
  assert.equal(p.ok, true);
  // Annuler (onNon) n'écrit rien ; une proposition non confirmée n'existe qu'en mémoire de la bulle.
  assert.deepEqual(await faits(magasin), []);
  assert.equal((await magasin.lireTout('lexique')).length, 0);
  assert.notEqual(repondre(e, "Comment s'appelle mon chien ?").texte, 'Rex');
  e = await chargerEsprit(magasin);
  assert.equal(e.relationsConnues.has('chien'), false);
  assert.notEqual(repondre(e, "Comment s'appelle mon chien ?").texte, 'Rex');
});

test('C9. questions, négations, ambiguïtés : aucune proposition', async () => {
  const e = await chargerEsprit(magasinMemoireVive());
  for (const t of ["Mon chien s'appelle comment ?", "Mon chien s'appelle Rex ?", "Mon chien ne s'appelle pas Rex.", "Mon chien s'appelle pas Rex.",
    "Mon chien s'appelle Rex ou Milo.", "Paul dit : mon chien s'appelle Rex.", "Mon chien s'appelle…", "Comment s'appelle mon chien ?"]) {
    assert.equal(proposer(e, t).ok, false, t);
  }
});

test('C10. non-régression : leçons techniques et réponses locales existantes', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const lecon = extraireLecon('Fait : moi / couleur / rouge.');
  await apprendreFait(e, { ...lecon.donnees, origine: 'apprise-lecon' });
  assert.equal(repondre(e, 'Quelle est ma couleur ?').texte, 'rouge');
  const v016 = interpreterEnseignement('Apprends que ma couleur est bleu.', { lexique: e.lexique });
  assert.equal(v016.phrase, 'Fait : moi / couleur / bleu.');
  await apprendreFait(e, { ...v016.extrait.donnees, origine: 'apprise-conversation' });
  assert.equal(repondre(e, 'Quelle est ma couleur ?').texte, 'bleu');
  await apprendreFait(e, { sujet: 'moi', relation: 'nom', valeur: 'Christophe' });
  assert.equal(repondre(e, "Comment je m'appelle ?").texte, 'Christophe');
});

test('Généralité : un autre fait par le même mécanisme, sans règle propre à « chien »', async () => {
  const e = await chargerEsprit(magasinMemoireVive());
  await confirmer(e, proposer(e, "Ma tortue s'appelle Caroline."));
  await confirmer(e, proposer(e, "Mes enfants s'appellent Simon et Léa."));
  assert.equal(repondre(e, "Comment s'appelle ma tortue ?").texte, 'Caroline');
  assert.equal(repondre(e, 'Quels sont mes enfants ?').texte, 'Simon et Léa');
});
