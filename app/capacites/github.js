// === DEBUT_CAPACITES_GITHUB ===
// v0.66.6 — ATELIER 2, L1 + L2 (GO « ATELIER 2 — GO PHASE 1 », 25/10/2026) : accès à l'API GitHub du SEUL dépôt de Naissance, pour l'écran
// « Atelier — capacités ». OUTILLAGE NON COGNITIF (D-007).
//  - Lecture (L1) : tickets « Atelier : », commentaires d'état, dernière version publiée. TOUJOURS SANS JETON (API publique).
//  - Écriture (L2) : commenter un ticket (/stop, /reprendre, /valider) et ouvrir un ticket « Atelier : … ». Seules ces deux requêtes
//    portent le jeton, et seulement vers https://api.github.com/repos/<dépôt>/issues….
// Le jeton n'est jamais journalisé, jamais rendu dans un message d'erreur, jamais renvoyé à l'appelant. Aucun module cognitif n'importe ce
// fichier (garde de tests/capacites.test.mjs).
import { DEPOT, PROPRIETAIRE, estChantier } from './etat.js';

export const API = 'https://api.github.com';
const RACINE = `/repos/${DEPOT}`;

export class ErreurGithub extends Error {
  constructor(code, message) { super(message); this.name = 'ErreurGithub'; this.code = code; }
}
// Message d'erreur sûr : fixe, selon le code HTTP ; rien de la requête, rien de la réponse brute.
function erreurHttp(statut, ecriture) {
  if (statut === 401) return new ErreurGithub('jeton', 'Jeton refusé par GitHub (expiré, révoqué ou mal copié).');
  if (statut === 403 || statut === 429) return new ErreurGithub(ecriture ? 'droits' : 'limite', ecriture ? 'GitHub refuse l\'écriture : le jeton doit avoir la permission « Issues : Read and write » sur naissance-v02.' : 'Limite de lecture de GitHub atteinte (60 lectures par heure sans jeton) : réessayer plus tard.');
  if (statut === 404) return new ErreurGithub('introuvable', ecriture ? 'Dépôt ou ticket introuvable pour ce jeton (dépôt naissance-v02 choisi à la création du jeton ?).' : 'Introuvable sur GitHub.');
  if (statut === 410 || statut === 422) return new ErreurGithub('refus', 'GitHub a refusé la demande (ticket verrouillé ou texte refusé).');
  return new ErreurGithub('inattendu', `Réponse inattendue de GitHub (${statut}).`);
}

// fetchFn : fetch injecté (tests) ; jeton : lu au moment de chaque écriture, jamais conservé ici.
export function clientGithub({ fetchFn = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null, lireJeton = () => null, delaiMs = 15000 } = {}) {
  async function requete(methode, chemin, { corps = null, ecriture = false } = {}) {
    if (!fetchFn) throw new ErreurGithub('reseau', 'Réseau indisponible sur cet appareil.');
    if (!chemin.startsWith(`${RACINE}/`) && chemin !== RACINE) throw new ErreurGithub('interne', 'Chemin hors du dépôt de Naissance.');
    const entetes = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (ecriture) {
      const j = lireJeton();
      if (!j) throw new ErreurGithub('jeton', 'Aucun jeton GitHub enregistré sur cet appareil.');
      entetes.Authorization = `Bearer ${j}`;
      entetes['Content-Type'] = 'application/json';
    }
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const minuterie = ctrl ? setTimeout(() => ctrl.abort(), delaiMs) : null;
    let r;
    try {
      r = await fetchFn(`${API}${chemin}`, { method: methode, headers: entetes, body: corps === null ? undefined : JSON.stringify(corps), signal: ctrl ? ctrl.signal : undefined, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    } catch {
      throw new ErreurGithub('reseau', 'GitHub injoignable (réseau coupé ou trop lent).');
    } finally {
      if (minuterie) clearTimeout(minuterie);
    }
    if (!r || !r.ok) throw erreurHttp(r ? r.status : 0, ecriture);
    try { return await r.json(); } catch { throw new ErreurGithub('inattendu', 'Réponse illisible de GitHub.'); }
  }

  return {
    // L1 — lectures publiques, sans jeton.
    async chantiers(max = 8) {
      const l = await requete('GET', `${RACINE}/issues?state=all&creator=${PROPRIETAIRE}&sort=created&direction=desc&per_page=50`);
      return (Array.isArray(l) ? l : []).filter(estChantier).slice(0, max);
    },
    // Commentaires d'un ticket : la DERNIÈRE page (le commentaire d'état le plus récent est à la fin), et la précédente si elle existe.
    async commentaires(ticket) {
      const n = Number.isSafeInteger(ticket.comments) && ticket.comments > 0 ? ticket.comments : 0;
      if (!n) return [];
      const derniere = Math.ceil(n / 100);
      const pages = derniere > 1 ? [derniere - 1, derniere] : [1];
      const out = [];
      for (const p of pages) out.push(...(await requete('GET', `${RACINE}/issues/${Number(ticket.number)}/comments?per_page=100&page=${p}`)));
      return out;
    },
    async derniereVersion() {
      return requete('GET', `${RACINE}/releases/latest`);
    },
    // L2 — écritures, avec le jeton.
    async commenter(numero, corps) {
      if (!Number.isSafeInteger(numero) || numero < 1) throw new ErreurGithub('interne', 'Numéro de ticket illisible.');
      const c = await requete('POST', `${RACINE}/issues/${numero}/comments`, { corps: { body: corps }, ecriture: true });
      return { id: c && c.id, url: c && c.html_url };
    },
    async ouvrirTicket(titre, corps) {
      const t = await requete('POST', `${RACINE}/issues`, { corps: { title: titre, body: corps }, ecriture: true });
      return { numero: t && t.number, url: t && t.html_url };
    },
  };
}
// === FIN_CAPACITES_GITHUB ===
