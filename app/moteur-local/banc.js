// === DEBUT_BANC_LOCAL ===
// Petit banc d'essai reproductible : quelques questions, répétées, envoyées au moteur local.
// Il n'écrit RIEN : ni journal, ni souvenirs, ni mémoire. Il sert seulement à mesurer.

export const QUESTIONS_PAR_DEFAUT = [
  "Où j'habite ?",
  'Comment je m’appelle ?',
  'Quelle est ma couleur préférée ?',
  'Salut, comment tu vas ?',
  'Qu’est-ce que tu sais de ma famille ?',
];

export function analyser(resultats) {
  const reussis = resultats.filter((r) => !r.erreur);
  const avecSouvenir = reussis.filter((r) => r.souvenirsInjectes.length > 0);
  const moyenne = (liste, f) => (liste.length ? liste.reduce((s, r) => s + f(r), 0) / liste.length : NaN);
  return {
    essais: resultats.length,
    reussis: reussis.length,
    echecs: resultats.length - reussis.length,
    avecSouvenir: avecSouvenir.length,
    sansSouvenir: reussis.length - avecSouvenir.length,
    premierMotMoyenS: moyenne(reussis, (r) => (r.mesures.premierMotMs || 0) / 1000),
    lectureMoyenne: moyenne(reussis, (r) => r.mesures.lectureJps || 0),
    ecritureMoyenne: moyenne(reussis, (r) => r.mesures.ecritureJps || 0),
    contexteMoyen: moyenne(reussis, (r) => r.jetons.total || 0),
    longueurMoyenne: moyenne(reussis, (r) => r.reponse.length),
  };
}

const nb = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '?');

export function rapport({ variante, resultats }) {
  const a = analyser(resultats);
  const lignes = [
    `Banc du moteur local — contexte ${variante} — ${a.essais} essai(s), ${a.echecs} échec(s)`,
    `Souvenir fourni : ${a.avecSouvenir} fois ; aucun souvenir trouvé : ${a.sansSouvenir} fois`,
    `Moyennes : premier mot ${nb(a.premierMotMoyenS)} s, lecture ${nb(a.lectureMoyenne)} jetons/s, `
      + `écriture ${nb(a.ecritureMoyenne)} jetons/s, contexte ${nb(a.contexteMoyen, 0)} jetons, réponse ${nb(a.longueurMoyenne, 0)} caractères`,
    '',
  ];
  for (const r of resultats) {
    lignes.push(`— essai ${r.numero} — ${r.question}`);
    if (r.erreur) {
      lignes.push(`  ERREUR : ${r.erreur}`);
    } else {
      lignes.push(`  Réponse : ${r.reponse}`);
      lignes.push(`  Souvenirs fournis : ${r.souvenirsInjectes.map((s) => s.texte).join(' | ') || 'aucun'}`);
      lignes.push(`  Souvenirs écartés : ${r.souvenirsEcartes.map((s) => s.texte).join(' | ') || 'aucun'}`);
      lignes.push(`  Contexte ${r.jetons.total} jetons estimés (souvenirs ${r.jetons.souvenirs}) — cache ${r.mesures.cache}`);
      lignes.push(`  Premier mot ${nb((r.mesures.premierMotMs || 0) / 1000)} s — lecture ${nb(r.mesures.lectureJps)} j/s — écriture ${nb(r.mesures.ecritureJps)} j/s`);
    }
    lignes.push('');
  }
  return lignes.join('\n');
}

// essai(question) → { texte, mesures, contexte } (fourni par l'appli, sans écriture en mémoire)
export async function lancerBanc({
  questions = QUESTIONS_PAR_DEFAUT, repetitions = 2, essai, variante = 'court',
  surAvancement = () => {}, arret = () => false,
}) {
  const resultats = [];
  let numero = 0;
  for (let tour = 1; tour <= repetitions; tour++) {
    for (const question of questions) {
      if (arret()) return { variante, resultats, interrompu: true };
      numero++;
      surAvancement({ numero, total: questions.length * repetitions, question, tour });
      try {
        const r = await essai(question);
        const trace = r.contexte.souvenirsTrace || [];
        resultats.push({
          numero,
          tour,
          question,
          reponse: r.texte,
          souvenirsInjectes: trace.filter((s) => s.statut.startsWith('injecté')).map((s) => ({ id: s.id, texte: s.texte })),
          souvenirsEcartes: trace.filter((s) => !s.statut.startsWith('injecté')).map((s) => ({ id: s.id, texte: s.texte })),
          jetons: r.contexte.estimation,
          mesures: r.mesures || {},
        });
      } catch (e) {
        resultats.push({ numero, tour, question, erreur: e.message || String(e), souvenirsInjectes: [], souvenirsEcartes: [], jetons: {}, mesures: {} });
      }
    }
  }
  return { variante, resultats, interrompu: false };
}
// === FIN_BANC_LOCAL ===
