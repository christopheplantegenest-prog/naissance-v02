// === DEBUT_LANGAGE_GEMINI_PROFESSEUR ===
// v0.13 — Gemini comme PROFESSEUR ponctuel de Naissance, jamais sa voix permanente.
//
// Ne réimplémente RIEN de la tuyauterie Gemini : ce fichier ne sait pas ce qu'est une clé API, un
// modèle, ni comment parler au réseau. Il reçoit un « appelerGemini » déjà prêt (fourni par
// l'appelant, qui réutilise fournisseurs/gemini.js et les réglages existants) et ne s'occupe que de
// deux choses : construire le contrat, et vérifier strictement ce qui en revient.
//
// GEMINI N'EST JAMAIS CONSIDÉRÉ COMME FIABLE PAR DÉFAUT : chaque ligne renvoyée dans "lecons"
// repasse par extraireLecon() (lecon.js), EXACTEMENT comme une leçon tapée par Christophe. Une
// ligne qui ne correspond à aucun des quatre gabarits est rejetée, jamais devinée ni corrigée.
// "note" n'est JAMAIS apprise : c'est le seul endroit où Gemini peut être bavard.

import { extraireLecon, TYPES_LECON } from './lecon.js';

// Construit le contrat à partir des MÊMES définitions que le canal utilise pour lire (TYPES_LECON) —
// jamais recopiées à la main, pour qu'un futur changement de gabarit ne puisse pas faire diverger
// en silence ce que Gemini croit pouvoir enseigner et ce que Naissance sait réellement lire.
export function construireContrat({ sujet, maxLecons = 3, exemplesConnus = [] }) {
  const formes = Object.values(TYPES_LECON).map((f) => `- ${f}`).join('\n');
  const exemples = exemplesConnus.length
    ? `\n\nCe que je sais déjà, dans ce même format (inspire-toi de la forme, pas forcément du contenu) :\n${exemplesConnus.map((e) => `- ${e}`).join('\n')}`
    : '';
  return [
    'Tu es le professeur de Naissance, une IA personnelle en apprentissage.',
    "Naissance ne peut mémoriser une connaissance que si elle est écrite EXACTEMENT sous l'une de ces formes, une phrase complète par ligne :",
    formes,
    exemples,
    '',
    "Réponds UNIQUEMENT par un objet JSON de cette forme, rien d'autre, aucun texte avant ni après :",
    '{"lecons": ["...", "..."], "note": "une phrase pour Christophe, jamais apprise par Naissance"}',
    '',
    `Chaque élément de "lecons" doit être UNE SEULE phrase respectant EXACTEMENT l'une des quatre formes ci-dessus, sans aucun mot ajouté avant ou après, sans numérotation. Propose au maximum ${maxLecons} leçon(s) — une seule si elle suffit à enseigner le sujet demandé. Toute remarque, explication ou nuance va dans "note", jamais dans "lecons".`,
    '',
    `Christophe souhaite que tu enseignes à Naissance : ${sujet}`,
  ].filter(Boolean).join('\n');
}

// Vérifie STRICTEMENT ce qui revient de Gemini, quel que soit le contrat utilisé pour le demander :
// chaque ligne repasse par extraireLecon() (lecon.js), EXACTEMENT comme une leçon tapée par
// Christophe. Partagée par demanderEnseignement() (un sujet) et demanderDecompositionCours()
// (un cours entier) : la vérification ne dépend jamais de la façon dont la demande a été formulée.
function validerLignesProposees(donnees) {
  const lecons = Array.isArray(donnees?.lecons) ? donnees.lecons : [];
  const note = typeof donnees?.note === 'string' && donnees.note.trim() ? donnees.note.trim() : null;
  const reconnues = [];
  const rejetees = [];
  for (const texte of lecons) {
    const t = String(texte ?? '').trim();
    if (!t) continue;
    const extrait = extraireLecon(t);
    if (extrait) reconnues.push({ texte: t, extrait });
    else rejetees.push(t);
  }
  return { note, reconnues, rejetees };
}

// Demande UN enseignement, puis vérifie strictement ce qui revient. Ne lève une exception QUE si
// appelerGemini lui-même échoue (réseau, pas de modèle configuré, JSON illisible) — dans tous les
// autres cas (tableau vide, lignes invalides, mélange), la fonction rend un résultat normal :
// Naissance sait dire « je n'ai rien reçu d'exploitable », ce n'est pas une erreur technique.
export async function demanderEnseignement({ sujet, maxLecons = 3, exemplesConnus = [], appelerGemini, signal }) {
  const instructions = construireContrat({ sujet, maxLecons, exemplesConnus });
  const donnees = await appelerGemini({ instructions, entree: sujet, signal });
  return validerLignesProposees(donnees);
}

// === v0.21 — ASSIMILATION D'UN COURS (DÉCISION CHATGPT, VOIE A) ==================================
// Gemini comme DÉCOMPOSEUR d'un cours entier (prose libre, plusieurs phrases, plusieurs faits) —
// jamais sa mémoire : chaque ligne qu'il propose repasse, ici comme ailleurs, par extraireLecon().
// Contrat volontairement proche de construireContrat() (mêmes cinq formes, même JSON strict) mais
// tourné vers la DÉCOMPOSITION FIDÈLE d'un texte donné, pas vers l'invention d'un sujet.
export function construireContratCours({ titre, prose, maxLecons = 50, exemplesConnus = [] }) {
  const formes = Object.values(TYPES_LECON).map((f) => `- ${f}`).join('\n');
  const exemples = exemplesConnus.length
    ? `\n\nCe que je sais déjà, dans ce même format (inspire-toi de la forme, pas forcément du contenu) :\n${exemplesConnus.map((e) => `- ${e}`).join('\n')}`
    : '';
  return [
    'Tu es le professeur de Naissance, une IA personnelle en apprentissage.',
    "Naissance ne peut mémoriser une connaissance que si elle est écrite EXACTEMENT sous l'une de ces formes, une phrase complète par ligne :",
    formes,
    exemples,
    '',
    "Réponds UNIQUEMENT par un objet JSON de cette forme, rien d'autre, aucun texte avant ni après :",
    '{"lecons": ["...", "..."], "note": "une phrase pour Christophe, jamais apprise par Naissance"}',
    '',
    `Voici un COURS donné par Christophe. Décompose-le fidèlement en PLUSIEURS connaissances distinctes, une par ligne, chacune respectant EXACTEMENT l'une des formes ci-dessus. N'invente rien et n'ajoute aucune information absente du cours. Ignore les phrases qui ne sont pas des faits (consignes, politesse). Propose au maximum ${maxLecons} connaissance(s).`,
    '',
    `Titre du cours : ${titre || '(sans titre)'}`,
    'Cours à décomposer :',
    prose,
  ].filter(Boolean).join('\n');
}

// Ne lève une exception QUE si appelerGemini lui-même échoue — mêmes garanties que
// demanderEnseignement() : jamais d'écriture ici, seulement des candidates déjà revalidées.
export async function demanderDecompositionCours({ titre, prose, maxLecons = 50, exemplesConnus = [], appelerGemini, signal }) {
  const instructions = construireContratCours({ titre, prose, maxLecons, exemplesConnus });
  const donnees = await appelerGemini({ instructions, entree: prose, signal });
  return validerLignesProposees(donnees);
}
// === FIN_LANGAGE_GEMINI_PROFESSEUR ===
