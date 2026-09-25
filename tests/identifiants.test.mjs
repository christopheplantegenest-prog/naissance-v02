// v0.17.1 — COHÉRENCE DES IDENTIFIANTS (faits, sujets, prénoms). Vrai dispatcher (ecrireConnaissance
// de langage/ecran.js), vrai moteur (esprit.js), vrai magasin (mémoire ou IndexedDB-like), avec
// rechargement depuis la base entre les écritures et les questions, pour simuler une fermeture puis
// une réouverture de l'application. AUCUN dispatcher « miroir ».
//
// Avant la correction (sur l'état 0.17.0), les tests marqués [ROUGE ATTENDU] échouent : c'est ce
// qui reproduit et documente le bug du rapport (« téléphone » → FAIT_MANQUANT). Les tests marqués
// [VERROU] doivent rester verts avant ET après : ils figent un comportement qui ne doit pas changer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, repondre, apprendreFait, apprendreRelation, apprendrePropriete, apprendreRegle,
  apprendrePatron, apprendrePatronDirect, oublierFait } from '../app/langage/esprit.js';
import { PHRASE_IGNORANCE } from '../app/langage/bagage.js';
import { magasinMemoireVive, cleFait } from '../app/langage/connaissances.js';
import { extraireLecon } from '../app/langage/lecon.js';
import { canoniser } from '../app/langage/canon.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

// Une base « préparée » comme celle de Christophe : le patron général {possessif}, les règles
// masculin/féminin/pluriel actives, comme sur ses captures.
async function baseChristophe() {
  const magasin = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  const ecrire = (l) => ecran.ecrireConnaissance(e, extraireLecon(l), { origine: 'test', exemple: l });
  for (const l of [
    'Pour possessif_toi : si genre vaut masculin, on dit ton.', 'Pour possessif_toi : si genre vaut féminin, on dit ta.',
    "Façon de dire : * / moi / {possessif} {relation}, c'est {valeur}.",
  ]) await ecrire(l);
  return { magasin, ecran, e, ecrire };
}
const recharger = (magasin) => chargerEsprit(magasin);
async function baseNue() {
  const magasin = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  const ecrire = (l) => ecran.ecrireConnaissance(e, extraireLecon(l), { origine: 'test', exemple: l });
  return { magasin, ecran, e, ecrire };
}


// ============================================================================ LE CAS DE RÉFÉRENCE
test('[ROUGE ATTENDU] reproduction exacte du rapport : Mot + Propriété + « Fait : moi / téléphone / un TCL. »', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : téléphone désigne téléphone.');
  await ecrire('Propriété : téléphone / genre / masculin.');
  await ecrire('Fait : moi / téléphone / un TCL.');
  const dur = await recharger(magasin);
  for (const q of ['Quel est mon téléphone ?', 'Quel est mon telephone ?']) {
    const r = repondre(dur, q);
    assert.notEqual(r.texte, PHRASE_IGNORANCE, `« ${q} » ne doit plus répondre « Je ne sais pas. »`);
    assert.match(r.texte, /^ton telephone, c'est un TCL\.?$/i, q);
    assert.ok(r.fait, 'le fait doit être retrouvé');
  }
});

test('[ROUGE ATTENDU] via le canal pédagogique (« Apprends : Fait : … »), même chemin que le Décor du cours', async () => {
  const { magasin, ecrire } = await baseNue();
  await ecrire('Mot : téléphone désigne téléphone.');
  await ecrire('Fait : moi / téléphone / un TCL.');
  const dur = await recharger(magasin);
  assert.match(repondre(dur, 'Quel est mon téléphone ?').texte, /un TCL/);
});

test('[ROUGE ATTENDU] formulaire « Un fait » du laboratoire (relation seulement passée en minuscules)', async () => {
  const { magasin, ecrire, e } = await baseNue();
  await ecrire('Mot : téléphone désigne téléphone.');
  await apprendreFait(e, { sujet: 'moi', relation: 'téléphone'.trim().toLowerCase(), valeur: 'un TCL' });
  const dur = await recharger(magasin);
  assert.match(repondre(dur, 'Quel est mon téléphone ?').texte, /un TCL/);
});

// ============================================================================ MATRICE DE CARACTÈRES
test('[ROUGE ATTENDU] matrice : accents, majuscule initiale, tout en majuscules', async () => {
  const mots = ['téléphone', 'Téléphone', 'TÉLÉPHONE', 'frère', 'forêt', 'garçon', 'naïf', 'noël'];
  for (const W of mots) {
    const { magasin, ecrire } = await baseNue();
    await ecrire(`Mot : ${W} désigne ${W}.`);
    await ecrire(`Fait : moi / ${W} / valeurX.`);
    const dur = await recharger(magasin);
    assert.equal(repondre(dur, `Quel est mon ${W} ?`).texte, 'valeurX', W);
  }
});
test('[VERROU] les mots déjà canoniques (ASCII, minuscules) fonctionnaient déjà et fonctionnent toujours', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : sac désigne sac.'); await ecrire('Propriété : sac / genre / masculin.'); await ecrire('Fait : moi / sac / un sac rouge.');
  assert.match(repondre((await recharger(magasin)), 'Quel est mon sac ?').texte, /^ton sac, c'est un sac rouge\.?$/i);
});

// ============================================================================ SUJETS ET PRÉNOMS
test('[ROUGE ATTENDU] sujet « Moi » (majuscule) au lieu de « moi »', async () => {
  const { magasin, ecrire } = await baseNue();
  await ecrire('Fait : Moi / couleur / rouge.');
  assert.equal(repondre((await recharger(magasin)), 'Quelle est ma couleur ?').texte, 'rouge');
});
test('[ROUGE ATTENDU] prénom « Marie » (majuscule) — « Où habite Marie ? »', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : ville désigne ville.');
  await ecrire('Fait : moi / fille / Marie.');
  await ecrire('Fait : Marie / ville / Lyon.');
  const dur = await recharger(magasin);
  const r = repondre(dur, 'Où habite Marie ?');
  assert.equal(r.comprehension.sujet, 'marie', 'le sujet EST reconnu (jeton canonique)');
  assert.equal(r.texte, 'Lyon', 'mais le fait doit être retrouvé malgré la majuscule tapée');
});
test('[ROUGE ATTENDU] prénom accentué « Aurélie »', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : ville désigne ville.');
  await ecrire('Fait : moi / fille / Aurélie.');
  await ecrire('Fait : Aurélie / ville / Lyon.');
  const dur = await recharger(magasin);
  assert.ok(dur.prenomsConnus.has('aurelie'), 'prenomsConnus doit contenir la forme canonique');
  const r = repondre(dur, 'Où habite Aurélie ?');
  assert.equal(r.comprehension.sujet, 'aurelie');
  assert.equal(r.texte, 'Lyon');
});
test('[ROUGE ATTENDU] relation « Fils » (majuscule) alimente aussi les prénoms', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : ville désigne ville.');
  await ecrire('Fait : moi / Fils / Paul.');
  await ecrire('Fait : Paul / ville / Nice.');
  const dur = await recharger(magasin);
  assert.ok(dur.prenomsConnus.has('paul'));
});
test('[VERROU] prénom déjà tout en minuscule, sans accent : fonctionnait déjà', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Fait : moi / fille / marie.'); await ecrire('Fait : marie / ville / Lyon.');
  assert.equal(repondre((await recharger(magasin)), 'Où habite Marie ?').texte, 'Lyon');
});
test('[VERROU] noms composés : rangés mais non reconnus dans une phrase (comportement connu, non traité)', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : ville désigne ville.');
  await ecrire('Fait : moi / fils / Jean-Pierre.');
  await ecrire('Fait : Jean-Pierre / ville / Metz.');
  const dur = await recharger(magasin);
  assert.ok(dur.prenomsConnus.has('jean-pierre'), 'rangé sous sa forme canonique, sans troncature');
  assert.equal(repondre(dur, 'Où habite Jean-Pierre ?').comprehension.sujet, null, 'mais pas reconnu comme sujet : hors chantier');
});

// ============================================================================ APPRENDRE QUE (verrou)
test('[VERROU] « Apprends que » (v0.16) est inchangé : la relation vient déjà du lexique, canonique', async () => {
  const { magasin, e, ecrire } = await baseChristophe();
  await ecrire('Mot : téléphone désigne téléphone.');
  const { interpreterEnseignement } = await import('../app/langage/interpretation.js');
  const r = interpreterEnseignement('Apprends que mon téléphone est un TCL.', { lexique: e.lexique });
  assert.equal(r.ok, true);
  assert.equal(r.phrase, 'Fait : moi / telephone / un TCL.');
});

// ============================================================================ FAÇON DE DIRE PAR CORRECTION
test('[ROUGE ATTENDU] apprendrePatron (chemin par correction) avec une relation accentuée : le patron doit s’appliquer', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  await ecran.ecrireConnaissance(e, extraireLecon('Mot : téléphone désigne téléphone.'), { origine: 'test' });
  await ecran.ecrireConnaissance(e, extraireLecon('Fait : moi / téléphone / un TCL.'), { origine: 'test' });
  await apprendrePatron(e, { correction: 'Ton téléphone, c’est un TCL.', sujet: 'moi', relation: 'téléphone', portee: 'relation' });
  const patrons = await magasin.lireTout('patrons');
  const stocke = patrons.find((p) => p.origine === 'appris');
  assert.equal(stocke.relation, 'telephone', 'la relation stockée du patron doit être canonique, pas « téléphone »');
  const dur = await recharger(magasin);
  const r = repondre(dur, 'Quel est mon téléphone ?');
  assert.equal(r.patron.relation, 'telephone', 'c’est bien CE patron précis qui est utilisé, pas le patron générique {valeur} de départ');
  assert.match(r.texte, /^ton téléphone, c['’]est un TCL\.?$/i);
});

// ============================================================================ CANAUX QUI FONCTIONNAIENT DÉJÀ (VERROUS)
test('[VERROU] lexique, propriétés, règles, façons de dire directes : déjà insensibles à la casse et aux accents', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  const ecrire = (l) => ecran.ecrireConnaissance(e, extraireLecon(l), { origine: 'test', exemple: l });
  await ecrire('Mot : Téléphone désigne Téléphone.');
  await ecrire('Propriété : TÉLÉPHONE / Genre / Masculin.');
  await ecrire('Pour Possessif_Toi : si Genre vaut Masculin, on dit ton.');
  await ecrire("Façon de dire : Téléphone / Moi / {possessif} {relation} : {valeur}.");
  assert.equal(e.lexique.telephone.relation, 'telephone');
  assert.equal(e.proprietes.get('telephone').get('genre'), 'masculin');
  assert.ok(e.regles.some((r) => r.role === 'possessif_toi' && r.resultat === 'ton'));
  assert.ok(e.patrons.some((p) => p.relation === 'telephone' && p.sujet === 'moi'));
});

// ============================================================================ ANCIENNES DONNÉES (compatibilité, SANS migration)
test('[ROUGE ATTENDU] ligne BRUTE préexistante (telle que la 0.17.0 la laisse) : lue sans aucune migration', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'telephone', role: 'relation', relation: 'telephone' });
  await magasin.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'un TCL' }); // ligne brute héritée
  const avant = JSON.stringify(await magasin.lireTout('faits'));
  const e = await chargerEsprit(magasin);
  assert.equal((await magasin.lireTout('faits')).length, 1, 'le chargement n’a RIEN écrit');
  assert.equal(JSON.stringify(await magasin.lireTout('faits')), avant, 'la ligne existante n’a pas été modifiée');
  assert.equal(repondre(e, 'Quel est mon téléphone ?').texte, 'un TCL');
});

test('[ROUGE ATTENDU] réenseigner ce fait en graphie canonique REMPLACE la ligne EN PLACE (pas de doublon)', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'telephone', role: 'relation', relation: 'telephone' });
  await magasin.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'un TCL' });
  const e = await chargerEsprit(magasin);
  await apprendreFait(e, { sujet: 'moi', relation: 'telephone', valeur: 'un iPhone' });
  const lignes = await magasin.lireTout('faits');
  assert.equal(lignes.length, 1, 'une seule ligne en base, pas deux');
  assert.equal(lignes[0].cle, 'moi|téléphone', 'la clé de ligne existante est conservée telle quelle');
  assert.equal(lignes[0].valeur, 'un iPhone');
  assert.equal(repondre(e, 'Quel est mon téléphone ?').texte, 'un iPhone');
});

test('[ROUGE ATTENDU] retrait d’une ligne brute existante, par ses champs enregistrés ET par la forme canonique', async () => {
  const m1 = magasinMemoireVive();
  await m1.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'un TCL' });
  const e1 = await chargerEsprit(m1);
  await oublierFait(e1, { sujet: 'moi', relation: 'téléphone' }); // champs enregistrés (ce que fait le panneau « Gérer »)
  assert.equal((await m1.lireTout('faits')).length, 0);

  const m2 = magasinMemoireVive();
  await m2.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'un TCL' });
  const e2 = await chargerEsprit(m2);
  await oublierFait(e2, { sujet: 'moi', relation: 'telephone' }); // forme canonique
  assert.equal((await m2.lireTout('faits')).length, 0);
});

test('[VERROU] retrait d’une identité inconnue reste un refus clair', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  await assert.rejects(() => oublierFait(e, { sujet: 'moi', relation: 'inconnu' }), /Je ne connais pas ce fait\./);
});

// ============================================================================ CONFLITS
async function baseAvecConflit(valeurA = 'un TCL', valeurB = 'un Samsung') {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'telephone', role: 'relation', relation: 'telephone' });
  await magasin.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: valeurA });
  await magasin.ecrire('faits', { cle: 'moi|telephone', sujet: 'moi', relation: 'telephone', valeur: valeurB });
  const e = await chargerEsprit(magasin);
  return { magasin, e };
}

test('[ROUGE ATTENDU] CONFLIT : deux lignes de même identité, valeurs différentes → détecté, aucune perte, aucun choix arbitraire', async () => {
  const { magasin, e } = await baseAvecConflit();
  assert.equal((await magasin.lireTout('faits')).length, 2, 'aucune ligne perdue au chargement');
  assert.ok(e.conflitsFaits && e.conflitsFaits.has('moi|telephone'));
  const candidats = e.conflitsFaits.get('moi|telephone');
  assert.deepEqual(candidats.map((l) => l.valeur).sort(), ['un Samsung', 'un TCL']);
  assert.equal(e.faits.has('moi|telephone'), false, 'aucune réponse « servie » choisie au hasard');
  const r = repondre(e, 'Quel est mon téléphone ?');
  assert.equal(r.fait, null);
  assert.equal(r.etat, 'compris');
  assert.ok(r.conflitFait, 'la réponse porte un indicateur de conflit');
  assert.notEqual(r.texte, PHRASE_IGNORANCE, 'un conflit n’est pas une ignorance : la phrase doit être différente');
});

test('[ROUGE ATTENDU] valeurs IDENTIQUES (doublon) : pas de conflit, une réponse, la duplication signalée dans le diagnostic', async () => {
  const { magasin, e } = await baseAvecConflit('un TCL', 'un TCL');
  assert.equal(e.conflitsFaits.has('moi|telephone'), false);
  assert.equal(repondre(e, 'Quel est mon téléphone ?').texte, 'un TCL');
  assert.equal((await magasin.lireTout('faits')).length, 2, 'les deux lignes restent en base (aucune fusion silencieuse des lignes)');
});

test('[ROUGE ATTENDU] « un TCL » et « un tcl » (casse différente dans la VALEUR) sont un conflit : jamais normalisé pour décider', async () => {
  const { e } = await baseAvecConflit('un TCL', 'un tcl');
  assert.ok(e.conflitsFaits.has('moi|telephone'));
});

test('[ROUGE ATTENDU] écriture sur une identité en conflit : REFUSÉE, la base reste inchangée', async () => {
  const { magasin, e } = await baseAvecConflit();
  const avant = JSON.stringify(await magasin.lireTout('faits'));
  await assert.rejects(() => apprendreFait(e, { sujet: 'moi', relation: 'telephone', valeur: 'un Xiaomi' }));
  assert.equal(JSON.stringify(await magasin.lireTout('faits')), avant);
  assert.equal((await magasin.lireTout('faits')).length, 2);
});

test('[ROUGE ATTENDU] retrait par identité pendant un conflit : REFUSÉ (jamais de suppression arbitraire)', async () => {
  const { magasin, e } = await baseAvecConflit();
  const avant = JSON.stringify(await magasin.lireTout('faits'));
  await assert.rejects(() => oublierFait(e, { sujet: 'moi', relation: 'telephone' }), /réponses différentes en mémoire/, 'message clair, pas un refus générique');
  assert.equal(JSON.stringify(await magasin.lireTout('faits')), avant);
});

test('[ROUGE ATTENDU] retrait par la CLÉ d’une des deux lignes : résout le conflit, garde l’autre', async () => {
  const { magasin, e } = await baseAvecConflit('un TCL', 'un Samsung');
  await oublierFait(e, { sujet: 'moi', relation: 'telephone', cle: 'moi|téléphone' });
  assert.equal((await magasin.lireTout('faits')).length, 1);
  assert.equal(e.conflitsFaits.has('moi|telephone'), false, 'le conflit est résolu');
  assert.equal(repondre(e, 'Quel est mon téléphone ?').texte, 'un Samsung');
  const dur = await chargerEsprit(magasin);
  assert.equal(repondre(dur, 'Quel est mon téléphone ?').texte, 'un Samsung', 'et cela persiste après rechargement');
});

test('[ROUGE ATTENDU] groupe A, B, B : conflit (A≠B) ; retirer A laisse un doublon B, B sans conflit', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'telephone', role: 'relation', relation: 'telephone' });
  await magasin.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'A' });
  await magasin.ecrire('faits', { cle: 'moi|telephone', sujet: 'moi', relation: 'telephone', valeur: 'B' });
  await magasin.ecrire('faits', { cle: 'moi|TELEPHONE', sujet: 'moi', relation: 'TELEPHONE', valeur: 'B' });
  const e = await chargerEsprit(magasin);
  assert.ok(e.conflitsFaits.has('moi|telephone'));
  await oublierFait(e, { sujet: 'moi', relation: 'telephone', cle: 'moi|téléphone' });
  assert.equal(e.conflitsFaits.has('moi|telephone'), false);
  assert.equal(repondre(e, 'Quel est mon téléphone ?').texte, 'B');
  assert.equal((await magasin.lireTout('faits')).length, 2, 'les deux lignes « B » restent (doublon toléré, pas de perte)');
});

test('[VERROU] enseigner un fait déjà présent (même valeur, même graphie) le remplace en place, sans doublon', async () => {
  const { magasin, e, ecrire } = await baseChristophe();
  await ecrire('Fait : moi / couleur / rouge.');
  await apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'rouge' });
  assert.equal((await magasin.lireTout('faits')).filter((f) => f.relation === 'couleur').length, 1);
});

test('[ROUGE ATTENDU] conflit à TROIS lignes différentes : en retirer une laisse un conflit à DEUX', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'telephone', role: 'relation', relation: 'telephone' });
  await magasin.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'A' });
  await magasin.ecrire('faits', { cle: 'moi|telephone', sujet: 'moi', relation: 'telephone', valeur: 'B' });
  await magasin.ecrire('faits', { cle: 'moi|TELEPHONE', sujet: 'moi', relation: 'TELEPHONE', valeur: 'C' });
  const e = await chargerEsprit(magasin);
  assert.ok(e.conflitsFaits.has('moi|telephone'));
  await oublierFait(e, { sujet: 'moi', relation: 'telephone', cle: 'moi|téléphone' }); // retire A
  assert.ok(e.conflitsFaits.has('moi|telephone'), 'B et C restent différents : toujours un conflit');
  assert.deepEqual(e.conflitsFaits.get('moi|telephone').map((l) => l.valeur).sort(), ['B', 'C']);
  assert.equal(repondre(e, 'Quel est mon téléphone ?').conflitFait, true);
});

// ============================================================================ CE QUI NE DOIT PAS ÊTRE TOUCHÉ (hors chantier)
test('[VERROU] hors chantier — troncature du lexique : « cœur » → « c » (inchangé, connu, non corrigé ici)', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : cœur désigne cœur.');
  const dur = await recharger(magasin);
  assert.equal(dur.lexique.c?.relation, 'c', 'comportement connu, non traité par ce chantier');
});
test('[VERROU] hors chantier — « Mot : là désigne là. » écrase « la » (inchangé)', async () => {
  const { magasin, ecrire } = await baseChristophe();
  await ecrire('Mot : là désigne là.');
  const dur = await recharger(magasin);
  assert.notDeepEqual(dur.lexique.la, LEXIQUE_DEPART.la);
});

// ============================================================================ STATIQUE
test('STATIQUE — le service worker précharge canon.js', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const sw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./langage/canon.js'"));
});

test('STATIQUE — connaissances.js est le SEUL point qui fabrique la clé d’identité d’un fait (cleFait)', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
  const fichiers = [];
  (function marcher(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) marcher(p); else if (n.endsWith('.js')) fichiers.push(p); } })(racine);
  for (const f of fichiers) {
    const src = readFileSync(f, 'utf8');
    if (f.endsWith('connaissances.js')) continue;
    assert.doesNotMatch(src, /`\$\{.*\}\|\$\{.*\}`/, `${f} : fabrique peut-être une clé « à la main » au lieu d'utiliser cleFait()`);
  }
});
