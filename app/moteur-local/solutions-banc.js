// === DEBUT_SOLUTIONS_BANC ===
// Exécute le banc comparatif : les mêmes questions, les mêmes faits, la même graine, pour les sept
// approches. Enregistre chaque essai immédiatement (même journal séparé que le grand banc, autre
// préfixe d'identifiant) et conserve TOUTES les sorties brutes, y compris les étapes intermédiaires.

import { MEMOIRE_TEST, QUESTIONS, GRAINE_COMPARAISON } from './solutions-memoire.js';
import { APPROCHES, preparerApproche } from './solutions-approches.js';
import { elementsDistinctifs } from './classement.js';

export const PREFIXE_IDS = 'solutions';

const sansAccents = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const contient = (texte, valeur) => sansAccents(texte).includes(sansAccents(valeur));
const IGNORANCE = /\b(je ne sais pas|je l'ignore|je ne me souviens pas|je n'ai (pas|aucun)e? (cette |d')?(information|souvenir|idée)|aucun souvenir|pas d'information|ne fait pas partie)\b/i;

// Vérification déterministe minimale (approche 4, et mesure « aucune invention » partout) :
// quels éléments distinctifs de la réponse n'apparaissent nulle part dans ce qui a été autorisé ?
export function verifierAjouts(reponse, autorise) {
  return elementsDistinctifs(reponse).filter((m) => !contient(autorise, m));
}

// Les 8 mesures demandées, calculées sur une réponse finale.
export function mesurer({ q, fait, reponse, autorise, appels, dureeMs, formatAttendu }) {
  const absente = !fait;
  const factCorrect = !absente && contient(reponse, fait.valeur);
  const ajouts = verifierAjouts(reponse, autorise);
  const avoue = IGNORANCE.test(reponse);
  // Référent : sur une question à la 1re personne (Christophe parle de lui), une réponse correcte
  // s'adresse à lui (tu/ton/ta) et ne s'approprie pas le fait (je suis/j'ai/j'habite).
  // Sur une question portant sur Naissance elle-même, c'est l'inverse : le « je » est attendu.
  const sApproprie = /\b(je suis|j'ai\b|j'habite|ma couleur|mon fils|ma ville|mon plat)\b/i.test(reponse);
  const tutoie = /\b(tu|ton|ta|tes|toi)\b/i.test(reponse);
  const parleDElle = /\b(je|mon|ma|mes)\b/i.test(reponse);
  let referentCorrect;
  if (q.sujet === 'Naissance') referentCorrect = parleDElle;
  else if (q.personne === 'troisieme') referentCorrect = !sApproprie;
  else referentCorrect = tutoie && !sApproprie;
  const motsReponse = reponse.trim().split(/\s+/).filter(Boolean).length;
  return {
    faitCorrect: factCorrect,
    referentCorrect,
    aucuneInvention: ajouts.length === 0,
    ajouts,
    absenceReconnue: absente ? (avoue && !ajouts.length) : null,
    formatRespecte: formatAttendu === 'valeur-seule' ? motsReponse <= 4 : true,
    mots: motsReponse,
    appels,
    dureeMs,
  };
}

// essai({ prefixe, elements, limite, seed }) → { texte, mesures } : fourni par l'appli.
export async function executerEssai({ approche, q, memoire = MEMOIRE_TEST, essai, graine = GRAINE_COMPARAISON, horloge = () => new Date() }) {
  const plan = preparerApproche(approche, q, memoire);
  const debut = Date.now();
  const sorties = [];
  let appels = 0;
  let reponse;
  let refusee = false;

  if (plan.refusAvantModele) {
    // Naissance constate l'absence sans consulter le modèle : aucune invention possible.
    reponse = plan.refusAvantModele;
  } else {
    for (const e of plan.etapes) {
      const r = await essai({ prefixe: e.prefixe, elements: e.elements, limite: e.limite, seed: graine });
      appels++;
      sorties.push({ etape: e.nom, texte: r.texte, prefixe: e.prefixe, elements: e.elements });
    }
    reponse = sorties.at(-1).texte;
  }

  const autorise = [
    plan.fait ? plan.fait.phrase : '',
    plan.fait ? plan.fait.valeur : '',
    q.question,
    ...(plan.etapes || []).flatMap((e) => [e.prefixe, ...e.elements.map((x) => x.texte)]),
    plan.refusAvantModele || '',
  ].join('\n');

  // Approche 5 : la valeur ne vient jamais du modèle. Si elle a été altérée, on retombe sur la
  // phrase construite par Naissance — et on le note.
  let secoursUtilise = false;
  if (plan.valeurProtegee && !plan.refusAvantModele) {
    if (!contient(reponse, plan.valeurProtegee)) {
      reponse = plan.secours;
      secoursUtilise = true;
    }
  }
  // Approche 4 : vérification après coup ; on note ce qui serait rejeté, sans réécrire la réponse.
  let verification = null;
  if (plan.verifier) {
    const ajouts = verifierAjouts(reponse, autorise);
    verification = { ajouts, accepte: ajouts.length === 0 };
    refusee = !verification.accepte;
  }

  const dureeMs = Date.now() - debut;
  return {
    id: `${PREFIXE_IDS}/${approche}/${q.id}`,
    date: horloge().toISOString(),
    approche, question: q.question, questionId: q.id, categorie: q.categorie, personne: q.personne,
    faitAttendu: plan.fait ? plan.fait.valeur : null,
    appelEvite: !!plan.refusAvantModele,
    sorties,
    reponseBrute: reponse,
    secoursUtilise,
    verification,
    refusee,
    graine,
    mesures: mesurer({
      q, fait: plan.fait, reponse, autorise, appels, dureeMs,
      formatAttendu: approche === 'contrainte' ? 'valeur-seule' : 'libre',
    }),
  };
}

export function planComplet(questions = QUESTIONS, approches = Object.keys(APPROCHES)) {
  const liste = [];
  for (const approche of approches) for (const q of questions) liste.push({ approche, q });
  return liste;
}

// --- Rapport comparatif ------------------------------------------------------------------------
const pct = (n, total) => (total ? `${Math.round((n / total) * 100)} %` : '—');

export function rapportComparatif(essais) {
  const parApproche = new Map();
  for (const e of essais) {
    if (!parApproche.has(e.approche)) parApproche.set(e.approche, []);
    parApproche.get(e.approche).push(e);
  }
  const lignes = ['BANC COMPARATIF DE SOLUTIONS — RÉSULTATS', ''];
  lignes.push('Toutes les approches : mêmes faits, mêmes questions, même graine, même modèle (LFM2-350M Q4_0).');
  lignes.push('');
  for (const [approche, liste] of parApproche) {
    const avecFait = liste.filter((e) => e.faitAttendu !== null);
    const absentes = liste.filter((e) => e.faitAttendu === null);
    const appels = liste.reduce((t, e) => t + e.mesures.appels, 0);
    const duree = liste.reduce((t, e) => t + e.mesures.dureeMs, 0);
    lignes.push(`=== ${APPROCHES[approche] || approche} ===`);
    lignes.push(`  Fait correct         : ${avecFait.filter((e) => e.mesures.faitCorrect).length}/${avecFait.length} (${pct(avecFait.filter((e) => e.mesures.faitCorrect).length, avecFait.length)})`);
    lignes.push(`  Référent correct     : ${avecFait.filter((e) => e.mesures.referentCorrect).length}/${avecFait.length} (${pct(avecFait.filter((e) => e.mesures.referentCorrect).length, avecFait.length)})`);
    lignes.push(`  Aucune invention     : ${avecFait.filter((e) => e.mesures.aucuneInvention).length}/${avecFait.length} (${pct(avecFait.filter((e) => e.mesures.aucuneInvention).length, avecFait.length)})`);
    lignes.push(`  Absence reconnue     : ${absentes.filter((e) => e.mesures.absenceReconnue).length}/${absentes.length}${absentes.some((e) => e.appelEvite) ? ` (dont ${absentes.filter((e) => e.appelEvite).length} sans appeler le modèle)` : ''}`);
    lignes.push(`  Format respecté      : ${liste.filter((e) => e.mesures.formatRespecte).length}/${liste.length}`);
    lignes.push(`  Longueur moyenne     : ${Math.round(liste.reduce((t, e) => t + e.mesures.mots, 0) / Math.max(1, liste.length))} mots`);
    lignes.push(`  Appels LFM2          : ${appels} pour ${liste.length} questions`);
    lignes.push(`  Temps total          : ${(duree / 1000).toFixed(1)} s`);
    lignes.push('');
  }
  lignes.push('DÉTAIL DES RÉPONSES');
  lignes.push('');
  for (const [approche, liste] of parApproche) {
    lignes.push(`=== ${APPROCHES[approche] || approche} ===`);
    for (const e of liste) {
      lignes.push(`— ${e.questionId} (${e.categorie}) : ${e.question}`);
      lignes.push(`  Réponse : ${e.reponseBrute}`);
      if (e.appelEvite) lignes.push('  (aucun appel au modèle : absence constatée par Naissance)');
      if (e.secoursUtilise) lignes.push('  (valeur protégée altérée par le modèle → phrase de secours de Naissance)');
      if (e.verification) lignes.push(`  Vérification : ${e.verification.accepte ? 'acceptée' : `rejetée — ajouts non autorisés : ${e.verification.ajouts.join(', ')}`}`);
      if (e.sorties.length > 1) {
        for (const s of e.sorties.slice(0, -1)) lignes.push(`  Étape « ${s.etape} » : ${s.texte}`);
      }
      const m = e.mesures;
      lignes.push(`  Fait correct : ${m.faitCorrect ? 'oui' : 'non'} · référent : ${m.referentCorrect ? 'oui' : 'non'} · ajouts : ${m.ajouts.length ? m.ajouts.join(', ') : 'aucun'} · ${m.mots} mots · ${m.appels} appel(s)`);
      lignes.push('');
    }
  }
  return lignes.join('\n');
}
// === FIN_SOLUTIONS_BANC ===
