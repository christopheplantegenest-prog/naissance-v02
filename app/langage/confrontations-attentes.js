// === DEBUT_LANGAGE_CONFRONTATIONS_ATTENTES ===
// v0.64.8 — « LA CONFRONTATION COMME UNITÉ DU VÉCU » (décision ChatGPT « v0.64.8 », 13/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « pour chaque attente persistée et chaque conséquence vécue de l'acte qu'elle visait, qu'était-il attendu, et qu'a-t-on réellement trouvé
//     au même chemin, dans le même domaine ? »
//
// UNITÉ : une CONFRONTATION = le couple (attente A, conséquence X), X étant une exécution VÉCUE (réelle, ou synthétique : réception déclarée,
//   variation d'état propre) qui porte l'acte que A visait. IDENTITÉ = [A.id, X.id], et rien d'autre (ni contexte, ni horodatage, ni contenu,
//   ni statut). Plusieurs conséquences d'un même acte = plusieurs confrontations ; aucune conséquence = aucune confrontation (aucune
//   pseudo-confrontation « en attente » : l'attente reste un fait, rendu dans `sansConsequence`).
//   Relation DÉRIVÉE de faits persistés, comme un épisode : A et X partagent l'identité de l'acte (référence de A, ancrage de X) ; rien n'est
//   persisté, aucune opération, désignation, exécution, liaison ni coût n'est créé.
//
// confrontationsDAttentes(lignesAttentes, lignesContextes, lignesValeurs, lignesExecutions, descriptions) -> { confrontations, sansConsequence }
//   lignesAttentes : lignes persistées (forme .64.7 par rôles, ou plate historique : lues par rolesDeLAttente) ; lignesContextes : lignes
//   persistées des contextes (chaque attente y trouve le sien, sinon TypeError) ; le reste : le vécu (exécutions vécues), transmis tel quel à la
//   vue plurielle existante issuesDeLAttenteProspective — SEULE autorité sur « qu'a-t-on trouvé » (aucune confrontation réimplémentée ici).
//   CONFRONTATION = { identite: [A.id, X.id], avant, apres }
//     avant : copie EXACTE de A.description (structure, chemin, constat[, relation]) — ce qui était attendu ; ni preuve, ni références, ni
//             occurrence.
//     apres : { domaine, chemin[, constat] } — ce qui a eu lieu : domaine = A.description.structure, chemin = A.description.chemin (constitutifs :
//             un constat réel sans son domaine ni son chemin n'est pas autonome) ; constat = le constat réel trouvé à ce chemin dans l'issue de X
//             (même producteur de constats que l'avant : { type[, valeur] }). ABSENCE : X existe mais le chemin n'existe pas dans son issue →
//             `apres` SANS clé `constat` (la confrontation existe ; aucun pseudo-constat). « Aucune conséquence » ne produit, lui, aucune
//             confrontation : les deux cas ne se confondent jamais.
//   Aucun statut : realisee / autre / absente reste dérivable de (avant, apres) par l'égalité existante des constats ; il n'est ni porté ni lu.
//   PREUVE : ABSENTE de la confrontation (aucune étape de la confrontation ne la consomme) ; elle reste accessible dans la ligne A (identite[0]).
//   sansConsequence : [A.id] des attentes sans aucune conséquence vécue (faits persistants, pas des confrontations).
//   ORDRE : celui de lignesAttentes puis celui des conséquences rendu par la vue plurielle — SANS signification : aucune lecture ne doit en
//   dépendre (les tests comparent des ensembles).
// ERREURS : entrées non tabulaires, contexte référencé absent, ligne illisible, identité de confrontation dupliquée : TypeError (aucun résultat
//   partiel) ; les erreurs des vues composées se propagent telles quelles.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
// NON BRANCHÉE : aucun mécanisme (choix, initiative, besoin, stratégie, production, émission, observation) ne l'importe (gardé par test).
import { issuesDeLAttenteProspective } from './issue-attente-prospective.js';
import { rolesDeLAttente } from './roles-attente.js';

const NOM = 'confrontationsDAttentes';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

const copierConstat = (constat) => {
  const copie = { type: constat.type };
  if (Object.hasOwn(constat, 'valeur')) copie.valeur = constat.valeur;
  return copie;
};

export function confrontationsDAttentes(lignesAttentes, lignesContextes, lignesValeurs, lignesExecutions, descriptions) {
  if (!Array.isArray(lignesAttentes) || !Array.isArray(lignesContextes)) refuser('lignesAttentes et lignesContextes doivent être des tableaux');
  const confrontations = [];
  const sansConsequence = [];
  const vues = new Set();
  lignesAttentes.forEach((ligne, rang) => {
    const { occurrence, description, references } = rolesDeLAttente(ligne);
    const contexte = lignesContextes.find((c) => c !== null && typeof c === 'object' && c.id === references.idContexte);
    if (contexte === undefined) refuser(`lignesAttentes[${rang}] référence un contexte « ${references.idContexte} » absent de lignesContextes`);
    const issues = issuesDeLAttenteProspective(ligne, contexte, lignesValeurs, lignesExecutions, descriptions);
    if (issues.length === 0) { sansConsequence.push(occurrence.id); return; }
    for (const issue of issues) {
      const identite = [occurrence.id, issue.issue.idExecution];
      const cle = JSON.stringify(identite);
      if (vues.has(cle)) refuser(`confrontation dupliquée ${cle}`);
      vues.add(cle);
      const apres = { domaine: structuredClone(description.structure), chemin: structuredClone(description.chemin) };
      if (Object.hasOwn(issue, 'reel')) apres.constat = copierConstat(issue.reel);
      confrontations.push({ identite, avant: structuredClone(description), apres });
    }
  });
  return { confrontations, sansConsequence };
}
// === FIN_LANGAGE_CONFRONTATIONS_ATTENTES ===
