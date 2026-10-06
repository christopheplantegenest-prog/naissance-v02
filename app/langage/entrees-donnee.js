// === DEBUT_LANGAGE_ENTREES_DONNEE ===
// v0.63.55 — « DONNÉE ADJACENTE : ENTRÉES D'UNE PRODUCTION » (décision ChatGPT, 06/10/2026). Constantes et dérivation PURES, DORMANTES.
// Les entrées persistées d'une production E (execution.liaisons) sont une donnée ADJACENTE à E : identité propre, forme propre, accès propre,
// porteur synthétique { id, entrees }. Ce n'est NI le résultat de E, NI une sous-donnée α2, NI une exécution : une autre ADRESSE d'une
// information déjà persistée. Rien n'est persisté : l'identité se RECALCULE à partir de celle de la production.
//
// CONVENTION D'IDENTITÉ : idEntrees(E) = PREFIXE_IDENTITE_ENTREES + idE, avec PREFIXE_IDENTITE_ENTREES = « entrees-de-production: ».
//   DOMAINE de identiteEntreesProduction : toute chaîne non vide qui ne COMMENCE PAS par le préfixe réservé (une identité déjà dérivée n'est
//   jamais re-dérivée : TypeError). Le domaine est purement LEXICAL : la fonction ne sait pas si idE est une exécution, un message ou une
//   sous-donnée (elle ne consulte aucun magasin) ; c'est la RÉSOLUTION (resoudreIdentitesDonnees) qui refuse faute de production source.
//   IMAGE : exactement les chaînes « préfixe + reste » où le reste est non vide et ne commence pas par le préfixe.
//   INJECTIVITÉ : productionDesEntrees(identiteEntreesProduction(x)) === x pour tout x du domaine (le préfixe est retiré UNE fois ; le reste
//   est rendu tel quel, sans trim ni normalisation). Deux identités distinctes du domaine ont donc deux images distinctes.
//   RECONNAISSANCE : estIdentiteEntrees(c) <=> c est dans l'image. L'inverse refuse (TypeError) toute chaîne hors de l'image, notamment le
//   préfixe seul ou « préfixe + préfixe + … » : jamais deviné.
//   SÉPARATION : aucune identité de message, d'exécution ni de sous-donnée ne peut COMMENCER par le préfixe réservé ; si un générateur en
//   produisait une, resoudreIdentitesDonnees REFUSE (collision, jamais départagée). Les identités opaques actuelles commencent par
//   « execution-operation- », « sous-donnee- », ou le préfixe d'un message : aucune n'a de « : » placé comme le préfixe réservé.
// FORME_ENTREES_PRODUCTION : collection de { entree: chaine, donnee: chaine peutManquer, donnees: collection de chaine peutManquer } — celle
//   des liaisons persistées (ordinaire { entree, donnee } / collective { entree, donnees }). Elle ne dépend PAS de l'opération productrice
//   ni du catalogue ; ce n'est pas la sortie déclarée d'une opération. Constante gelée en profondeur ; la résolution en rend une copie.
// ACCES_ENTREES_PRODUCTION : { champ: 'entrees' } — DISTINCT de ACCES_TRACE (champ « resultat ») : la provenance n'est jamais lue comme un résultat.
//   À utiliser avec valeurDePorteur(porteur, donnee, ACCES_ENTREES_PRODUCTION), porteur = { id: idEntrees, entrees: valeur }.
// Ce fichier n'importe rien et ne lit aucune donnée.
export const PREFIXE_IDENTITE_ENTREES = 'entrees-de-production:';

const NOM = 'identiteEntreesProduction';
const refuser = (nom, raison) => { throw new TypeError(`${nom} : ${raison}.`); };

function gelerProfond(valeur) {
  if (valeur !== null && typeof valeur === 'object') {
    for (const cle of Object.keys(valeur)) gelerProfond(valeur[cle]);
    Object.freeze(valeur);
  }
  return valeur;
}

export const FORME_ENTREES_PRODUCTION = gelerProfond({
  forme: 'collection',
  elements: {
    forme: 'objet',
    champs: {
      entree: { forme: 'scalaire', genre: 'chaine' },
      donnee: { forme: 'scalaire', genre: 'chaine', peutManquer: true },
      donnees: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' }, peutManquer: true },
    },
  },
});

export const ACCES_ENTREES_PRODUCTION = Object.freeze({ champ: 'entrees' });

export function estIdentiteEntrees(chaine) {
  if (typeof chaine !== 'string' || !chaine.startsWith(PREFIXE_IDENTITE_ENTREES)) return false;
  const reste = chaine.slice(PREFIXE_IDENTITE_ENTREES.length);
  return reste.length > 0 && !reste.startsWith(PREFIXE_IDENTITE_ENTREES);
}

export function identiteEntreesProduction(idProduction) {
  if (typeof idProduction !== 'string' || idProduction.length === 0) refuser(NOM, 'idProduction doit être une chaîne non vide');
  if (idProduction.startsWith(PREFIXE_IDENTITE_ENTREES)) refuser(NOM, 'idProduction commence par le préfixe réservé : une identité d\'entrées n\'est jamais re-dérivée');
  return PREFIXE_IDENTITE_ENTREES + idProduction;
}

export function productionDesEntrees(idEntrees) {
  if (typeof idEntrees !== 'string') refuser('productionDesEntrees', 'idEntrees doit être une chaîne');
  if (!estIdentiteEntrees(idEntrees)) refuser('productionDesEntrees', `« ${idEntrees} » n'est pas une identité d'entrées de production`);
  return idEntrees.slice(PREFIXE_IDENTITE_ENTREES.length);
}
// === FIN_LANGAGE_ENTREES_DONNEE ===
