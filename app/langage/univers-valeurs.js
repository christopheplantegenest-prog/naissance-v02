// === DEBUT_LANGAGE_UNIVERS_VALEURS ===
// v0.63.28 — VUE PURE DE L'UNIVERS HISTORIQUE DES VALEURS. DORMANTE.
//
// universValeurs(lignesValeurs, lignesExecutions) -> [ { chemin: [identite], contenu: valeur } ]
//
// Rend simultanément observables TOUTES les valeurs persistées (une par ligne des deux tables), sans en sélectionner.
// La sortie est de la forme attendue par un observateur structurel (identité opaque à un segment, contenu JSON).
//
// CONTRAT MINIMAL : on ne lit que `id` + `valeur` (table des valeurs de messages) et `id` + `resultat` (exécutions), propriétés
// PROPRES de DONNÉE (aucun héritage, aucun accesseur exécuté). Aucun autre champ n'est lu ni exigé : on observe des porteurs
// de valeur, pas la validité complète d'une exécution. Toute exécution persistée est retenue, quelle que soit son opération.
//
// VALIDATION : tableaux denses ; identité = chaîne non vide ; valeur obligatoirement présente et dans le domaine JSON simple
// (null, chaîne, booléen, nombre fini, tableau simple dense, objet simple ; ni undefined, ni cycle, ni accesseur, ni symbole).
// Une identité ne peut apparaître qu'UNE fois sur l'ensemble des deux sources (jamais fusionnée, jamais départagée).
// Tout est validé avant la moindre sortie : TypeError, jamais de vue partielle.
//
// RÉFÉRENCES : `contenu` est la référence exacte de la valeur source (pas de copie) ; la vue est éphémère, rien n'est muté.
// ORDRE : sans sens. Tri par identité (unités de code), purement mécanique pour la reproductibilité, jamais chronologique.
// COMPLEXITÉ : O(M + X) pour la lecture et la détection des collisions, plus le tri canonique O(n log n).
//
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique). Ce fichier n'importe RIEN.
const NOM = 'universValeurs';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireTableauDense(valeur, nom) {
  if (!Array.isArray(valeur) || Object.getPrototypeOf(valeur) !== Array.prototype) refuser(`${nom} n'est pas un tableau simple`);
  const n = valeur.length;
  const cles = Reflect.ownKeys(valeur);
  if (cles.length !== n + 1) refuser(`${nom} est creux ou porte des propriétés additionnelles`);
  const lignes = [];
  for (let i = 0; i < n; i += 1) {
    if (cles[i] !== String(i)) refuser(`${nom} est creux ou porte des propriétés additionnelles`);
    const d = Object.getOwnPropertyDescriptor(valeur, cles[i]);
    if (!('value' in d)) refuser(`${nom}[${i}] est un accesseur`);
    lignes.push(d.value);
  }
  return lignes;
}

function champPropre(ligne, champ, lieu) {
  if (ligne === null || typeof ligne !== 'object' || Array.isArray(ligne)) refuser(`${lieu} n'est pas un objet de ligne`);
  const d = Object.getOwnPropertyDescriptor(ligne, champ);
  if (d === undefined) refuser(`${lieu} n'a pas de propriété propre « ${champ} »`);
  if (!('value' in d)) refuser(`${lieu}.${champ} est un accesseur`);
  return d.value;
}

function verifierJson(valeur, lieu, pile) {
  if (valeur === null) return;
  const sorte = typeof valeur;
  if (sorte === 'string' || sorte === 'boolean') return;
  if (sorte === 'number') {
    if (!Number.isFinite(valeur)) refuser(`${lieu} contient un nombre non fini`);
    return;
  }
  if (sorte !== 'object') refuser(`${lieu} contient une valeur de type ${sorte} (JSON attendu)`);
  if (pile.includes(valeur)) refuser(`${lieu} contient un cycle`);
  pile.push(valeur);
  if (Array.isArray(valeur)) {
    if (Object.getPrototypeOf(valeur) !== Array.prototype) refuser(`${lieu} n'est pas un tableau simple`);
    const n = valeur.length;
    const cles = Reflect.ownKeys(valeur);
    if (cles.length !== n + 1) refuser(`${lieu} est creux ou porte des propriétés additionnelles`);
    for (let i = 0; i < n; i += 1) {
      if (cles[i] !== String(i)) refuser(`${lieu} est creux ou porte des propriétés additionnelles`);
      const d = Object.getOwnPropertyDescriptor(valeur, cles[i]);
      if (!('value' in d)) refuser(`${lieu}[${i}] est un accesseur`);
      if (!d.enumerable) refuser(`${lieu}[${i}] n'est pas énumérable`);
      verifierJson(d.value, `${lieu}[${i}]`, pile);
    }
    if (cles[n] !== 'length') refuser(`${lieu} est creux ou porte des propriétés additionnelles`);
  } else {
    const proto = Object.getPrototypeOf(valeur);
    if (proto !== Object.prototype && proto !== null) refuser(`${lieu} n'est pas un objet simple`);
    for (const cle of Reflect.ownKeys(valeur)) {
      if (typeof cle !== 'string') refuser(`${lieu} porte une clé symbole`);
      const d = Object.getOwnPropertyDescriptor(valeur, cle);
      if (!('value' in d)) refuser(`${lieu}["${cle}"] est un accesseur`);
      if (!d.enumerable) refuser(`${lieu}["${cle}"] n'est pas énumérable`);
      verifierJson(d.value, `${lieu}["${cle}"]`, pile);
    }
  }
  pile.pop();
}

function lireSource(tableau, nom, champValeur, vus, sortie) {
  const lignes = lireTableauDense(tableau, nom);
  for (let i = 0; i < lignes.length; i += 1) {
    const lieu = `${nom}[${i}]`;
    const id = champPropre(lignes[i], 'id', lieu);
    if (typeof id !== 'string' || id === '') refuser(`${lieu}.id n'est pas une chaîne non vide`);
    const contenu = champPropre(lignes[i], champValeur, lieu);
    verifierJson(contenu, `${lieu}.${champValeur}`, []);
    if (vus.has(id)) refuser(`identité « ${id} » portée par plusieurs lignes`);
    vus.add(id);
    sortie.push({ id, contenu });
  }
}

export function universValeurs(lignesValeurs, lignesExecutions) {
  const vus = new Set();
  const lues = [];
  lireSource(lignesValeurs, 'lignesValeurs', 'valeur', vus, lues);
  lireSource(lignesExecutions, 'lignesExecutions', 'resultat', vus, lues);
  lues.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return lues.map(({ id, contenu }) => ({ chemin: [id], contenu }));
}
// === FIN_LANGAGE_UNIVERS_VALEURS ===
