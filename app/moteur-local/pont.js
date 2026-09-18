// === DEBUT_PONT_MOTEUR_LOCAL ===
// Appels au module Android « MoteurLocal ». Les opérations longues sont lancées puis
// interrogées régulièrement (téléchargement, génération) : aucun rappel natif compliqué.

import { appelNatif } from '../natif.js';
import { ErreurFournisseur, erreurAnnulation } from '../fournisseurs/erreurs.js';

const MESSAGES = {
  memoire: 'Mémoire insuffisante pour le moteur local.',
  absent: "Le modèle local n'est pas installé ou pas chargé.",
  corrompu: 'Le fichier du modèle local est abîmé : supprime-le et télécharge-le à nouveau.',
  natif: "Le moteur local n'est pas disponible sur cet appareil.",
  echec: "Le moteur local n'a pas pu charger le modèle.",
  'trop-long': 'Demande trop longue pour le moteur local.',
  lecture: "Le moteur local n'a pas pu lire la demande.",
  ecriture: "Le moteur local s'est arrêté pendant l'écriture.",
  jetons: "Le moteur local n'a pas pu découper la demande.",
  occupe: 'Le moteur local est déjà occupé.',
};

export function erreurLocale(code, message) {
  if (code === 'annule') return erreurAnnulation();
  const e = new ErreurFournisseur('local', MESSAGES[code] || `Moteur local : ${message || 'erreur inconnue'}`, `${code || '?'} : ${message || ''}`);
  e.codeLocal = code || 'inconnu';
  return e;
}

export function creerPont(appel = appelNatif) {
  const app = async (methode, options = {}) => {
    try {
      return (await appel('MoteurLocal', methode, options)) || {};
    } catch (e) {
      throw erreurLocale(e && e.code, e && (e.message || String(e)));
    }
  };
  return {
    infos: () => app('infos'),
    acquitterArret: () => app('acquitterArret'),
    journal: () => app('journal'),
    telecharger: (url, fichier) => app('telecharger', { url, fichier }),
    etatTelechargement: () => app('etatTelechargement'),
    annulerTelechargement: () => app('annulerTelechargement'),
    supprimer: (fichier) => app('supprimer', { fichier }),
    charger: (fichier, forcer = false) => app('charger', { fichier, forcer }),
    decharger: () => app('decharger'),

    // Lance la génération puis suit son avancement jusqu'à la fin.
    async genererEtAttendre({
      prefixe, suite, nCtx, nMax, nFils, echantillonnage = {}, signal = null, surPartiel = () => {}, delaiMs = 150000,
      pause = (ms) => new Promise((ok) => setTimeout(ok, ms)), horloge = () => Date.now(),
    }) {
      if (signal && signal.aborted) throw erreurAnnulation();
      await app('generer', {
        prefixe, suite, nCtx, nMax, nFils,
        temperature: echantillonnage.temperature, topK: echantillonnage.topK,
        minP: echantillonnage.minP, penalite: echantillonnage.penalite,
      });
      const debut = horloge();
      let arretDemande = false;
      let delaiDepasse = false;
      let dernier = '';
      for (;;) {
        if (!arretDemande && signal && signal.aborted) {
          arretDemande = true;
          await app('arreter').catch(() => {});
        }
        if (!arretDemande && horloge() - debut > delaiMs) {
          arretDemande = true;
          delaiDepasse = true;
          await app('arreter').catch(() => {});
        }
        const r = await app('lireGeneration');
        const texte = typeof r.texte === 'string' ? r.texte : '';
        if (texte !== dernier) {
          dernier = texte;
          surPartiel(texte);
        }
        if (r.fini) {
          let resultat = {};
          try { resultat = JSON.parse(r.resultat || '{}'); } catch { resultat = { ok: false, code: 'natif', message: 'résultat illisible' }; }
          if (signal && signal.aborted) throw erreurAnnulation();
          if (delaiDepasse) throw new ErreurFournisseur('delai', 'Le moteur local est trop lent pour cette demande.');
          if (!resultat.ok) throw erreurLocale(resultat.code, resultat.message);
          return { texte, mesures: resultat };
        }
        await pause(200);
      }
    },
  };
}
// === FIN_PONT_MOTEUR_LOCAL ===
