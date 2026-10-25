// v0.64.15 — « RÉFÉRENCE EXPLICITE À UN MESSAGE NATUREL » (GO ChatGPT « v0.64.15 », 14/10/2026).
// Christophe désigne explicitement (geste « Répondre » sur SA bulle) un message naturel M que Naissance ne sait pas interpréter, puis enseigne
// indépendamment un fait F par une leçon technique L. Après confirmation réussie : L ↔ F ↔ lecon-technique (comme en v0.64.14) ET
// M ↔ F ↔ reference-explicite(L). AUCUNE induction, aucune Action, aucune compréhension nouvelle.
// main.js n'est pas importable (DOM) : son raccord est vérifié par lecture de source (R0), puis le chemin est REJOUÉ avec les fonctions réelles
// (même patron que tests/manifestations-faits.test.mjs) ; l'écran est testé par faux DOM (même patron que tests/environnement-conversation.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const {
  magasinMemoireVive, nouvelId, enregistrerValeurDonnee, enregistrerManifestationFait, lireManifestationsFaits, VOIES_MANIFESTATION, TABLES, VERSION_BASE,
} = await import('../app/langage/connaissances.js');
const { identifierMessage, conserverValeurMessage } = await import('../app/langage/pont.js');
const { chargerEsprit, apprendreFait, apprendreRelation } = await import('../app/langage/esprit.js');
const { reconnaitreActions } = await import('../app/langage/action.js');
const { extraireLecon } = await import('../app/langage/lecon.js');
const { reconnaitreAffirmationPossessive, estEnseignementNaturel } = await import('../app/langage/interpretation.js');
const { monterConversation } = await import('../app/conversation/ecran.js');
const { SCHEMA_SAUVEGARDE } = await import('../app/memoire/sauvegarde.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const MAIN = sansCommentaires(lu('app', 'main.js'));
const ECRAN = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
const MARQUEUR_APPRENTISSAGE = /^apprends\s*:\s*/i;

// --- REJEU DU CHEMIN RÉEL DE main.js -------------------------------------------------------------------------------------------------------------
// referenceSupervisee : COPIE exacte de main.js (R0 vérifie que main.js porte ce même corps).
function referenceSupervisee(options, message) {
  const ref = options && options.referenceMessage;
  if (!ref || typeof ref.idMessage !== 'string' || ref.idMessage.length === 0) return null;
  if (message && ref.idMessage === message.id) return null;
  return { idMessage: ref.idMessage };
}
// pont.traiterTourAvecEnonce : identité du message PUIS conservation de sa valeur brute (valeursDonnees), avant tout traitement.
async function recevoir(magasin, texte) {
  const message = identifierMessage(texte, { nouvelId });
  await conserverValeurMessage(message, { enregistrerValeur: (entree) => enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// traiterTour, branches concernées : leçon technique (seule à transmettre la référence, et seulement pour un fait), puis forme apprise, puis J1a.
function proposer(e, texte, message, options = {}) {
  if (estEnseignementNaturel(texte)) return null; // hors périmètre de la référence (« Apprends que »)
  if (MARQUEUR_APPRENTISSAGE.test(texte)) {
    const extrait = extraireLecon(texte.replace(MARQUEUR_APPRENTISSAGE, '').trim());
    return extrait ? { extrait, voie: { nom: 'lecon-technique' }, reference: extrait.type === 'fait' ? referenceSupervisee(options, message) : null } : null;
  }
  if (reconnaitreActions(e.actions || [], texte).etat !== 'aucune') return { local: 'action' };
  const a = reconnaitreAffirmationPossessive(texte, { lexique: e.lexique });
  return a.ok ? { extrait: a.extrait, voie: { nom: 'j1a' }, reference: null } : null;
}
// onOui : fait (ou relation), PUIS manifestation L, PUIS manifestation M tentée ; échecs de manifestation avalés comme dans main.js.
async function confirmer(e, message, p) {
  const { type, donnees } = p.extrait;
  const r = type === 'fait' ? await apprendreFait(e, { ...donnees, origine: 'apprise-conversation' }) : await apprendreRelation(e, { ...donnees, origine: 'apprise-conversation' });
  if (message && r && r.type === 'fait' && r.objet) {
    const fait = { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur };
    try { await enregistrerManifestationFait(e.magasin, { idMessage: message.id, fait, voie: p.voie }); } catch { /* additive */ }
    if (p.reference) {
      try { await enregistrerManifestationFait(e.magasin, { idMessage: p.reference.idMessage, fait: { ...fait }, voie: { nom: 'reference-explicite', idLecon: message.id } }); } catch { /* additive */ }
    }
  }
  return r;
}
async function redemarrer(magasin) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await magasin.lireTout(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(donnees);
  return { magasin: neuf, esprit: await chargerEsprit(neuf) };
}
// Un enseignement supervisé complet : M (naturel), geste sur M, L (leçon), et le geste final ('oui' | 'non' | 'rien').
async function enseignerSurM(magasin, e, texteM, texteL, geste = 'oui', { referencer = true } = {}) {
  const M = await recevoir(magasin, texteM);
  const pM = proposer(e, texteM, M);
  const L = await recevoir(magasin, texteL);
  const pL = proposer(e, texteL, L, referencer ? { referenceMessage: { idMessage: M.id } } : {});
  if (geste === 'oui') await confirmer(e, L, pL);
  return { M, L, pM, pL };
}
const sup = (ms) => ms.filter((m) => m.voie.nom === 'reference-explicite');

// ================================================================================================================ R0. RACCORD RÉEL (source)
test('R0. main.js : référence admise par referenceSupervisee, transmise par la SEULE leçon de fait ; M écrite APRÈS L dans onOui ; identité exposée seulement après conservation ; pont.js intact', () => {
  assert.match(MAIN, /function referenceSupervisee\(options, message\) \{\s*const ref = options && options\.referenceMessage;\s*if \(!ref \|\| typeof ref\.idMessage !== 'string' \|\| ref\.idMessage\.length === 0\) return null;\s*if \(message && ref\.idMessage === message\.id\) return null;\s*return \{ idMessage: ref\.idMessage \};\s*\}/);
  assert.match(MAIN, /return proposerLecon\(texte, extrait, contenuLecon, sourceProposition\(message, \{ nom: 'lecon-technique' \}\), extrait\.type === 'fait' \? referenceSupervisee\(options, message\) : null\);/);
  assert.equal((MAIN.match(/referenceSupervisee\(/g) || []).length, 3, 'la définition + la leçon de fait + la réponse attendue'); // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + « Apprends : Réponse : … » (réponse attendue, elle aussi exclusivement par référence explicite)
  assert.equal((MAIN.match(/referenceMessage/g) || []).length > 0, true);
  assert.match(MAIN, /function proposerLecon\(texte, extrait, contenuLecon, source = null, referenceMessage = null\) \{/);
  const oui = MAIN.slice(MAIN.indexOf('onOui: async () => {'), MAIN.indexOf('onNon: async () => {'));
  const non = MAIN.slice(MAIN.indexOf('onNon: async () => {'), MAIN.indexOf('onNon: async () => {') + 400);
  const iGarde = oui.indexOf("if (source && r && r.type === 'fait' && r.objet) {");
  const iL = oui.indexOf('voie: source.voie });');
  const iRef = oui.indexOf('if (referenceMessage) {');
  const iM = oui.indexOf("voie: { nom: 'reference-explicite', idLecon: source.idMessage } });");
  const iCatch = oui.indexOf('} catch (err) { reponseFinale = err.message; }');
  assert.ok(iGarde > 0 && iGarde < iL && iL < iRef && iRef < iM && iM < iCatch, 'fait accepté → L → M, le tout dans la garde et avant le catch');
  assert.match(oui, /await enregistrerManifestationFait\(e\.magasin, \{ idMessage: referenceMessage\.idMessage, fait: \{ sujet: r\.objet\.sujet, relation: r\.objet\.relation, valeur: r\.objet\.valeur \}, voie: \{ nom: 'reference-explicite', idLecon: source\.idMessage \} \}\);/);
  assert.doesNotMatch(non, /enregistrerManifestationFait|reference-explicite/);
  // identité exposée : notée APRÈS l'écriture réelle de la valeur, jointe aux deux retours du tour
  assert.match(MAIN, /const conservee = await enregistrerValeurDonneeReelle\(e\.magasin, entree\);\s*idMessageConserve = entree\.id;\s*return conservee;/);
  assert.equal((MAIN.match(/return avecIdMessage\(await apresEvenements\(/g) || []).length, 2);
  assert.equal((MAIN.match(/return apresEvenements\(/g) || []).length, 0);
  assert.match(MAIN, /function avecIdMessage\(resultat, idMessage\) \{\s*if \(typeof idMessage !== 'string' \|\| idMessage\.length === 0\) return resultat;\s*if \(resultat === null \|\| typeof resultat !== 'object' \|\| Array\.isArray\(resultat\)\) return resultat;\s*return \{ \.\.\.resultat, idMessage \};/);
  const pont = lu('app', 'langage', 'pont.js');
  assert.equal(/referenceMessage|idMessageConserve|reference-explicite/.test(pont), false, 'pont.js inchangé');
  assert.equal(VERSION_BASE, 30); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 20); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.deepEqual([...VOIES_MANIFESTATION], ['j1a', 'apprends-que', 'lecon-technique', 'forme-apprise', 'reference-explicite', 'resolution']); // MISE À JOUR DÉLIBÉRÉE v0.64.24 : sixième voie 'resolution' (contrat testé dans tests/resolutions.test.mjs)
});

// ================================================================================================================ R1. DÉCISIF
test('R1. décisif : M1/M2/M3 « … se nomme … » non compris, référencés, enseignés par L1/L2/L3, confirmés ; redémarrage ; 3 manifestations supervisées + 3 techniques ; aucune forme, aucune Action', async () => {
  let magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  const tours = [];
  for (const [texteM, texteL] of [
    ['Mon chien se nomme Rex.', 'Apprends : Fait : moi / chien / Rex.'],
    ['Mon chien se nomme Milo.', 'Apprends : Fait : moi / chien / Milo.'],
    ['Mon chat se nomme Milo.', 'Apprends : Fait : moi / chat / Milo.'],
  ]) {
    const t = await enseignerSurM(magasin, e, texteM, texteL);
    assert.equal(t.pM, null, `« ${texteM} » n'est interprété localement par aucune forme ni par J1a`);
    tours.push(t);
  }
  ({ magasin, esprit: e } = await redemarrer(magasin));
  const ms = await lireManifestationsFaits(magasin);
  assert.equal(ms.length, 6);
  const parId = new Map(ms.map((m) => [m.idMessage, m]));
  const valeurs = new Map((await magasin.lireTout('valeursDonnees')).map((x) => [x.id, x.valeur]));
  const faits = [['moi', 'chien', 'Rex'], ['moi', 'chien', 'Milo'], ['moi', 'chat', 'Milo']];
  tours.forEach(({ M, L }, i) => {
    const fait = { sujet: faits[i][0], relation: faits[i][1], valeur: faits[i][2] };
    assert.deepEqual(parId.get(M.id), { idMessage: M.id, texte: M.texte, fait, voie: { nom: 'reference-explicite', idLecon: L.id } });
    assert.deepEqual(parId.get(L.id), { idMessage: L.id, texte: L.texte, fait, voie: { nom: 'lecon-technique' } });
    assert.equal(valeurs.get(M.id), M.texte, 'texte naturel résoluble par SON identité');
    assert.equal(valeurs.get(parId.get(M.id).voie.idLecon), L.texte, 'texte de la leçon résoluble par idLecon');
  });
  assert.equal(sup(ms).length, 3);
  // aucune Action, aucune forme : la phrase nouvelle n'est toujours pas interprétée localement
  assert.deepEqual(await magasin.lireTout('actions'), []);
  const kiwi = await recevoir(magasin, 'Mon lapin se nomme Kiwi.');
  assert.equal(proposer(e, kiwi.texte, kiwi), null);
  assert.equal(reconnaitreActions(e.actions || [], 'Mon lapin se nomme Kiwi.').etat, 'aucune');
  // le fait courant reste appris depuis L (le dernier pour moi/chien)
  assert.deepEqual((await magasin.lireTout('faits')).map((f) => [f.sujet, f.relation, f.valeur]).sort(), [['moi', 'chat', 'Milo'], ['moi', 'chien', 'Milo']]);
});

// ================================================================================================================ R2. NÉGATIFS DU CHEMIN
test('R2. Annuler, fermeture sans confirmation, message ordinaire, leçon non-Fait, envoi sans référence : aucune manifestation supervisée', async () => {
  let magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  await enseignerSurM(magasin, e, 'Mon chien se nomme Rex.', 'Apprends : Fait : moi / chien / Rex.', 'non'); // Annuler : onNon n'écrit rien
  await enseignerSurM(magasin, e, 'Mon chat se nomme Milo.', 'Apprends : Fait : moi / chat / Milo.', 'rien'); // jamais confirmé
  // message ordinaire avec référence : aucune proposition, donc rien
  const M3 = await recevoir(magasin, 'Mon lapin se nomme Kiwi.');
  const B = await recevoir(magasin, 'Bonjour');
  assert.equal(proposer(e, B.texte, B, { referenceMessage: { idMessage: M3.id } }), null);
  // leçon non-Fait avec référence : la référence n'est pas transmise ; la relation est apprise ; aucune manifestation
  const M4 = await recevoir(magasin, 'Mon vélo se nomme Bleu.');
  const L4 = await recevoir(magasin, 'Apprends : Mot : vélo désigne bicyclette.');
  const p4 = proposer(e, L4.texte, L4, { referenceMessage: { idMessage: M4.id } });
  assert.equal(p4.extrait.type, 'relation'); assert.equal(p4.reference, null);
  assert.equal((await confirmer(e, L4, p4)).type, 'relation');
  // leçon de fait SANS référence : seulement L (comportement v0.64.14 inchangé)
  const t5 = await enseignerSurM(magasin, e, 'Mon poisson se nomme Bulle.', 'Apprends : Fait : moi / poisson / Bulle.', 'oui', { referencer: false });
  ({ magasin } = await redemarrer(magasin));
  const ms = await lireManifestationsFaits(magasin);
  assert.deepEqual(sup(ms), []);
  assert.deepEqual(ms.map((m) => [m.idMessage, m.voie.nom]), [[t5.L.id, 'lecon-technique']]);
});

test('R3. M déjà associé : M ↔ F1 reste, M ↔ F2 refusé ; F2 appris et L2 ↔ F2 conservé ; conflit de fait : ni L ni M', async () => {
  const magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  const t1 = await enseignerSurM(magasin, e, 'Mon chien se nomme Rex.', 'Apprends : Fait : moi / chien / Rex.');
  const L2 = await recevoir(magasin, 'Apprends : Fait : moi / chien / Max.');
  const p2 = proposer(e, L2.texte, L2, { referenceMessage: { idMessage: t1.M.id } });
  assert.deepEqual(p2.reference, { idMessage: t1.M.id });
  await confirmer(e, L2, p2);
  let ms = await lireManifestationsFaits(magasin);
  const parId = new Map(ms.map((m) => [m.idMessage, m]));
  assert.deepEqual(parId.get(t1.M.id).fait, { sujet: 'moi', relation: 'chien', valeur: 'Rex' });
  assert.deepEqual(parId.get(L2.id), { idMessage: L2.id, texte: L2.texte, fait: { sujet: 'moi', relation: 'chien', valeur: 'Max' }, voie: { nom: 'lecon-technique' } });
  assert.equal(sup(ms).length, 1);
  assert.deepEqual((await magasin.lireTout('faits')).map((f) => f.valeur), ['Max']);
  // conflit réel : apprendreFait refuse → ni L3 ni M3
  await magasin.ecrire('faits', { cle: 'autre-surface', sujet: 'moi', relation: 'chien', valeur: 'Milo', origine: 'apprise-christophe' });
  e = await chargerEsprit(magasin);
  const avant = await lireManifestationsFaits(magasin);
  const M3 = await recevoir(magasin, 'Mon chien se nomme Zorro.');
  const L3 = await recevoir(magasin, 'Apprends : Fait : moi / chien / Zorro.');
  await assert.rejects(() => confirmer(e, L3, proposer(e, L3.texte, L3, { referenceMessage: { idMessage: M3.id } })), /plusieurs réponses différentes/);
  ms = await lireManifestationsFaits(magasin);
  assert.deepEqual(ms, avant);
});

test('R4. deux messages naturels textuellement identiques, deux ids : deux références distinctes, deux manifestations ; auto-référence écartée', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const a = await enseignerSurM(magasin, e, 'Mon chien se nomme Rex.', 'Apprends : Fait : moi / chien / Rex.');
  const b = await enseignerSurM(magasin, e, 'Mon chien se nomme Rex.', 'Apprends : Fait : moi / chien / Rex.');
  assert.notEqual(a.M.id, b.M.id);
  const ms = sup(await lireManifestationsFaits(magasin));
  assert.deepEqual(ms.map((m) => [m.idMessage, m.voie.idLecon]).sort(), [[a.M.id, a.L.id], [b.M.id, b.L.id]].sort());
  // auto-référence : la référence portant l'identité du message même n'est jamais admise
  const L = await recevoir(magasin, 'Apprends : Fait : moi / chat / Félix.');
  assert.equal(proposer(e, L.texte, L, { referenceMessage: { idMessage: L.id } }).reference, null);
  for (const ref of [null, {}, { idMessage: '' }, { idMessage: 5 }]) assert.equal(referenceSupervisee({ referenceMessage: ref }, L), null);
});

// ================================================================================================================ R5. CONTRAT
test('R5. contrat reference-explicite : idLecon absent, inexistant, = idMessage, sans manifestation L, L d\'un autre fait ou d\'une autre voie, champ mal placé, immuable', async () => {
  const magasin = magasinMemoireVive();
  const msg = async (t) => { const id = nouvelId('message'); await enregistrerValeurDonnee(magasin, { id, valeur: t }); return id; };
  const M = await msg('Mon chien se nomme Rex.');
  const L = await msg('Apprends : Fait : moi / chien / Rex.');
  const J = await msg("Mon chien s'appelle Rex.");
  const F = { sujet: 'moi', relation: 'chien', valeur: 'Rex' };
  const ecrire = (idMessage, voie, fait = F) => enregistrerManifestationFait(magasin, { idMessage, fait: { ...fait }, voie });
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite' }), /idLecon/);
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: '' }), /idLecon/);
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: M }), /elle-même/);
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: 'message-inexistant' }), /aucune leçon conservée/);
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: L }), /pas de manifestation lecon-technique/, 'L sans sa manifestation');
  await ecrire(L, { nom: 'lecon-technique' });
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: L }, { ...F, valeur: 'Milo' }), /pas de manifestation lecon-technique/, 'L d\'un autre fait');
  await ecrire(J, { nom: 'j1a' });
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: J }), /pas de manifestation lecon-technique/, 'L d\'une autre voie');
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: L, idAction: 'x' }), /idAction/);
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: L, autre: 1 }), /champ étranger/);
  await assert.rejects(() => ecrire(M, { nom: 'lecon-technique', idLecon: L }), /idLecon n'appartient/);
  await assert.rejects(() => ecrire(M, { nom: 'forme-apprise', idAction: 'x', idLecon: L }), /idLecon n'appartient/);
  assert.equal(sup(await lireManifestationsFaits(magasin)).length, 0, 'aucun refus n\'a rien écrit');
  const ok = await ecrire(M, { nom: 'reference-explicite', idLecon: L });
  assert.deepEqual(ok, { idMessage: M, fait: F, voie: { nom: 'reference-explicite', idLecon: L } });
  await assert.rejects(() => ecrire(M, { nom: 'reference-explicite', idLecon: L }), /immuable/);
  const nonConserve = 'message-jamais-conserve';
  await assert.rejects(() => ecrire(nonConserve, { nom: 'reference-explicite', idLecon: L }), /aucun message conservé/);
});

// ================================================================================================================ R6. ÉCRAN
async function coquille(repondreFn) {
  const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: repondreFn, surSollicitation: null, surActe: null, surJugement: null });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesMoi = () => liste.children.filter((c) => c._cls.has('message-moi'));
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const bandeau = () => formulaire.children.find((c) => c._cls.has('bandeau-reference'));
  const repondreSur = (b) => { const z = b.children.find((c) => c._cls.has('reference-message')); return z ? z.children[0] : null; };
  return { soumettre, bullesMoi, bullesIA, bandeau, repondreSur };
}
const clic = (b) => Promise.all((b.listeners.click || []).map((f) => f()));

test('R6. ÉCRAN : « Répondre » sur la bulle de Christophe SEULEMENT si le tour a rendu idMessage ; bandeau avec extrait ; options.referenceMessage EXACT ; consommée après envoi ; tour suivant sans référence', async () => {
  const recus = []; let n = 0;
  const { soumettre, bullesMoi, bandeau, repondreSur } = await coquille(async (texte, options) => {
    recus.push({ texte, referenceMessage: options.referenceMessage, referenceTrace: options.referenceTrace, referenceEmission: options.referenceEmission });
    n += 1; return n === 2 ? { texte: 'ok' } : { texte: 'ok', idMessage: `message-${n}` };
  });
  await soumettre('Mon chien se nomme Rex.');
  await soumettre('sans identité');
  const [b1, b2] = bullesMoi();
  assert.equal(repondreSur(b2), null, 'aucune identité rendue : aucun geste');
  assert.equal(repondreSur(b1).textContent, 'Répondre');
  assert.equal(b1.textContent, 'Mon chien se nomme Rex.', 'le texte de la bulle est intact');
  await clic(repondreSur(b1));
  assert.equal(bandeau().hidden, false);
  assert.equal(bandeau().children[0].textContent, 'En réponse à ton message : « Mon chien se nomme Rex. »');
  await soumettre('Apprends : Fait : moi / chien / Rex.');
  assert.deepEqual(recus[2], { texte: 'Apprends : Fait : moi / chien / Rex.', referenceMessage: { idMessage: 'message-1' }, referenceTrace: null, referenceEmission: null });
  assert.equal(bandeau().hidden, true);
  await soumettre('encore');
  assert.equal(recus[3].referenceMessage, null, 'tour suivant sans nouvelle sélection : aucune référence');
  // extrait court d'un long message
  const long = 'Mon chien qui est très grand et très gentil se nomme Rex.';
  await soumettre(long);
  await clic(repondreSur(bullesMoi()[4]));
  assert.equal(bandeau().children[0].textContent, `En réponse à ton message : « ${long.slice(0, 40)}… »`);
});

test('R7. ÉCRAN : changement de référence avant envoi (la dernière gagne), annulation, exclusivité avec trace et émission, échec d\'envoi (référence gardée pour le nouvel essai)', async () => {
  const recus = []; let n = 0; let echouer = false;
  const { soumettre, bullesMoi, bullesIA, bandeau, repondreSur } = await coquille(async (texte, options) => {
    recus.push({ referenceMessage: options.referenceMessage, referenceTrace: options.referenceTrace, referenceEmission: options.referenceEmission });
    if (echouer) { echouer = false; throw new Error('panne'); }
    n += 1;
    return { texte: 'ok', idMessage: `message-${n}`, idTrace: `trace-${n}`, sollicitation: { observation: { id: 'obs', idMessage: `message-${n}`, possibilites: [] }, univers: [{}], applications: [], choixAFaire: [], automatiques: [], echecDeclenchement: null, attentes: [], echecAttentes: null, emises: [{ idEmission: `emission-${n}`, idExecution: 'x', operation: 'op', valeur: 'v', remise: 'r' }], echecEmission: null } };
  });
  await soumettre('un'); await soumettre('deux');
  const [m1, m2] = bullesMoi();
  await clic(repondreSur(m1)); await clic(repondreSur(m2));
  await soumettre('x');
  assert.deepEqual(recus[2], { referenceMessage: { idMessage: 'message-2' }, referenceTrace: null, referenceEmission: null });
  // annulation
  await clic(repondreSur(m1)); await clic(bandeau().children[1]);
  assert.equal(bandeau().hidden, true);
  await soumettre('y');
  assert.deepEqual(recus[3], { referenceMessage: null, referenceTrace: null, referenceEmission: null });
  // exclusivité : message puis trace → trace ; trace puis message → message ; émission puis message → message ; message puis émission → émission
  const ia = bullesIA()[0];
  const repondreTrace = ia.children.find((c) => c._cls.has('actions-message')).children.find((c) => c._cls.has('reference-reponse')).children[0];
  const repondreEmission = ia.children.find((c) => c._cls.has('emission-naissance')).children[1];
  await clic(repondreSur(m1)); await clic(repondreTrace); await soumettre('a');
  assert.deepEqual(recus[4], { referenceMessage: null, referenceTrace: { idTrace: 'trace-1' }, referenceEmission: null });
  await clic(repondreTrace); await clic(repondreSur(m1)); await soumettre('b');
  assert.deepEqual(recus[5], { referenceMessage: { idMessage: 'message-1' }, referenceTrace: null, referenceEmission: null });
  await clic(repondreEmission); await clic(repondreSur(m1)); await soumettre('c');
  assert.deepEqual(recus[6], { referenceMessage: { idMessage: 'message-1' }, referenceTrace: null, referenceEmission: null });
  await clic(repondreSur(m1)); await clic(repondreEmission); await soumettre('d');
  assert.deepEqual(recus[7], { referenceMessage: null, referenceTrace: null, referenceEmission: { idEmission: 'emission-1' } });
  // échec d'envoi : la référence reste pour le nouvel essai, puis elle est consommée
  await clic(repondreSur(m2)); echouer = true; await soumettre('e');
  assert.deepEqual(recus[8].referenceMessage, { idMessage: 'message-2' });
  assert.equal(bandeau().hidden, false);
  const bulleEchec = bullesMoi().at(-1);
  assert.equal(repondreSur(bulleEchec), null, 'une bulle en échec n\'a pas de geste');
  await soumettre('e');
  assert.deepEqual(recus[9].referenceMessage, { idMessage: 'message-2' });
  await soumettre('f');
  assert.equal(recus[10].referenceMessage, null);
});

test('R8. ÉCRAN (source) : jamais dans le brouillon, jamais lors d\'une reprise, geste seulement hors reprise ; bulles restaurées sans geste', () => {
  assert.match(ECRAN, /referenceMessage: reprise \? null : referenceMessage,/);
  assert.match(ECRAN, /if \(!reprise && typeof idMessageBulle === 'string' && idMessageBulle\.length > 0\) \{/);
  assert.equal(/garderBrouillon\([^)]*referenceMessage/.test(ECRAN), false, 'le brouillon ne garde jamais la référence à un message');
  const rech = ECRAN.slice(ECRAN.indexOf('async function recharger() {'), ECRAN.indexOf('function afficherErreur('));
  assert.equal(/referenceMessage|definirReferenceMessage|reference-message/.test(rech), false, 'les bulles restaurées ne sont pas référençables');
  assert.equal((ECRAN.match(/definirReferenceMessage\(/g) || []).length, 2, 'la définition + le seul geste');
});

// ================================================================================================================ R9. DORMANCE
test('R9. DORMANCE : reference-explicite et referenceMessage ne sont nommés que par les fichiers autorisés ; aucun lecteur nouveau de manifestationsFaits', () => {
  const fichiers = (dir) => readdirSync(dir).flatMap((nom) => { const p = join(dir, nom); return statSync(p).isDirectory() ? fichiers(p) : p.endsWith('.js') ? [p] : []; });
  // même lecture que M8 (tests/manifestations-faits.test.mjs) : lignes de commentaire ET commentaires de fin de ligne retirés
  const code = (p) => readFileSync(p, 'utf8').split('\n').map((l) => l.replace(/\s\/\/ .*$/, '')).filter((l) => !l.trim().startsWith('//')).join('\n');
  const qui = (re) => fichiers(join(RACINE, 'app')).filter((p) => re.test(code(p))).map((p) => p.slice(RACINE.length)).sort();
  // MISE À JOUR DÉLIBÉRÉE v0.64.16 (formes candidates supervisées) : la vue pure et DORMANTE formes-supervisees.js lit les lignes reference-explicite ; aucun fichier de l'application ne l'importe (tests/formes-supervisees.test.mjs FS9).
  assert.deepEqual(qui(/reference-explicite/), ['app/langage/connaissances.js', 'app/langage/formes-supervisees.js', 'app/main.js']);
  assert.deepEqual(qui(/referenceMessage/), ['app/conversation/ecran.js', 'app/main.js']);
  assert.deepEqual(qui(/manifestationsFaits|ManifestationFait|ManifestationsFaits|VOIES_MANIFESTATION/), ['app/langage/connaissances.js', 'app/langage/esprit.js', 'app/main.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.24 : + esprit.js, qui ÉCRIT (jamais ne lit) la manifestation de résolution avec le fait, dans une seule écriture atomique (resoudreIncompatibilite) ; la lecture des manifestations reste dans connaissances.js (lireLignesDivergences, consommée par la vue pure resolutions.js)
  assert.doesNotMatch(MAIN, /lireManifestationsFaits|lireTout\('manifestationsFaits'\)/);
});
