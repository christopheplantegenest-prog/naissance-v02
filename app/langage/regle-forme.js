// === DEBUT_LANGAGE_REGLE_FORME ===
// v0.64.17 — « CONFIRMER UNE FORME INDUITE ET LA RENDRE ACTIVE » (GO ChatGPT « v0.64.17 », 14/10/2026). PRIMITIVE PURE, SYNCHRONE, DÉTERMINISTE.
// Elle répond à UNE seule question :
//
//   « quelle est l'identité structurelle d'une RÈGLE de forme (ce qui la définit réellement), et quelle est celle d'une Action persistée ? »
//
// RÈGLE = { operation, n, ancres: [{ position, jeton }], roles: [{ position, nom }], constantes: { nom: valeur } } — exactement ce qui définit
// l'identité d'une Action dans apprendreAction (connaissances.js : arité, ancres calculées sur ses exemples, association opération + rôles +
// constantes), et RIEN d'autre : ni exemples, ni sources, ni statut, ni origine. Deux familles supervisées de même règle (M1+M2 puis M1+M2+M3)
// ont donc la MÊME identité ; les exemples et les messages sources ne sont que la provenance.
//
// identiteRegle(regle) -> 'forme-' + sha256Hex(sérialisation canonique) : ancres triées par position, rôles triés par position, constantes
//   triées par nom (ordre sans signification, seulement canonique). Règle mal formée : TypeError (jamais une identité devinée).
// regleDeLAction(action) -> la règle d'une Action persistée : ancres recalculées par calculerAncres sur SES exemples (la même définition que
//   apprendreAction), constantes absentes = {}.
// INDÉPENDANCE : importe uniquement calculerAncres (transformation.js) et sha256Hex (sha256.js). Ni magasin, ni registre, ni horloge, ni hasard.
import { calculerAncres } from './transformation.js';
import { sha256Hex } from './sha256.js';

export const PREFIXE_CANDIDAT_FORME = 'forme-';

const entier = (v) => Number.isInteger(v) && v >= 0;
const chaine = (v) => typeof v === 'string' && v.length > 0;

function canonique(regle) {
  if (regle === null || typeof regle !== 'object') throw new TypeError('Règle de forme invalide : un objet est attendu.');
  const { operation, n, ancres, roles, constantes } = regle;
  if (!chaine(operation)) throw new TypeError('Règle de forme invalide : operation doit être une chaîne non vide.');
  if (!Number.isInteger(n) || n < 1) throw new TypeError('Règle de forme invalide : n doit être un entier positif.');
  if (!Array.isArray(ancres) || !ancres.every((a) => a && entier(a.position) && a.position < n && typeof a.jeton === 'string')) throw new TypeError('Règle de forme invalide : ancres.');
  if (!Array.isArray(roles) || !roles.every((r) => r && entier(r.position) && r.position < n && chaine(r.nom))) throw new TypeError('Règle de forme invalide : roles.');
  if (constantes === null || typeof constantes !== 'object' || Array.isArray(constantes) || !Object.values(constantes).every((v) => typeof v === 'string')) throw new TypeError('Règle de forme invalide : constantes.');
  const parPosition = (a, b) => a[0] - b[0];
  return {
    operation,
    n,
    ancres: ancres.map((a) => [a.position, a.jeton]).sort(parPosition),
    roles: roles.map((r) => [r.position, r.nom]).sort(parPosition),
    constantes: Object.keys(constantes).sort().map((k) => [k, constantes[k]]),
  };
}

export function identiteRegle(regle) {
  return PREFIXE_CANDIDAT_FORME + sha256Hex(JSON.stringify(canonique(regle)));
}

export function regleDeLAction(action) {
  if (action === null || typeof action !== 'object') throw new TypeError('Action invalide.');
  return {
    operation: action.operation,
    n: action.n,
    ancres: calculerAncres({ n: action.n, exemples: Array.isArray(action.exemples) ? action.exemples : [] }),
    roles: Array.isArray(action.roles) ? action.roles.map((r) => ({ position: r.position, nom: r.nom })) : action.roles,
    constantes: action.constantes === undefined ? {} : action.constantes,
  };
}
// === FIN_LANGAGE_REGLE_FORME ===
