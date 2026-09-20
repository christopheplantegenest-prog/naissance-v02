// === DEBUT_SOLUTIONS_MEMOIRE ===
// Mémoire EXPÉRIMENTALE du banc comparatif de solutions : 12 faits contrôlés, écrits en dur ici.
// Elle ne touche JAMAIS la vraie mémoire de Naissance (ni IndexedDB, ni les souvenirs de Christophe) :
// le banc construit son contexte de toutes pièces et ne lit rien de la mémoire réelle.
// Toutes les approches comparées reçoivent exactement les mêmes faits.

// relation : identifiant stable, sert à la recherche déterministe (approches 1, 2, 5, 6).
// phrase   : la même information écrite en français (ce que reçoit le témoin, approche 0).
// valeur   : la valeur seule, protégée dans l'approche 5.
export const MEMOIRE_TEST = Object.freeze([
  { sujet: 'Christophe', relation: 'prenom', valeur: 'Christophe', phrase: "La personne s'appelle Christophe." },
  { sujet: 'Naissance', relation: 'nom_ia', valeur: 'Naissance', phrase: "L'IA s'appelle Naissance." },
  { sujet: 'Christophe', relation: 'ville', valeur: 'Marcillac-Lanville', phrase: 'Christophe habite à Marcillac-Lanville.' },
  { sujet: 'Christophe', relation: 'couleur_preferee', valeur: 'bleu', phrase: 'La couleur préférée de Christophe est le bleu.' },
  { sujet: 'Christophe', relation: 'nombre_enfants', valeur: 'deux', phrase: 'Christophe a deux enfants.' },
  { sujet: 'Christophe', relation: 'prenom_fils', valeur: 'Atem', phrase: "Le fils de Christophe s'appelle Atem." },
  { sujet: 'Christophe', relation: 'prenom_fille', valeur: 'Levana', phrase: "La fille de Christophe s'appelle Levana." },
  { sujet: 'Christophe', relation: 'plat_prefere', valeur: 'la raclette', phrase: 'Le plat préféré de Christophe est la raclette.' },
  { sujet: 'Christophe', relation: 'evenement_recent', valeur: 'il est allé au marché samedi', phrase: 'Christophe est allé au marché samedi.' },
  { sujet: 'Christophe', relation: 'ville_naissance', valeur: 'Strasbourg', phrase: 'Christophe est né à Strasbourg.' },
  // Deux faits volontairement proches : même forme, valeurs différentes — permettent d'observer
  // si le modèle mélange deux couleurs au lieu de choisir la bonne.
  { sujet: 'Levana', relation: 'couleur_preferee', valeur: 'vert', phrase: 'La couleur préférée de Levana est le vert.' },
  { sujet: 'Atem', relation: 'couleur_preferee', valeur: 'rouge', phrase: "La couleur préférée d'Atem est le rouge." },
]);

// Recherche déterministe : Naissance sait, sans le moindre appel au modèle, si le fait existe.
export function chercherFait(sujet, relation, memoire = MEMOIRE_TEST) {
  return memoire.find((f) => f.sujet === sujet && f.relation === relation) || null;
}

export const PERSONNES = Object.freeze({ premiere: '1re personne', deuxieme: '2e personne', troisieme: '3e personne' });

// 12 questions : les neuf catégories demandées, dont 3 sans réponse en mémoire.
// sujet/relation : ce que Naissance doit chercher (déterministe, aucune inférence).
// personne : la formulation employée, pour observer les confusions de référent.
export const QUESTIONS = Object.freeze([
  { id: 'couleur-1re', question: 'Quelle est ma couleur préférée ?', sujet: 'Christophe', relation: 'couleur_preferee', personne: 'premiere', categorie: 'couleur', destinataire: 'Christophe' },
  { id: 'couleur-3e', question: 'Quelle est la couleur préférée de Levana ?', sujet: 'Levana', relation: 'couleur_preferee', personne: 'troisieme', categorie: 'couleur', destinataire: 'Christophe' },
  { id: 'lieu-1re', question: "Où est-ce que j'habite ?", sujet: 'Christophe', relation: 'ville', personne: 'premiere', categorie: 'lieu', destinataire: 'Christophe' },
  { id: 'lieu-3e', question: 'Où habite Christophe ?', sujet: 'Christophe', relation: 'ville', personne: 'troisieme', categorie: 'lieu', destinataire: 'Christophe' },
  { id: 'nombre-1re', question: "Combien j'ai d'enfants ?", sujet: 'Christophe', relation: 'nombre_enfants', personne: 'premiere', categorie: 'nombre', destinataire: 'Christophe' },
  { id: 'prenom-ia-2e', question: "Comment tu t'appelles ?", sujet: 'Naissance', relation: 'nom_ia', personne: 'deuxieme', categorie: 'identite', destinataire: 'Christophe' },
  { id: 'prenom-moi-1re', question: "Comment je m'appelle ?", sujet: 'Christophe', relation: 'prenom', personne: 'premiere', categorie: 'identite', destinataire: 'Christophe' },
  { id: 'relation-1re', question: "Comment s'appelle mon fils ?", sujet: 'Christophe', relation: 'prenom_fils', personne: 'premiere', categorie: 'relation', destinataire: 'Christophe' },
  { id: 'preference-1re', question: 'Quel est mon plat préféré ?', sujet: 'Christophe', relation: 'plat_prefere', personne: 'premiere', categorie: 'preference', destinataire: 'Christophe' },
  // Trois questions dont l'information n'existe PAS dans la mémoire de test.
  { id: 'absente-pointure', question: 'Quelle est ma pointure ?', sujet: 'Christophe', relation: 'pointure', personne: 'premiere', categorie: 'absente', destinataire: 'Christophe' },
  { id: 'absente-voiture', question: 'Quelle voiture je conduis ?', sujet: 'Christophe', relation: 'voiture', personne: 'premiere', categorie: 'absente', destinataire: 'Christophe' },
  { id: 'absente-travail', question: 'Où est-ce que je travaille ?', sujet: 'Christophe', relation: 'lieu_travail', personne: 'premiere', categorie: 'absente', destinataire: 'Christophe' },
]);

export const GRAINE_COMPARAISON = 4242;
// === FIN_SOLUTIONS_MEMOIRE ===
