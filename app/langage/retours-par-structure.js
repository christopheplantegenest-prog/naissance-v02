// === DEBUT_LANGAGE_RETOURS_PAR_STRUCTURE ===
// ÉTAPE 5.6 — « JONCTION DES STRUCTURES DE TRACE AVEC LEURS RETOURS HUMAINS BRUTS » (décision
// ChatGPT, 03/10/2026, suite au diagnostic 5.5 « QUE PEUT-ON APPRENDRE DE PLUSIEURS CHAÎNES
// TRACE → EXPÉRIENCE → JUGEMENT ? »). PRIMITIVE PURE, READ-ONLY, DORMANTE -- ni un nouveau moteur
// de motifs, ni un nouveau moteur de structure, ni un nouveau moteur de correspondance, ni un
// nouveau moteur de jugement : une JONCTION STRICTE entre deux primitives déjà existantes et
// inchangées :
//   - vueDescriptive(traces) (vue-traces.js) -- fournit la forme structurelle (forme/rapport) et la
//     couverture EXACTE d'ids de traces qu'elle recouvre, déjà restreinte par traceExploitable()
//     (voie 'action' + contexte.texteBrut exploitable, JAMAIS modifiée ici) ;
//   - vueRetoursSurTrace(idTrace, traces, experiences) (retours-traces.js) -- fournit, pour CHAQUE
//     id de cette couverture, l'identité stricte T→E→J déjà établie en 5.4 (égalité stricte de
//     referenceTrace.idTrace, interprétations exposées telles quelles, aucune résolution de
//     contradiction).
// Ce module ne recalcule RIEN de ce que ces deux primitives établissent déjà : il se contente
// d'appeler vueDescriptive() une fois, puis vueRetoursSurTrace() une fois par id de couverture, et
// d'EXTRAIRE, depuis les interpretations déjà exposées, les seuls événements d'origine
// 'jugement-christophe' -- sous forme d'une liste BRUTE, jamais un compte agrégé.
//
// NON BRANCHÉE : ce module n'est importé par AUCUN autre fichier du dépôt à ce stade (voir le test
// statique correspondant). Définition + tests seulement, comme demandé par le cadrage.
//
// AUCUNE SÉMANTIQUE DE RÉCOMPENSE (section 11 du cadrage) : 'correct'/'incorrect' restent
// exactement les valeurs persistées par enregistrerJugement() (connaissances.js) -- jamais
// converties en positif/négatif/succès/échec/bon/mauvais/utile. AUCUN COMPTE AGRÉGÉ (section 10) :
// pas de {correct:n, incorrect:n}, pas de majorité, pas de ratio, pas de fréquence, pas de score,
// pas de confiance, pas de préférence, pas d'attente, pas de verdict -- seulement une liste
// d'événements individuels, pour ne jamais perdre l'identité de chaque observation (y compris deux
// observations strictement identiques, voir contre-exemple T).
//
// PÉRIMÈTRE STRUCTUREL (section 3 du cadrage) : l'univers de départ est exactement celui de
// vueDescriptive() -- seules les traces voie='action' avec contexte exploitable participent à la
// découverte de forme. Une trace 'rejeu' ou 'composition' référencée par une expérience reste
// PARFAITEMENT décrite par vueRetoursSurTrace() appelée directement (5.4, non affectée), mais
// n'apparaît jamais dans la couverture d'un élément produit ici -- traceExploitable() n'est ni
// importée, ni modifiée, ni contournée par ce fichier.
//
// RÉSULTAT DE TRACE / CAPACITÉ / ARGUMENTS (sections 12/13) : jamais comparés, jamais utilisés comme
// un critère de regroupement supplémentaire -- le SEUL regroupement de ce chantier reste celui déjà
// produit par vueDescriptive() (couverture de forme). Deux formes partageant capacite/
// argumentsUtilises/resultat identiques restent deux éléments distincts (contre-exemples O/P/Q) :
// cette primitive ne lit jamais ces champs pour décider d'une fusion.
//
// NE PAS UTILISER « DERNIER JUGEMENT » (section 7) : aucune fonction de ce fichier n'appelle
// dernierJugementParExperience() ni logique équivalente -- TOUTES les interprétations
// 'jugement-christophe' de chaque expérience sont examinées, jamais une seule retenue.
//
// ÉVÉNEMENTS BRUTS, COMPORTEMENT CONSERVATEUR (section 6/16-X) : chaque interprétation d'origine
// 'jugement-christophe' devient un événement {idTrace, idExperience, jugement, date} -- SES VALEURS
// EXACTES, jamais corrigées ni fabriquées, même si `donnees` est absent, ou si `jugement`/`date` ne
// sont pas des valeurs réellement exploitables (donnees.jugement et donnees.date valent alors
// `undefined`, jamais une valeur par défaut inventée). Jamais de throw, jamais de filtrage de cette
// anomalie : le même principe de prudence que decrirePositionsRoles()/construireArgumentsPresents()
// (vue-traces.js), qui rapportent une anomalie plutôt que de la masquer ou de la corriger.
//
// ORDRE DÉTERMINISTE DES ÉVÉNEMENTS (section 14) : date croissante (comparaison de chaîne, cohérente
// avec vueRetoursSurTrace()), puis idExperience croissant, puis POSITION RÉELLE dans le tableau
// interpretations de l'expérience (pour ne jamais perdre deux jugements de même date sur la même
// expérience -- contre-exemple dédié). Une date non comparable (undefined, non-chaîne) est traitée
// comme la plus grande valeur possible (triée en dernier, jamais favorisée) -- décision défensive
// minimale, jamais une politique de validation de date comme ailleurs dans l'architecture (cette
// primitive ne valide ni ne rejette un jugement malformé, elle l'expose).
import { vueDescriptive } from './vue-traces.js';
import { vueRetoursSurTrace } from './retours-traces.js';

function cleDateTriable(date) {
  // Une date exploitable (chaîne) se compare lexicographiquement comme vueRetoursSurTrace() le fait
  // déjà. Une date non exploitable (undefined, non-chaîne) est renvoyée à la fin, jamais comparée
  // comme si elle valait "" (ce qui l'aurait artificiellement favorisée en tête de liste).
  return typeof date === 'string' ? date : '￿￿￿￿-non-exploitable';
}

function comparerEvenements(a, b) {
  const da = cleDateTriable(a.date);
  const db = cleDateTriable(b.date);
  if (da < db) return -1;
  if (da > db) return 1;
  if (a.idExperience < b.idExperience) return -1;
  if (a.idExperience > b.idExperience) return 1;
  return a._position - b._position;
}

function evenementsDe(idTrace, retour) {
  const evenements = [];
  for (const exp of retour.experiences) {
    exp.interpretations.forEach((interp, position) => {
      if (interp.origine !== 'jugement-christophe') return;
      const donnees = interp.donnees || {};
      evenements.push({
        idTrace, idExperience: exp.id, jugement: donnees.jugement, date: donnees.date, _position: position,
      });
    });
  }
  return evenements;
}

export function vueRetoursParStructure(traces, experiences, options = {}) {
  const elements = vueDescriptive(traces, options);
  return elements.map((element) => {
    const traceEntries = element.couverture.map((idTrace) => {
      const retour = vueRetoursSurTrace(idTrace, traces, experiences);
      return { idTrace, etat: retour.etat, trace: retour.trace, experiences: retour.experiences };
    });

    const evenements = traceEntries
      .flatMap((entree) => evenementsDe(entree.idTrace, entree))
      .sort(comparerEvenements)
      .map(({ idTrace, idExperience, jugement, date }) => ({ idTrace, idExperience, jugement, date }));

    return {
      forme: element.forme,
      rapport: element.rapport,
      couverture: element.couverture,
      traces: traceEntries,
      evenements,
    };
  });
}
// === FIN_LANGAGE_RETOURS_PAR_STRUCTURE ===
