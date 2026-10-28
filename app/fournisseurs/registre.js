// === DEBUT_REGISTRE_FOURNISSEURS ===
// Liste des fournisseurs disponibles. Ajouter un fournisseur =
// créer un fichier avec la même interface que gemini.js et l'inscrire ici.
//
// SEUL POINT DE PASSAGE vers un moteur externe : tout appelant obtient son fournisseur ici.
// Quand le mode local est actif (reglages/mode-local.js), obtenirFournisseur rend un fournisseur
// COUPÉ : mêmes id, nom, lienCle, aideCle, ordonnerModeles, mais tester, envoyer, generer,
// converser et sonder échouent (code « reglage ») sans aucun appel réseau, même si une clé
// et un modèle sont enregistrés. Rien n'est supprimé : mode local désactivé, le vrai
// fournisseur est rendu, inchangé.
import * as gemini from './gemini.js';
import { lireModeLocal, erreurModeLocal } from '../reglages/mode-local.js';

const FOURNISSEURS = [gemini];

export const FOURNISSEUR_PAR_DEFAUT = FOURNISSEURS[0].id;

export function listerFournisseurs() {
  return FOURNISSEURS.map((f) => ({ id: f.id, nom: f.nom }));
}

// Fournisseur coupé : aucune de ses fonctions n'atteint le réseau.
function couper(f) {
  return Object.freeze({
    id: f.id,
    nom: f.nom,
    lienCle: f.lienCle,
    aideCle: f.aideCle,
    ordonnerModeles: f.ordonnerModeles,
    async tester() { return { ok: false, essais: [], erreur: erreurModeLocal() }; },
    async envoyer() { throw erreurModeLocal(); },
    async generer() { throw erreurModeLocal(); },
    async converser() { throw erreurModeLocal(); },
    async sonder() { throw erreurModeLocal(); },
  });
}

const COUPES = new Map(FOURNISSEURS.map((f) => [f.id, couper(f)]));

// stockage : facultatif (localStorage par défaut), lu à CHAQUE appel : décocher la case rend aussitôt le vrai fournisseur.
export function obtenirFournisseur(id, stockage) {
  const f = FOURNISSEURS.find((x) => x.id === id) || FOURNISSEURS[0];
  return lireModeLocal(stockage) ? COUPES.get(f.id) : f;
}
// === FIN_REGISTRE_FOURNISSEURS ===
