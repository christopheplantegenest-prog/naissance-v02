// === DEBUT_REGISTRE_FOURNISSEURS ===
// Liste des fournisseurs disponibles. Ajouter un fournisseur =
// créer un fichier avec la même interface que gemini.js et l'inscrire ici.
import * as gemini from './gemini.js';

const FOURNISSEURS = [gemini];

export const FOURNISSEUR_PAR_DEFAUT = FOURNISSEURS[0].id;

export function listerFournisseurs() {
  return FOURNISSEURS.map((f) => ({ id: f.id, nom: f.nom }));
}

export function obtenirFournisseur(id) {
  return FOURNISSEURS.find((f) => f.id === id) || FOURNISSEURS[0];
}
// === FIN_REGISTRE_FOURNISSEURS ===
