// === DEBUT_CONTEXTE ===
// Compose, dans des budgets fixes, ce qui part vers le moteur à chaque message :
//  1. identité (esprit/identite.js)
//  2. fil de l'histoire (résumé des échanges anciens)
//  3. souvenirs choisis (memoire/selection.js)
//  4. conversation récente (journal après le fil)
//  5. le message actuel
// Module pur : aucune lecture ni écriture, aucun moteur particulier.

import { texteIdentite } from './identite.js';
import { choisirSouvenirs } from '../memoire/selection.js';

export const BUDGETS = Object.freeze({
  fil: 1500,
  souvenirs: 3000,
  recents: 12000,
  maxRecents: 30,
});

export const LIBELLES_CONFIANCE = Object.freeze({
  certain: 'confirmé',
  probable: 'probable',
  incertain: 'incertain',
});

export function origineSouvenir(s, personne) {
  if (s.source === 'manuel') return `noté par ${personne}`;
  if (s.source === 'demande') return `retenu à la demande de ${personne}`;
  if (s.source === 'dit') return `dit par ${personne}`;
  return 'déduit';
}

export function ligneSouvenir(s, personne) {
  const confiance = LIBELLES_CONFIANCE[s.confiance] || 'incertain';
  return `- ${s.texte} (${confiance}, ${origineSouvenir(s, personne)})`;
}

function couper(texte, max) {
  const t = String(texte || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// Derniers messages qui tiennent dans le budget, en commençant par la personne.
export function choisirRecents(recents, { budget = BUDGETS.recents, max = BUDGETS.maxRecents } = {}) {
  const choisis = [];
  let taille = 0;
  for (let i = recents.length - 1; i >= 0 && choisis.length < max; i--) {
    const t = recents[i].texte.length;
    if (taille + t > budget) break;
    choisis.unshift(recents[i]);
    taille += t;
  }
  while (choisis.length && choisis[0].role !== 'moi') choisis.shift();
  return choisis;
}

// actions : [{ nom, description }] que le moteur peut DEMANDER (jamais exécuter lui-même).
// dejaFaites : lignes décrivant les actions déjà exécutées pour ce message (repli de moteur).
export function composerContexte({ identite, meta, fil, souvenirs, recents, message, moteur, maintenant, actions = [], dejaFaites = [] }) {
  const personne = identite.noyau.personne;
  const parties = [texteIdentite({ identite, neeLe: meta.neeLe, moteur, maintenant })];

  const resume = couper(fil && fil.texte, BUDGETS.fil);
  if (resume) {
    parties.push(`Résumé de votre histoire plus ancienne :\n${resume}`);
  }

  const { choisis, pertinents } = choisirSouvenirs(souvenirs || [], message, BUDGETS.souvenirs);
  if (choisis.length) {
    parties.push([
      `Tes souvenirs. Ils ont été retenus automatiquement au fil de vos conversations et peuvent être inexacts ou dépassés : ne les présente jamais comme des certitudes, et si ${personne} dit autre chose, c'est ${personne} qui a raison.`,
      ...choisis.map((s) => ligneSouvenir(s, personne)),
    ].join('\n'));
  } else {
    parties.push("Tu n'as encore aucun souvenir durable.");
  }

  if (actions.length) {
    parties.push([
      'Précision technique sur tes capacités : en plus de converser, tu peux maintenant demander au programme les actions suivantes. Le programme les contrôle, les exécute et te donne le résultat réel ; tu ne réponds qu’après ce résultat.',
      ...actions.map((a) => `- ${a.nom} : ${a.description}`),
    ].join('\n'));
  }
  if (dejaFaites.length) {
    parties.push([
      'Pendant cette demande, ces actions ont DÉJÀ été exécutées ; ne les redemande pas et tiens compte de leur résultat :',
      ...dejaFaites.map((l) => `- ${l}`),
    ].join('\n'));
  }

  const apresFil = (recents || []).filter((m) => m.id > ((fil && fil.jusqua) || 0));
  const historique = choisirRecents(apresFil).map(({ role, texte }) => ({ role, texte }));
  historique.push({ role: 'moi', texte: message });

  return {
    instructions: parties.join('\n\n'),
    historique,
    souvenirsUtilises: choisis.map((s) => s.id),
    souvenirsPertinents: pertinents.filter((id) => choisis.some((s) => s.id === id)),
  };
}
// === FIN_CONTEXTE ===
