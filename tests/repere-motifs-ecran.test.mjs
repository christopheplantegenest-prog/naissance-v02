// === DEBUT_TEST_REPERE_MOTIFS_ECRAN ===
// TESTS ROUGES SEULEMENT — aucune implémentation n'existe encore.
//
// Objectif : un bouton en LECTURE SEULE dans le laboratoire, qui examine l'ENSEMBLE des
// expériences B1 (aucune sélection manuelle, contrairement au chantier précédent) et appelle le
// VRAI repererMotifs() (induction.js, déjà implémentée et testée, inchangée dans ce chantier) pour
// afficher un constat neutre — aucun jugement, aucune signification, aucune écriture.
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
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

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
    experiencesLister: new Faux(), experiencesEtat: new Faux(), experiencesRapport: new Faux(),
    selectionPositifs: new Faux(), selectionNegatifs: new Faux(), selectionEnvoyer: new Faux(), selectionEtat: new Faux(),
    motifsLister: new Faux(), motifsEtat: new Faux(), motifsRapport: new Faux(),
  };
  el.experiencesRapport.hidden = true;
  el.motifsRapport.hidden = true;
  const carte = {
    'data-langage-experiences-lister': 'experiencesLister',
    'data-langage-experiences-etat': 'experiencesEtat',
    'data-langage-experiences-rapport': 'experiencesRapport',
    'data-langage-selection-positifs': 'selectionPositifs',
    'data-langage-selection-negatifs': 'selectionNegatifs',
    'data-langage-selection-envoyer': 'selectionEnvoyer',
    'data-langage-selection-etat': 'selectionEtat',
    'data-langage-motifs-lister': 'motifsLister',
    'data-langage-motifs-etat': 'motifsEtat',
    'data-langage-motifs-rapport': 'motifsRapport',
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
  const e1 = await enregistrerExperience(magasin, {
    texteRecu: 'Coucou, ma couleur est rouge ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const e2 = await enregistrerExperience(magasin, {
    texteRecu: 'Bonjour, ma ville est Paris ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const e3 = await enregistrerExperience(magasin, {
    texteRecu: 'Coucou, mon nom est Paul ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  return { e1, e2, e3 };
}

// -------------------------------------------------------------------- 1, 2 — lit tout B1, sans sélection
test('[ROUGE] le clic lit l\'ensemble des expériences B1, sans qu\'aucun id ne soit fourni par Christophe', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, /coucou/i);
});

// -------------------------------------------------------------------- 3, 6 — vraies données, vraie couverture
test('[ROUGE] la couverture affichée correspond aux vrais ids des expériences concernées', async () => {
  const { el, magasin } = await monter();
  const { e1, e3 } = await experiencesDeTest(magasin);
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, new RegExp(e1.id));
  assert.match(el.motifsRapport.textContent, new RegExp(e3.id));
});

// -------------------------------------------------------------------- 4 — lexique courant, jamais figé
test('[ROUGE] le lexique utilisé est le lexique COURANT de l\'esprit (un mot fraîchement enseigné compte)', async () => {
  const { el, ecran, magasin } = await monter();
  await enregistrerExperience(magasin, {
    texteRecu: 'Mon gadget est bleu ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  await enregistrerExperience(magasin, {
    texteRecu: 'Mon gadget est rouge ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const e = await ecran.assurerEsprit();
  const { apprendreRelation } = await import('../app/langage/esprit.js');
  await apprendreRelation(e, { mot: 'gadget', relation: 'gadget' });
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, /role:relation/);
});

// -------------------------------------------------------------------- 5 — motifs triviaux affichés, sans jugement
// Regex ANCRÉE en début de ligne (pas une simple recherche de sous-chaîne) : « mot:est » apparaît
// aussi comme fragment d'un gabarit plus long (ex. « role:relation > mot:est »), ce qui laisserait
// passer, sans le détecter, un filtrage qui éliminerait spécifiquement le motif trivial ISOLÉ.
test('[ROUGE] le rapport affiche aussi les motifs triviaux (aucune élimination)', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, /^— mot:est$/m);
});

// -------------------------------------------------------------------- 7 — B1 jamais modifiée
test('[ROUGE] repérer les motifs ne modifie jamais les expériences B1', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  const avant = JSON.stringify(await magasin.lireTout('experiences'));
  await el.motifsLister.declencher('click');
  const apres = JSON.stringify(await magasin.lireTout('experiences'));
  assert.equal(avant, apres);
});

// -------------------------------------------------------------------- 8 — aucun gabaritType créé
test('[ROUGE] aucun gabaritType n\'est créé par ce bouton', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  await el.motifsLister.declencher('click');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
});

// -------------------------------------------------------------------- 9, 10 — jamais induire()/apprendreGabaritType()
test('[STATIQUE] le câblage du bouton n\'appelle jamais induire() ni apprendreGabaritType()', () => {
  const debut = ecranJs.indexOf('data-langage-motifs-lister');
  assert.ok(debut > 0, 'un câblage clairement identifiable est attendu');
  const finZone = ecranJs.indexOf('// Exposés pour le pont conversationnel', debut);
  const bloc = sansCommentaires(finZone > debut ? ecranJs.slice(debut, finZone) : ecranJs.slice(debut, debut + 3000));
  assert.ok(!bloc.includes('apprendreGabaritType'));
  const appelsInduire = bloc.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});

// -------------------------------------------------------------------- 3 — repererMotifs reçoit bien {id, texteRecu},
// jamais l'objet B1 complet (texteRepondu, interpretations, source... n'ont rien à faire dans un module
// pur et isolé, même si repererMotifs() les ignorerait sans erreur aujourd'hui : un futur changement de
// induction.js pourrait un jour lire un champ qu'il ne devrait jamais voir). Garde-fou STATIQUE parce
// qu'aucune donnée de test ne peut distinguer les deux formes par le comportement observé aujourd'hui.
test('[STATIQUE] seuls {id, texteRecu} sont extraits avant l\'appel à repererMotifs (jamais l\'objet B1 complet)', () => {
  const debut = ecranJs.indexOf('data-langage-motifs-lister');
  const finZone = ecranJs.indexOf('// Exposés pour le pont conversationnel', debut);
  const bloc = sansCommentaires(ecranJs.slice(debut, finZone));
  assert.match(bloc, /\.map\(\s*\(?\w+\)?\s*=>\s*\(\{\s*id:\s*\w+\.id,\s*texteRecu:\s*\w+\.texteRecu\s*\}\)\s*\)/);
});

// -------------------------------------------------------------------- 11 — aucun calcul sans clic
test('[ROUGE] aucun calcul ne se produit avant le clic', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  assert.equal(el.motifsEtat.textContent, '');
  assert.equal(el.motifsRapport.textContent, '');
});

// -------------------------------------------------------------------- 12 — jamais persisté, toujours recalculé
test('[ROUGE] le résultat n\'est pas persisté : un second clic reflète une nouvelle expérience apparue entretemps', async () => {
  const { el, magasin } = await monter();
  await experiencesDeTest(magasin);
  await el.motifsLister.declencher('click');
  assert.ok(!el.motifsRapport.textContent.includes('salut'));
  await enregistrerExperience(magasin, {
    texteRecu: 'Salut, ma couleur est verte ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  await enregistrerExperience(magasin, {
    texteRecu: 'Salut, mon nom est Léa ?', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, /salut/i);
});

// -------------------------------------------------------------------- fichiers garantis inchangés
const EMPREINTES_INCHANGEES = {
  'app/langage/induction.js': '9abfd91c7808a272aaadada2c8cd47616a272ec68e563d726e87c977f23d8124',
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
// === FIN_TEST_REPERE_MOTIFS_ECRAN ===
