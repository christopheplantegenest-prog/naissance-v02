// === DEBUT_ESSAIS_ANALYSE ===
// v0.66.8 — ATELIER 2, L3 : ANALYSE du code d'une capacité avant son activation (mécanisme technique, non cognitif ; protégé : app/essais/).
// Première barrière, volontairement grossière et prudente : une recherche de MOTS dans le texte source (commentaires et chaînes compris), sur
// le module de la capacité ET sur chacun des modules qu'il importe (transitivement, 20 modules au plus). Un mot interdit, un import qui
// n'est pas un chemin relatif .js restant dans l'application, un module illisible : REFUS. Le doute refuse.
// Ce n'est PAS une preuve d'isolation : un accès calculé (x['constr' + 'uctor']) échappe à toute recherche de mots. La seconde barrière,
// décisive, est le verrou du bac (verrou.js : realm séparé réduit au JavaScript pur) ; la troisième est la validation de la porte (porte.js).
export const MOTS_INTERDITS = Object.freeze(['async', 'await', 'Promise', 'then', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask',
  'requestAnimationFrame', 'requestIdleCallback', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'IDBFactory',
  'localStorage', 'sessionStorage', 'caches', 'navigator', 'document', 'window', 'globalThis', 'self', 'postMessage', 'importScripts', 'Worker',
  'SharedWorker', 'BroadcastChannel', 'eval', 'Function', 'constructor', 'prototype', '__proto__', 'defineProperty', 'defineProperties',
  'setPrototypeOf', 'Atomics', 'SharedArrayBuffer', 'WeakRef', 'FinalizationRegistry', 'Proxy', 'WebAssembly', 'process', 'require']);
export const MODULES_MAX = 20;
const RE_MOT = new RegExp(`(?<![A-Za-z0-9_$])(${MOTS_INTERDITS.map((m) => m.replace(/\$/g, '\\$')).join('|')})(?![A-Za-z0-9_$])`, 'g');
const RE_IMPORT_DYNAMIQUE = /(?<![A-Za-z0-9_$.])import\s*\(/;
const RE_SPECIFICATEURS = /(?:^|[;\s])(?:import|export)\s[^;'"`]*?from\s*(['"])([^'"]+)\1|(?:^|[;\s])import\s*(['"])([^'"]+)\3/g;

// Texte source -> { refus: [motifs], imports: [spécificateurs] }
export function analyserSource(source) {
  const refus = [];
  if (typeof source !== 'string') return { refus: ['source illisible'], imports: [] };
  const mots = new Set();
  for (const m of source.matchAll(RE_MOT)) mots.add(m[1]);
  for (const m of mots) refus.push(`mot interdit : ${m}`);
  if (RE_IMPORT_DYNAMIQUE.test(source)) refus.push('import dynamique interdit');
  const imports = [];
  for (const m of source.matchAll(RE_SPECIFICATEURS)) imports.push(m[2] ?? m[4]);
  for (const s of imports) if (!/^\.\.?\/[^?#]*\.js$/.test(s)) refus.push(`import refusé : ${s}`);
  return { refus, imports };
}

// Analyse transitive. url : URL absolue du module ; racine : URL du dossier app/ (rien ne peut être importé hors de lui ni dans la porte) ;
// lireSource(url) -> Promise<texte>. -> Promise<{ refus: [motifs], modules: [urls analysées] }>
export async function analyserModule(url, { racine, lireSource }) {
  const refus = [];
  const vus = new Set();
  const file = [url];
  const porte = new URL('essais/', racine).href;
  while (file.length) {
    const u = file.shift();
    if (vus.has(u)) continue;
    vus.add(u);
    if (vus.size > MODULES_MAX) { refus.push('trop de modules importés'); break; }
    let source;
    try { source = await lireSource(u); } catch { source = null; }
    const nom = u.startsWith(racine) ? u.slice(racine.length) : u;
    const a = analyserSource(source);
    for (const r of a.refus) refus.push(`${nom} : ${r}`);
    for (const s of a.imports) {
      if (!/^\.\.?\//.test(s)) continue;
      const cible = new URL(s, u).href;
      if (!cible.startsWith(racine)) refus.push(`${nom} : import hors de l'application (${s})`);
      else if (cible.startsWith(porte)) refus.push(`${nom} : import de la porte interdit (${s})`);
      else file.push(cible);
    }
  }
  return { refus, modules: [...vus] };
}
// === FIN_ESSAIS_ANALYSE ===
