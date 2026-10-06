// === DEBUT_LANGAGE_FORMES_OPERATION ===
// v0.62.7 -- ÉTAPE 6 : « FORMES D'OPÉRATION » (décision ChatGPT, 04/10/2026, suite au diagnostic
// « DESCRIPTEUR D'OPÉRATION / ULTIME DIAGNOSTIC »). MODULE PUR ET DORMANT : le plus petit vocabulaire formel
// qui décrit la FORME de ce qu'une opération reçoit et de ce qu'elle produit. Il répond à UNE seule question :
//
//   « ce descripteur respecte-t-il notre langage de formes ? »  -> copie indépendante, ou TypeError.
//
// Il ne décrit aucune opération réelle, n'en enregistre aucune, n'en exécute aucune et ne dit jamais qu'une
// opération peut en suivre une autre. Un descripteur est une simple donnée.
//
// QUATRE FORMES (clé `forme`) :
//   { forme: 'scalaire', genre? }     genre : 'chaine' | 'nombre' | 'booleen'. Genre absent = scalaire primitif
//                                     non précisé.
//   { forme: 'objet', champs? }       champs : { nom: champ }. Champs absents = objet dont l'intérieur n'est pas décrit.
//   { forme: 'collection', elements? } elements : une forme (SANS fait de champ). Absent = éléments non décrits.
//   { forme: 'quelconque' }           (v0.63.3) forme NON CONTRAINTE : la valeur n'est contrainte par ce descripteur ni
//                                     comme scalaire, ni comme objet, ni comme collection. Rien d'autre : ni genre, ni
//                                     champs, ni éléments (refusés). Elle ne dit RIEN sur la nullité : la nullité reste
//                                     exprimée uniquement par le fait `peutEtreNull`, comme pour toute autre forme.
//
// CHAMP = une forme portant, au même niveau, des faits booléens facultatifs (jamais déduits, jamais réparés) :
//   côté ENTRÉES : `omissible` (le champ peut être absent) et `peutEtreNull` (v0.63.3 : le champ accepte null) ;
//                  deux faits DISTINCTS et indépendants : absent ≠ null (les quatre combinaisons sont permises) ;
//   côté SORTIE  : `peutManquer` et `peutEtreNull`, deux faits DISTINCTS et indépendants (les quatre
//                  combinaisons sont permises). Aucun fait propre à undefined.
// DETTE CONNUE (v0.63.3, délibérée) : aucun fait ni marqueur « undefined présent ». Un contrat qui distingue
// « propriété absente », « propriété présente valant undefined » et « propriété présente valant null » ne peut donc
// être décrit que par omissible (absent) et peutEtreNull (null) ; « undefined présent » n'est PAS représentable et ne
// doit jamais être masqué sous omissible.
// Un fait absent est conservé absent, un fait écrit `false` est conservé `false` : la copie ne normalise rien.
// Les faits ne se posent que sur les champs d'un objet ; ni sur la sortie racine, ni sur un élément de collection.
//
// DESCRIPTEUR D'OPÉRATION : { nom, entrees, sortie }
//   nom : chaîne contenant au moins un caractère non blanc (conservée telle quelle) ;
//   entrees : { nom: champ } côté entrées (objet possiblement vide) ;
//   sortie : une forme (côté sortie).
//
// VALIDATION : tout écart est un TypeError (clé inconnue, forme ou genre inconnu, genre hors scalaire, champs
// hors objet, éléments hors collection, fait du mauvais côté ou du mauvais type, valeur undefined, nom vide,
// non-objet là où un objet est exigé, tableau là où un objet est exigé, objet de classe, propriété accesseur ou
// symbole). Rien n'est réparé, rien n'est ignoré en silence.
//
// ANTI-CYCLE : la lignée des formes en cours de lecture est suivie ; une forme qui se contient elle-même
// (directement ou par ses champs ou éléments) est refusée. Une même forme réutilisée à deux endroits sans
// cycle est acceptée et copiée deux fois, indépendamment.
//
// COPIE : la sortie est un graphe neuf de littéraux JSON (chaînes, booléens, objets, tableaux absents) ;
// aucune fonction, aucune référence partagée avec l'entrée. Les formes se lisent par leurs propriétés propres
// énumérables.
//
// INDÉPENDANCE : aucun import. Aucun accès magasin. Aucune exécution.
const FORMES = ['scalaire', 'objet', 'collection', 'quelconque'];
const GENRES = ['chaine', 'nombre', 'booleen'];
const CLE_PROPRE = { scalaire: 'genre', objet: 'champs', collection: 'elements', quelconque: null };
const FAITS = { entree: ['omissible', 'peutEtreNull', 'collectif'], sortie: ['peutManquer', 'peutEtreNull'] };

function poser(cible, cle, valeur) {
  Object.defineProperty(cible, cle, { value: valeur, enumerable: true, writable: true, configurable: true });
}

// Lit un objet simple sous forme de paires [clé, valeur] ; refuse tout le reste.
function lirePaires(x, chemin) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) throw new TypeError(`formes-operation : ${chemin} doit être un objet simple.`);
  const proto = Object.getPrototypeOf(x);
  if (proto !== Object.prototype && proto !== null) throw new TypeError(`formes-operation : ${chemin} doit être un objet simple (pas une instance de classe).`);
  if (Object.getOwnPropertySymbols(x).length > 0) throw new TypeError(`formes-operation : ${chemin} ne doit porter aucune propriété symbole.`);
  const paires = [];
  for (const cle of Object.keys(x)) {
    const d = Object.getOwnPropertyDescriptor(x, cle);
    if (!('value' in d)) throw new TypeError(`formes-operation : ${chemin}.${cle} doit être une propriété de données (pas d'accesseur).`);
    paires.push([cle, d.value]);
  }
  return paires;
}

function copierChamps(x, cote, chemin, lignee) {
  const copie = {};
  for (const [nom, valeur] of lirePaires(x, chemin)) {
    if (nom === '') throw new TypeError(`formes-operation : ${chemin} contient un nom de champ vide.`);
    poser(copie, nom, copierForme(valeur, cote, `${chemin}.${nom}`, lignee, true));
  }
  return copie;
}

function copierForme(x, cote, chemin, lignee, estChamp) {
  const paires = lirePaires(x, chemin);
  if (lignee.has(x)) throw new TypeError(`formes-operation : cycle détecté en ${chemin}.`);
  lignee.add(x);
  try {
    const props = new Map(paires);
    const forme = props.get('forme');
    if (typeof forme !== 'string' || !FORMES.includes(forme)) throw new TypeError(`formes-operation : ${chemin}.forme doit valoir 'scalaire', 'objet', 'collection' ou 'quelconque'.`);
    const propre = CLE_PROPRE[forme];
    const faitsLocaux = estChamp ? FAITS[cote] : [];
    for (const [cle] of paires) {
      if (cle === 'forme' || cle === propre || faitsLocaux.includes(cle)) continue;
      if (FAITS.entree.includes(cle) || FAITS.sortie.includes(cle)) throw new TypeError(`formes-operation : le fait « ${cle} » n'est pas permis en ${chemin} (côté ${cote}, ${estChamp ? 'champ' : 'hors champ'}).`);
      throw new TypeError(`formes-operation : la propriété « ${cle} » n'est pas permise sur une forme '${forme}' (${chemin}).`);
    }
    const copie = { forme };
    if (propre !== null && props.has(propre)) {
      const v = props.get(propre);
      if (forme === 'scalaire') {
        if (typeof v !== 'string' || !GENRES.includes(v)) throw new TypeError(`formes-operation : ${chemin}.genre doit valoir 'chaine', 'nombre' ou 'booleen'.`);
        poser(copie, 'genre', v);
      } else if (forme === 'objet') {
        poser(copie, 'champs', copierChamps(v, cote, `${chemin}.champs`, lignee));
      } else {
        poser(copie, 'elements', copierForme(v, cote, `${chemin}.elements`, lignee, false));
      }
    }
    for (const fait of faitsLocaux) {
      if (!props.has(fait)) continue;
      const v = props.get(fait);
      if (typeof v !== 'boolean') throw new TypeError(`formes-operation : ${chemin}.${fait} doit être un booléen.`);
      poser(copie, fait, v);
    }
    return copie;
  } finally {
    lignee.delete(x);
  }
}

// v0.63.39 -- LIAISON COLLECTIVE (fait `collectif`, entrée seulement). Une entrée `collectif: true` n'est PAS liée à une donnée choisie : elle
// reçoit l'ENSEMBLE COMPLET des données dont la forme garantit la forme de `valeur`. Contrat fermé : c'est l'UNIQUE entrée de l'opération ;
// sa forme est une collection d'objets { identite: chaîne, valeur: <forme exigée> } ; ni omissible ni peutEtreNull ; aucun fait sur
// `identite` ni sur `valeur` ; `collectif` n'existe qu'à la racine d'une entrée. Tout écart = TypeError. `collectif: false` = entrée ordinaire.
const FAITS_TOUS = ['omissible', 'peutEtreNull', 'peutManquer', 'collectif'];
function exigerCollectifEnRacineSeulement(forme, chemin) {
  if (forme === null || typeof forme !== 'object') return;
  if (Object.hasOwn(forme, 'collectif')) throw new TypeError(`formes-operation : le fait « collectif » n'est permis qu'à la racine d'une entrée (${chemin}).`);
  if (forme.forme === 'collection' && Object.hasOwn(forme, 'elements')) exigerCollectifEnRacineSeulement(forme.elements, `${chemin}.elements`);
  if (forme.forme === 'objet' && Object.hasOwn(forme, 'champs')) {
    for (const nom of Object.keys(forme.champs)) exigerCollectifEnRacineSeulement(forme.champs[nom], `${chemin}.champs.${nom}`);
  }
}
function verifierCollectifs(entrees) {
  const noms = Object.keys(entrees);
  for (const nom of noms) {
    const champ = entrees[nom];
    if (champ.collectif !== true) {
      if (champ.forme === 'collection' && Object.hasOwn(champ, 'elements')) exigerCollectifEnRacineSeulement(champ.elements, `entrees.${nom}.elements`);
      if (champ.forme === 'objet' && Object.hasOwn(champ, 'champs')) {
        for (const sous of Object.keys(champ.champs)) exigerCollectifEnRacineSeulement(champ.champs[sous], `entrees.${nom}.champs.${sous}`);
      }
      continue;
    }
    const lieu = `entrees.${nom}`;
    if (noms.length !== 1) throw new TypeError(`formes-operation : ${lieu} est collectif : ce doit être l'UNIQUE entrée de l'opération.`);
    if (champ.omissible === true || champ.peutEtreNull === true) throw new TypeError(`formes-operation : ${lieu} est collectif : ni omissible ni peutEtreNull.`);
    if (champ.forme !== 'collection' || !Object.hasOwn(champ, 'elements')) throw new TypeError(`formes-operation : ${lieu} est collectif : une collection d'objets { identite, valeur } est exigée.`);
    const element = champ.elements;
    if (element.forme !== 'objet' || !Object.hasOwn(element, 'champs')) throw new TypeError(`formes-operation : ${lieu} est collectif : les éléments doivent être des objets { identite, valeur }.`);
    const cles = Object.keys(element.champs);
    if (cles.length !== 2 || !cles.includes('identite') || !cles.includes('valeur')) throw new TypeError(`formes-operation : ${lieu} est collectif : les champs doivent être exactement « identite » et « valeur ».`);
    const identite = element.champs.identite;
    if (identite.forme !== 'scalaire' || identite.genre !== 'chaine') throw new TypeError(`formes-operation : ${lieu}.identite doit être un scalaire de genre 'chaine'.`);
    for (const champInterne of [identite, element.champs.valeur]) {
      for (const fait of FAITS_TOUS) {
        if (Object.hasOwn(champInterne, fait)) throw new TypeError(`formes-operation : ${lieu} est collectif : aucun fait (« ${fait} ») sur identite ni sur valeur.`);
      }
    }
    exigerCollectifEnRacineSeulement(element.champs.valeur, `${lieu}.elements.champs.valeur`);
  }
}

export function validerDescripteurOperation(descripteur) {
  const paires = lirePaires(descripteur, 'descripteur');
  const props = new Map(paires);
  for (const [cle] of paires) {
    if (cle !== 'nom' && cle !== 'entrees' && cle !== 'sortie') throw new TypeError(`formes-operation : la propriété « ${cle} » n'est pas permise sur un descripteur.`);
  }
  for (const requis of ['nom', 'entrees', 'sortie']) {
    if (!props.has(requis)) throw new TypeError(`formes-operation : le descripteur doit porter « ${requis} ».`);
  }
  const nom = props.get('nom');
  if (typeof nom !== 'string' || nom.trim() === '') throw new TypeError('formes-operation : « nom » doit être une chaîne contenant au moins un caractère non blanc.');
  const lignee = new Set();
  const entrees = copierChamps(props.get('entrees'), 'entree', 'entrees', lignee);
  const sortie = copierForme(props.get('sortie'), 'sortie', 'sortie', lignee, false);
  verifierCollectifs(entrees);
  return { nom, entrees, sortie };
}
// === FIN_LANGAGE_FORMES_OPERATION ===
