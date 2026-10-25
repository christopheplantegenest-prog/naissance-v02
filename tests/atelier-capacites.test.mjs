// v0.66.6 — ATELIER 2, L1 + L2 (GO « ATELIER 2 — GO PHASE 1 », 25/10/2026) : écran « Atelier — capacités » de l'application.
// L1 : lecture des chantiers et des versions SANS jeton ; L2 : demande, /stop, /reprendre, /valider avec le jeton du seul dépôt.
// Gardes : le jeton ne part que vers api.github.com, sur les deux écritures ; jamais affiché, journalisé ni exporté ; aucun module cognitif
// n'importe l'écran ; l'Atelier ne peut pas modifier l'écran qui le commande. OUTILLAGE NON COGNITIF (D-007). Aucun réseau réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../app/capacites/etat.js';
import { clientGithub, API } from '../app/capacites/github.js';
import { CLE_JETON, lireJeton, enregistrerJeton, effacerJeton, lireSaisieJeton } from '../app/capacites/jeton.js';
import { monterCapacites } from '../app/capacites/ecran.js';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';
import { etatBudget } from '../app/atelier/budget.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(RACINE, 'app');
const DEPOT = 'christopheplantegenest-prog/naissance-v02';
const JETON = `github_pat_${'A1b2C3d4E5'.repeat(8)}`;
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const lire = (nom) => JSON.parse(readFileSync(join(RACINE, 'tests', 'atelier-journaux-reels', `${nom}.json`), 'utf8'));
const BUDGET = etatBudget(lire('budget'));
const commentaireEtat = (e, budget = BUDGET, extra = {}) => ({ id: 1, body: `${N.MARQUE_DONNEES ? '<!-- atelier-autonome-etat situation= -->' : ''}\n${N.texteEtat(e, budget)}\n${N.donneesEtat(e, budget)}\n`, user: { login: 'github-actions[bot]' }, updated_at: '2026-10-25T13:00:00Z', ...extra });
const Q = '2026-10-25T20:00:00Z';
function chantier(evs, base = []) {
  let j = base;
  for (const [type, donnees] of evs) { const r = N.appliquerChantier(j, { type, quand: Q, donnees }); assert.ok(Array.isArray(r), `${type} : ${r.raison}`); j = r; }
  return j;
}

// ------------------------------------------------------------------------------------------------ L1 lecture de l'état
test('L1 : les données jointes au commentaire d\'état (noyau v0.66.6) se relisent à l\'identique ; « -- » d\'une question ne ferme pas le commentaire', () => {
  const e17 = N.etatChantier(chantier([['bloque', { raison: 'question', question: 'Puis-je --> modifier tests/x.test.mjs ? -- oui' }]], lire(17).slice(0, 13)));
  const c = commentaireEtat(e17);
  assert.equal((c.body.match(/-->/g) || []).length, 3); // marque d'état, la question dans le TEXTE visible, la fin des données — jamais dans le JSON
  const d = E.lireDonnees(c.body);
  assert.equal(d.etape, 'aucune');
  assert.equal(d.raison, 'bloque');
  assert.equal(d.bloque.question, 'Puis-je --> modifier tests/x.test.mjs ? -- oui');
  assert.equal(d.depense, 4_099_019);
  assert.equal(d.plafond, 25_000_000);
  assert.deepEqual(d.mois, { cycle: '2026-10', consomme: 25_573_997, reste: BUDGET.resteCycle, plafond: 100_000_000 });
  assert.equal(d.missions.length, 3);
  assert.deepEqual(d.missions[0], { id: 'issue-vecue-ecrivain', titre: d.missions[0].titre, cognitive: d.missions[0].cognitive, etat: 'en-cours', tentative: 2, tentatives: 4 });
  const r = E.resumer({ number: 17, title: 'Atelier : issue vécue (C1)', state: 'open' }, [c]);
  assert.equal(r.source, 'donnees');
  assert.equal(r.titre, 'issue vécue (C1)');
  assert.deepEqual(r.situation, { code: 'bloque', libelle: 'Bloqué : réponse attendue' });
  assert.deepEqual(E.commandesPossibles(r), ['/reprendre', '/stop']);
  // Données illisibles ou d'une autre forme : ignorées, sans exception.
  for (const b of [null, '', `${N.MARQUE_DONNEES}{ -->`, `${N.MARQUE_DONNEES}{"v":2,"ticket":1,"etape":"x","missions":[]} -->`, `${N.MARQUE_DONNEES}[] -->`]) assert.equal(E.lireDonnees(b), null);
});
test('L1 : situations des chantiers réels (livré, arrêté) et des étapes (travail, validation, colis au robot, fermé)', () => {
  const sit = (e, ouvert = true) => E.resumer({ number: e.issue, title: 'Atelier : x', state: ouvert ? 'open' : 'closed' }, [commentaireEtat(e)]).situation.code;
  assert.equal(sit(N.etatChantier(lire(18))), 'livre');
  assert.equal(sit(N.etatChantier(lire(16))), 'arret');
  assert.equal(sit(N.etatChantier(lire(17))), 'arret');
  assert.equal(sit(N.etatChantier(lire(12)), false), 'livre');
  const j18 = lire(18);
  const iValid = j18.findIndex((x) => x.type === 'validation');
  assert.equal(sit(N.etatChantier(j18.slice(0, iValid))), 'attente-validation');
  const iLivre = j18.findIndex((x) => x.type === 'livre');
  assert.equal(sit(N.etatChantier(j18.slice(0, iLivre))), 'attente-livraison');
  assert.equal(sit(N.etatChantier(j18.slice(0, 2))), 'travail'); // tour de planification ouvert
  assert.equal(sit(N.etatChantier(j18.slice(0, 1))), 'travail'); // planification à faire
  assert.equal(sit(N.etatChantier(lire(17)), false), 'ferme');
  assert.deepEqual(E.commandesPossibles({ situation: { code: 'attente-validation' } }), ['/valider', '/stop']);
  assert.deepEqual(E.commandesPossibles({ situation: { code: 'travail' } }), ['/stop']);
  assert.deepEqual(E.commandesPossibles({ situation: { code: 'livre' } }), []);
  // v0.66.7 : /stop proposé aussi sur un chantier arrêté (sans effet, sans dépense) ; /reprendre reste en tête.
  assert.deepEqual(E.commandesPossibles({ situation: { code: 'arret' } }), ['/reprendre', '/stop']);
});
test('L1 : commentaires d\'avant v0.66.6 (texte seul) lus au mieux ; seul le dernier commentaire du bot compte, jamais celui d\'un autre auteur', () => {
  const ancien = '<!-- atelier-autonome-etat situation=arret::14 -->\n**Atelier autonome** — chantier `ticket-17` (OUTILLAGE NON COGNITIF : un candidat n\'est jamais une acquisition de Naissance)\n\nPlan : C1 — version visée v0.66.5\n- 🔧 issue-vecue-ecrivain : Écrivain — tentative 2/4\n- ⏳ issue-vecue-branchement : Branchement (cognitive : validation de Christophe)\n\nDépense du chantier : 4.10 $ sur 300.00 $ — mois 2026-10 : 17.00 $ consommés, 0.00 $ réservés, 83.00 $ restants sur 100.00 $\n⏸️ Arrêté. Écrire `/reprendre` pour continuer.\n';
  const t = E.lireTexte(ancien);
  assert.equal(t.raison, 'arret');
  assert.equal(t.plan, 'C1');
  assert.equal(t.version, '0.66.5');
  assert.deepEqual(t.missions.map((m) => [m.id, m.etat, m.tentative, m.tentatives, m.cognitive]), [['issue-vecue-ecrivain', 'en-cours', 2, 4, false], ['issue-vecue-branchement', 'a-faire', 0, null, true]]);
  assert.equal(t.depense, 4_100_000);
  assert.equal(t.plafond, 300_000_000);
  assert.deepEqual(t.mois, { cycle: '2026-10', consomme: 17_000_000, reste: 83_000_000, plafond: 100_000_000 });
  const bloque = '<!-- atelier-autonome-etat situation=bloque:question:7 -->\nx\n⛔ Bloqué (question). Question : Laquelle ? Répondre en écrivant `/reprendre` sur la première ligne puis la réponse, ou `/stop`.\n';
  assert.deepEqual(E.lireTexte(bloque).bloque, { raison: 'question', question: 'Laquelle ?' });
  assert.equal(E.resumer({ number: 7, title: 'Atelier : x', state: 'open' }, [{ body: bloque, user: { login: 'github-actions[bot]' } }]).situation.code, 'bloque');
  // Format réel de v0.66.0 à v0.66.5 (ticket 18, sans « sur X $ ») : la dépense et le mois sont lus, le plafond reste inconnu.
  const v0665 = E.lireTexte('<!-- atelier-autonome-etat situation=termine::36 -->\nx\n\nDépense du chantier : 8.57 $ — mois 2026-10 : 25.57 $ consommés, 0.00 $ réservés, 74.43 $ restants sur 100.00 $\n🏁 Livré : v0.66.5.');
  assert.deepEqual([v0665.depense, v0665.plafond, v0665.mois.consomme, v0665.raison, v0665.livraison.version], [8_570_000, null, 25_570_000, 'termine', '0.66.5']);
  assert.equal(E.lireTexte('<!-- atelier-autonome-etat situation= -->\nx\nÉtape suivante : planification en cours. Écrire `/stop` pour arrêter.\n').etape, 'travail');
  // Usurpation : un commentaire de Christophe ou d'un tiers qui imite la marque n'est jamais lu comme l'état.
  const faux = { body: '<!-- atelier-autonome-etat situation=termine::9 -->\n🏁 Livré : v9.9.9.', user: { login: 'quelquun' } };
  const vrai = { body: bloque, user: { login: 'github-actions[bot]' } };
  assert.equal(E.dernierEtat([vrai, faux]), vrai);
  assert.equal(E.dernierEtat([faux]), null);
  assert.equal(E.resumer({ number: 7, title: 'Atelier : x', state: 'open' }, [faux]).situation.code, 'inconnu');
});

// ------------------------------------------------------------------------------------------------ L2 textes envoyés
test('L2 : texteCommande produit exactement ce que le workflow « commande » lit (lireCommande, lirePerimetre) ; refus explicites', () => {
  const t = E.texteCommande('/reprendre', { reponse: 'Oui, autorisé.\nAvec les annotations.', perimetre: 'tests/retrouvailles.test.mjs, app/langage/x.js' });
  assert.equal(t.corps, '/reprendre\nOui, autorisé.\nAvec les annotations.\npérimètre + : tests/retrouvailles.test.mjs, app/langage/x.js');
  const lc = N.lireCommande({ user: { id: N.PROPRIETAIRE_ID }, body: t.corps });
  assert.equal(lc.commande, '/reprendre');
  assert.deepEqual(N.lirePerimetre(lc.reste).ajouts, ['tests/retrouvailles.test.mjs', 'app/langage/x.js']);
  for (const c of ['/stop', '/valider']) assert.equal(N.lireCommande({ user: { id: N.PROPRIETAIRE_ID }, body: E.texteCommande(c).corps }).commande, c);
  assert.equal(E.texteCommande('/reprendre').corps, '/reprendre');
  assert.match(E.texteCommande('/stop', { reponse: 'x' }).raison, /seul \/reprendre/);
  assert.match(E.texteCommande('/merge').raison, /inconnue/);
  assert.match(E.texteCommande('/reprendre', { perimetre: '../app/atelier/auto.js' }).raison, /irrégulier/);
  assert.match(E.texteCommande('/reprendre', { reponse: 'x'.repeat(1401) }).raison, /trop longue/);
  // La demande d'une capacité devient un ticket « Atelier : » reconnu par l'Atelier.
  const d = E.texteDemande({ titre: '  Atelier :  Naissance sait compter  ', description: 'Compter les objets cités dans une phrase.' });
  assert.deepEqual(d, { titre: 'Atelier : Naissance sait compter', corps: 'Compter les objets cités dans une phrase.' });
  assert.equal(N.ticketDeChantier({ user: { id: N.PROPRIETAIRE_ID }, title: d.titre }), true);
  assert.match(E.texteDemande({ titre: 'ab', description: 'Compter les objets.' }).raison, /titre/);
  assert.match(E.texteDemande({ titre: 'Compter', description: 'court' }).raison, /décrire/);
  assert.match(E.texteDemande({ titre: 'Compter', description: '/valider\npuis compter les objets' }).raison, /commande/);
});
test('L1 : versions — dernière publication comparée à la version installée ; page de version limitée au dépôt', () => {
  const rel = { tag_name: 'v0.66.6', published_at: '2026-10-26T10:00:00Z', html_url: `https://github.com/${DEPOT}/releases/tag/v0.66.6`, assets: [{ name: 'naissance-v0.66.6.apk', size: 6_500_000 }] };
  assert.deepEqual(E.lireVersion(rel), { version: '0.66.6', publiee: '2026-10-26T10:00:00Z', page: rel.html_url, apk: { nom: 'naissance-v0.66.6.apk', taille: 6_500_000 } });
  assert.equal(E.lireVersion({ ...rel, html_url: 'https://ailleurs.example/x' }).page, null);
  assert.equal(E.lireVersion({ tag_name: 'nimporte' }), null);
  assert.equal(E.compareVersions('0.66.5', '0.66.6'), -1);
  assert.equal(E.compareVersions('0.66.10', '0.66.9'), 1);
  assert.equal(E.compareVersions('0.66.5', '0.66.5'), 0);
  assert.equal(E.usd(8_574_306), '8,57 $');
});

// ------------------------------------------------------------------------------------------------ faux GitHub
const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps });
function fauxFetch(routes = {}) {
  const appels = [];
  const f = async (url, init = {}) => {
    appels.push({ url, methode: init.method, entetes: { ...(init.headers || {}) }, corps: init.body ? JSON.parse(init.body) : null, credentials: init.credentials });
    const u = new URL(url);
    const cle = `${init.method} ${u.pathname}${u.search}`;
    const r = Object.entries(routes).find(([k]) => cle.startsWith(k));
    if (!r) return reponse(404, { message: 'Not Found' });
    return typeof r[1] === 'function' ? r[1](init) : reponse(200, r[1]);
  };
  f.appels = appels;
  return f;
}
const stockageMemoire = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), cles: () => [...m.keys()], m };
};

test('L1 + L2 : client GitHub — lectures sans jeton, écritures avec le jeton vers api.github.com et le seul dépôt ; erreurs sans fuite', async () => {
  const R = `/repos/${DEPOT}`;
  const tickets = [
    { number: 20, title: 'Atelier : compter', state: 'open', user: { id: N.PROPRIETAIRE_ID }, comments: 250 },
    { number: 19, title: 'Atelier : intrus', state: 'open', user: { id: 1 }, comments: 0 },
    { number: 18, title: 'Bug : autre', state: 'open', user: { id: N.PROPRIETAIRE_ID }, comments: 0 },
    { number: 17, title: 'atelier: PR', state: 'open', user: { id: N.PROPRIETAIRE_ID }, pull_request: {}, comments: 0 },
  ];
  const f = fauxFetch({ [`GET ${R}/issues?`]: tickets, [`GET ${R}/issues/20/comments?per_page=100&page=2`]: [{ id: 2 }], [`GET ${R}/issues/20/comments?per_page=100&page=3`]: [{ id: 3 }], [`POST ${R}/issues/20/comments`]: { id: 9, html_url: 'u' }, [`POST ${R}/issues`]: { number: 21, html_url: 'v' } });
  let jeton = null;
  const gh = clientGithub({ fetchFn: f, lireJeton: () => jeton });
  const l = await gh.chantiers();
  assert.deepEqual(l.map((t) => t.number), [20]);
  assert.deepEqual((await gh.commentaires(l[0])).map((c) => c.id), [2, 3]); // 250 commentaires : pages 2 et 3, l'état le plus récent est à la fin
  assert.deepEqual(await gh.commentaires({ number: 5, comments: 0 }), []);
  await assert.rejects(gh.commenter(20, '/stop'), { code: 'jeton' });
  jeton = JETON;
  assert.deepEqual(await gh.commenter(20, '/stop'), { id: 9, url: 'u' });
  assert.deepEqual(await gh.ouvrirTicket('Atelier : x', 'y'), { numero: 21, url: 'v' });
  for (const a of f.appels) {
    assert.ok(a.url.startsWith(`${API}/repos/${DEPOT}/`), a.url);
    assert.equal(a.credentials, 'omit');
    if (a.methode === 'GET') assert.equal(a.entetes.Authorization, undefined, a.url);
    else assert.equal(a.entetes.Authorization, `Bearer ${JETON}`);
  }
  assert.deepEqual(f.appels.filter((a) => a.methode === 'POST').map((a) => [new URL(a.url).pathname, a.corps]), [[`${R}/issues/20/comments`, { body: '/stop' }], [`${R}/issues`, { title: 'Atelier : x', body: 'y' }]]);
  // Erreurs : messages fixes, jamais le jeton ni la réponse brute.
  const cas = [[401, 'jeton'], [403, 'droits'], [404, 'introuvable'], [422, 'refus'], [500, 'inattendu']];
  for (const [s, code] of cas) {
    const g = clientGithub({ fetchFn: async () => reponse(s, { message: `secret ${JETON}` }), lireJeton: () => JETON });
    await assert.rejects(g.commenter(1, '/stop'), (e) => e.code === code && !e.message.includes(JETON) && !e.message.includes('secret'));
  }
  const coupe = clientGithub({ fetchFn: async (url, init) => { throw new Error(`échec ${init.headers.Authorization}`); }, lireJeton: () => JETON });
  await assert.rejects(coupe.commenter(1, '/stop'), (e) => e.code === 'reseau' && !e.message.includes(JETON));
  await assert.rejects(clientGithub({ fetchFn: async () => reponse(403, {}) }).chantiers(), { code: 'limite' });
  await assert.rejects(clientGithub({ fetchFn: null }).chantiers(), { code: 'reseau' });
});
test('L2 : jeton — seul un jeton « fine-grained » est accepté, gardé sous sa clé, effaçable ; la raison d\'un refus ne cite jamais le texte', () => {
  const s = stockageMemoire();
  assert.equal(lireJeton(s), null);
  const classique = `ghp_${'x'.repeat(36)}`;
  const r = enregistrerJeton(classique, s);
  assert.equal(r.ok, false);
  assert.match(r.raison, /classique/);
  assert.equal(r.raison.includes(classique), false);
  assert.match(lireSaisieJeton('github_pat_court').raison, /fine-grained/);
  assert.match(lireSaisieJeton('').raison, /Coller/);
  assert.deepEqual(enregistrerJeton(`  ${JETON}\n`, s), { ok: true });
  assert.deepEqual(s.cles(), [CLE_JETON]);
  assert.equal(CLE_JETON, 'naissance-ia.atelier.jeton.v1');
  assert.equal(lireJeton(s), JETON);
  s.setItem(CLE_JETON, 'altéré');
  assert.equal(lireJeton(s), null);
  assert.equal(effacerJeton(s), true);
  assert.deepEqual(s.cles(), []);
});

// ------------------------------------------------------------------------------------------------ écran (DOM factice)
class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.className = ''; this._texte = ''; this.value = ''; this.disabled = false; this.attrs = {}; this.rows = 0; this.type = ''; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); this.children = []; }
  append(...cs) { for (const c of cs) assert.ok(c instanceof Faux, 'append : nœud attendu (jamais null ni texte)'); this.children.push(...cs); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
}
const tous = (e, f) => [...(f(e) ? [e] : []), ...e.children.flatMap((c) => tous(c, f))];
const textes = (e) => [e._texte, e.value, ...Object.values(e.attrs), ...e.children.flatMap(textes)].filter(Boolean);
const attendre = () => new Promise((r) => setTimeout(r, 0));
async function monter({ stockage = stockageMemoire(), routes, version = '0.66.5' }) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  const zone = new Faux('div');
  const f = fauxFetch(routes);
  const ouverts = [];
  const ecran = monterCapacites({ zone, version, stockage, fetchFn: f, ouvrir: (u) => ouverts.push(u) });
  for (let i = 0; i < 5; i += 1) await attendre();
  const trouver = (nom) => tous(zone, (e) => e.attrs['data-capacites'] === nom);
  const un = (nom) => { const l = trouver(nom); assert.equal(l.length, 1, `« ${nom} » attendu une fois (${l.length})`); return l[0]; };
  const cliquer = async (nom) => { for (const g of un(nom).listeners.click) await g(); for (let i = 0; i < 3; i += 1) await attendre(); };
  const saisir = (nom, v) => { const e = un(nom); e.value = v; for (const g of e.listeners.input || []) g(); };
  return { zone, f, ecran, trouver, un, cliquer, saisir, ouverts, texte: () => textes(zone).join('\n') };
}
function routesReelles() {
  const R = `/repos/${DEPOT}`;
  const e18 = N.etatChantier(lire(18).slice(0, lire(18).findIndex((x) => x.type === 'validation')));
  const e17 = N.etatChantier(lire(17));
  return {
    [`GET ${R}/issues?`]: [
      { number: 18, title: 'Atelier : issue vécue (C1 v3)', state: 'open', user: { id: N.PROPRIETAIRE_ID }, comments: 3 },
      { number: 17, title: 'Atelier : issue vécue (C1, plan fourni)', state: 'open', user: { id: N.PROPRIETAIRE_ID }, comments: 2 },
      { number: 13, title: 'Atelier : taille', state: 'closed', user: { id: N.PROPRIETAIRE_ID }, comments: 4 },
    ],
    [`GET ${R}/issues/18/comments`]: [{ body: 'merci', user: { login: 'christopheplantegenest-prog' } }, commentaireEtat(e18)],
    [`GET ${R}/issues/17/comments`]: [commentaireEtat(e17)],
    [`GET ${R}/releases/latest`]: { tag_name: 'v0.66.6', published_at: '2026-10-26T10:00:00Z', html_url: `https://github.com/${DEPOT}/releases/tag/v0.66.6`, assets: [{ name: 'naissance-v0.66.6.apk', size: 6_600_000 }] },
    [`POST ${R}/issues/18/comments`]: (init) => reponse(201, { id: 77, html_url: 'x', echo: init.body }),
    [`POST ${R}/issues/17/comments`]: reponse.bind(null, 201, { id: 78 }),
    [`POST ${R}/issues`]: reponse.bind(null, 201, { number: 22 }),
  };
}

test('L1 : écran sans jeton — chantiers, missions, dépenses, version publiée ; aucune commande, aucune écriture, aucun jeton envoyé', async () => {
  const m = await monter({ routes: routesReelles() });
  const t = m.texte();
  assert.match(t, /Ticket 18 — issue vécue \(C1 v3\)/);
  assert.equal(m.un('chantier-18-situation')._texte, 'Validation attendue (/valider)');
  assert.equal(m.un('chantier-17-situation')._texte, 'Arrêté');
  assert.equal(m.trouver('chantier-18-mission').length, 3);
  assert.match(m.un('chantier-18-depense')._texte, /^Dépense du chantier : \d+,\d\d \$ sur 25,00 \$$/);
  assert.equal(m.un('mois')._texte, `Mois 2026-10 : 25,57 $ dépensés sur 100,00 $ (reste ${E.usd(BUDGET.resteCycle)})`);
  assert.match(m.un('version-publiee')._texte, /0\.66\.6 \(2026-10-26\) — plus récente/);
  await m.cliquer('ouvrir-version');
  assert.deepEqual(m.ouverts, [`https://github.com/${DEPOT}/releases/tag/v0.66.6`]);
  assert.equal(m.trouver('ferme').length, 1);
  assert.match(t, /Commandes possibles : \/valider, \/stop \(jeton nécessaire/);
  assert.equal(m.trouver('chantier-18-valider').length, 0);
  assert.equal(m.trouver('demande').length, 0);
  assert.ok(m.f.appels.every((a) => a.methode === 'GET' && a.entetes.Authorization === undefined));
  assert.equal(m.f.appels.length, 4); // tickets, version, commentaires des 2 chantiers ouverts (pas des fermés)
  // Limite de lecture : message clair, rien d'autre.
  const lim = await monter({ routes: { [`GET /repos/${DEPOT}/issues?`]: () => reponse(403, {}) } });
  assert.match(lim.un('erreur')._texte, /Limite de lecture/);
});
test('L2 : écran avec jeton — /valider et /reprendre (réponse + périmètre) s\'arment puis partent ; demande d\'une capacité ; le jeton n\'est jamais affiché', async () => {
  const s = stockageMemoire();
  const m = await monter({ stockage: s, routes: routesReelles() });
  m.saisir('jeton-saisie', `ghp_${'x'.repeat(36)}`);
  await m.cliquer('jeton-enregistrer');
  assert.match(m.texte(), /Jeton classique refusé/);
  m.saisir('jeton-saisie', JETON);
  await m.cliquer('jeton-enregistrer');
  assert.equal(s.getItem(CLE_JETON), JETON);
  assert.equal(m.un('jeton-present')._texte, 'Jeton enregistré sur cet appareil.');
  assert.equal(m.texte().includes(JETON), false);
  // /valider : premier toucher = armé, rien n'est envoyé ; second = envoyé.
  await m.cliquer('chantier-18-valider');
  assert.equal(m.un('chantier-18-valider')._texte, 'Confirmer : Valider (/valider)');
  assert.equal(m.f.appels.filter((a) => a.methode === 'POST').length, 0);
  await m.cliquer('chantier-18-valider');
  let posts = m.f.appels.filter((a) => a.methode === 'POST');
  assert.deepEqual(posts.map((a) => [new URL(a.url).pathname, a.corps.body, a.entetes.Authorization]), [[`/repos/${DEPOT}/issues/18/comments`, '/valider', `Bearer ${JETON}`]]);
  assert.match(m.texte(), /\/valider envoyé sur le ticket 18/);
  // /reprendre sur le ticket 17 avec réponse et périmètre.
  m.saisir('chantier-17-reponse', 'Oui, autorisé.');
  m.saisir('chantier-17-perimetre', 'tests/retrouvailles.test.mjs, tests/lien-execution-designation.test.mjs');
  await m.cliquer('chantier-17-reprendre');
  await m.cliquer('chantier-17-reprendre');
  posts = m.f.appels.filter((a) => a.methode === 'POST');
  assert.equal(posts[1].corps.body, '/reprendre\nOui, autorisé.\npérimètre + : tests/retrouvailles.test.mjs, tests/lien-execution-designation.test.mjs');
  // Périmètre irrégulier : refusé avant tout envoi.
  m.saisir('chantier-17-perimetre', '../app/atelier/auto.js');
  await m.cliquer('chantier-17-reprendre');
  await m.cliquer('chantier-17-reprendre');
  assert.equal(m.f.appels.filter((a) => a.methode === 'POST').length, 2);
  assert.match(m.texte(), /chemin irrégulier/);
  // Demande d'une capacité.
  m.saisir('demande-titre', 'Naissance sait compter');
  m.saisir('demande-description', 'Compter les objets cités dans une phrase.');
  await m.cliquer('demande-envoyer');
  await m.cliquer('demande-envoyer');
  posts = m.f.appels.filter((a) => a.methode === 'POST');
  assert.deepEqual(posts[2].corps, { title: 'Atelier : Naissance sait compter', body: 'Compter les objets cités dans une phrase.' });
  assert.match(m.texte(), /Demande envoyée : ticket 22/);
  // Jamais le jeton dans l'écran ; jamais vers un autre hôte ; lectures toujours sans jeton.
  assert.equal(m.texte().includes(JETON), false);
  assert.ok(m.f.appels.every((a) => a.url.startsWith(`https://api.github.com/repos/${DEPOT}/`)));
  assert.ok(m.f.appels.filter((a) => a.methode === 'GET').every((a) => a.entetes.Authorization === undefined));
  // Effacer le jeton : armé puis effacé ; les commandes disparaissent.
  await m.cliquer('jeton-effacer');
  await m.cliquer('jeton-effacer');
  assert.equal(s.getItem(CLE_JETON), null);
  assert.equal(m.trouver('chantier-18-valider').length, 0);
});

// ------------------------------------------------------------------------------------------------ gardes statiques
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : (n.endsWith('.js') || n.endsWith('.mjs') ? [p] : []); });
test('Gardes : l\'écran reste isolé — aucun module de Naissance ne l\'importe (sauf main.js, au toucher) ; il n\'importe que ses trois modules ; jeton cantonné', () => {
  const app = fichiersJs(APP).map((p) => [relative(RACINE, p), sansCommentaires(readFileSync(p, 'utf8'))]);
  for (const [p, c] of app) {
    if (p.startsWith('app/capacites/')) continue;
    if (p === 'app/main.js') { assert.deepEqual(c.match(/[^\s(]*capacites\/[^\s)]*/g), ["'./capacites/ecran.js'"]); assert.equal(c.split("import('./capacites/ecran.js')").length, 2); continue; }
    assert.equal(/capacites\//.test(c), false, `${p} importe l'écran des capacités`);
    assert.equal(/naissance-ia\.atelier\.jeton/.test(c), false, `${p} lit le jeton`);
  }
  for (const [p, c] of app.filter(([x]) => x.startsWith('app/capacites/'))) {
    const imports = [...c.matchAll(/(?:from|import\s*\()\s*'([^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.every((i) => ['./etat.js', './github.js', './jeton.js'].includes(i)), `${p} : ${imports}`);
    for (const re of [/\bconsole\./, /innerHTML/, /\beval\(/, /new Function/, /indexedDB/, /sessionStorage/, /document\.cookie/]) assert.equal(re.test(c), false, `${p} ${re}`);
    if (!p.endsWith('/jeton.js')) assert.equal(/naissance-ia\.atelier\.jeton/.test(c), false, p);
    if (!p.endsWith('/github.js')) { assert.equal(/\bfetch\s*\(|Authorization|XMLHttpRequest/.test(c), false, p); assert.equal(/https?:\/\/(?!github\.com\/\$\{DEPOT\})/.test(c), false, p); }
  }
  const gh = sansCommentaires(readFileSync(join(APP, 'capacites', 'github.js'), 'utf8'));
  assert.deepEqual([...gh.matchAll(/https:\/\/[^'`\s]*/g)].map((m) => m[0]), ['https://api.github.com']);
  // La sauvegarde de Naissance ne lit pas localStorage : le jeton n'est jamais exporté.
  assert.equal(/localStorage/.test(sansCommentaires(readFileSync(join(APP, 'memoire', 'sauvegarde.js'), 'utf8'))), false);
  // Entrée des Réglages et panneau vide dans index.html.
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  assert.equal((html.match(/data-ouvrir-capacites/g) || []).length, 1);
  assert.match(html, /<section id="capacites" class="panneau" hidden aria-label="Atelier — capacités">[\s\S]*?<div class="contenu-reglages" data-capacites-contenu><\/div>\s*<\/section>/);
});
test('Gardes : l\'Atelier ne peut pas modifier l\'écran qui le commande ni ce test (chemins protégés du noyau)', () => {
  for (const p of ['app/capacites/ecran.js', 'app/capacites/nouveau.js', 'tests/atelier-capacites.test.mjs']) {
    assert.equal(N.raisonCheminEcriture(p, [p, 'app/capacites/', 'tests/']), 'chemin protégé de l\'atelier', p);
    assert.ok(N.gardesStatiques([{ chemin: p, etat: 'modifie', avant: 'a', apres: 'b' }]).objections.some((o) => o.includes('protégé')), p);
  }
  assert.equal(N.raisonAjoutPerimetre('app/capacites/'), 'chemin protégé de l\'atelier');
  assert.equal(N.raisonAjoutPerimetre('app/'), 'couvre un chemin protégé');
  assert.ok(N.INTERDITS_MISSION.includes('app/capacites/'));
});
