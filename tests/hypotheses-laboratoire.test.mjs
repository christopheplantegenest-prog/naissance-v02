// === DEBUT_TEST_HYPOTHESES_LABORATOIRE ===
// CHANTIER REFONDU (décision ChatGPT du 26/09/2026, « SIGNAL D'APPRENTISSAGE ») — REMPLACE
// ENTIÈREMENT sa version précédente : le câblage laboratoire porte désormais sur le nouveau
// mécanisme (motif + jugement humain facultatif), pas sur l'ancien (champ/état simultanés,
// retiré -- voir tests/hypotheses.test.mjs pour le diagnostic complet).
//
// Réutilise le même harnais fake-DOM que tests/comparaison-motifs.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

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
    motifsLister: new Faux(), motifsEtat: new Faux(), motifsRapport: new Faux(),
    hypothesesFormer: new Faux(), hypothesesEtat: new Faux(), hypothesesRapport: new Faux(),
    hypothesesLister: new Faux(), hypothesesListeRapport: new Faux(),
    hypothesesConfronterHypothese: new Faux(), hypothesesConfronterExperience: new Faux(),
    hypothesesConfronter: new Faux(), hypothesesConfronterEtat: new Faux(),
    hypothesesJugerExperience: new Faux(), hypothesesJugerCorrect: new Faux(), hypothesesJugerIncorrect: new Faux(),
    hypothesesJugerEtat: new Faux(),
  };
  el.motifsRapport.hidden = true;
  el.hypothesesRapport.hidden = true;
  el.hypothesesListeRapport.hidden = true;
  const carte = {
    'data-langage-motifs-lister': 'motifsLister',
    'data-langage-motifs-etat': 'motifsEtat',
    'data-langage-motifs-rapport': 'motifsRapport',
    'data-langage-hypotheses-former': 'hypothesesFormer',
    'data-langage-hypotheses-etat': 'hypothesesEtat',
    'data-langage-hypotheses-rapport': 'hypothesesRapport',
    'data-langage-hypotheses-lister': 'hypothesesLister',
    'data-langage-hypotheses-liste-rapport': 'hypothesesListeRapport',
    'data-langage-hypotheses-confronter-hypothese': 'hypothesesConfronterHypothese',
    'data-langage-hypotheses-confronter-experience': 'hypothesesConfronterExperience',
    'data-langage-hypotheses-confronter': 'hypothesesConfronter',
    'data-langage-hypotheses-confronter-etat': 'hypothesesConfronterEtat',
    'data-langage-hypotheses-juger-experience': 'hypothesesJugerExperience',
    'data-langage-hypotheses-juger-correct': 'hypothesesJugerCorrect',
    'data-langage-hypotheses-juger-incorrect': 'hypothesesJugerIncorrect',
    'data-langage-hypotheses-juger-etat': 'hypothesesJugerEtat',
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

// Deux expériences qui partagent le motif « mot:comment » -- l'une jugée correcte, l'autre non
// encore jugée (elle recevra plus tard l'attente).
async function deuxExperiencesMemeMotif(magasin) {
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

test('[ROUGE] « Juger une expérience » (Correct) ajoute un jugement, sans hypothèse ni motif requis au préalable', async () => {
  const { el, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  const [exp] = (await magasin.lireTout('experiences')).filter((x) => x.id === e1.id);
  assert.ok(exp.interpretations.some((i) => i.origine === 'jugement-christophe' && i.donnees.jugement === 'correct'));
  assert.ok(el.hypothesesJugerEtat.textContent.toLowerCase().includes('correct'));
});

test('[ROUGE] « Former des hypothèses » ne forme rien tant qu\'aucune expérience n\'est jugée', async () => {
  const { el, magasin } = await monter();
  await deuxExperiencesMemeMotif(magasin);
  await el.hypothesesFormer.declencher('click');
  const toutes = await magasin.lireTout('hypotheses');
  assert.deepEqual(toutes, []);
});

test('[ROUGE] après un jugement, « Former des hypothèses » persiste une hypothèse avec une attente univoque', async () => {
  const { el, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  await el.hypothesesFormer.declencher('click');
  const toutes = await magasin.lireTout('hypotheses');
  const h = toutes.find((x) => x.motifCle === 'mot:comment');
  assert.ok(h, 'une hypothèse sur le motif « mot:comment » doit être formée');
  assert.equal(h.attente, 'correct');
  assert.ok(el.hypothesesRapport.textContent.toLowerCase().includes('correct'));
});

test('[ROUGE] « Lister les hypothèses » affiche l\'attente et l\'état des hypothèses persistées', async () => {
  const { el, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  await el.hypothesesFormer.declencher('click');
  await el.hypothesesLister.declencher('click');
  const texte = el.hypothesesListeRapport.textContent.toLowerCase();
  assert.ok(texte.includes('proposee'));
  assert.ok(texte.includes('correct'));
});

test('[ROUGE-CRITIQUE] « Poser l\'attente » puis juger CONFRONTE l\'attente déjà posée -- ordre respecté', async () => {
  const { el, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  await el.hypothesesFormer.declencher('click');
  const [h] = await magasin.lireTout('hypotheses');

  // Nouvelle expérience du même motif, PAS ENCORE jugée : on pose l'attente d'abord.
  const nouvelle = await (async () => {
    const { enregistrerExperience: reg } = await import('../app/langage/connaissances.js');
    return reg(magasin, { texteRecu: "Comment tu t'appelles ?", texteRepondu: 'Naissance.', date: '2026-09-27T09:00:00.000Z', source: 'laboratoire' });
  })();
  el.hypothesesConfronterHypothese.value = h.id;
  el.hypothesesConfronterExperience.value = nouvelle.id;
  await el.hypothesesConfronter.declencher('click');
  const avantJugement = (await magasin.lireTout('experiences')).find((x) => x.id === nouvelle.id);
  assert.ok(avantJugement.interpretations.some((i) => i.origine === 'attente-hypothese'), 'attente posée AVANT tout jugement');
  assert.ok(!avantJugement.interpretations.some((i) => i.origine === 'jugement-christophe'));

  // Christophe juge ensuite : la confrontation doit se déclencher automatiquement.
  el.hypothesesJugerExperience.value = nouvelle.id;
  await el.hypothesesJugerCorrect.declencher('click');
  const [hApres] = await magasin.lireTout('hypotheses');
  assert.equal(hApres.etatHypothese, 'proposee', 'compatible : reste proposee');
  assert.equal(hApres.confrontations.length, 1);
  assert.ok(el.hypothesesJugerEtat.textContent.toLowerCase().includes('compatible'));
});

test('[ROUGE-CRITIQUE] poser une attente sur une expérience DÉJÀ jugée est REFUSÉ (impossible de fabriquer une prédiction après coup)', async () => {
  const { el, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  await el.hypothesesFormer.declencher('click');
  const [h] = await magasin.lireTout('hypotheses');
  // e1 porte déjà un jugement : poser une attente dessus maintenant doit être refusé.
  el.hypothesesConfronterHypothese.value = h.id;
  el.hypothesesConfronterExperience.value = e1.id;
  await el.hypothesesConfronter.declencher('click');
  assert.ok(el.hypothesesConfronterEtat.textContent.toLowerCase().includes('déjà') || el.hypothesesConfronterEtat.textContent.toLowerCase().includes('deja'));
  const apres = (await magasin.lireTout('experiences')).find((x) => x.id === e1.id);
  assert.ok(!apres.interpretations.some((i) => i.origine === 'attente-hypothese'));
});

test('[ROUGE] reconnaitreAttentesPourExperience (exposée pour pont.js) pose l\'attente d\'une hypothèse existante sur une nouvelle expérience correspondante, sans jamais appeler repererMotifs depuis pont.js/connaissances.js', async () => {
  const { el, ecran, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  await el.hypothesesFormer.declencher('click');

  const { enregistrerExperience: reg } = await import('../app/langage/connaissances.js');
  const nouvelle = await reg(magasin, { texteRecu: "Comment tu t'appelles ?", texteRepondu: 'Naissance.', date: '2026-09-27T09:00:00.000Z', source: 'laboratoire' });
  const posees = await ecran.reconnaitreAttentesPourExperience(nouvelle.id);
  // Trois motifs partagent la couverture {e1} (« mot:comment », « role:interrogatif », « role:verbe »
  // -- repererMotifs() les constate tous les trois) : chacun porte sa propre hypothèse avec une
  // attente 'correct', et la nouvelle expérience correspond aux trois -- trois attentes posées.
  assert.equal(posees.length, 3);
  const exp = (await magasin.lireTout('experiences')).find((x) => x.id === nouvelle.id);
  assert.ok(exp.interpretations.some((i) => i.origine === 'attente-hypothese'));
});

test('[ROUGE] le rapport de formation ne qualifie jamais la comparaison de cause, signification ou intérêt', async () => {
  const { el, magasin } = await monter();
  const { e1 } = await deuxExperiencesMemeMotif(magasin);
  el.hypothesesJugerExperience.value = e1.id;
  await el.hypothesesJugerCorrect.declencher('click');
  await el.hypothesesFormer.declencher('click');
  const texte = el.hypothesesRapport.textContent.toLowerCase();
  for (const interdit of ['cause', 'signification', 'intéressant', 'interessant', 'important', 'score', 'confiance', 'majorite', 'majorité']) {
    assert.ok(!texte.includes(interdit), `vocabulaire interdit trouvé dans le rapport : ${interdit}`);
  }
});
// === FIN_TEST_HYPOTHESES_LABORATOIRE ===
