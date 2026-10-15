// === DEBUT_LANGAGE_EXPERIENCES_SITUEES ===
// N3b-0 — « RELIRE UN ACTE DANS LA SITUATION OÙ IL A ÉTÉ VÉCU » (GO ChatGPT « N3b-0 », 15/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE.
// Aucune écriture, aucune table, aucun horodatage, aucun hasard. Lue UNIQUEMENT par le panneau Diagnostic (main.js → conversation/ecran.js) :
// aucun mécanisme de décision, d'examen, de proposition, d'apprentissage, de besoin, de moyen, de stratégie, d'occasion, d'initiative, de forme
// ni de correction apprise ne la lit (garde statique, tests/experiences-situees.test.mjs).
//
// ACQUIS (formulation maximale) : à partir des traces conservées d'une proposition de résolution vécue (ligne proposition de actesResolution),
// relire les éléments historiques qui l'entouraient, distinguer ceux que Naissance POSSÈDE (historique) de ceux qu'elle RECONSTRUIT aujourd'hui
// (relecture), retrouver l'issue de CET acte et, s'il a été confirmé, le résultat historique qui en a découlé et dire s'il est encore actuel.
//
// experiencesSitueesDeResolution(actes, lignes, esprit[, declarations]) -> [experience]  : UNE entrée par ligne proposition, dans l'ordre des
//   lignes reçues (aucune signification), jamais d'entrée sans proposition, jamais de fusion de deux Q, aucun classement, aucun compte.
// experienceSitueeDeResolution(proposition, lignes, actes, esprit[, declarations]) -> experience
//   actes  : lignes de actesResolution ; lignes : lireLignesDivergences (réponses attendues, énoncés, traces, valeurs, réponses locales,
//            manifestations) ; esprit : seulement pour dire si le résultat d'une confirmation est ENCORE ACTUEL ; declarations : { capacites,
//            projectionRepondre } (défaut : les déclarations COURANTES du registre et du pont) — seule la relecture en dépend.
//   experience = {
//     acte:      { idReponseAttendue (Q), idMessage (E), ancien, nouveau }                       — copies de la ligne proposition ;
//     situation: {
//       historique: { question, attendu, reaction, reponseProduite, absences }                 — données PERSISTÉES seulement ;
//       relecture:  { statut: 'relue', base: 'declaration-courante', contraintes, delivre, valeurDelivree, porteeSurIdentite }
//                 | { statut: 'non-relue' }                                                    — RECONSTRUITE aujourd'hui avec le code courant ;
//     },
//     issue:     { nature: 'ouverte' | 'annulee' | 'perimee' | 'confirmee'[, raison] }          — telle quelle, sans valence ;
//     apres:     confirmee → { manifestation, faitResultant, resultatActuel } (manifestation null + absence si introuvable) ;
//                sinon     → { ecritureCognitive: 'aucune' } (constat du chemin .25 : P n'a rien écrit ; aucun état après fabriqué).
//   }
//   absences (fermées) : 'reponse-attendue-absente' | 'question-introuvable' | 'reaction-absente' | 'reponse-produite-introuvable' |
//                        'obtenu-non-persiste' (voie trace : l'obtenu n'est lisible qu'au travers d'une capacité courante) | 'appui-incoherent'.
//
// CE QUI N'EST JAMAIS AFFIRMÉ : que l'ancien était le fait COURANT au moment de P (non observé, non persisté) ; une finalité, un objectif, un
// succès, une récompense ; une qualité de l'acte d'après son issue ; une ressemblance entre deux actes ou deux situations (aucune fonction ne
// compare deux expériences) ; une correction de l'histoire par le fait actuel.
import { CAPACITES } from './registre.js';
import { PROJECTION_REPONDRE_FAIT } from './pont.js';
import { canoniser } from './canon.js';
import { cleFait } from './connaissances.js';
import { divergencesDeReponses } from './divergences.js';
import { localiserDivergences } from './divergences-localisees.js';

const tableau = (x) => (Array.isArray(x) ? x.filter((l) => l && typeof l === 'object') : []);
const estChaine = (x) => typeof x === 'string' && x.length > 0;
const CHAMPS = ['sujet', 'relation', 'valeur'];
const estFait = (a) => Boolean(a) && typeof a === 'object' && CHAMPS.every((c) => typeof a[c] === 'string');
const copieFait = (a) => ({ sujet: a.sujet, relation: a.relation, valeur: a.valeur });

export const ABSENCES_SITUATION = Object.freeze(['reponse-attendue-absente', 'question-introuvable', 'reaction-absente', 'reponse-produite-introuvable', 'obtenu-non-persiste', 'appui-incoherent']);

// Partie HISTORIQUE : lignes persistées seulement (texte du message Q, réponse attendue, énoncé E et sa cible, réponse produite).
function historique(p, lignes) {
  const absences = [];
  const r = tableau(lignes.reponses).find((x) => x.idMessage === p.idReponseAttendue);
  if (!r || typeof r.reponse !== 'string') absences.push('reponse-attendue-absente');
  const message = tableau(lignes.valeurs).find((v) => v.id === p.idReponseAttendue);
  const question = message && typeof message.valeur === 'string' ? message.valeur : null;
  if (question === null) absences.push('question-introuvable');
  const enonces = tableau(lignes.enonces).filter((x) => x.idMessage === p.idMessage);
  const enonce = enonces.length === 1 ? enonces[0] : null;
  let reaction = null;
  let reponseProduite = null;
  if (!enonce) absences.push('reaction-absente');
  else {
    reaction = { idMessage: p.idMessage, cible: estChaine(enonce.idReponseLocale) ? { idReponseLocale: enonce.idReponseLocale } : { idTrace: enonce.idTrace } };
    if (estChaine(enonce.idReponseLocale)) {
      const l = tableau(lignes.reponsesLocales).find((x) => x.id === enonce.idReponseLocale);
      if (l && l.idQuestion === p.idReponseAttendue && Array.isArray(l.obtenu)) {
        const prov = l.provenance && typeof l.provenance === 'object' ? l.provenance : {};
        reponseProduite = { voie: prov.voie, idReponseLocale: l.id, obtenu: [...l.obtenu], appuis: tableau(l.appuis).filter(estFait).map(copieFait) };
      }
    } else {
      const t = tableau(lignes.traces).find((x) => x.id === enonce.idTrace);
      if (t && t.idMessage === p.idReponseAttendue) {
        reponseProduite = { voie: 'trace', idTrace: t.id, obtenu: null, appuis: Array.isArray(t.appuis) ? tableau(t.appuis).filter(estFait).map(copieFait) : [] };
        absences.push('obtenu-non-persiste');
      }
    }
    if (!reponseProduite) absences.push('reponse-produite-introuvable');
  }
  if (reponseProduite) {
    // Cohérence de l'appui historique avec acte.ancien (même identité, même valeur canonique) ; jamais réparée avec le présent.
    const memes = reponseProduite.appuis.filter((a) => cleFait(a.sujet, a.relation) === cleFait(p.ancien.sujet, p.ancien.relation));
    if (!memes.length || !memes.every((a) => canoniser(a.valeur) === canoniser(p.ancien.valeur))) absences.push('appui-incoherent');
  }
  return { question, attendu: r && typeof r.reponse === 'string' ? r.reponse : null, reaction, reponseProduite, absences };
}

// Partie RELECTURE : la localisation recalculée aujourd'hui (déclaration COURANTE vérifiée sur les données historiques), pour l'appui de l'acte.
function relecture(p, lignes, declarations) {
  const { capacites = CAPACITES, projectionRepondre = PROJECTION_REPONDRE_FAIT } = declarations || {};
  let entrees;
  try {
    const ds = divergencesDeReponses(lignes, capacites).filter((d) => d.idReponseAttendue === p.idReponseAttendue);
    entrees = localiserDivergences({ divergences: ds, traces: lignes.traces }, capacites, projectionRepondre)
      .filter((x) => estFait(x.appui) && cleFait(x.appui.sujet, x.appui.relation) === cleFait(p.ancien.sujet, p.ancien.relation));
  } catch { entrees = []; }
  if (entrees.length !== 1) return { statut: 'non-relue' };
  const [x] = entrees;
  return { statut: 'relue', base: 'declaration-courante', contraintes: x.projection.contraintes.map((c) => c.champ), delivre: x.projection.delivre, valeurDelivree: x.valeurDelivree, porteeSurIdentite: x.porteeSurIdentite };
}

function resultatEncoreActuel(esprit, f) {
  const id = cleFait(f.sujet, f.relation);
  if (!esprit || !esprit.faits || (esprit.conflitsFaits && esprit.conflitsFaits.has(id))) return false;
  const courant = esprit.faits.get(id);
  return estFait(courant) && canoniser(courant.valeur) === canoniser(f.valeur);
}

export function experienceSitueeDeResolution(proposition, lignes, actes, esprit, declarations) {
  const p = proposition;
  const l = lignes || {};
  const ligneIssue = tableau(actes).find((x) => x.sorte === 'issue' && x.idReponseAttendue === p.idReponseAttendue);
  const issue = !ligneIssue ? { nature: 'ouverte' } : ligneIssue.issue === 'perimee' ? { nature: 'perimee', raison: ligneIssue.raison } : { nature: ligneIssue.issue };
  let apres = { ecritureCognitive: 'aucune' };
  if (issue.nature === 'confirmee') {
    const m = tableau(l.manifestations).find((x) => x.voie && x.voie.nom === 'resolution' && x.voie.idReponseAttendue === p.idReponseAttendue && estFait(x.fait));
    apres = m
      ? { manifestation: { idMessage: m.idMessage, fait: copieFait(m.fait), voie: { ...m.voie } }, faitResultant: copieFait(m.fait), resultatActuel: resultatEncoreActuel(esprit, m.fait) }
      : { manifestation: null, faitResultant: null, resultatActuel: false, absence: 'manifestation-introuvable' };
  }
  return {
    acte: { idReponseAttendue: p.idReponseAttendue, idMessage: p.idMessage, ancien: copieFait(p.ancien), nouveau: copieFait(p.nouveau) },
    situation: { historique: historique(p, l), relecture: relecture(p, l, declarations) },
    issue,
    apres,
  };
}

export function experiencesSitueesDeResolution(actes, lignes, esprit, declarations) {
  return tableau(actes)
    .filter((x) => x.sorte === 'proposition' && estChaine(x.idReponseAttendue) && estChaine(x.idMessage) && estFait(x.ancien) && estFait(x.nouveau))
    .map((p) => experienceSitueeDeResolution(p, lignes, actes, esprit, declarations));
}
// === FIN_LANGAGE_EXPERIENCES_SITUEES ===
