// === DEBUT_REGISTRE_FOURNISSEURS ===
// Liste des fournisseurs disponibles. Ajouter un fournisseur =
// créer un fichier avec la même interface que gemini.js et l'inscrire ici.
//
// SEUL POINT DE PASSAGE vers le moteur externe : ce registre est l'unique importeur de gemini.js. Quand le mode local
// est actif (préférence de l'appareil, app/reglages/mode-local.js), obtenirFournisseur rend un fournisseur COUPÉ :
// mêmes id, nom, lienCle, aideCle et ordonnerModeles, mais tester, envoyer, generer, converser et sonder refusent sans
// aucun appel réseau (erreur de code « reglage »). Rien n'est supprimé : dès que le mode local est désactivé,
// obtenirFournisseur rend de nouveau le vrai fournisseur, intact.
import * as gemini from './gemini.js';
import { lireModeLocal, erreurModeLocal } from '../reglages/mode-local.js';

const FOURNISSEURS = [gemini];

export const FOURNISSEUR_PAR_DEFAUT = FOURNISSEURS[0].id;

export function listerFournisseurs() {
  return FOURNISSEURS.map((f) => ({ id: f.id, nom: f.nom }));
}

function couper(f) {
  const refuser = async () => { throw erreurModeLocal(); };
  return Object.freeze({
    id: f.id,
    nom: f.nom,
    lienCle: f.lienCle,
    aideCle: f.aideCle,
    ordonnerModeles: f.ordonnerModeles,
    tester: async () => ({ ok: false, essais: [], erreur: erreurModeLocal() }),
    envoyer: refuser,
    generer: refuser,
    converser: refuser,
    sonder: refuser,
  });
}

const COUPES = new Map(FOURNISSEURS.map((f) => [f.id, couper(f)]));

// stockage : facultatif (par défaut, le stockage de l'appareil), seulement pour lire la préférence du mode local.
export function obtenirFournisseur(id, stockage) {
  const f = FOURNISSEURS.find((x) => x.id === id) || FOURNISSEURS[0];
  const actif = stockage === undefined ? lireModeLocal() : lireModeLocal(stockage);
  return actif ? COUPES.get(f.id) : f;
}
// === FIN_REGISTRE_FOURNISSEURS ===
