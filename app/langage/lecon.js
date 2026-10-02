// === DEBUT_LANGAGE_LECON ===
// LE CANAL PÉDAGOGIQUE, généralisé en v0.12 à quatre types de connaissances déjà stockables par
// Naissance (relation, fait, propriété, règle — v0.11 n'en couvrait qu'un seul, la règle).
//
// Toujours pas de compréhension du français libre : quatre petites formes fixes, chacune reconnue
// par un mot-clé de tête différent (Mot / Fait / Propriété / Pour), jamais par le contenu qu'elle
// transporte. « Mot : xyzz désigne grbl. » doit fonctionner exactement comme une vraie leçon —
// sinon ce serait la preuve que l'extraction reconnaît du vocabulaire plutôt qu'une structure.
//
// Les mots-clés de tête étant tous différents, une phrase ne peut structurellement correspondre
// qu'à UN SEUL type à la fois : pas besoin d'une logique de désambiguïsation séparée.
//
// « Patron » (les façons de dire, esprit.js/fabriquerGabarit) reste délibérément HORS de ce canal :
// son mécanisme (reverse-ingénierie d'une phrase entière) est trop différent des quatre autres,
// qui n'extraient que des emplacements. Le forcer ici serait une abstraction artificielle.

export const TYPES_LECON = Object.freeze({
  relation: 'Mot : <mot> désigne <relation>.',
  fait: 'Fait : <sujet> / <relation> / <valeur>.',
  propriete: 'Propriété : <mot> / <propriété> / <valeur>.',
  regle: 'Pour <rôle> : si <propriété> vaut <valeur>, on dit <résultat>.',
  patron: 'Façon de dire : <relation ou *> / <sujet> / <gabarit>.',
});

const GABARIT_RELATION = /^mot\s*:\s*(.+?)\s+désigne\s+(.+?)\s*\.?\s*$/i;
const GABARIT_FAIT = /^fait\s*:\s*(.+?)\s*\/\s*(.+?)\s*\/\s*(.+?)\s*\.?\s*$/i;
const GABARIT_PROPRIETE = /^propriété\s*:\s*(.+?)\s*\/\s*(.+?)\s*\/\s*(.+?)\s*\.?\s*$/i;
// v0.45 — DÉCISION CHATGPT « ENSEIGNEMENT DE RÈGLES À PLUSIEURS CONDITIONS » (02/10). GABARIT_REGLE
// capture désormais un BLOC de conditions (groupe 2) au lieu d'une seule clause directement :
// « si <bloc>, on dit <résultat> ». Le bloc est ensuite découpé en clauses par SEPARATEUR_CONDITIONS
// ci-dessous, chaque clause gardant EXACTEMENT la forme d'avant (« <propriété> vaut <valeur> ») —
// aucune logique « ET » spéciale : « et » n'est qu'un séparateur générique entre clauses de même
// forme, du même principe que « / » dans GABARIT_FAIT ci-dessus. Une seule clause (sans « et »)
// retombe sur un tableau à un seul élément : AUCUNE branche de code séparée pour ce cas, donc AUCUN
// changement de comportement pour toute leçon déjà enseignable avant ce chantier.
const GABARIT_REGLE = /^pour\s+(.+?)\s*:\s*si\s+(.+?)\s*,\s*on\s+dit\s+(.+?)\s*\.?\s*$/i;
const SEPARATEUR_CONDITIONS = /\s+et\s+/i;
const GABARIT_CONDITION = /^(.+?)\s+vaut\s+(.+?)$/i;

// Découpe le bloc de conditions en clauses, chacune revalidée individuellement. Renvoie null si
// UNE SEULE clause ne respecte pas la forme attendue — jamais une règle partielle devinée à partir
// d'un bloc à moitié compris (même principe que tousRemplis() plus bas pour les autres gabarits).
function extraireConditions(bloc) {
  const clauses = bloc.split(SEPARATEUR_CONDITIONS).map((c) => c.trim()).filter(Boolean);
  if (!clauses.length) return null;
  const conditions = [];
  for (const clause of clauses) {
    const m = clause.match(GABARIT_CONDITION);
    if (!m || !m[1].trim() || !m[2].trim()) return null;
    conditions.push({ propriete: m[1].trim(), valeur: m[2].trim() });
  }
  return conditions;
}
// Le gabarit lui-même (troisième emplacement) est du texte libre et peut légitimement contenir
// à peu près n'importe quoi (accolades comprises) : contrairement aux quatre autres, on ne retire
// PAS un point final ici — un gabarit qui se termine par « {valeur}. » perdrait sa ponctuation
// réelle si on la traitait comme un simple point de fin de phrase pédagogique.
const GABARIT_PATRON = /^fa[çc]on de dire\s*:\s*(.+?)\s*\/\s*(.+?)\s*\/\s*(.+)$/i;

const tousRemplis = (...vals) => vals.every((v) => v && v.trim());

// Renvoie { type, donnees } — donnees a exactement la forme attendue par la fonction d'apprentissage
// existante correspondante (apprendreRelation / apprendreFait / apprendrePropriete / apprendreRegle),
// pour qu'aucune transformation intermédiaire ne soit nécessaire au moment de la confirmation.
// Renvoie null si la phrase ne respecte AUCUNE des quatre formes. Ne devine jamais.
export function extraireLecon(texte) {
  const t = String(texte || '').trim();

  let m = t.match(GABARIT_RELATION);
  if (m && tousRemplis(m[1], m[2])) {
    return { type: 'relation', donnees: { mot: m[1].trim(), relation: m[2].trim() } };
  }

  m = t.match(GABARIT_FAIT);
  if (m && tousRemplis(m[1], m[2], m[3])) {
    return { type: 'fait', donnees: { sujet: m[1].trim(), relation: m[2].trim(), valeur: m[3].trim() } };
  }

  m = t.match(GABARIT_PROPRIETE);
  if (m && tousRemplis(m[1], m[2], m[3])) {
    return { type: 'propriete', donnees: { mot: m[1].trim(), propriete: m[2].trim(), valeur: m[3].trim() } };
  }

  m = t.match(GABARIT_REGLE);
  if (m && tousRemplis(m[1], m[2], m[3])) {
    const conditions = extraireConditions(m[2].trim());
    if (conditions) return { type: 'regle', donnees: { role: m[1].trim(), conditions, resultat: m[3].trim() } };
  }

  m = t.match(GABARIT_PATRON);
  if (m && tousRemplis(m[1], m[2], m[3])) {
    return { type: 'patron', donnees: { relation: m[1].trim(), sujet: m[2].trim(), gabarit: m[3].trim() } };
  }

  return null;
}

// Un aperçu lisible, adapté au type reconnu — c'est ce que Naissance affiche AVANT toute écriture,
// pour que Christophe puisse voir une mauvaise interprétation avant qu'elle n'entre en mémoire.
export function apercuLecon({ type, donnees }) {
  if (type === 'relation') return `J'ai compris : le mot « ${donnees.mot} » désigne l'information « ${donnees.relation} ». C'est correct ?`;
  if (type === 'fait') return `J'ai compris : ${donnees.sujet} → ${donnees.relation} → ${donnees.valeur}. C'est correct ?`;
  if (type === 'propriete') return `J'ai compris : ${donnees.mot} a pour propriété « ${donnees.propriete} » la valeur « ${donnees.valeur} ». C'est correct ?`;
  if (type === 'regle') {
    // v0.45 — toutes les conditions sont listées, pas seulement la première (voir GABARIT_REGLE).
    const conds = donnees.conditions.map((c) => `${c.propriete} vaut ${c.valeur}`).join(' ET ');
    return `J'ai compris : rôle = ${donnees.role} ; si ${conds} ; alors ${donnees.resultat}. C'est correct ?`;
  }
  if (type === 'patron') {
    const portee = donnees.relation === '*' ? 'toutes les informations' : donnees.relation;
    return `J'ai compris : une façon de dire pour « ${portee} » (sujet « ${donnees.sujet} ») : « ${donnees.gabarit} ». C'est correct ?`;
  }
  return null;
}
// Reconstruit la phrase du canal pédagogique correspondant à une règle DÉJÀ enregistrée — à partir
// de ses champs structurés, jamais du texte éventuellement tapé au moment de l'apprentissage (qui
// peut être absent). Sert à montrer à un professeur externe un exemple de ce que Naissance sait
// déjà, dans son propre format.
export function reconstruireLeconRegle(regle) {
  // v0.45 — toutes les conditions sont reconstruites, séparées par « et » (voir GABARIT_REGLE) ;
  // pour une seule condition, produit EXACTEMENT la même chaîne qu'avant ce chantier.
  const bloc = regle.conditions.map((c) => `${c.propriete} vaut ${c.valeur}`).join(' et ');
  return `Pour ${regle.role} : si ${bloc}, on dit ${regle.resultat}.`;
}
// === FIN_LANGAGE_LECON ===
