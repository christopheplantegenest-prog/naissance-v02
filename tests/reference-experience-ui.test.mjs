// === DEBUT_TEST_REFERENCE_EXPERIENCE_UI ===
// Chantier « RÉFÉRENCE EXPLICITE D'UNE VRAIE EXPÉRIENCE À UNE TRACE » (ÉTAPE 5.2-bis). Couvre les
// lettres A à F, T, U du cadrage (section 13), au niveau UI (conversation/ecran.js). Même faux DOM
// minimal que tests/premier-acte-ui.test.mjs (dupliqué volontairement : suites indépendantes).
import { test } from 'node:test';
import assert from 'node:assert/strict';

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
const { fauxStockage } = await import('./outils.mjs');
const { lireBrouillon } = await import('../app/conversation/brouillon.js');

// Isole un stockage de brouillon propre par test (évite toute fuite entre les tests, le module
// brouillon.js utilise localStorage par défaut, qu'on fournit nous-même ici).
function monterStockage() {
  const s = fauxStockage();
  globalThis.localStorage = s;
  return s;
}

async function monterCoquille(repondreFn, { surActe, surJugement } = {}) {
  monterStockage();
  const liste = new Faux('div');
  const formulaire = new Faux('form');
  const champ = new Faux('textarea');
  const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const appelsRepondre = [];
  const repondreTrace = async (texte, options) => { appelsRepondre.push({ texte, options }); return repondreFn(texte, options); };
  const conv = monterConversation({
    liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
    repondre: repondreTrace,
    surActe,
    surJugement,
  });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const boutonsDe = (bulle) => { const r = []; const parcourir = (e) => e.children.forEach((c) => { if (c.tag === 'button') r.push(c); parcourir(c); }); parcourir(bulle); return r; };
  const bandeauReference = () => formulaire.children.find((c) => c.className.includes('bandeau-reference'));
  return { conv, champ, formulaire, soumettre, bullesIA, boutonsDe, bandeauReference, appelsRepondre };
}

// A. bulle sans idTrace → pas de "Répondre".
test('A. réponse sans idTrace : aucun bouton "Répondre"', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquille(async () => ({ texte: 'réponse ordinaire', local: true }));
  await soumettre('bonjour');
  const boutons = boutonsDe(bullesIA().at(-1));
  assert.equal(boutons.some((b) => b.textContent === 'Répondre'), false);
});

// B. bulle avec idTrace → "Répondre" présent (totalement indépendant de "Marquer", sans surActe).
test('B. réponse avec idTrace : exactement un bouton "Répondre", sans dépendance à surActe', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquille(async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }));
  await soumettre('bonjour');
  const boutons = boutonsDe(bullesIA().at(-1)).filter((b) => b.textContent === 'Répondre');
  assert.equal(boutons.length, 1);
});

// C/D. T1 puis T2 : chaque clic capture exactement sa propre trace ; le second remplace le premier.
test('C/D. clic sur T1 puis T2 : le brouillon ne porte jamais que la dernière référence', async () => {
  let compteur = 0;
  const { soumettre, bullesIA, boutonsDe, champ } = await monterCoquille(
    async () => { compteur += 1; return { texte: `réponse ${compteur}`, local: true, idTrace: `trace-${compteur}` }; },
  );
  await soumettre('premier message');
  await soumettre('second message');
  const bulles = bullesIA();
  const boutonT1 = boutonsDe(bulles[0]).find((b) => b.textContent === 'Répondre');
  const boutonT2 = boutonsDe(bulles[1]).find((b) => b.textContent === 'Répondre');
  champ.value = 'ma question en cours';
  (champ.listeners.input || []).forEach((f) => f());
  boutonT1.click();
  let brouillon = lireBrouillon();
  assert.deepEqual(brouillon && brouillon.referenceTrace, { idTrace: 'trace-1' });
  boutonT2.click();
  brouillon = lireBrouillon();
  assert.deepEqual(brouillon && brouillon.referenceTrace, { idTrace: 'trace-2' }, 'T2 doit remplacer T1, jamais s\'additionner');
});

// E. annuler la référence conserve le texte déjà tapé.
test('E. annuler la référence (bouton du bandeau) conserve le texte du champ', async () => {
  const { soumettre, bullesIA, boutonsDe, champ, bandeauReference } = await monterCoquille(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
  );
  await soumettre('bonjour');
  champ.value = 'mon texte en cours';
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Répondre').click();
  const bandeau = bandeauReference();
  assert.ok(bandeau && !bandeau.hidden, 'le bandeau doit être visible après sélection');
  const boutonAnnuler = bandeau.children.find((c) => c.tag === 'button');
  boutonAnnuler.click();
  assert.equal(champ.value, 'mon texte en cours', 'annuler la référence ne doit jamais toucher au texte');
  assert.equal(bandeau.hidden, true, 'le bandeau doit redevenir invisible après annulation');
});

// F. cliquer Répondre sans envoyer n'appelle jamais repondre() (aucune experience/acte/trace créée).
test('F. cliquer "Répondre" sans envoyer ne déclenche aucun appel à repondre()', async () => {
  const { soumettre, bullesIA, boutonsDe, appelsRepondre } = await monterCoquille(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
  );
  await soumettre('bonjour');
  const avant = appelsRepondre.length;
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Répondre').click();
  await attendre();
  assert.equal(appelsRepondre.length, avant, 'aucun envoi ne doit être déclenché par le seul clic sur Répondre');
});

// S / voyage de la référence : au moment de l'envoi réel, options.referenceTrace porte exactement
// la trace sélectionnée -- jamais retrouvée depuis le texte, jamais une citation insérée dedans.
test('la référence sélectionnée voyage exactement comme donnée structurée jusqu\'à repondre(texte, options)', async () => {
  const { soumettre, bullesIA, boutonsDe, champ, appelsRepondre } = await monterCoquille(
    async (texte, options) => (options && options.referenceTrace
      ? { texte: 'ok avec référence', local: true }
      : { texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
  );
  await soumettre('bonjour');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Répondre').click();
  await soumettre('une vraie question ?');
  const dernier = appelsRepondre.at(-1);
  assert.deepEqual(dernier.options.referenceTrace, { idTrace: 'trace-1' });
  assert.equal(dernier.texte, 'une vraie question ?', 'le texte tapé ne doit jamais être transformé pour y insérer la référence');
});

// Après un envoi réussi, la référence de composition est consommée (ne doit pas s'appliquer au
// message suivant, qui n'a rien demandé).
test('après un envoi réussi, la référence ne s\'applique plus au message suivant', async () => {
  const { soumettre, bullesIA, boutonsDe, appelsRepondre } = await monterCoquille(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
  );
  await soumettre('bonjour');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Répondre').click();
  await soumettre('une vraie question ?');
  await soumettre('un autre message, sans référence');
  const dernier = appelsRepondre.at(-1);
  assert.ok(!dernier.options.referenceTrace, 'la référence déjà envoyée ne doit pas s\'appliquer au message suivant');
});

// T. "Répondre" n'appelle jamais surActe (ne crée jamais d'acte).
test('T. cliquer "Répondre" n\'appelle jamais surActe', async () => {
  const appelsActe = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquille(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async (idTrace) => appelsActe.push(idTrace) },
  );
  await soumettre('bonjour');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Répondre').click();
  await attendre();
  assert.deepEqual(appelsActe, [], '"Répondre" ne doit jamais appeler surActe');
});

// U. "Marquer" ne remplit jamais referenceTrace (indépendance totale, dans les deux sens).
test('U. cliquer "Marquer" ne sélectionne jamais de référence pour le message suivant', async () => {
  const { soumettre, bullesIA, boutonsDe, appelsRepondre } = await monterCoquille(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async () => {} },
  );
  await soumettre('bonjour');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Marquer').click();
  await attendre();
  await soumettre('message suivant');
  const dernier = appelsRepondre.at(-1);
  assert.ok(!dernier.options.referenceTrace, '"Marquer" ne doit jamais remplir referenceTrace');
});

// "Marquer" et "Répondre" coexistent sur la même bulle sans jamais se confondre.
test('contre-exemple : "Marquer" et "Répondre" coexistent sur la même bulle, sans interaction cachée', async () => {
  const appelsActe = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquille(
    async () => ({ texte: 'réponse locale', local: true, idTrace: 'trace-1' }),
    { surActe: async (idTrace) => appelsActe.push(idTrace) },
  );
  await soumettre('bonjour');
  const bulle = bullesIA().at(-1);
  const marquer = boutonsDe(bulle).find((b) => b.textContent === 'Marquer');
  const repondreB = boutonsDe(bulle).find((b) => b.textContent === 'Répondre');
  assert.ok(marquer && repondreB);
  repondreB.click();
  assert.deepEqual(appelsActe, [], 'cliquer "Répondre" ne doit jamais déclencher "Marquer"');
});

// H (volet UI) : un brouillon avec referenceTrace, déjà stocké AVANT le montage, fait réapparaître
// le bandeau dès le rechargement -- exactement comme le texte du brouillon existant.
test('H. un brouillon stocké avec referenceTrace réaffiche le bandeau au rechargement', async () => {
  const s = monterStockage();
  s.setItem('naissance-ia.message-en-attente.v1', JSON.stringify({ texte: 'message pas parti', date: 'd', referenceTrace: { idTrace: 'trace-9' } }));
  const liste = new Faux('div');
  const formulaire = new Faux('form');
  const champ = new Faux('textarea');
  const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({
    liste, formulaire, repondre: async () => ({ texte: 'x' }),
    chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
  });
  await conv.recharger();
  assert.equal(champ.value, 'message pas parti');
  const bandeau = formulaire.children.find((c) => c.className.includes('bandeau-reference'));
  assert.ok(bandeau && !bandeau.hidden, 'le bandeau doit réapparaître avec le brouillon restauré');
});

// G (volet UI) : une ancienne bulle sans idTrace affichée après rechargement ne montre jamais de
// bouton fantôme.
test('contre-exemple : une bulle rechargée sans idTrace ne montre jamais "Répondre"', async () => {
  monterStockage();
  const liste = new Faux('div');
  const formulaire = new Faux('form');
  const champ = new Faux('textarea');
  const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({
    liste, formulaire, repondre: async () => ({ texte: 'x' }),
    chargerRecents: async () => [{ role: 'moi', texte: 'question', id: 1 }, { role: 'ia', texte: 'réponse', id: 2 }],
    etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
  });
  await conv.recharger();
  const bulle = liste.children.find((c) => c._cls.has('message-ia'));
  const boutons = []; const parcourir = (e) => e.children.forEach((c) => { if (c.tag === 'button') boutons.push(c); parcourir(c); });
  parcourir(bulle);
  assert.equal(boutons.some((b) => b.textContent === 'Répondre'), false);
});
// === FIN_TEST_REFERENCE_EXPERIENCE_UI ===
