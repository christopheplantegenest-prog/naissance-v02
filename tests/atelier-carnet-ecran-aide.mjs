// v0.65.19 — AT-10.2 : gestes communs des tests de la section 12 (écran Atelier, carnet de trois missions), partagés par
// tests/atelier-carnet-ecran.test.mjs (AT-10.1) et tests/atelier-carnet-preparation.test.mjs (AT-10.2). OUTILLAGE NON COGNITIF, aucun réseau.
import { monterEcran } from './atelier-aide.mjs';
import { CLE_ATELIER, CLE_CARNET } from '../app/atelier/ecran.js';
import { canonique, decouper, ecrireEtatDurable, texteConfirmation } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { empreinteProposition, etatDurableCarnet } from '../app/atelier/carnet.js';
import { CARNET, BASE, proposition, mission, chantierPrepare } from './atelier-carnet-aide.mjs';

export const V = '0.65.18';
export const P = proposition();
export const EMP = empreinteProposition(P);
export const parties = (v, id = CARNET) => decouper(canonique(v), id);
export const carnet = (a) => JSON.parse(a.stockage.getItem(CLE_CARNET));
export async function coller(a, textes) {
  for (const t of textes) { a.saisir('partie-carnet', t); await a.cliquer('ajouter-partie-carnet'); }
}
export async function installer(a, p = P) {
  await coller(a, parties(p));
  await a.cliquer('installer-carnet');
}
export async function sauverCarnet(a, commit = 'd'.repeat(40)) {
  await a.cliquer('preparer-sauvegarde-carnet');
  const empreinte = hacherSha256(canonique(etatDurableCarnet(carnet(a).journal)));
  a.saisir('confirmation-carnet', texteConfirmation({ chantier: CARNET, empreinte, commit }));
  await a.cliquer('enregistrer-confirmation-carnet');
}
export const actif = (a, nom) => !a.un(nom).disabled;
// v0.65.19 — AT-10.2 : préparation LOCALE attendue de la mission 1 (valeurs écrites à la main, au format de la saisie : contrôle
// indépendant de ecran.js). 0,15 USD = plafond ; 0,1012 USD = estimation maximale de l'appel (10000 x 5 + 2048 x 25 microdollars).
export const FORMULAIRE_M1 = Object.freeze({
  chantier: 'carnet-essai-m1', objectif: mission(1).objectif, version: '0.65.17', sha: BASE.sha, jalons: [{ id: 'essai-1', titre: 'Essai 1', critere: 'Test essai-1 vert.', tentativesMax: '1' }],
  budget: { cycle: 'carnet-essai-m1', plafond: '0,15', reserve: '0,00', plafondRun: '0,15', plafondChantier: '0,15' },
  auto: { modele: 'claude-opus-5-5', entree_max: '10000', max_tokens: '2048', tarif_entree: '5,00', tarif_sortie: '25,00' },
  developpement: { effort: 'low', tarif_entree: '5,00', tarif_sortie: '25,00', maximum: '0,1012', extraits: '' },
});
export const FICHES_M1 = Object.freeze({ 'essai-1': { comportement: 'Le module essai-1 existe et son test passe.', criteres: 'Le module essai-1 rend la valeur attendue.', tests: 'tests/atelier-essai-1.test.mjs',
  autorises: 'app/atelier/essai-1.js\ntests/atelier-essai-1.test.mjs', interdits: '', frontieres: 'Aucun changement cognitif.', decisions: [] } });
export const FORMULAIRE_VIDE = Object.freeze({ chantier: '', objectif: '', version: V, sha: '', jalons: [{ id: '', titre: '', critere: '', tentativesMax: '2' }], budget: { cycle: '', plafond: '', reserve: '', plafondRun: '', plafondChantier: '' } });
// MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : le chantier de la mission 1 est PRÉPARÉ (chantierPrepare : cycle et plafond de la mission,
// lancement AUTO, instantané, faits fictifs) avec sa préparation locale (fiche, formulaires) ; local = false : fiche et formulaires vides,
// comme après une restauration. Sauvegarde confirmée à jour par défaut.
export function copieChantier(o = {}, sauvegarde = true, local = true) {
  const c = chantierPrepare(1, o);
  const copie = { version: 3, mode: 'MANUEL', formulaire: structuredClone(local ? FORMULAIRE_M1 : FORMULAIRE_VIDE), fiches: structuredClone(local ? FICHES_M1 : {}), journal: c.journal, registre: c.registre, mission: null, pieces: c.pieces, piecesDepuis: 1, sauvegarde: null };
  if (sauvegarde) copie.sauvegarde = { empreinte: ecrireEtatDurable(copie).empreinte, commit: 'e'.repeat(40), evenements: c.journal.length };
  return copie;
}
// Écran avec un carnet approuvé, sauvegardé, mission 1 ouverte ; puis le chantier m1 installé dans la copie du chantier.
export async function missionOuverte(o, sauvegarde) {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await installer(a);
  await a.cliquer('approuver-carnet');
  await sauverCarnet(a);
  await a.cliquer('ouvrir-mission-1');
  const c = copieChantier(o, sauvegarde);
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(c));
  a.ecran.rafraichir();
  return { a, c };
}
// Bouton dessiné dans un état permis, déclenché après un changement d'état : la garde de la FONCTION doit refuser.
export const declencher = async (bouton) => { for (const f of bouton.listeners.click) await f(); };
