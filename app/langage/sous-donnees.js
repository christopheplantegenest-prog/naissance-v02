// === DEBUT_LANGAGE_SOUS_DONNEES ===
// v0.63.46 — « α2-LIGNE » (décision ChatGPT, 06/10/2026). MODULE PUR : il ne lit aucune mémoire, ne connaît aucune opération, n'importe aucun
// catalogue, ne garde aucune table, n'écrit rien.
//
// INVARIANT AMENDÉ. Ancien : « identité du fait = identité du résultat, aucune identité de résultat séparée ». Nouveau : l'identité d'une
// exécution est l'identité de sa production ENTIÈRE. Les champs OBLIGATOIRES NOMMÉS explicitement déclarés au premier niveau d'une sortie objet
// peuvent également recevoir des identités de DONNÉES propres (des « sous-données »). Ces sous-données restent PORTÉES par la production : ce ne
// sont NI des exécutions, NI des productions, NI des copies de la valeur. Leur provenance est la ligne d'exécution qui les porte.
//
// FORMAT PERSISTÉ (clé OPTIONNELLE de la ligne executionsOperations) :
//   sousDonnees: [ { id: <chaîne opaque non vide>, chemin: [ <nom de champ> ] }, … ]
//   - chemin : tableau dense d'EXACTEMENT un segment (chaîne non vide) dans cette version ; jamais une chaîne encodée.
//   - absence de la clé = aucune sous-donnée (une ancienne ligne n'en acquiert JAMAIS rétroactivement) ; `[]` est INTERDIT (une seule
//     représentation de « aucune »).
//   - ids uniques dans la ligne, distincts de l'id de l'exécution ; chemins uniques ; clés closes { id, chemin }.
//   - ORDRE CANONIQUE : par chemin, unités de code, segment par segment. L'ordre ne sert qu'à une sérialisation déterminée : il n'a AUCUNE
//     signification de choix (jamais premier/dernier).
//   - la FORME n'est pas persistée : elle est relue dans le descripteur COURANT de l'opération, au chemin déclaré.
//
// SOUS-DONNÉES EXPOSABLES : uniquement les champs nommés, OBLIGATOIRES (ni `peutManquer`) et déclarés au premier niveau d'une sortie de forme
// 'objet' avec `champs`. Une sortie non objet, ou un objet sans champ obligatoire : aucune sous-donnée. Jamais d'élément de collection, d'indice,
// de nœud dynamique, de champ optionnel, de propriété non déclarée ni de sous-champ récursif.
//
// VALIDATION AVANT ÉCRITURE (`preparerSousDonnees`, appelée par l'APPELANT qui possède le descripteur ET la valeur réelle) : pour chaque champ
// exposable, la sous-valeur doit être une propriété PROPRE de DONNÉE (pas d'accesseur), présente et CONFORME à la sous-forme déclarée. Un seul
// écart refuse l'exécution entière (TypeError) : jamais de sous-donnée partielle, jamais de donnée candidate sans valeur.
// INDÉPENDANCE : aucun import.

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lirePropre(objet, champ, nom) {
  const p = Object.getOwnPropertyDescriptor(objet, champ);
  if (p === undefined) throw new TypeError(`${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in p)) throw new TypeError(`${nom}.${champ} est un accesseur : une donnée est attendue.`);
  return p.value;
}

function objetPlat(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`${nom} doit être un objet.`);
}

// --- sous-données exposables d'une sortie (forme DÉJÀ validée par le langage de formes) ---
export function sousDonneesDeclarees(sortie) {
  objetPlat(sortie, 'sortie');
  if (lirePropre(sortie, 'forme', 'sortie') !== 'objet' || !Object.hasOwn(sortie, 'champs')) return [];
  const champs = lirePropre(sortie, 'champs', 'sortie');
  const trouvees = [];
  for (const nom of Object.keys(champs)) {
    const champ = lirePropre(champs, nom, 'sortie.champs');
    if (Object.hasOwn(champ, 'peutManquer') && champ.peutManquer === true) continue;
    trouvees.push({ chemin: [nom], forme: champ });
  }
  return trouvees.sort((a, b) => comparerCodes(a.chemin[0], b.chemin[0]));
}

// Copie neuve d'une forme DÉJÀ validée (graphe de littéraux JSON : objets simples, chaînes, booléens) : jamais de référence partagée.
function copierForme(forme) {
  if (forme === null || typeof forme !== 'object') return forme;
  if (Array.isArray(forme)) return forme.map(copierForme);
  const copie = {};
  for (const cle of Object.keys(forme)) copie[cle] = copierForme(lirePropre(forme, cle, 'forme'));
  return copie;
}

// Forme d'une sous-donnée d'après le descripteur COURANT (copie neuve) ; `null` si le chemin n'est plus (ou n'a jamais été) une sous-donnée exposable.
export function formeSousDonnee(sortie, chemin) {
  const nom = chemin[0];
  const trouvee = sousDonneesDeclarees(sortie).find((s) => s.chemin[0] === nom);
  return trouvee === undefined ? null : copierForme(trouvee.forme);
}

// --- conformité valeur / forme (UNIQUEMENT pour les sous-valeurs ; extras tolérés dans un objet, comme la garantie de forme) ---
function conforme(valeur, forme, chemin) {
  if (valeur === null) {
    if (forme.peutEtreNull === true) return;
    throw new TypeError(`sous-valeur non conforme : ${chemin} vaut null sans que la forme l'admette.`);
  }
  if (valeur === undefined) throw new TypeError(`sous-valeur non conforme : ${chemin} vaut undefined.`);
  switch (forme.forme) {
    case 'quelconque':
      return;
    case 'scalaire': {
      const t = typeof valeur;
      const genre = forme.genre;
      const ok = genre === 'chaine' ? t === 'string'
        : genre === 'nombre' ? t === 'number' && Number.isFinite(valeur)
          : genre === 'booleen' ? t === 'boolean'
            : t === 'string' || t === 'boolean' || (t === 'number' && Number.isFinite(valeur));
      if (!ok) throw new TypeError(`sous-valeur non conforme : ${chemin} n'est pas un scalaire${genre ? ` de genre ${genre}` : ''}.`);
      return;
    }
    case 'collection': {
      if (!Array.isArray(valeur)) throw new TypeError(`sous-valeur non conforme : ${chemin} n'est pas une collection.`);
      for (let i = 0; i < valeur.length; i += 1) {
        const element = lirePropre(valeur, String(i), chemin);
        if (forme.elements !== undefined) conforme(element, forme.elements, `${chemin}[${i}]`);
      }
      return;
    }
    default: { // objet
      if (typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`sous-valeur non conforme : ${chemin} n'est pas un objet.`);
      if (forme.champs === undefined) return;
      for (const nom of Object.keys(forme.champs)) {
        const champ = forme.champs[nom];
        if (!Object.hasOwn(valeur, nom)) {
          if (champ.peutManquer === true) continue;
          throw new TypeError(`sous-valeur non conforme : ${chemin}.${nom} est absent.`);
        }
        conforme(lirePropre(valeur, nom, chemin), champ, `${chemin}.${nom}`);
      }
    }
  }
}

export function sousValeurConforme(valeur, forme, nom) {
  conforme(valeur, forme, nom);
}

// --- lecture d'une sous-valeur dans un `resultat` (propriété propre de donnée ; la RÉFÉRENCE est rendue, jamais une copie) ---
export function valeurSousDonnee(resultat, chemin) {
  objetPlat(resultat, 'resultat');
  return lirePropre(resultat, chemin[0], 'resultat');
}

// --- format canonique d'une clé `sousDonnees` : rend une COPIE neuve, ou lève TypeError ---
export function sousDonneesCanoniques(brutes, nom, idExecution) {
  if (!Array.isArray(brutes)) throw new TypeError(`${nom} doit être un tableau.`);
  if (brutes.length === 0) throw new TypeError(`${nom} ne doit jamais être vide : l'absence de la clé exprime « aucune sous-donnée ».`);
  const copie = [];
  const ids = new Set();
  const chemins = new Set();
  for (let rang = 0; rang < brutes.length; rang += 1) {
    const brute = lirePropre(brutes, String(rang), nom);
    objetPlat(brute, `${nom}[${rang}]`);
    for (const cle of Reflect.ownKeys(brute)) {
      if (cle !== 'id' && cle !== 'chemin') throw new TypeError(`${nom}[${rang}] contient un champ étranger.`);
    }
    const id = lirePropre(brute, 'id', `${nom}[${rang}]`);
    if (typeof id !== 'string' || id.length === 0) throw new TypeError(`${nom}[${rang}].id doit être une chaîne non vide.`);
    if (idExecution !== undefined && id === idExecution) throw new TypeError(`${nom}[${rang}].id ne peut pas être l'identité de l'exécution.`);
    if (ids.has(id)) throw new TypeError(`${nom}[${rang}].id est dupliqué.`);
    ids.add(id);
    const bruteChemin = lirePropre(brute, 'chemin', `${nom}[${rang}]`);
    if (!Array.isArray(bruteChemin) || bruteChemin.length !== 1) throw new TypeError(`${nom}[${rang}].chemin doit être un tableau d'exactement un segment.`);
    const segment = lirePropre(bruteChemin, '0', `${nom}[${rang}].chemin`);
    if (typeof segment !== 'string' || segment.length === 0) throw new TypeError(`${nom}[${rang}].chemin[0] doit être une chaîne non vide.`);
    if (chemins.has(segment)) throw new TypeError(`${nom}[${rang}].chemin est dupliqué.`);
    chemins.add(segment);
    copie.push({ id, chemin: [segment] });
  }
  for (let i = 1; i < copie.length; i += 1) {
    if (comparerCodes(copie[i - 1].chemin[0], copie[i].chemin[0]) >= 0) throw new TypeError(`${nom} n'est pas en ordre canonique (par chemin).`);
  }
  return copie;
}

// --- côté APPELANT : champs exposables + validation de la valeur réelle + identités ---
// `descriptions` : le catalogue (injecté, jamais importé ici) ; `operation` : nom de l'opération exécutée ; `valeur` : valeur produite ;
// `nouvelId` : générateur d'identités du dépôt (injecté). Rend `undefined` (opération non décrite, ou aucune sous-donnée : la clé ne doit pas
// être écrite) ou le tableau canonique prêt à écrire.
export function preparerSousDonnees(descriptions, operation, valeur, nouvelId) {
  if (!Array.isArray(descriptions)) throw new TypeError('preparerSousDonnees : descriptions doit être un tableau.');
  if (typeof nouvelId !== 'function') throw new TypeError('preparerSousDonnees : nouvelId doit être une fonction.');
  const description = descriptions.find((d) => d !== null && typeof d === 'object' && d.nom === operation);
  if (description === undefined) return undefined;
  const declarees = sousDonneesDeclarees(lirePropre(description, 'sortie', 'description'));
  if (declarees.length === 0) return undefined;
  objetPlat(valeur, 'valeur produite');
  const relations = [];
  for (const declaree of declarees) {
    const sousValeur = valeurSousDonnee(valeur, declaree.chemin);
    conforme(sousValeur, declaree.forme, `${declaree.chemin[0]}`);
    relations.push({ id: nouvelId('sous-donnee'), chemin: [declaree.chemin[0]] });
  }
  return relations; // déjà en ordre canonique (sousDonneesDeclarees trie par chemin)
}

// --- côté LECTURE : index idSous -> { execution (ligne porteuse), chemin } (provenance structurelle D → ligne porteuse) ---
export function indexSousDonnees(executions) {
  if (!Array.isArray(executions)) throw new TypeError('indexSousDonnees : executions doit être un tableau.');
  const index = new Map();
  for (let rang = 0; rang < executions.length; rang += 1) {
    const ligne = lirePropre(executions, String(rang), 'executions');
    objetPlat(ligne, `executions[${rang}]`);
    if (!Object.hasOwn(ligne, 'sousDonnees')) continue;
    const id = lirePropre(ligne, 'id', `executions[${rang}]`);
    for (const relation of sousDonneesCanoniques(lirePropre(ligne, 'sousDonnees', `executions[${rang}]`), `executions[${rang}].sousDonnees`, id)) {
      if (index.has(relation.id)) throw new TypeError(`executions : l'identité de sous-donnée « ${relation.id} » est portée deux fois.`);
      index.set(relation.id, { execution: ligne, chemin: relation.chemin });
    }
  }
  return index;
}
// === FIN_LANGAGE_SOUS_DONNEES ===
