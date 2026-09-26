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
// === FIN_LANGAGE_INDUCTION ===
