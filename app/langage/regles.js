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

// Normalisation appliquée à tout ce qui sert à COMPARER (propriété, valeur, rôle) — jamais à ce
// qui sert à PRODUIRE du texte (le résultat d'une règle garde son orthographe exacte).
// Corrige une incohérence réelle trouvée le 20/09 : « féminin » et « feminin » (accent différent)
// n'étaient rapprochés nulle part avant, et une règle pouvait échouer en silence pour cette seule
// raison — indiscernable d'une absence totale de règle. Appliquée à la comparaison (ici) ET à
// l'écriture (esprit.js) : les anciennes données déjà enregistrées sans cette normalisation
// continuent de fonctionner, pas seulement les nouvelles.
export function normaliserTexte(t) {
  return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Une condition == { propriete, valeur }. Toutes doivent être vraies pour les propriétés données.
// proprietesDuMot : Map propriete → valeur (ou objet équivalent), jamais un mot en dur.
// La recherche elle-même est normalisée (pas seulement la comparaison finale) : une propriété
// enregistrée sous une casse ou un accent différent de celui d'une condition doit quand même être
// trouvée — sinon la normalisation ne protège que la moitié du problème.
function conditionsSatisfaites(conditions, proprietesDuMot) {
  const lire = (p) => {
    const cle = normaliserTexte(p);
    if (proprietesDuMot instanceof Map) {
      for (const [k, v] of proprietesDuMot) if (normaliserTexte(k) === cle) return v;
      return undefined;
    }
    if (!proprietesDuMot) return undefined;
    const trouvee = Object.keys(proprietesDuMot).find((k) => normaliserTexte(k) === cle);
    return trouvee ? proprietesDuMot[trouvee] : undefined;
  };
  return conditions.every((c) => normaliserTexte(lire(c.propriete)) === normaliserTexte(c.valeur));
}

// Signature stable d'un jeu de conditions : sert à reconnaître qu'on réapprend LA MÊME règle
// (→ nouvelle version, remplace l'ancienne) plutôt qu'une règle différente qui pourrait entrer
// en conflit avec elle. Normalisée pour la même raison que conditionsSatisfaites.
export function signatureConditions(conditions) {
  return [...conditions].map((c) => `${normaliserTexte(c.propriete)}=${normaliserTexte(c.valeur)}`).sort().join('&');
}

// Applique les règles ACTIVES (statut 'validee') pour un rôle donné aux propriétés d'un mot.
// Renvoie :
//   { resultat, regle }              — une règle (la plus spécifique) l'emporte sans ambiguïté.
//   { resultat: null }               — aucune règle ne s'applique : à dire honnêtement, pas à deviner.
//   { resultat: null, conflit: true, candidats } — plusieurs règles à égale spécificité se
//        contredisent : JAMAIS de choix arbitraire silencieux, l'appelant doit le signaler.
export function appliquerRegles(regles, { role, proprietesDuMot }) {
  const roleNorm = normaliserTexte(role);
  const candidates = regles.filter((r) => r.statut === 'validee' && normaliserTexte(r.role) === roleNorm
    && conditionsSatisfaites(r.conditions, proprietesDuMot));
  if (!candidates.length) return { resultat: null };
  const groupe = plusSpecifiques(candidates, (r) => r.conditions.length);
  const resultats = new Set(groupe.map((r) => r.resultat));
  if (resultats.size > 1) return { resultat: null, conflit: true, candidats: groupe };
  return { resultat: groupe[0].resultat, regle: groupe[0] };
}
// === FIN_LANGAGE_REGLES ===
