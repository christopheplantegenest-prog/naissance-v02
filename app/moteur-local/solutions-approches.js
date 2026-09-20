// === DEBUT_SOLUTIONS_APPROCHES ===
// Les sept façons d'utiliser LE MÊME LFM2, comparées par le banc de solutions.
// Chacune est une fonction qui reçoit une question + la mémoire de test, et décrit ce qu'il faut
// envoyer au modèle. Aucune ne modifie LFM2, la mémoire réelle, ni l'architecture de Naissance :
// elles construisent un contexte de toutes pièces et le passent au moteur local tel quel.
//
// Une approche renvoie : { etapes: [...], construireReponse?(sorties) , refusAvantModele?: string }
//   etapes            : les appels au modèle à faire, dans l'ordre (souvent un seul).
//   refusAvantModele  : si Naissance constate déterministement l'absence du fait, elle peut
//                       répondre SANS appeler le modèle — c'est le cas des approches 1, 2, 5 et 6.
//   construireReponse : assemble la réponse finale à partir des sorties (approches 3 et 5).

import { chercherFait } from './solutions-memoire.js';

export const APPROCHES = Object.freeze({
  temoin: 'Témoin — comportement actuel',
  preparation: 'A1 — préparation structurée par Naissance',
  contrainte: 'A2 — sortie contrainte (valeur seule)',
  etapes: 'A3 — plusieurs petites inférences',
  verification: 'A4 — vérification après LFM2',
  protege: 'A5 — fait protégé, langage par LFM2',
  representation: 'A6 — représentation intermédiaire',
});

const IDENTITE_NORMALE = [
  "Tu es Naissance, l'IA personnelle de Christophe.",
  'Tu parles directement à Christophe et tu le tutoies.',
  'Réponds en deux phrases au maximum.',
  "N'invente rien : n'ajoute aucun détail qui ne t'a pas été donné ici.",
  'Si tu ne sais pas, dis-le simplement à Christophe.',
].join('\n');

const etape = (nom, prefixe, elements, limite = null) => ({ nom, prefixe, elements, limite });

// --- Témoin (approche 0) : exactement ce que fait Naissance aujourd'hui -------------------------
function temoin({ q, fait }) {
  const bloc = fait
    ? `Informations vraies sur Christophe, à utiliser telles quelles, sans rien ajouter :\n- ${fait.phrase}`
    : "Tu n'as aucun souvenir utile pour cette question : dis-le à Christophe plutôt que d'inventer.";
  return { etapes: [etape('reponse', IDENTITE_NORMALE, [
    { role: 'systeme', texte: bloc },
    { role: 'moi', texte: q.question },
  ])] };
}

// --- A1 : Naissance explicite qui parle, de qui on parle, ce qui est demandé --------------------
function preparation({ q, fait }) {
  if (!fait) {
    return { refusAvantModele: `Je ne sais pas : je n'ai aucune information sur ${etiquette(q.relation)} de ${q.sujet}.` };
  }
  const bloc = [
    `INTERLOCUTEUR : ${q.destinataire} (c'est à lui que tu réponds, tutoie-le)`,
    `SUJET DE LA QUESTION : ${q.sujet}`,
    `INFORMATION DEMANDÉE : ${etiquette(q.relation)}`,
    `FAIT DISPONIBLE : ${fait.valeur}`,
  ].join('\n');
  return { etapes: [etape('reponse', IDENTITE_NORMALE, [
    { role: 'systeme', texte: `${bloc}\n\nRéponds à l'interlocuteur en une phrase, en utilisant uniquement le fait disponible.` },
    { role: 'moi', texte: q.question },
  ])] };
}

// --- A2 : sortie extrêmement contrainte : la valeur seule, sans phrase -------------------------
function contrainte({ q, fait }) {
  if (!fait) return { refusAvantModele: 'Je ne sais pas.' };
  const bloc = `Information disponible : ${fait.valeur}\n\n`
    + 'Réponds UNIQUEMENT par la valeur demandée, sans phrase, sans commentaire, sans ponctuation finale.';
  return { etapes: [etape('reponse', IDENTITE_NORMALE, [
    { role: 'systeme', texte: bloc },
    { role: 'moi', texte: q.question },
  ], 12)] };
}

// --- A3 : trois petites inférences plutôt qu'une grosse ---------------------------------------
// Les deux premières servent à observer si le modèle identifie correctement le référent et la
// demande ; la troisième produit la réponse. Chaque sortie est enregistrée séparément.
function etapesMultiples({ q, fait }) {
  const bloc = fait ? `Fait connu : ${fait.phrase}` : 'Aucun fait connu sur ce sujet.';
  return {
    etapes: [
      etape('qui', "Tu analyses une question. Réponds en trois mots maximum.", [
        { role: 'systeme', texte: "Christophe parle à Naissance. Qui est le sujet de la question : Christophe, Naissance, ou quelqu'un d'autre ?" },
        { role: 'moi', texte: q.question },
      ], 10),
      etape('quoi', "Tu analyses une question. Réponds en trois mots maximum.", [
        { role: 'systeme', texte: 'Quelle information précise est demandée ? Réponds par le nom de l’information, rien d’autre.' },
        { role: 'moi', texte: q.question },
      ], 10),
      etape('reponse', IDENTITE_NORMALE, [
        { role: 'systeme', texte: `${bloc}\n\nRéponds à Christophe en une phrase, en le tutoyant, à partir de ce seul fait.` },
        { role: 'moi', texte: q.question },
      ]),
    ],
  };
}

// --- A4 : le modèle répond librement, puis Naissance vérifie ce qu'il a ajouté -----------------
// Même invite que le témoin : la différence est entièrement APRÈS la génération (voir verifier()).
function verification(args) {
  return { ...temoin(args), verifier: true };
}

// --- A5 : la valeur vient de Naissance, le modèle ne fait que la formulation -------------------
// Le modèle propose une phrase ; Naissance vérifie que la valeur protégée y figure intacte et
// qu'aucune autre valeur n'a été substituée. Sinon, elle retombe sur une phrase construite.
function protege({ q, fait }) {
  if (!fait) return { refusAvantModele: `Je ne sais pas : cette information ne fait pas partie de ce que je sais.` };
  const bloc = `Valeur exacte à transmettre, à recopier sans la modifier : « ${fait.valeur} »\n\n`
    + 'Écris une phrase courte qui transmet cette valeur à Christophe, en le tutoyant. '
    + 'Tu peux choisir les mots autour, mais la valeur doit apparaître telle quelle, sans rien y ajouter.';
  return {
    etapes: [etape('formulation', IDENTITE_NORMALE, [
      { role: 'systeme', texte: bloc },
      { role: 'moi', texte: q.question },
    ])],
    valeurProtegee: fait.valeur,
    secours: phraseDeSecours(q, fait),
  };
}

// --- A6 : représentation intermédiaire, moins ambiguë que du français -------------------------
function representation({ q, fait }) {
  if (!fait) return { refusAvantModele: 'Je ne sais pas.' };
  const bloc = [
    `SUJET=${q.sujet}`,
    `RELATION=${q.relation}`,
    `VALEUR=${fait.valeur}`,
    `DESTINATAIRE=${q.destinataire}`,
  ].join('\n');
  return { etapes: [etape('reponse', IDENTITE_NORMALE, [
    { role: 'systeme', texte: `${bloc}\n\nTransforme ceci en une phrase adressée au DESTINATAIRE, en le tutoyant.` },
    { role: 'moi', texte: q.question },
  ])] };
}

const ETIQUETTES = {
  prenom: 'le prénom', nom_ia: "le nom de l'IA", ville: 'la ville où il habite',
  couleur_preferee: 'la couleur préférée', nombre_enfants: "le nombre d'enfants",
  prenom_fils: 'le prénom du fils', prenom_fille: 'le prénom de la fille',
  plat_prefere: 'le plat préféré', evenement_recent: 'un événement récent',
  ville_naissance: 'la ville de naissance', pointure: 'la pointure',
  voiture: 'la voiture', lieu_travail: 'le lieu de travail',
};
function etiquette(relation) {
  return ETIQUETTES[relation] || relation.replace(/_/g, ' ');
}

function phraseDeSecours(q, fait) {
  const modeles = {
    ville: `Tu habites à ${fait.valeur}.`,
    couleur_preferee: q.sujet === 'Christophe' ? `Ta couleur préférée est ${fait.valeur}.` : `La couleur préférée de ${q.sujet} est ${fait.valeur}.`,
    nombre_enfants: `Tu as ${fait.valeur} enfants.`,
    prenom_fils: `Ton fils s'appelle ${fait.valeur}.`,
    prenom_fille: `Ta fille s'appelle ${fait.valeur}.`,
    plat_prefere: `Ton plat préféré est ${fait.valeur}.`,
    prenom: `Tu t'appelles ${fait.valeur}.`,
    nom_ia: `Je m'appelle ${fait.valeur}.`,
  };
  return modeles[q.relation] || `${fait.valeur}.`;
}

const CONSTRUCTEURS = {
  temoin, preparation, contrainte, etapes: etapesMultiples, verification, protege, representation,
};

// Construit le plan d'exécution d'une question pour une approche donnée.
export function preparerApproche(approche, q, memoire) {
  const fait = chercherFait(q.sujet, q.relation, memoire);
  const construit = CONSTRUCTEURS[approche]({ q, fait, memoire });
  return { ...construit, fait, approche, question: q };
}
// === FIN_SOLUTIONS_APPROCHES ===
