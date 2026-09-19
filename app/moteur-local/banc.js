// === DEBUT_BANC_LOCAL ===
// Banc de diagnostic reproductible : des épreuves, répétées, envoyées au moteur local.
// Il n'écrit RIEN : ni journal, ni souvenirs, ni mémoire. Il sert seulement à observer.

import { epreuves as epreuvesDu, PROTOCOLES, GROUPES } from './protocoles.js';
import { classer, variabilite, CATEGORIES } from './classement.js';

export { PROTOCOLES, GROUPES };

export const QUESTIONS_PAR_DEFAUT = [
  "Où j'habite ?",
  'Comment je m’appelle ?',
  'Quelle est ma couleur préférée ?',
  'Salut, comment tu vas ?',
  'Qu’est-ce que tu sais de ma famille ?',
];

// Questions libres tapées à la main → épreuves sans attente particulière.
export const enEpreuves = (questions) => questions.map((question, i) => ({
  id: `libre-${i + 1}`, groupe: 'libre', question, sujet: 'personne', attendu: 'fait',
}));

const nb = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '?');

export function analyser(resultats) {
  const reussis = resultats.filter((r) => !r.erreur);
  const moyenne = (liste, f) => (liste.length ? liste.reduce((s, r) => s + f(r), 0) / liste.length : NaN);
  const parCategorie = {};
  for (const r of reussis) parCategorie[r.categorie] = (parCategorie[r.categorie] || 0) + 1;
  return {
    essais: resultats.length,
    reussis: reussis.length,
    echecs: resultats.length - reussis.length,
    parCategorie,
    avecSouvenir: reussis.filter((r) => r.souvenirsInjectes.length > 0).length,
    sansSouvenir: reussis.filter((r) => r.souvenirsInjectes.length === 0).length,
    premierMotMoyenS: moyenne(reussis, (r) => (r.mesures.premierMotMs || 0) / 1000),
    lectureMoyenne: moyenne(reussis, (r) => r.mesures.lectureJps || 0),
    ecritureMoyenne: moyenne(reussis, (r) => r.mesures.ecritureJps || 0),
    contexteMoyen: moyenne(reussis, (r) => r.jetons.total || 0),
    longueurMoyenne: moyenne(reussis, (r) => r.reponse.length),
  };
}

function resumeCategories(parCategorie, total) {
  const lignes = Object.entries(parCategorie)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `  ${CATEGORIES[c] || c} : ${n} (${Math.round((n / Math.max(1, total)) * 100)} %)`);
  return lignes.length ? lignes.join('\n') : '  (aucun essai classé)';
}

export function rapport({ variante, protocole, resultats }) {
  const a = analyser(resultats);
  const groupes = [...new Set(resultats.map((r) => r.groupe))];
  const lignes = [
    `Diagnostic du moteur local — protocole « ${PROTOCOLES[protocole] || protocole} » — contexte ${variante}`,
    `${a.essais} essai(s), ${a.echecs} échec(s) technique(s) ; souvenir fourni ${a.avecSouvenir} fois, aucun ${a.sansSouvenir} fois`,
    `Moyennes : premier mot ${nb(a.premierMotMoyenS)} s, lecture ${nb(a.lectureMoyenne)} jetons/s, `
      + `écriture ${nb(a.ecritureMoyenne)} jetons/s, contexte ${nb(a.contexteMoyen, 0)} jetons, réponse ${nb(a.longueurMoyenne, 0)} caractères`,
    '',
    'CLASSEMENT AUTOMATIQUE (approximatif — les réponses brutes sont plus bas)',
    resumeCategories(a.parCategorie, a.reussis),
    '',
  ];

  for (const groupe of groupes) {
    const duGroupe = resultats.filter((r) => r.groupe === groupe && !r.erreur);
    if (!duGroupe.length) continue;
    const parCat = {};
    for (const r of duGroupe) parCat[r.categorie] = (parCat[r.categorie] || 0) + 1;
    lignes.push(`GROUPE ${GROUPES[groupe] || groupe} — ${duGroupe.length} essai(s)`);
    lignes.push(resumeCategories(parCat, duGroupe.length));
    lignes.push('');
  }

  lignes.push('STABILITÉ (mêmes épreuves répétées)');
  for (const v of variabilite(resultats.filter((r) => !r.erreur))) {
    lignes.push(`  ${v.epreuve} : ${v.essais} essai(s), ${v.reponsesDifferentes} réponse(s) différente(s)`
      + `${v.memeCategorie ? '' : ` — classements différents : ${v.categories.join(', ')}`}`);
  }
  lignes.push('');
  lignes.push('DÉTAIL DES ESSAIS');
  for (const r of resultats) {
    lignes.push(`— ${r.numero}. [${r.groupe}] ${r.epreuve} — « ${r.question} »`);
    if (r.erreur) {
      lignes.push(`  ERREUR : ${r.erreur}`);
    } else {
      lignes.push(`  Réponse : ${r.reponse}`);
      lignes.push(`  Classement : ${CATEGORIES[r.categorie] || r.categorie}`
        + `${r.details.confusion.length ? ` | confusion : ${r.details.confusion.join(' ; ')}` : ''}`
        + `${r.details.inventions.length ? ` | inventé : ${r.details.inventions.join(', ')}` : ''}`
        + `${r.details.avoue ? ' | dit ne pas savoir' : ''}`);
      lignes.push(`  Souvenirs fournis : ${r.souvenirsInjectes.map((s) => `${s.texte} [${s.statut}]`).join(' | ') || 'aucun'}`);
      if (r.souvenirsEcartes.length) lignes.push(`  Souvenirs écartés : ${r.souvenirsEcartes.map((s) => s.texte).join(' | ')}`);
      lignes.push(`  Contexte ${r.jetons.total} jetons (souvenirs ${r.jetons.souvenirs}) — cache ${r.mesures.cache} — `
        + `premier mot ${nb((r.mesures.premierMotMs || 0) / 1000)} s — lecture ${nb(r.mesures.lectureJps)} j/s — écriture ${nb(r.mesures.ecritureJps)} j/s`
        + `${r.limite ? ` — limite ${r.limite} jetons` : ''}`);
    }
    lignes.push('');
  }
  return lignes.join('\n');
}

// essai(epreuve) → { texte, mesures, contexte } (fourni par l'appli, sans aucune écriture)
export async function lancerBanc({
  protocole = 'complet', questions = null, repetitions = 2, essai, identite = null,
  variante = 'court', surAvancement = () => {}, arret = () => false,
}) {
  const liste = questions && questions.length
    ? enEpreuves(questions)
    : epreuvesDu(protocole, identite ? { personne: identite.personne, ia: identite.ia } : {});
  const resultats = [];
  let numero = 0;
  for (let tour = 1; tour <= repetitions; tour++) {
    for (const epreuve of liste) {
      if (arret()) return { variante, protocole, resultats, interrompu: true };
      numero++;
      surAvancement({ numero, total: liste.length * repetitions, question: epreuve.question, tour });
      try {
        const r = await essai(epreuve);
        const trace = r.contexte.souvenirsTrace || [];
        const { categorie, details } = classer({ epreuve, reponse: r.texte, contexte: r.contexte, identite });
        resultats.push({
          numero, tour, epreuve: epreuve.id, groupe: epreuve.groupe, question: epreuve.question,
          limite: epreuve.limite || null,
          reponse: r.texte,
          categorie,
          details,
          souvenirsInjectes: trace.filter((s) => /^(injecté|imposé)/.test(s.statut)).map((s) => ({ id: s.id, texte: s.texte, statut: s.statut })),
          souvenirsEcartes: trace.filter((s) => !/^(injecté|imposé)/.test(s.statut)).map((s) => ({ id: s.id, texte: s.texte })),
          jetons: r.contexte.estimation,
          mesures: r.mesures || {},
        });
      } catch (e) {
        resultats.push({
          numero, tour, epreuve: epreuve.id, groupe: epreuve.groupe, question: epreuve.question,
          erreur: e.message || String(e), souvenirsInjectes: [], souvenirsEcartes: [], jetons: {}, mesures: {}, details: {},
        });
      }
    }
  }
  return { variante, protocole, resultats, interrompu: false };
}
// === FIN_BANC_LOCAL ===
