// === DEBUT_CONFIG ===
// NAISSANCE V0.3 - Tous les parametres reglables de l'organisme.
// Ce fichier ne contient AUCUNE logique : uniquement des valeurs.

export const CONFIG = {

  // === DEBUT_CONFIG_AUDIO ===
  // Support uniquement : taille des blocs remontes par l'AudioWorklet.
  audio: {
    tailleBlocWorklet: 256
  },
  // === FIN_CONFIG_AUDIO ===

  // === DEBUT_CONFIG_ENTREE ===
  // L'oreille externe. La frequence native de l'appareil n'est jamais
  // imposee : elle est constatee, puis convertie vers cette frequence
  // sensorielle interne FIXE. C'est ce qui rend la perception identique
  // d'un telephone, d'un navigateur ou d'un systeme a l'autre.
  entree: {
    feInterne: 24000,
    fMaxHz: 10500,        // borne haute du banc : fixe la bande passante
    attenuationDb: 80,    // attenuation en bande coupee
    phases: 256,          // quantification de la phase fractionnaire
    tailleBlocMax: 2048
  },
  // === FIN_CONFIG_ENTREE ===

  // === DEBUT_CONFIG_OREILLE ===
  // Fenetres candidates, en ECHANTILLONS a feInterne. Puissances de deux :
  // la taille de FFT egale exactement la longueur de la fenetre, donc
  // AUCUN zero n'est ajoute et la resolution affichee est la resolution
  // reelle (1 / duree d'observation).
  //   1024 = 42,67 ms | 512 = 21,33 ms | 256 = 10,67 ms
  //    128 =  5,33 ms |  64 =  2,67 ms
  // Chaque bande recoit la PLUS COURTE fenetre dont la resolution suffit
  // a separer son centre de celui de sa voisine. L'affectation est
  // CALCULEE, jamais ecrite en dur.
  oreille: {
    nbBandes: 46,
    fMinHz: 80,
    fMaxHz: 10500,
    pasMs: 10,
    gainLog: 1e6,
    fenetresCandidates: [1024, 512, 256, 128, 64],
    fenetreEnergie: 512   // fenetre servant au calcul de l'energie globale
  },
  // === FIN_CONFIG_OREILLE ===

  // === DEBUT_CONFIG_TAMPON_EXPERIMENTAL ===
  // ATTENTION - PARAMETRE EXPERIMENTAL DE GESTATION.
  // Ce tampon circulaire n'est PAS une memoire a court terme et ne
  // constitue AUCUNE hypothese sur le fonctionnement futur de la memoire.
  // Dispositif technique permettant a l'experimentateur de conserver
  // momentanement le flux necessaire a l'observation.
  tampon: {
    secondes: 6
  },
  // === FIN_CONFIG_TAMPON_EXPERIMENTAL ===

  // === DEBUT_CONFIG_ACTIVITE ===
  // Balisage du flux pour l'observation. Ne cree aucun souvenir, ne
  // categorise rien, n'interrompt jamais la perception.
  activite: {
    plancherInitial: 0.003,
    lissageRepos: 0.02,
    lissageActivite: 0.001,
    plancherMin: 0.0005,
    facteurHaut: 4.0,
    offsetHaut: 0.006,
    facteurBas: 2.2,
    offsetBas: 0.003,
    tramesMinActivite: 16,
    tramesSilenceFin: 20
  },
  // === FIN_CONFIG_ACTIVITE ===

  // === DEBUT_CONFIG_OBSERVATION ===
  // Instruments de laboratoire. Rien ici n'appartient a l'organisme.
  observation: {
    maxCaptures: 12,
    tramesMaxParCapture: 600,
    tramesAgitation: 100
  },
  affichage: {
    imagesParSeconde: 25,
    contrasteMin: 0.0,
    contrasteMax: 14.0
  }
  // === FIN_CONFIG_OBSERVATION ===
};
// === FIN_CONFIG ===
