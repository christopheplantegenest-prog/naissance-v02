// === DEBUT_CONFIG ===
// NAISSANCE V0.2 - Tous les parametres reglables de l'organisme.
// Ce fichier ne contient AUCUNE logique : uniquement des valeurs.
// C'est le seul fichier a modifier pour regler l'oreille.

export const CONFIG = {

  // === DEBUT_CONFIG_AUDIO ===
  audio: {
    // Frequence d'echantillonnage souhaitee. Le navigateur peut la refuser
    // (Android impose souvent 48000). Tout est recalcule a partir de la
    // frequence reellement obtenue : aucune constante ne suppose 16000.
    feSouhaitee: 16000,
    // Nombre d'echantillons accumules dans l'AudioWorklet avant transmission.
    // Plus petit = perception plus reguliere, plus d'allocations.
    tailleBlocWorklet: 256
  },
  // === FIN_CONFIG_AUDIO ===

  // === DEBUT_CONFIG_OREILLE ===
  oreille: {
    fenetreMs: 32,        // duree de la fenetre d'analyse
    pasMs: 10,            // intervalle entre deux trames (cadence perceptive)
    nbBandes: 64,         // nombre de filtres du banc
    fMinHz: 80,           // borne basse du banc
    fMaxHz: 7600,         // borne haute souhaitee
    ratioNyquist: 0.45,   // borne haute effective = min(fMaxHz, ratio * fe)
    gainLog: 1e6          // compression : ln(1 + energie * gainLog)
  },
  // === FIN_CONFIG_OREILLE ===

  // === DEBUT_CONFIG_TAMPON_EXPERIMENTAL ===
  // ATTENTION - PARAMETRE EXPERIMENTAL DE GESTATION.
  // Ce tampon circulaire n'est PAS une memoire a court terme et ne constitue
  // AUCUNE hypothese sur le fonctionnement futur de la memoire. C'est un
  // simple dispositif technique permettant a l'experimentateur de conserver
  // momentanement le flux necessaire a l'observation. La memoire a court
  // terme et la memoire a long terme seront concues separement.
  tampon: {
    secondes: 6
  },
  // === FIN_CONFIG_TAMPON_EXPERIMENTAL ===

  // === DEBUT_CONFIG_ACTIVITE ===
  // Detection d'activite acoustique. Elle ne sert QU'A baliser le flux pour
  // l'observation : elle ne cree aucun souvenir et ne categorise rien.
  activite: {
    plancherInitial: 0.003,
    lissageRepos: 0.02,      // adaptation du plancher hors activite
    lissageActivite: 0.001,  // adaptation, tres lente, pendant l'activite
    plancherMin: 0.0005,
    facteurHaut: 4.0,
    offsetHaut: 0.006,
    facteurBas: 2.2,
    offsetBas: 0.003,
    tramesMinActivite: 16,   // en dessous, l'activite n'est pas signalee
    tramesSilenceFin: 20     // silence consecutif marquant la fin
  },
  // === FIN_CONFIG_ACTIVITE ===

  // === DEBUT_CONFIG_OBSERVATION ===
  // Instruments de laboratoire. Rien ici n'appartient a l'organisme.
  observation: {
    maxCaptures: 12,
    tramesMaxParCapture: 600
  },
  affichage: {
    imagesParSeconde: 25,
    contrasteMin: 0.0,
    contrasteMax: 12.0
  }
  // === FIN_CONFIG_OBSERVATION ===
};
// === FIN_CONFIG ===
