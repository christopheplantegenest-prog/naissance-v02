// Contrats des ÉCRANS : ces tests importent les VRAIS fichiers app/langage/ecran.js et
// app/conversation/ecran.js (avec un faux DOM minimal) et contrôlent statiquement app/main.js.
//
// Pourquoi : jusqu'à la v0.15, aucun test n'importait main.js, conversation/ecran.js ni langage/ecran.js,
// et les tests de langage.test.mjs utilisent des dispatchers « miroirs » (des copies de la logique de
// l'écran). Résultat : 293 tests verts alors que le pont « Apprends : » était cassé — deux fichiers de la
// v0.15.0 n'avaient jamais atteint le dépôt (voir ARCHITECTURE-IA.md, sections v0.15.2 et v0.15.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE_APP = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');

// ------------------------------------------------------------------ faux DOM minimal
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
    const test = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, ''));
    const parcourir = (e) => { for (const c of e.children) { if (test(c)) return c; const r = parcourir(c); if (r) return r; } return null; };
    return parcourir(this);
  }
  click() { for (const f of this.listeners.click || []) f(); }
}
// Élément « universel » : n'importe quelle propriété ou méthode répond, pour monter un écran complexe
// (le laboratoire) dont on ne teste ici que l'interface exposée.
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
const magasinStockage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;
globalThis.localStorage = magasinStockage();

const attendre = () => new Promise((r) => setTimeout(r, 5));

// ------------------------------------------------------------------ langage/ecran.js
const { monterEcranLangage } = await import('../app/langage/ecran.js');
const { magasinMemoireVive, cleFait } = await import('../app/langage/connaissances.js');
const { repondre } = await import('../app/langage/esprit.js');
const { extraireLecon } = await import('../app/langage/lecon.js');
const { interpreterEnseignement } = await import('../app/langage/interpretation.js');

// Élargi le 26/09/2026 (décision ChatGPT « SIGNAL D'APPRENTISSAGE », étape E) : main.js/pont.js ont
// désormais besoin de reconnaitreAttentesPourExperience() (brancher le repérage d'attentes dans la
// conversation normale, sans jamais appeler repererMotifs() depuis pont.js) et jugerExperience()
// (signal de jugement facultatif, léger, depuis la conversation).
const EXPORTS_ATTENDUS = ['rafraichir', 'assurerEsprit', 'ecrireConnaissance', 'reconnaitreAttentesPourExperience', 'jugerExperience'];

function monterLangage(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

test('CONTRAT — monterEcranLangage expose exactement ce dont main.js a besoin', () => {
  const { ecran } = monterLangage();
  for (const nom of EXPORTS_ATTENDUS) assert.equal(typeof ecran[nom], 'function', `${nom} doit être une fonction`);
  assert.deepEqual(Object.keys(ecran).sort(), [...EXPORTS_ATTENDUS].sort(), 'aucun export imprévu non plus');
});

test('CONTRAT STATIQUE — chaque ecranLangage.X utilisé dans main.js existe dans les exports', () => {
  const main = readFileSync(join(RACINE_APP, 'main.js'), 'utf8');
  const utilises = new Set([...main.matchAll(/\becranLangage\.(\w+)/g)].map((m) => m[1]));
  assert.ok(utilises.size > 0, 'main.js utilise bien ecranLangage');
  for (const nom of utilises) assert.ok(EXPORTS_ATTENDUS.includes(nom), `main.js utilise ecranLangage.${nom}, absent des exports de langage/ecran.js`);
});

test('assurerEsprit renvoie TOUJOURS le même esprit (jamais deux copies de la base)', async () => {
  const { ecran } = monterLangage();
  const a = await ecran.assurerEsprit();
  const b = await ecran.assurerEsprit();
  assert.equal(a, b);
});

test('ecrireConnaissance (le vrai) : pont complet « Apprends que ma couleur est rouge. » → question → persistance', async () => {
  const { magasin, ecran } = monterLangage();
  const e = await ecran.assurerEsprit();
  // Base préparée comme celle de Christophe : le fait précédent, le genre de « couleur », la règle du possessif et la façon de dire générale.
  for (const lecon of [
    'Fait : moi / couleur / bleu.',
    'Propriété : couleur / genre / féminin.',
    'Pour possessif_toi : si genre vaut féminin, on dit ta.',
    "Façon de dire : * / moi / {possessif} {relation}, c'est {valeur}.",
  ]) await ecran.ecrireConnaissance(e, extraireLecon(lecon), { origine: 'apprise-conversation', exemple: lecon });
  assert.match(repondre(e, 'Quelle est ma couleur ?').texte, /^ta couleur, c['’]est bleu\.?$/i);

  const r = interpreterEnseignement('Apprends que ma couleur est rouge.', { lexique: e.lexique });
  assert.equal(r.ok, true);
  const ecrit = await ecran.ecrireConnaissance(e, r.extrait, { origine: 'apprise-conversation', exemple: r.phrase });
  assert.match(ecrit.explication, /moi → couleur → rouge/);
  assert.equal(e.faits.get(cleFait('moi', 'couleur')).valeur, 'rouge');
  assert.match(repondre(e, 'Quelle est ma couleur ?').texte, /^ta couleur, c['’]est rouge\.?$/i);

  // « Fermeture complète puis réouverture » : un nouvel écran sur le même magasin recharge tout depuis la base.
  const { ecran: ecran2 } = monterLangage(magasin);
  const e2 = await ecran2.assurerEsprit();
  assert.notEqual(e2, e, 'un nouvel esprit, chargé depuis la base');
  assert.match(repondre(e2, 'Quelle est ma couleur ?').texte, /^ta couleur, c['’]est rouge\.?$/i);
});

test('ecrireConnaissance : refuse un type inconnu, sans rien écrire', async () => {
  const { ecran } = monterLangage();
  const e = await ecran.assurerEsprit();
  await assert.rejects(() => ecran.ecrireConnaissance(e, { type: 'inconnu', donnees: {} }), /Type de leçon inconnu/);
});

// ------------------------------------------------------------------ conversation/ecran.js
const { monterConversation } = await import('../app/conversation/ecran.js');

async function monterCoquilleConversation(repondreFn) {
  const liste = new Faux('div');
  const formulaire = new Faux('form');
  const champ = new Faux('textarea');
  const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({
    liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
    repondre: repondreFn,
  });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const boutonsDe = (bulle) => { const r = []; const parcourir = (e) => e.children.forEach((c) => { if (c.tag === 'button') r.push(c); parcourir(c); }); parcourir(bulle); return r; };
  return { liste, soumettre, bullesIA, boutonsDe };
}

test('CONVERSATION — confirmation : Confirmer appelle onOui, retire les boutons et affiche la réponse finale', async () => {
  const appels = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(async () => ({
    texte: "J'ai compris : X. C'est correct ?",
    confirmation: { onOui: async () => { appels.push('oui'); return 'Retenu.'; }, onNon: async () => { appels.push('non'); return 'Rien retenu.'; } },
  }));
  await soumettre('Apprends que ma couleur est rouge.');
  const bulle = bullesIA().at(-1);
  assert.deepEqual(boutonsDe(bulle).map((b) => b.textContent).filter((t) => t === 'Confirmer' || t === 'Annuler'), ['Confirmer', 'Annuler']);
  assert.deepEqual(appels, [], 'rien n’est appelé avant le clic');
  boutonsDe(bulle).find((b) => b.textContent === 'Confirmer').click();
  await attendre();
  assert.deepEqual(appels, ['oui']);
  assert.equal(boutonsDe(bulle).filter((b) => b.textContent === 'Confirmer' || b.textContent === 'Annuler').length, 0, 'les boutons disparaissent');
  assert.equal(bullesIA().at(-1).children[0].innerHTML, 'Retenu.');
});

test('CONVERSATION — confirmation : Annuler appelle onNon (et jamais onOui)', async () => {
  const appels = [];
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(async () => ({
    texte: 'Aperçu ?',
    confirmation: { onOui: async () => { appels.push('oui'); return 'Retenu.'; }, onNon: async () => { appels.push('non'); return "D'accord, je n'ai rien retenu."; } },
  }));
  await soumettre('Apprends que ma couleur est rouge.');
  boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Annuler').click();
  await attendre();
  assert.deepEqual(appels, ['non']);
  assert.match(bullesIA().at(-1).children[0].innerHTML, /rien retenu/);
});

test('CONVERSATION — confirmation : si l’appel échoue, les boutons sont réactivés et l’erreur est dite', async () => {
  const { liste, soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(async () => ({
    texte: 'Aperçu ?',
    confirmation: { onOui: async () => { throw new Error('échec écriture'); }, onNon: async () => 'x' },
  }));
  await soumettre('Apprends que ma couleur est rouge.');
  const oui = boutonsDe(bullesIA().at(-1)).find((b) => b.textContent === 'Confirmer');
  oui.click();
  await attendre();
  assert.equal(oui.disabled, false, 'le bouton est de nouveau utilisable');
  const infos = liste.children.filter((c) => c._cls.has('message-systeme'));
  assert.match(infos.at(-1).children[0].textContent, /échec écriture/);
});

test('CONVERSATION — une réponse ordinaire n’a JAMAIS de boutons Confirmer / Annuler', async () => {
  const { soumettre, bullesIA, boutonsDe } = await monterCoquilleConversation(async () => ({ texte: 'réponse ordinaire', local: true }));
  await soumettre('Quelle est ma couleur ?');
  assert.equal(boutonsDe(bullesIA().at(-1)).filter((b) => b.textContent === 'Confirmer' || b.textContent === 'Annuler').length, 0);
});

// ------------------------------------------------------------------ contrôle statique imports / exports
function fichiersJs(dossier) {
  const res = [];
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) res.push(...fichiersJs(p));
    else if (/\.js$/.test(nom)) res.push(p);
  }
  return res;
}
function exportsDe(source) {
  const noms = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) noms.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop().trim(); if (n) noms.add(n); }
  }
  if (/export\s+default\b/.test(source)) noms.add('default');
  return noms;
}

test('STATIQUE — tout import relatif de app/ pointe vers un fichier existant et vers un export existant', () => {
  const fichiers = fichiersJs(RACINE_APP);
  const exportsParFichier = new Map(fichiers.map((f) => [f, exportsDe(readFileSync(f, 'utf8'))]));
  const problemes = [];
  for (const f of fichiers) {
    const source = readFileSync(f, 'utf8');
    for (const m of source.matchAll(/import\s+(?:([A-Za-z0-9_$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const [, defaut, nommes, chemin] = m;
      const cible = resolve(dirname(f), chemin);
      if (!existsSync(cible)) { problemes.push(`${f.replace(RACINE_APP, 'app')} : fichier absent ${chemin}`); continue; }
      const dispo = exportsParFichier.get(cible) || exportsDe(readFileSync(cible, 'utf8'));
      if (defaut && !dispo.has('default')) problemes.push(`${f.replace(RACINE_APP, 'app')} : ${chemin} n'a pas d'export par défaut`);
      for (const part of (nommes || '').split(',')) {
        const nom = part.trim().split(/\s+as\s+/)[0].trim();
        if (nom && !dispo.has(nom)) problemes.push(`${f.replace(RACINE_APP, 'app')} : « ${nom} » n'est pas exporté par ${chemin}`);
      }
    }
    for (const m of source.matchAll(/^import\s+['"](\.[^'"]+)['"]/gm)) {
      if (!existsSync(resolve(dirname(f), m[1]))) problemes.push(`${f.replace(RACINE_APP, 'app')} : fichier absent ${m[1]}`);
    }
  }
  assert.deepEqual(problemes, []);
});

test('STATIQUE — main.js importe bien le module d’interprétation et ses deux fonctions existent', () => {
  const main = readFileSync(join(RACINE_APP, 'main.js'), 'utf8');
  assert.match(main, /import\s*\{[^}]*\bestEnseignementNaturel\b[^}]*\}\s*from\s*'\.\/langage\/interpretation\.js'/);
  assert.match(main, /import\s*\{[^}]*\binterpreterEnseignement\b[^}]*\}\s*from\s*'\.\/langage\/interpretation\.js'/);
  const dispo = exportsDe(readFileSync(join(RACINE_APP, 'langage', 'interpretation.js'), 'utf8'));
  assert.ok(dispo.has('estEnseignementNaturel') && dispo.has('interpreterEnseignement'));
});
