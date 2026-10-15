// === DEBUT_LANGAGE_REGISTRE ===
// v0.38.0 — DÉCISION CHATGPT « LOT B2 : ACTION INTERNE APPRISE » (02/10). Le REGISTRE FERMÉ des
// opérations internes que Naissance a le droit d'invoquer via une action apprise (action.js).
//
// SÉCURITÉ ARCHITECTURALE, ABSOLUE (décision explicite) : une donnée APPRISE (voir action.js) ne
// porte jamais qu'une CLÉ STABLE de cet objet (une chaîne choisie par le CODE, jamais dérivée d'une
// donnée apprise), jamais un nom de fonction JavaScript, jamais un chemin de module, jamais un appel
// à eval. CAPACITES est un objet LITTÉRAL, codé à la main, gelé (Object.freeze, y compris chaque
// entrée) : rien, nulle part, ne peut y ajouter ou retirer une capacité à l'exécution. Ajouter une
// future capacité est un changement DE CE FICHIER (une nouvelle entrée), jamais une conséquence d'un
// apprentissage.
//
// Chaque entrée déclare :
//   - roles    : l'ensemble EXACT des noms de rôle que cette capacité attend (action.js refuse toute
//                action dont les rôles nommés ne correspondent pas exactement — ni manquant, ni en
//                trop, jamais une correction silencieuse d'un nom mal orthographié).
//   - invoquer : la fonction réellement appelée, (esprit, argumentsNommes) -> résultat. Un simple
//                adaptateur vers la primitive réelle (confrontation.js, inchangée) : la traduction
//                entre rôles nommés et la forme exacte attendue par la fonction réelle vit ICI,
//                jamais dans action.js (qui reste générique, ignorant de ce que « confrontation »
//                signifie), ni dans confrontation.js (qui reste ignorant de l'existence d'un
//                apprentissage).
//   - representer : (résultat) -> texte, MINIMAL et NEUTRE (décision ChatGPT « LOT B3 : RACCORD
//                CONVERSATIONNEL », 02/10 : « ne construis pas une génération linguistique complexe
//                pour embellir ces quatre états »). Même raison d'être que `invoquer` ci-dessus : la
//                forme exacte du résultat d'UNE capacité précise (ici, { etat, valeurA, valeurB } --
//                confrontation.js) n'est connue nulle part ailleurs que son adaptateur dans CE
//                fichier -- jamais dans action.js (générique), jamais dans ecran.js (qui se contente
//                d'appeler capacite.representer(resultat), quelle que soit la capacité invoquée).
//
// POINT OUVERT, explicitement signalé (pas réglé ici) : confronterToutes() (confrontation.js) attend
// une LISTE de relations (`relations`), alors que l'extraction B1 ne fournit qu'UN jeton par position
// variable. La capacité ci-dessous n'expose donc que confronter() — comparaison sur UNE SEULE
// relation, nommée symétriquement des deux côtés (cheminA = cheminB = [relation]), le cas direct déjà
// illustré dans le cadrage de B (« Compare zalpha et zbeta sur zcouleur »). Exposer confronterToutes()
// (plusieurs relations à la fois) demanderait un rôle de type LISTE que B1/B2 ne produisent pas
// aujourd'hui — une vraie question architecturale, remontée séparément, jamais bricolée ici.
import { confronter } from './confrontation.js';
import { proprietesCommunes, sujetsAvec, faitsAvec } from './selection.js';
import { deduire } from './deduction.js';
import { estAccessible } from './accessibilite.js';

const MOTS_ETAT_CONFRONTATION = Object.freeze({
  egal: 'égal', different: 'différent', inconnu: 'inconnu', conflit: 'conflit',
});

const MOTS_ETAT_ACCESSIBILITE = Object.freeze({
  accessible: 'accessible', inaccessible: 'inaccessible', inconnu: 'inconnu',
});

// v0.41 — DÉCISION CHATGPT « PROCHAINE CAPACITÉ GÉNÉRALE DE RAISONNEMENT » (02/10) : deux nouvelles
// entrées, toutes deux adossées à selection.js (ÉNUMÉRATION des faits déjà connus, jamais une liste
// fournie par la conversation). Mêmes formes de rôles, simples, à un seul jeton, que « confrontation »
// ci-dessus -- ZÉRO changement nécessaire à B1 (extraction.js) ou B2 (action.js) : une liste de
// relations n'est jamais demandée au texte appris, le point ouvert documenté plus haut (confirmation
// ci-dessous) reste donc entier pour confronterToutes() elle-même, mais n'empêche pas ces deux
// capacités d'exister.
function fmtListe(liste) {
  return liste.length ? liste.map((l) => l.relation).join(', ') : 'aucune';
}

// v0.64.18 — primitive UNIQUE de proposition de fait (extraite telle quelle de proposerFait v0.64.13, comportement identique), partagée par
// les deux capacités de fait ci-dessous. Pure : n'accède jamais à l'esprit, n'écrit rien. Structure incomplète → null.
function proposerStructureFait({ sujet, relation, valeur } = {}) {
  const champ = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!champ(sujet) || !champ(relation) || !champ(valeur)) return null;
  return { type: 'fait', donnees: { sujet, relation, valeur } };
}

function representerStructureFait(resultat) {
  return resultat && resultat.donnees
    ? `Proposition (forme apprise) : ${resultat.donnees.sujet} → ${resultat.donnees.relation} → ${resultat.donnees.valeur}.`
    : 'Proposition (forme apprise) : structure incomplète, aucune proposition.';
}

export const CAPACITES = Object.freeze({
  confrontation: Object.freeze({
    roles: Object.freeze(['sujetA', 'sujetB', 'relation']),
    invoquer: (esprit, { sujetA, sujetB, relation }) => confronter(esprit, {
      sujetA, cheminA: [relation], sujetB, cheminB: [relation],
    }),
    representer: (resultat) => `Résultat (confrontation locale) : ${MOTS_ETAT_CONFRONTATION[resultat.etat] || resultat.etat}.`,
  }),
  proprietesCommunes: Object.freeze({
    roles: Object.freeze(['sujetA', 'sujetB']),
    invoquer: (esprit, { sujetA, sujetB }) => proprietesCommunes(esprit, { sujetA, sujetB }),
    // MINIMAL et NEUTRE (même principe que confrontation ci-dessus, LOT B3) : les noms de relation
    // seulement, jamais une phrase construite autour des valeurs.
    representer: (resultat) => `Résultat (propriétés communes, local) : identiques (${fmtListe(resultat.identiques)}) ;`
      + ` différentes (${fmtListe(resultat.differentes)}) ;`
      + ` uniquement sujetA (${fmtListe(resultat.uniquementA)}) ;`
      + ` uniquement sujetB (${fmtListe(resultat.uniquementB)}).`,
  }),
  // v0.64.19 — « APPRENDRE À UTILISER UNE CONNAISSANCE PAR LA RÉPONSE ATTENDUE » (GO ChatGPT « v0.64.19 », 14/10/2026). Propriété DÉCLARATIVE
  // `lecture` : « cette capacité LIT l'état sans le modifier et peut servir à RÉPONDRE à une question ». C'est la SEULE marque que lit
  // l'inducteur de formes de question (reponses-attendues.js) ; aucune autre capacité ne la porte aujourd'hui. Deux champs :
  //   reponses(resultat) -> liste des valeurs-réponses que ce résultat CONTIENT (ici : les sujets trouvés, tous, dans l'ordre rendu) ;
  //   sens(lettres)      -> phrase humaine de ce que fait la capacité, avec les lettres de la forme à la place des rôles (proposition).
  recherche: Object.freeze({
    roles: Object.freeze(['relation', 'valeur']),
    lecture: Object.freeze({
      reponses: (resultat) => (resultat && Array.isArray(resultat.sujets) ? [...resultat.sujets] : []),
      sens: ({ relation, valeur }) => `chercher qui a ${relation} → ${valeur} dans ce que je sais`,
      // v0.64.21 — appuis(esprit, arguments) -> les faits qui soutiennent le résultat, lus dans l'esprit AU MOMENT de l'exécution (même filtre
      // que l'invocation : faitsAvec / sujetsAvec). L'appelant les PERSISTE dans la trace : l'histoire ne dépend jamais de l'état futur.
      appuis: (esprit, { relation, valeur }) => faitsAvec(esprit, { relation, valeur }),
    }),
    invoquer: (esprit, { relation, valeur }) => ({ sujets: sujetsAvec(esprit, { relation, valeur }) }),
    representer: (resultat) => (resultat.sujets.length
      ? `Résultat (recherche locale) : ${resultat.sujets.join(', ')}.`
      : 'Résultat (recherche locale) : aucun sujet trouvé.'),
  }),
  // v0.42 — DÉCISION CHATGPT « DÉDUCTION DÉTERMINISTE MULTI-FAITS » (02/10) : adossée à deduction.js
  // (lui-même une réutilisation stricte, sans modification, de regles.js + selection.js — voir
  // l'en-tête de deduction.js). Mêmes formes de rôles simples, à un seul jeton, que les capacités
  // ci-dessus -- ZÉRO changement nécessaire à B1/B2. MINIMAL et NEUTRE (même principe que les
  // capacités ci-dessus, LOT B3) : les trois états d'appliquerRegles() restitués tels quels, jamais
  // un choix arbitraire masqué derrière une formulation.
  deduction: Object.freeze({
    roles: Object.freeze(['sujet', 'role']),
    invoquer: (esprit, { sujet, role }) => deduire(esprit, { sujet, role }),
    representer: (resultat) => {
      if (resultat.conflit) return 'Résultat (déduction locale) : conflit entre plusieurs règles également spécifiques.';
      if (resultat.resultat === null) return 'Résultat (déduction locale) : aucune règle applicable.';
      return `Résultat (déduction locale) : ${resultat.resultat}.`;
    },
  }),
  // v0.44 — DÉCISION CHATGPT « COMPARATEUR LOGIQUE GÉNÉRAL / ACCESSIBILITÉ TRANSITIVE » (02/10),
  // ARCHITECTURE X : adossée à accessibilite.js (module ISOLÉ, qui lit esprit.faits directement —
  // voir son en-tête pour le choix de ne PAS généraliser resoudreChemin()/esprit.js). Mêmes formes
  // de rôles simples, à un seul jeton, que les capacités ci-dessus -- ZÉRO changement nécessaire à
  // B1/B2/composition.js : le résultat { etat } est scalaire, donc immédiatement utilisable comme
  // SOURCE de liaison (composition.js), exactement comme n'importe quelle autre capacité. Le rôle
  // « operateur » est ENTIÈREMENT LIBRE : AUCUNE liste de relations particulières n'est codée ici ni
  // ailleurs -- n'importe quelle relation déjà enseignée comme fait ordinaire peut lui être donnée.
  // MINIMAL et NEUTRE (même principe que les capacités ci-dessus, LOT B3) : les trois états
  // d'estAccessible() restitués tels quels, jamais un choix arbitraire masqué derrière une
  // formulation.
  accessibilite: Object.freeze({
    roles: Object.freeze(['sujetA', 'operateur', 'sujetB']),
    invoquer: (esprit, { sujetA, operateur, sujetB }) => estAccessible(esprit, { sujetA, operateur, sujetB }),
    representer: (resultat) => `Résultat (accessibilité locale) : ${MOTS_ETAT_ACCESSIBILITE[resultat.etat] || resultat.etat}.`,
  }),
  // v0.64.13 — « UNE FORME APPRISE PEUT PROPOSER UN FAIT » (autorisation ChatGPT « v0.64.13 », 14/10/2026). SIXIÈME capacité, la PREMIÈRE dont
  // le résultat n'est pas une lecture : une STRUCTURE DE FAIT PROPOSÉE, { type: 'fait', donnees: { sujet, relation, valeur } }, que l'appelant
  // (main.js) soumet ensuite au canal pédagogique existant (proposerLecon → bouton Confirmer → apprendreFait). ELLE N'ÉCRIT RIEN : ni
  // apprendreFait, ni magasin, ni esprit (jamais lu ni modifié), ni confirmation, ni choix (l'ambiguïté est tranchée en amont par l'abstention
  // de reconnaitreActions). Elle connaît la STRUCTURE d'un fait, PAS son sujet : relation et valeur sont des RÔLES (positions variables de la
  // forme apprise) ; sujet est une CONSTANTE déclarée ici et PERSISTÉE dans l'action apprise (`constantes`, action.js / connaissances.js),
  // jamais codée dans cette capacité. Structure incomplète (un champ absent, vide ou non textuel) → null : aucune proposition fabriquée.
  // v0.64.18 — « UNE FORME APPRISE PEUT PORTER LES TROIS CHAMPS D'UN FAIT » (GO ChatGPT « v0.64.18 », 14/10/2026). DEUX propriétés
  // DÉCLARATIVES, posées sur les deux capacités de fait et sur elles seules :
  //   proposeFait: true  — « cette capacité PROPOSE un fait » (sa sortie est une structure de fait soumise au canal pédagogique). C'est ce
  //                        que lisent formes-confirmees.js (familles supervisées → capacité de fait compatible) et ecran.js (canal pédagogique) ;
  //                        aucun nom de capacité n'y est comparé.
  //   rejouable: false   — le rejeu autonome (ecran.js) n'invoque JAMAIS cette capacité : une proposition de fait ne passe que par une forme
  //                        reconnue puis la confirmation de Christophe. Absente = rejouable (les cinq capacités historiques, inchangées).
  // La primitive de proposition est UNIQUE (proposerStructureFait) ; seuls les CONTRATS diffèrent :
  //   proposerFait         roles [relation, valeur], constante [sujet]  — le sujet appartient à la forme apprise ;
  //   proposerFaitComplet  roles [sujet, relation, valeur], aucune constante — les trois champs sont portés par le texte.
  // Une famille supervisée correspond EXACTEMENT à l'un des deux contrats ou à aucun (jamais un contrat « rôle OU constante »).
  proposerFait: Object.freeze({
    roles: Object.freeze(['relation', 'valeur']),
    constantes: Object.freeze(['sujet']),
    proposeFait: true,
    rejouable: false,
    invoquer: (_esprit, champs = {}) => proposerStructureFait(champs),
    representer: (resultat) => representerStructureFait(resultat),
  }),
  proposerFaitComplet: Object.freeze({
    roles: Object.freeze(['sujet', 'relation', 'valeur']),
    proposeFait: true,
    rejouable: false,
    invoquer: (_esprit, champs = {}) => proposerStructureFait(champs),
    representer: (resultat) => representerStructureFait(resultat),
  }),
});
// === FIN_LANGAGE_REGISTRE ===
