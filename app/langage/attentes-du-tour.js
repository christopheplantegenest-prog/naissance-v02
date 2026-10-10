// === DEBUT_LANGAGE_ATTENTES_DU_TOUR ===
// v0.63.78 — « RENDRE VISIBLES LES ATTENTES DU TOUR ET LEURS ISSUES » (décision ChatGPT, 09/10/2026 — jalon 1 de la reprise). LECTURE SEULE.
//
// Ce module ne décide rien, n'écrit rien et ne modifie aucun mécanisme : il PRÉSENTE, pour l'outil de développement de la bulle (zone
// « Sollicitation »), les attentes prospectives que les exécutions d'UN tour ont écrites AVANT leur issue, et l'issue de chacune lorsqu'elle
// est disponible (issueDeLAttenteProspective, .75 : seule autorité sur « après »). Aucune règle nouvelle, aucun seuil, aucun choix, aucune
// lecture par un mécanisme vivant (esprit, réponse, choix, exécution) : le seul consommateur est l'écran, par main.js, après le lot mécanique.
//
// attentesDesResultats(resultats, lignesAttentes, lignesContextes, lignesValeurs, lignesExecutions, descriptions) -> [ligne]
//   resultats : le lot réel du déclencheur mécanique ({ operation, statut, designation, execution, erreur } par application exécutée) ;
//   lignesAttentes / lignesContextes / lignesValeurs / lignesExecutions / descriptions : le magasin tel qu'il existe APRÈS le lot.
//   Une ligne par attente persistée dont idDesignation est la désignation d'un résultat du lot, dans l'ordre persistant de la table (non
//   sémantique). LIGNE = { idAttente, idDesignation, operation, horodatageAttente, structure, chemin, constat, issue[, erreur] }
//     structure : texte « op(e1,e2)>op2(...) » ; chemin : texte « a.b.c » ; constat : { type[, valeur] } (copie) ;
//     issue : null si aucune exécution ne porte la désignation (rien n'est advenu : « sans issue ») ;
//             sinon { idExecution, horodatageExecution, statut, reel? } avec statut 'realisee' | 'autre' | 'absente' tel que .75 le rend ;
//     erreur : message, seulement si la vue .75 a refusé cette attente (jamais masqué, jamais étendu aux autres).
//   PURETÉ : aucune écriture, aucune horloge, aucun état ; entrées jamais modifiées ; sorties neuves.
//
// lireAttentesDuLot(lot, magasin, descriptions) -> { attentes, echec }
//   Lit les quatre tables nécessaires (lecture seule) puis appelle attentesDesResultats. Tout échec de lecture ou de calcul est rendu dans
//   `echec` (l'erreur d'origine) avec attentes = [] : jamais levé, jamais masqué, jamais bloquant pour le tour.
import { issueDeLAttenteProspective } from './issue-attente-prospective.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';
// v0.63.83 — les issues sont calculées sur le même vécu que les attentes : exécutions réelles + synthétiques (réceptions déclarées).
import { lireExecutionsVecues } from './executions-vecues.js';

const NOM = 'attentesDesResultats';

const texteStructure = (structure) => structure.map((etape) => `${etape.operation}(${etape.entrees.join(',')})`).join('>');
const copierConstat = (constat) => {
  const copie = { type: constat.type };
  if (Object.hasOwn(constat, 'valeur')) copie.valeur = constat.valeur;
  return copie;
};

export function attentesDesResultats(resultats, lignesAttentes, lignesContextes, lignesValeurs, lignesExecutions, descriptions) {
  if (!Array.isArray(resultats)) throw new TypeError(`${NOM} : resultats doit être un tableau.`);
  for (const [nom, l] of [['lignesAttentes', lignesAttentes], ['lignesContextes', lignesContextes], ['lignesValeurs', lignesValeurs], ['lignesExecutions', lignesExecutions], ['descriptions', descriptions]]) {
    if (!Array.isArray(l)) throw new TypeError(`${NOM} : ${nom} doit être un tableau.`);
  }
  const operationParDesignation = new Map();
  for (const r of resultats) {
    if (r !== null && typeof r === 'object' && r.designation !== null && typeof r.designation === 'object' && typeof r.designation.id === 'string') {
      operationParDesignation.set(r.designation.id, r.operation);
    }
  }
  const lignes = [];
  for (const attente of lignesAttentes) {
    if (attente === null || typeof attente !== 'object' || !operationParDesignation.has(attente.idDesignation)) continue;
    const ligne = {
      idAttente: attente.id,
      idDesignation: attente.idDesignation,
      operation: operationParDesignation.get(attente.idDesignation),
      horodatageAttente: attente.horodatage,
      structure: Array.isArray(attente.structure) ? texteStructure(attente.structure) : '',
      chemin: Array.isArray(attente.chemin) ? attente.chemin.join('.') : '',
      constat: attente.constat && typeof attente.constat === 'object' ? copierConstat(attente.constat) : { type: '' },
      issue: null,
    };
    const contexte = lignesContextes.find((c) => c !== null && typeof c === 'object' && c.id === attente.idContexte);
    try {
      if (contexte === undefined) throw new TypeError(`${NOM} : contexte « ${attente.idContexte} » introuvable.`);
      const vue = issueDeLAttenteProspective(attente, contexte, lignesValeurs, lignesExecutions, descriptions);
      if (vue.issue !== null) {
        const execution = lignesExecutions.find((e) => e !== null && typeof e === 'object' && e.id === vue.issue.idExecution);
        ligne.issue = { idExecution: vue.issue.idExecution, horodatageExecution: execution ? execution.horodatage : null, statut: vue.statut };
        if (Object.hasOwn(vue, 'reel')) ligne.issue.reel = copierConstat(vue.reel);
      }
    } catch (erreur) {
      ligne.erreur = erreur && erreur.message ? erreur.message : String(erreur);
    }
    lignes.push(ligne);
  }
  return lignes;
}

export async function lireAttentesDuLot(lot, magasin, descriptions = DESCRIPTIONS_OPERATIONS) {
  try {
    const resultats = lot !== null && typeof lot === 'object' && Array.isArray(lot.resultats) ? [...lot.resultats] : [];
    // v0.63.83 — les émissions du lot sont des actes prospectifs : leurs attentes sont présentées sous l'opération « environnement:<nom> ».
    if (lot !== null && typeof lot === 'object' && Array.isArray(lot.emises)) for (const e of lot.emises) if (e && typeof e.idEmission === 'string') resultats.push({ operation: 'environnement:conversation', statut: 'executee', designation: { id: e.idEmission }, execution: null, erreur: null });
    // v0.63.84 — B1 : la variation de capacité d'un tour ACTIF est un acte prospectif sur soi : ses attentes sont présentées sous « soi:tour » (ancrage = cause.id).
    if (lot !== null && typeof lot === 'object' && lot.capacite && lot.capacite.variation && lot.capacite.variation.cause && typeof lot.capacite.variation.cause.id === 'string') resultats.push({ operation: 'soi:tour', statut: 'executee', designation: { id: lot.capacite.variation.cause.id }, execution: null, erreur: null });
    if (resultats.length === 0) return { attentes: [], echec: null };
    const [lignesAttentes, lignesContextes, vecu] = await Promise.all([
      magasin.lireTout('attentesProspectives'),
      magasin.lireTout('contextesProspectifs'),
      lireExecutionsVecues(magasin, descriptions),
    ]);
    return { attentes: attentesDesResultats(resultats, lignesAttentes, lignesContextes, vecu.valeurs, vecu.executions, vecu.descriptions), echec: null };
  } catch (echec) {
    return { attentes: [], echec };
  }
}
// === FIN_LANGAGE_ATTENTES_DU_TOUR ===
