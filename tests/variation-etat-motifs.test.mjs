// === DEBUT_TEST_VARIATION_ETAT_MOTIFS ===
// TESTS ROUGES D'ABORD — aucune implémentation n'existe encore pour cette partie.
//
// Objectif (cadrage ChatGPT du 26/09/2026, correction conceptuelle explicite) : Naissance peut
// constater qu'un même motif a été vécu sous plusieurs états de compréhension différents. Ce
// N'EST PAS une notion d'intérêt, d'importance ou de curiosité -- un motif toujours COMPRIS n'est
// jamais déclaré sans intérêt, un motif variable n'est jamais déclaré important. On CONSTATE
// uniquement une variation observable, sur des données déjà produites, rien de plus.
//
// Architecture retenue : une QUATRIÈME fonction sœur pure, motifsAvecVariationDEtat(motifsRepartis),
// ajoutée dans induction.js à côté de repererMotifs()/repartirMotifsParEtat()/chronologieMotifs()
// (aucune des trois modifiée). Elle reçoit les motifs DÉJÀ répartis par état (champ .parEtat déjà
// calculé par repartirMotifsParEtat()) et retient ceux dont AU MOINS DEUX des quatre catégories
// (compris/partiel/incompris/inconnu) sont non vides -- aucun score, aucun tri, aucun seuil
// réglable, aucun cas particulier linguistique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { repererMotifs, repartirMotifsParEtat, chronologieMotifs, motifsAvecVariationDEtat } from '../app/langage/induction.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const induireSource = readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// -------------------------------------------------------------------- fixtures pures (aucun magasin)
function parEtat({ compris = [], partiel = [], incompris = [], inconnu = [] } = {}) {
  return { compris, partiel, incompris, inconnu };
}
const MOTIF_UNIFORME_COMPRIS = { gabarit: [{ mot: 'toujours' }], cle: 'mot:toujours', couverture: ['e1', 'e2', 'e3'], parEtat: parEtat({ compris: ['e1', 'e2', 'e3'] }) };
const MOTIF_UNIFORME_INCOMPRIS = { gabarit: [{ mot: 'jamais' }], cle: 'mot:jamais', couverture: ['e1', 'e2'], parEtat: parEtat({ incompris: ['e1', 'e2'] }) };
const MOTIF_DEUX_ETATS = { gabarit: [{ mot: 'variable' }], cle: 'mot:variable', couverture: ['e1', 'e2', 'e3'], parEtat: parEtat({ compris: ['e1', 'e2'], partiel: ['e3'] }) };
const MOTIF_TROIS_ETATS = { gabarit: [{ mot: 'melange' }], cle: 'mot:melange', couverture: ['e1', 'e2', 'e3'], parEtat: parEtat({ compris: ['e1'], incompris: ['e2'], inconnu: ['e3'] }) };
const MOTIF_VIDE = { gabarit: [{ mot: 'rien' }], cle: 'mot:rien', couverture: [], parEtat: parEtat() };

// -------------------------------------------------------------------- 1, 2 — un seul état : jamais retenu, quel qu'il soit
test('[ROUGE] un motif toujours COMPRIS n\'est PAS retenu (une seule catégorie non vide)', () => {
  const r = motifsAvecVariationDEtat([MOTIF_UNIFORME_COMPRIS]);
  assert.equal(r.length, 0, 'toujours compris n\'est jamais déclaré \"sans variation\" comme s\'il était sans intérêt -- il n\'est simplement pas dans le résultat');
});
test('[ROUGE] un motif toujours INCOMPRIS n\'est pas retenu non plus (aucun état privilégié)', () => {
  const r = motifsAvecVariationDEtat([MOTIF_UNIFORME_INCOMPRIS]);
  assert.equal(r.length, 0);
});

// -------------------------------------------------------------------- 3, 4 — deux ou trois états distincts : retenu
test('[ROUGE] un motif vécu dans deux états distincts (compris + partiel) est retenu', () => {
  const r = motifsAvecVariationDEtat([MOTIF_DEUX_ETATS]);
  assert.equal(r.length, 1);
  assert.equal(r[0].cle, 'mot:variable');
});
test('[ROUGE] un motif vécu dans trois états distincts est retenu (aucune limite haute)', () => {
  const r = motifsAvecVariationDEtat([MOTIF_TROIS_ETATS]);
  assert.equal(r.length, 1);
  assert.equal(r[0].cle, 'mot:melange');
});

// -------------------------------------------------------------------- 5 — INCONNU compte comme un état à part entière
test('[ROUGE] compris + inconnu (jamais compris + incompris) est déjà une variation constatée', () => {
  const motif = { gabarit: [], cle: 'mot:x', couverture: ['e1', 'e2'], parEtat: parEtat({ compris: ['e1'], inconnu: ['e2'] }) };
  const r = motifsAvecVariationDEtat([motif]);
  assert.equal(r.length, 1);
});

// -------------------------------------------------------------------- 6 — couverture vide : aucune variation à constater
test('[ROUGE] un motif sans aucune couverture résolue n\'est pas retenu (rien à constater)', () => {
  const r = motifsAvecVariationDEtat([MOTIF_VIDE]);
  assert.equal(r.length, 0);
});

// -------------------------------------------------------------------- 7 — mélange dans un même appel : filtrage indépendant par motif
test('[ROUGE] dans un même appel, seuls les motifs réellement variables sont retenus, les autres écartés', () => {
  const r = motifsAvecVariationDEtat([MOTIF_UNIFORME_COMPRIS, MOTIF_DEUX_ETATS, MOTIF_UNIFORME_INCOMPRIS, MOTIF_TROIS_ETATS]);
  assert.deepEqual(r.map((m) => m.cle).sort(), ['mot:melange', 'mot:variable']);
});

// -------------------------------------------------------------------- 8 — ordre d'entrée conservé, aucun tri
test('[ROUGE] l\'ordre des motifs retenus reflète strictement celui de l\'entrée (jamais trié)', () => {
  const r = motifsAvecVariationDEtat([MOTIF_TROIS_ETATS, MOTIF_UNIFORME_COMPRIS, MOTIF_DEUX_ETATS]);
  assert.deepEqual(r.map((m) => m.cle), ['mot:melange', 'mot:variable']);
});

// -------------------------------------------------------------------- 9 — aucune mutation, aucun champ ajouté
test('[ROUGE] les motifs retenus sont EXACTEMENT les mêmes objets reçus, sans aucun champ ajouté (aucun score)', () => {
  const r = motifsAvecVariationDEtat([MOTIF_DEUX_ETATS]);
  assert.equal(r[0], MOTIF_DEUX_ETATS, 'doit être la même référence, jamais une copie enrichie');
  assert.deepEqual(Object.keys(r[0]).sort(), ['cle', 'couverture', 'gabarit', 'parEtat']);
});

// -------------------------------------------------------------------- 10 — idempotence : appelée deux fois, même résultat
test('[ROUGE] appelée deux fois de suite sur les mêmes entrées, motifsAvecVariationDEtat rend le même résultat (n\'écrit rien)', () => {
  const entree = [MOTIF_UNIFORME_COMPRIS, MOTIF_DEUX_ETATS, MOTIF_TROIS_ETATS];
  const r1 = motifsAvecVariationDEtat(entree);
  const r2 = motifsAvecVariationDEtat(entree);
  assert.deepEqual(r1.map((m) => m.cle), r2.map((m) => m.cle));
});

// -------------------------------------------------------------------- 11 — aucun paramètre optionnel (aucun seuil réglable)
test('[ROUGE] motifsAvecVariationDEtat prend EXACTEMENT un paramètre (aucun seuil ni canal d\'écriture ajouté)', () => {
  assert.equal(motifsAvecVariationDEtat.length, 1);
});

// -------------------------------------------------------------------- 12 — entrée vide : sortie vide
test('[ROUGE] un tableau de motifs vide rend un tableau vide', () => {
  assert.deepEqual(motifsAvecVariationDEtat([]), []);
});

// -------------------------------------------------------------------- 13 — aucun mécanisme d'écriture/persistance
test('[STATIQUE] le corps de motifsAvecVariationDEtat ne référence aucun mécanisme d\'écriture/persistance', () => {
  const debut = induireSource.indexOf('export function motifsAvecVariationDEtat');
  assert.ok(debut > 0, 'motifsAvecVariationDEtat doit être définie dans induction.js');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['magasin', '.ecrire(', 'localStorage', 'indexedDB', 'fetch(']) {
    assert.ok(!corps.includes(interdit), `motifsAvecVariationDEtat ne doit référencer aucun mécanisme d'écriture (trouvé : ${interdit})`);
  }
});

// -------------------------------------------------------------------- 14 — aucun appel à induire()/apprendreGabaritType()/comprendre()/repondre()
test('[STATIQUE] motifsAvecVariationDEtat n\'appelle jamais comprendre()/repondre() ni induire()/apprendreGabaritType()', () => {
  const debut = induireSource.indexOf('export function motifsAvecVariationDEtat');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['comprendre(', 'repondre(', 'apprendreGabaritType(']) {
    assert.ok(!corps.includes(interdit), `motifsAvecVariationDEtat ne doit jamais appeler ${interdit}`);
  }
  const appelsInduire = corps.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});

// -------------------------------------------------------------------- 15 — vocabulaire strictement descriptif, jamais un jugement
test('[STATIQUE] aucune notion de score/tri/classement/intérêt/importance/surprise/curiosité dans motifsAvecVariationDEtat', () => {
  const debut = induireSource.indexOf('export function motifsAvecVariationDEtat');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin)).toLowerCase();
  for (const interdit of ['score', 'classement', 'important', 'interessant', 'intéressant', 'examiner', 'surprise', 'curiosite', 'curiosité', 'progression', 'régression', 'regression', 'tendance', 'apprentissage']) {
    assert.ok(!corps.includes(interdit), `mot de jugement trouvé dans motifsAvecVariationDEtat : ${interdit}`);
  }
});

// -------------------------------------------------------------------- garde-fous : les trois fonctions précédentes inchangées
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

// Un même vécu que celui déjà validé sur téléphone pour la chronologie (v0.17.14) : « Bibendumesque ? »
// INCOMPRIS puis « Quelle est ma bibendumesque ? » PARTIEL -- le motif partagé (« mot:bibendumesque »
// via le rôle relation, ou plus simplement le mot lui-même) est vécu dans deux états distincts.
async function vecuVariation(magasin) {
  const e1 = await enregistrerExperience(magasin, {
    texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne connais pas encore ce mot.',
    date: '2026-09-26T10:01:00.000Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, e1.id, { origine: 'comprendre', donnees: { etat: 'incompris', sujet: null, relation: null, motsInconnus: ['bibendumesque'] } });
  const e2 = await enregistrerExperience(magasin, {
    texteRecu: 'Quelle est ma bibendumesque ?', texteRepondu: 'Je ne connais pas encore ce mot.',
    date: '2026-09-26T10:04:00.000Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, e2.id, { origine: 'comprendre', donnees: { etat: 'partiel', sujet: null, relation: null, motsInconnus: ['bibendumesque'] } });
  return { e1, e2 };
}

test('[ROUGE] le rapport du laboratoire indique une variation d\'état pour un motif vécu dans deux états distincts', async () => {
  const { el, magasin } = await monter();
  await vecuVariation(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent;
  assert.ok(texte.includes('bibendumesque'), 'le motif partagé doit apparaître dans le rapport');
  assert.ok(texte.toLowerCase().includes('variation d\'état'), 'le rapport doit nommer explicitement une variation d\'état');
});

test('[ROUGE] le rapport ne qualifie jamais la variation d\'intéressante, importante ou de digne d\'examen', async () => {
  const { el, magasin } = await monter();
  await vecuVariation(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent.toLowerCase();
  for (const interdit of ['intéressant', 'interessant', 'important', 'à examiner', 'a examiner', 'surprise', 'curiosité', 'curiosite']) {
    assert.ok(!texte.includes(interdit), `vocabulaire de jugement trouvé dans le rapport : ${interdit}`);
  }
});
// === FIN_TEST_VARIATION_ETAT_MOTIFS ===
