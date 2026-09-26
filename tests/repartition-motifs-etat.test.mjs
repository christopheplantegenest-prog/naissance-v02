// === DEBUT_TEST_REPARTITION_MOTIFS_ETAT ===
// TESTS ROUGES D'ABORD — aucune implémentation n'existe encore pour cette partie.
//
// Objectif (feu vert « Constater la répartition des motifs par état de compréhension ») : pour
// chaque motif déjà découvert par repererMotifs() (induction.js, INCHANGÉE), constater dans quels
// états de compréhension (compris/partiel/incompris/inconnu) se trouvent les expériences B1 que ce
// motif couvre -- un CONSTAT pur, sans hiérarchie, sans score, sans filtrage.
//
// Architecture retenue (feu vert) : une fonction SŒUR pure, repartirMotifsParEtat(motifs, etatParId),
// ajoutée dans induction.js à côté de repererMotifs() (jamais dedans). Elle reçoit les motifs déjà
// produits par repererMotifs() et une table id→etat DÉJÀ RÉSOLUE par l'appelant (jamais l'objet
// expérience complet, jamais le schéma des interprétations -- cette résolution reste dans
// app/langage/ecran.js, seul endroit qui connaît le schéma libre des interprétations B1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { repererMotifs, repartirMotifsParEtat } from '../app/langage/induction.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const induireSource = readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// -------------------------------------------------------------------- fixtures pures (aucun magasin)
const MOTIF_MELANGE = { gabarit: [{ mot: 'gadget' }], cle: 'mot:gadget', couverture: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] };
const MOTIF_TRIVIAL = { gabarit: [{ mot: 'est' }], cle: 'mot:est', couverture: ['e1', 'e4'] };
const MOTIFS = [MOTIF_MELANGE, MOTIF_TRIVIAL];

function etatDeTest() {
  return new Map([
    ['e1', 'compris'], ['e4', 'compris'],
    ['e2', 'partiel'], ['e5', 'partiel'],
    ['e3', 'incompris'],
    // e6 absent volontairement : id sans aucune entrée dans la table.
  ]);
}

// -------------------------------------------------------------------- 1, 2, 3 — partitions correctes
test('[ROUGE] partition COMPRIS correcte', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(m.parEtat.compris, ['e1', 'e4']);
});
test('[ROUGE] partition PARTIEL correcte', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(m.parEtat.partiel, ['e2', 'e5']);
});
test('[ROUGE] partition INCOMPRIS correcte', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(m.parEtat.incompris, ['e3']);
});

// -------------------------------------------------------------------- 4, 5 — INCONNU, jamais COMPRIS par défaut
test('[ROUGE] partition INCONNU correcte : id absent de la table', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(m.parEtat.inconnu, ['e6']);
});
test('[ROUGE] absence d\'état exploitable → INCONNU, jamais COMPRIS implicitement (valeur inattendue dans la table)', () => {
  const etatParId = new Map([['e1', 'un-jour-un-autre-etat'], ['e2', undefined], ['e3', null]]);
  const motif = { gabarit: [], cle: 'mot:x', couverture: ['e1', 'e2', 'e3'] };
  const [m] = repartirMotifsParEtat([motif], etatParId);
  assert.deepEqual(m.parEtat.inconnu.sort(), ['e1', 'e2', 'e3']);
  assert.deepEqual(m.parEtat.compris, [], 'une valeur non reconnue ne doit JAMAIS devenir compris par défaut');
});

// -------------------------------------------------------------------- 6 — plusieurs catégories dans un même motif
test('[ROUGE] un même motif peut répartir sa couverture sur les quatre catégories à la fois', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(m.parEtat, { compris: ['e1', 'e4'], partiel: ['e2', 'e5'], incompris: ['e3'], inconnu: ['e6'] });
});

// -------------------------------------------------------------------- 7, 8 — conservation exacte, aucune perte/duplication
test('[ROUGE] tous les ids de couverture se retrouvent exactement une fois dans les quatre catégories', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  const total = [...m.parEtat.compris, ...m.parEtat.partiel, ...m.parEtat.incompris, ...m.parEtat.inconnu];
  assert.equal(total.length, m.couverture.length, 'aucun id créé ni perdu');
  assert.deepEqual(total.slice().sort(), m.couverture.slice().sort(), 'exactement les mêmes ids, jamais dupliqués');
});

// -------------------------------------------------------------------- garde-fou : aucun champ en plus
// (ni score, ni tri, ni tout autre jugement) — seul `parEtat` s'ajoute aux champs déjà produits par
// repererMotifs() (gabarit, cle, couverture). Détecte notamment l'introduction silencieuse d'un
// score qu'aucune assertion sur parEtat/couverture ne pourrait révéler autrement.
test('[ROUGE] le motif enrichi ne porte STRICTEMENT que gabarit/cle/couverture/parEtat -- aucun champ en plus (score, tri...)', () => {
  const [m] = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(Object.keys(m).sort(), ['cle', 'couverture', 'gabarit', 'parEtat']);
});

// -------------------------------------------------------------------- 9 — motif trivial conservé (aucun filtrage)
test('[ROUGE] un motif trivial (« mot:est ») n\'est jamais filtré par la répartition', () => {
  const resultat = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.equal(resultat.length, MOTIFS.length, 'aucun motif, trivial ou non, ne doit disparaître');
  assert.ok(resultat.some((m) => m.cle === 'mot:est'));
});

// -------------------------------------------------------------------- 10 — ordre non utilisé comme jugement
test('[ROUGE] l\'ordre des motifs en sortie reflète strictement celui de l\'entrée (jamais trié par répartition)', () => {
  const resultat = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(resultat.map((m) => m.cle), MOTIFS.map((m) => m.cle));
});

// -------------------------------------------------------------------- 11 — entrées non mutées
test('[ROUGE] les motifs et la table d\'états reçus ne sont jamais mutés', () => {
  const motifsGeles = MOTIFS.map((m) => Object.freeze({ ...m, couverture: Object.freeze([...m.couverture]) }));
  Object.freeze(motifsGeles);
  const etatParId = etatDeTest();
  const tailleAvant = etatParId.size;
  const resultat = repartirMotifsParEtat(motifsGeles, etatParId);
  assert.ok(resultat[0] !== motifsGeles[0], 'un objet NOUVEAU doit être renvoyé, jamais le même muté');
  assert.ok(!('parEtat' in motifsGeles[0]), 'l\'entrée d\'origine ne doit jamais recevoir parEtat elle-même');
  assert.equal(etatParId.size, tailleAvant, 'la table d\'états ne doit jamais être modifiée');
});

// -------------------------------------------------------------------- 12 — déterministe / recalculable
test('[ROUGE] la fonction est déterministe : deux appels identiques rendent le même résultat', () => {
  const r1 = repartirMotifsParEtat(MOTIFS, etatDeTest());
  const r2 = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(r1, r2);
});

// -------------------------------------------------------------------- 13, 14, 15 — garde-fous statiques (pureté)
test('[STATIQUE] induction.js n\'importe toujours aucune table de connaissances (étendu à repartirMotifsParEtat)', () => {
  assert.ok(!induireSource.includes("from './connaissances.js'"));
  assert.ok(!induireSource.includes("from './esprit.js'"));
});
test('[STATIQUE] repartirMotifsParEtat n\'appelle jamais induire() ni apprendreGabaritType()', () => {
  const debut = induireSource.indexOf('export function repartirMotifsParEtat');
  assert.ok(debut > 0, 'repartirMotifsParEtat doit être définie dans induction.js');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  assert.ok(!corps.includes('apprendreGabaritType'));
  const appelsInduire = corps.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});
test('[ROUGE] repartirMotifsParEtat n\'écrit rien : appelée deux fois de suite sur les mêmes entrées, même résultat', () => {
  const r1 = repartirMotifsParEtat(MOTIFS, etatDeTest());
  const r2 = repartirMotifsParEtat(MOTIFS, etatDeTest());
  assert.deepEqual(r1, r2);
});
// Garde-fous supplémentaires (aucune écriture/persistance possible même via un paramètre ajouté en
// silence) : arité strictement figée à 2, et son corps ne référence jamais un mécanisme d'écriture.
test('[ROUGE] repartirMotifsParEtat prend EXACTEMENT deux paramètres (aucun canal d\'écriture optionnel ajouté)', () => {
  assert.equal(repartirMotifsParEtat.length, 2);
});
test('[STATIQUE] le corps de repartirMotifsParEtat ne référence aucun mécanisme d\'écriture/persistance', () => {
  const debut = induireSource.indexOf('export function repartirMotifsParEtat');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['magasin', '.ecrire(', 'localStorage', 'indexedDB', 'fetch(']) {
    assert.ok(!corps.includes(interdit), `repartirMotifsParEtat ne doit référencer aucun mécanisme d'écriture (trouvé : ${interdit})`);
  }
});

// -------------------------------------------------------------------- 16 — repererMotifs() reste STRICTEMENT inchangée
// Épinglage par CONTENU EXACT de sa propre définition (et non par empreinte du fichier entier, qui
// grandit légitimement avec l'ajout de repartirMotifsParEtat juste après) : preuve directe que
// repererMotifs() elle-même n'a pas été touchée, sans dépendre du reste du fichier.
test('[GARDE] repererMotifs() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function repererMotifs(experiences, { lexique = LEXIQUE_DEPART, seuilMin = 2, nMax = 4 } = {}) {
  const pool = experiences.map((e) => ({ ...representerExemple(e.texteRecu, lexique), id: e.id }));
  const evalues = candidatsEvalues(pool, [], nMax);
  return evalues
    .filter((e) => e.couv >= seuilMin)
    .map((e) => ({ gabarit: e.gabarit, cle: e.cle, couverture: e.couverts.map((c) => c.id) }));
}`;
  assert.ok(induireSource.includes(attendu), 'repererMotifs() doit rester byte pour byte identique');
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

// Deux expériences « coucou » (mot commun couvert par un motif), avec des états réels VOLONTAIREMENT
// différents : l'une COMPRIS, l'autre INCOMPRIS -- pour prouver que le rapport les distingue.
async function experiencesEtatsMelanges(magasin) {
  const eCompris = await enregistrerExperience(magasin, {
    texteRecu: 'Coucou, ma couleur est rouge ?', texteRepondu: 'ta couleur, c’est rouge.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, eCompris.id, { origine: 'comprendre', donnees: { etat: 'compris', sujet: 'moi', relation: 'couleur' } });

  const eIncompris = await enregistrerExperience(magasin, {
    texteRecu: 'Coucou, ma bibendumesque ?', texteRepondu: 'Je ne connais pas encore ce mot.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, eIncompris.id, { origine: 'comprendre', donnees: { etat: 'incompris', sujet: null, relation: null } });

  // Expérience SANS interprétation 'comprendre' du tout (schéma libre : rien n'empêche cette forme) --
  // doit être comptée en INCONNU, jamais implicitement en COMPRIS.
  const eSansEtat = await enregistrerExperience(magasin, {
    texteRecu: 'Coucou, quelqu\'un ?', texteRepondu: 'Oui ?',
    date: new Date().toISOString(), source: 'laboratoire',
  });

  // Une seconde phrase avec « est » (mot trivial déjà présent dans eCompris ci-dessus) : nécessaire
  // pour que repererMotifs() (seuilMin=2 par défaut) le reconnaisse comme motif à part entière.
  const eTrivial = await enregistrerExperience(magasin, {
    texteRecu: 'Ce gadget est vert ?', texteRepondu: 'Je ne connais pas encore ce mot.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, eTrivial.id, { origine: 'comprendre', donnees: { etat: 'partiel', sujet: null, relation: 'gadget' } });

  return { eCompris, eIncompris, eSansEtat, eTrivial };
}

test('[ROUGE] le rapport affiche la répartition réelle par état pour un motif partagé', async () => {
  const { el, magasin } = await monter();
  const { eCompris, eIncompris } = await experiencesEtatsMelanges(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent;
  assert.match(texte, /compris\s*:\s*1/);
  assert.match(texte, /incompris\s*:\s*1/);
  assert.match(texte, new RegExp(eCompris.id));
  assert.match(texte, new RegExp(eIncompris.id));
});

test('[ROUGE] une expérience sans interprétation « comprendre » est comptée INCONNU, jamais COMPRIS implicitement', async () => {
  const { el, magasin } = await monter();
  const { eSansEtat } = await experiencesEtatsMelanges(magasin);
  await el.motifsLister.declencher('click');
  const texte = el.motifsRapport.textContent;
  assert.match(texte, /inconnu\s*:\s*1/);
  // L'expérience sans état existe bel et bien dans le rapport (ids toujours disponibles).
  assert.match(texte, new RegExp(eSansEtat.id));
});

test('[ROUGE] le motif trivial reste présent avec sa propre répartition (aucune élimination)', async () => {
  const { el, magasin } = await monter();
  await experiencesEtatsMelanges(magasin);
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, /^— mot:est$/m);
});

test('[STATIQUE] le câblage réutilise le bouton existant : aucun nouveau sélecteur data-langage-motifs-* introduit', () => {
  const nouveaux = [...ecranJs.matchAll(/data-langage-motifs-[a-z-]+/g)].map((m) => m[0]);
  const attendus = new Set(['data-langage-motifs-lister', 'data-langage-motifs-etat', 'data-langage-motifs-rapport']);
  for (const sel of nouveaux) assert.ok(attendus.has(sel), `sélecteur inattendu introduit : ${sel}`);
});

// (Assertion élargie par le chantier « comparaison du vécu » (26/09/2026) : infoParIdDepuis lit
// désormais aussi sujet/relation/type/motsInconnus depuis la MÊME interprétation 'comprendre',
// via une variable intermédiaire `d = interp.donnees` -- jamais un second appel à comprendre() ni
// un autre champ/origine. La garantie reste : origine === 'comprendre' testée, et l'état lu
// depuis le `.donnees` de CETTE interprétation, quel que soit le nom de variable utilisé.)
test('[STATIQUE] la résolution des états lit bien origine === \'comprendre\' puis .donnees.etat de CETTE interprétation (jamais un autre champ)', () => {
  const debut = ecranJs.indexOf('data-langage-motifs-lister');
  const finZone = ecranJs.indexOf('// Exposés pour le pont conversationnel', debut);
  const bloc = sansCommentaires(ecranJs.slice(debut, finZone));
  assert.match(bloc, /origine\s*===\s*'comprendre'/);
  assert.match(bloc, /interp\s*\?\s*interp\.donnees/, 'donnees doit venir de CETTE interprétation \'comprendre\', jamais d\'ailleurs');
  assert.match(bloc, /\.etat\b/);
});

// -------------------------------------------------------------------- fichiers garantis inchangés
import crypto from 'node:crypto';
const EMPREINTES_INCHANGEES = {
  // (app/langage/induction.js n'est plus épinglé par empreinte de FICHIER ENTIER ici : ce pin ne
  // valait que pour les chantiers antérieurs à celui-ci, où induction.js ne devait pas bouger DU
  // TOUT. Ce chantier lui ajoute légitimement repartirMotifsParEtat() -- repererMotifs() elle-même
  // reste garantie par contenu exact, voir le test [GARDE] dédié plus haut dans ce fichier.)
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
// === FIN_TEST_REPARTITION_MOTIFS_ETAT ===
