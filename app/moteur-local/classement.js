// === DEBUT_CLASSEMENT ===
// Classement AUTOMATIQUE et APPROXIMATIF des réponses locales, pour trier rapidement des dizaines d'essais.
// Ce n'est pas un jugement : le rapport garde toujours la réponse brute pour relecture humaine.

import { motsCles } from '../memoire/selection.js';

export const CATEGORIES = Object.freeze({
  bonne: 'bonne réponse',
  'fait-mauvaise-personne': 'fait juste, mauvaise personne (je/tu/il)',
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

// v0.7.3 — détection élargie, ajoutée à côté de elementsDistinctifs (inchangée) plutôt qu'à sa place :
// elle ne peut qu'AJOUTER des reprises/inventions repérées, jamais en retirer une déjà trouvée.
// Reprend le même découpage que la sélection mémoire (motsCles), pour rester cohérente avec elle
// et repérer des reprises que les seuls noms propres/nombres ne voient pas (ex. « bleu », « enfants »).
function motsUtiles(texte, personne, ia) {
  const exclure = new Set([...motsCles(personne), ...motsCles(ia)]);
  return [...motsCles(texte)].filter((m) => !exclure.has(m));
}

// Reconstruit, pour chaque mot-clé normalisé, sa première forme telle qu'écrite dans le texte
// (pour afficher « Bourgogne » plutôt que « bourgogne » dans les inventions repérées).
function formesOriginales(texte) {
  const carte = new Map();
  for (const mot of String(texte || '').split(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/).filter(Boolean)) {
    const cle = sansAccents(mot);
    if (cle.length >= 4 && !carte.has(cle)) carte.set(cle, mot);
  }
  return carte;
}

// Mots significatifs (≥4 lettres, hors mots vides) présents dans la réponse mais absents de
// tout ce qui a été donné au moteur (identité, souvenirs, conversation) — y compris en minuscules :
// une invention n'est pas toujours un nom propre (« la tradition chrétienne », « la province »).
// Une variante de conjugaison proche (habite/habites) n'est PAS une invention : on compare aussi
// des formes légèrement raccourcies (s/es/e finaux) pour ne pas confondre accord grammatical et fait inventé.
const racine = (mot) => mot.replace(/(es|e|s)$/, '');

function motsInventes(reponse, invite, personne, ia) {
  const connus = new Set([...motsCles(invite), ...motsCles(personne), ...motsCles(ia)]);
  const racinesConnues = new Set([...connus].map(racine));
  const carte = formesOriginales(reponse);
  return [...motsCles(reponse)]
    .filter((m) => !connus.has(m) && !racinesConnues.has(racine(m)))
    .map((m) => carte.get(m) || m);
}

// Nombres présents dans la réponse mais absents de l'invite (motsCles ignore les nombres courts).
function chiffresInventes(reponse, invite) {
  const dans = (t) => new Set((sansAccents(t).match(/\b\d+([.,]\d+)?\b/g)) || []);
  const dansReponse = dans(reponse);
  const dansInvite = dans(invite);
  return [...dansReponse].filter((n) => !dansInvite.has(n));
}

// Personnes grammaticales employées dans la réponse : marqueurs simples (je/tu/vous), approximatif.
// Sert à repérer les cas où le FAIT est juste mais la personne ne correspond pas à celle attendue.
export function personnesEmployees(texte) {
  const p = [];
  if (/\b(je|j'|moi|mon|ma|mes)\b/i.test(texte)) p.push('je');
  if (/\b(tu|toi|ton|ta|tes)\b/i.test(texte)) p.push('tu');
  if (/\b(vous|votre|vos)\b/i.test(texte)) p.push('vous');
  return p;
}

export function classer({ epreuve, reponse, contexte, identite }) {
  const personne = (identite && identite.personne) || 'la personne';
  const ia = (identite && identite.ia) || 'Naissance';
  const texte = normaliser(reponse).trim();
  const injectes = (contexte.souvenirsTrace || []).filter((s) => /^(injecté|imposé)/.test(s.statut));
  const invite = normaliser([contexte.prefixe, ...(contexte.elements || []).map((e) => e.texte)].join('\n'));
  const souvenirsTexte = injectes.map((s) => s.texte).join(' ');
  const details = {
    souvenirsInjectes: injectes.length, reprise: false, inventions: [], confusion: [],
    personnes: [], avoue: IGNORANCE.test(texte), phrases: 0,
  };
  if (!texte) return { categorie: 'vide', details };
  details.phrases = (texte.match(/[.!?]+/g) || []).length || 1;

  // Reprise : la réponse réutilise-t-elle un élément distinctif d'un souvenir fourni,
  // OU (v0.7.3) un mot-clé significatif de ce souvenir (ex. « bleu », « enfants ») ?
  const distinctifsSouvenirs = injectes.flatMap((s) => elementsDistinctifs(s.texte))
    .filter((m) => !contient(personne, m) && !contient(ia, m));
  const reprisePrecise = distinctifsSouvenirs.some((m) => contient(texte, m));
  const clesSouvenir = motsUtiles(souvenirsTexte, personne, ia);
  const clesReponse = motsCles(texte);
  const repriseElargie = clesSouvenir.some((m) => clesReponse.has(m));
  details.reprise = reprisePrecise || repriseElargie;

  // Inventions : éléments distinctifs (v0.7.0) ∪ mots significatifs même en minuscules (v0.7.3),
  // absents de tout ce qui a été donné au moteur.
  const inventionsPrecises = elementsDistinctifs(texte)
    .filter((m) => !contient(invite, m) && !contient(personne, m) && !contient(ia, m));
  details.inventions = [...new Set([
    ...inventionsPrecises,
    ...chiffresInventes(texte, invite),
    ...motsInventes(texte, invite, personne, ia),
  ])];
  // Dire qu'on ne sait pas emploie forcément des mots absents de l'invite (« sais », « souviens »…) :
  // ce ne sont pas des inventions. On les retire seulement s'ils appartiennent à la formule d'aveu
  // elle-même, pas au reste de la phrase (une invention ajoutée après un aveu reste détectée).
  if (details.avoue) {
    const aveu = texte.match(IGNORANCE);
    const motsAveu = aveu ? motsCles(aveu[0]) : new Set();
    details.inventions = details.inventions.filter((m) => !motsAveu.has(sansAccents(m)));
  }

  // Personne(s) grammaticale(s) employée(s) — approximatif (marqueurs simples je/tu/vous).
  details.personnes = personnesEmployees(texte);

  // Confusion des rôles : la réponse s'attribue explicitement un fait ou une identité qui n'est pas la sienne.
  const p = personne.replace(/[.*+?^${}()|[\]\\]/g, '\\');
  if (epreuve.sujet === 'personne') {
    const motifs = [
      new RegExp(`\\bje (suis|m'appelle|me nomme) ${p}\\b`, 'i'),
      /\bje (suis|m'appelle) [A-ZÀ-Ý]/i, // bug v0.7.2 : le drapeau « i » manquait, donc « Je suis… » en début de phrase n'était jamais repéré
      /\bj'habite\b/i,
      /\bj'ai\b/i, // v0.7.3 : « j'ai deux enfants » — appropriation d'un fait de {personne}, même sans « je suis »
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
  // v0.7.3 : le fait est repris, sans invention ni confusion explicite — mais la personne
  // grammaticale employée n'est pas celle attendue (2e pour une question sur {personne}, 1re pour une
  // question sur l'IA elle-même). C'est le cas le plus fréquent observé (« La couleur préférée de
  // Christophe est le bleu » au lieu de « Ta couleur préférée est le bleu »).
  const attendue = epreuve.sujet === 'ia' ? 'je' : 'tu';
  if (!details.personnes.includes(attendue)) return { categorie: 'fait-mauvaise-personne', details };
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
