// === DEBUT_TEST_CHRONOLOGIE_MOTIFS ===
// TESTS ROUGES D'ABORD — aucune implémentation n'existe encore pour cette partie.
//
// Objectif (feu vert « Chronologie brute des états de compréhension ») : pour chaque motif déjà
// constaté, reconstruire la SÉQUENCE HISTORIQUE réelle des états de compréhension observés --
// jamais une progression/régression/score, seulement les faits (date réelle, état historique)
// triés par date, sans jamais inventer une antériorité entre deux dates identiques.
//
// Architecture retenue (feu vert) : une TROISIÈME fonction sœur pure, chronologieMotifs(motifs,
// infoParId), ajoutée dans induction.js à côté de repererMotifs()/repartirMotifsParEtat() (jamais
// dedans, ni l'une ni l'autre modifiée). Elle reçoit les motifs déjà obtenus et une table
// id→{date, etat} DÉJÀ RÉSOLUE par l'appelant (jamais l'objet expérience complet, jamais le schéma
// des interprétations -- cette résolution reste dans app/langage/ecran.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { repererMotifs, repartirMotifsParEtat, chronologieMotifs } from '../app/langage/induction.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const induireSource = readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// -------------------------------------------------------------------- fixtures pures (aucun magasin)
const MOTIF = { gabarit: [{ mot: 'bibendumesque' }], cle: 'mot:bibendumesque', couverture: ['e1', 'e2'] };
const MOTIF_TRIO = { gabarit: [{ mot: 'x' }], cle: 'mot:x', couverture: ['a', 'b', 'c'] };

function infoDeTest() {
  return new Map([
    ['e1', { date: '2026-09-26T10:01:00.000Z', etat: 'incompris' }],
    ['e2', { date: '2026-09-26T10:04:00.000Z', etat: 'partiel' }],
  ]);
}

function chronoAplati(motifResultat) {
  // Aplati la chronologie groupée par date en une liste plate {id, date, etat}, dans l'ordre des
  // groupes -- pratique pour comparer des séquences dans les tests, sans jamais présumer un ordre
  // fiable À L'INTÉRIEUR d'un même groupe de date identique (voir tests dédiés aux égalités).
  return motifResultat.chronologie.flatMap((g) => g.observations.map((o) => ({ id: o.id, date: g.date, etat: o.etat })));
}

// -------------------------------------------------------------------- 1, 2 — tri par date réelle, ordre d'entrée ignoré
test('[ROUGE] la chronologie est triée par date réelle, quel que soit l\'ordre d\'entrée de la couverture', () => {
  const motifInverse = { ...MOTIF, couverture: ['e2', 'e1'] };
  const [m] = chronologieMotifs([motifInverse], infoDeTest());
  assert.deepEqual(chronoAplati(m).map((o) => o.id), ['e1', 'e2'], 'e1 (10:01) doit précéder e2 (10:04) même si la couverture les donnait dans l\'ordre inverse');
});

// -------------------------------------------------------------------- 3 — séquence INCOMPRIS → PARTIEL → COMPRIS
test('[ROUGE] une séquence INCOMPRIS → PARTIEL → COMPRIS est reproduite fidèlement, dans cet ordre', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
    ['e2', { date: '2026-09-26T10:01:00.000Z', etat: 'partiel' }],
    ['e3', { date: '2026-09-27T09:00:00.000Z', etat: 'compris' }],
  ]);
  const motif = { ...MOTIF, couverture: ['e3', 'e1', 'e2'] };
  const [m] = chronologieMotifs([motif], info);
  assert.deepEqual(chronoAplati(m).map((o) => o.etat), ['incompris', 'partiel', 'compris']);
});

// -------------------------------------------------------------------- 4 — COMPRIS → INCOMPRIS conservé tel quel
test('[ROUGE] un retour COMPRIS → INCOMPRIS est rapporté tel quel (aucune étiquette de régression)', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'compris' }],
    ['e2', { date: '2026-09-26T11:00:00.000Z', etat: 'incompris' }],
  ]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'e2'] }], info);
  assert.deepEqual(chronoAplati(m).map((o) => o.etat), ['compris', 'incompris']);
  assert.ok(!('progression' in m) && !('regression' in m) && !('tendance' in m));
});

// -------------------------------------------------------------------- 5 — plusieurs occurrences du même état conservées
test('[ROUGE] plusieurs observations successives du même état sont toutes conservées (aucune déduplication)', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
    ['e2', { date: '2026-09-26T11:00:00.000Z', etat: 'incompris' }],
    ['e3', { date: '2026-09-26T12:00:00.000Z', etat: 'incompris' }],
  ]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'e2', 'e3'] }], info);
  assert.deepEqual(chronoAplati(m).map((o) => o.etat), ['incompris', 'incompris', 'incompris']);
});

// -------------------------------------------------------------------- 6 — INCONNU conservé
test('[ROUGE] un état INCONNU (valeur non reconnue ou absente) est conservé dans la chronologie, jamais filtré', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'compris' }],
    ['e2', { date: '2026-09-26T11:00:00.000Z', etat: undefined }],
    ['e3', { date: '2026-09-26T12:00:00.000Z', etat: 'une-valeur-inattendue' }],
  ]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'e2', 'e3'] }], info);
  assert.deepEqual(chronoAplati(m).map((o) => o.etat), ['compris', 'inconnu', 'inconnu']);
});

// -------------------------------------------------------------------- 7 — date invalide jamais inventée
test('[ROUGE] une date invalide n\'est jamais transformée en date actuelle : observation non résolue', () => {
  const info = new Map([['e1', { date: 'pas-une-date', etat: 'compris' }]]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1'] }], info);
  assert.equal(m.chronologie.length, 0);
  assert.equal(m.nonResolues.length, 1);
  assert.equal(m.nonResolues[0].id, 'e1');
  assert.equal(m.nonResolues[0].date, 'pas-une-date', 'la valeur brute est conservée, jamais perdue');
});

// -------------------------------------------------------------------- 8 — date absente jamais inventée
test('[ROUGE] une date absente n\'est jamais transformée en date actuelle : observation non résolue', () => {
  const info = new Map([['e1', { date: undefined, etat: 'partiel' }]]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1'] }], info);
  assert.equal(m.chronologie.length, 0);
  assert.deepEqual(m.nonResolues, [{ id: 'e1', date: null, etat: 'partiel' }]);
});

// -------------------------------------------------------------------- 9 — ID introuvable explicitement non résolu
test('[ROUGE] un id de couverture absent de la table (expérience introuvable) est explicitement non résolu', () => {
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'fantome'] }], new Map([['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'compris' }]]));
  assert.equal(m.chronologie.length, 1);
  assert.deepEqual(m.nonResolues, [{ id: 'fantome', date: null, etat: null }]);
});

// -------------------------------------------------------------------- 10 — dates identiques, aucune fausse antériorité
test('[ROUGE] deux observations à date identique appartiennent au même groupe temporel, sans ordre affirmé entre elles', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
    ['e2', { date: '2026-09-26T10:00:00.000Z', etat: 'compris' }],
  ]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'e2'] }], info);
  assert.equal(m.chronologie.length, 1, 'un seul groupe temporel pour une seule date');
  assert.equal(m.chronologie[0].date, '2026-09-26T10:00:00.000Z');
  assert.deepEqual(m.chronologie[0].observations.map((o) => o.id).sort(), ['e1', 'e2']);
});

// -------------------------------------------------------------------- 10b — même date ET même état : aucune déduplication
test('[ROUGE] deux observations à date ET état identiques restent toutes deux dans le groupe temporel (aucune déduplication)', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
    ['e2', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
  ]);
  const [m] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'e2'] }], info);
  assert.equal(m.chronologie.length, 1);
  assert.equal(m.chronologie[0].observations.length, 2, 'les deux observations identiques (même date, même état) doivent être conservées, jamais fusionnées');
});

// -------------------------------------------------------------------- 10c — tri neutre par id à l'intérieur d'un groupe, indépendant de l'ordre d'entrée
test('[ROUGE] à l\'intérieur d\'un groupe temporel, les observations sont triées par id de façon déterministe, quel que soit l\'ordre d\'entrée de la couverture', () => {
  const info = new Map([
    ['e2', { date: '2026-09-26T10:00:00.000Z', etat: 'compris' }],
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
  ]);
  const [mOrdreInverse] = chronologieMotifs([{ ...MOTIF, couverture: ['e2', 'e1'] }], info);
  const [mOrdreNormal] = chronologieMotifs([{ ...MOTIF, couverture: ['e1', 'e2'] }], info);
  assert.deepEqual(mOrdreInverse.chronologie[0].observations, mOrdreNormal.chronologie[0].observations, 'le résultat ne doit jamais dépendre de l\'ordre d\'entrée de la couverture');
  assert.deepEqual(mOrdreInverse.chronologie[0].observations.map((o) => o.id), ['e1', 'e2']);
});

// -------------------------------------------------------------------- 11 — plusieurs motifs indépendants
test('[ROUGE] plusieurs motifs sont traités indépendamment, chacun avec sa propre chronologie', () => {
  const info = new Map([
    ['e1', { date: '2026-09-26T10:00:00.000Z', etat: 'incompris' }],
    ['e2', { date: '2026-09-26T11:00:00.000Z', etat: 'partiel' }],
    ['a', { date: '2026-09-26T09:00:00.000Z', etat: 'compris' }],
    ['b', { date: '2026-09-26T09:30:00.000Z', etat: 'compris' }],
    ['c', { date: '2026-09-26T09:45:00.000Z', etat: 'incompris' }],
  ]);
  const resultat = chronologieMotifs([MOTIF, MOTIF_TRIO], info);
  assert.equal(resultat.length, 2);
  assert.deepEqual(chronoAplati(resultat[0]).map((o) => o.id), ['e1', 'e2']);
  assert.deepEqual(chronoAplati(resultat[1]).map((o) => o.id), ['a', 'b', 'c']);
});

// -------------------------------------------------------------------- 12 — aucune mutation des entrées
test('[ROUGE] les motifs et la table d\'informations reçus ne sont jamais mutés', () => {
  const motifsGeles = [Object.freeze({ ...MOTIF, couverture: Object.freeze([...MOTIF.couverture]) })];
  Object.freeze(motifsGeles);
  const info = infoDeTest();
  const tailleAvant = info.size;
  const resultat = chronologieMotifs(motifsGeles, info);
  assert.ok(resultat[0] !== motifsGeles[0]);
  assert.ok(!('chronologie' in motifsGeles[0]));
  assert.equal(info.size, tailleAvant);
});

// -------------------------------------------------------------------- 13 — déterminisme
test('[ROUGE] la fonction est déterministe : deux appels identiques rendent le même résultat', () => {
  const r1 = chronologieMotifs([MOTIF, MOTIF_TRIO], infoDeTest());
  const r2 = chronologieMotifs([MOTIF, MOTIF_TRIO], infoDeTest());
  assert.deepEqual(r1, r2);
});

// -------------------------------------------------------------------- 14 — aucune écriture / persistance
test('[ROUGE] chronologieMotifs prend EXACTEMENT deux paramètres (aucun canal d\'écriture optionnel ajouté)', () => {
  assert.equal(chronologieMotifs.length, 2);
});
test('[STATIQUE] le corps de chronologieMotifs ne référence aucun mécanisme d\'écriture/persistance', () => {
  const debut = induireSource.indexOf('export function chronologieMotifs');
  assert.ok(debut > 0, 'chronologieMotifs doit être définie dans induction.js');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['magasin', '.ecrire(', 'localStorage', 'indexedDB', 'fetch(']) {
    assert.ok(!corps.includes(interdit), `chronologieMotifs ne doit référencer aucun mécanisme d'écriture (trouvé : ${interdit})`);
  }
});

// -------------------------------------------------------------------- 15 — aucun recalcul de comprendre()/repondre()
test('[STATIQUE] chronologieMotifs n\'appelle jamais comprendre()/repondre() ni induire()/apprendreGabaritType()', () => {
  const debut = induireSource.indexOf('export function chronologieMotifs');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['comprendre(', 'repondre(', 'apprendreGabaritType(']) {
    assert.ok(!corps.includes(interdit), `chronologieMotifs ne doit jamais appeler ${interdit}`);
  }
  const appelsInduire = corps.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});

// -------------------------------------------------------------------- 16 — aucun score, aucune notion de progression
test('[STATIQUE] aucune notion de score/progression/régression/tendance/intérêt dans chronologieMotifs', () => {
  const debut = induireSource.indexOf('export function chronologieMotifs');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin)).toLowerCase();
  for (const interdit of ['score', 'progression', 'regression', 'régression', 'amelioration', 'amélioration', 'tendance', 'interessant', 'intéressant', 'apprentissage']) {
    assert.ok(!corps.includes(interdit), `jugement interdit trouvé dans chronologieMotifs : ${interdit}`);
  }
});

// -------------------------------------------------------------------- garde-fous : les deux fonctions précédentes inchangées
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

// ======================================================================= câblage laboratoire (ecran.js)
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

// Reprend EXACTEMENT le vécu réel déjà validé sur téléphone (v0.17.12/v0.17.13) : « Bibendumesque ? »
// (INCOMPRIS, tapée en premier) puis « Quelle est ma bibendumesque ? » (PARTIEL, tapée ensuite).
async function vecuBibendumesque(magasin) {
  const eIncompris = await enregistrerExperience(magasin, {
    texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne connais pas encore ce mot.',
    date: '2026-09-26T10:01:00.000Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, eIncompris.id, { origine: 'comprendre', donnees: { etat: 'incompris', sujet: null, relation: null, motsInconnus: ['bibendumesque'] } });

  const ePartiel = await enregistrerExperience(magasin, {
    texteRecu: 'Quelle est ma bibendumesque ?', texteRepondu: 'Je ne connais pas encore ce mot.',
    date: '2026-09-26T10:04:00.000Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, ePartiel.id, { origine: 'comprendre', donnees: { etat: 'partiel', sujet: null, relation: null, motsInconnus: ['bibendumesque'] } });

  return { eIncompris, ePartiel };
}

test('[ROUGE] le rapport affiche la chronologie réelle dans l\'ordre où les tours ont été vécus (INCOMPRIS puis PARTIEL)', async () => {
  const { el, magasin } = await monter();
  await vecuBibendumesque(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent;
  const iIncompris = texte.indexOf('incompris');
  const iPartiel = texte.indexOf('partiel');
  assert.ok(iIncompris >= 0 && iPartiel >= 0);
  assert.ok(iIncompris < iPartiel, 'incompris (vécu en premier) doit apparaître avant partiel dans le rapport');
});

test('[ROUGE] le rapport ne contient jamais de mot de jugement (progression, amélioration...)', async () => {
  const { el, magasin } = await monter();
  await vecuBibendumesque(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent.toLowerCase();
  for (const interdit of ['progression', 'régression', 'regression', 'amélioration', 'amelioration', 'tendance', 'intéressant', 'apprentissage']) {
    assert.ok(!texte.includes(interdit), `mot de jugement trouvé dans le rapport : ${interdit}`);
  }
});

test('[STATIQUE] la résolution de la date réutilise exp.date (jamais recalculée, jamais Date.now())', () => {
  const debut = ecranJs.indexOf('data-langage-motifs-lister');
  const finZone = ecranJs.indexOf('// Exposés pour le pont conversationnel', debut);
  const bloc = sansCommentaires(ecranJs.slice(debut, finZone));
  assert.match(bloc, /exp\.date/);
  assert.ok(!bloc.includes('Date.now()'), 'aucune date ne doit être fabriquée au moment de l\'affichage');
});

test('[STATIQUE] le câblage réutilise le bouton existant : aucun nouveau sélecteur data-langage-motifs-* introduit', () => {
  const nouveaux = [...ecranJs.matchAll(/data-langage-motifs-[a-z-]+/g)].map((m) => m[0]);
  const attendus = new Set(['data-langage-motifs-lister', 'data-langage-motifs-etat', 'data-langage-motifs-rapport']);
  for (const sel of nouveaux) assert.ok(attendus.has(sel), `sélecteur inattendu introduit : ${sel}`);
});

// -------------------------------------------------------------------- fichiers garantis inchangés
const EMPREINTES_INCHANGEES = {
  'app/langage/comprendre.js': '97b9bb99cd52a566d1213c7713dcf689cf6ee39b0c0000cb34c1a64f48828535',
  'app/langage/esprit.js': '0d2f6c906f1a110829bfaa633ef94c1bc295009310e0bbae04a441aea7be2fe7',
  // (app/langage/connaissances.js et app/main.js ne sont plus gardés ici : ces pins ne valaient que
  // pour les chantiers antérieurs à « sauvegarde complète » (v0.17.15), qui les modifie tous deux
  // légitimement -- voir tests/sauvegarde-complete.test.mjs pour ses propres garde-fous de contenu
  // exact sur connaissances.js.)
  // (app/langage/pont.js n'est plus gardé ici : ce pin ne valait que pour les chantiers
  // antérieurs à « signal d'apprentissage » (26/09/2026, étape E), qui le modifie légitimement --
  // voir tests/pont-attentes.test.mjs pour ses propres garde-fous.)
};
for (const [chemin, empreinte] of Object.entries(EMPREINTES_INCHANGEES)) {
  test(`[GARDE] ${chemin} reste strictement inchangé pendant ce chantier`, () => {
    const contenu = readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
    const reelle = crypto.createHash('sha256').update(contenu).digest('hex');
    assert.equal(reelle, empreinte, `${chemin} a été modifié -- interdit pendant ce chantier`);
  });
}
// === FIN_TEST_CHRONOLOGIE_MOTIFS ===
