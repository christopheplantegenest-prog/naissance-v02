// === DEBUT_CATALOGUE_ACTIONS ===
// Les actions que Naissance peut DEMANDER. Le moteur ne les exécute jamais :
// il envoie une demande structurée, le programme la contrôle puis l'exécute.
//
// Une action déclare :
//   nom, description (pour le moteur, {personne} remplacé), parametres (schéma JSON simple),
//   niveau : 'libre'   → interne et réversible, exécutée directement
//            'accord'  → confirmation de la personne AVANT chaque exécution
//            'bloquee' → jamais exécutée
//   valider(parametres) → { ok: true, parametres } | { ok: false, raison }
//   executer(parametres, contexte) → résultat (objet)
//   resumer(parametres) → phrase lisible (confirmation, journal)
//   noter(resultat) → phrase courte affichée sous la réponse
//   enCours (facultatif) → phrase affichée pendant l'exécution

import { retenir } from './retenir.js';

export { controlerSchema } from './schema.js';

export const NIVEAUX = Object.freeze(['libre', 'accord', 'bloquee']);

export function creerCatalogue(actions) {
  const parNom = new Map();
  for (const a of actions) {
    if (!a || typeof a.nom !== 'string' || !/^[a-z][a-zA-Z0-9_]{1,40}$/.test(a.nom)) throw new Error('Action mal définie.');
    if (!NIVEAUX.includes(a.niveau)) throw new Error(`Niveau inconnu pour ${a.nom}.`);
    for (const f of ['valider', 'executer', 'resumer', 'noter']) {
      if (typeof a[f] !== 'function') throw new Error(`Action ${a.nom} : ${f} manquant.`);
    }
    if (parNom.has(a.nom)) throw new Error(`Action ${a.nom} en double.`);
    parNom.set(a.nom, Object.freeze(a));
  }
  const disponibles = () => [...parNom.values()].filter((a) => a.niveau !== 'bloquee');
  const remplir = (t, personne) => String(t).replaceAll('{personne}', personne || 'la personne');
  return {
    trouver: (nom) => (typeof nom === 'string' ? parNom.get(nom) || null : null),
    // Ce que le moteur voit : jamais de fonction, seulement des descriptions.
    declarations: (personne) => disponibles().map((a) => ({
      nom: a.nom,
      description: remplir(a.description, personne),
      parametres: JSON.parse(remplir(JSON.stringify(a.parametres), personne)),
    })),
    resumes: (personne) => disponibles().map((a) => ({ nom: a.nom, description: remplir(a.resumeCapacite || a.description, personne) })),
  };
}

// Les actions réellement disponibles dans cette version : UNE seule.
export const catalogueParDefaut = creerCatalogue([retenir]);
// === FIN_CATALOGUE_ACTIONS ===
