// === DEBUT_LANGAGE_VUE_TRACES ===
// PRIMITIVE PURE DE RÉEXAMEN DESCRIPTIF DES TRACES (décision ChatGPT « PRIMITIVE PURE DE RÉEXAMEN
// DES TRACES », 03/10/2026, implémentant le contrat figé par le diagnostic « CONTRAT DU RÉEXAMEN
// DESCRIPTIF DES TRACES » du même jour). AUCUNE écriture IndexedDB ici, AUCUN branchement : ce
// module prend directement un TABLEAU de traces déjà lu par l'appelant, et ne fait QUE recomposer
// repererMotifs() (induction.js) et decrireStructure() (extraction.js), déjà existantes, sur ce
// tableau. Pas de nouvel algorithme de découverte -- seulement une CANONISATION honnête de leur
// résultat, pour permettre une comparaison avant/après sans jamais inventer une identité temporelle
// persistante de régularité (voir le diagnostic « IDENTITÉ TEMPORELLE DES RÉGULARITÉS », qui a déjà
// démontré cette identité non identifiable depuis le texte seul).
//
// NON BRANCHÉ : ce module n'est importé par AUCUN autre fichier du dépôt à ce stade. Il n'est appelé
// par aucun mécanisme spontané (ni vecu.js, ni ecran.js, ni main.js) : une primitive pure, vérifiée,
// prête à être utilisée plus tard SI un consommateur réel est un jour spécifié -- jamais avant.
import { repererMotifs } from './induction.js';
import { decrireStructure } from './extraction.js';
import { tokeniser } from './transformation.js';
import { CAPACITES } from './registre.js';

// CORPUS EXACT (section 2 du diagnostic) : une trace n'est exploitable pour la structure pré-choix
// que si elle vient de la voie 'action' (reconnaissance naturelle en conversation) ET possède
// réellement un contexte pré-choix exploitable. Trois états distincts et déjà rencontrés dans le
// dépôt réel (connaissances.js, enregistrerTrace()) : champ `contexte` absent (ancienne trace,
// v0.46.1) ; `contexte === null` (voie 'composition', aucun contexte pré-choix n'existe pour cette
// voie par nature) ; `{texteBrut, tokens}` (voie 'action', les deux toujours écrits ensemble). Seul
// ce troisième état est exploitable. `texteBrut` est la SEULE source utilisée : repererMotifs() et
// decrireStructure() prennent des PHRASES BRUTES, jamais des tableaux de jetons déjà découpés --
// `contexte.tokens` n'est donc simplement pas un type d'entrée que ces fonctions acceptent.
export function traceExploitable(trace) {
  return trace.voie === 'action' && trace.contexte != null && typeof trace.contexte.texteBrut === 'string';
}

// SIGNATURE DE FORME (section 4/9 du diagnostic) : ancres + positions variables + ENSEMBLE trié des
// valeurs distinctes par position variable -- jamais occurrences/exemplesDistincts (axe de
// fréquence, délibérément séparé par decrireStructure() lui-même : « un groupe de répétitions
// identiques produit nombre=1 à chaque position variable ... même si occurrences est élevé »).
// Ordre déterministe partout (tri explicite) : l'ordre accidentel des motifs ou des tableaux ne doit
// jamais influencer cette signature.
function signatureForme(rapport) {
  const ancres = rapport.ancres.map((a) => `${a.position}:${a.jeton}`).sort().join(',');
  const positions = rapport.positionsVariables.slice().sort((a, b) => a - b);
  const diversite = positions
    .map((p) => `${p}=[${rapport.diversite[p].valeursDistinctes.slice().sort().join('|')}]`)
    .join(';');
  return `n=${rapport.n}::ancres(${ancres})::varPos(${positions.join(',')})::diversite(${diversite})`;
}

// DÉDOUBLONNAGE — PAR COUVERTURE EXACTE, JAMAIS PAR FORME SEULE (section 14, tentative de
// réfutation). Le diagnostic proposait initialement de condenser directement par signature de forme
// (« puisque la forme découle de la couverture, une seule clé suffit »). Cette implication n'est
// vraie que dans un sens : couverture identique => forme identique (decrireStructure() est une
// fonction pure des textes couverts), mais PAS l'inverse. Contre-exemple RÉEL ET REPRODUCTIBLE
// construit pendant ce chantier (voir tests/vue-traces.test.mjs) : un corpus avec des répétitions
// exactes peut faire coexister deux couvertures de tailles différentes (ex. {a,b} et {a,b,e,f} où
// e,f dupliquent a,b) dont la diversité -- un ENSEMBLE de valeurs, insensible aux doublons -- est
// identique. Fusionner par forme perdrait alors une couverture réellement différente. La
// déduplication retenue ici porte donc sur la couverture triée (identité stricte), jamais sur la
// forme : si deux motifs de départ différents (ex. "zaccede" et "zordre") couvrent EXACTEMENT le
// même ensemble de traces, un seul élément suffit (strictement sans perte, puisque leur rapport sera
// par construction identique) ; si leur couverture diffère même d'un seul id, les deux restent des
// éléments séparés, quelle que soit leur forme.
function cleCouverture(couverture) {
  return couverture.slice().sort().join('\u0001');
}

// VUE DESCRIPTIVE (section 3/4/5 du diagnostic) : l'ensemble des éléments {couverture, forme,
// rapport} que repererMotifs()+decrireStructure() permettent de décrire sur le corpus EXPLOITABLE
// donné -- rien d'autre. AUCUNE borne de corpus (section 3 : aucune borne analogue à
// LIMITE_POOL_RECENT=50 n'est justifiée pour les traces ; le coût mesuré reste négligeable à
// plusieurs milliers d'éléments). AUCUNE option seuilMin/nMax par défaut redéfinie ici : on réutilise
// tel quel les valeurs par défaut réelles de repererMotifs() (seuilMin=2, nMax=4, induction.js) --
// aucune constante dupliquée. Une vue n'est PAS une hypothèse, une proposition, une connaissance, une
// action, ni une identité temporelle : seulement le résultat déterministe d'une observation d'un
// corpus donné, à l'instant où cette fonction est appelée, jamais conservée après son retour.
export function vueDescriptive(traces, options = {}) {
  const corpus = traces
    .filter(traceExploitable)
    .map((t) => ({ id: t.id, texteRecu: t.contexte.texteBrut }));
  const motifs = repererMotifs(corpus, options);
  const parCouverture = new Map();
  for (const motif of motifs) {
    const cle = cleCouverture(motif.couverture);
    if (parCouverture.has(cle)) continue;
    const textesCouverts = motif.couverture.map((id) => corpus.find((c) => c.id === id).texteRecu);
    const rapport = decrireStructure(textesCouverts);
    // Contre-exemple RÉEL trouvé pendant la tentative de réfutation (section 14) : un motif n=1,
    // position-agnostique, peut couvrir des textes de LONGUEURS DIFFÉRENTES (ex. "zaccede zorbo
    // zordre zkelmi" et "zaccede zalpha" partagent "zaccede" sans avoir la même arité) --
    // decrireStructure() renvoie alors {ok:false, raison:'arites_incompatibles'}. Cet élément est
    // honnêtement exclu de la vue (rien n'est descriptible ici), jamais remonté comme une erreur ni
    // comme un élément à moitié renseigné.
    if (!rapport.ok) continue;
    parCouverture.set(cle, { couverture: motif.couverture.slice().sort(), forme: signatureForme(rapport), rapport });
  }
  // Ordre de sortie DÉTERMINISTE (trié par couverture), jamais l'ordre d'insertion accidentel du Map
  // ci-dessus (qui dépend lui-même de l'ordre dans lequel repererMotifs() a rencontré les motifs,
  // donc indirectement de l'ordre du tableau `traces` reçu) : l'ordre des traces en entrée ne doit
  // jamais changer la vue retournée.
  return [...parCouverture.keys()].sort().map((cle) => parCouverture.get(cle));
}

function signaturesDeFormeDe(vue) {
  return new Set(vue.map((e) => e.forme));
}

// ÉGALITÉ ENTRE DEUX VUES (section 6/9 du diagnostic) : l'ENSEMBLE des signatures de FORME est
// identique -- ordre indépendant, aucune identité de couverture/id requise ici (une répétition
// supplémentaire d'un motif déjà formé change la couverture d'un élément sans changer sa forme : voir
// t8 dans les tests). C'est délibérément PLUS LÂCHE que l'égalité de couverture utilisée pour le
// dédoublonnage ci-dessus -- les deux répondent à des questions différentes (section 5 vs section 9).
function memesSignaturesDeForme(vueA, vueB) {
  const sA = signaturesDeFormeDe(vueA);
  const sB = signaturesDeFormeDe(vueB);
  if (sA.size !== sB.size) return false;
  for (const s of sA) if (!sB.has(s)) return false;
  return true;
}

// RÉEXAMEN PUR (section 6/7/11 du diagnostic) : reconstruit, DANS LE MÊME APPEL, la vue avant/après
// l'arrivée de la trace `idNouvelleTrace` -- par simple exclusion de cet id du tableau reçu, JAMAIS
// par "sequence" (compteur de processus, non globalement persistant, connaissances.js) ni par
// "horodatage". Aucun état conservé entre deux appels : fonctionne identiquement après un redémarrage.
// `idNouvelleTrace` est censé désigner un élément RÉELLEMENT présent dans `traces` (même contrat que
// apresNouveauVecu() : un appelant qui vient de persister cette trace connaît déjà son id) -- un id
// qui ne correspond à AUCUNE trace du tableau reçu est une erreur de programmation, rejetée tout de
// suite (même principe que apresNouveauVecu() rejetant un type inconnu, vecu.js), jamais absorbée en
// silence sous une sémantique choisie au hasard.
// Retour minimal (section 11) : { modifie, apres } -- jamais "avant" (aucun consommateur n'en a
// aujourd'hui besoin ; la vue avant reste calculable à la demande, cette fonction étant pure), jamais
// un delta complexe.
export function reexaminerTraces(traces, idNouvelleTrace, options = {}) {
  if (!traces.some((t) => t.id === idNouvelleTrace)) {
    throw new Error(`« ${idNouvelleTrace} » ne correspond à aucune trace du corpus reçu.`);
  }
  const avant = traces.filter((t) => t.id !== idNouvelleTrace);
  const vueApres = vueDescriptive(traces, options);
  const vueAvant = vueDescriptive(avant, options);
  return { modifie: !memesSignaturesDeForme(vueAvant, vueApres), apres: vueApres };
}

// COOCCURRENCE SITUATION-ACTION (décision ChatGPT « PRIMITIVE PURE DE COOCCURRENCE SITUATION-ACTION »,
// 03/10/2026, implémentant le contrat figé par le diagnostic « CONTRAT DES COOCCURRENCES
// SITUATION-ACTION » du même jour). Reste DESCRIPTIF ET RÉTROSPECTIF uniquement : AUCUNE règle,
// AUCUNE association apprise, AUCUNE attente, AUCUN choix, AUCUN score, AUCUNE confiance, AUCUNE
// préférence, AUCUNE notion de pertinence ou d'intention.
//
// SOURCE UNIQUE DE LA FORME (section 1 du diagnostic) : vueDescriptive() est réutilisée DIRECTEMENT,
// jamais recalculée -- aucun nouvel appel à repererMotifs()/decrireStructure(), aucune nouvelle
// notion de couverture ou de signature de forme. La forme et sa couverture viennent exclusivement de
// vueDescriptive(), donc du même corpus EXPLOITABLE qu'elle (traceExploitable() : voie 'action' +
// contexte.texteBrut valide -- composition et anciennes traces sans contexte restent exclues, sans
// aucun filtre supplémentaire ici).
//
// ENRICHISSEMENT POSTÉRIEUR (section 3) : pour chaque élément déjà découvert par vueDescriptive(),
// on relit, APRÈS cette découverte structurelle, le champ capacite des traces de sa couverture --
// jamais avant, jamais pour influencer la découverte elle-même. AUCUNE lecture de trace.resultat, ni
// de argumentsUtilises/provenanceArguments/sequence/horodatage (section 9) : seul l'id (pour
// retrouver la trace) et capacite (pour l'enrichir) sont utilisés.
//
// CAPACITÉ VALIDE (section 4) : typeof capacite === 'string' && capacite.length > 0. Une capacité
// invalide (vide, absente, non-chaîne) n'est : ni comptée, ni remplacée par une valeur fabriquée
// telle que « inconnue » (ce serait inventer une information descriptive qui n'existe pas -- même
// discipline que traceExploitable() et le filtre arités_incompatibles de vueDescriptive(), qui
// excluent silencieusement plutôt que d'inventer), ni rejetée par une erreur (une capacité malformée
// est une anomalie de DONNÉE reçue, jamais une violation de contrat par l'appelant -- contrairement à
// l'id inconnu de reexaminerTraces() ci-dessus). Elle est simplement exclue du comptage, et cette
// exclusion est rapportée séparément (excluesCapaciteInvalide), jamais absorbée en silence dans un
// total. AUCUNE vérification d'appartenance à CAPACITES (registre actuel des opérations internes) :
// une trace décrit historiquement ce qui a été enregistré à l'époque, pas la légitimité actuelle de
// cette capacité.
//
// FRÉQUENCE ET DÉTERMINISME (sections 5/6) : occurrences par capacité conservé comme un COMPTE BRUT
// -- jamais transformé en ratio, pourcentage, confiance, majorité ou « capacité dominante ». Les
// capacités sont triées par leur NOM (ordre alphabétique), jamais par fréquence décroissante, pour
// qu'aucun classement implicite de préférence ne puisse être lu dans l'ordre du tableau retourné.
//
// PLUSIEURS CAPACITÉS / PLUSIEURS FORMES (sections 7/8) : toutes les capacités observées dans une
// couverture sont conservées ensemble, sans sélection, fusion, ni détection de conflit/ambiguïté.
// Deux éléments de vueDescriptive() ne sont JAMAIS fusionnés parce qu'ils partageraient les mêmes
// capacités observées -- la couverture reste la seule distinction structurante, héritée telle quelle
// de vueDescriptive().
//
// AUCUNE COMPARAISON AVANT/APRÈS (section 10) : cette fonction décrit un ÉTAT, jamais un changement.
// Aucune fonction reexaminerCooccurrences()/memesCooccurrences() n'est créée ici.
export function cooccurrencesSituationAction(traces, options = {}) {
  const vue = vueDescriptive(traces, options);
  const parId = new Map(traces.map((t) => [t.id, t]));
  return vue.map((element) => {
    const parCapacite = new Map();
    let excluesCapaciteInvalide = 0;
    for (const id of element.couverture) {
      const capacite = parId.get(id).capacite;
      if (typeof capacite === 'string' && capacite.length > 0) {
        parCapacite.set(capacite, (parCapacite.get(capacite) || 0) + 1);
      } else {
        excluesCapaciteInvalide += 1;
      }
    }
    const capacites = [...parCapacite.keys()]
      .sort()
      .map((capacite) => ({ capacite, occurrences: parCapacite.get(capacite) }));
    return {
      forme: element.forme,
      couverture: element.couverture,
      capacites,
      excluesCapaciteInvalide,
    };
  });
}

// CORRESPONDANCE FORME DESCRIPTIVE / TEXTE PRÉSENT (décision ChatGPT « CORRESPONDANCE FORME
// DESCRIPTIVE / TEXTE PRÉSENT », 03/10/2026, implémentant le contrat figé par le diagnostic du même
// jour). Teste si un texte PRÉSENT respecte, à l'instant T, la description structurelle d'UN élément
// de vueDescriptive() -- rien de plus. AUCUN branchement comportemental, AUCUNE sélection de
// capacité, AUCUN rôle, AUCUN argument, AUCUNE invocation, AUCUNE persistance, AUCUNE notion de
// score/similarité/confiance/priorité/utilité/résultat.
//
// INFORMATIONS UTILISÉES, STRICTEMENT (section « contrat exact » du diagnostic) : rapport.n et
// rapport.ancres SEULS, plus tokeniser() déjà existant (transformation.js) appliqué à texteNouveau.
// positionsVariables est volontairement IGNORÉ ici (il est un pur COMPLÉMENT de ancres par rapport à
// [0..n-1], donc redondant pour ce test -- aucune information supplémentaire). diversite/occurrences/
// exemplesDistincts/couverture NE SONT JAMAIS LUS : la fréquence et la couverture passée ne sont pas
// des contraintes de correspondance (même séparation structure/fréquence que decrireStructure()
// lui-même). AUCUNE capacité, argument ou résultat n'intervient -- cette fonction reste capacité-
// agnostique, exactement comme vueDescriptive() elle-même.
//
// POSITIONS VARIABLES : AUCUNE contrainte. Un token présent à une position non ancrée est TOUJOURS
// accepté, quelle que soit sa diversité historique -- transformer diversite en vocabulaire fermé
// (refuser un token jamais observé à cette position) introduirait une notion de similarité/
// classification sémantique explicitement hors périmètre. Non testé ici : jamais invoqué.
//
// FORME SANS AUCUNE ANCRE (rapport.ancres.length === 0) : NE CORRESPOND JAMAIS -- décision de
// conception EXPLICITE ET DÉFINITIVE pour ce chantier (jamais rouverte), alignée sur le garde-fou
// déjà présent dans correspondSquelette() (transformation.js) : une forme sans ancre n'impose aucune
// contrainte structurelle positive au-delà de l'arité, et « n tokens » ne doit jamais devenir une
// reconnaissance positive de n'importe quel texte de même longueur.
//
// TOKENISATION : tokeniser() existant, réutilisé STRICTEMENT tel quel (transformation.js, le même
// espace de représentation que contexte.tokens d'une trace et que decrireStructure()/
// correspondSquelette()) -- AUCUNE canonisation supplémentaire. La comparaison d'une ancre reste donc
// sensible à la casse et aux accents, exactement comme correspondSquelette() le fait déjà. Un texte
// vide/null/undefined se tokenise en [] (tableau vide), d'où une arité 0 qui ne correspond
// simplement jamais à un rapport.n réel -- aucune politique spéciale nécessaire.
//
// VALIDATION : AUCUNE couche défensive générale du rapport -- le contrat d'entrée est un rapport
// RÉELLEMENT produit par decrireStructure() à l'intérieur d'un élément de vueDescriptive(), jamais un
// objet arbitraire reconstruit à la main (même discipline que vueDescriptive()/reexaminerTraces()
// elles-mêmes, qui font confiance à leurs propres dépendances internes déjà testées).
//
// IDENTITÉ TEMPORELLE : rien n'est persisté, aucun id n'est donné à une forme, aucune forme n'est
// comparée à une ANCIENNE forme -- une réponse strictement instantanée à « ce texte respecte-t-il
// CETTE description structurelle actuelle ? ».
//
// FORMES CHEVAUCHANTES : cette primitive teste UNE forme à la fois et retourne un booléen -- jamais
// une liste de correspondances ni un arbitrage entre plusieurs formes concurrentes (la sélection
// entre formes reste explicitement hors périmètre). Un appelant qui voudrait tester contre toute une
// vue peut composer trivialement (ex. vue.filter(e => correspondFormeDescriptive(e.rapport, texte))),
// sans qu'aucune décision de sélection ne soit prise ICI.
//
// NON BRANCHÉ : comme le reste de ce module, cette fonction n'est appelée par aucun mécanisme
// spontané (ni vecu.js, ni ecran.js, ni main.js) -- disponible, vérifiée, jamais invoquée ailleurs.
export function correspondFormeDescriptive(rapport, texteNouveau) {
  const jetons = tokeniser(texteNouveau);
  if (jetons.length !== rapport.n) return false;
  if (rapport.ancres.length === 0) return false;
  return rapport.ancres.every(({ position, jeton }) => jetons[position] === jeton);
}

// DESCRIPTION POSITIONNELLE DES RÔLES (décision ChatGPT « DESCRIPTION POSITIONNELLE DES RÔLES »,
// 03/10/2026, implémentant le contrat figé par le diagnostic du même jour). Décrit, pour un couple
// (couverture de forme F, capacité A), les positions sources HISTORIQUEMENT OBSERVÉES pour chaque
// rôle -- en lisant UNIQUEMENT trace.provenancePositions (v0.53, un FAIT brut tiré de action.roles
// au moment de l'invocation). AUCUNE lecture de contexte.tokens/argumentsUtilises à cette fin :
// reconstruire une position par égalité de valeur (argumentsUtilises[role] === contexte.tokens[i])
// a été démontré, avec le vrai code (diagnostic « PROVENANCE POSITIONNELLE EXACTE DES RÔLES »),
// capable de produire un FAUX singleton quand deux actions enseignées différentes, partageant une
// capacité, contribuent à la même couverture. La seule source positionnelle autorisée ici est le
// champ lui-même.
//
// AUCUN choix, AUCUNE majorité, AUCUN score, AUCUNE confiance : les fréquences sont des comptes
// bruts (même discipline que cooccurrencesSituationAction() pour ses occurrences par capacité).
//
// TROIS ÉTATS DE PROVENANCE (déjà rencontrés dans enregistrerTrace(), connaissances.js) :
//   - objet (éventuellement {}) -- trace AVEC provenance, exploitable (même vide, une trace vide
//     est comptée dans tracesAvecProvenance mais ne contribue aucun rôle) ;
//   - null -- voie 'composition', ou toute trace sans position textuelle par nature ;
//   - absent (undefined) -- trace ANTÉRIEURE à v0.53, jamais reconstruite.
// null et absent sont tous deux comptés dans tracesSansProvenance (aucune des deux ne contribue
// jamais une position) -- aucune confusion entre les deux n'est nécessaire à ce niveau.
//
// SOURCE DES RÔLES : l'UNION des clés réellement présentes dans les provenancePositions exploitables
// -- JAMAIS CAPACITES[capacite].roles (description historique ≠ validation contre le registre
// actuel, même principe que cooccurrencesSituationAction() qui ne valide déjà pas `capacite` contre
// le registre). Une capacité disparue du registre reste descriptible depuis ses traces.
//
// VALIDATION MINIMALE DES POSITIONS (jamais un throw, jamais une correction) : une position est
// valide si Number.isInteger(position) && position >= 0. Une position invalide (-1, 1.5, "1", ...)
// n'invalide JAMAIS la trace ni le rôle : le rôle reste compté dans tracesAvecRole (sa clé est bien
// présente), mais sa valeur est comptée séparément dans positionsInvalides, JAMAIS convertie en une
// fausse occurrence. Trois états distincts, jamais fusionnés : absence du rôle (absences), position
// valide (positions[].occurrences), position invalide (positionsInvalides).
//
// COUVERTURE : `couvertureIds` est dédupliqué avant tout comptage (une couverture réelle, produite
// par vueDescriptive(), ne contient déjà aucun doublon, mais une liste construite autrement par un
// appelant ne doit jamais faire compter une même trace deux fois). Un id sans trace correspondante
// dans `traces` est une anomalie de DONNÉE (pas de contrat d'appel, contrairement à
// reexaminerTraces()) : compté dans idsIntrouvables, jamais un throw.
//
// ORDRE DÉTERMINISTE : rôles triés alphabétiquement, positions triées par ordre numérique croissant
// à l'intérieur de chaque rôle -- jamais par fréquence (même discipline que les capacités triées par
// nom dans cooccurrencesSituationAction()). L'ordre de `traces`/`couvertureIds` en entrée ne change
// jamais la sortie.
//
// IDENTITÉ TEMPORELLE : entièrement recalculée à chaque appel, aucune persistance, aucun id de
// mapping, aucune comparaison avec une description antérieure -- une « description recalculée du
// vécu », jamais une « régularité apprise ».
//
// NON BRANCHÉ : comme le reste de ce module, cette fonction n'est appelée par aucun mécanisme
// spontané -- disponible, vérifiée, jamais invoquée ailleurs. Ne décide rien : aucun choix de
// capacité, aucune sélection de forme, aucune invocation, aucune persistance.
export function decrirePositionsRoles(traces, couvertureIds, capacite) {
  const parId = new Map(traces.map((t) => [t.id, t]));
  const idsUniques = [...new Set(couvertureIds)];

  let idsIntrouvables = 0;
  const tracesCapaciteListe = [];
  for (const id of idsUniques) {
    const trace = parId.get(id);
    if (!trace) { idsIntrouvables += 1; continue; }
    if (trace.capacite === capacite) tracesCapaciteListe.push(trace);
  }

  let tracesAvecProvenance = 0;
  let tracesSansProvenance = 0;
  const parRole = new Map(); // role -> { tracesAvecRole, positionsInvalides, positions: Map<position, occurrences> }

  for (const trace of tracesCapaciteListe) {
    const prov = trace.provenancePositions;
    const exploitable = prov !== null && prov !== undefined && typeof prov === 'object';
    if (!exploitable) { tracesSansProvenance += 1; continue; }
    tracesAvecProvenance += 1;
    for (const role of Object.keys(prov)) {
      if (!parRole.has(role)) parRole.set(role, { tracesAvecRole: 0, positionsInvalides: 0, positions: new Map() });
      const entree = parRole.get(role);
      entree.tracesAvecRole += 1;
      const position = prov[role];
      if (Number.isInteger(position) && position >= 0) {
        entree.positions.set(position, (entree.positions.get(position) || 0) + 1);
      } else {
        entree.positionsInvalides += 1;
      }
    }
  }

  const roles = [...parRole.keys()].sort().map((role) => {
    const entree = parRole.get(role);
    const positions = [...entree.positions.keys()].sort((a, b) => a - b)
      .map((position) => ({ position, occurrences: entree.positions.get(position) }));
    return {
      role,
      tracesAvecRole: entree.tracesAvecRole,
      absences: tracesAvecProvenance - entree.tracesAvecRole,
      positionsInvalides: entree.positionsInvalides,
      positions,
    };
  });

  return {
    capacite,
    tracesCapacite: tracesCapaciteListe.length,
    tracesAvecProvenance,
    tracesSansProvenance,
    idsIntrouvables,
    roles,
  };
}

// CONSTRUCTION DES ARGUMENTS PRÉSENTS (décision ChatGPT « CHANTIER — PRIMITIVE PURE DE CONSTRUCTION
// DES ARGUMENTS PRÉSENTS », 03/10/2026, implémentant le contrat figé par le diagnostic « DIAGNOSTIC
// REJEU DESCRIPTIF » du même jour). Répond UNIQUEMENT à : « pour CETTE forme descriptive et CETTE
// capacité historique, quels arguments puis-je reconstruire SANS AMBIGUÏTÉ depuis le texte présent ? »
// AUCUNE sélection entre formes/capacités concurrentes (une seule paire (rapport, capacite) traitée
// par appel -- section 8/12 du diagnostic : la résolution entre candidats reste une étape ultérieure,
// jamais tentée ici), AUCUNE invocation, AUCUN branchement comportemental, AUCUN score/probabilité/
// seuil arbitraire.
//
// RÉUTILISE STRICTEMENT, SANS DUPLICATION (section 1/12 du diagnostic) :
//   - correspondFormeDescriptive() (v0.52) pour vérifier la correspondance forme/texte présent ;
//   - decrirePositionsRoles() (v0.54) pour la description positionnelle brute -- jamais refiltrée ni
//     recalculée manuellement ici ;
//   - tokeniser() (transformation.js) pour le texte présent ;
//   - CAPACITES (registre.js) comme SEULE source du contrat ACTUEL des rôles requis (section 8 du
//     diagnostic : la complétude se juge contre le registre d'aujourd'hui, jamais contre l'histoire).
//
// ORDRE DES VÉRIFICATIONS (section 3 du diagnostic, repris à l'identique) : forme d'abord, puis
// existence actuelle de la capacité, puis description positionnelle, puis tokenisation, puis examen
// des seuls rôles actuellement requis.
//
// NON-AMBIGUÏTÉ, PUREMENT STRUCTURELLE (section 4) : exactement UNE position valide distincte pour un
// rôle -> potentiellement construit ; au moins deux positions valides distinctes concurrentes ->
// "ambigu", quels que soient les comptes d'occurrences respectifs -- AUCUNE majorité.
//
// ANCIENNES TRACES SANS PROVENANCE (section 5) : une absence de provenance n'est jamais une preuve,
// ni positive ni négative. Distinction nécessaire, déjà signalée par le diagnostic (section 6/16-D),
// entre deux causes très différentes pour un rôle absent de la description de decrirePositionsRoles() :
//   A. AUCUNE trace de la paire ne possède de provenance exploitable du tout (tracesAvecProvenance===0
//      globalement) -- état "sans_provenance_exploitable" ;
//   B. au moins une trace possède une provenance exploitable, mais ce rôle précis n'apparaît dans
//      aucune d'entre elles -- état "jamais_observe".
// Confondre ces deux cas masquerait une différence réelle (aucune donnée positionnelle du tout, contre
// des données positionnelles existantes qui, simplement, ne mentionnent jamais ce rôle) -- les deux
// restent des échecs de construction, mais pour des raisons honnêtement distinctes.
//
// POSITIONS UNIQUEMENT INVALIDES (section 6-C du diagnostic, « le cas C ne doit surtout PAS devenir
// construit ») : un rôle dont la clé apparaît bien dans la description (tracesAvecRole > 0) mais dont
// AUCUNE position valide n'a jamais été observée (positions.length === 0, positionsInvalides > 0) ne
// peut être confondu ni avec "jamais_observe" (le rôle EST observé comme clé) ni avec "construit". État
// explicite minimal ajouté, comme le diagnostic l'autorisait explicitement : "position_invalide".
//
// POSITION HORS LIMITES DU TEXTE PRÉSENT (section 10 du diagnostic) : structurellement impossible en
// usage correct (forme/couverture cohérentes + arité déjà garantie par correspondFormeDescriptive()),
// mais gardé défensivement : si la seule position valide, non ambiguë, observée pour un rôle tombe
// hors des bornes des tokens présents (incohérence d'appel/données), AUCUN argument n'est fabriqué
// (jamais `undefined` silencieusement promu en valeur), AUCUN throw -- état explicite dédié
// "position_hors_limites", qui rend "incomplet" le résultat global comme tout autre rôle manquant.
//
// AUCUNE RECONSTRUCTION PAR VALEUR NI PAR ANCRE (section 3 du diagnostic, section 7 du chantier) :
// argumentsUtilises et contexte.tokens des traces historiques ne sont JAMAIS lus ici -- la seule
// provenance autorisée reste celle déjà extraite par decrirePositionsRoles() depuis
// trace.provenancePositions. rapport.ancres n'est jamais utilisé comme source d'un rôle : une ancre
// n'est qu'un repère structurel de correspondance de forme, jamais un argument.
//
// CONTRAT ACTUEL DE LA CAPACITÉ (section 8 du diagnostic) : seuls les rôles de
// CAPACITES[capacite].roles sont examinés et peuvent influencer la complétude globale. Un rôle
// historique absent de ce contrat actuel (ex. renommé, supprimé) n'est JAMAIS examiné pour la
// complétude -- il est seulement signalé, séparément, dans "rolesHistoriquesIgnores", pour ne jamais
// disparaître silencieusement.
//
// STATISTIQUES GLOBALES VS PAR RÔLE (section 9 du diagnostic, correction explicite par rapport à une
// première lecture naïve) : tracesCapacite/tracesAvecProvenance/tracesSansProvenance/idsIntrouvables
// appartiennent à la description GLOBALE de la paire (forme, capacité) -- jamais dupliqués dans chaque
// rôle. Par rôle, seules les données qui lui appartiennent réellement sont conservées :
// tracesAvecRole/absences/positionsInvalides/positions, reprises telles que decrirePositionsRoles()
// les a déjà calculées, jamais recalculées ici.
//
// DEUX RÔLES SUR LA MÊME POSITION (section 11 du diagnostic) : explicitement autorisé, aucune
// exclusivité positionnelle inventée -- chaque rôle actuel est évalué indépendamment des autres.
//
// IDENTITÉ TEMPORELLE : entièrement recalculée à chaque appel, aucune persistance, aucune sélection,
// aucune invocation -- une réponse strictement instantanée à « que puis-je reconstruire maintenant,
// sans ambiguïté ? », jamais « je dois agir ».
//
// NON BRANCHÉ : comme le reste de ce module, cette fonction n'est appelée par aucun mécanisme
// spontané (ni ecran.js, ni main.js, ni action.js, ni composition.js) -- disponible, vérifiée, jamais
// invoquée ailleurs à ce stade.
export function construireArgumentsPresents({ rapport, capacite, traces, couvertureIds, textePresent }) {
  if (!correspondFormeDescriptive(rapport, textePresent)) {
    return { etat: 'forme_non_correspondante', capacite, arguments: null, roles: [], rolesHistoriquesIgnores: [] };
  }

  const contratCapacite = CAPACITES[capacite];
  if (!contratCapacite) {
    return { etat: 'capacite_disparue', capacite, arguments: null, roles: [], rolesHistoriquesIgnores: [] };
  }

  const description = decrirePositionsRoles(traces, couvertureIds, capacite);
  const tokens = tokeniser(textePresent);
  const rolesActuels = contratCapacite.roles;
  const parRoleDescription = new Map(description.roles.map((r) => [r.role, r]));

  // ROLES HISTORIQUES HORS CONTRAT ACTUEL (section 8/section F) : signalés, jamais examinés pour la
  // complétude ci-dessous -- construits depuis la description brute, indépendamment des rôles actuels.
  const rolesHistoriquesIgnores = description.roles
    .map((r) => r.role)
    .filter((role) => !rolesActuels.includes(role));

  const argumentsConstruits = {};
  const roles = rolesActuels.map((role) => {
    const roleDesc = parRoleDescription.get(role);

    // Rôle entièrement absent de la description -- distinguer A (aucune provenance exploitable du
    // tout dans la couverture) de B (provenance exploitable existante, mais jamais ce rôle précis).
    if (!roleDesc) {
      const etat = description.tracesAvecProvenance === 0 ? 'sans_provenance_exploitable' : 'jamais_observe';
      return { role, etat, tracesAvecRole: 0, absences: 0, positionsInvalides: 0, positions: [] };
    }

    const base = {
      role,
      tracesAvecRole: roleDesc.tracesAvecRole,
      absences: roleDesc.absences,
      positionsInvalides: roleDesc.positionsInvalides,
      positions: roleDesc.positions,
    };

    // Rôle observé comme clé, mais AUCUNE position valide (section 6-C) -- jamais "construit".
    if (roleDesc.positions.length === 0) {
      return { ...base, etat: 'position_invalide' };
    }

    // Plusieurs positions valides distinctes concurrentes -- "ambigu", sans majorité (section 4).
    if (roleDesc.positions.length > 1) {
      return { ...base, etat: 'ambigu' };
    }

    // Exactement une position valide, non ambiguë -- vérification défensive des bornes (section 10)
    // avant toute construction : jamais d'argument fabriqué hors limites du texte présent.
    const [{ position }] = roleDesc.positions;
    if (position >= tokens.length) {
      return { ...base, etat: 'position_hors_limites' };
    }

    argumentsConstruits[role] = tokens[position];
    return { ...base, etat: 'construit' };
  });

  const etat = roles.every((r) => r.etat === 'construit') ? 'constructible' : 'incomplet';

  return {
    etat,
    capacite,
    arguments: argumentsConstruits,
    roles,
    rolesHistoriquesIgnores,
    tracesCapacite: description.tracesCapacite,
    tracesAvecProvenance: description.tracesAvecProvenance,
    tracesSansProvenance: description.tracesSansProvenance,
    idsIntrouvables: description.idsIntrouvables,
  };
}

// RECENSEMENT DES POSSIBILITÉS DE REJEU (décision ChatGPT « CHANTIER — PRIMITIVE PURE DE RECENSEMENT
// DES POSSIBILITÉS DE REJEU », 03/10/2026, implémentant le contrat figé par le diagnostic « DIAGNOSTIC
// PREMIER CHOIX AUTONOME » du même jour). Répond UNIQUEMENT à : « pour CE texte présent, quelles
// invocations concrètes DISTINCTES puis-je reconstruire depuis mes traces passées ? » AUCUN choix,
// AUCUNE invocation, AUCUNE recommandation, AUCUN branchement dans ecran.js, AUCUN score, AUCUNE
// fréquence utilisée comme préférence, AUCUNE notion de réussite/utilité, AUCUNE écriture de trace,
// AUCUNE persistance.
//
// RÉUTILISE STRICTEMENT, SANS DUPLICATION (section 2 du diagnostic/du chantier) :
//   - vueDescriptive() pour la découverte des formes (couverture + rapport) ;
//   - cooccurrencesSituationAction() pour les capacités historiquement observées -- jamais recalculé
//     à la main, jamais un filtrage manuel des traces par capacité ;
//   - correspondFormeDescriptive() pour ne retenir que les formes compatibles avec le texte présent ;
//   - construireArgumentsPresents() pour chaque paire (forme, capacité), inchangée.
//
// ALIGNEMENT forme/capacités PAR COUVERTURE EXACTE, JAMAIS PAR FORME SEULE (section 3 du chantier) :
// vueDescriptive() et cooccurrencesSituationAction() sont deux appels indépendants (même si
// cooccurrencesSituationAction() calcule la même vueDescriptive() en interne) -- aucune hypothèse
// n'est faite sur un ordre partagé entre les deux tableaux. L'association se fait exclusivement par
// la clé de couverture (liste d'ids triée), jamais par la chaîne de forme seule : deux couvertures
// différentes peuvent produire exactement la même signature de forme (même n/ancres/diversité) sans
// être la même observation -- les confondre fusionnerait à tort des capacités historiques qui ne
// partagent pas réellement les mêmes traces.
//
// UNITÉ DE SORTIE : L'INVOCATION CONCRÈTE (capacite, arguments), JAMAIS la forme, la couverture, ni
// la capacité seule, ni la paire forme/capacité (section 4 du diagnostic : deux formes différentes
// menant à la même capacité avec les mêmes arguments présents sont la MÊME possibilité ; la même
// capacité avec des arguments différents, ou deux capacités différentes, sont des possibilités
// réellement distinctes).
//
// IDENTITÉ / DÉDUPLICATION (section 5 du chantier, section 4 du diagnostic) : deux invocations sont
// identiques si et seulement si même capacité (égalité stricte de chaîne), mêmes rôles actuels
// (garanti dès que la capacité est la même : CAPACITES est un registre unique, gelé -- voir
// construireArgumentsPresents()) et mêmes valeurs STRING exactes par rôle (égalité stricte ===,
// jamais canoniser(), jamais une suppression d'accents/casse, jamais une similarité -- ces valeurs
// sont déjà des tokens bruts issus de tokeniser(textePresent), introduire une canonisation
// seulement à la comparaison créerait un décalage avec la valeur réellement destinée à une future
// invocation). La comparaison est INDÉPENDANTE DE L'ORDRE D'INSERTION des clés JS de l'objet
// "arguments" -- la clé de déduplication est construite sur les noms de rôle TRIÉS, jamais sur
// l'ordre d'itération accidentel (même discipline que cleCouverture() plus haut dans ce fichier,
// séparateurs \u0001/\u0002 choisis pour éviter toute collision avec un contenu réel).
//
// FORMES REDONDANTES (section 6 du chantier) : si plusieurs formes/couvertures mènent à EXACTEMENT
// la même invocation concrète, elles fusionnent en UNE possibilité -- mais leurs origines (forme +
// couverture, section 7) sont TOUTES conservées, jamais une seule retenue au détriment des autres.
// AUCUN critère de départage n'intervient jamais dans cette fusion (nombre d'ancres, spécificité,
// taille de couverture, fréquence) : la fusion n'est jamais un choix, seulement une reconnaissance
// que deux descriptions désignent le même acte.
//
// NON-CONSTRUCTIBLES (section 8) : un résultat 'incomplet', 'capacite_disparue' ou
// 'forme_non_correspondante' de construireArgumentsPresents() n'est PAS une possibilité disponible --
// il n'entre jamais dans la sortie, et ne compte jamais comme une concurrence pour mesurer une
// ambiguïté (qui reste, de toute façon, hors du périmètre de cette primitive : elle ne fait que
// recenser, jamais choisir).
//
// 0 / 1 / N (section 9) : la sortie est une simple liste ; sa longueur dit tout. AUCUN champ
// "choix"/"unique"/"ambigu"/"confiance"/"décision" n'est ajouté : ce serait déjà un pas vers un
// jugement, hors du périmètre de cette primitive (voir le diagnostic : le passage du recensement à
// une décision d'invoquer n'est PAS encore justifié par un principe existant pour le rejeu historique).
//
// FRÉQUENCES (section 10) : jamais lues comme préférence. "occurrences" (cooccurrencesSituationAction())
// sert uniquement à savoir QUELLES capacités tenter de reconstruire pour une couverture -- jamais à
// ordonner, filtrer ou pondérer le résultat.
//
// TRACES PASSÉES UNIQUEMENT (section 11) : cette fonction ne lit que le tableau `traces` reçu, jamais
// le magasin, n'écrit jamais de trace, ne persiste rien -- comme le reste de ce module.
//
// ORDRE DÉTERMINISTE (section 12) : les possibilités sont triées par une représentation textuelle
// déterministe de leur identité (capacité puis rôles/valeurs triés) -- jamais par fréquence ni ordre
// d'découverte. Les origines de chaque possibilité sont triées par couverture puis par forme, pour la
// même raison -- aucune priorité n'est jamais signifiée par un ordre.
//
// NON BRANCHÉ : comme le reste de ce module, cette fonction n'est appelée par aucun mécanisme
// spontané (ni ecran.js, ni main.js, ni action.js, ni composition.js, ni registre.js, ni vecu.js) --
// disponible, vérifiée, jamais invoquée ailleurs à ce stade.
function cleInvocation(capacite, args) {
  const roles = Object.keys(args).sort();
  const paires = roles.map((role) => `${role}\u0001${args[role]}`).join('\u0002');
  return `${capacite}\u0001${paires}`;
}

export function possibilitesRejeu(traces, textePresent) {
  const vue = vueDescriptive(traces);
  const cooc = cooccurrencesSituationAction(traces);
  const capacitesParCouverture = new Map(
    cooc.map((e) => [cleCouverture(e.couverture), e.capacites]),
  );

  const invocations = new Map(); // cleInvocation -> { capacite, arguments, origines: [] }

  for (const element of vue) {
    if (!correspondFormeDescriptive(element.rapport, textePresent)) continue;
    const capacitesObservees = capacitesParCouverture.get(cleCouverture(element.couverture)) || [];
    for (const { capacite } of capacitesObservees) {
      const r = construireArgumentsPresents({
        rapport: element.rapport, capacite, traces, couvertureIds: element.couverture, textePresent,
      });
      if (r.etat !== 'constructible') continue; // section 8 : jamais une possibilité, jamais compté.

      const cle = cleInvocation(capacite, r.arguments);
      if (!invocations.has(cle)) {
        invocations.set(cle, { capacite, arguments: r.arguments, origines: [] });
      }
      invocations.get(cle).origines.push({
        forme: element.forme,
        couverture: element.couverture,
        tracesCapacite: r.tracesCapacite,
        tracesAvecProvenance: r.tracesAvecProvenance,
        tracesSansProvenance: r.tracesSansProvenance,
        idsIntrouvables: r.idsIntrouvables,
      });
    }
  }

  const possibilites = [...invocations.values()]
    .sort((a, b) => cleInvocation(a.capacite, a.arguments).localeCompare(cleInvocation(b.capacite, b.arguments)))
    .map((p) => ({
      capacite: p.capacite,
      arguments: p.arguments,
      origines: p.origines.slice().sort((o1, o2) => {
        const c1 = o1.couverture.slice().sort().join(',');
        const c2 = o2.couverture.slice().sort().join(',');
        return c1.localeCompare(c2) || o1.forme.localeCompare(o2.forme);
      }),
    }));

  return { possibilites };
}
// === FIN_LANGAGE_VUE_TRACES ===
