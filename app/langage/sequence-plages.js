// === DEBUT_LANGAGE_SEQUENCE_PLAGES ===
// v0.63.2 — ÉTAPE 6 : « SÉQUENCE + PLAGES ANNOTÉES » (décision ChatGPT, 04/10/2026, suite au diagnostic
// « PEUT-ON DÉCRIRE CE QUE L'ANALYSE UTILISE SANS DÉFINIR COMPRENDRE »). PRIMITIVE PURE, GÉNÉRALE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « pour chaque POSITION d'une séquence, quelles plages annotées la couvrent ? »
//
// Elle matérialise mécaniquement le produit position x plages, rien d'autre. Elle ne connaît ni le langage, ni
// la provenance de l'analyse, ni les états de compréhension, ni les tokens, ni les observations, ni aucune
// autre primitive : ce fichier n'importe RIEN. Elle ne choisit AUCUNE propriété à observer, ne regroupe rien,
// ne compte rien, n'interprète ni `element` ni `etiquette`.
//
// ENTRÉE : { elements, plages }
//   - elements : tableau (éventuellement vide) de valeurs JSON-compatibles (voir ci-dessous).
//   - plages : tableau (éventuellement vide) d'objets simples { debut, longueur, etiquette }.
//       debut    : entier sûr >= 0 (index zéro-based dans `elements`) ;
//       longueur : entier sûr >= 1 (nombre d'éléments couverts) ;
//       debut + longueur <= elements.length (aucune plage hors bornes n'est rognée ni acceptée) ;
//       etiquette : valeur JSON-compatible, OBLIGATOIRE (propriété propre).
//     Les autres propriétés d'une plage ou de l'entrée sont ignorées et jamais recopiées.
//
// VALEUR « JSON-COMPATIBLE » (contrat unique pour `element` et `etiquette`, pour garantir une copie
// fidèle et une persistance possible) : null, chaîne, booléen, nombre FINI, tableau dense de telles valeurs,
// objet simple (prototype Object.prototype ou null, propriétés propres énumérables de type chaîne, sans
// accesseur) dont les valeurs sont elles-mêmes JSON-compatibles. REFUSÉS : undefined, NaN, ±Infinity, bigint,
// symbol, fonction, instances de classe (Date, Map, Set, …), tableau creux, clé symbole, accesseur, cycle.
// Aucune fonction/callback ne peut donc se glisser dans une étiquette : elle est descriptive et copiée,
// jamais exécutée. Une même sous-structure partagée sans cycle (DAG) est acceptée et copiée séparément.
//
// VIOLATION DE CONTRAT = TypeError EXPLICITE (jamais corrigée, convertie ni écartée en silence).
//
// SORTIE : tableau NEUF de longueur elements.length, dans l'ordre naturel des positions :
//   [{ position, element, couvertures: [{ etiquette, debut, longueur }, …] }, …]
//   - element : COPIE profonde de elements[position], non interprétée.
//   - couvertures : les plages qui contiennent la position, dans l'ORDRE DES PLAGES D'ENTRÉE (aucun tri,
//     aucune déduplication, aucune fusion) ; vide si aucune plage ne la couvre. Deux plages identiques
//     (même étiquette comprise) donnent deux couvertures. Plusieurs étiquettes sur une position restent
//     plusieurs couvertures distinctes.
//   - etiquette : COPIE profonde, indépendante pour chaque couverture (modifier la sortie d'une position
//     ne peut jamais modifier une autre position, ni l'entrée).
//   couvertures.length suffit à connaître le nombre de plages ; aucun champ `nombre`, aucun ratio, aucune
//   catégorie, aucun regroupement.
//
// IDENTITÉ : aucune identité globale. `position` est relative à la séquence fournie ; un appelant qui
// voudrait { idObservation, position } la construit ailleurs.
//
// PURETÉ : ne mute jamais l'entrée (gelée acceptée), ne persiste rien, ne garde aucun état, ne lit rien
// d'extérieur. NON BRANCHÉ : aucun fichier de production n'importe celui-ci (gardé par un test statique).

const estObjetSimple = (x) => {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
};

const estEntierSur = (n) => typeof n === 'number' && Number.isSafeInteger(n);

function decrire(valeur) {
  if (valeur === null) return 'null';
  if (Array.isArray(valeur)) return 'tableau';
  if (typeof valeur === 'number') return `nombre non fini (${String(valeur)})`;
  return typeof valeur;
}

// Copie profonde d'une valeur JSON-compatible, avec validation. `chemin` ne sert qu'au message d'erreur.
// `pile` détecte les cycles (ancêtres de la valeur courante).
function copierJson(valeur, chemin, pile) {
  if (valeur === null) return null;
  const type = typeof valeur;
  if (type === 'string' || type === 'boolean') return valeur;
  if (type === 'number') {
    if (!Number.isFinite(valeur)) throw new TypeError(`couvrirSequence : ${chemin} contient ${decrire(valeur)} (valeur JSON-compatible attendue).`);
    return valeur;
  }
  if (type !== 'object') throw new TypeError(`couvrirSequence : ${chemin} contient ${decrire(valeur)} (valeur JSON-compatible attendue).`);
  if (pile.includes(valeur)) throw new TypeError(`couvrirSequence : ${chemin} contient un cycle.`);
  pile.push(valeur);
  let copie;
  if (Array.isArray(valeur)) {
    if (Object.getPrototypeOf(valeur) !== Array.prototype) throw new TypeError(`couvrirSequence : ${chemin} n'est pas un tableau simple.`);
    const cles = Reflect.ownKeys(valeur).filter((k) => k !== 'length');
    if (cles.length !== valeur.length || cles.some((k, i) => k !== String(i))) {
      throw new TypeError(`couvrirSequence : ${chemin} est un tableau creux ou porte des propriétés additionnelles.`);
    }
    copie = valeur.map((v, i) => copierJson(v, `${chemin}[${i}]`, pile));
  } else if (estObjetSimple(valeur)) {
    copie = {};
    for (const cle of Reflect.ownKeys(valeur)) {
      if (typeof cle !== 'string') throw new TypeError(`couvrirSequence : ${chemin} porte une clé symbole.`);
      const d = Object.getOwnPropertyDescriptor(valeur, cle);
      if (!d.enumerable) throw new TypeError(`couvrirSequence : ${chemin}.${cle} n'est pas énumérable.`);
      if (!('value' in d)) throw new TypeError(`couvrirSequence : ${chemin}.${cle} est un accesseur.`);
      // defineProperty : une clé « __proto__ » reste une propriété propre et ne touche jamais le prototype.
      Object.defineProperty(copie, cle, { value: copierJson(d.value, `${chemin}.${cle}`, pile), enumerable: true, writable: true, configurable: true });
    }
  } else {
    throw new TypeError(`couvrirSequence : ${chemin} n'est ni un objet simple ni un tableau (instance de classe ?).`);
  }
  pile.pop();
  return copie;
}

export function couvrirSequence(entree) {
  if (!estObjetSimple(entree)) throw new TypeError('couvrirSequence : un objet { elements, plages } est attendu.');
  const { elements, plages } = entree;
  if (!Array.isArray(elements)) throw new TypeError('couvrirSequence : « elements » doit être un tableau.');
  if (!Array.isArray(plages)) throw new TypeError('couvrirSequence : « plages » doit être un tableau.');

  // 1. Validation complète AVANT toute construction (rien n'est réparé ni écarté en silence).
  const n = elements.length;
  const elementsCopies = [];
  for (let i = 0; i < n; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(elements, i)) throw new TypeError(`couvrirSequence : elements[${i}] est absent (tableau creux).`);
    elementsCopies.push(copierJson(elements[i], `elements[${i}]`, []));
  }
  const plagesValides = [];
  for (let k = 0; k < plages.length; k += 1) {
    if (!Object.prototype.hasOwnProperty.call(plages, k)) throw new TypeError(`couvrirSequence : plages[${k}] est absente (tableau creux).`);
    const p = plages[k];
    if (!estObjetSimple(p)) throw new TypeError(`couvrirSequence : plages[${k}] doit être un objet simple { debut, longueur, etiquette }.`);
    const { debut, longueur } = p; // lus une seule fois
    if (!estEntierSur(debut) || debut < 0) throw new TypeError(`couvrirSequence : plages[${k}].debut doit être un entier >= 0.`);
    if (!estEntierSur(longueur) || longueur < 1) throw new TypeError(`couvrirSequence : plages[${k}].longueur doit être un entier >= 1.`);
    if (debut + longueur > n) throw new TypeError(`couvrirSequence : plages[${k}] (debut ${debut}, longueur ${longueur}) dépasse la séquence (${n} éléments).`);
    if (!Object.prototype.hasOwnProperty.call(p, 'etiquette')) throw new TypeError(`couvrirSequence : plages[${k}] n'a pas d'« etiquette ».`);
    plagesValides.push({ debut, longueur, etiquette: copierJson(p.etiquette, `plages[${k}].etiquette`, []) });
  }

  // 2. Construction : une entrée par position, couvertures dans l'ordre des plages d'entrée.
  return elementsCopies.map((element, position) => {
    const couvertures = [];
    for (const p of plagesValides) {
      if (position >= p.debut && position < p.debut + p.longueur) {
        // copie indépendante par couverture (recopie depuis l'étiquette déjà validée de la plage)
        couvertures.push({ etiquette: copierJson(p.etiquette, 'etiquette', []), debut: p.debut, longueur: p.longueur });
      }
    }
    return { position, element: copierJson(element, 'element', []), couvertures };
  });
}
// === FIN_LANGAGE_SEQUENCE_PLAGES ===
