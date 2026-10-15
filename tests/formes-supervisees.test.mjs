// v0.64.16 — « FORMES CANDIDATES SUPERVISÉES » (GO ChatGPT « v0.64.16 », 14/10/2026). Vue pure et dormante formesSupervisees
// (app/langage/formes-supervisees.js) : revalidation des manifestations reference-explicite, contradictions globales, abstraction individuelle
// texte ↔ champs du fait, signature exacte, familles, contrôle collectif. Aucune Action, aucune écriture, aucun lecteur dans l'application.
// Les manifestations du scénario décisif sont produites par le CHEMIN RÉEL de la v0.64.15 (identité du message, conservation de sa valeur,
// apprendreFait, manifestation L puis M), puis relues après redémarrage (sérialisation complète des tables).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { magasinMemoireVive, nouvelId, enregistrerValeurDonnee, enregistrerManifestationFait, lireManifestationsFaits, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { identifierMessage, conserverValeurMessage } from '../app/langage/pont.js';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { extraireLecon } from '../app/langage/lecon.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { formesSupervisees, MOTIFS_REFUS_SUPERVISION, CHAMPS_FAIT } from '../app/langage/formes-supervisees.js';

const RACINE = new URL('..', import.meta.url).pathname;
const MODULE = readFileSync(join(RACINE, 'app', 'langage', 'formes-supervisees.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').map((l) => l.replace(/\s\/\/ .*$/, '')).filter((l) => !l.trim().startsWith('//')).join('\n');

// --- CHEMIN RÉEL v0.64.15 ---------------------------------------------------------------------------------------------------------------------
async function recevoir(magasin, texte) {
  const message = identifierMessage(texte, { nouvelId });
  await conserverValeurMessage(message, { enregistrerValeur: (entree) => enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// M naturel, geste « Répondre » sur M, leçon L « Apprends : Fait : … », Confirmer : fait, manifestation L, puis manifestation M (onOui).
async function superviser(magasin, e, texteM, texteL) {
  const M = await recevoir(magasin, texteM);
  const L = await recevoir(magasin, texteL);
  const { donnees } = extraireLecon(texteL.replace(/^apprends\s*:\s*/i, '').trim());
  const r = await apprendreFait(e, { ...donnees, origine: 'apprise-conversation' });
  const fait = { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur };
  await enregistrerManifestationFait(magasin, { idMessage: L.id, fait, voie: { nom: 'lecon-technique' } });
  await enregistrerManifestationFait(magasin, { idMessage: M.id, fait: { ...fait }, voie: { nom: 'reference-explicite', idLecon: L.id } });
  return { M, L };
}
async function lignesApresRedemarrage(magasin) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await magasin.lireTout(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(donnees);
  return { magasin: neuf, manifestations: await neuf.lireTout('manifestationsFaits'), valeurs: await neuf.lireTout('valeursDonnees') };
}
// Lignes « à la main » (même forme que les lignes persistées) pour les cas adversariaux : la vue est pure, elle ne lit que des lignes.
function monde() {
  let n = 0;
  const manifestations = []; const valeurs = [];
  const msg = (texte) => { n += 1; const id = `message-${String(n).padStart(3, '0')}`; valeurs.push({ id, valeur: texte }); return id; };
  const sup = (texteM, sujet, relation, valeur) => {
    const fait = { sujet, relation, valeur };
    const L = msg(`Apprends : Fait : ${sujet} / ${relation} / ${valeur}.`);
    manifestations.push({ idMessage: L, fait: { ...fait }, voie: { nom: 'lecon-technique' } });
    const M = msg(texteM);
    manifestations.push({ idMessage: M, fait: { ...fait }, voie: { nom: 'reference-explicite', idLecon: L } });
    return M;
  };
  return { manifestations, valeurs, msg, sup, vue: () => formesSupervisees(manifestations, valeurs) };
}
const SIG_PORTE = [{ jeton: 'Mon' }, { champ: 'relation' }, { jeton: 'porte' }, { jeton: 'le' }, { jeton: 'nom' }, { champ: 'valeur' }, { jeton: '.' }];
const lisible = (s) => s.map((x) => (x.champ ? `<${x.champ}>` : x.jeton)).join(' ');
const etats = (champs) => Object.fromEntries(CHAMPS_FAIT.map((c) => [c, champs[c].etat]));

// ================================================================================================================ FS1. DÉCISIF
test('FS1. décisif : M1/M2/M3 « … porte le nom … » supervisés par le chemin v0.64.15, redémarrage → UNE famille déterminée, relation@1, valeur@5, sujet constanteCandidate moi ; aucune Action', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const t = [];
  t.push(await superviser(magasin, e, 'Mon chien porte le nom Rex.', 'Apprends : Fait : moi / chien / Rex.'));
  t.push(await superviser(magasin, e, 'Mon chien porte le nom Milo.', 'Apprends : Fait : moi / chien / Milo.'));
  t.push(await superviser(magasin, e, 'Mon chat porte le nom Milo.', 'Apprends : Fait : moi / chat / Milo.'));
  const { magasin: neuf, manifestations, valeurs } = await lignesApresRedemarrage(magasin);
  const avant = JSON.stringify({ manifestations, valeurs });
  const vue = formesSupervisees(manifestations, valeurs);
  assert.equal(JSON.stringify({ manifestations, valeurs }), avant, 'entrées intactes');
  assert.deepEqual(vue.refusees, []);
  assert.deepEqual(vue.contradictions, []);
  assert.deepEqual(vue.ambigues, []);
  assert.equal(vue.familles.length, 1, 'les leçons L ne forment aucune famille : seules les manifestations reference-explicite sont des sources');
  const [f] = vue.familles;
  assert.deepEqual(f, {
    signature: SIG_PORTE,
    membres: t.map((x) => x.M.id).sort(),
    champs: { sujet: { etat: 'constanteCandidate', valeurs: ['moi'] }, relation: { etat: 'role', position: 1 }, valeur: { etat: 'role', position: 5 } },
    etat: 'determinee',
  });
  assert.equal(lisible(f.signature), 'Mon <relation> porte le nom <valeur> .');
  assert.deepEqual(await neuf.lireTout('actions'), [], 'aucune Action');
  assert.equal((await lireManifestationsFaits(neuf)).length, 6, 'aucune manifestation ajoutée ni retirée');
});

test('FS2. deux exemples suffisent : « Mon chien porte le nom Rex. » + « Mon chat porte le nom Milo. » → déterminée ; aucun minimum de trois', () => {
  const w = monde();
  w.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex');
  w.sup('Mon chat porte le nom Milo.', 'moi', 'chat', 'Milo');
  const [f] = w.vue().familles;
  assert.equal(f.etat, 'determinee');
  assert.deepEqual(etats(f.champs), { sujet: 'constanteCandidate', relation: 'role', valeur: 'role' });
});

test('FS3. ambiguës et abstention : relation invariante, valeur invariante, champ non placé qui varie ; un seul membre insuffisant', () => {
  const a = monde(); a.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex'); a.sup('Mon chien porte le nom Milo.', 'moi', 'chien', 'Milo');
  const fa = a.vue().familles[0];
  assert.equal(fa.etat, 'ambigue'); assert.deepEqual(fa.champs.relation, { etat: 'roleOuConstante', position: 1, valeurs: ['chien'] });
  const b = monde(); b.sup('Mon chien porte le nom Milo.', 'moi', 'chien', 'Milo'); b.sup('Mon chat porte le nom Milo.', 'moi', 'chat', 'Milo');
  const fb = b.vue().familles[0];
  assert.equal(fb.etat, 'ambigue'); assert.deepEqual(fb.champs.valeur, { etat: 'roleOuConstante', position: 5, valeurs: ['Milo'] });
  const c = monde(); c.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex'); c.sup('Mon chat porte le nom Milo.', 'paul', 'chat', 'Milo');
  const fc = c.vue().familles[0];
  assert.equal(fc.etat, 'abstention'); assert.deepEqual(fc.champs.sujet, { etat: 'inexplique', valeurs: ['moi', 'paul'] });
  const d = monde(); d.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex');
  const fd = d.vue().familles[0];
  assert.equal(fd.etat, 'insuffisante');
  assert.deepEqual(fd.champs, { sujet: { etat: 'nonPlace' }, relation: { etat: 'place', position: 1 }, valeur: { etat: 'place', position: 5 } }, 'constat individuel seulement : jamais constanteCandidate pour un seul membre');
});

// ================================================================================================================ FS4. REVALIDATION
test('FS4. revalidation à la lecture : chaque ligne invalide est REFUSÉE avec sa raison (jamais retirée en silence) ; les autres voies ne sont pas des sources', () => {
  const w = monde();
  const ok = w.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex');
  const F = { sujet: 'moi', relation: 'chat', valeur: 'Milo' };
  const M = () => w.msg('Mon chat porte le nom Milo.');
  const Lt = (fait = F) => { const id = w.msg('Apprends : Fait : moi / chat / Milo.'); w.manifestations.push({ idMessage: id, fait: { ...fait }, voie: { nom: 'lecon-technique' } }); return id; };
  const ref = (idMessage, idLecon, fait = F) => w.manifestations.push({ idMessage, fait: { ...fait }, voie: { nom: 'reference-explicite', ...(idLecon === undefined ? {} : { idLecon }) } });
  const attendu = [];
  const cas = (raison, f) => { const id = f(); attendu.push({ idMessage: id, raison }); };
  cas('fait-invalide', () => { const id = M(); ref(id, Lt(), { sujet: 'moi', relation: 'chat' }); return id; });
  cas('message-irresoluble', () => { const id = 'message-900'; ref(id, Lt()); return id; });
  cas('lecon-absente', () => { const id = M(); ref(id, undefined); return id; });
  cas('auto-reference', () => { const id = M(); ref(id, id); return id; });
  cas('lecon-irresoluble', () => { const id = M(); ref(id, 'message-901'); return id; });
  cas('manifestation-lecon-absente', () => { const id = M(); ref(id, w.msg('Apprends : Fait : moi / chat / Milo.')); return id; });
  cas('lecon-voie-incorrecte', () => { const id = M(); const j = w.msg("Mon chat s'appelle Milo."); w.manifestations.push({ idMessage: j, fait: { ...F }, voie: { nom: 'j1a' } }); ref(id, j); return id; });
  cas('fait-different', () => { const id = M(); ref(id, Lt({ ...F, valeur: 'Félix' })); return id; });
  w.manifestations.push(null, 'texte', { voie: { nom: 'reference-explicite' } });
  attendu.push({ idMessage: null, raison: 'ligne-invalide' });
  const vue = w.vue();
  assert.deepEqual(vue.refusees, attendu.sort((a, b) => ((a.idMessage ?? '') < (b.idMessage ?? '') ? -1 : (a.idMessage ?? '') > (b.idMessage ?? '') ? 1 : 0)));
  assert.deepEqual(new Set(vue.refusees.map((r) => r.raison)), new Set(MOTIFS_REFUS_SUPERVISION), 'toutes les raisons fixes sont exercées');
  assert.deepEqual(vue.familles.map((f) => f.membres), [[ok]], 'seule la ligne valide reste ; les lignes lecon-technique et j1a ne sont jamais des sources');
});

// ================================================================================================================ FS5. ADVERSARIAUX
test('FS5. adversariaux : contradiction globale, relation = valeur, ancre = valeur, champ deux fois, champ absent, multi-mots, signatures distinctes, sujet différent, sujet porté', () => {
  // 1. même texte canonique, faits différents → contradiction, exclusion PARTOUT (aucune n'est choisie)
  const w1 = monde();
  const a = w1.sup('Mon chat porte le nom Milo.', 'moi', 'chat', 'Milo');
  const b = w1.sup('mon chat porte le nom milo.', 'moi', 'animal', 'Milo');
  const c = w1.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex');
  const v1 = w1.vue();
  assert.deepEqual(v1.contradictions, [{ texte: 'mon chat porte le nom milo.', membres: [a, b].sort() }]);
  assert.deepEqual(v1.familles.map((f) => f.membres), [[c]], 'ni a ni b dans aucune famille');
  // casse seule : PAS une contradiction (faits égaux une fois canonisés) ; même famille ? non : jetons littéraux différents (« Mon » / « mon »)
  const w1b = monde(); w1b.sup('Mon chat porte le nom Milo.', 'moi', 'chat', 'Milo'); w1b.sup('Mon chat porte le nom Milo.', 'moi', 'Chat', 'milo');
  assert.deepEqual(w1b.vue().contradictions, []);
  // 2. relation = valeur (un jeton porte deux champs) → membre ambigu ; 4. ancre = valeur ; 5. champ deux fois
  const w2 = monde();
  const d = w2.sup('Mon chat porte le nom Chat.', 'moi', 'chat', 'Chat');
  const h = w2.sup('Mon chien porte le nom Porte.', 'moi', 'chien', 'Porte');
  const r2 = w2.sup('Mon chien Rex porte le nom Rex.', 'moi', 'chien', 'Rex');
  const e2 = w2.sup('Mon Milo porte le nom Rex.', 'moi', 'milo', 'milo');
  const v2 = w2.vue();
  assert.deepEqual(v2.familles, []);
  const parId = Object.fromEntries(v2.ambigues.map((x) => [x.idMessage, x]));
  assert.deepEqual(parId[d], { idMessage: d, champsSurPlusieursPositions: ['relation', 'valeur'], positionsAPlusieursChamps: [1, 5] });
  assert.deepEqual(parId[h], { idMessage: h, champsSurPlusieursPositions: ['valeur'], positionsAPlusieursChamps: [] });
  assert.deepEqual(parId[r2], { idMessage: r2, champsSurPlusieursPositions: ['valeur'], positionsAPlusieursChamps: [] });
  assert.deepEqual(parId[e2], { idMessage: e2, champsSurPlusieursPositions: [], positionsAPlusieursChamps: [1] });
  // 3. champ constant par hasard → famille ambiguë (FS3) ; 6. champ absent → inexpliqué, jamais constante automatique
  const w6 = monde(); w6.sup('Il porte le nom Rex.', 'moi', 'chien', 'Rex'); w6.sup('Il porte le nom Milo.', 'moi', 'chat', 'Milo');
  const f6 = w6.vue().familles[0];
  assert.equal(f6.etat, 'abstention'); assert.deepEqual(f6.champs.relation, { etat: 'inexplique', valeurs: ['chat', 'chien'] });
  // 7. valeur multi-mots → jamais alignée (limite explicite) : mots littéraux dans la signature, singletons insuffisants
  const w7 = monde(); w7.sup('Mes enfants portent le nom Simon et Léa.', 'moi', 'enfants', 'Simon et Léa'); w7.sup('Mes cousins portent le nom Tom et Léa.', 'moi', 'cousins', 'Tom et Léa');
  const v7 = w7.vue();
  assert.deepEqual(v7.familles.map((f) => [lisible(f.signature), f.etat, f.champs.valeur.etat]), [
    ['Mes <relation> portent le nom Simon et Léa .', 'insuffisante', 'nonPlace'],
    ['Mes <relation> portent le nom Tom et Léa .', 'insuffisante', 'nonPlace'],
  ]);
  // 8. deux signatures différentes, même fait → familles distinctes
  const w8 = monde(); w8.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex'); w8.sup("Mon chien s'appelle Rex.", 'moi', 'chien', 'Rex');
  assert.deepEqual(w8.vue().familles.map((f) => [lisible(f.signature), f.etat]), [
    ['Mon <relation> porte le nom <valeur> .', 'insuffisante'],
    ["Mon <relation> s'appelle <valeur> .", 'insuffisante'],
  ]);
  // 9. même signature, sujet différent → inexpliqué / abstention (FS3, cas C)
  // sujet porté textuellement : constaté à sa position ; la compatibilité avec une capacité n'est PAS jugée ici
  const ws = monde(); ws.sup('Le chat de Paul porte le nom Milo.', 'paul', 'chat', 'Milo'); ws.sup('Le chien de Léa porte le nom Rex.', 'léa', 'chien', 'Rex');
  const fs = ws.vue().familles[0];
  assert.equal(lisible(fs.signature), 'Le <relation> de <sujet> porte le nom <valeur> .');
  assert.deepEqual(fs.champs, { sujet: { etat: 'role', position: 3 }, relation: { etat: 'role', position: 1 }, valeur: { etat: 'role', position: 7 } });
  assert.equal(fs.etat, 'determinee');
});

test('FS6. ensemble mélangé : M1/M2/M3 ensemble, « Ma fille se prénomme Léa. » et « Mon chien adore Rex. » séparés', () => {
  const w = monde();
  const m1 = w.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex');
  const m2 = w.sup('Mon chien porte le nom Milo.', 'moi', 'chien', 'Milo');
  const x1 = w.sup('Ma fille se prénomme Léa.', 'moi', 'fille', 'Léa');
  const x2 = w.sup('Mon chien adore Rex.', 'moi', 'chien', 'Rex');
  const m3 = w.sup('Mon chat porte le nom Milo.', 'moi', 'chat', 'Milo');
  assert.deepEqual(w.vue().familles.map((f) => [lisible(f.signature), f.membres, f.etat]), [
    ['Ma <relation> se prénomme <valeur> .', [x1], 'insuffisante'],
    ['Mon <relation> adore <valeur> .', [x2], 'insuffisante'],
    ['Mon <relation> porte le nom <valeur> .', [m1, m2, m3], 'determinee'],
  ]);
});

// ================================================================================================================ FS7. ORDRE, PURETÉ, ERREURS
test('FS7. ordre d\'entrée permuté → résultat identique ; entrées gelées acceptées et intactes ; sortie neuve ; erreurs de contrat', () => {
  const w = monde();
  w.sup('Mon chien porte le nom Rex.', 'moi', 'chien', 'Rex'); w.sup('Mon chien porte le nom Milo.', 'moi', 'chien', 'Milo');
  w.sup('Mon chat porte le nom Milo.', 'moi', 'chat', 'Milo'); w.sup('Mon chat porte le nom Chat.', 'moi', 'chat', 'Chat');
  w.sup('mon chat porte le nom milo.', 'moi', 'animal', 'Milo'); w.sup('Ma fille se prénomme Léa.', 'moi', 'fille', 'Léa');
  w.manifestations.push({ idMessage: 'message-999', fait: { sujet: 'moi', relation: 'x', valeur: 'y' }, voie: { nom: 'reference-explicite', idLecon: 'message-998' } });
  const reference = w.vue();
  const permutations = [[...w.manifestations].reverse(), [...w.manifestations.slice(3), ...w.manifestations.slice(0, 3)], [...w.manifestations].sort((a, b) => JSON.stringify(b).localeCompare(JSON.stringify(a)))];
  for (const p of permutations) assert.deepEqual(formesSupervisees(p, [...w.valeurs].reverse()), reference);
  const geler = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(geler); Object.freeze(o); } return o; };
  const avant = JSON.stringify([w.manifestations, w.valeurs]);
  const vueGelee = formesSupervisees(geler(w.manifestations), geler(w.valeurs));
  assert.equal(JSON.stringify([w.manifestations, w.valeurs]), avant);
  assert.deepEqual(vueGelee, reference);
  vueGelee.familles[0].signature[0].jeton = 'modifié';
  assert.deepEqual(formesSupervisees(w.manifestations, w.valeurs), reference, 'aucune structure partagée entre deux appels');
  assert.throws(() => formesSupervisees(null, []), TypeError);
  assert.throws(() => formesSupervisees([], {}), TypeError);
  const r = { idMessage: 'message-1', fait: { sujet: 'a', relation: 'b', valeur: 'c' }, voie: { nom: 'lecon-technique' } };
  assert.throws(() => formesSupervisees([r, { ...r }], []), /identité dupliquée/);
});

test('FS8. PURETÉ (source) : importe seulement tokeniser et canoniser ; ni magasin, ni écriture, ni horloge, ni hasard ; aucune opération, Action ni positionsDistinguees', () => {
  const code = sansCommentaires(MODULE);
  const imports = code.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.deepEqual(imports, ["import { tokeniser } from './transformation.js';", "import { canoniser } from './canon.js';"]);
  assert.equal(/magasin|ecrire|lireTout|Date\b|Math\.random|localStorage|indexedDB|await|async/.test(code), false);
  assert.equal(/proposerFait|evaluerAction|apprendreAction|positionsDistinguees|CAPACITES|registre/.test(code), false);
});

// ================================================================================================================ FS9. DORMANCE
test('FS9. DORMANCE : seul formes-confirmees.js (v0.64.17) importe et nomme formes-supervisees / formesSupervisees ; VERSION_BASE et SCHEMA_SAUVEGARDE suivent la base', () => {
  const fichiers = (dir) => readdirSync(dir).flatMap((nom) => { const p = join(dir, nom); return statSync(p).isDirectory() ? fichiers(p) : /\.(m?js|html)$/.test(p) ? [p] : []; });
  const lecteurs = fichiers(join(RACINE, 'app')).filter((p) => !p.endsWith('formes-supervisees.js') && /formes-supervisees|formesSupervisees/.test(readFileSync(p, 'utf8'))).map((p) => p.slice(RACINE.length));
  assert.deepEqual(lecteurs, ['app/langage/formes-confirmees.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.17 (jalon E2) : formes-confirmees.js est le lecteur prévu de la vue (famille de la nouvelle supervision) ; la vue elle-même reste pure et inchangée
  for (const f of ['sw.js', join('app', 'sw.js'), 'index.html']) assert.equal(/formes-supervisees/.test(readFileSync(join(RACINE, f), 'utf8')), false, f);
  assert.equal(VERSION_BASE, 28); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 18); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables)
});
