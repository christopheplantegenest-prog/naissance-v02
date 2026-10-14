// === DEBUT_LANGAGE_FORMES_SUPERVISEES ===
// v0.64.16 — « FORMES CANDIDATES SUPERVISÉES » (GO ChatGPT « v0.64.16 », 14/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « parmi les manifestations supervisées indépendamment (voie reference-explicite, v0.64.15), quelles familles de formes communes sont
//     objectivement observables, et lesquelles sont déterminées, ambiguës, insuffisantes ou en abstention ? »
//
// Elle n'apprend RIEN, n'écrit RIEN, ne choisit AUCUNE opération, ne crée AUCUNE Action, ne convertit aucun rôle en association d'Action et
// ne touche à aucun comportement conversationnel. « Déterminée » veut dire seulement : STRUCTURE CANDIDATE déterminée — ni forme vraie, ni
// Action validée, ni signification apprise. Le mot « rôle » veut dire seulement : champ du fait qui varie, porté par une position déterminée.
//
// formesSupervisees(lignesManifestations, lignesValeurs) -> { refusees, contradictions, ambigues, familles }
//   lignesManifestations : les lignes persistées de la table des manifestations de faits, TELLES QUELLES (toutes voies) ;
//   lignesValeurs : les lignes persistées des valeurs de données ({ id, valeur }), pour résoudre un texte par son identité (jamais l'inverse).
//   Seules les lignes de voie 'reference-explicite' sont des sources candidates ; les autres ne servent qu'à revalider une leçon L.
//
// A. REVALIDATION (à la lecture : l'import complet remplace les tables sans repasser par le validateur d'écriture). Une ligne candidate n'est
//    ADMISE que si : c'est un objet ; son fait porte trois chaînes non vides (sujet, relation, valeur) ; son message M est résoluble en texte
//    (chaîne) ; idLecon L est une chaîne non vide ; L ≠ M ; L est résoluble ; la manifestation de L existe ; elle est de voie 'lecon-technique' ;
//    son fait est EXACTEMENT identique (mêmes trois chaînes). Sinon : `refusees` = { idMessage, raison } avec la PREMIÈRE raison rencontrée
//    dans l'ordre fixe MOTIFS_REFUS_SUPERVISION (idMessage = null si la ligne n'en porte pas de chaîne). Jamais une suppression silencieuse.
// B. CONTRADICTIONS GLOBALES (avant tout regroupement) : deux manifestations admises de même TEXTE CANONIQUE (canoniser) dont les faits
//    canoniques diffèrent → contradiction. TOUTES les manifestations de ce texte sont exclues des familles (aucune n'est choisie) et rendues
//    dans `contradictions` = { texte (canonique), membres: [idMessage…] }.
// C. ABSTRACTION INDIVIDUELLE : texte découpé par tokeniser (transformation.js, la même découpe que les squelettes) ; pour chaque champ, les
//    positions dont le jeton canonisé égale la valeur canonisée du champ. Exactement une → champ PLACÉ ; aucune → champ NON PLACÉ (ce n'est
//    PAS une constante) ; plusieurs → ambiguë ; une position portant plusieurs champs → ambiguë. Une manifestation ambiguë n'entre dans
//    aucune famille : `ambigues` = { idMessage, champsSurPlusieursPositions: [champ…], positionsAPlusieursChamps: [position…] }.
//    LIMITE EXPLICITE : un champ = un jeton ; une valeur de plusieurs mots n'est jamais alignée (champ non placé), aucun alignement multi-jeton.
// D. SIGNATURE : [{ jeton } | { champ }] par position (jeton littéral exact, ou nom du champ placé). Sérialisable, déterministe, comparée par
//    égalité EXACTE de sa sérialisation. FAMILLE = manifestations de signatures identiques ; aucun seuil, distance, score ni fréquence.
// E. CONTRÔLE COLLECTIF (famille de deux membres au moins ; un seul membre → 'insuffisante', aucune conclusion collective). Valeurs comparées
//    canonisées (la même égalité que l'alignement) :
//      champ placé qui varie      → { etat: 'role', position }
//      champ placé invariant      → { etat: 'roleOuConstante', position, valeurs }
//      champ non placé invariant  → { etat: 'constanteCandidate', valeurs }   (JAMAIS « constante »)
//      champ non placé qui varie  → { etat: 'inexplique', valeurs }
//    `valeurs` = les valeurs BRUTES distinctes observées, triées (aucune n'est choisie). Famille d'un seul membre : { etat: 'place', position }
//    ou { etat: 'nonPlace' } (constat individuel seulement).
//    ÉTAT de famille, dans cet ordre : 'insuffisante' (un membre) ; 'abstention' (au moins un champ inexpliqué) ; 'ambigue' (au moins un
//    rôleOuConstante) ; sinon 'determinee'. Aucune autre condition (positionsDistinguees n'est PAS utilisée : la supervision par le fait
//    renseigne déjà l'association champ ↔ position). La compatibilité d'une famille avec une capacité (sujet porté, etc.) n'est PAS jugée ici.
//    famille = { signature, membres: [idMessage…], champs: { sujet, relation, valeur }, etat }.
//
// ORDRES (sans aucune signification) : refusees, ambigues par idMessage ; contradictions par texte canonique, membres par idMessage ; familles
//   par sérialisation de leur signature, membres par idMessage. Les mêmes lignes dans un autre ordre donnent un résultat identique.
// ERREURS : entrée non tableau, ou deux lignes de manifestation de même idMessage (la clé de la table : une identité désigne une seule ligne) : TypeError.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sortie entièrement neuve.
// INDÉPENDANCE / DORMANCE : importe uniquement tokeniser et canoniser. NON BRANCHÉ : aucun fichier de l'application n'importe ce module.
import { tokeniser } from './transformation.js';
import { canoniser } from './canon.js';

export const CHAMPS_FAIT = Object.freeze(['sujet', 'relation', 'valeur']);
export const MOTIFS_REFUS_SUPERVISION = Object.freeze([
  'ligne-invalide', 'fait-invalide', 'message-irresoluble', 'lecon-absente', 'auto-reference',
  'lecon-irresoluble', 'manifestation-lecon-absente', 'lecon-voie-incorrecte', 'fait-different',
]);

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const chaine = (v) => typeof v === 'string' && v.length > 0;
const faitValide = (f) => estObjet(f) && CHAMPS_FAIT.every((c) => typeof f[c] === 'string' && f[c].trim().length > 0);
const memeFait = (a, b) => CHAMPS_FAIT.every((c) => a[c] === b[c]);
const faitCanonique = (f) => JSON.stringify(CHAMPS_FAIT.map((c) => canoniser(f[c])));

function revalider(ligne, textes, parId) {
  if (!estObjet(ligne) || !chaine(ligne.idMessage) || !estObjet(ligne.voie)) return 'ligne-invalide';
  if (!faitValide(ligne.fait)) return 'fait-invalide';
  if (typeof textes.get(ligne.idMessage) !== 'string') return 'message-irresoluble';
  const idLecon = ligne.voie.idLecon;
  if (!chaine(idLecon)) return 'lecon-absente';
  if (idLecon === ligne.idMessage) return 'auto-reference';
  if (typeof textes.get(idLecon) !== 'string') return 'lecon-irresoluble';
  const lecon = parId.get(idLecon);
  if (!estObjet(lecon)) return 'manifestation-lecon-absente';
  if (!estObjet(lecon.voie) || lecon.voie.nom !== 'lecon-technique') return 'lecon-voie-incorrecte';
  if (!faitValide(lecon.fait) || !memeFait(lecon.fait, ligne.fait)) return 'fait-different';
  return null;
}

function abstraire(texte, fait) {
  const jetons = tokeniser(texte);
  const canons = jetons.map((t) => canoniser(t));
  const positions = {};
  for (const c of CHAMPS_FAIT) {
    const cible = canoniser(fait[c]);
    positions[c] = [];
    canons.forEach((t, i) => { if (t === cible) positions[c].push(i); });
  }
  const champsSurPlusieursPositions = CHAMPS_FAIT.filter((c) => positions[c].length > 1);
  const positionsAPlusieursChamps = [];
  for (let i = 0; i < jetons.length; i += 1) if (CHAMPS_FAIT.filter((c) => positions[c].includes(i)).length > 1) positionsAPlusieursChamps.push(i);
  if (champsSurPlusieursPositions.length || positionsAPlusieursChamps.length) return { ambigue: { champsSurPlusieursPositions, positionsAPlusieursChamps } };
  const signature = jetons.map((t, i) => {
    const champ = CHAMPS_FAIT.find((c) => positions[c][0] === i);
    return champ ? { champ } : { jeton: t };
  });
  return { signature };
}

function champsDeLaFamille(signature, membres) {
  const champs = {};
  for (const c of CHAMPS_FAIT) {
    const position = signature.findIndex((x) => x.champ === c);
    if (membres.length < 2) { champs[c] = position >= 0 ? { etat: 'place', position } : { etat: 'nonPlace' }; continue; }
    const varie = new Set(membres.map((m) => canoniser(m.fait[c]))).size > 1;
    const valeurs = [...new Set(membres.map((m) => m.fait[c]))].sort(comparer);
    if (position >= 0) champs[c] = varie ? { etat: 'role', position } : { etat: 'roleOuConstante', position, valeurs };
    else champs[c] = varie ? { etat: 'inexplique', valeurs } : { etat: 'constanteCandidate', valeurs };
  }
  return champs;
}

function etatDeLaFamille(champs, taille) {
  if (taille < 2) return 'insuffisante';
  if (CHAMPS_FAIT.some((c) => champs[c].etat === 'inexplique')) return 'abstention';
  if (CHAMPS_FAIT.some((c) => champs[c].etat === 'roleOuConstante')) return 'ambigue';
  return 'determinee';
}

export function formesSupervisees(lignesManifestations, lignesValeurs) {
  if (!Array.isArray(lignesManifestations)) throw new TypeError('formesSupervisees : lignesManifestations doit être un tableau.');
  if (!Array.isArray(lignesValeurs)) throw new TypeError('formesSupervisees : lignesValeurs doit être un tableau.');
  const textes = new Map();
  for (const v of lignesValeurs) if (estObjet(v) && chaine(v.id)) textes.set(v.id, v.valeur);
  const parId = new Map();
  for (const l of lignesManifestations) {
    if (!estObjet(l) || !chaine(l.idMessage)) continue;
    if (parId.has(l.idMessage)) throw new TypeError(`formesSupervisees : identité dupliquée « ${l.idMessage} ».`);
    parId.set(l.idMessage, l);
  }
  const candidates = lignesManifestations.filter((l) => estObjet(l) && estObjet(l.voie) && l.voie.nom === 'reference-explicite');

  // A. revalidation
  const refusees = [];
  const admises = [];
  for (const l of candidates) {
    const raison = revalider(l, textes, parId);
    if (raison) refusees.push({ idMessage: chaine(l.idMessage) ? l.idMessage : null, raison });
    else admises.push({ idMessage: l.idMessage, texte: textes.get(l.idMessage), fait: { sujet: l.fait.sujet, relation: l.fait.relation, valeur: l.fait.valeur } });
  }

  // B. contradictions globales (texte canonique identique, faits canoniques différents) : exclusion de TOUTES ses manifestations
  const parTexte = new Map();
  for (const m of admises) {
    const cle = canoniser(m.texte);
    if (!parTexte.has(cle)) parTexte.set(cle, []);
    parTexte.get(cle).push(m);
  }
  const contradictions = [];
  const exclus = new Set();
  for (const [texte, ms] of parTexte) {
    if (new Set(ms.map((m) => faitCanonique(m.fait))).size > 1) {
      contradictions.push({ texte, membres: ms.map((m) => m.idMessage).sort(comparer) });
      for (const m of ms) exclus.add(m.idMessage);
    }
  }

  // C-D. abstraction individuelle, signature, regroupement par égalité exacte
  const ambigues = [];
  const familles = new Map();
  for (const m of admises) {
    if (exclus.has(m.idMessage)) continue;
    const a = abstraire(m.texte, m.fait);
    if (a.ambigue) { ambigues.push({ idMessage: m.idMessage, ...a.ambigue }); continue; }
    const cle = JSON.stringify(a.signature);
    if (!familles.has(cle)) familles.set(cle, { signature: a.signature, membres: [] });
    familles.get(cle).membres.push(m);
  }

  // E. contrôle collectif
  const sortieFamilles = [...familles.entries()].sort((x, y) => comparer(x[0], y[0])).map(([, f]) => {
    const membres = [...f.membres].sort((a, b) => comparer(a.idMessage, b.idMessage));
    const champs = champsDeLaFamille(f.signature, membres);
    return {
      signature: f.signature.map((x) => ({ ...x })),
      membres: membres.map((m) => m.idMessage),
      champs,
      etat: etatDeLaFamille(champs, membres.length),
    };
  });

  return {
    refusees: refusees.sort((a, b) => comparer(a.idMessage ?? '', b.idMessage ?? '') || comparer(a.raison, b.raison)),
    contradictions: contradictions.sort((a, b) => comparer(a.texte, b.texte)),
    ambigues: ambigues.sort((a, b) => comparer(a.idMessage, b.idMessage)),
    familles: sortieFamilles,
  };
}
// === FIN_LANGAGE_FORMES_SUPERVISEES ===
