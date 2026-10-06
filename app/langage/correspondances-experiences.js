// === DEBUT_LANGAGE_CORRESPONDANCES_EXPERIENCES ===
// v0.63.66 — « CONSTATER LES CORRESPONDANCES ENTRE POSSIBILITÉS PRÉSENTES ET EXPÉRIENCES PASSÉES » (décision ChatGPT, 06/10/2026). VUE PURE, DORMANTE, QUI NE CHOISIT RIEN.
// Elle répond à UNE seule question :
//
//   « cette application (déterminée) ou cette combinaison candidate (d'un choix) PRÉSENTE possède-t-elle une structure d'entrée DÉJÀ RENCONTRÉE dans une
//     exécution réussie PASSÉE de la même opération ? »
//
// correspondancesExperiences(observation, descriptions, univers, historique) -> { applications, refusees }
//   PRÉSENT : observation (la ligne d'observation du tour), descriptions (le catalogue présenté), univers (l'univers RÉEL du même tour : [{ donnee: { identite, forme }, ... }]).
//     Les applications sont celles que classerCombinaisons (v0.63.61, la classification EXISTANTE, jamais refaite) distingue : une combinaison valide unique = application DÉTERMINÉE ;
//     plusieurs combinaisons valides, ou plusieurs combinaisons sans relation = les COMBINAISONS d'un choix (le produit des candidats, qui n'est pas matérialisé ailleurs, est
//     énuméré ici, entrée collective = son ensemble complet, comme partout). Rien n'est reclassé, filtré, ni choisi : applicationsSollicitables et choixAFaire sont inchangés.
//   PASSÉ : historique = la SORTIE de la vue historique (v0.63.64/.65) { experiences, refusees }, fournie par l'appelant ; ce module ne la calcule ni ne la reconstruit
//     (aucune seconde reconstruction de l'histoire). Seules ses `experiences` (acceptées avec garantie) peuvent correspondre ; ses `refusees` ne correspondent jamais et sont RELAYÉES.
//
// UNITÉ DE COMPARAISON : une application ACTUELLE COMPLÈTE face à une expérience PASSÉE COMPLÈTE. Le couplage entre rôles est préservé : jamais de comparaison rôle par rôle
// indépendante, jamais de recombinaison (A=chaîne,B=chaîne et A=nombre,B=nombre ne forment pas A=chaîne,B=nombre).
//
// CORRESPONDANCE EXACTE DES FORMES DÉCLARÉES (définition complète). Une expérience passée E correspond à une application actuelle P si et seulement si :
//   1. E.operation === P.operation (aucune analogie entre opérations) ;
//   2. les mêmes RÔLES d'entrée (ensemble égal, même nombre) ;
//   3. pour chaque rôle, la même NATURE : ordinaire (une donnée) ou collective (un ensemble de données) ;
//   4. rôle ordinaire : la forme DÉCLARÉE de la donnée présente est EXACTEMENT égale (égalité structurelle, l'ordre des clés n'a aucun sens) à celle de la donnée passée ;
//   5. rôle collectif : le MULTI-ENSEMBLE des formes déclarées des données liées est exactement égal. L'ordre des identités d'une liaison collective n'a aucun sens (le magasin
//      la canonise) et des identités passées et présentes diffèrent de toute façon : on compare donc les formes canoniques triées, jamais l'ordre accidentel. Un doublon compte
//      (chaîne, nombre, nombre) ne correspond pas à (chaîne, nombre). La structure préservée (une forme par donnée liée) reste visible dans la sortie.
//   Ni « proche », ni score, ni sous-typage, ni garantie asymétrique (une forme qui en garantit une autre sans lui être égale NE correspond PAS). Les IDENTITÉS ne participent PAS
//   à l'égalité : message-1 (passé) et message-2 (présent) de même forme déclarée correspondent ; l'identité dit seulement QUELLE application et QUELLE expérience sont reliées.
// FORMES ACTUELLES : la forme DÉCLARÉE de chaque donnée liée est lue sur l'élément de l'univers actuel qui porte son identité (jamais typeof, jamais la valeur) ; une identité
//   absente de l'univers ou portée deux fois est un TypeError (jamais une forme devinée).
//
// SORTIE (nouveaux objets, rien n'est partagé avec les entrées ; jamais persistée) :
//   applications : une entrée PAR application actuelle ou combinaison candidate, avec ou sans correspondance (une application sans correspondance n'est NI invalide NI rejetée :
//     elle a zéro correspondance), dans l'ordre de classerCombinaisons (opérations canoniques) puis de l'énumération des combinaisons ; cet ordre n'a aucune signification :
//     { operation, statut: 'determinee' | 'candidate', liaisons, correspondances }
//     liaisons : les liaisons ACTUELLES exactes, avec les formes comparées : { entree, donnee, forme } ou { entree, donnees: [ { donnee, forme }, ... ] } (triées par rôle, puis par identité) ;
//     correspondances : UNE entrée PAR expérience passée correspondante, jamais fusionnée, jamais comptée (quatre expériences identiques = quatre faits) :
//       { idExecution, idDesignation, idObservation, origine, entrees } (entrees = la structure passée telle que la vue historique la rend), dans l'ordre de `experiences`.
//   refusees : copie des `refusees` de l'historique, sans réinterprétation. Une expérience refusée ne correspond jamais.
//   « Déjà rencontré sous cette forme » = correspondances non vide ; « jamais rencontré » = correspondances vide : une ABSENCE de correspondance, rien de plus (aucune catégorie « nouveau »).
//   La ou les origines (`mecanique`, `exterieure`) sont des FAITS conservés, jamais pondérés.
//
// NE FAIT PAS : choisir, préférer, scorer, compter une fréquence, dédupliquer, filtrer choixAFaire, exécuter, désigner, persister. PURETÉ : synchrone, déterministe, sans magasin,
// horloge, hasard, identité générée, état global ; aucune entrée n'est modifiée. Entrée mal formée : TypeError. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier
// (gardé par un test statique) ; seules des sondes et des tests l'appellent.
import { classerCombinaisons } from './applications-sollicitables.js';
import { groupesDeCandidats } from './groupes-candidats.js';

const NOM = 'correspondancesExperiences';
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const copierForme = (forme) => JSON.parse(JSON.stringify(forme));

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur : une donnée est attendue`);
  return place.value;
}

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function exigerObjet(candidat, nom) {
  if (candidat === null || typeof candidat !== 'object' || Array.isArray(candidat)) refuser(`${nom} doit être un objet`);
  return candidat;
}

function exigerTableau(candidat, nom) {
  if (!Array.isArray(candidat)) refuser(`${nom} doit être un tableau`);
  return candidat;
}

function chaineNonVide(candidat, nom) {
  if (typeof candidat !== 'string' || candidat.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return candidat;
}

function exigerCles(objet, attendues, nom) {
  const cles = Reflect.ownKeys(objet);
  if (cles.length !== attendues.length || !attendues.every((cle) => cles.includes(cle))) refuser(`${nom} doit porter exactement ${attendues.join(', ')}`);
}

// Égalité structurelle EXACTE des formes : représentation canonique (clés triées par unités de code, tableaux dans l'ordre), comparée en chaîne.
function canonique(candidat) {
  if (candidat === null || typeof candidat !== 'object') return JSON.stringify(candidat);
  if (Array.isArray(candidat)) return `[${candidat.map(canonique).join(',')}]`;
  return `{${Object.keys(candidat).sort(comparer).map((cle) => `${JSON.stringify(cle)}:${canonique(candidat[cle])}`).join(',')}}`;
}

// Entrées d'une expérience historique (structure de la vue historique) : [{ entree, donnee, forme } | { entree, donnees: [{ donnee, forme }] }], validée puis copiée.
function lireEntreesHistoriques(candidat, nom) {
  exigerTableau(candidat, nom);
  if (candidat.length === 0) refuser(`${nom} doit contenir au moins une entrée`);
  const roles = new Set();
  return candidat.map((brute, rang) => {
    const nomEntree = `${nom}[${rang}]`;
    const entree = exigerObjet(lireRang(candidat, rang, nom), nomEntree);
    const collective = Reflect.ownKeys(entree).includes('donnees');
    exigerCles(entree, collective ? ['entree', 'donnees'] : ['entree', 'donnee', 'forme'], nomEntree);
    const role = chaineNonVide(lirePropre(entree, 'entree', nomEntree), `${nomEntree}.entree`);
    if (roles.has(role)) refuser(`${nom} : le rôle « ${role} » figure deux fois`);
    roles.add(role);
    if (!collective) {
      return { entree: role, donnee: chaineNonVide(lirePropre(entree, 'donnee', nomEntree), `${nomEntree}.donnee`), forme: copierForme(exigerObjet(lirePropre(entree, 'forme', nomEntree), `${nomEntree}.forme`)) };
    }
    const donnees = exigerTableau(lirePropre(entree, 'donnees', nomEntree), `${nomEntree}.donnees`);
    if (donnees.length === 0) refuser(`${nomEntree}.donnees doit contenir au moins une donnée`);
    return {
      entree: role,
      donnees: donnees.map((_, k) => {
        const nomDonnee = `${nomEntree}.donnees[${k}]`;
        const element = exigerObjet(lireRang(donnees, k, `${nomEntree}.donnees`), nomDonnee);
        exigerCles(element, ['donnee', 'forme'], nomDonnee);
        return { donnee: chaineNonVide(lirePropre(element, 'donnee', nomDonnee), `${nomDonnee}.donnee`), forme: copierForme(exigerObjet(lirePropre(element, 'forme', nomDonnee), `${nomDonnee}.forme`)) };
      }),
    };
  });
}

function lireHistorique(historique) {
  exigerObjet(historique, 'historique');
  const brutes = exigerTableau(lirePropre(historique, 'experiences', 'historique'), 'historique.experiences');
  const refusees = exigerTableau(lirePropre(historique, 'refusees', 'historique'), 'historique.refusees');
  const experiences = brutes.map((_, rang) => {
    const nom = `historique.experiences[${rang}]`;
    const experience = exigerObjet(lireRang(brutes, rang, 'historique.experiences'), nom);
    exigerCles(experience, ['idExecution', 'idDesignation', 'idObservation', 'operation', 'origine', 'entrees'], nom);
    const lu = {};
    for (const champ of ['idExecution', 'idDesignation', 'idObservation', 'operation', 'origine']) lu[champ] = chaineNonVide(lirePropre(experience, champ, nom), `${nom}.${champ}`);
    return { ...lu, entrees: lireEntreesHistoriques(lirePropre(experience, 'entrees', nom), `${nom}.entrees`) };
  });
  const refus = refusees.map((_, rang) => {
    const nom = `historique.refusees[${rang}]`;
    const ligne = exigerObjet(lireRang(refusees, rang, 'historique.refusees'), nom);
    exigerCles(ligne, ['idExecution', 'operation', 'raison', 'detail'], nom);
    const lu = {};
    for (const champ of ['idExecution', 'operation', 'raison', 'detail']) lu[champ] = chaineNonVide(lirePropre(ligne, champ, nom), `${nom}.${champ}`);
    return lu;
  });
  return { experiences, refusees: refus };
}

// Formes déclarées de l'univers actuel : identité -> forme (copie). Identité absente ou dupliquée : TypeError.
function formesDeLUnivers(univers) {
  exigerTableau(univers, 'univers');
  const formes = new Map();
  for (let rang = 0; rang < univers.length; rang += 1) {
    const nom = `univers[${rang}]`;
    const donnee = exigerObjet(lirePropre(exigerObjet(lireRang(univers, rang, 'univers'), nom), 'donnee', nom), `${nom}.donnee`);
    const identite = chaineNonVide(lirePropre(donnee, 'identite', `${nom}.donnee`), `${nom}.donnee.identite`);
    if (formes.has(identite)) refuser(`univers : l'identité « ${identite} » figure deux fois`);
    formes.set(identite, copierForme(exigerObjet(lirePropre(donnee, 'forme', `${nom}.donnee`), `${nom}.donnee.forme`)));
  }
  return formes;
}

// Toutes les combinaisons (une donnée par entrée ordinaire, l'ensemble complet pour une entrée collective) d'un groupe de candidats. Même règle que le reste du dépôt.
function combinaisonsDuGroupe(entrees) {
  return entrees.reduce((resultat, entree) => {
    const choix = entree.collectif === true ? [{ entree: entree.entree, donnees: [...entree.donnees] }] : entree.donnees.map((donnee) => ({ entree: entree.entree, donnee }));
    const suite = [];
    for (const debut of resultat) for (const liaison of choix) suite.push([...debut, liaison]);
    return suite;
  }, [[]]);
}

function liaisonsAvecFormes(liaisons, formes) {
  const forme = (identite) => {
    if (!formes.has(identite)) refuser(`la donnée liée « ${identite} » n'est pas dans l'univers`);
    return copierForme(formes.get(identite));
  };
  return liaisons.map((liaison) => (liaison.donnees === undefined
    ? { entree: liaison.entree, donnee: liaison.donnee, forme: forme(liaison.donnee) }
    : { entree: liaison.entree, donnees: [...liaison.donnees].sort(comparer).map((donnee) => ({ donnee, forme: forme(donnee) })) }))
    .sort((a, b) => comparer(a.entree, b.entree));
}

// Signature de comparaison : rôles triés, nature, formes canoniques (ordinaire : une forme ; collectif : formes triées = multi-ensemble). Les identités n'y figurent pas.
function signature(entrees) {
  return JSON.stringify([...entrees].sort((a, b) => comparer(a.entree, b.entree)).map((e) => (e.donnees === undefined
    ? [e.entree, 'ordinaire', canonique(e.forme)]
    : [e.entree, 'collective', e.donnees.map((d) => canonique(d.forme)).sort(comparer)])));
}

export function correspondancesExperiences(observation, descriptions, univers, historique) {
  exigerTableau(descriptions, 'descriptions');
  const formes = formesDeLUnivers(univers);
  const passe = lireHistorique(historique);
  const signatures = passe.experiences.map((experience) => ({ experience, signature: signature(experience.entrees) }));

  // PRÉSENT : classification existante (jamais refaite) ; les groupes de candidats ne servent qu'à énumérer les combinaisons d'un choix non encore matérialisées.
  const classes = classerCombinaisons(observation, descriptions, univers);
  const groupes = groupesDeCandidats(lirePropre(observation, 'possibilites', 'observation'), descriptions);
  const presentes = [];
  for (const classe of classes) {
    if (classe.valides !== null && classe.valides.length === 0) continue;
    const statut = classe.valides !== null && classe.valides.length === 1 ? 'determinee' : 'candidate';
    const combinaisons = classe.valides !== null ? classe.valides : combinaisonsDuGroupe(groupes.find((groupe) => groupe.operation === classe.operation).entrees);
    for (const liaisons of combinaisons) presentes.push({ operation: classe.operation, statut, liaisons });
  }

  const applications = presentes.map(({ operation, statut, liaisons }) => {
    const actuelles = liaisonsAvecFormes(liaisons, formes);
    const attendue = signature(actuelles);
    const correspondances = signatures
      .filter((s) => s.experience.operation === operation && s.signature === attendue)
      .map(({ experience }) => ({
        idExecution: experience.idExecution,
        idDesignation: experience.idDesignation,
        idObservation: experience.idObservation,
        origine: experience.origine,
        entrees: copierForme(experience.entrees),
      }));
    return { operation, statut, liaisons: actuelles, correspondances };
  });
  return { applications, refusees: passe.refusees };
}
// === FIN_LANGAGE_CORRESPONDANCES_EXPERIENCES ===
