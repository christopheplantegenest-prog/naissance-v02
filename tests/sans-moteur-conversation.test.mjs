// ticket-39 — jalon « repli-conversation-sans-moteur » : quand le choix « Utiliser Naissance sans moteur externe » est actif,
// la conversation s'ouvre sans clé (etat() rend 'pret'), les voies locales gardent leur priorité inchangée, et seul l'endroit
// où le modèle externe serait appelé est remplacé par une réponse FIXE, identifiable, sans aucun effet cognitif.
// Mode désactivé : chaque ajout est derrière if (lireSansMoteur()) et le chemin reste celui d'avant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTE_REPLI_SANS_MOTEUR, reponseSansMoteur, lireSansMoteur, ecrireSansMoteur } from '../app/reglages/sans-moteur.js';

const RACINE = fileURLToPath(new URL('../', import.meta.url));
const lu = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const MAIN = lu('app/main.js');
const CODE = sansCommentaires(MAIN);

const TEXTE_ATTENDU = "Je n'ai pas de réponse locale à ce message. Le mode sans moteur externe est activé : je n'ai rien demandé à un autre modèle.";

function stockageMemoire(initial = {}) {
  const m = new Map(Object.entries(initial));
  const s = {
    ecritures: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.ecritures += 1; m.set(k, String(v)); },
    removeItem: (k) => { s.ecritures += 1; m.delete(k); },
  };
  return s;
}

// ------------------------------------------------------------------------------------------------ repli : valeur exacte
test('reponseSansMoteur rend exactement { texte: TEXTE_REPLI_SANS_MOTEUR, repli: \'sans-moteur\' }, sans aucun champ cognitif', () => {
  assert.equal(TEXTE_REPLI_SANS_MOTEUR, TEXTE_ATTENDU);
  const r = reponseSansMoteur();
  assert.deepEqual(r, { texte: TEXTE_ATTENDU, repli: 'sans-moteur' });
  assert.deepEqual(Object.keys(r).sort(), ['repli', 'texte']);
  for (const champ of ['confirmation', 'idExperience', 'idTrace', 'idReponseLocale', 'idQuestion', 'idReponse', 'local', 'actions', 'note', 'voieProposition']) {
    assert.equal(Object.hasOwn(r, champ), false, champ);
  }
  // Un objet neuf à chaque appel : aucun état partagé entre deux tours.
  const r2 = reponseSansMoteur();
  assert.notEqual(r, r2);
  assert.deepEqual(r2, r);
});

test('texte du repli : honnête (« pas de réponse locale »), sans promesse de reprise ni message d\'erreur', () => {
  assert.ok(TEXTE_REPLI_SANS_MOTEUR.includes('pas de réponse locale'));
  for (const interdit of [/répondre/i, /gardé/i, /Réessayer/i, /pas encore de moteur/i, /moteur pour parler/i, /Naissance est prête/i]) {
    assert.doesNotMatch(TEXTE_REPLI_SANS_MOTEUR, interdit, String(interdit));
  }
});

test('reponseSansMoteur ne lit ni n\'écrit aucun stockage ; le choix reste indépendant du repli', () => {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const espion = stockageMemoire();
  let lectures = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { lectures += 1; return espion; } });
  try {
    reponseSansMoteur();
    assert.equal(lectures, 0);
    assert.equal(espion.ecritures, 0);
  } finally {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant);
    else delete globalThis.localStorage;
  }
});

test('persistance du choix et retour au mode normal : activé puis désactivé, relu tel quel (aucune activation automatique)', () => {
  const s = stockageMemoire();
  assert.equal(lireSansMoteur(s), false, 'désactivé par défaut');
  assert.equal(s.ecritures, 0, 'la lecture n\'active rien');
  ecrireSansMoteur(true, s);
  assert.equal(lireSansMoteur(s), true);
  assert.equal(lireSansMoteur(s), true, 'relu après « rechargement »');
  ecrireSansMoteur(false, s);
  assert.equal(lireSansMoteur(s), false, 'retour au mode normal');
  assert.equal(s.ecritures, 2);
});

// ------------------------------------------------------------------------------------------------ statique : traiterTour
const corpsTour = CODE.slice(CODE.indexOf('async function traiterTour('), CODE.indexOf('const conversation = monterConversation('));

test('[statique] main.js : le bloc de repli est après tenterPontLangage, local.local et O6, juste avant esprit.repondre', () => {
  const iPont = corpsTour.indexOf('const local = await tenterPontLangage(texte, {');
  const iLocal = corpsTour.indexOf('if (local && local.local) {');
  const iO6 = corpsTour.indexOf("return { texte: 'Je garde ta réaction à ma réponse");
  const iBloc = corpsTour.indexOf('if (lireSansMoteur()) {');
  const iGemini = corpsTour.indexOf('const reponse = await esprit.repondre(texte, options);');
  assert.ok(iPont > 0 && iPont < iLocal && iLocal < iO6 && iO6 < iBloc && iBloc < iGemini, `${iPont} ${iLocal} ${iO6} ${iBloc} ${iGemini}`);
  assert.equal(corpsTour.split('if (lireSansMoteur()) {').length - 1, 1, 'un seul bloc de repli');
  // Entre la fin du retour O6 et le bloc : seulement la fermeture du bloc O6 (aucune autre instruction intercalée).
  const entre = corpsTour.slice(iO6, iBloc);
  assert.match(entre, /^return \{ texte: 'Je garde ta réaction à ma réponse[^\n]*\n\s*\}\s*$/);
});

test('[statique] main.js : le bloc de repli ne contient que console.info et return reponseSansMoteur();', () => {
  const iBloc = corpsTour.indexOf('if (lireSansMoteur()) {');
  const iGemini = corpsTour.indexOf('const reponse = await esprit.repondre(texte, options);');
  const bloc = corpsTour.slice(iBloc, iGemini);
  assert.match(bloc, /^if \(lireSansMoteur\(\)\) \{\n\s*console\.info\(`\[naissance\] repli sans moteur externe \(\$\{[^\n]*\}\)`\);\n\s*return reponseSansMoteur\(\);\n\s*\}\n\s*$/);
  assert.doesNotMatch(bloc, /esprit|assurerEsprit|enregistrer|ecrire|proposer|consolider|journaliser|apprendre|moteurExterne|moteurActuel|fetch|await/);
  // L'identité du message est celle reçue par traiterTour (message-N), jamais recherchée.
  assert.match(bloc, /message && typeof message\.id === 'string' \? message\.id : '\?'/);
});

test('[statique] main.js : mode désactivé, la suite du tour (modèle externe, tentative, rangement) reste celle d\'avant', () => {
  const iGemini = corpsTour.indexOf('const reponse = await esprit.repondre(texte, options);');
  const suite = corpsTour.slice(iGemini);
  assert.equal((CODE.match(/esprit\.repondre\(/g) || []).length, 1);
  assert.match(suite, /if \(local && local\.tentative\) \{\n\s*const experience = await enregistrerExperienceTentativeEchouee\(texte, local\.tentative, reponse, \{ \.\.\.experienceDeps, referenceTrace \}\);/);
  assert.match(suite, /setTimeout\(\(\) => esprit\.consoliderSiBesoin\(\), 1500\);\n\s*return reponse;\n\}/);
  assert.doesNotMatch(suite.slice(0, suite.indexOf('\n}\n')), /SansMoteur/);
});

// ------------------------------------------------------------------------------------------------ statique : etat, conditions
test('[statique] main.js : etat() rend \'pret\' sous lireSansMoteur, après le contrôle a-naitre et avant etatReglages()', () => {
  const debut = CODE.indexOf('async function etat() {');
  assert.ok(debut > 0);
  const corps = CODE.slice(debut, CODE.indexOf('\n}\n', debut));
  const iNaitre = corps.indexOf("if (!(await memoire.estNee())) return 'a-naitre';");
  const iSans = corps.indexOf("if (lireSansMoteur()) return 'pret';");
  const iReglages = corps.indexOf('etatReglages()');
  assert.ok(iNaitre > 0 && iNaitre < iSans && iSans < iReglages, `${iNaitre} ${iSans} ${iReglages}`);
  // Le reste d'etat() est inchangé.
  assert.match(corps, /const externe = etatReglages\(\);\n\s*if \(externe === 'pret'\) return 'pret';\n\s*if \(lireReglagesLocaux\(\)\.mode !== 'externe-seul' && moteurLocal\.utilisable\(\)\) return 'pret';\n\s*return externe;/);
});

test('[statique] main.js : exactement 4 occurrences de lireSansMoteur hors import, toutes des conditions (etat, repli, peutDemanderPlusFort, lancerRangement)', () => {
  const lignes = CODE.split('\n').filter((l) => l.includes('lireSansMoteur'));
  const horsImport = lignes.filter((l) => !/^import\s/.test(l));
  assert.equal(lignes.length - horsImport.length, 1, 'un seul import');
  assert.equal(horsImport.length, 4);
  assert.equal((CODE.match(/lireSansMoteur/g) || []).length, 5);
  for (const l of horsImport) assert.match(l, /^\s*if \(lireSansMoteur\(\)\) /, l);
  assert.equal((CODE.match(/if \(lireSansMoteur\(\)\) /g) || []).length, 4);
});

test('[statique] main.js : peutDemanderPlusFort rend false sous lireSansMoteur, sinon !!moteurExterne() comme avant', () => {
  assert.match(CODE, /peutDemanderPlusFort: \(\) => \{\n\s*if \(lireSansMoteur\(\)\) return false;\n\s*return !!moteurExterne\(\);\n\s*\},/);
  assert.equal((CODE.match(/peutDemanderPlusFort:/g) || []).length, 1);
});

test('[statique] main.js : lancerRangement ne fait rien sous lireSansMoteur, sinon rangement inchangé', () => {
  assert.match(CODE, /async function lancerRangement\(\) \{\n\s*if \(lireSansMoteur\(\)\) return;\s*\n\s*const absence = await esprit\.estRevenueApresAbsence\(\);\n\s*esprit\.consoliderSiBesoin\(\{ absence \}\);\n\}/);
});

test('[statique] le module sans-moteur n\'importe rien et ne parle à aucun réseau ni modèle', () => {
  const MODULE = lu('app/reglages/sans-moteur.js');
  assert.doesNotMatch(MODULE, /^\s*import\b/m);
  for (const interdit of ['fetch', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'Math.random', 'Date.now']) {
    assert.equal(MODULE.includes(interdit), false, interdit);
  }
});

// ------------------------------------------------------------------------------------------------ statique : aucun fichier cognitif touché
function fichiers(dossier) {
  const sortie = [];
  for (const nom of readdirSync(join(RACINE, dossier))) {
    const chemin = join(dossier, nom);
    if (statSync(join(RACINE, chemin)).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(m?js|html|json)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

test('[statique] aucun fichier de app/conversation, app/esprit, app/langage, app/memoire ne nomme sans-moteur', () => {
  let vus = 0;
  for (const dossier of ['app/conversation', 'app/esprit', 'app/langage', 'app/memoire']) {
    for (const f of fichiers(dossier)) {
      vus += 1;
      assert.equal(/sans-moteur|SansMoteur|SANS_MOTEUR/.test(lu(f)), false, f);
    }
  }
  assert.ok(vus > 0);
});
