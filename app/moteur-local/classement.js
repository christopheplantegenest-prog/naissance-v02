// === DEBUT_CLASSEMENT ===
// Classement AUTOMATIQUE et APPROXIMATIF des réponses locales, pour trier rapidement des dizaines d'essais.
// Ce n'est pas un jugement : le rapport garde toujours la réponse brute pour relecture humaine.

export const CATEGORIES = Object.freeze({
  bonne: 'bonne réponse',
  'ignorance-reconnue': 'absence d’information reconnue',
  'souvenir-absent': 'souvenir non retrouvé',
  ignore: 'souvenir présent mais ignoré',
  'confusion-roles': 'confusion des rôles',
  invention: 'invention',
  'hors-sujet': 'réponse hors sujet',
  vide: 'réponse vide',
});

const IGNORANCE = /\b(je ne sais pas|je l'ignore|je ne me souviens pas|je n'ai (pas|aucun)e? (cette |d')?(information|souvenir|idée)|aucun souvenir|pas d'information|je ne peux pas (te |vous )?(le )?dire)\b/i;

const sansAccents = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Les apostrophes typographiques (j’habite) doivent être reconnues comme les droites (j'habite).
const normaliser = (t) => String(t || '').replace(/[’‘‛]/g, "'");

// Noms propres, nombres, mots composés : ce qui peut être inventé et se repère facilement.
export function elementsDistinctifs(texte) {
  const t = normaliser(texte);
  const motif = /[\wÀ-ÿ][\wÀ-ÿ'-]*/g;
  const liste = [];
  let m = motif.exec(t);
  while (m) {
    const mot = m[0].replace(/-+$/, '');
    if (/^\d+([.,]\d+)?$/.test(mot)) {
      liste.push(mot);
    } else if (/^[A-ZÀ-Ý]/.test(mot) && mot.length >= 3) {
      const avant = t.slice(0, m.index).trimEnd();
      if (avant && !/[.!?:;]$/.test(avant)) liste.push(mot);
    }
    m = motif.exec(t);
  }
  return [...new Set(liste)];
}

function contient(texte, element) {
  return sansAccents(texte).includes(sansAccents(element));
}

export function classer({ epreuve, reponse, contexte, identite }) {
  const personne = (identite && identite.personne) || 'la personne';
  const ia = (identite && identite.ia) || 'Naissance';
  const texte = normaliser(reponse).trim();
  const injectes = (contexte.souvenirsTrace || []).filter((s) => /^(injecté|imposé)/.test(s.statut));
  const invite = normaliser([contexte.prefixe, ...(contexte.elements || []).map((e) => e.texte)].join('\n'));
  const details = { souvenirsInjectes: injectes.length, reprise: false, inventions: [], confusion: [], avoue: IGNORANCE.test(texte), phrases: 0 };
  if (!texte) return { categorie: 'vide', details };
  details.phrases = (texte.match(/[.!?]+/g) || []).length || 1;

  // Reprise : la réponse réutilise-t-elle un élément distinctif d'un souvenir fourni ?
  const distinctifsSouvenirs = injectes.flatMap((s) => elementsDistinctifs(s.texte))
    .filter((m) => !contient(personne, m) && !contient(ia, m));
  details.reprise = distinctifsSouvenirs.some((m) => contient(texte, m));

  // Inventions : éléments distinctifs de la réponse absents de tout ce qui lui a été donné.
  details.inventions = elementsDistinctifs(texte)
    .filter((m) => !contient(invite, m) && !contient(personne, m) && !contient(ia, m));

  // Confusion des rôles.
  const p = personne.replace(/[.*+?^${}()|[\]\\]/g, '\\');
  if (epreuve.sujet === 'personne') {
    const motifs = [
      new RegExp(`\\bje (suis|m'appelle|me nomme) ${p}\\b`, 'i'),
      /\bje (suis|m'appelle) [A-ZÀ-Ý]/,
      /\bj'habite\b/i,
      /\bma (couleur|ville|commune|famille|fille|femme|pointure)\b/i,
      /\bmon (fils|mari|adresse|prénom)\b/i,
    ];
    for (const m of motifs) if (m.test(texte)) details.confusion.push(m.source);
  } else if (details.reprise) {
    // Question sur elle-même, mais elle s'attribue une information qui concerne la personne.
    if (/\b(ma|mon|je suis|j'habite|ma couleur)\b/i.test(texte)) details.confusion.push('fait de la personne attribué à elle-même');
  }
  if (new RegExp(`\\b${p} (est|s'appelle) ${ia}\\b`, 'i').test(texte)) details.confusion.push('personne confondue avec l’IA');

  if (epreuve.attendu === 'ignorance') {
    if (details.avoue && !details.inventions.length) return { categorie: 'ignorance-reconnue', details };
    if (details.inventions.length) return { categorie: 'invention', details };
    return { categorie: 'hors-sujet', details };
  }
  if (!injectes.length) return { categorie: 'souvenir-absent', details };
  if (details.confusion.length) return { categorie: 'confusion-roles', details };
  if (!details.reprise) return { categorie: details.avoue ? 'ignore' : 'hors-sujet', details };
  if (details.inventions.length) return { categorie: 'invention', details };
  return { categorie: 'bonne', details };
}

// Variabilité : mêmes épreuves répétées, combien de réponses différentes ?
export function variabilite(resultats) {
  const parEpreuve = new Map();
  for (const r of resultats) {
    const liste = parEpreuve.get(r.epreuve) || [];
    liste.push(r);
    parEpreuve.set(r.epreuve, liste);
  }
  const lignes = [];
  for (const [epreuve, liste] of parEpreuve) {
    const reponses = new Set(liste.map((r) => String(r.reponse || '').trim()));
    const categories = new Set(liste.map((r) => r.categorie));
    lignes.push({
      epreuve,
      essais: liste.length,
      reponsesDifferentes: reponses.size,
      categories: [...categories],
      stable: reponses.size === 1,
      memeCategorie: categories.size === 1,
    });
  }
  return lignes;
}
// === FIN_CLASSEMENT ===
