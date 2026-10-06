// === DEBUT_LANGAGE_SHA256 ===
// v0.63.51 — « EMPREINTE DÉTERMINISTE DES CONTRATS D'OPÉRATIONS » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, SYNCHRONE, DORMANTE.
// SHA-256 (FIPS 180-4) en JavaScript pur, local, sans dépendance. Le dépôt n'avait qu'un SHA-256 ASYNCHRONE (crypto.subtle, app/memoire/transfert.js) :
// une fonction synchrone ne peut pas l'attendre, d'où cette implémentation.
//
// sha256Hex(entree) -> chaîne de 64 caractères hexadécimaux minuscules.
//   entree : une chaîne (encodée en UTF-8) ou un Uint8Array (octets tels quels). Autre type : TypeError.
//   Une chaîne contenant un substitut isolé (UTF-16 mal formé) est refusée (TypeError) : l'encodage UTF-8 les remplacerait en silence
//   par U+FFFD et deux chaînes différentes auraient alors la même empreinte.
// Pur : aucun état global modifié, aucune horloge, aucun hasard, aucun accès magasin. Déterministe. Non branché (gardé par un test statique).
// USAGE : détecter une dérive ACCIDENTELLE d'un contrat, pas résister à un adversaire (aucune clé, aucun secret).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotd = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

function versOctets(entree) {
  if (entree instanceof Uint8Array) return entree;
  if (typeof entree !== 'string') throw new TypeError('sha256Hex : une chaîne ou un Uint8Array est attendu.');
  for (let rang = 0; rang < entree.length; rang += 1) {
    const code = entree.charCodeAt(rang);
    if (code >= 0xd800 && code <= 0xdbff) {
      const suivant = rang + 1 < entree.length ? entree.charCodeAt(rang + 1) : 0;
      if (suivant < 0xdc00 || suivant > 0xdfff) throw new TypeError('sha256Hex : la chaîne contient un substitut UTF-16 isolé (encodage UTF-8 impossible sans perte).');
      rang += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError('sha256Hex : la chaîne contient un substitut UTF-16 isolé (encodage UTF-8 impossible sans perte).');
    }
  }
  return new TextEncoder().encode(entree);
}

export function sha256Hex(entree) {
  const octets = versOctets(entree);
  const longueur = octets.length;
  const total = (((longueur + 8) >> 6) + 1) << 6; // octets + 0x80 + remplissage + 8 octets de longueur, multiple de 64
  const bloc = new Uint8Array(total);
  bloc.set(octets);
  bloc[longueur] = 0x80;
  const vue = new DataView(bloc.buffer);
  vue.setUint32(total - 8, Math.floor(longueur / 0x20000000) >>> 0); // longueur en bits, mots de poids fort
  vue.setUint32(total - 4, (longueur << 3) >>> 0);                   // puis de poids faible
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let debut = 0; debut < total; debut += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = vue.getUint32(debut + 4 * t);
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotd(w[t - 15], 7) ^ rotd(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotd(w[t - 2], 17) ^ rotd(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, i] = h;
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotd(e, 6) ^ rotd(e, 11) ^ rotd(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (i + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotd(a, 2) ^ rotd(a, 13) ^ rotd(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      i = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + i) >>> 0;
  }
  return Array.from(h, (mot) => mot.toString(16).padStart(8, '0')).join('');
}
// === FIN_LANGAGE_SHA256 ===
