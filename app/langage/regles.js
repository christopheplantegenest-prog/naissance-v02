// === DEBUT_LANGAGE_REGLES ===
// LE MOTEUR DE RÈGLES — générique : une règle est une DONNÉE (rôle, conditions, résultat), jamais
// une condition JavaScript écrite à la main. Apprendre une nouvelle règle grammaticale ne change
// jamais ce fichier, seulement la base.
//
// Principe unique, déjà présent avant v0.10 dans choisirPatron() (esprit.js) : plusieurs candidats,
// on garde le ou les plus spécifiques. plusSpecifiques() est ce principe, extrait une fois pour
// être utilisé par les deux — patrons de phrase et règles grammaticales — sans dupliquer la logique
// ni fusionner deux formats de données différents.

// Parmi des candidats, garde ceux qui ont le poids maximal (peut en rendre plusieurs : c'est ce qui
// permet à l'appelant de détecter une égalité, donc un conflit possible, au lieu de trancher seul).
export function plusSpecifiques(candidats, poids) {
  if (!candidats.length) return [];
  const max = Math.max(...candidats.map(poids));
  return candidats.filter((c) => poids(c) === max);
}

// Une condition == { propriete, valeur }. Toutes doivent être vraies pour les propriétés données.
// proprietesDuMot : Map propriete → valeur (ou objet équivalent), jamais un mot en dur.
function conditionsSatisfaites(conditions, proprietesDuMot) {
  const lire = (p) => (proprietesDuMot instanceof Map ? proprietesDuMot.get(p) : proprietesDuMot?.[p]);
  return conditions.every((c) => lire(c.propriete) === c.valeur);
}

// Signature stable d'un jeu de conditions : sert à reconnaître qu'on réapprend LA MÊME règle
// (→ nouvelle version, remplace l'ancienne) plutôt qu'une règle différente qui pourrait entrer
// en conflit avec elle.
export function signatureConditions(conditions) {
  return [...conditions].map((c) => `${c.propriete}=${c.valeur}`).sort().join('&');
}

// Applique les règles ACTIVES (statut 'validee') pour un rôle donné aux propriétés d'un mot.
// Renvoie :
//   { resultat, regle }              — une règle (la plus spécifique) l'emporte sans ambiguïté.
//   { resultat: null }               — aucune règle ne s'applique : à dire honnêtement, pas à deviner.
//   { resultat: null, conflit: true, candidats } — plusieurs règles à égale spécificité se
//        contredisent : JAMAIS de choix arbitraire silencieux, l'appelant doit le signaler.
export function appliquerRegles(regles, { role, proprietesDuMot }) {
  const candidates = regles.filter((r) => r.statut === 'validee' && r.role === role
    && conditionsSatisfaites(r.conditions, proprietesDuMot));
  if (!candidates.length) return { resultat: null };
  const groupe = plusSpecifiques(candidates, (r) => r.conditions.length);
  const resultats = new Set(groupe.map((r) => r.resultat));
  if (resultats.size > 1) return { resultat: null, conflit: true, candidats: groupe };
  return { resultat: groupe[0].resultat, regle: groupe[0] };
}
// === FIN_LANGAGE_REGLES ===
