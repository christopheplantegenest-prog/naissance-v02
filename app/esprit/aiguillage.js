// === DEBUT_AIGUILLAGE ===
// Choisit le moteur pour un message, selon le mode réglé par la personne.
// Règles volontairement prudentes : le petit moteur local n'est pas considéré comme fiable
// pour les connaissances, l'actualité, la programmation, les longues analyses, les gros textes
// ni les demandes d'action. Aucun appel à un moteur pour décider.

import { ErreurFournisseur } from '../fournisseurs/erreurs.js';

const sansAccents = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const LONGUEUR_MAX_LOCAL = 280;

const MOTIFS = [
  [/```|[{};<>]|\b(code|programm\w*|python|javascript|typescript|java|kotlin|html|css|sql|json|fonction|bug|compil\w*|script|algorithm\w*|debogu\w*)\b/, 'programmation'],
  [/\b(retiens|retenir|souviens-toi|note (que|bien)|memorise\w*|n'oublie pas|rappelle-toi de)\b/, 'action à faire'],
  [/\b(actualite\w*|dernieres nouvelles|en ce moment dans le monde|meteo|resultats? du match|bourse|elections?|guerre|president)\b/, 'actualité'],
  [/\b(qui est|qui etait|qu'est-ce qu'(un|une)|qu'est-ce que (c'est|le|la|les|l')|c'est quoi|combien|en quelle annee|quand (a|est|etait)|capitale|population|definition|date de|comment fonctionne|explique\w*|pourquoi (le|la|les|l'))\b/, 'connaissances précises'],
  [/\b(detaill\w*|analyse\w*|resume\w*|redige\w*|ecris[- ]moi|ecris (un|une)|liste (complete|de|des)|compare\w*|tradui\w*|plan de|dissertation|rapport|article|lettre|histoire|recette)\b/, 'texte long ou analyse'],
  [/\d{3,}|\d\s*[+*/x×÷-]\s*\d/, 'calcul ou chiffres'],
];

export function evaluerDemande(message) {
  const texte = String(message || '');
  if (texte.length > LONGUEUR_MAX_LOCAL) return { adaptee: false, raison: 'message long' };
  if ((texte.match(/\?/g) || []).length > 1) return { adaptee: false, raison: 'plusieurs questions' };
  const t = sansAccents(texte).replace(/’/g, "'");
  for (const [motif, raison] of MOTIFS) {
    if (motif.test(t)) return { adaptee: false, raison };
  }
  return { adaptee: true, raison: 'échange simple' };
}

// → { moteur: 'local' | 'externe' | 'aucun', raison, note }
export function decider({ mode, message, localDisponible, externeDisponible, forcerExterne = false }) {
  if (forcerExterne) {
    return externeDisponible
      ? { moteur: 'externe', raison: 'demandé par la personne', note: '' }
      : { moteur: 'aucun', raison: "Aucun moteur externe n'est configuré (Réglages)." };
  }
  if (mode === 'externe-seul') {
    return externeDisponible
      ? { moteur: 'externe', raison: 'mode externe seulement', note: '' }
      : { moteur: 'aucun', raison: "Aucun moteur externe n'est configuré : ouvre les Réglages." };
  }
  if (mode === 'local-seul') {
    return localDisponible
      ? { moteur: 'local', raison: 'mode local seulement', note: '' }
      : { moteur: 'aucun', raison: "Le moteur local n'est pas disponible : ouvre Réglages → Moteur local." };
  }
  if (mode === 'externe-dabord') {
    if (externeDisponible) return { moteur: 'externe', raison: "mode externe d'abord", note: '' };
    if (localDisponible) return { moteur: 'local', raison: 'aucun moteur externe configuré', note: '' };
    return { moteur: 'aucun', raison: 'Aucun moteur disponible : ouvre les Réglages.' };
  }
  // local d'abord
  if (!localDisponible) {
    return externeDisponible
      ? { moteur: 'externe', raison: 'moteur local indisponible', note: '' }
      : { moteur: 'aucun', raison: 'Aucun moteur disponible : ouvre les Réglages.' };
  }
  if (!externeDisponible) return { moteur: 'local', raison: 'aucun moteur externe configuré', note: '' };
  const e = evaluerDemande(message);
  if (e.adaptee) return { moteur: 'local', raison: e.raison, note: '' };
  return { moteur: 'externe', raison: e.raison, note: `Demande confiée à un moteur externe (${e.raison}).` };
}

const joindre = (...notes) => notes.filter(Boolean).join(' ');

// Envoie le message au moteur choisi, avec repli prudent.
// local / externe : { libelle, envoyer(args) } ou null.
export async function envoyerAiguille({
  mode, local, externe, message, forcerExterne = false,
  preparer, actions, executer, surEtape = () => {}, signal = null,
}) {
  const choix = decider({ mode, message, localDisponible: !!local, externeDisponible: !!externe, forcerExterne });
  if (choix.moteur === 'aucun') throw new ErreurFournisseur('reglage', choix.raison);

  if (choix.moteur === 'local') {
    try {
      const r = await local.envoyer({ preparer, surEtape, signal });
      return { ...r, local: true, note: joindre(choix.note, r.note) };
    } catch (e) {
      if ((e && e.code === 'annule') || mode === 'local-seul' || !externe) throw e;
      surEtape({ type: 'repli-local', raison: e.message });
      const r = await externe.envoyer({ preparer, actions, executer, surEtape, signal });
      return {
        ...r,
        local: false,
        note: joindre(`Le moteur local n'a pas pu répondre (${e.message}) : réponse d'un moteur externe.`, r.note),
      };
    }
  }

  try {
    const r = await externe.envoyer({ preparer, actions, executer, surEtape, signal });
    return { ...r, local: false, note: joindre(choix.note, r.note) };
  } catch (e) {
    const replier = mode === 'externe-dabord' && local && !forcerExterne
      && e && ['indisponible', 'reseau', 'delai', 'quota', 'service'].includes(e.code);
    if (!replier) throw e;
    surEtape({ type: 'repli-externe', raison: e.message });
    const r = await local.envoyer({ preparer, surEtape, signal });
    return { ...r, local: true, note: joindre("Moteurs externes indisponibles : réponse du moteur local.", r.note) };
  }
}
// === FIN_AIGUILLAGE ===
