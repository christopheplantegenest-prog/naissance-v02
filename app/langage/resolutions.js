// === DEBUT_LANGAGE_RESOLUTIONS ===
// v0.64.24 — « PROPOSER LA RÉSOLUTION D'UNE INCOMPATIBILITÉ VÉCUE » (GO ChatGPT « v0.64.24 », 15/10/2026). VUES PURES, aucune écriture.
//
// CHAÎNE : production P → réaction corrective E (énoncé) → correction comprise (.20) → Confirmer → réponse attendue R { idMessage: Q, reponse,
// idLecon: E } → divergence D (divergences.js) → localisation (divergences-localisees.js) → SI les conditions ci-dessous tiennent : PROPOSITION
// de résolution (rien n'est écrit avant le Confirmer de Christophe ; main.js porte la proposition par fermeture).
//
// IDENTITÉ DE D : idReponseAttendue (= Q, clé immuable de reponsesAttendues). divergencesDeReponses rend AU PLUS une divergence par réponse
// attendue ; sa cible et ses appuis se recalculent depuis des lignes immuables (invariant épinglé par test).
//
// CONDITIONS (toutes ; sinon abstention, avec une raison) : R existe ; D existe et est unique pour Q ; exactement UNE entrée localisée pour D
// (aucune pluralité causale) ; portée 'incompatible-sous-identite' ; champ délivré = valeur ; contraintes = exactement { sujet, relation } ;
// aucune résolution déjà enregistrée pour Q ; l'identité cleFait(appui.sujet, appui.relation) n'est pas en conflit ; le fait COURANT sous cette
// identité porte une valeur canoniquement égale à celle de l'appui historique ; l'attendu traverse le contrat de fait par la garde aller-retour
// (extraireLecon de « Fait : S / R / V. » rend exactement S, R, V). Aucune lecture de texte affiché, aucune fréquence, aucun score.
//
// TROIS NOTIONS DISTINCTES (+ une) — etatsDivergences :
//   historique : D existe ; active : un appui historique de D est EXACTEMENT le fait courant (cleFait + valeur canonique, sans conflit) ;
//   resolue : une manifestation de voie 'resolution' nomme Q (et seulement elle) ; resultatActuel : le fait de cette manifestation est le fait courant.
// Une divergence devenue non active par un autre changement de fait n'est JAMAIS « résolue ».
import { CAPACITES } from './registre.js';
import { canoniser } from './canon.js';
import { cleFait } from './connaissances.js';
import { divergencesDeReponses, identiteAppui } from './divergences.js';
import { localiserDivergences } from './divergences-localisees.js';
import { extraireLecon } from './lecon.js';

const tableau = (x) => (Array.isArray(x) ? x.filter((l) => l && typeof l === 'object') : []);
const estChaine = (x) => typeof x === 'string' && x.length > 0;
const CHAMPS = ['sujet', 'relation', 'valeur'];
const estFait = (a) => a && typeof a === 'object' && CHAMPS.every((c) => typeof a[c] === 'string');

export const resolutionsEnregistrees = (manifestations) => tableau(manifestations)
  .filter((m) => m.voie && m.voie.nom === 'resolution' && estChaine(m.voie.idReponseAttendue) && estFait(m.fait));

// Le fait COURANT sous l'identité d'un appui, s'il est unique (aucun conflit) ; sinon null.
function faitCourant(esprit, sujet, relation) {
  const id = cleFait(sujet, relation);
  if (esprit && esprit.conflitsFaits && esprit.conflitsFaits.has(id)) return null;
  const f = esprit && esprit.faits ? esprit.faits.get(id) : null;
  return estFait(f) ? f : null;
}
const estCourant = (esprit, a) => { const f = faitCourant(esprit, a.sujet, a.relation); return Boolean(f) && canoniser(f.valeur) === canoniser(a.valeur); };

// examinerResolution(lignes, esprit, idReponseAttendue[, capacites]) -> { proposition } | { raison }. lignes = lireLignesDivergences(magasin).
// proposition = { idReponseAttendue, idMessage (E), question, ancien: { sujet, relation, valeur }, nouveau: { sujet, relation, valeur } }.
export function examinerResolution(lignes, esprit, idReponseAttendue, capacites = CAPACITES) {
  const r = tableau(lignes && lignes.reponses).find((x) => x.idMessage === idReponseAttendue);
  if (!r || !estChaine(r.idLecon) || typeof r.reponse !== 'string') return { raison: 'aucune-reponse-attendue' };
  if (resolutionsEnregistrees(lignes.manifestations).some((m) => m.voie.idReponseAttendue === idReponseAttendue)) return { raison: 'deja-resolue' };
  const ds = divergencesDeReponses(lignes).filter((d) => d.idReponseAttendue === idReponseAttendue);
  if (ds.length !== 1) return { raison: ds.length ? 'divergence-ambigue' : 'aucune-divergence' };
  const entrees = localiserDivergences({ divergences: ds, traces: lignes.traces }, capacites);
  if (entrees.length !== 1) return { raison: entrees.length ? 'pluralite-causale' : 'non-localisee' };
  const [x] = entrees;
  const champs = x.projection.contraintes.map((c) => c.champ);
  if (x.porteeSurIdentite !== 'incompatible-sous-identite' || x.projection.delivre !== 'valeur'
    || champs.length !== 2 || !champs.includes('sujet') || !champs.includes('relation')) return { raison: 'portee-indeterminee' };
  const ancien = { sujet: x.appui.sujet, relation: x.appui.relation, valeur: x.appui.valeur };
  if (!faitCourant(esprit, ancien.sujet, ancien.relation)) return { raison: 'identite-absente-ou-en-conflit' };
  if (!estCourant(esprit, ancien)) return { raison: 'appui-non-actuel' };
  if (!tableau(lignes.enonces).some((y) => y.idMessage === r.idLecon)) return { raison: 'aucune-reaction' };
  const nouveau = { sujet: ancien.sujet, relation: ancien.relation, valeur: r.reponse };
  const retour = extraireLecon(`Fait : ${nouveau.sujet} / ${nouveau.relation} / ${nouveau.valeur}.`);
  const fidele = retour && retour.type === 'fait' && CHAMPS.every((c) => retour.donnees && retour.donnees[c] === nouveau[c]);
  if (!fidele) return { raison: 'attendu-hors-contrat-de-fait' };
  return { proposition: { idReponseAttendue, idMessage: r.idLecon, question: x.question, ancien, nouveau } };
}

// Même proposition (mêmes identités, mêmes valeurs exactes) : sert à la garde de péremption au moment du Confirmer.
export function memeProposition(a, b) {
  return Boolean(a && b) && a.idReponseAttendue === b.idReponseAttendue && a.idMessage === b.idMessage
    && CHAMPS.every((c) => a.ancien[c] === b.ancien[c] && a.nouveau[c] === b.nouveau[c]);
}

// etatsDivergences(lignes, esprit) -> [{ idReponseAttendue, historique: true, active, resolue, resultatActuel }] (une par divergence, ordre de la vue).
export function etatsDivergences(lignes, esprit) {
  const resolutions = resolutionsEnregistrees(lignes && lignes.manifestations);
  return divergencesDeReponses(lignes).map((d) => {
    const m = resolutions.find((x) => x.voie.idReponseAttendue === d.idReponseAttendue) || null;
    return {
      idReponseAttendue: d.idReponseAttendue,
      historique: true,
      active: tableau(d.appuis).some((a) => estFait(a) && estCourant(esprit, a)),
      resolue: m !== null,
      resultatActuel: m !== null && estCourant(esprit, m.fait),
    };
  });
}

// notesResolution(appuisActuels, lignes) -> [texte] : pour chaque appui actuel, chaque résolution dont le fait EST cet appui (identité d'appui)
// et dont la divergence se relit encore (ancienne valeur et question tirées de D, jamais du texte affiché). Sinon : aucune note.
export function notesResolution(appuisActuels, lignes) {
  const resolutions = resolutionsEnregistrees(lignes && lignes.manifestations);
  if (!resolutions.length) return [];
  const ds = divergencesDeReponses(lignes);
  const sortie = [];
  const vus = new Set();
  for (const appui of tableau(appuisActuels).filter(estFait)) {
    const cle = identiteAppui(appui);
    if (vus.has(cle)) continue;
    vus.add(cle);
    for (const m of resolutions.filter((x) => identiteAppui(x.fait) === cle)) {
      const d = ds.find((y) => y.idReponseAttendue === m.voie.idReponseAttendue);
      const ancien = d ? tableau(d.appuis).find((a) => estFait(a) && cleFait(a.sujet, a.relation) === cleFait(m.fait.sujet, m.fait.relation)) : null;
      if (!d || !ancien) continue;
      sortie.push(`Ce que je sais ici (${m.fait.sujet} → ${m.fait.relation} → ${m.fait.valeur}) a remplacé ${ancien.valeur} quand tu as confirmé la résolution de ta correction de « ${d.question === null ? '(question introuvable)' : d.question} ».`);
    }
  }
  return sortie;
}
// === FIN_LANGAGE_RESOLUTIONS ===
