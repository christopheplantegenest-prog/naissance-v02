// === DEBUT_LANGAGE_INDUCTION ===
// v0.17.5 — MOTEUR D'INDUCTION (ANALYSE UNIQUEMENT). À partir d'exemples POSITIFS et NÉGATIFS déjà
// étiquetés par un humain, propose des hypothèses de GABARITS (même notion qu'en v0.17.4 : une suite
// ordonnée de contraintes {mot} ou {role}) qui expliquent les positifs sans jamais matcher un négatif.
//
// GARDE-FOU, ABSOLU : ce fichier est une fonction PURE et ISOLÉE. Il ne lit ni n'écrit AUCUNE
// connaissance persistante, n'importe ni n'appelle esprit.js, connaissances.js, ecran.js ni cours.js,
// et ne modifie en rien le comportement de comprendre()/repondre(). Il produit uniquement un RAPPORT
// à examiner — voir ARCHITECTURE-IA.md pour l'historique de validation (plusieurs prototypes jetables,
// hors dépôt, avant cette intégration) et la justification précise de chaque règle ci-dessous.
//
// RÈGLES VALIDÉES PAR LES PROTOTYPES, TOUTES APPLIQUÉES ICI :
// - candidats MIXTES mot-exact / rôle-connu à chaque position (ROLES.IGNORE exclu des candidats-rôle :
//   rôle « poubelle » sans valeur discriminante fiable, découvert dangereux dans les prototypes) ;
// - recherche GLOBALE sur tous les positifs restants à chaque tour (jamais une seule graine) ;
// - comparaison par COUVERTURE d'abord (combien de positifs un candidat explique), puis par LONGUEUR
//   (le plus court, à couverture égale — Occam) ; AUCUN autre critère, jamais de départage arbitraire ;
// - à égalité de couverture ET de longueur : regrouper les candidats par leur ENSEMBLE COUVERT exact.
//   Des groupes aux ensembles DISJOINTS ne sont PAS des concurrents (découvert en pratique : deux
//   vraies sous-familles peuvent atteindre la même couverture par coïncidence) → ils coexistent, tous
//   retenus. Un CHEVAUCHEMENT réel (un même positif couvert par deux groupes différents) est un vrai
//   conflit → rapporté explicitement, la découverte s'arrête là, rien n'est tranché automatiquement.
// - à l'intérieur d'un groupe retenu, plusieurs candidats peuvent être des SYNONYMES sur les données
//   actuelles (même ensemble couvert) : aucun n'est éliminé au profit d'un autre, le groupe entier est
//   conservé tel quel.
// - un candidat qui ne couvrirait pas au moins `seuilCouvertureMin` positifs est refusé : jamais une
//   règle construite sur un seul exemple.
// - un positif pour lequel aucun candidat sûr n'existe (ou dont le meilleur reste sous le seuil) est
//   listé comme INEXPLIQUÉ, jamais forcé dans une hypothèse.
import { decouper } from './comprendre.js';
import { ROLES, LEXIQUE_DEPART } from './bagage.js';

function candidatsPosition(exemple, i) {
  const candidats = [{ mot: exemple.mots[i] }];
  if (exemple.roles[i] && exemple.roles[i] !== ROLES.IGNORE) candidats.push({ role: exemple.roles[i] });
  return candidats;
}
function correspond(exemple, i, contrainte) {
  return contrainte.mot ? exemple.mots[i] === contrainte.mot : exemple.roles[i] === contrainte.role;
}
// Exporté : réutilisable pour tester la couverture d'un gabarit hors de la boucle de découverte
// (passeFinale s'en sert, voir plus bas).
export function contientGabarit(exemple, gabarit) {
  for (let i = 0; i + gabarit.length <= exemple.mots.length; i += 1) {
    if (gabarit.every((c, j) => correspond(exemple, i + j, c))) return true;
  }
  return false;
}
export function cleGabarit(gabarit) {
  return gabarit.map((c) => (c.mot ? `mot:${c.mot}` : `role:${c.role}`)).join(' > ');
}
function ngrammesDe(exemple, n) {
  const out = [];
  const vus = new Set();
  for (let i = 0; i + n <= exemple.mots.length; i += 1) {
    const positions = [];
    for (let j = 0; j < n; j += 1) positions.push(candidatsPosition(exemple, i + j));
    let combinaisons = [[]];
    for (const options of positions) combinaisons = combinaisons.flatMap((c) => options.map((o) => [...c, o]));
    for (const gabarit of combinaisons) {
      const cle = cleGabarit(gabarit);
      if (!vus.has(cle)) { vus.add(cle); out.push(gabarit); }
    }
  }
  return out;
}
export function representerExemple(phrase, lexique = LEXIQUE_DEPART) {
  const mots = decouper(phrase);
  return { phrase, mots, roles: mots.map((m) => (lexique[m] ? lexique[m].role : null)) };
}

// Tous les candidats sûrs (jamais présents dans un négatif), avec leur couverture exacte parmi
// `restants`, tirés de n=1 à n=nMax simultanément.
function candidatsEvalues(restants, negatifsRepresentes, nMax) {
  const vus = new Map();
  for (const exemple of restants) {
    for (let n = 1; n <= nMax; n += 1) {
      for (const gabarit of ngrammesDe(exemple, n)) {
        const cle = `${cleGabarit(gabarit)}#${n}`;
        if (!vus.has(cle)) vus.set(cle, { gabarit, n });
      }
    }
  }
  const evalues = [];
  for (const { gabarit, n } of vus.values()) {
    if (negatifsRepresentes.some((neg) => contientGabarit(neg, gabarit))) continue;
    const couverts = restants.filter((p) => contientGabarit(p, gabarit));
    if (couverts.length) evalues.push({ gabarit, n, cle: cleGabarit(gabarit), couv: couverts.length, couverts });
  }
  return evalues;
}

// v0.17.5 — LE MOTEUR. positifs/negatifs : tableaux de PHRASES (texte brut). Ne modifie rien, ne
// persiste rien : { hypotheses, conflits, inexpliques }.
export function induire(positifs, negatifs, { lexique = LEXIQUE_DEPART, seuilCouvertureMin = 2, nMax = 4 } = {}) {
  const negatifsRepresentes = negatifs.map((p) => representerExemple(p, lexique));
  let restants = positifs.map((p) => representerExemple(p, lexique));
  const hypotheses = [];
  const conflits = [];
  const inexpliques = [];

  while (restants.length) {
    const evalues = candidatsEvalues(restants, negatifsRepresentes, nMax);
    if (!evalues.length) { inexpliques.push(...restants.map((p) => p.phrase)); restants = []; break; }

    const couvMax = Math.max(...evalues.map((e) => e.couv));
    if (couvMax < seuilCouvertureMin) { inexpliques.push(...restants.map((p) => p.phrase)); restants = []; break; }

    const auMeilleurCouv = evalues.filter((e) => e.couv === couvMax);
    const nMin = Math.min(...auMeilleurCouv.map((e) => e.n));
    const gagnants = auMeilleurCouv.filter((e) => e.n === nMin);

    // Regrouper les gagnants par ENSEMBLE COUVERT identique.
    const groupes = [];
    for (const g of gagnants) {
      const signature = g.couverts.map((p) => p.phrase).sort().join('|');
      let groupe = groupes.find((x) => x.signature === signature);
      if (!groupe) { groupe = { signature, candidats: [], couverts: g.couverts }; groupes.push(groupe); }
      groupe.candidats.push({ gabarit: g.gabarit, cle: g.cle });
    }

    // Deux groupes se chevauchent-ils réellement (un même positif couvert par les deux) ?
    let chevauchement = false;
    for (let i = 0; i < groupes.length && !chevauchement; i += 1) {
      const ensembleI = new Set(groupes[i].couverts.map((p) => p.phrase));
      for (let j = i + 1; j < groupes.length; j += 1) {
        if (groupes[j].couverts.some((p) => ensembleI.has(p.phrase))) { chevauchement = true; break; }
      }
    }
    if (chevauchement) {
      conflits.push({
        couverture: couvMax,
        longueur: nMin,
        groupes: groupes.map((g) => ({ candidats: g.candidats.map((c) => c.cle), couvre: g.couverts.map((p) => p.phrase) })),
      });
      break; // Conflit réel non résolu : la découverte s'arrête ici, rien n'est tranché seul.
    }

    // Aucun chevauchement : tous les groupes coexistent, chacun devient une hypothèse (avec ses
    // éventuels synonymes conservés tels quels).
    for (const groupe of groupes) {
      hypotheses.push({
        candidats: groupe.candidats.map((c) => c.cle),
        gabarits: groupe.candidats.map((c) => c.gabarit),
        n: nMin,
        couverture: groupe.couverts.map((p) => p.phrase),
      });
    }
    const couvertsPartout = new Set(groupes.flatMap((g) => g.couverts));
    restants = restants.filter((p) => !couvertsPartout.has(p));
  }

  return { hypotheses, conflits, inexpliques };
}

// PASSE FINALE — indépendante de la découverte : reteste CHAQUE positif d'origine contre TOUTES les
// hypothèses retenues (une hypothèse « couvre » un positif si au moins un de ses candidats synonymes
// le matche). Révèle un exemple qui satisferait plusieurs hypothèses à la fois — jamais tranché en
// silence pendant la découverte gloutonne (voir ARCHITECTURE-IA.md, l'exemple-pont qui l'a motivée).
export function passeFinale(positifsOriginaux, hypotheses, { lexique = LEXIQUE_DEPART } = {}) {
  const representes = positifsOriginaux.map((p) => representerExemple(p, lexique));
  return representes.map((exemple) => {
    const couvrantes = hypotheses.filter((h) => h.gabarits.some((g) => contientGabarit(exemple, g)));
    const etat = couvrantes.length === 1 ? 'assigne' : couvrantes.length === 0 ? 'inexplique' : 'ambigu';
    return { phrase: exemple.phrase, etat, hypotheses: couvrantes.map((h) => h.candidats[0]) };
  });
}

// v0.17.10 (B3a) — REPÉRAGE NEUTRE DE MOTIFS RÉCURRENTS. Contrairement à induire(), ne cherche PAS
// à expliquer/couvrir la totalité d'un ensemble de positifs face à des négatifs : CONSTATE
// seulement, pour un ensemble d'expériences B1 (id + texteRecu, jamais l'objet B1 complet, jamais
// de magasin ici — ce module reste pur et isolé), quels motifs structurels apparaissent dans PLUSIEURS
// d'entre elles. Réutilise directement candidatsEvalues()/representerExemple() déjà définies plus
// haut dans ce fichier (negatifsRepresentes = [] : rien n'est filtré, ce qui transforme la fonction
// de sélection existante en pur compteur de récurrences) — AUCUNE primitive dupliquée, AUCUN
// nouvel algorithme de comparaison. AUCUNE heuristique d'importance : un motif trivial très fréquent
// (« est », un rôle générique) a exactement le même droit de figurer dans le rapport qu'un motif rare
// — décider qu'un motif est intéressant, ou comprendre sa signification, restent HORS de portée ici
// (voir ARCHITECTURE-IA.md). Ne crée ni positifs ni négatifs, n'appelle jamais induire() ni
// apprendreGabaritType(), n'écrit rien nulle part.
export function repererMotifs(experiences, { lexique = LEXIQUE_DEPART, seuilMin = 2, nMax = 4 } = {}) {
  const pool = experiences.map((e) => ({ ...representerExemple(e.texteRecu, lexique), id: e.id }));
  const evalues = candidatsEvalues(pool, [], nMax);
  return evalues
    .filter((e) => e.couv >= seuilMin)
    .map((e) => ({ gabarit: e.gabarit, cle: e.cle, couverture: e.couverts.map((c) => c.id) }));
}

// v0.17.13 — RÉPARTITION D'UN MOTIF DÉJÀ CONSTATÉ PAR ÉTAT DE COMPRÉHENSION. Fonction SŒUR de
// repererMotifs(), jamais une modification de celle-ci -- repererMotifs() reste strictement
// ignorante de COMPRIS/PARTIEL/INCOMPRIS, des interprétations B1, du magasin, de l'intérêt et de
// l'apprentissage. Prend en entrée les motifs DÉJÀ produits par repererMotifs() et une table
// id→etat DÉJÀ RÉSOLUE par l'appelant (jamais l'objet expérience complet, jamais le schéma libre des
// interprétations -- cette résolution reste dans app/langage/ecran.js, seul endroit qui connaît ce
// schéma). Ne recalcule aucun motif, ne mute jamais les motifs ni la table reçus, n'écrit rien, ne
// trie ni ne filtre selon les résultats, n'attribue aucun score. Un id absent de la table, ou
// porteur d'une valeur autre que 'compris'/'partiel'/'incompris', est rapporté 'inconnu' -- JAMAIS
// traité implicitement comme 'compris'.
const ETATS_CONNUS = ['compris', 'partiel', 'incompris'];

export function repartirMotifsParEtat(motifs, etatParId) {
  return motifs.map((m) => {
    const parEtat = { compris: [], partiel: [], incompris: [], inconnu: [] };
    for (const id of m.couverture) {
      const etat = etatParId.get(id);
      const categorie = ETATS_CONNUS.includes(etat) ? etat : 'inconnu';
      parEtat[categorie].push(id);
    }
    return { ...m, parEtat };
  });
}

// v0.17.14 — CHRONOLOGIE BRUTE DES ÉTATS DE COMPRÉHENSION D'UN MOTIF DÉJÀ CONSTATÉ. Fonction SŒUR,
// jamais une modification de repererMotifs()/repartirMotifsParEtat() (toutes deux inchangées).
// repererMotifs() = qu'est-ce qui revient ? repartirMotifsParEtat() = dans quels états cela
// apparaît-il ? chronologieMotifs() = dans quel ordre historique ces états ont-ils été vécus ?
// Prend en entrée les motifs DÉJÀ produits et une table id→{date, etat} DÉJÀ RÉSOLUE par
// l'appelant (jamais l'objet expérience complet, jamais le schéma des interprétations -- cette
// résolution reste dans app/langage/ecran.js). Ne recalcule rien, ne mute jamais motifs ni table
// reçus, n'écrit rien nulle part. Regroupe les observations par date EXACTE identique (un seul
// groupe temporel) sans jamais affirmer un ordre entre deux observations de même date -- seule la
// date B1 réelle fait autorité pour l'ordre entre groupes distincts, jamais l'ordre d'entrée de la
// couverture. Une date manquante ou invalide n'est JAMAIS remplacée par l'instant présent : elle
// est rapportée explicitement en dehors de la chronologie, valeur brute conservée telle quelle. Un
// id de couverture absent de la table (expérience introuvable) est également rapporté ainsi, sans
// aucune donnée fabriquée. Ne produit ni score, ni notion de progression/régression/tendance.
function dateValide(date) {
  return typeof date === 'string' && date !== '' && !Number.isNaN(Date.parse(date));
}

export function chronologieMotifs(motifs, infoParId) {
  return motifs.map((m) => {
    const groupes = new Map();
    const nonResolues = [];
    for (const id of m.couverture) {
      const info = infoParId.get(id);
      const date = info ? info.date : undefined;
      const etatBrut = info ? info.etat : undefined;
      if (!dateValide(date)) {
        nonResolues.push({ id, date: date === undefined ? null : date, etat: etatBrut === undefined ? null : etatBrut });
        continue;
      }
      const etat = ETATS_CONNUS.includes(etatBrut) ? etatBrut : 'inconnu';
      if (!groupes.has(date)) groupes.set(date, []);
      groupes.get(date).push({ id, etat });
    }
    const chronologie = [...groupes.entries()]
      .sort(([d1], [d2]) => (d1 < d2 ? -1 : d1 > d2 ? 1 : 0))
      .map(([date, observations]) => ({
        date,
        observations: observations.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      }));
    return { gabarit: m.gabarit, cle: m.cle, couverture: m.couverture, chronologie, nonResolues };
  });
}

// CONSTAT DE VARIATION D'ÉTAT PAR MOTIF. Fonction SŒUR, pure et isolée, jamais une modification de
// repererMotifs()/repartirMotifsParEtat()/chronologieMotifs() (toutes trois inchangées). Prend en
// entrée les motifs DÉJÀ répartis par état (repartirMotifsParEtat(), champ .parEtat déjà calculé)
// et CONSTATE seulement lesquels ont été vécus dans plusieurs états de compréhension distincts (au
// moins deux des quatre catégories compris/partiel/incompris/inconnu non vides) -- rien de plus.
// Un motif toujours compris n'est PAS écarté comme sans intérêt ; un motif variable n'est PAS
// retenu comme important : ce n'est ni un score ni un classement, seulement une frontière logique
// (« au moins deux catégories non vides ») appliquée identiquement à tout motif, sans aucun cas
// particulier linguistique. Aucun seuil réglable, aucun paramètre optionnel. Ne mute jamais les
// motifs reçus (retourne les mêmes objets, inchangés), ne trie pas, conserve l'ordre d'entrée,
// n'écrit rien nulle part, ne recalcule aucune donnée déjà produite par repartirMotifsParEtat().
const CATEGORIES_ETAT = ['compris', 'partiel', 'incompris', 'inconnu'];

export function motifsAvecVariationDEtat(motifsRepartis) {
  return motifsRepartis.filter((m) => {
    const categoriesNonVides = CATEGORIES_ETAT.filter((c) => (m.parEtat[c] || []).length > 0);
    return categoriesNonVides.length >= 2;
  });
}

// COMPARAISON FACTUELLE DES EXPÉRIENCES D'UN MOTIF (étape A, cadrage ChatGPT du 26/09/2026).
// Fonction SŒUR, pure et isolée, jamais une modification de repererMotifs()/
// repartirMotifsParEtat()/chronologieMotifs()/motifsAvecVariationDEtat() (toutes quatre
// inchangées). Prend en entrée les motifs DÉJÀ produits et une table id→{sujet, relation, type,
// motsInconnus} DÉJÀ RÉSOLUE par l'appelant (même contrat que les fonctions sœurs précédentes :
// jamais l'objet expérience complet, cette résolution reste dans app/langage/ecran.js). Pour
// chacun de ces quatre champs séparément, CONSTATE si sa valeur est la même dans toutes les
// expériences couvertes (identique: true) ou si plusieurs valeurs distinctes apparaissent
// (identique: false) -- un simple test d'égalité exacte (JSON.stringify, jamais une comparaison
// sémantique ou d'ensemble), sans dire lesquelles comptent ni pourquoi elles diffèrent. AUCUNE
// cause, AUCUNE signification, AUCUN score, AUCUN tri : chaque champ est rapporté qu'il varie ou
// non, et chaque valeur reste tracée par son id d'expérience d'origine. null est une valeur comme
// une autre (jamais confondue avec une absence). Un id de couverture absent de la table est
// rapporté dans nonResolues, jamais fabriqué ni inclus dans la comparaison. Ne mute jamais les
// motifs reçus, conserve l'ordre d'entrée, n'écrit rien nulle part, ne recalcule aucune donnée
// déjà produite ailleurs.
const CHAMPS_COMPARES = ['sujet', 'relation', 'type', 'motsInconnus'];

export function comparerMotifs(motifs, infoDetailleeParId) {
  return motifs.map((m) => {
    const nonResolues = [];
    const parChamp = {};
    for (const champ of CHAMPS_COMPARES) parChamp[champ] = [];
    for (const id of m.couverture) {
      const info = infoDetailleeParId.get(id);
      if (!info) { nonResolues.push(id); continue; }
      for (const champ of CHAMPS_COMPARES) {
        const valeur = info[champ] === undefined ? null : info[champ];
        parChamp[champ].push({ id, valeur });
      }
    }
    const distinction = {};
    for (const champ of CHAMPS_COMPARES) {
      const clesVues = new Set(parChamp[champ].map((v) => JSON.stringify(v.valeur)));
      distinction[champ] = { identique: clesVues.size <= 1, valeurs: parChamp[champ] };
    }
    return { gabarit: m.gabarit, cle: m.cle, couverture: m.couverture, distinction, nonResolues };
  });
}

// FORMATION D'HYPOTHÈSES SUR UN JUGEMENT EXTÉRIEUR (étape D refondée, décision ChatGPT du
// 26/09/2026, « SIGNAL D'APPRENTISSAGE ») -- REMPLACE l'ancienne formerHypotheses()/
// confronterHypothese() de la tentative précédente (retirées : elles mettaient en relation deux
// sorties SIMULTANÉES du même appel à comprendre() -- un champ et l'état qui en est directement
// dérivé, une règle déjà codée -- jamais une vraie prédiction). Ici, la CONDITION (un motif
// structurel du texte reçu, DÉJÀ repéré par repererMotifs(), qui n'appelle jamais comprendre()) et
// le RÉSULTAT (un JUGEMENT humain, 'correct'/'incorrect', ajouté APRÈS coup, jamais déduit par
// comprendre()/repondre() -- voir connaissances.js, enregistrerJugement()) sont deux informations
// réellement indépendantes, observables à des moments différents. Fonction SŒUR, pure et isolée,
// jamais une modification de repererMotifs()/repartirMotifsParEtat()/chronologieMotifs()/
// motifsAvecVariationDEtat()/comparerMotifs() (toutes cinq inchangées, conservées comme
// infrastructure de constat neutre -- même si elles ne servent plus à former une hypothèse).
// Prend en entrée les motifs DÉJÀ produits par repererMotifs() et une table id→jugement
// ('correct'/'incorrect') DÉJÀ RÉSOLUE par l'appelant (jamais l'objet expérience complet -- cette
// résolution reste dans app/langage/ecran.js). Un id absent de la table (pas encore jugé) n'est
// jamais fabriqué : il est simplement ignoré, ni compté ni exclu comme un refus. Un motif sans
// AUCUN id jugé ne produit aucune hypothèse (rien à observer). PAS DE MAJORITÉ ARBITRAIRE : quand
// tous les jugements disponibles pour ce motif concordent, l'hypothèse porte une attente univoque
// (`attente` égale à ce jugement) ; dès que deux jugements différents coexistent pour le même
// motif, `attente` reste null -- un simple constat qu'aucune attente n'est actuellement justifiée,
// jamais la valeur la plus fréquente. Ne mute jamais motifs ni jugementParId, conserve l'ordre
// d'entrée, n'écrit rien nulle part, n'assigne ni score ni seuil ni notion de confiance.
export function formerHypothesesJugement(motifs, jugementParId) {
  const resultat = [];
  for (const m of motifs) {
    const juges = [];
    for (const id of m.couverture) {
      const jugement = jugementParId.get(id);
      if (jugement === undefined) continue;
      juges.push({ id, jugement });
    }
    if (!juges.length) continue;
    const valeursDistinctes = new Set(juges.map((j) => j.jugement));
    const attente = valeursDistinctes.size === 1 ? juges[0].jugement : null;
    resultat.push({
      id: `hyp:${m.cle}`,
      motifCle: m.cle,
      gabarit: m.gabarit,
      provenance: juges.map((j) => j.id),
      observations: juges,
      attente,
    });
  }
  return resultat;
}

// CONFRONTATION D'UNE ATTENTE DÉJÀ POSÉE AU JUGEMENT RÉEL (étape D/C refondues). Fonction pure,
// isolée, ne mute rien, ne persiste rien (voir connaissances.js pour la persistance). `attendu` est
// l'attente FIGÉE à la formation de l'hypothèse (jamais recalculée ici, jamais réévaluée à partir
// des observations passées) ; `jugementReel` est le jugement humain reçu ensuite pour une nouvelle
// expérience. Aucune attente univoque (`attendu` null) -> 'insuffisant' (rien à confronter, jamais
// fabriqué). Sinon, égalité exacte : même valeur -> 'compatible' ; valeur différente ->
// 'incompatible'. Aucun score, aucune confiance, aucun seuil : une seule différence suffit.
export function confronterAttente(attendu, jugementReel) {
  if (attendu == null) return 'insuffisant';
  return attendu === jugementReel ? 'compatible' : 'incompatible';
}
// === FIN_LANGAGE_INDUCTION ===
