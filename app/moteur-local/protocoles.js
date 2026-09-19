// === DEBUT_PROTOCOLES ===
// Épreuves de diagnostic du moteur local. Ce sont des DONNÉES : rien ici ne corrige quoi que ce soit,
// tout sert à observer et à isoler les causes. {personne} et {ia} sont remplacés au moment de l'essai.
//
// Champs d'une épreuve :
//   groupe          : à quel phénomène elle s'attaque
//   question        : ce qui est envoyé au moteur
//   sujet           : de qui parle la question ('personne' ou 'ia') — sert à repérer les confusions de rôle
//   attendu         : 'fait' (réutiliser l'information fournie) ou 'ignorance' (dire qu'elle ne sait pas)
//   souvenirsImposes: souvenirs placés de force, pour court-circuiter la sélection et n'observer que le moteur
//   sansSouvenirs   : aucun souvenir, même si la sélection en trouve
//   limite          : nombre maximal de jetons de la réponse (pour tester les réponses très courtes)

export const GROUPES = Object.freeze({
  roles: 'Rôles (je / tu)',
  formulations: 'Formulations du même fait',
  types: 'Types de faits (lieu, prénom, couleur, nombre)',
  impose: 'Souvenir imposé, juste avant la question',
  absence: 'Information absente',
  longueur: 'Longueur de la réponse',
});

const EPREUVES = [
  // 1. Rôles : mêmes faits, mais « je » ou « tu ».
  { id: 'role-nom-ia', groupe: 'roles', question: "Comment tu t'appelles ?", sujet: 'ia', attendu: 'fait' },
  { id: 'role-nom-moi', groupe: 'roles', question: "Comment je m'appelle ?", sujet: 'personne', attendu: 'fait' },
  { id: 'role-habite-moi', groupe: 'roles', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait' },
  { id: 'role-habite-ia', groupe: 'roles', question: 'Où est-ce que tu habites ?', sujet: 'ia', attendu: 'fait' },
  { id: 'role-couleur-moi', groupe: 'roles', question: 'Quelle est ma couleur préférée ?', sujet: 'personne', attendu: 'fait' },
  { id: 'role-couleur-ia', groupe: 'roles', question: 'Quelle est ta couleur préférée ?', sujet: 'ia', attendu: 'fait' },

  // 2. Même fait demandé de plusieurs façons : teste la sélection et la compréhension.
  { id: 'form-habite-1', groupe: 'formulations', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait' },
  { id: 'form-habite-2', groupe: 'formulations', question: 'Tu te souviens de ma ville ?', sujet: 'personne', attendu: 'fait' },
  { id: 'form-habite-3', groupe: 'formulations', question: 'Je vis où déjà ?', sujet: 'personne', attendu: 'fait' },
  { id: 'form-habite-4', groupe: 'formulations', question: 'Rappelle-moi ma commune.', sujet: 'personne', attendu: 'fait' },
  { id: 'form-famille', groupe: 'formulations', question: 'Que sais-tu de ma famille ?', sujet: 'personne', attendu: 'fait' },

  // 3. Types de faits, avec le souvenir imposé pour n'observer que le moteur.
  { id: 'type-lieu', groupe: 'types', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['{personne} habite à Marcillac-Lanville.'] },
  { id: 'type-prenom', groupe: 'types', question: "Comment s'appelle mon fils ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ["Le fils de {personne} s'appelle Atem."] },
  { id: 'type-couleur', groupe: 'types', question: 'Quelle est ma couleur préférée ?', sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['La couleur préférée de {personne} est le bleu.'] },
  { id: 'type-nombre', groupe: 'types', question: "Combien j'ai d'enfants ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['{personne} a deux enfants.'] },

  // 4. Même fait, souvenir écrit de trois façons : la formulation du souvenir change-t-elle la confusion ?
  { id: 'impose-3e-personne', groupe: 'impose', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['{personne} habite à Marcillac-Lanville.'] },
  { id: 'impose-tutoiement', groupe: 'impose', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['Tu habites à Marcillac-Lanville.'] },
  { id: 'impose-brut', groupe: 'impose', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['Ville de {personne} : Marcillac-Lanville.'] },

  // 5. Information absente : reconnaît-elle qu'elle ne sait pas ?
  { id: 'absence-pointure', groupe: 'absence', question: 'Quelle est ma pointure ?', sujet: 'personne', attendu: 'ignorance', sansSouvenirs: true },
  { id: 'absence-voiture', groupe: 'absence', question: 'Quelle voiture je conduis ?', sujet: 'personne', attendu: 'ignorance', sansSouvenirs: true },
  { id: 'absence-habite', groupe: 'absence', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'ignorance', sansSouvenirs: true },

  // 6. Longueur : la continuation inventée disparaît-elle si on coupe très tôt ?
  { id: 'court-20', groupe: 'longueur', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['{personne} habite à Marcillac-Lanville.'], limite: 20 },
  { id: 'court-60', groupe: 'longueur', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait',
    souvenirsImposes: ['{personne} habite à Marcillac-Lanville.'], limite: 60 },
];

export const PROTOCOLES = Object.freeze({
  complet: 'Tout le protocole',
  roles: GROUPES.roles,
  formulations: GROUPES.formulations,
  types: GROUPES.types,
  impose: GROUPES.impose,
  absence: GROUPES.absence,
  longueur: GROUPES.longueur,
});

export function epreuves(protocole = 'complet', { personne = 'Christophe', ia = 'Naissance' } = {}) {
  const remplacer = (t) => String(t).replaceAll('{personne}', personne).replaceAll('{ia}', ia);
  return EPREUVES
    .filter((e) => protocole === 'complet' || e.groupe === protocole)
    .map((e) => ({
      ...e,
      question: remplacer(e.question),
      souvenirsImposes: e.souvenirsImposes ? e.souvenirsImposes.map(remplacer) : null,
    }));
}
// === FIN_PROTOCOLES ===
