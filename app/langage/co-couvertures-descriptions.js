// === DEBUT_LANGAGE_CO_COUVERTURES_DESCRIPTIONS ===
// v0.64.6 — « CO-COUVERTURES GÉNÉRALES DE DESCRIPTIONS » (décision ChatGPT « DÉCISION v0.64.6 », 13/10/2026). VUE PURE, GÉNÉRALE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « dans cet univers d'éléments, quelles descriptions DISTINCTES portent exactement la même couverture discriminante ? »
//
// C'est le noyau général de la co-couverture de .95 (co-couvertures.js), sans rien de ce qui y est propre aux épisodes : ni identité
// d'élément (elle est déjà dans les couvertures), ni chemin, ni constat scalaire, ni R0, ni R3. Elle ne sait pas ce que décrit une
// description et ne regarde jamais à l'intérieur pour lui donner un sens : elle ne s'en sert que pour reconnaître deux descriptions égales.
//
// coCouverturesDeDescriptions(descriptions, universelle) -> [{ couverture, descriptions }]
//   descriptions : tableau dense d'entrées { description, couverture } (exactement ces deux propriétés propres de données) :
//     description : toute valeur du domaine de parcourirStructure (JSON du dépôt) ; deux descriptions sont ÉGALES si leurs parcours sont
//                   identiques (mêmes occurrences : chemins, types, valeurs ; l'ordre des clés d'objet n'a pas de sens, celui des tableaux si) ;
//     couverture  : un ensemble d'identités au contrat des couvertures (normaliserCouverture : chemins de segments, doublon refusé, ordre
//                   sans signification).
//   universelle : la couverture de l'univers, FOURNIE par l'appelant (jamais déduite des descriptions) ; même contrat.
//   Toute couverture de description doit être incluse dans l'universelle, sinon TypeError.
// CLASSES : une classe par couverture qui est NON VIDE, DIFFÉRENTE de l'universelle (analogue général de R2 : une description vraie de
//   tout l'univers ne distingue rien) et portée par AU MOINS DEUX descriptions DISTINCTES. Égalité EXACTE de couverture seulement :
//   ni inclusion, ni chevauchement, ni proximité, ni score, ni fréquence, ni majorité. Les entrées répétées (même description, même
//   couverture) sont sans signification : une description n'est jamais co-couverte avec elle-même. Une même description sous deux
//   couvertures différentes figure dans chacune des classes correspondantes (ce sont deux constats différents de l'appelant).
// SORTIE : copies neuves ; couverture canonique ; ordre technique déterministe et SANS signification (classes par couverture canonique,
//   descriptions par leur parcours) — il ne dépend ni de l'ordre des entrées ni de celui des identités.
// ERREURS : entrée hors contrat (non tableau, entrée non objet, propriété manquante ou étrangère, accesseur, description hors domaine,
//   couverture invalide ou avec doublon, couverture hors de l'universelle) : TypeError, aucun résultat partiel.
// Aucune persistance, aucune causalité, aucun nom de champ. NON BRANCHÉE : aucun mécanisme ne l'importe.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées (gelées acceptées).
import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';
import { parcourirStructure } from './parcours-structure.js';

const NOM = 'coCouverturesDeDescriptions';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireEntree(entree, rang) {
  const nom = `descriptions[${rang}]`;
  if (entree === null || typeof entree !== 'object' || Array.isArray(entree)) refuser(`${nom} doit être un objet`);
  const cles = Reflect.ownKeys(entree);
  if (cles.length !== 2 || !cles.includes('description') || !cles.includes('couverture')) refuser(`${nom} doit porter exactement description et couverture`);
  const lire = (cle) => { const d = Object.getOwnPropertyDescriptor(entree, cle); if (!('value' in d) || !d.enumerable) refuser(`${nom}.${cle} doit être une donnée énumérable`); return d.value; };
  const description = lire('description');
  let empreinte;
  try { empreinte = JSON.stringify(parcourirStructure(description)); } catch (e) { refuser(`${nom}.description hors domaine (${e.message})`); }
  let couverture;
  try { couverture = normaliserCouverture(lire('couverture')); } catch (e) { refuser(`${nom}.couverture invalide (${e.message})`); }
  return { description, empreinte, couverture };
}

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function coCouverturesDeDescriptions(descriptions, universelle) {
  if (!Array.isArray(descriptions)) refuser('descriptions doit être un tableau');
  let univers;
  try { univers = normaliserCouverture(universelle); } catch (e) { refuser(`universelle invalide (${e.message})`); }
  const dansUnivers = new Set(univers.map((t) => JSON.stringify(t)));
  const lues = [];
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    if (!Object.hasOwn(descriptions, rang)) refuser(`descriptions[${rang}] est un trou`);
    const lue = lireEntree(descriptions[rang], rang);
    for (const t of lue.couverture) if (!dansUnivers.has(JSON.stringify(t))) refuser(`descriptions[${rang}].couverture n'est pas incluse dans l'universelle`);
    lues.push(lue);
  }
  const parCouverture = new Map(); // couverture canonique -> Map(empreinte -> description)
  for (const { description, empreinte, couverture } of lues) {
    if (couverture.length === 0 || memesCouvertures(couverture, univers)) continue;
    const cle = JSON.stringify(couverture);
    if (!parCouverture.has(cle)) parCouverture.set(cle, { couverture, membres: new Map() });
    const membres = parCouverture.get(cle).membres;
    if (!membres.has(empreinte)) membres.set(empreinte, description);
  }
  const classes = [];
  for (const cle of [...parCouverture.keys()].sort(comparerCodes)) {
    const { couverture, membres } = parCouverture.get(cle);
    if (membres.size < 2) continue;
    classes.push({
      couverture: structuredClone(couverture),
      descriptions: [...membres.keys()].sort(comparerCodes).map((e) => structuredClone(membres.get(e))),
    });
  }
  return classes;
}
// === FIN_LANGAGE_CO_COUVERTURES_DESCRIPTIONS ===
