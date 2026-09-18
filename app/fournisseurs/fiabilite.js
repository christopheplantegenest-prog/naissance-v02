// === DEBUT_FIABILITE_MOTEUR ===
// Exécute une tâche sur un modèle avec :
//  - une relance après une erreur passagère du service (503…), après un court délai ;
//  - un repli vers d'autres modèles, dans la limite de quelques essais ;
//  - la mémoire locale de la santé des modèles (fournisseurs/sante.js).
// Question purement technique : Naissance ne sait rien de ce qui se passe ici.

import { ErreurFournisseur, enErreurFournisseur, erreurAnnulation } from './erreurs.js';
import {
  lireSante, noterSucces, noterEchec, ordonnerCandidats, etatModele,
  enPauseLongue, quotaDuJourAtteint, repriseDe, prochaineRemiseAZero,
} from './sante.js';

export const REGLES_FIABILITE = Object.freeze({
  relances: 1,              // nouvel essai sur le même modèle après un 503
  delaiRelanceMs: 2500,
  maxModeles: 3,            // modèles différents essayés au plus pour une même demande
  budgetMs: 75000,          // au-delà, on n'essaie plus de nouveau modèle
});

const RELANCER = new Set(['service']);
const CHANGER_DE_MODELE = new Set(['service', 'delai', 'modele', 'quota']);

export const nomCourt = (modele) => String(modele || '').replace(/^models\//, '');
export const heureCourte = (ms) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function attendreParDefaut(ms, signal) {
  return new Promise((ok, ko) => {
    if (signal && signal.aborted) { ko(erreurAnnulation()); return; }
    const minuteur = setTimeout(() => { if (signal) signal.removeEventListener('abort', stop); ok(); }, ms);
    const stop = () => { clearTimeout(minuteur); ko(erreurAnnulation()); };
    if (signal) signal.addEventListener('abort', stop, { once: true });
  });
}

function resumeEssais(essais) {
  return essais.map((e) => `${nomCourt(e.modele)} : ${e.code}${e.detail ? ` (${e.detail})` : ''}`).join(' ; ');
}

const estQuotaJour = (e) => e && e.code === 'quota' && e.quota && e.quota.periode === 'jour';

// tache(modele, signal) → résultat. Renvoie { resultat, modele, repli, essais }.
// repli = null, ou { de, vers, code, definitif, quotaJour } si un autre modèle que le préféré a répondu.
// surEtape(evenement) : { type: 'essai' | 'relance' | 'repli', ... } pour afficher la progression.
export async function executerAvecRepli({
  fournisseur,
  prefere,
  modeles,
  tache,
  stockage,
  horloge = () => new Date(),
  attendre = attendreParDefaut,
  regles = REGLES_FIABILITE,
  surEtape = () => {},
  signal = null,
}) {
  const debut = horloge().getTime();
  const sante = lireSante(stockage);
  const etat = (id) => etatModele(sante, fournisseur.id, id);
  const candidats = ordonnerCandidats({
    fournisseur: fournisseur.id,
    prefere,
    modeles,
    sante,
    maintenant: debut,
    ordonner: fournisseur.ordonnerModeles,
  }).slice(0, regles.maxModeles);
  if (!candidats.length) {
    // Tout est en pause. Une pause courte (saturation) peut être levée : on retente UN modèle.
    // Une pause longue (quota du jour, modèle disparu) ne l'est pas : aucun appel inutile.
    const ordre = [prefere, ...(fournisseur.ordonnerModeles || ((l) => l))(modeles || []).map((m) => m.id)].filter(Boolean);
    const secours = ordre.find((id) => !enPauseLongue(etat(id), debut));
    if (secours) {
      candidats.push(secours);
    } else if (ordre.length) {
      const reprises = ordre.map((id) => repriseDe(etat(id))).filter(Boolean);
      const prochaine = reprises.length ? Math.min(...reprises) : null;
      throw new ErreurFournisseur(
        'indisponible',
        `Les quotas gratuits du jour sont atteints pour les modèles disponibles${prochaine ? ` : reprise vers ${heureCourte(prochaine)}` : ''}. Rien ne sera facturé.`,
        ordre.map((id) => `${nomCourt(id)} : ${etat(id).code || '?'} jusqu'à ${etat(id).jusqua || '?'}`).join(' ; '),
      );
    }
  }
  if (!candidats.length) {
    throw new ErreurFournisseur('modele', 'Aucun modèle choisi : ouvre Réglages et appuie sur « Enregistrer et tester ».');
  }

  const essais = [];
  let erreurPrefere = null;
  // Si le modèle choisi est déjà écarté (échec récent), on retient pourquoi.
  const codeEcarte = prefere && !candidats.includes(prefere) ? (etat(prefere).code || 'attente') : null;
  const quotaJourEcarte = prefere && !candidats.includes(prefere) && quotaDuJourAtteint(etat(prefere), debut);
  if (codeEcarte) surEtape({ type: 'repli', de: prefere, vers: candidats[0], code: codeEcarte, quotaJour: quotaJourEcarte });

  for (const [rang, modele] of candidats.entries()) {
    if (rang > 0 && horloge().getTime() - debut > regles.budgetMs) break;
    for (let tentative = 0; tentative <= regles.relances; tentative++) {
      if (signal && signal.aborted) throw erreurAnnulation();
      surEtape({ type: 'essai', modele, rang, tentative });
      try {
        const resultat = await tache(modele, signal);
        noterSucces(fournisseur.id, modele, horloge().toISOString(), stockage);
        const code = erreurPrefere ? erreurPrefere.code : (codeEcarte || 'attente');
        const repli = modele === prefere || !prefere ? null : {
          de: prefere,
          vers: modele,
          code: codeEcarte && !erreurPrefere && !quotaJourEcarte ? 'attente' : code,
          definitif: code === 'modele',
          quotaJour: erreurPrefere ? estQuotaJour(erreurPrefere) : quotaJourEcarte,
        };
        return { resultat, modele, repli, essais };
      } catch (brute) {
        // Toute annulation (bouton Annuler), d'où qu'elle vienne, arrête tout sans pénaliser le modèle.
        if ((brute && brute.code === 'annule') || (signal && signal.aborted)) {
          throw brute && brute.code === 'annule' ? brute : erreurAnnulation();
        }
        const e = enErreurFournisseur(brute);
        essais.push({ modele, code: e.code, message: e.message, detail: e.detail, quotaJour: estQuotaJour(e) });
        if (!CHANGER_DE_MODELE.has(e.code)) throw e; // clé, accès, message bloqué… : changer de modèle n'y changerait rien
        if (RELANCER.has(e.code) && tentative < regles.relances) {
          surEtape({ type: 'relance', modele, code: e.code, attenteMs: regles.delaiRelanceMs * (tentative + 1) });
          await attendre(regles.delaiRelanceMs * (tentative + 1), signal);
          continue;
        }
        noterEchec(fournisseur.id, modele, e, horloge().toISOString(), stockage);
        if (modele === prefere) erreurPrefere = e;
        const suivant = candidats[rang + 1];
        if (suivant) surEtape({ type: 'repli', de: modele, vers: suivant, code: e.code, quotaJour: estQuotaJour(e) });
        break;
      }
    }
  }
  const quotas = essais.length && essais.every((e) => e.code === 'quota');
  const quotasJour = quotas && essais.every((e) => e.quotaJour);
  let message = 'Aucun modèle n’a pu répondre pour le moment. Réessaie dans quelques minutes.';
  if (quotasJour) {
    const reprise = prochaineRemiseAZero(horloge().getTime());
    message = `Les quotas gratuits du jour sont atteints : reprise vers ${heureCourte(reprise)}. Rien ne sera facturé.`;
  } else if (quotas) {
    message = 'Les quotas gratuits des modèles disponibles sont atteints pour le moment. Réessaie plus tard : rien ne sera facturé.';
  }
  throw new ErreurFournisseur('indisponible', message, resumeEssais(essais));
}

// Vérifie pour de vrai quels modèles répondent (appel minimal), jusqu'au premier qui marche.
// Renvoie { modele (ou null), essais: [{ modele, ok, code, message }] }.
export async function verifierModeles({ fournisseur, acces, prefere, modeles, stockage, horloge = () => new Date(), max = REGLES_FIABILITE.maxModeles }) {
  const sante = lireSante(stockage);
  const ordre = ordonnerCandidats({
    fournisseur: fournisseur.id, prefere, modeles, sante,
    maintenant: horloge().getTime(), ordonner: fournisseur.ordonnerModeles,
  }).slice(0, max);
  const essais = [];
  for (const modele of ordre) {
    try {
      await fournisseur.sonder({ ...acces, modele });
      noterSucces(fournisseur.id, modele, horloge().toISOString(), stockage);
      essais.push({ modele, ok: true });
      return { modele, essais };
    } catch (brute) {
      const e = enErreurFournisseur(brute);
      essais.push({ modele, ok: false, code: e.code, message: e.message, detail: e.detail });
      if (!CHANGER_DE_MODELE.has(e.code)) return { modele: null, essais, erreur: e };
      noterEchec(fournisseur.id, modele, e, horloge().toISOString(), stockage);
    }
  }
  return { modele: null, essais };
}

// Phrase discrète affichée quand un autre modèle que le préféré a répondu.
export function noteDeRepli(repli) {
  if (!repli) return '';
  const de = nomCourt(repli.de);
  const vers = nomCourt(repli.vers);
  if (repli.quotaJour) {
    return `${de} a atteint son quota gratuit du jour : réponse donnée par ${vers}.`;
  }
  if (repli.definitif) {
    return `${de} n'est plus disponible : Naissance utilise désormais ${vers} (modifiable dans Réglages).`;
  }
  if (repli.code === 'attente') {
    return `Réponse donnée par ${vers} : ${de} est mis de côté quelques minutes après un problème récent.`;
  }
  return `Réponse donnée par ${vers} : ${de} ne répond pas pour le moment.`;
}
// === FIN_FIABILITE_MOTEUR ===

// Phrase de progression affichée pendant l'attente.
export function libelleEtape(e) {
  if (!e) return 'Naissance réfléchit…';
  if (e.type === 'essai') return e.rang === 0 && e.tentative === 0 ? 'Naissance réfléchit…' : `Essai avec ${nomCourt(e.modele)}…`;
  if (e.type === 'relance') return `${nomCourt(e.modele)} est saturé : nouvel essai dans ${Math.round(e.attenteMs / 1000)} s…`;
  if (e.type === 'repli') {
    const de = nomCourt(e.de);
    if (e.quotaJour) return `Quota du jour atteint pour ${de} : essai avec ${nomCourt(e.vers)}…`;
    const raisons = { service: 'est saturé', delai: 'est trop lent', modele: "n'existe plus", quota: 'a atteint son quota', attente: 'est en pause' };
    return `${de} ${raisons[e.code] || 'ne répond pas'} : essai avec ${nomCourt(e.vers)}…`;
  }
  if (e.type === 'action') return e.texte || 'Naissance agit…';
  if (e.type === 'local') {
    return e.phase === 'chargement' ? 'Moteur local : chargement du modèle…' : 'Moteur local : lecture de ta demande…';
  }
  if (e.type === 'repli-local') return "Le moteur local n'a pas pu répondre : essai avec un moteur externe…";
  if (e.type === 'repli-externe') return 'Moteurs externes indisponibles : essai avec le moteur local…';
  return 'Naissance réfléchit…';
}
