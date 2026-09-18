// === DEBUT_MOTEUR_LOCAL ===
// Le moteur local vu par Naissance : même rôle qu'un moteur externe (produire du texte),
// en lecture seule (aucune action, aucun rangement). Il n'est jamais Naissance :
// le supprimer ne fait rien perdre.

import { ErreurFournisseur } from '../fournisseurs/erreurs.js';
import { PROFIL_LFM2, enChatML, nettoyerReponse } from './profil.js';
import { lireReglagesLocaux, noterMesure } from './reglages-local.js';
import { construireTrace, noterTrace } from './diagnostic.js';

export function creerMoteurLocal({
  pont, profil = PROFIL_LFM2, natif = false,
  lireReglages = lireReglagesLocaux, mesurer = noterMesure, tracer = noterTrace, horloge = () => new Date(),
}) {
  let etat = { natif, installe: false, fichierPresent: false, charge: false, taille: 0, arretBrutal: '', erreurNatif: '' };

  async function rafraichir() {
    if (!natif) {
      etat = { ...etat, natif: false, erreurNatif: "Le moteur local n'existe que dans l'appli Android." };
      return etat;
    }
    try {
      const i = await pont.infos();
      const f = (i.fichiers || []).find((x) => x.nom === profil.fichier);
      etat = {
        natif: !!i.natif,
        erreurNatif: i.erreurNatif || '',
        systeme: i.systeme || '',
        abi: i.abi || '',
        fichierPresent: !!f,
        installe: !!(f && f.verifie),
        taille: f ? f.taille : 0,
        charge: i.charge === profil.fichier,
        arretBrutal: i.arretBrutal || '',
        memoireLibre: i.memoireLibre || 0,
        memoireTotale: i.memoireTotale || 0,
      };
    } catch (e) {
      etat = { ...etat, natif: false, erreurNatif: e.message || String(e) };
    }
    return etat;
  }

  const utilisable = () => !!(etat.natif && etat.installe && !lireReglages().suspendu);

  async function assurerCharge(surEtape) {
    if (etat.charge) return;
    surEtape({ type: 'local', phase: 'chargement' });
    await pont.charger(profil.fichier);
    etat = { ...etat, charge: true };
  }

  // journaliser = false : essai du banc, rien n'est gardé comme « dernière réponse ».
  async function envoyer({ preparer, surEtape = () => {}, signal = null, journaliser = true }) {
    if (!utilisable()) throw new ErreurFournisseur('local', "Le moteur local n'est pas disponible.");
    const contexte = await preparer(profil.libelle, 'local');
    if (contexte.tropLong) throw new ErreurFournisseur('local', 'Demande trop longue pour le moteur local.');
    try {
      await assurerCharge(surEtape);
    } catch (e) {
      etat = { ...etat, charge: false };
      throw e;
    }
    const { prefixe, suite } = enChatML(contexte);
    surEtape({ type: 'local', phase: 'lecture' });
    let resultat;
    try {
      resultat = await pont.genererEtAttendre({
        prefixe, suite, nCtx: profil.nCtx, nMax: profil.nMax, nFils: profil.nFils, signal,
        echantillonnage: profil.echantillonnage, delaiMs: profil.delaiMs,
        surPartiel: (texte) => surEtape({ type: 'partiel', texte: nettoyerReponse(texte) }),
      });
    } catch (e) {
      if (e.codeLocal === 'absent') etat = { ...etat, charge: false };
      throw e;
    }
    const texte = nettoyerReponse(resultat.texte);
    if (!texte) throw new ErreurFournisseur('local', 'Le moteur local a renvoyé une réponse vide.');
    const date = horloge().toISOString();
    if (journaliser) {
      mesurer({ date, modele: profil.id, ...resultat.mesures, estimation: contexte.estimation });
    }
    tracer(construireTrace({ question: contexte.elements.at(-1).texte, reponse: texte, contexte, mesures: resultat.mesures, date }));
    return { texte, libelle: profil.libelle, note: '', mesures: resultat.mesures, contexte };
  }

  return {
    profil,
    libelle: profil.libelle,
    rafraichir,
    etat: () => etat,
    utilisable,
    envoyer,
    telecharger: () => pont.telecharger(profil.url, profil.fichier),
    etatTelechargement: () => pont.etatTelechargement(),
    annulerTelechargement: () => pont.annulerTelechargement(),
    async supprimer() {
      const r = await pont.supprimer(profil.fichier);
      await rafraichir();
      return r;
    },
    async charger(forcer = false) {
      const r = await pont.charger(profil.fichier, forcer);
      etat = { ...etat, charge: true };
      return r;
    },
    async decharger() {
      await pont.decharger();
      etat = { ...etat, charge: false };
    },
    acquitterArret: () => pont.acquitterArret(),
    journal: () => pont.journal(),
  };
}
// === FIN_MOTEUR_LOCAL ===
