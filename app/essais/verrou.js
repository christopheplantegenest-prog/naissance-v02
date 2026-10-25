// === DEBUT_ESSAIS_VERROU ===
// v0.66.8 — ATELIER 2, L3 : VERROU du bac d'essai (mécanisme technique, non cognitif ; protégé : app/essais/).
// verrouiller(g) est exécuté DANS le Worker du bac (realm séparé de l'application), AVANT de charger le code d'une capacité :
//   1. les constructeurs de code (Function, fonctions async, générateurs) sont neutralisés : plus aucun moyen de fabriquer du code à partir
//      d'un texte (même par un accès calculé comme x['constr' + 'uctor']) ;
//   2. tout ce qui n'est pas du JavaScript pur est SUPPRIMÉ du global et de sa chaîne de prototypes (liste d'AUTORISATION, pas d'interdiction) :
//      IndexedDB, fetch, XMLHttpRequest, WebSocket, minuteries, postMessage, importScripts, navigator, caches… disparaissent, y compris les API
//      qu'un navigateur futur ajouterait ;
//   3. les objets de base restants sont gelés (aucune pollution de prototype ne peut tromper le code du bac).
// Rendu : { restants } = propriétés non autorisées qu'il a été impossible de retirer (hors constantes primitives non modifiables, sans
// effet possible). Le bac REFUSE d'exécuter si la liste n'est pas vide.
// La fonction est autonome (aucune référence extérieure) : les tests l'exécutent telle quelle dans un realm neuf (node:vm).
export function verrouiller(g) {
  'use strict';
  const PERMIS = ['Object', 'Array', 'Number', 'parseFloat', 'parseInt', 'Infinity', 'NaN', 'undefined', 'Boolean', 'String', 'Symbol', 'Date',
    'Promise', 'RegExp', 'Error', 'AggregateError', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'JSON',
    'Math', 'Intl', 'ArrayBuffer', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array',
    'Float64Array', 'Uint8ClampedArray', 'BigUint64Array', 'BigInt64Array', 'DataView', 'Map', 'BigInt', 'Set', 'WeakMap', 'WeakSet', 'Reflect',
    'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'isFinite', 'isNaN', 'globalThis'];
  const permis = new Set(PERMIS);
  const restants = [];
  // 1. constructeurs de code
  const sources = [function () {}, async function () {}, function* () {}, async function* () {}];
  for (const f of sources) {
    const proto = Object.getPrototypeOf(f);
    try { Object.defineProperty(proto, 'constructor', { value: undefined, writable: false, configurable: false }); } catch { restants.push('constructor'); }
  }
  // 2. global et chaîne de prototypes (on s'arrête à Object.prototype, qui est gelé plus bas)
  let o = g;
  while (o !== null && o !== Object.prototype) {
    for (const k of Reflect.ownKeys(o)) {
      if (typeof k === 'string' && o === g && permis.has(k)) continue;
      let ok = false;
      try { ok = delete o[k]; } catch { ok = false; }
      if (!ok) {
        try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); ok = true; } catch { ok = false; }
      }
      if (!ok) {
        // Constante primitive non modifiable (par exemple TEMPORARY / PERSISTENT de certains moteurs) : aucune capacité n'en découle.
        const d = Object.getOwnPropertyDescriptor(o, k);
        const inoffensive = d && 'value' in d && !d.writable && !d.configurable && (d.value === null || (typeof d.value !== 'object' && typeof d.value !== 'function'));
        if (!inoffensive) restants.push(String(k));
      }
    }
    o = Object.getPrototypeOf(o);
  }
  // 3. gel des objets de base autorisés et de leurs prototypes
  const geler = (x) => { try { if (x !== null && (typeof x === 'object' || typeof x === 'function')) Object.freeze(x); } catch { restants.push('gel'); } };
  for (const k of PERMIS) {
    if (k === 'globalThis') continue;
    const v = g[k];
    geler(v);
    if (typeof v === 'function') geler(v.prototype);
  }
  for (const f of sources) { geler(Object.getPrototypeOf(f)); geler(f.prototype && Object.getPrototypeOf(f.prototype)); }
  geler(Object.prototype);
  geler(Object.getPrototypeOf(sources[0])); // Function.prototype (le nom global Function n'existe plus)
  try { Object.freeze(g); } catch { /* global exotique (selon le moteur) : son contenu est déjà réduit au JavaScript pur, le gel n'est qu'un plus */ }
  return { restants };
}
// === FIN_ESSAIS_VERROU ===
