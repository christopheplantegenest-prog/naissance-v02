// === DEBUT_GRAND_BANC ===
// Exécute le plan du grand banc par petits lots, avec une pause entre chaque, et enregistre
// CHAQUE essai dans le journal immédiatement après sa génération — jamais en fin de lot.
// La reprise consiste simplement à relire le journal et sauter les essais déjà présents :
// appuyer de nouveau sur « Reprendre » après une fermeture reprend exactement là où c'était.
// N'écrit jamais dans la mémoire de Naissance ni dans ses mesures/traces courantes.

import { classer } from './classement.js';
import { classerAbsence, classerCompletion } from './grand-banc-classement.js';
import { PROFIL_LFM2 } from './profil.js';
import { placeholderNonResolu } from './grand-banc-plan.js';

export const TAILLE_LOT_PAR_DEFAUT = 8;
export const PAUSE_ENTRE_LOTS_MS = 2500;

function construireEnregistrement({ ligneEssai, r, erreur, date, identite }) {
  const base = {
    id: ligneEssai.id, experience: ligneEssai.experience, condition: ligneEssai.condition,
    repetition: ligneEssai.repetition, date,
    question: ligneEssai.question, sujet: ligneEssai.sujet, attendu: ligneEssai.attendu,
    souvenirsImposes: ligneEssai.souvenirsImposes, sansSouvenirs: ligneEssai.sansSouvenirs,
    sansIdentite: ligneEssai.sansIdentite, identiteCourte: ligneEssai.identiteCourte,
    graineDemandee: ligneEssai.graine, limiteDemandee: ligneEssai.limite,
    parametres: {
      nCtx: PROFIL_LFM2.nCtx, nMax: ligneEssai.limite || PROFIL_LFM2.nMax, ...PROFIL_LFM2.echantillonnage,
    },
  };
  if (erreur) {
    return { ...base, succes: false, erreur: erreur.message || String(erreur) };
  }
  const m = r.mesures || {};
  const dureeEcritureMs = m.ecritureJps > 0 ? ((m.jetonsEcrits || 0) / m.ecritureJps) * 1000 : 0;
  const enreg = {
    ...base, succes: true,
    prefixeEnvoye: r.contexte.prefixe,
    elementsEnvoyes: r.contexte.elements,
    jetonsContexteEstimes: r.contexte.estimation ? r.contexte.estimation.total : null,
    reponseBrute: r.texte,
    graineUtilisee: m.graine ?? null,
    cache: m.cache || null,
    premierMotMs: m.premierMotMs ?? null,
    dureeEcritureMs: Math.round(dureeEcritureMs),
    dureeTotaleMs: Math.round((m.premierMotMs || 0) + dureeEcritureMs),
    lectureJps: m.lectureJps ?? null,
    ecritureJps: m.ecritureJps ?? null,
    raisonFin: m.fin || null,
  };
  const c = classer({ epreuve: ligneEssai, reponse: r.texte, contexte: r.contexte, identite });
  enreg.categorie = c.categorie;
  enreg.details = c.details;
  if (ligneEssai.experience === 'absence') enreg.marqueursAbsence = classerAbsence(c, r.texte);
  if (ligneEssai.experience === 'completion' && c.details.reprise) enreg.marqueursCompletion = classerCompletion(c);
  return enreg;
}

// essai(ligneEssai) → { texte, mesures, contexte } — même contrat que le banc de diagnostic rapide.
// enregistrer(record) → écrit UN essai dans le journal, appelé immédiatement après chacun.
export async function executerLot({
  plan, dejaFaits, essai, enregistrer, identite, tailleLot = TAILLE_LOT_PAR_DEFAUT,
  arret = () => false, surAvancement = () => {}, horloge = () => new Date(),
}) {
  const restants = plan.filter((e) => !dejaFaits.has(e.id));
  const aFaire = restants.slice(0, tailleLot);
  let traites = 0;
  for (const ligneEssai of aFaire) {
    if (arret()) break;
    surAvancement({ id: ligneEssai.id, fait: dejaFaits.size + traites, total: plan.length });
    let record;
    // Garde de sécurité : un gabarit « {mot} » oublié dans la question ou un souvenir imposé
    // ne doit JAMAIS partir vers le moteur (c'est exactement le bug corrigé le 19/09) — l'essai
    // est marqué en échec de préparation, sans la moindre inférence.
    const probleme = placeholderNonResolu(ligneEssai);
    if (probleme) {
      record = construireEnregistrement({
        ligneEssai, r: null,
        erreur: new Error(`Préparation refusée : gabarit non résolu détecté avant envoi au moteur — "${probleme}"`),
        date: horloge().toISOString(), identite,
      });
      await enregistrer(record);
      traites++;
      continue;
    }
    try {
      const r = await essai(ligneEssai);
      record = construireEnregistrement({ ligneEssai, r, erreur: null, date: horloge().toISOString(), identite });
    } catch (e) {
      record = construireEnregistrement({ ligneEssai, r: null, erreur: e, date: horloge().toISOString(), identite });
    }
    await enregistrer(record);
    traites++;
  }
  return { traites, restants: restants.length - traites, termine: restants.length - traites <= 0 };
}

// --- Rapport en deux niveaux -------------------------------------------------------------------

const nb = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '?');

function grouper(essais, cles) {
  const carte = new Map();
  for (const e of essais) {
    const cle = cles.map((c) => e[c]).join('\u0000');
    if (!carte.has(cle)) carte.set(cle, []);
    carte.get(cle).push(e);
  }
  return carte;
}

// Répétabilité : parmi les groupes qui partagent une SEULE graine identique sur tous leurs essais,
// combien de réponses différentes sont sorties ? (Sert surtout à la condition « graine fixe ».)
function repetabilite(essais) {
  const lignes = [];
  for (const [cle, groupe] of grouper(essais.filter((e) => e.succes), ['experience', 'condition'])) {
    const graines = new Set(groupe.map((e) => e.graineDemandee));
    if (graines.size !== 1 || groupe.length < 2 || [...graines][0] == null) continue;
    const reponses = new Set(groupe.map((e) => e.reponseBrute.trim()));
    lignes.push({ experience: groupe[0].experience, condition: groupe[0].condition, graine: [...graines][0], essais: groupe.length, reponsesDifferentes: reponses.size });
  }
  return lignes;
}

function syntheseExperience(nomExperience, plan, essais) {
  const prevu = plan.filter((e) => e.experience === nomExperience).length;
  const de = essais.filter((e) => e.experience === nomExperience);
  const reussis = de.filter((e) => e.succes);
  const echecs = de.length - reussis.length;
  const parCategorie = {};
  for (const e of reussis) parCategorie[e.categorie] = (parCategorie[e.categorie] || 0) + 1;
  const lignes = [
    `— ${nomExperience} — ${prevu} essai(s) prévu(s), ${de.length} réalisé(s), ${echecs} échec(s) technique(s)`,
    ...Object.entries(parCategorie).sort((a, b) => b[1] - a[1]).map(([c, n]) => `    ${c} : ${n}`),
  ];
  if (nomExperience === 'absence') {
    const parMarqueur = {};
    for (const e of reussis) for (const m of e.marqueursAbsence || []) parMarqueur[m] = (parMarqueur[m] || 0) + 1;
    lignes.push('    Détail (information absente) :', ...Object.entries(parMarqueur).map(([m, n]) => `      ${m} : ${n}`));
  }
  if (nomExperience === 'completion') {
    const parMarqueur = {};
    for (const e of reussis) for (const m of e.marqueursCompletion || ['arretee']) parMarqueur[m] = (parMarqueur[m] || 0) + 1;
    lignes.push('    Détail (après le fait vrai) :', ...Object.entries(parMarqueur).map(([m, n]) => `      ${m} : ${n}`));
  }
  const rep = repetabilite(de).filter((r) => r.experience === nomExperience);
  if (rep.length) {
    lignes.push('    Répétabilité à graine fixe :');
    for (const r of rep) lignes.push(`      ${r.condition} (graine ${r.graine}) : ${r.essais} essai(s) → ${r.reponsesDifferentes} réponse(s) différente(s)`);
  }
  return lignes.join('\n');
}

export function rapportSynthese({ plan, essais }) {
  const experiences = [...new Set(plan.map((e) => e.experience))];
  const total = essais.length;
  const reussis = essais.filter((e) => e.succes).length;
  const lignes = [
    'GRAND BANC DE DIAGNOSTIC — SYNTHÈSE',
    `Plan : ${plan.length} essai(s) au total. Journal : ${total} essai(s) fait(s), ${reussis} réussi(s), ${total - reussis} échec(s) technique(s).`,
    '',
    ...experiences.map((exp) => syntheseExperience(exp, plan, essais)),
  ];
  return lignes.join('\n\n');
}

export function rapportBrut({ essais }) {
  const lignes = ['GRAND BANC DE DIAGNOSTIC — DONNÉES BRUTES', ''];
  for (const [cle, groupe] of grouper(essais, ['experience', 'condition'])) {
    const [experience, condition] = cle.split('\u0000');
    lignes.push(`=== ${experience} / ${condition} ===`);
    for (const e of groupe.sort((a, b) => a.repetition - b.repetition)) {
      lignes.push(`— ${e.id} (répétition ${e.repetition}, ${e.date})`);
      lignes.push(`  Question : ${e.question}`);
      if (!e.succes) { lignes.push(`  ERREUR : ${e.erreur}`); lignes.push(''); continue; }
      lignes.push(`  Réponse : ${e.reponseBrute}`);
      lignes.push(`  Classement : ${e.categorie}${e.marqueursAbsence ? ` | absence : ${e.marqueursAbsence.join(', ')}` : ''}${e.marqueursCompletion ? ` | complétion : ${e.marqueursCompletion.join(', ')}` : ''}`);
      lignes.push(`  Souvenirs imposés : ${(e.souvenirsImposes || []).join(' | ') || 'aucun'}${e.sansSouvenirs ? ' (absence forcée)' : ''}`);
      lignes.push(`  Préfixe : ${e.prefixeEnvoye}`);
      lignes.push(`  Graine demandée : ${e.graineDemandee ?? 'aléatoire'} — utilisée : ${e.graineUtilisee ?? '?'}`);
      lignes.push(`  Contexte ≈ ${e.jetonsContexteEstimes} jetons — cache ${e.cache} — premier mot ${nb((e.premierMotMs || 0) / 1000)} s — `
        + `écriture ${nb(e.ecritureJps)} j/s — durée totale ≈ ${nb(e.dureeTotaleMs / 1000)} s — fin : ${e.raisonFin}`);
      lignes.push('');
    }
  }
  return lignes.join('\n');
}
// === FIN_GRAND_BANC ===
