// === DEBUT_TEST_SELECTION_INDUCTION_ECRAN ===
// TESTS ROUGES SEULEMENT — aucune implémentation n'existe encore.
//
// Objectif : depuis le laboratoire, choisir des expériences B1 comme POSITIVES ou NÉGATIVES (jamais
// implicitement, jamais par complément) puis alimenter le VRAI banc d'essai d'induction déjà existant
// (v0.17.7, boutons Lancer/Confirmer/Annuler, mini-test) SANS retaper aucune phrase. Aucun second
// moteur d'induction : preparerEntreesInduction() (déjà implémentée, connaissances.js inchangée dans
// ce chantier) fournit les textes ; induire()/apprendreGabaritType()/comprendre() restent 100% ceux
// déjà en place et déjà testés ailleurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  magasinMemoireVive, enregistrerExperience,
} from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const indexHtml = readFileSync(join(RACINE_APP, 'index.html'), 'utf8');

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
class Faux {
  constructor() { this.listeners = {}; this.disabled = false; this.hidden = false; this.textContent = ''; this.value = ''; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  async declencher(t) { for (const f of this.listeners[t] || []) await f({ preventDefault() {} }); }
}
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

async function monter() {
  const magasin = magasinMemoireVive();
  const el = {
    inductionPositifs: new Faux(), inductionNegatifs: new Faux(), inductionSignification: new Faux(),
    inductionLancer: new Faux(), inductionConfirmer: new Faux(), inductionAnnuler: new Faux(),
    inductionEtat: new Faux(), inductionRapport: new Faux(),
    inductionTestTexte: new Faux(), inductionTestLancer: new Faux(), inductionTestResultat: new Faux(),
    experiencesLister: new Faux(), experiencesEtat: new Faux(), experiencesRapport: new Faux(),
    selectionPositifs: new Faux(), selectionNegatifs: new Faux(), selectionEnvoyer: new Faux(), selectionEtat: new Faux(),
  };
  el.inductionConfirmer.disabled = true; el.inductionAnnuler.disabled = true;
  el.inductionRapport.hidden = true; el.experiencesRapport.hidden = true;
  const carte = {
    'data-langage-induction-positifs': 'inductionPositifs',
    'data-langage-induction-negatifs': 'inductionNegatifs',
    'data-langage-induction-signification': 'inductionSignification',
    'data-langage-induction-lancer': 'inductionLancer',
    'data-langage-induction-confirmer': 'inductionConfirmer',
    'data-langage-induction-annuler': 'inductionAnnuler',
    'data-langage-induction-etat': 'inductionEtat',
    'data-langage-induction-rapport': 'inductionRapport',
    'data-langage-induction-test-texte': 'inductionTestTexte',
    'data-langage-induction-test-lancer': 'inductionTestLancer',
    'data-langage-induction-test-resultat': 'inductionTestResultat',
    'data-langage-experiences-lister': 'experiencesLister',
    'data-langage-experiences-etat': 'experiencesEtat',
    'data-langage-experiences-rapport': 'experiencesRapport',
    'data-langage-selection-positifs': 'selectionPositifs',
    'data-langage-selection-negatifs': 'selectionNegatifs',
    'data-langage-selection-envoyer': 'selectionEnvoyer',
    'data-langage-selection-etat': 'selectionEtat',
  };
  const zone = {
    querySelector: (sel) => {
      const m = sel.match(/^\[([a-z0-9-]+)\]$/);
      const cle = m && carte[m[1]];
      return cle ? el[cle] : universel();
    },
  };
  const ecran = monterEcranLangage({ zone, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { el, ecran, magasin };
}

async function experiencesDeTest(magasin) {
  const pos1 = await enregistrerExperience(magasin, {
    texteRecu: 'Salut, mon manteau est bleu.', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const pos2 = await enregistrerExperience(magasin, {
    texteRecu: 'Salut, ma couleur est rouge.', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const neg1 = await enregistrerExperience(magasin, {
    texteRecu: 'Mon manteau est bleu.', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const neutre = await enregistrerExperience(magasin, {
    texteRecu: 'Salut, mon vélo est cassé.', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  return { pos1, pos2, neg1, neutre };
}

// -------------------------------------------------------------------- 1, 4 — positif, sans retaper
test('[ROUGE] un id positif envoyé remplit le champ positifs d\'induction avec le vrai texteRecu (jamais retapé)', async () => {
  const { el, magasin } = await monter();
  const { pos1 } = await experiencesDeTest(magasin);
  el.selectionPositifs.value = pos1.id;
  await el.selectionEnvoyer.declencher('click');
  assert.equal(el.inductionPositifs.value, 'Salut, mon manteau est bleu.');
});

// -------------------------------------------------------------------- 2 — négatif
test('[ROUGE] un id négatif envoyé remplit le champ négatifs d\'induction avec le vrai texteRecu', async () => {
  const { el, magasin } = await monter();
  const { pos1, neg1 } = await experiencesDeTest(magasin);
  el.selectionPositifs.value = pos1.id;
  el.selectionNegatifs.value = neg1.id;
  await el.selectionEnvoyer.declencher('click');
  assert.equal(el.inductionNegatifs.value, 'Mon manteau est bleu.');
});

// -------------------------------------------------------------------- 3 — neutre = absent des deux
test('[ROUGE] une expérience ni positive ni négative (neutre) n\'apparaît dans aucun des deux champs', async () => {
  const { el, magasin } = await monter();
  const { pos1, neg1, neutre } = await experiencesDeTest(magasin);
  el.selectionPositifs.value = pos1.id;
  el.selectionNegatifs.value = neg1.id;
  await el.selectionEnvoyer.declencher('click');
  assert.ok(!el.inductionPositifs.value.includes('Salut, mon vélo est cassé.'));
  assert.ok(!el.inductionNegatifs.value.includes('Salut, mon vélo est cassé.'));
  void neutre;
});

// -------------------------------------------------------------------- plusieurs positifs, plusieurs formats de séparation
test('[ROUGE] plusieurs ids (séparés par virgule ou saut de ligne) sont tous résolus, dans l\'ordre', async () => {
  const { el, magasin } = await monter();
  const { pos1, pos2 } = await experiencesDeTest(magasin);
  el.selectionPositifs.value = `${pos1.id}, ${pos2.id}`;
  await el.selectionEnvoyer.declencher('click');
  assert.equal(el.inductionPositifs.value, 'Salut, mon manteau est bleu.\nSalut, ma couleur est rouge.');
});

// -------------------------------------------------------------------- id inconnu : erreur propre, rien n'est écrit
test('[ROUGE] un id inconnu est signalé proprement, sans planter et sans modifier les champs d\'induction', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  el.selectionPositifs.value = 'experience-inexistante';
  el.inductionPositifs.value = '';
  await el.selectionEnvoyer.declencher('click');
  assert.equal(el.inductionPositifs.value, '');
  assert.match(el.selectionEtat.textContent, /inconnue|introuvable|erreur/i);
});

// -------------------------------------------------------------------- 5, 6, 7, 8 — bout en bout avec le VRAI moteur existant
test('[ROUGE→VERT ATTENDU] bout en bout : sélection -> vrai induire() -> confirmation -> gabaritType -> mini-test', async () => {
  const { el, ecran, magasin } = await monter();
  const { pos1, pos2, neg1 } = await experiencesDeTest(magasin);

  el.selectionPositifs.value = `${pos1.id}\n${pos2.id}`;
  el.selectionNegatifs.value = neg1.id;
  await el.selectionEnvoyer.declencher('click');

  // Le VRAI bouton d'induction déjà existant, jamais un nouveau mécanisme.
  await el.inductionLancer.declencher('click');
  assert.match(el.inductionEtat.textContent, /hypothèse/);
  assert.equal(el.inductionConfirmer.disabled, false);

  el.inductionSignification.value = 'SALUTATION';
  await el.inductionConfirmer.declencher('click');
  assert.match(el.inductionEtat.textContent, /Confirmé/);

  const gabarits = await magasin.lireTout('gabaritsTypes');
  assert.equal(gabarits.length, 1);
  assert.equal(gabarits[0].signification, 'SALUTATION');

  // Mini-test existant, sur une phrase jamais utilisée pour l'induction.
  el.inductionTestTexte.value = 'Salut, mon prénom est Paul.';
  await el.inductionTestLancer.declencher('click');
  assert.match(el.inductionTestResultat.textContent, /SALUTATION/);
  void ecran;
});

// -------------------------------------------------------------------- 9 — B1 jamais modifiée
test('[ROUGE] la sélection et l\'induction ne modifient jamais les expériences B1', async () => {
  const { el, magasin } = await monter();
  const { pos1, pos2, neg1 } = await experiencesDeTest(magasin);
  const avant = JSON.stringify(await magasin.lireTout('experiences'));
  el.selectionPositifs.value = `${pos1.id},${pos2.id}`;
  el.selectionNegatifs.value = neg1.id;
  await el.selectionEnvoyer.declencher('click');
  await el.inductionLancer.declencher('click');
  const apres = JSON.stringify(await magasin.lireTout('experiences'));
  assert.equal(avant, apres);
});

// -------------------------------------------------------------------- 10 — aucun déclenchement automatique
test('[ROUGE] envoyer la sélection seule (sans cliquer Lancer) ne crée aucun gabaritType et ne lance rien', async () => {
  const { el, magasin } = await monter();
  const { pos1, pos2 } = await experiencesDeTest(magasin);
  el.selectionPositifs.value = `${pos1.id},${pos2.id}`;
  await el.selectionEnvoyer.declencher('click');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
  assert.equal(el.inductionConfirmer.disabled, true);
});

// -------------------------------------------------------------------- pas de second moteur : un seul jeu de champs d'induction
test('[STATIQUE] index.html ne contient qu\'un seul jeu de champs d\'induction (pas de moteur dupliqué)', () => {
  const occurrencesPositifs = (indexHtml.match(/data-langage-induction-positifs/g) || []).length;
  const occurrencesNegatifs = (indexHtml.match(/data-langage-induction-negatifs/g) || []).length;
  assert.equal(occurrencesPositifs, 1);
  assert.equal(occurrencesNegatifs, 1);
});

test('[STATIQUE] le câblage de sélection appelle preparerEntreesInduction, jamais induire directement', () => {
  const debut = ecranJs.indexOf('SÉLECTION D\'EXPÉRIENCES POUR L\'INDUCTION');
  assert.ok(debut > 0, 'un bloc de câblage clairement nommé est attendu');
  const finZone = ecranJs.indexOf('bInductionLancer.addEventListener', debut);
  const bloc = finZone > debut ? ecranJs.slice(debut, finZone) : ecranJs.slice(debut, debut + 3000);
  assert.ok(bloc.includes('preparerEntreesInduction'));
  const sansCommentaires = bloc.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!sansCommentaires.includes('induire('), 'le câblage de sélection ne doit jamais appeler induire() lui-même');
});

// -------------------------------------------------------------------- fichiers garantis inchangés
const EMPREINTES_INCHANGEES = {
  'app/langage/induction.js': 'c34eda8862b4985bcc7ae13ddcb67b1a1be3e6dbbc3c7890f1f1baa457b6f10c',
  'app/langage/comprendre.js': '97b9bb99cd52a566d1213c7713dcf689cf6ee39b0c0000cb34c1a64f48828535',
  'app/langage/esprit.js': '0d2f6c906f1a110829bfaa633ef94c1bc295009310e0bbae04a441aea7be2fe7',
  'app/main.js': '806d34f91a4c34d5da64f797f653d92c0392fbde99e26a7d08a36ecf82615f54',
  'app/langage/pont.js': 'c35b39da67b9877781a992c0f9336226f86187ba7c3923d646cddeb30acc4c74',
  'app/langage/connaissances.js': '13391528d22f2053dde21d511885f4aa6bcb38b2276c544687e4b67f464b71f4',
};
for (const [chemin, empreinte] of Object.entries(EMPREINTES_INCHANGEES)) {
  test(`[GARDE] ${chemin} reste strictement inchangé pendant ce chantier`, () => {
    const contenu = readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
    const reelle = crypto.createHash('sha256').update(contenu).digest('hex');
    assert.equal(reelle, empreinte, `${chemin} a été modifié -- interdit pendant ce chantier`);
  });
}
// === FIN_TEST_SELECTION_INDUCTION_ECRAN ===
