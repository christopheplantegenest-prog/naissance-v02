// === DEBUT_ERREURS_FOURNISSEUR ===
// Erreur commune à tous les fournisseurs : un code court (pour l'appli)
// et une phrase claire (pour l'utilisateur), plus un détail technique.
//
// Codes : cle, acces, region, modele, quota, service, requete, reseau,
//         delai, reponse, bloque, vide, reglage, indisponible, annule, inconnu
// Pour « quota », e.quota = { periode: 'jour' | 'minute' | null, reessayerDansMs }

export class ErreurFournisseur extends Error {
  constructor(code, message, detail = '') {
    super(message);
    this.name = 'ErreurFournisseur';
    this.code = code;
    this.detail = detail;
  }
}

// Codes pour lesquels il faut renvoyer l'utilisateur vers les Réglages.
export const CODES_REGLAGES = new Set(['cle', 'acces', 'modele', 'reglage']);

export function erreurReseau(cause, delaiDepasse) {
  if (delaiDepasse) {
    return new ErreurFournisseur('delai', "Le service n'a pas répondu à temps. Réessaie dans un moment.");
  }
  return new ErreurFournisseur(
    'reseau',
    'Impossible de joindre le service : vérifie la connexion internet.',
    cause && cause.message ? cause.message : String(cause || ''),
  );
}

export function erreurAnnulation() {
  return new ErreurFournisseur('annule', 'Envoi annulé.');
}

export function enErreurFournisseur(e) {
  if (e instanceof ErreurFournisseur) return e;
  return new ErreurFournisseur('inconnu', 'Erreur inattendue.', e && e.message ? e.message : String(e));
}
// === FIN_ERREURS_FOURNISSEUR ===
