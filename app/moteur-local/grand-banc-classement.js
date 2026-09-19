// === DEBUT_GRAND_BANC_CLASSEMENT ===
// Classements affinés, spécifiques à deux expériences du grand banc. Ils s'appuient sur les
// « details » déjà calculés par classer() (classement.js, inchangé) plutôt que de dupliquer sa
// logique — une même réponse peut porter plusieurs marqueurs, comme demandé.
// Approximatif, comme le reste du diagnostic : la réponse brute reste la référence.

import { motsCles } from '../memoire/selection.js';

const normaliser = (t) => String(t || '').replace(/[’‘‛]/g, "'");

const CLARIFICATION = /\?\s*$/;
const REFUS = /\b(je ne (peux|préfère) pas (te |vous )?(le )?dire|je ne répondrai pas|ce n'est pas mon rôle)\b/i;
// Une proposition explicitement présentée comme une hypothèse ne doit pas compter comme une invention factuelle.
const HYPOTHESE = /\b(imaginer|par exemple|peut[- ]être|si tu me disais|si vous me disiez|hypothèse|supposons|imagine que)\b/i;

export const CATEGORIES_ABSENCE = Object.freeze({
  aveu: "aveu explicite d'ignorance",
  clarification: 'question de clarification',
  refus: 'refus de répondre',
  invention: 'invention factuelle',
  imaginaire: 'proposition imaginative, présentée comme telle',
  autre: 'autre',
});

// Dire qu'on refuse ou qu'on ne sait pas emploie forcément des mots absents de l'invite
// (« répondrai », « question »…) : ce ne sont pas des inventions. On ne retire que les mots de la
// formule elle-même — une invention ajoutée à côté reste détectée (même logique que l'aveu
// d'ignorance dans classement.js).
function inventionsHorsFormule(r, texte, motif) {
  const m = texte.match(motif);
  if (!m) return r.details.inventions;
  const motsFormule = motsCles(m[0]);
  return r.details.inventions.filter((mot) => !motsFormule.has([...motsCles(mot)][0] || ''));
}

// Classement affiné d'une réponse à une question SANS information disponible (attendu='ignorance').
// r = résultat de classer({ epreuve, reponse, contexte, identite }) déjà calculé.
export function classerAbsence(r, reponse) {
  const texte = normaliser(reponse).trim();
  const marqueurs = [];
  if (r.details.avoue) marqueurs.push('aveu');
  const refuse = REFUS.test(texte);
  if (refuse) marqueurs.push('refus');
  if (CLARIFICATION.test(texte) && texte.length < 200) marqueurs.push('clarification');
  const inventions = refuse ? inventionsHorsFormule(r, texte, REFUS) : r.details.inventions;
  if (HYPOTHESE.test(texte) && inventions.length) marqueurs.push('imaginaire');
  else if (inventions.length) marqueurs.push('invention');
  if (!marqueurs.length) marqueurs.push('autre');
  return marqueurs;
}

export const CATEGORIES_COMPLETION = Object.freeze({
  arretee: 'réponse arrêtée après le fait',
  stylistique: 'ajout stylistique (sans fait nouveau)',
  geographique: 'ajout géographique inventé',
  'autre-fait': 'autre fait inventé',
});

// Classement affiné : que se passe-t-il APRÈS un fait vrai correctement repris ?
// r = résultat de classer(...) ; ne s'applique que si r.details.reprise est vrai.
export function classerCompletion(r) {
  if (!r.details.inventions.length) return ['arretee'];
  const LIEUX = /\b([A-ZÀ-Ý][a-zà-ÿ]+(-[A-ZÀ-Ý][a-zà-ÿ]+)*)\b/;
  const ressembleUnLieu = (mot) => LIEUX.test(mot) && mot.length >= 4;
  const geo = r.details.inventions.some(ressembleUnLieu);
  const marqueurs = [];
  if (geo) marqueurs.push('geographique');
  const autres = r.details.inventions.filter((m) => !ressembleUnLieu(m));
  if (autres.length) marqueurs.push(geo ? 'autre-fait' : 'stylistique');
  return marqueurs.length ? marqueurs : ['stylistique'];
}
// === FIN_GRAND_BANC_CLASSEMENT ===
