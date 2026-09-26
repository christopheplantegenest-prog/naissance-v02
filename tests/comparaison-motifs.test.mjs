// === DEBUT_TEST_COMPARAISON_MOTIFS ===
// TESTS ROUGES D'ABORD — aucune implémentation n'existe encore pour cette partie.
//
// Objectif (cadrage ChatGPT du 26/09/2026, étape A « comparaison du vécu ») : Naissance peut
// comparer FACTUELLEMENT les expériences déjà couvertes par un même motif -- ce qui est identique
// entre elles, ce qui diffère -- à partir des informations DÉJÀ enregistrées dans B1 (sujet,
// relation, type, motsInconnus, tels que comprendre() les avait déterminés au moment réel de
// l'échange). AUCUNE cause, AUCUNE signification, AUCUN score, AUCUNE notion d'importance : un
// simple test d'égalité, champ par champ, sur des valeurs déjà écrites.
//
// Architecture retenue : une CINQUIÈME fonction sœur pure, comparerMotifs(motifs,
// infoDetailleeParId), ajoutée dans induction.js à côté de repererMotifs()/
// repartirMotifsParEtat()/chronologieMotifs()/motifsAvecVariationDEtat() (aucune des quatre
// modifiée). Elle reçoit les motifs déjà produits et une table id→{sujet, relation, type,
// motsInconnus} DÉJÀ RÉSOLUE par l'appelant (même contrat que les fonctions sœurs précédentes :
// jamais l'objet expérience complet, cette résolution reste dans app/langage/ecran.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  repererMotifs, repartirMotifsParEtat, chronologieMotifs, motifsAvecVariationDEtat, comparerMotifs,
} from '../app/langage/induction.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const induireSource = readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// -------------------------------------------------------------------- fixtures pures (aucun magasin)
const MOTIF = { gabarit: [{ mot: 'comment' }], cle: 'mot:comment', couverture: ['e1', 'e2'] };

function infoDeTest() {
  return new Map([
    ['e1', { sujet: 'naissance', relation: 'nom', type: 'question_information', motsInconnus: [] }],
    ['e2', { sujet: null, relation: 'nom', type: 'question_information', motsInconnus: [] }],
  ]);
}

// -------------------------------------------------------------------- 1, 2 — champ différent, champ identique
test('[ROUGE] un champ dont la valeur diffère entre les expériences est rapporté « identique: false »', () => {
  const [m] = comparerMotifs([MOTIF], infoDeTest());
  assert.equal(m.distinction.sujet.identique, false);
});
test('[ROUGE] un champ dont la valeur est la même dans toutes les expériences est rapporté « identique: true »', () => {
  const [m] = comparerMotifs([MOTIF], infoDeTest());
  assert.equal(m.distinction.relation.identique, true);
  assert.equal(m.distinction.type.identique, true);
});

// -------------------------------------------------------------------- 3 — traçabilité : les valeurs par id sont conservées
test('[ROUGE] chaque champ conserve la valeur EXACTE observée par expérience, traçable par id', () => {
  const [m] = comparerMotifs([MOTIF], infoDeTest());
  assert.deepEqual(m.distinction.sujet.valeurs, [{ id: 'e1', valeur: 'naissance' }, { id: 'e2', valeur: null }]);
});

// -------------------------------------------------------------------- 4 — null est une valeur à part entière, jamais fusionnée
test('[ROUGE] null est une valeur comme une autre : sujet=null n\'est jamais confondu avec sujet absent ou identique à autre chose', () => {
  const info = new Map([
    ['e1', { sujet: null, relation: 'nom', type: 'question_information', motsInconnus: [] }],
    ['e2', { sujet: null, relation: 'nom', type: 'question_information', motsInconnus: [] }],
  ]);
  const [m] = comparerMotifs([MOTIF], info);
  assert.equal(m.distinction.sujet.identique, true, 'deux null sont bien la même valeur');
});

// -------------------------------------------------------------------- 5 — motsInconnus (tableau) comparé par contenu exact
test('[ROUGE] motsInconnus identique (même tableau, même ordre) est rapporté « identique: true »', () => {
  const info = new Map([
    ['e1', { sujet: 'naissance', relation: 'nom', type: 'question_information', motsInconnus: ['bibendumesque'] }],
    ['e2', { sujet: 'x', relation: 'nom', type: 'question_information', motsInconnus: ['bibendumesque'] }],
  ]);
  const [m] = comparerMotifs([MOTIF], info);
  assert.equal(m.distinction.motsInconnus.identique, true);
});
test('[ROUGE] motsInconnus différent (contenu ou ordre différent) est rapporté « identique: false »', () => {
  const info = new Map([
    ['e1', { sujet: 'naissance', relation: 'nom', type: 'question_information', motsInconnus: ['bibendumesque'] }],
    ['e2', { sujet: 'naissance', relation: 'nom', type: 'question_information', motsInconnus: [] }],
  ]);
  const [m] = comparerMotifs([MOTIF], info);
  assert.equal(m.distinction.motsInconnus.identique, false);
});

// -------------------------------------------------------------------- 6 — un seul id dans la couverture : rien à comparer, mais aucune erreur
test('[ROUGE] un motif couvrant une seule expérience reste « identique: true » sur tous les champs (rien à contredire)', () => {
  const motif = { ...MOTIF, couverture: ['e1'] };
  const [m] = comparerMotifs([motif], infoDeTest());
  for (const champ of ['sujet', 'relation', 'type', 'motsInconnus']) assert.equal(m.distinction[champ].identique, true);
});

// -------------------------------------------------------------------- 7 — id absent de la table : rapporté séparément, jamais fabriqué
test('[ROUGE] un id de couverture absent de la table est rapporté dans nonResolues, jamais inclus dans la comparaison', () => {
  const info = new Map([['e1', { sujet: 'naissance', relation: 'nom', type: 'question_information', motsInconnus: [] }]]);
  const motif = { ...MOTIF, couverture: ['e1', 'fantome'] };
  const [m] = comparerMotifs([motif], info);
  assert.deepEqual(m.nonResolues, ['fantome']);
  assert.deepEqual(m.distinction.sujet.valeurs.map((v) => v.id), ['e1']);
});

// -------------------------------------------------------------------- 8 — aucune mutation, aucun champ en plus que distinction/nonResolues
test('[ROUGE] le motif enrichi conserve gabarit/cle/couverture et n\'ajoute STRICTEMENT que distinction/nonResolues', () => {
  const [m] = comparerMotifs([MOTIF], infoDeTest());
  assert.deepEqual(Object.keys(m).sort(), ['cle', 'couverture', 'distinction', 'gabarit', 'nonResolues']);
  assert.equal(m.cle, MOTIF.cle);
  assert.deepEqual(m.couverture, MOTIF.couverture);
});

// -------------------------------------------------------------------- 9 — ordre d'entrée conservé, aucun tri
test('[ROUGE] l\'ordre des motifs en sortie reflète strictement celui de l\'entrée (jamais trié)', () => {
  const AUTRE = { gabarit: [{ mot: 'x' }], cle: 'mot:x', couverture: ['e1'] };
  const resultat = comparerMotifs([AUTRE, MOTIF], infoDeTest());
  assert.deepEqual(resultat.map((m) => m.cle), ['mot:x', 'mot:comment']);
});

// -------------------------------------------------------------------- 10 — idempotence
test('[ROUGE] appelée deux fois de suite sur les mêmes entrées, comparerMotifs rend le même résultat (n\'écrit rien)', () => {
  const r1 = comparerMotifs([MOTIF], infoDeTest());
  const r2 = comparerMotifs([MOTIF], infoDeTest());
  assert.deepEqual(r1, r2);
});

// -------------------------------------------------------------------- 11 — exactement deux paramètres
test('[ROUGE] comparerMotifs prend EXACTEMENT deux paramètres (aucun seuil ni canal d\'écriture ajouté)', () => {
  assert.equal(comparerMotifs.length, 2);
});

// -------------------------------------------------------------------- 12, 13 — aucun mécanisme d'écriture, aucun appel interdit
test('[STATIQUE] le corps de comparerMotifs ne référence aucun mécanisme d\'écriture/persistance', () => {
  const debut = induireSource.indexOf('export function comparerMotifs');
  assert.ok(debut > 0, 'comparerMotifs doit être définie dans induction.js');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['magasin', '.ecrire(', 'localStorage', 'indexedDB', 'fetch(']) {
    assert.ok(!corps.includes(interdit), `comparerMotifs ne doit référencer aucun mécanisme d'écriture (trouvé : ${interdit})`);
  }
});
test('[STATIQUE] comparerMotifs n\'appelle jamais comprendre()/repondre() ni induire()/apprendreGabaritType()', () => {
  const debut = induireSource.indexOf('export function comparerMotifs');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['comprendre(', 'repondre(', 'apprendreGabaritType(']) {
    assert.ok(!corps.includes(interdit), `comparerMotifs ne doit jamais appeler ${interdit}`);
  }
  const appelsInduire = corps.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});

// -------------------------------------------------------------------- 14 — vocabulaire strictement descriptif
test('[STATIQUE] aucune notion de cause/signification/score/importance/curiosité dans comparerMotifs', () => {
  const debut = induireSource.indexOf('export function comparerMotifs');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin)).toLowerCase();
  for (const interdit of ['score', 'classement', 'important', 'interessant', 'intéressant', 'cause', 'signification', 'curiosite', 'curiosité', 'confiance', 'hypothese', 'hypothèse']) {
    assert.ok(!corps.includes(interdit), `mot interdit trouvé dans comparerMotifs : ${interdit}`);
  }
});

// -------------------------------------------------------------------- garde-fous : les quatre fonctions précédentes inchangées
test('[GARDE] repererMotifs() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function repererMotifs(experiences, { lexique = LEXIQUE_DEPART, seuilMin = 2, nMax = 4 } = {}) {
  const pool = experiences.map((e) => ({ ...representerExemple(e.texteRecu, lexique), id: e.id }));
  const evalues = candidatsEvalues(pool, [], nMax);
  return evalues
    .filter((e) => e.couv >= seuilMin)
    .map((e) => ({ gabarit: e.gabarit, cle: e.cle, couverture: e.couverts.map((c) => c.id) }));
}`;
  assert.ok(induireSource.includes(attendu));
});
test('[GARDE] repartirMotifsParEtat() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function repartirMotifsParEtat(motifs, etatParId) {
  return motifs.map((m) => {
    const parEtat = { compris: [], partiel: [], incompris: [], inconnu: [] };
    for (const id of m.couverture) {
      const etat = etatParId.get(id);
      const categorie = ETATS_CONNUS.includes(etat) ? etat : 'inconnu';
      parEtat[categorie].push(id);
    }
    return { ...m, parEtat };
  });
}`;
  assert.ok(induireSource.includes(attendu));
});
test('[GARDE] chronologieMotifs() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function chronologieMotifs(motifs, infoParId) {
  return motifs.map((m) => {
    const groupes = new Map();
    const nonResolues = [];
    for (const id of m.couverture) {
      const info = infoParId.get(id);
      const date = info ? info.date : undefined;
      const etatBrut = info ? info.etat : undefined;
      if (!dateValide(date)) {
        nonResolues.push({ id, date: date === undefined ? null : date, etat: etatBrut === undefined ? null : etatBrut });
        continue;
      }
      const etat = ETATS_CONNUS.includes(etatBrut) ? etatBrut : 'inconnu';
      if (!groupes.has(date)) groupes.set(date, []);
      groupes.get(date).push({ id, etat });
    }
    const chronologie = [...groupes.entries()]
      .sort(([d1], [d2]) => (d1 < d2 ? -1 : d1 > d2 ? 1 : 0))
      .map(([date, observations]) => ({
        date,
        observations: observations.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      }));
    return { gabarit: m.gabarit, cle: m.cle, couverture: m.couverture, chronologie, nonResolues };
  });
}`;
  assert.ok(induireSource.includes(attendu));
});
test('[GARDE] motifsAvecVariationDEtat() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function motifsAvecVariationDEtat(motifsRepartis) {
  return motifsRepartis.filter((m) => {
    const categoriesNonVides = CATEGORIES_ETAT.filter((c) => (m.parEtat[c] || []).length > 0);
    return categoriesNonVides.length >= 2;
  });
}`;
  assert.ok(induireSource.includes(attendu));
});

// ======================================================================= câblage laboratoire (ecran.js) — exposition en lecture seule, pour validation
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

// Reprend le vécu RÉEL déjà validé sur téléphone (variation d'état, 26/09/2026) : « Comment tu
// t'appelles ? » (compris, sujet=naissance) puis « Comment il s'appelle ? » (partiel, sujet=null) --
// le motif partagé (« mot:comment ») a un sujet qui diffère, une relation qui ne diffère pas.
async function vecuReelDejaValide(magasin) {
  const e1 = await enregistrerExperience(magasin, {
    texteRecu: "Comment tu t'appelles ?", texteRepondu: 'Naissance.',
    date: '2026-09-26T14:42:10.086Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, e1.id, { origine: 'comprendre', donnees: { etat: 'compris', type: 'question_information', sujet: 'naissance', relation: 'nom', mots: ['comment', 'tu', 't', 'appelles'], motsInconnus: [] } });
  const e2 = await enregistrerExperience(magasin, {
    texteRecu: "Comment il s'appelle ?", texteRepondu: "Il s'appelle Athème.",
    date: '2026-09-26T16:07:09.476Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, e2.id, { origine: 'comprendre', donnees: { etat: 'partiel', type: 'question_information', sujet: null, relation: 'nom', mots: ['comment', 'il', 's', 'appelle'], motsInconnus: [] } });
  return { e1, e2 };
}

test('[ROUGE] le rapport du laboratoire indique, pour le motif partagé, quel champ diffère et lequel ne diffère pas', async () => {
  const { el, magasin } = await monter();
  await vecuReelDejaValide(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent.toLowerCase();
  assert.ok(texte.includes('sujet'), 'le champ sujet doit être nommé dans le rapport');
  assert.ok(texte.includes('relation'), 'le champ relation doit être nommé dans le rapport');
});

test('[ROUGE] le rapport ne qualifie jamais la comparaison de cause, signification ou intérêt', async () => {
  const { el, magasin } = await monter();
  await vecuReelDejaValide(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent.toLowerCase();
  for (const interdit of ['cause', 'signification', 'intéressant', 'interessant', 'important', 'hypothèse', 'hypothese']) {
    assert.ok(!texte.includes(interdit), `vocabulaire interdit trouvé dans le rapport : ${interdit}`);
  }
});
// === FIN_TEST_COMPARAISON_MOTIFS ===
