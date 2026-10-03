// === DEBUT_TEST_PREMIER_ACTE_UI ===
// Chantier « PREMIER BRANCHEMENT UI DE L'ACTE EXPLICITE » (03/10/2026). Couvre les lettres A à S
// du cadrage (section 11). Même discipline que tests/ecrans-contrats.test.mjs : un faux DOM
// minimal pour app/conversation/ecran.js, et le harness monterEcranLangage() réel pour les
// propriétés de persistance (I à N, qui ne sont pas des propriétés DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ------------------------------------------------------------------ faux DOM minimal (même forme
// que tests/ecrans-contrats.test.mjs, dupliqué ici volontairement : les deux fichiers de test
// restent indépendants, aucun couplage entre suites).
class Faux {
  constructor(tag) {
    this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this.attrs = {};
    this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = '';
    this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0;
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const s = this._cls;
    return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) };
  }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c) { this.appendChild(c); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) {
    const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, ''));
    const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; };
    return parcourir(this);
  }
  click() { for (const f of this.listeners.click || []) f(); }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const attendre = () => new Promise((r) => setTimeout(r, 5));

const { monterConversation } = await import('../app/conversation/ecran.js');

async function monterCoquilleConversation(repondreFn, { surActe, surJugement } = {}) {
  const liste = new Faux('div');
  const formulaire = new Faux('form');
  const champ = new Faux('textarea');
  const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({
    liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
    repondre: repondreFn,
    surActe,
    surJugement,
  });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const boutonsDe = (bulle) => { const r = []; const parcourir = (e) => e.children.forEach((c) => { if (c.tag === 'button') r.push(c); parcourir(c); }); parcourir(bulle); return r; };
  return { liste, soumettre, bullesIA, boutonsDe };
}

// A. réponse sans idTrace → aucun bouton d'acte.
test('A. réponse sans idTrace : aucun bouton "Marquer"', async () => {
  const appels = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse ordinaire', local: true }),
    { surActe: async (idTrace) => appels.push(idTrace) },
  );
  await soumettre('bonjour');
  const boutons = boutonsDe(bullesIA().at(-1));
  assert.equal(boutons.some((b) => b.textContent === 'Marquer'), false);
  assert.deepEqual(appels, []);
});

// B. réponse avec idTrace → un contrôle d'acte.
test('B. réponse avec idTrace : exactement un bouton "Marquer"', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async () => {} },
  );
  await soumettre('bonjour');
  const boutons = boutonsDe(bullesIA().at(-1)).filter((b) => b.textContent === 'Marquer');
  assert.equal(boutons.length, 1);
});

// réponse avec idTrace mais SANS callback surActe fourni : aucun bouton (jamais un bouton mort).
test('contre-exemple : idTrace présent mais surActe absent → aucun bouton', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
  );
  await soumettre('bonjour');
  const boutons = boutonsDe(bullesIA().at(-1)).filter((b) => b.textContent === 'Marquer');
  assert.equal(boutons.length, 0);
});

// C. le contrôle capture exactement cet idTrace.
test('C. le clic transmet exactement l\'idTrace de cette bulle', async () => {
  const appels = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-xyz-42' }),
    { surActe: async (idTrace) => appels.push(idTrace) },
  );
  await soumettre('bonjour');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Marquer').click();
  await attendre();
  assert.deepEqual(appels, ['trace-xyz-42']);
});

// D/E/F. T1 puis T2 : chaque bouton référence sa propre trace, jamais « la dernière ».
test('D/E/F. T1 puis T2 affichées : cliquer le bouton de T1 référence T1, celui de T2 référence T2', async () => {
  const appels = [];
  let compteur = 0;
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => { compteur += 1; return { texte: `réponse ${compteur}`, local: true, idTrace: `trace-${compteur}` }; },
    { surActe: async (idTrace) => appels.push(idTrace) },
  );
  await soumettre('premier message');
  await soumettre('second message');
  const bullesAvantClic = bullesIA();
  assert.equal(bullesAvantClic.length, 2);
  const boutonT1 = boutonsDe(bullesAvantClic[0]).find((b) => b.textContent === 'Marquer');
  const boutonT2 = boutonsDe(bullesAvantClic[1]).find((b) => b.textContent === 'Marquer');
  // Clique T2 D'ABORD, puis T1 : si une variable globale « dernière trace » existait, les deux
  // clics référenceraient tous les deux trace-2 (la plus récente). Le test échouerait alors.
  boutonT2.click();
  await attendre();
  boutonT1.click();
  await attendre();
  assert.deepEqual(appels, ['trace-2', 'trace-1']);
});

// G. clic → exactement un nouvel acte (un seul appel par clic).
test('G. un clic déclenche exactement un appel à surActe', async () => {
  const appels = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async (idTrace) => appels.push(idTrace) },
  );
  await soumettre('bonjour');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Marquer').click();
  await attendre();
  assert.equal(appels.length, 1);
});

// H. deux clics sur le même bouton → deux actes distincts, jamais un toggle/dédoublonnage.
test('H. deux clics successifs sur le même bouton déclenchent deux appels distincts (aucune déduplication)', async () => {
  const appels = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async (idTrace) => appels.push(idTrace) },
  );
  await soumettre('bonjour');
  const bouton = boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Marquer');
  bouton.click();
  await attendre();
  assert.equal(bouton.disabled, false, 'le bouton doit rester utilisable après un acte réussi (pas un toggle)');
  bouton.click();
  await attendre();
  assert.deepEqual(appels, ['trace-1', 'trace-1']);
});

// P. erreur de persistance → pas de faux succès UI, bouton réessayable.
test('P. si surActe échoue, aucun faux succès n\'est affiché et le bouton reste réessayable', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async () => { throw new Error('échec persistance'); } },
  );
  await soumettre('bonjour');
  const bulle = bullesIA().at(-1);
  const bouton = boutonsDe(bulle).find((b) => b.textContent === 'Marquer');
  bouton.click();
  await attendre();
  assert.equal(bouton.disabled, false, 'réessayable après échec');
  // Aucun texte affiché ne doit prétendre un succès (« Noté » sans mention de l'échec).
  const textes = [];
  const parcourir = (e) => { textes.push(e.textContent); e.children.forEach(parcourir); };
  parcourir(bulle);
  assert.equal(textes.includes('Noté.'), false, 'aucun accusé de succès ne doit être affiché après un échec');
  assert.ok(textes.some((t) => /échec persistance/.test(t)), "l'erreur réelle doit être dite");
});

// Q. action/rejeu/composition utilisent le même mécanisme : idTrace est un champ générique, la
// bulle ne distingue jamais sa voie d'origine pour décider d'afficher le bouton.
test('Q. le bouton apparaît identiquement quelle que soit la voie d\'origine de idTrace', async () => {
  for (const voie of ['action', 'rejeu', 'composition']) {
    const appels = [];
    // eslint-disable-next-line no-await-in-loop
    const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
      async () => ({ texte: `réponse voie ${voie}`, local: true, idTrace: `trace-${voie}` }),
      { surActe: async (idTrace) => appels.push(idTrace) },
    );
    // eslint-disable-next-line no-await-in-loop
    await soumettre('message');
    const bouton = boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Marquer');
    assert.ok(bouton, `voie ${voie} doit afficher le bouton`);
    bouton.click();
    // eslint-disable-next-line no-await-in-loop
    await attendre();
    assert.deepEqual(appels, [`trace-${voie}`]);
  }
});

// R. les boutons de jugement existants (idExperience) restent inchangés en présence de surActe.
test('R. les boutons ✓/✗ (idExperience) restent inchangés même quand surActe est fourni', async () => {
  const appelsJugement = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse via repli', idExperience: 'exp-1' }),
    { surActe: async () => {}, surJugement: async (id, val) => appelsJugement.push([id, val]) },
  );
  await soumettre('bonjour');
  const bulle = bullesIA().at(-1);
  const correct = boutonsDe(bulle).find((b) => b.textContent === '✓ correct');
  assert.ok(correct, 'le bouton de jugement doit toujours apparaître');
  correct.click();
  await attendre();
  assert.deepEqual(appelsJugement, [['exp-1', 'correct']]);
});

// S. une bulle avec idExperience ET idTrace ne doit jamais confondre les deux callbacks.
test('S. idExperience et idTrace coexistant sur la même bulle : les callbacks ne se confondent jamais', async () => {
  const appelsActe = [];
  const appelsJugement = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse mixte', idExperience: 'exp-7', idTrace: 'trace-7', local: true }),
    {
      surActe: async (idTrace) => appelsActe.push(idTrace),
      surJugement: async (id, val) => appelsJugement.push([id, val]),
    },
  );
  await soumettre('bonjour');
  const bulle = bullesIA().at(-1);
  const boutonMarquer = boutonsDe(bulle).find((b) => b.textContent === 'Marquer');
  const boutonIncorrect = boutonsDe(bulle).find((b) => b.textContent === '✗ incorrect');
  assert.ok(boutonMarquer && boutonIncorrect, 'les deux contrôles doivent coexister sur la même bulle');
  boutonMarquer.click();
  await attendre();
  assert.deepEqual(appelsActe, ['trace-7']);
  assert.deepEqual(appelsJugement, [], 'le clic sur Marquer ne doit jamais appeler surJugement');
  boutonIncorrect.click();
  await attendre();
  assert.deepEqual(appelsJugement, [['exp-7', 'incorrect']]);
  assert.deepEqual(appelsActe, ['trace-7'], 'le clic sur ✗ incorrect ne doit jamais appeler surActe une seconde fois');
});

// Contre-exemple : un libellé « Marquer » ne porte aucune interprétation — aucun autre texte de
// jugement (correct/incorrect/utile/j'aime...) n'apparaît dans ce bloc.
test('contre-exemple : le bloc du bouton d\'acte ne contient aucun mot de jugement', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async () => {} },
  );
  await soumettre('bonjour');
  const bulle = bullesIA().at(-1);
  const boutons = boutonsDe(bulle).map((b) => b.textContent);
  for (const mot of ['correct', 'incorrect', 'utile', 'inutile', 'réussi', 'raté', "j'aime"]) {
    assert.equal(boutons.some((t) => t.toLowerCase().includes(mot)), false, `le mot "${mot}" ne doit apparaître sur aucun bouton`);
  }
});
// ------------------------------------------------------------------ langage/ecran.js : lettres
// I à O, propriétés de PERSISTANCE (pas des propriétés DOM) — même harness que
// tests/ecrans-contrats.test.mjs (monterEcranLangage réel, zone « universelle »).
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
const { monterEcranLangage } = await import('../app/langage/ecran.js');
const { magasinMemoireVive, enregistrerTrace, enregistrerActe } = await import('../app/langage/connaissances.js');
const { apresNouveauVecu } = await import('../app/langage/vecu.js');

function monterLangage(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

async function tracePourTest(magasin) {
  return enregistrerTrace(magasin, {
    capacite: 'confrontation', voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: {},
  });
}

// I. origine enregistrée = "interface" (le canal choisi pour ce premier branchement UI).
test('I. enregistrerActeExplicite() persiste un acte avec origine "interface"', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  await ecran.enregistrerActeExplicite(trace.id);
  const actes = await magasin.lireTout('actes');
  assert.equal(actes.length, 1);
  assert.equal(actes[0].origine, 'interface');
  assert.equal(actes[0].idTrace, trace.id);
});

// J. trace inchangée par le branchement UI.
test('J. la trace référencée n\'est jamais modifiée par enregistrerActeExplicite()', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  const avant = JSON.stringify(trace);
  await ecran.enregistrerActeExplicite(trace.id);
  const tracesApres = await magasin.lireTout('traces');
  assert.equal(JSON.stringify(tracesApres.find((t) => t.id === trace.id)), avant);
});

// K. aucune expérience créée par le branchement UI.
test('K. enregistrerActeExplicite() ne crée aucune expérience', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  await ecran.enregistrerActeExplicite(trace.id);
  assert.equal((await magasin.lireTout('experiences')).length, 0);
});

// L. aucun referenceTrace rempli (découle directement de K : aucune expérience n'existe).
test('L. aucun referenceTrace n\'est rempli par enregistrerActeExplicite()', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  await ecran.enregistrerActeExplicite(trace.id);
  const experiences = await magasin.lireTout('experiences');
  assert.equal(experiences.filter((e) => e.referenceTrace).length, 0);
});

// M. aucun jugement/interprétation sur l'objet persisté.
test('M. l\'acte persisté ne porte aucun champ de jugement', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  await ecran.enregistrerActeExplicite(trace.id);
  const [acte] = await magasin.lireTout('actes');
  assert.deepEqual(Object.keys(acte).sort(), ['horodatage', 'id', 'idTrace', 'origine'].sort());
});

// N. aucun appel de capacité : seule la table 'actes' change.
test('N. enregistrerActeExplicite() ne touche à aucune table autre que "actes"', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  const { TABLES } = await import('../app/langage/connaissances.js');
  const avant = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await magasin.lireTout(t)).length])));
  await ecran.enregistrerActeExplicite(trace.id);
  for (const t of TABLES) {
    if (t === 'actes') continue;
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await magasin.lireTout(t)).length, avant[t], `la table "${t}" n'aurait pas dû changer`);
  }
});

// O. apresNouveauVecu reste inchangé : ni appelé par ce branchement, ni ouvert au type 'acte'.
test('O. apresNouveauVecu n\'est jamais appelé par ce branchement, et reste fermé au type "acte"', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  await assert.doesNotReject(() => ecran.enregistrerActeExplicite(trace.id));
  await assert.rejects(() => apresNouveauVecu({ type: 'acte', id: 'x' }));
});

// Contrat : enregistrerActeExplicite() délègue bien à enregistrerActe() de connaissances.js — pas
// une réimplémentation parallèle qui diffuserait un contrat différent.
test('contre-exemple : enregistrerActeExplicite() et enregistrerActe() produisent la même forme d\'objet', async () => {
  const { magasin, ecran } = monterLangage();
  const trace = await tracePourTest(magasin);
  const viaEcran = await ecran.enregistrerActeExplicite(trace.id);
  const viaDirect = await enregistrerActe(magasin, { idTrace: trace.id, origine: 'interface' });
  assert.deepEqual(Object.keys(viaEcran).sort(), Object.keys(viaDirect).sort());
});
// === FIN_TEST_PREMIER_ACTE_UI ===
