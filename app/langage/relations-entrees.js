// === DEBUT_LANGAGE_RELATIONS_ENTREES ===
// v0.63.61 — REGISTRE MÉCANIQUE DES RELATIONS ENTRE ENTRÉES (décision ChatGPT, 06/10/2026). Le catalogue DÉCLARE (relations-schema.js + clé `relations`
// des descripteurs), ce registre IMPLÉMENTE, les corps des opérations RÉUTILISENT : chaque prédicat est la fonction que le corps appelle déjà
// (couvertureDansChemins -> la résolution de couverture ; plagesDansSequence -> la lecture des plages de couvrirSequence). Aucune règle n'est dupliquée ici.
//
// relationsSatisfaites(relations, valeursParEntree) -> booleen
//   relations : le tableau `relations` d'un descripteur VALIDÉ ; valeursParEntree : { <nom d'entrée>: valeur } tel que rendu par resoudreValeursApplication.
//   Vrai si et seulement si CHAQUE relation déclarée est satisfaite par les VALEURS (jamais l'identité, l'exécution productrice, l'observation d'origine,
//   entrées(P) ni aucune provenance : la validité ne dépend que des valeurs). Pure, synchrone, sans écriture, sans horloge, sans hasard.
import { resoudreCouverture } from './resolution-couverture.js';
import { plagesDansSequence } from './sequence-plages.js';
import { SCHEMA_RELATIONS } from './relations-schema.js';

// couvertureDansChemins : vraie si et seulement si resoudreCouverture(collection, couverture) aboutit. C'est LA fonction que les corps de resoudreCouverture et
// de la résolution des éléments exécutent (mêmes validations, même égalité de chemins segment à segment, doublons refusés, couverture vide valide, aucune coercion) :
// aucune règle n'est recopiée. Tout TypeError (structure invalide, doublon, chemin absent) rend FAUX ; toute autre erreur est relancée.
function couvertureDansChemins(collection, couverture) {
  try {
    resoudreCouverture(collection, couverture);
    return true;
  } catch (erreur) {
    if (erreur instanceof TypeError) return false;
    throw erreur;
  }
}

export const REGISTRE_RELATIONS = Object.freeze({
  couvertureDansChemins: (valeurs) => couvertureDansChemins(valeurs.collection, valeurs.couverture),
  plagesDansSequence: (valeurs) => plagesDansSequence(valeurs.sequence, valeurs.plages),
});

export function relationsSatisfaites(relations, valeursParEntree) {
  if (!Array.isArray(relations)) throw new TypeError('relationsSatisfaites : relations doit être un tableau.');
  if (valeursParEntree === null || typeof valeursParEntree !== 'object') throw new TypeError('relationsSatisfaites : valeursParEntree doit être un objet.');
  for (const declaration of relations) {
    const verifier = Object.hasOwn(REGISTRE_RELATIONS, declaration.relation) ? REGISTRE_RELATIONS[declaration.relation] : undefined;
    if (verifier === undefined) throw new TypeError(`relationsSatisfaites : relation « ${declaration.relation} » sans implémentation.`);
    const valeurs = {};
    for (const role of SCHEMA_RELATIONS[declaration.relation]) {
      const entree = declaration[role];
      if (!Object.hasOwn(valeursParEntree, entree)) throw new TypeError(`relationsSatisfaites : valeur absente pour l'entrée « ${entree} » (rôle ${role}).`);
      valeurs[role] = valeursParEntree[entree];
    }
    if (verifier(valeurs) !== true) return false;
  }
  return true;
}
// === FIN_LANGAGE_RELATIONS_ENTREES ===
