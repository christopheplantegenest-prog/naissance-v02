import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gemini from '../app/fournisseurs/gemini.js';

const LISTE = {
  models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', displayName: 'Lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash-preview', displayName: 'Preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-preview-tts', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] },
  ],
};
const CLE_INVALIDE = JSON.stringify({ error: {
  code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT',
  details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
} });

function reponse(statut, corps) {
  return { ok: statut >= 200 && statut < 300, status: statut, text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) };
}

function fauxReseau(regle) {
  const appels = [];
  const f = async (url, options) => {
    appels.push({ url, options });
    return regle(url, options, appels.length);
  };
  f.appels = appels;
  return f;
}

test('test OK avec l’en-tête : un seul appel, clé jamais dans l’adresse', async () => {
  const f = fauxReseau(() => reponse(200, LISTE));
  const res = await gemini.tester({ cle: 'AQ.secret', fetchFn: f });
  assert.equal(res.ok, true);
  assert.equal(res.methode, 'entete');
  assert.equal(f.appels.length, 1);
  assert.equal(f.appels[0].options.headers['x-goog-api-key'], 'AQ.secret');
  assert.ok(!f.appels[0].url.includes('AQ.secret'));
  assert.deepEqual(res.modeles.map((m) => m.id), [
    'models/gemini-2.5-flash', 'models/gemini-2.5-pro', 'models/gemini-2.5-flash-lite', 'models/gemini-3-flash-preview',
  ]);
  assert.equal(res.modeleParDefaut, 'models/gemini-2.5-flash');
});

test('repli : en-tête refusé, jeton Bearer accepté', async () => {
  const f = fauxReseau((url, o) => (o.headers.Authorization ? reponse(200, LISTE) : reponse(400, CLE_INVALIDE)));
  const res = await gemini.tester({ cle: 'AQ.jeton', fetchFn: f });
  assert.equal(res.ok, true);
  assert.equal(res.methode, 'bearer');
  assert.equal(f.appels.length, 3);
  assert.ok(f.appels[1].url.includes('key=AQ.jeton'));
  assert.equal(f.appels[2].options.headers.Authorization, 'Bearer AQ.jeton');
  assert.deepEqual(res.essais.map((e) => e.ok), [false, false, true]);
});

test('clé refusée partout : message clair et détail Google conservé', async () => {
  const f = fauxReseau(() => reponse(400, CLE_INVALIDE));
  const res = await gemini.tester({ cle: 'AQ.faux', fetchFn: f });
  assert.equal(res.ok, false);
  assert.equal(res.erreur.code, 'cle');
  assert.match(res.erreur.message, /API key not valid/);
  assert.match(res.erreur.detail, /API_KEY_INVALID/);
  assert.equal(res.essais.length, 3);
});

test('quota atteint : arrêt immédiat des essais', async () => {
  const f = fauxReseau(() => reponse(429, { error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' } }));
  const res = await gemini.tester({ cle: 'k', fetchFn: f });
  assert.equal(res.erreur.code, 'quota');
  assert.equal(f.appels.length, 1);
});

test('pas de réseau : erreur réseau compréhensible', async () => {
  const f = async () => { throw new TypeError('Failed to fetch'); };
  const res = await gemini.tester({ cle: 'k', fetchFn: f });
  assert.equal(res.ok, false);
  assert.equal(res.erreur.code, 'reseau');
  assert.match(res.erreur.detail, /Failed to fetch/);
});

test('traduction des erreurs Google', () => {
  const t = gemini.traduireErreurGoogle;
  assert.equal(t(403, JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'Generative Language API has not been used in project 1', details: [{ reason: 'SERVICE_DISABLED' }] } })).code, 'acces');
  assert.equal(t(403, JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'x', details: [{ reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }] } })).code, 'acces');
  assert.equal(t(400, JSON.stringify({ error: { status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' } })).code, 'region');
  assert.equal(t(401, '{}').code, 'cle');
  assert.equal(t(404, '{}').code, 'modele');
  assert.equal(t(503, 'pas du json').code, 'service');
  assert.equal(t(400, JSON.stringify({ error: { message: 'Bad thing' } })).code, 'requete');
});

test('envoi : corps, rôles, adresse du modèle et texte extrait', async () => {
  const f = fauxReseau(() => reponse(200, {
    candidates: [{ content: { parts: [{ text: 'réflexion', thought: true }, { text: 'Bonjour ' }, { text: 'toi' }] }, finishReason: 'STOP' }],
  }));
  const texte = await gemini.envoyer({
    historique: [{ role: 'moi', texte: 'Salut' }, { role: 'ia', texte: 'Coucou' }, { role: 'moi', texte: 'Ça va ?' }],
    cle: 'AQ.k', methode: 'bearer', modele: 'gemini-2.5-flash', fetchFn: f,
  });
  assert.equal(texte, 'Bonjour toi');
  const { url, options } = f.appels[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer AQ.k');
  const corps = JSON.parse(options.body);
  assert.deepEqual(corps.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(corps.contents[2].parts[0].text, 'Ça va ?');
});

test('envoi : réponse bloquée, vide, modèle absent ou invalide', async () => {
  const h = [{ role: 'moi', texte: 'x' }];
  const bloque = fauxReseau(() => reponse(200, { promptFeedback: { blockReason: 'SAFETY' } }));
  await assert.rejects(gemini.envoyer({ historique: h, cle: 'k', methode: 'entete', modele: 'm', fetchFn: bloque }), { code: 'bloque' });
  const vide = fauxReseau(() => reponse(200, { candidates: [{ finishReason: 'OTHER' }] }));
  await assert.rejects(gemini.envoyer({ historique: h, cle: 'k', methode: 'entete', modele: 'm', fetchFn: vide }), { code: 'vide' });
  await assert.rejects(gemini.envoyer({ historique: h, cle: 'k', methode: 'entete', modele: '', fetchFn: vide }), { code: 'modele' });
  await assert.rejects(gemini.envoyer({ historique: h, cle: 'k', methode: 'entete', modele: 'models/../x', fetchFn: vide }), { code: 'modele' });
  await assert.rejects(gemini.envoyer({ historique: h, cle: '', methode: 'entete', modele: 'm', fetchFn: vide }), { code: 'cle' });
  const illisible = fauxReseau(() => reponse(200, '<html>'));
  await assert.rejects(gemini.envoyer({ historique: h, cle: 'k', methode: 'entete', modele: 'm', fetchFn: illisible }), { code: 'reponse' });
});

test('choix du modèle par défaut : un « flash » stable et récent', () => {
  const c = (ids) => gemini.choisirModeleParDefaut(ids.map((id) => ({ id })));
  assert.equal(c(['models/gemini-2.5-pro', 'models/gemini-2.0-flash', 'models/gemini-2.5-flash']), 'models/gemini-2.5-flash');
  assert.equal(c(['models/gemini-3-flash', 'models/gemini-2.5-flash']), 'models/gemini-3-flash');
  assert.equal(c(['models/gemini-flash-latest', 'models/gemma-3-27b-it']), 'models/gemini-flash-latest');
  assert.equal(c(['models/un-modele-inconnu']), 'models/un-modele-inconnu');
  assert.equal(c([]), null);
});

test('instructions transmises en systemInstruction', async () => {
  const f = fauxReseau(() => reponse(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
  await gemini.envoyer({ instructions: 'Tu es Naissance.', historique: [{ role: 'moi', texte: 'Qui es-tu ?' }], cle: 'k', methode: 'entete', modele: 'm', fetchFn: f });
  const corps = JSON.parse(f.appels[0].options.body);
  assert.deepEqual(corps.systemInstruction, { parts: [{ text: 'Tu es Naissance.' }] });
  assert.equal(corps.contents.length, 1);
});

test('generer : JSON demandé et lu, même entouré de balises', async () => {
  const f = fauxReseau(() => reponse(200, { candidates: [{ content: { parts: [{ text: '```json\n{"resume": null, "souvenirs": []}\n```' }] } }] }));
  const objet = await gemini.generer({ instructions: 'consolide', entree: 'données', cle: 'k', methode: 'bearer', modele: 'models/x', fetchFn: f });
  assert.deepEqual(objet, { resume: null, souvenirs: [] });
  const corps = JSON.parse(f.appels[0].options.body);
  assert.equal(corps.generationConfig.responseMimeType, 'application/json');
  assert.equal(corps.contents[0].role, 'user');
  assert.equal(gemini.lireJson('Voici : {"a": 1} voilà').a, 1);
  assert.throws(() => gemini.lireJson('rien du tout'), { code: 'reponse' });
});

test('sonder : vrai appel minimal ; réponse vide acceptée ; 404 remonté', async () => {
  const vide = fauxReseau(() => reponse(200, { candidates: [{ finishReason: 'MAX_TOKENS' }] }));
  assert.equal(await gemini.sonder({ cle: 'k', methode: 'entete', modele: 'models/x', fetchFn: vide }), true);
  assert.ok(vide.appels[0].url.endsWith('models/x:generateContent'));
  const disparu = fauxReseau(() => reponse(404, { error: { code: 404, status: 'NOT_FOUND', message: 'This model models/gemini-2.5-flash is no longer available to new users.' } }));
  await assert.rejects(gemini.sonder({ cle: 'k', methode: 'entete', modele: 'models/gemini-2.5-flash', fetchFn: disparu }), (e) => {
    assert.equal(e.code, 'modele');
    assert.match(e.detail, /no longer available/);
    return true;
  });
});

test('ordre de préférence exposé pour les replis', () => {
  const ids = gemini.ordonnerModeles([{ id: 'models/gemini-2.5-pro' }, { id: 'models/gemini-3.6-flash' }, { id: 'models/gemini-3.8-flash-preview' }]).map((m) => m.id);
  assert.equal(ids[0], 'models/gemini-3.6-flash');
});
