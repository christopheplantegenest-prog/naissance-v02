// === DEBUT_FOURNISSEUR_GEMINI ===
// Adaptateur Google Gemini (clé créée dans Google AI Studio).
// Interface commune à tous les fournisseurs :
//   tester({ cle })                                              → { ok, methode, modeles, modeleParDefaut, essais, erreur }
//   envoyer({ instructions, historique, cle, methode, modele })  → texte de la réponse
//   generer({ instructions, entree, cle, methode, modele })      → objet JSON (tâches internes)
//   converser({ instructions, historique, actions, executer, ... })  → texte, après d'éventuelles actions
//   sonder({ cle, methode, modele })                             → true si le modèle répond vraiment
//   ordonnerModeles(modeles)                                     → modèles dans l'ordre de préférence
// historique = [{ role: 'moi' | 'ia', texte }] ; instructions = texte neutre composé par Naissance
//
// Aucune hypothèse sur le format de la clé : c'est Google qui décide.
// Le test essaie plusieurs façons de transmettre la clé et retient celle qui marche.

import { ErreurFournisseur, erreurReseau, erreurAnnulation } from './erreurs.js';

export const id = 'gemini';
export const nom = 'Google Gemini (AI Studio)';
export const lienCle = 'https://aistudio.google.com/apikey';
export const aideCle = 'Crée une clé dans Google AI Studio, puis colle-la ici.';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const METHODES = ['entete', 'parametre', 'bearer'];
export const LIBELLES_METHODES = {
  entete: 'en-tête x-goog-api-key',
  parametre: 'paramètre ?key=',
  bearer: 'jeton Authorization: Bearer',
};

const SPECIALISES = /(embed|tts|image|audio|live|native|robotics|computer-use|aqa|learnlm|veo|imagen)/i;

function preparer(url, methode, cle, init) {
  const headers = { ...(init.headers || {}) };
  let adresse = url;
  if (methode === 'entete') headers['x-goog-api-key'] = cle;
  else if (methode === 'parametre') adresse += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(cle);
  else if (methode === 'bearer') headers.Authorization = 'Bearer ' + cle;
  else throw new ErreurFournisseur('reglage', 'Façon de transmettre la clé inconnue : relance le test dans Réglages.');
  return [adresse, { ...init, headers }];
}

const enMs = (duree) => {
  const m = String(duree || '').match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(parseFloat(m[1]) * 1000) : null;
};

export function traduireErreurGoogle(statut, corps) {
  let message = '';
  let etat = '';
  const raisons = [];
  const quotas = [];
  let reessayerDansMs = null;
  try {
    const erreur = JSON.parse(corps).error || {};
    message = String(erreur.message || '');
    etat = String(erreur.status || '');
    for (const d of erreur.details || []) {
      if (!d) continue;
      if (d.reason) raisons.push(String(d.reason));
      for (const v of Array.isArray(d.violations) ? d.violations : []) {
        quotas.push(`${v.quotaId || ''} ${v.quotaMetric || ''}`.trim());
      }
      if (d.retryDelay) reessayerDansMs = enMs(d.retryDelay);
    }
  } catch {
    message = String(corps || '').slice(0, 200);
  }
  const detail = `${statut} ${etat} ${raisons.join(',')} ${quotas.join(',')} ${message}`.replace(/\s+/g, ' ').trim().slice(0, 400);
  const a = (r) => raisons.includes(r);

  if (a('API_KEY_INVALID') || /api key not valid/i.test(message)) {
    return new ErreurFournisseur('cle',
      "Google refuse cette clé (« API key not valid »). Vérifie qu'elle a été copiée en entier, ou crée une nouvelle clé dans Google AI Studio.", detail);
  }
  if (/location is not supported/i.test(message)) {
    return new ErreurFournisseur('region', "Google n'autorise pas l'API Gemini depuis cette région.", detail);
  }
  if (statut === 401) {
    return new ErreurFournisseur('cle', "Google n'accepte pas cette identification (erreur 401).", detail);
  }
  if (statut === 403) {
    if (a('SERVICE_DISABLED') || /has not been used|is disabled/i.test(message)) {
      return new ErreurFournisseur('acces', "L'API Gemini n'est pas activée pour le projet Google de cette clé.", detail);
    }
    if (raisons.some((r) => /BLOCKED/.test(r))) {
      return new ErreurFournisseur('acces',
        "La clé a des restrictions qui bloquent cette appli. Dans Google, retire les restrictions d'application de la clé.", detail);
    }
    return new ErreurFournisseur('acces', "Google refuse l'accès avec cette clé (erreur 403).", detail);
  }
  if (statut === 404) {
    return new ErreurFournisseur('modele',
      "Ce modèle n'est pas disponible. Ouvre Réglages et relance le test pour en choisir un autre.", detail);
  }
  if (statut === 429) {
    const indices = `${quotas.join(' ')} ${message}`;
    const periode = /per ?day/i.test(indices) ? 'jour' : /per ?minute/i.test(indices) ? 'minute' : null;
    const e = new ErreurFournisseur('quota',
      periode === 'jour'
        ? 'Quota gratuit du jour atteint pour ce modèle. Rien ne sera facturé.'
        : 'Quota gratuit atteint pour le moment. Réessaie plus tard : rien ne sera facturé.',
      detail);
    e.quota = { periode, reessayerDansMs };
    return e;
  }
  if (statut >= 500) {
    return new ErreurFournisseur('service', 'Le service de Google est momentanément indisponible. Réessaie plus tard.', detail);
  }
  if (statut === 400) {
    return new ErreurFournisseur('requete', `Google a refusé la demande : ${message || 'erreur 400'}`, detail);
  }
  return new ErreurFournisseur('inconnu', `Erreur inattendue de Google (${statut}).`, detail);
}

// signal : annulation demandée par la personne (bouton Annuler).
async function appeler(url, { cle, methode, init, fetchFn, delaiMs, signal }) {
  if (signal && signal.aborted) throw erreurAnnulation();
  const [adresse, options] = preparer(url, methode, cle, init);
  const f = fetchFn || globalThis.fetch.bind(globalThis);
  const controle = new AbortController();
  let annule = false;
  const surAnnulation = () => { annule = true; controle.abort(); };
  if (signal) signal.addEventListener('abort', surAnnulation, { once: true });
  const minuteur = setTimeout(() => controle.abort(), delaiMs);
  let reponse;
  let texte = '';
  try {
    try {
      reponse = await f(adresse, { ...options, signal: controle.signal });
    } catch (e) {
      if (annule) throw erreurAnnulation();
      throw erreurReseau(e, controle.signal.aborted);
    }
    texte = await reponse.text().catch(() => '');
    if (annule) throw erreurAnnulation();
  } finally {
    clearTimeout(minuteur);
    if (signal) signal.removeEventListener('abort', surAnnulation);
  }
  if (!reponse.ok) throw traduireErreurGoogle(reponse.status, texte);
  try {
    return JSON.parse(texte);
  } catch {
    throw new ErreurFournisseur('reponse', 'Réponse illisible du service.', texte.slice(0, 300));
  }
}

export function extraireModeles(donnees) {
  const tous = (donnees && Array.isArray(donnees.models) ? donnees.models : [])
    .filter((m) => m && typeof m.name === 'string'
      && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ id: m.name, nom: m.displayName || m.name.replace(/^models\//, '') }));
  const utiles = tous.filter((m) => !SPECIALISES.test(m.id));
  return utiles.length ? utiles : tous;
}

function score(idModele) {
  let s = 0;
  if (/flash/i.test(idModele)) s += 100;
  if (/lite/i.test(idModele)) s -= 10;
  if (/(preview|exp)/i.test(idModele)) s -= 30;
  if (/gemma/i.test(idModele)) s -= 50;
  const v = idModele.match(/gemini-(\d+(?:\.\d+)?)/i);
  if (v) s += parseFloat(v[1]) * 10;
  return s;
}

// Ordre de préférence des modèles (utilisé aussi pour les replis).
export function ordonnerModeles(modeles) {
  return [...(modeles || [])].sort((a, b) => score(b.id) - score(a.id));
}

export function choisirModeleParDefaut(modeles) {
  if (!modeles || !modeles.length) return null;
  return ordonnerModeles(modeles)[0].id;
}

export async function tester({ cle, fetchFn, methodes = METHODES }) {
  if (!cle) {
    const erreur = new ErreurFournisseur('cle', 'Aucune clé saisie.');
    return { ok: false, essais: [], erreur };
  }
  const essais = [];
  for (const methode of methodes) {
    try {
      const donnees = await appeler(`${BASE}/models?pageSize=1000`, {
        cle, methode, fetchFn, delaiMs: DELAIS_MS.liste, init: { method: 'GET' },
      });
      const modeles = extraireModeles(donnees);
      essais.push({ methode, libelle: LIBELLES_METHODES[methode], ok: true });
      if (!modeles.length) {
        return {
          ok: false, essais,
          erreur: new ErreurFournisseur('modele', "Clé acceptée, mais aucun modèle de conversation n'est disponible."),
        };
      }
      return { ok: true, methode, modeles, modeleParDefaut: choisirModeleParDefaut(modeles), essais };
    } catch (e) {
      essais.push({
        methode, libelle: LIBELLES_METHODES[methode], ok: false,
        code: e.code || 'inconnu', message: e.message, detail: e.detail || '',
      });
      if (e.code === 'quota' || e.code === 'region') break;
    }
  }
  const premier = essais[0];
  return { ok: false, essais, erreur: new ErreurFournisseur(premier.code, premier.message, premier.detail) };
}

export function normaliserModele(modele) {
  if (!modele) {
    throw new ErreurFournisseur('modele', 'Aucun modèle choisi : ouvre Réglages et appuie sur « Enregistrer et tester ».');
  }
  const complet = modele.startsWith('models/') ? modele : `models/${modele}`;
  if (!/^models\/[A-Za-z0-9._-]+$/.test(complet)) {
    throw new ErreurFournisseur('modele', 'Nom de modèle invalide : relance le test dans Réglages.');
  }
  return complet;
}

export function construireCorps(historique, instructions) {
  const corps = {
    contents: historique.map((m) => ({
      role: m.role === 'ia' ? 'model' : 'user',
      parts: [{ text: m.texte }],
    })),
  };
  if (instructions) corps.systemInstruction = { parts: [{ text: instructions }] };
  return corps;
}

// Lit un objet JSON dans une réponse, même entourée de balises de code.
export function lireJson(texte) {
  const nettoye = String(texte || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(nettoye);
  } catch {
    const debut = nettoye.indexOf('{');
    const fin = nettoye.lastIndexOf('}');
    if (debut >= 0 && fin > debut) {
      try { return JSON.parse(nettoye.slice(debut, fin + 1)); } catch { /* suite */ }
    }
    throw new ErreurFournisseur('reponse', 'Réponse du moteur illisible (JSON attendu).', nettoye.slice(0, 300));
  }
}

export function extraireTexte(donnees) {
  const blocage = donnees && donnees.promptFeedback && donnees.promptFeedback.blockReason;
  if (blocage) {
    throw new ErreurFournisseur('bloque', `Google a bloqué ce message (${blocage}). Reformule-le.`);
  }
  const candidat = donnees && Array.isArray(donnees.candidates) ? donnees.candidates[0] : null;
  const morceaux = candidat && candidat.content && Array.isArray(candidat.content.parts) ? candidat.content.parts : [];
  const texte = morceaux
    .filter((p) => p && typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
  if (texte) return texte;
  const raison = candidat && candidat.finishReason;
  if (raison && /SAFETY|BLOCKLIST|PROHIBITED|SPII|RECITATION/.test(raison)) {
    throw new ErreurFournisseur('bloque', `Google n'a pas voulu répondre à ce message (${raison}).`);
  }
  throw new ErreurFournisseur('vide', 'Le service a renvoyé une réponse vide. Réessaie.',
    JSON.stringify(donnees || {}).slice(0, 300));
}

// Délais : une réponse normale arrive en quelques secondes ; au-delà, mieux vaut passer à un autre modèle.
export const DELAIS_MS = Object.freeze({ conversation: 40000, generation: 60000, sonde: 15000, liste: 15000 });

// Adresse d'un appel qui consomme du quota → nom du modèle (sinon null). Sert au compteur local.
export function modeleDeLAppel(url) {
  const m = String(url || '').match(/models\/([^:/?]+):generateContent/);
  return m ? m[1] : null;
}

async function generateContent({ corps, cle, methode, modele, fetchFn, delaiMs, signal }) {
  if (!cle) throw new ErreurFournisseur('cle', 'Aucune clé enregistrée : ouvre Réglages.');
  const chemin = normaliserModele(modele);
  return appeler(`${BASE}/${chemin}:generateContent`, {
    cle,
    methode: methode || 'entete',
    fetchFn,
    delaiMs,
    signal,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    },
  });
}

export async function envoyer({ instructions, historique, cle, methode, modele, fetchFn, signal, delaiMs = DELAIS_MS.conversation }) {
  if (!historique || !historique.length) throw new ErreurFournisseur('requete', 'Message vide.');
  const donnees = await generateContent({
    corps: construireCorps(historique, instructions), cle, methode, modele, fetchFn, delaiMs, signal,
  });
  return extraireTexte(donnees);
}

// Vérification réelle qu'un modèle répond (appel minimal). Une réponse vide ou
// filtrée prouve quand même que le modèle est joignable.
export async function sonder({ cle, methode, modele, fetchFn }) {
  try {
    await envoyer({
      historique: [{ role: 'moi', texte: 'Réponds uniquement par le mot : ok' }],
      cle, methode, modele, fetchFn, delaiMs: DELAIS_MS.sonde,
    });
  } catch (e) {
    if (e.code === 'vide' || e.code === 'bloque') return true;
    throw e;
  }
  return true;
}

// Schéma neutre (types en minuscules) → schéma Gemini (types en majuscules).
export function schemaGemini(schema) {
  if (Array.isArray(schema)) return schema.map(schemaGemini);
  if (!schema || typeof schema !== 'object') return schema;
  const sortie = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') sortie.type = v.toUpperCase();
    else if (k === 'properties') sortie.properties = Object.fromEntries(Object.entries(v).map(([n, d]) => [n, schemaGemini(d)]));
    else if (k === 'items') sortie.items = schemaGemini(v);
    else sortie[k] = v;
  }
  return sortie;
}

export const declarationGemini = (a) => ({ name: a.nom, description: a.description, parameters: schemaGemini(a.parametres) });

// Conversation avec actions (« function calling » de Gemini).
// Le moteur ne fait que DEMANDER : chaque demande passe par executer(), fourni par Naissance,
// qui décide et renvoie le résultat réel. Les parts du modèle sont renvoyées telles quelles
// (signatures de réflexion comprises), suivies des réponses aux demandes.
export async function converser({
  instructions, historique, actions = [], executer, cle, methode, modele, fetchFn, signal, maxTours = 3,
}) {
  if (!historique || !historique.length) throw new ErreurFournisseur('requete', 'Message vide.');
  const contents = construireCorps(historique).contents;
  for (let tour = 0; ; tour++) {
    const corps = { contents };
    if (instructions) corps.systemInstruction = { parts: [{ text: instructions }] };
    const avecActions = actions.length > 0 && typeof executer === 'function';
    if (avecActions) {
      corps.tools = [{ functionDeclarations: actions.map(declarationGemini) }];
      corps.toolConfig = { functionCallingConfig: { mode: tour >= maxTours ? 'NONE' : 'AUTO' } };
    }
    if (signal && signal.aborted) throw erreurAnnulation();
    const donnees = await generateContent({ corps, cle, methode, modele, fetchFn, signal, delaiMs: DELAIS_MS.conversation });
    const candidat = donnees && Array.isArray(donnees.candidates) ? donnees.candidates[0] : null;
    const parts = candidat && candidat.content && Array.isArray(candidat.content.parts) ? candidat.content.parts : [];
    const demandes = parts.filter((p) => p && p.functionCall && typeof p.functionCall.name === 'string');
    if (!avecActions || !demandes.length || tour >= maxTours) return extraireTexte(donnees);
    contents.push({ role: 'model', parts });
    const reponses = [];
    for (const p of demandes) {
      const resultat = await executer({ nom: p.functionCall.name, parametres: p.functionCall.args || {} });
      const reponse = { name: p.functionCall.name, response: resultat };
      if (p.functionCall.id) reponse.id = p.functionCall.id;
      reponses.push({ functionResponse: reponse });
    }
    contents.push({ role: 'user', parts: reponses });
  }
}

export async function generer({ instructions, entree, cle, methode, modele, fetchFn, signal }) {
  const corps = construireCorps([{ role: 'moi', texte: entree }], instructions);
  corps.generationConfig = { responseMimeType: 'application/json' };
  const donnees = await generateContent({ corps, cle, methode, modele, fetchFn, signal, delaiMs: DELAIS_MS.generation });
  return lireJson(extraireTexte(donnees));
}
// === FIN_FOURNISSEUR_GEMINI ===
