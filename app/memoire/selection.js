// === DEBUT_SELECTION_SOUVENIRS ===
// Choisit les souvenirs actifs à transmettre au moteur, dans un budget en caractères.
// Tous s'ils tiennent ; sinon : importance 3, puis mots en commun avec le message,
// puis importance et rappels récents. Plus tard : recherche par le sens, même interface.

const MOTS_VIDES = new Set([
  'avec', 'dans', 'pour', 'mais', 'plus', 'moins', 'tout', 'tous', 'toute', 'toutes', 'cette', 'cela',
  'comme', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'elle', 'elles', 'nous', 'vous', 'leur', 'leurs',
  'sont', 'etait', 'etre', 'avoir', 'fait', 'faire', 'suis', 'sera', 'aussi', 'donc', 'alors', 'encore',
  'tres', 'bien', 'sans', 'sous', 'chez', 'entre', 'depuis', 'quand', 'parce', 'ceux', 'celle', 'celui',
  'naissance', 'est-ce', 'peux', 'veux', 'dois', 'ton', 'tes', 'mon', 'mes',
]);

export function motsCles(texte) {
  return new Set(
    String(texte || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)),
  );
}

export const taillePourBudget = (s) => s.texte.length + 40;

function communs(a, b) {
  let n = 0;
  for (const m of a) if (b.has(m)) n++;
  return n;
}

// Renvoie { choisis, pertinents } : pertinents = ids ayant des mots en commun avec le message.
export function choisirSouvenirs(souvenirs, message, budget) {
  const actifs = souvenirs.filter((s) => s.statut !== 'archive');
  const cles = motsCles(message);
  const avecScore = actifs.map((s) => {
    const n = communs(cles, motsCles(s.texte));
    const rappel = s.dernierRappel ? Date.parse(s.dernierRappel) / 1e13 : 0;
    const score = (s.importance === 3 ? 1000 : 0) + n * 50 + (s.importance || 1) * 10 + rappel;
    return { s, n, score };
  });
  const pertinents = avecScore.filter((x) => x.n > 0).map((x) => x.s.id);
  const total = actifs.reduce((t, s) => t + taillePourBudget(s), 0);
  let choisis;
  if (total <= budget) {
    choisis = actifs;
  } else {
    choisis = [];
    let utilise = 0;
    for (const { s } of avecScore.sort((a, b) => b.score - a.score)) {
      const t = taillePourBudget(s);
      if (utilise + t > budget) continue;
      choisis.push(s);
      utilise += t;
    }
  }
  const ordre = [...choisis].sort((a, b) => (b.importance || 1) - (a.importance || 1)
    || String(a.cree || '').localeCompare(String(b.cree || '')));
  return { choisis: ordre, pertinents };
}
// === FIN_SELECTION_SOUVENIRS ===
