// === DEBUT_FIABILITE_MOTEUR ===
// Exécute une tâche sur un modèle avec :
//  - une relance après une erreur passagère du service (503…), après un court délai ;
//  - un repli vers d'autres modèles, dans la limite de quelques essais ;
//  - la mémoire locale de la santé des modèles (fournisseurs/sante.js).
// Question purement technique : Naissance ne sait rien de ce qui se passe ici.

import { ErreurFournisseur, enErreurFournisseur } from './erreurs.js';
import { lireSante, noterSucces, noterEchec, ordonnerCandidats, etatModele } from './sante.js';

export const REGLES_FIABILITE = Object.freeze({
  relances: 1,              // nouvel essai sur le même modèle après un 503
  delaiRelanceMs: 2500,
  maxModeles: 3,            // modèles différents essayés au plus pour une même demande
});

const RELANCER = new Set(['service']);
const CHANGER_DE_MODELE = new Set(['service', 'delai', 'modele', 'quota']);

export const nomCourt = (modele) => String(modele || '').replace(/^models\//, '');

const attendreParDefaut = (ms) => new Promise((ok) => setTimeout(ok, ms));

function resumeEssais(essais) {
  return essais.map((e) => `${nomCourt(e.modele)} : ${e.code}${e.detail ? ` (${e.detail})` : ''}`).join(' ; ');
}

// tache(modele) → résultat. Renvoie { resultat, modele, repli, essais }.
// repli = null, ou { de, vers, code, definitif } si un autre modèle que le préféré a répondu.
export async function executerAvecRepli({
  fournisseur,
  prefere,
  modeles,
  tache,
  stockage,
  horloge = () => new Date(),
  attendre = attendreParDefaut,
  regles = REGLES_FIABILITE,
}) {
  const sante = lireSante(stockage);
  const candidats = ordonnerCandidats({
    fournisseur: fournisseur.id,
    prefere,
    modeles,
    sante,
    maintenant: horloge().getTime(),
    ordonner: fournisseur.ordonnerModeles,
  }).slice(0, regles.maxModeles);
  // Tout est en attente : on retente quand même le modèle choisi plutôt que de ne rien faire.
  if (!candidats.length && prefere) candidats.push(prefere);
  if (!candidats.length) {
    throw new ErreurFournisseur('modele', 'Aucun modèle choisi : ouvre Réglages et appuie sur « Enregistrer et tester ».');
  }

  const essais = [];
  let erreurPrefere = null;
  // Si le modèle choisi est déjà écarté (échec récent), on retient pourquoi.
  const codeEcarte = prefere && !candidats.includes(prefere)
    ? (etatModele(sante, fournisseur.id, prefere).code || 'attente')
    : null;
  for (const modele of candidats) {
    for (let tentative = 0; tentative <= regles.relances; tentative++) {
      try {
        const resultat = await tache(modele);
        noterSucces(fournisseur.id, modele, horloge().toISOString(), stockage);
        const code = erreurPrefere ? erreurPrefere.code : (codeEcarte || 'attente');
        const repli = modele === prefere || !prefere ? null : {
          de: prefere,
          vers: modele,
          code: codeEcarte && !erreurPrefere ? 'attente' : code,
          definitif: code === 'modele',
        };
        return { resultat, modele, repli, essais };
      } catch (brute) {
        const e = enErreurFournisseur(brute);
        essais.push({ modele, code: e.code, message: e.message, detail: e.detail });
        if (!CHANGER_DE_MODELE.has(e.code)) throw e; // clé, accès, message bloqué… : changer de modèle n'y changerait rien
        const encoreUneFois = RELANCER.has(e.code) && tentative < regles.relances;
        if (encoreUneFois) {
          await attendre(regles.delaiRelanceMs * (tentative + 1));
          continue;
        }
        noterEchec(fournisseur.id, modele, e, horloge().toISOString(), stockage);
        if (modele === prefere) erreurPrefere = e;
        break;
      }
    }
  }
  const quota = essais.length && essais.every((e) => e.code === 'quota');
  throw new ErreurFournisseur(
    'indisponible',
    quota
      ? 'Les quotas gratuits des modèles disponibles sont atteints pour le moment. Réessaie plus tard : rien ne sera facturé.'
      : 'Aucun modèle n’a pu répondre pour le moment. Réessaie dans quelques minutes.',
    resumeEssais(essais),
  );
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
  if (repli.definitif) {
    return `${de} n'est plus disponible : Naissance utilise désormais ${vers} (modifiable dans Réglages).`;
  }
  if (repli.code === 'attente') {
    return `Réponse donnée par ${vers} : ${de} est mis de côté quelques minutes après un problème récent.`;
  }
  return `Réponse donnée par ${vers} : ${de} ne répond pas pour le moment.`;
}
// === FIN_FIABILITE_MOTEUR ===
