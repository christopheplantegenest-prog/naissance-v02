// === DEBUT_LANGAGE_VALEURS_OBSERVEES ===
// v0.62.2 — ÉTAPE 6 : « VALEURS OBSERVÉES D'UNE PROPRIÉTÉ » (décision ChatGPT D10/D11/D12, 03/10/2026,
// suite au diagnostic « OBSERVER LA VARIATION D'UNE PROPRIÉTÉ PARMI LES MEMBRES D'UN ENSEMBLE »).
// PRIMITIVE PURE, GÉNÉRALE, DORMANTE. Elle répond à UNE seule question :
//
//   « étant donné plusieurs identités auxquelles l'appelant a DÉJÀ associé une valeur observable,
//     quelles valeurs existent, et quelles identités portent chacune de ces valeurs ? »
//
// C'est la généralisation de la boucle de comparerMotifs() (induction.js) à une propriété QUELCONQUE,
// sans ses quatre champs figés (sujet, relation, type, motsInconnus), et avec en plus la partition
// valeur -> identités que comparerMotifs() laissait à déduire. Elle ne résout AUCUN échec, ne choisit
// AUCUN groupe, ne relance AUCUN decrireStructure : observer une partition descriptive n'est ni choisir
// un groupe, ni utiliser un groupe, ni réparer quoi que ce soit.
//
// INDÉPENDANCE TOTALE (D12) : ce fichier n'importe RIEN. Il ne connaît ni les traces, ni les énoncés,
// ni les expériences, ni les capacités, ni les textes, ni les jetons, ni `arites`, ni
// vueElementsNonDecrits(). L'appelant est seul responsable d'avoir observé/extrait la propriété. La même
// fonction décrit donc aussi bien a->7, b->7, c->11 que a->"rouge", b->"bleu", c->"rouge", sans savoir ce
// que 7, 11, rouge ou bleu représentent.
//
// ENTRÉE : un TABLEAU d'entrées { id, valeur }.
//   - id : chaîne non vide. Aucune normalisation (pas de trim, pas de casse).
//   - valeur : une PRIMITIVE JSON seulement -- string, nombre FINI, boolean, null, ou undefined. Contrat
//     volontairement ÉTROIT : aucune égalité profonde sur objets/tableaux n'est inventée « pour être
//     générique » (jamais nécessaire dans le dépôt à ce jour : arités, capacités, états, dates, jugements
//     sont tous des primitives). NaN, ±Infinity, bigint, symbol, fonction, objet, tableau : REFUSÉS.
//   - Une entrée DOIT être un objet simple non null (pas un tableau). Les propriétés autres que `id` et
//     `valeur` sont ignorées. `valeur` n'est lue que comme PROPRIÉTÉ PROPRE (jamais héritée).
//
// VIOLATION DE CONTRAT = TypeError EXPLICITE (jamais corrigée, jamais convertie, jamais écartée en
// silence) : entrée qui n'est pas un tableau ; entrée-membre qui n'est pas un objet simple ; id qui n'est
// pas une chaîne non vide (une identité invalide n'a aucun nom sous lequel être rapportée) ; valeur hors
// du domaine ci-dessus. Même principe que reexaminerTraces() (vue-traces.js) pour une erreur de
// programmation de l'appelant -- à distinguer des ANOMALIES DE DONNÉE ci-dessous, qui sont rapportées.
//
// ÉGALITÉ DES VALEURS (D11) : TYPÉE, SANS AUCUNE NORMALISATION IMPLICITE. 7 et "7" sont deux valeurs ;
// true et "true" aussi ; null et undefined aussi ; "" et undefined aussi. Aucune conversion en chaîne
// pour construire les groupes. Pour les nombres finis, l'égalité est celle de === (donc 0 et -0 ne font
// qu'une valeur ; la valeur rapportée est celle de la plus petite identité du groupe).
//   - null : valeur explicitement observée ; deux null = UNE valeur null.
//   - undefined : valeur observée distincte de null ; ni transformée en null ni écartée.
//
// TROIS ÉTATS D'UNE IDENTITÉ, jamais fusionnés (comme decrirePositionsRoles(), vue-traces.js) :
//   - OBSERVÉE : exactement une entrée pour cet id, avec une propriété `valeur` propre (même si sa
//     valeur est undefined : { id:"a", valeur: undefined } = undefined explicitement observé) ;
//   - NON RÉSOLUE (`nonResolus`) : exactement une entrée pour cet id, SANS propriété `valeur` propre
//     ({ id:"a" }) -- la paire est incomplète ; aucune valeur n'est fabriquée ;
//   - AMBIGUË (`ambigus`) : plusieurs entrées portent le MÊME id. Une identité désigne normalement un
//     membre unique : on ne choisit JAMAIS l'une des entrées, on n'écrase rien, et on ne fusionne pas
//     même si les valeurs coïncident (uniformité : le simple fait d'avoir plusieurs entrées pour un même
//     membre est rapporté). Cette identité n'apparaît alors ni dans `valeurs`, ni dans `nonResolus`.
//
// SORTIE : { valeurs, nombreValeurs, nonResolus, ambigus }
//   - valeurs : [{ valeur, ids }] -- une ligne par valeur distincte, `ids` triés (ordre des unités de
//     code, comme les couvertures ailleurs). Les lignes sont ordonnées par leur PLUS PETITE identité.
//     Cet ordre vient des IDENTITÉS, jamais des valeurs : on ne trie pas des valeurs hétérogènes en les
//     convertissant en chaînes, et il ne signifie RIEN (ni qualité, ni fréquence, ni importance, ni
//     dominance) -- seulement la plus petite sortie déterministe honnête. L'ordre des entrées reçues ne
//     change jamais la sortie.
//   - nombreValeurs : valeurs.length.
//   - nonResolus, ambigus : ids triés.
//   AUCUN score, AUCUNE majorité, AUCUN groupe dominant, AUCUNE préférence, AUCUN ordre de qualité,
//   AUCUN choix, AUCUN compte de fréquence séparé (ids.length suffit à qui le voudrait, mais ce n'est
//   PAS une information qualifiée ici). Un seul membre est un cas valide : [{id:"a", valeur:7}] dit
//   seulement « une valeur observée, portée par a » -- ni régularité, ni preuve, ni généralisation, ni
//   confiance.
//
// PURETÉ : ne mute jamais l'entrée (gelée acceptée), ne persiste rien, ne garde aucun état, ne lit rien
// d'extérieur. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique).

function estIdValide(id) {
  return typeof id === 'string' && id.length > 0;
}

function estValeurSupportee(valeur) {
  if (valeur === null || valeur === undefined) return true;
  const type = typeof valeur;
  if (type === 'string' || type === 'boolean') return true;
  return type === 'number' && Number.isFinite(valeur);
}

function decrireType(valeur) {
  if (valeur === null) return 'null';
  if (Array.isArray(valeur)) return 'tableau';
  if (typeof valeur === 'number') return `nombre non fini (${String(valeur)})`;
  return typeof valeur;
}

const trierIds = (ids) => ids.slice().sort();

export function decrireValeursObservees(paires) {
  if (!Array.isArray(paires)) {
    throw new TypeError('decrireValeursObservees : un tableau d\'entrées { id, valeur } est attendu.');
  }

  // 1. Lecture et contrôle de contrat (rien n'est corrigé ni écarté en silence).
  const entreesParId = new Map(); // id -> [{ observee, valeur }]
  paires.forEach((entree, rang) => {
    if (entree === null || typeof entree !== 'object' || Array.isArray(entree)) {
      throw new TypeError(`decrireValeursObservees : l'entrée n°${rang} n'est pas un objet { id, valeur }.`);
    }
    if (!estIdValide(entree.id)) {
      throw new TypeError(`decrireValeursObservees : l'entrée n°${rang} n'a pas d'id valide (chaîne non vide attendue).`);
    }
    const observee = Object.prototype.hasOwnProperty.call(entree, 'valeur');
    if (observee && !estValeurSupportee(entree.valeur)) {
      throw new TypeError(
        `decrireValeursObservees : la valeur de « ${entree.id} » (${decrireType(entree.valeur)}) n'est pas une primitive JSON `
        + '(string, nombre fini, boolean, null ou undefined).',
      );
    }
    if (!entreesParId.has(entree.id)) entreesParId.set(entree.id, []);
    entreesParId.get(entree.id).push({ observee, valeur: observee ? entree.valeur : undefined });
  });

  // 2. Trois états par identité, jamais fusionnés.
  const nonResolus = [];
  const ambigus = [];
  const observees = []; // [{ id, valeur }]
  for (const id of trierIds([...entreesParId.keys()])) {
    const entrees = entreesParId.get(id);
    if (entrees.length > 1) ambigus.push(id);
    else if (!entrees[0].observee) nonResolus.push(id);
    else observees.push({ id, valeur: entrees[0].valeur });
  }

  // 3. Partition par valeur : égalité typée (Map = SameValueZero ; pour les primitives JSON acceptées
  //    elle coïncide avec ===). `observees` est déjà trié par id, donc chaque groupe l'est aussi et
  //    la première apparition d'une valeur est celle de sa plus petite identité.
  const groupes = new Map(); // valeur -> { valeur, ids }
  for (const { id, valeur } of observees) {
    if (!groupes.has(valeur)) groupes.set(valeur, { valeur, ids: [] });
    groupes.get(valeur).ids.push(id);
  }
  const valeurs = [...groupes.values()];

  return { valeurs, nombreValeurs: valeurs.length, nonResolus, ambigus };
}
// === FIN_LANGAGE_VALEURS_OBSERVEES ===
