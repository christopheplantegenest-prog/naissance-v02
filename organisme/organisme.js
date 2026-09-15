// === DEBUT_ORGANISME ===
// NAISSANCE V0.3 - Orchestrateur de l'organisme.
//
// Seul point de contact avec le support. Il recoit des echantillons a la
// frequence NATIVE de l'appareil et emet des trames perceptives. Il ne
// connait ni le DOM, ni Web Audio, ni le navigateur.
//
// Chaine : echantillons natifs
//            -> reechantillonneur (oreille externe, frequence interne fixe)
//            -> anneau d'echantillons internes
//            -> extraction de N fenetres CENTREES SUR LE MEME INSTANT
//            -> oreille multi-resolution
//            -> trame
//
// L'organisme percoit en continu. Il ne conclut rien.

import { Reechantillonneur } from './reechantillonneur.js';
import { Oreille } from './oreille.js';
import { FluxPerceptif } from './flux.js';
import { DetecteurActivite } from './activite.js';

export class Organisme {

  constructor(feNative, config) {
    this.config = config;

    // --- oreille externe : frequence native -> frequence interne fixe
    this.reechantillonneur = new Reechantillonneur(
      feNative, config.entree.feInterne, config.entree
    );
    this.fe = config.entree.feInterne;

    // --- oreille interne
    this.oreille = new Oreille(this.fe, config.oreille);
    this.pas = this.oreille.pasEchantillons;

    const capacite = Math.max(
      1, Math.round(config.tampon.secondes * 1000 / config.oreille.pasMs)
    );
    this.flux = new FluxPerceptif(capacite, config.oreille.nbBandes);
    this.detecteur = new DetecteurActivite(config.activite);

    // === DEBUT_ALIGNEMENT_TEMPOREL ===
    // Toutes les fenetres sont centrees sur le MEME instant c.
    // Une fenetre de taille n couvre les echantillons [c - n/2, c + n/2 - 1].
    // La plus longue fixe donc le retard : la trame d'instant c ne peut
    // etre calculee qu'une fois recu l'echantillon c + tailleMax/2 - 1.
    this.tailleMax = this.oreille.tailles[0];
    this.demiMax = this.tailleMax / 2;

    let capaciteAnneau = 1;
    while (capaciteAnneau < this.tailleMax + this.pas + 8) { capaciteAnneau *= 2; }
    this.anneau = new Float32Array(capaciteAnneau);
    this.masque = capaciteAnneau - 1;
    this.recus = 0;            // echantillons internes recus depuis le debut
    this.prochainCentre = this.demiMax;

    // tampons de travail, un par taille de fenetre, prealloues
    this.travail = this.oreille.tailles.map((n) => new Float32Array(n));
    this.indexEnergie = this.oreille.tailles.indexOf(config.oreille.fenetreEnergie);
    if (this.indexEnergie < 0) { this.indexEnergie = this.oreille.tailles.length - 1; }
    // === FIN_ALIGNEMENT_TEMPOREL ===

    this.bandes = new Float32Array(config.oreille.nbBandes);

    this.surTrame = null;
    this.surEvenement = null;

    // mesures de cout, volontairement legeres
    this.tramesProduites = 0;
    this.echantillonsInternes = 0;
    this.tempsCalculFenetre = 0;
    this.tramesFenetre = 0;
    this.horloge = (typeof performance !== 'undefined' && performance.now)
      ? () => performance.now()
      : () => Date.now();
  }

  // === DEBUT_RECEPTION_ECHANTILLONS ===
  recevoirEchantillons(bloc) {
    const interne = this.reechantillonneur.traiter(bloc);
    const n = interne.length;
    for (let i = 0; i < n; i++) {
      this.anneau[this.recus & this.masque] = interne[i];
      this.recus = this.recus + 1;
    }
    this.echantillonsInternes = this.recus;

    while (this.prochainCentre + this.demiMax <= this.recus) {
      this.analyserInstant(this.prochainCentre);
      this.prochainCentre = this.prochainCentre + this.pas;
    }
  }
  // === FIN_RECEPTION_ECHANTILLONS ===

  // === DEBUT_PRODUCTION_TRAME ===
  analyserInstant(centre) {
    const t0 = this.horloge();

    // extraction des fenetres, toutes centrees sur `centre`
    for (let i = 0; i < this.travail.length; i++) {
      const cible = this.travail[i];
      const taille = cible.length;
      let src = (centre - taille / 2) & this.masque;
      for (let j = 0; j < taille; j++) {
        cible[j] = this.anneau[src];
        src = (src + 1) & this.masque;
      }
    }

    // energie globale : RMS des echantillons BRUTS (non fenetres) de la
    // fenetre de reference, centree sur le meme instant.
    const ref = this.travail[this.indexEnergie];
    let somme = 0;
    for (let i = 0; i < ref.length; i++) { somme = somme + ref[i] * ref[i]; }
    const energie = Math.sqrt(somme / ref.length);

    this.oreille.analyser(this.travail, this.bandes);

    const tMs = centre * 1000 / this.fe;
    const index = this.flux.ecrire(tMs, this.bandes, energie, this.detecteur.actif);
    const evenement = this.detecteur.observer(energie, index);
    if (evenement !== null) {
      this.flux.actif[index % this.flux.capacite] = this.detecteur.actif ? 1 : 0;
    }

    const dt = this.horloge() - t0;
    this.tramesProduites = this.tramesProduites + 1;
    this.tempsCalculFenetre = this.tempsCalculFenetre + dt;
    this.tramesFenetre = this.tramesFenetre + 1;

    if (this.surTrame) {
      this.surTrame(index, this.bandes, energie, tMs, this.detecteur.actif);
    }
    if (evenement !== null && this.surEvenement) {
      this.surEvenement(evenement);
    }
  }
  // === FIN_PRODUCTION_TRAME ===

  // === DEBUT_MESURES_COUT ===
  mesurer() {
    const moyenne = this.tramesFenetre > 0
      ? this.tempsCalculFenetre / this.tramesFenetre : 0;
    this.tempsCalculFenetre = 0;
    this.tramesFenetre = 0;
    return {
      tramesProduites: this.tramesProduites,
      echantillonsInternes: this.echantillonsInternes,
      msParTrame: moyenne,
      octetsTampon: this.flux.octetsUtilises(),
      octetsParTrame: this.config.oreille.nbBandes * 4 + 13,
      capaciteTrames: this.flux.capacite
    };
  }
  // === FIN_MESURES_COUT ===

  // === DEBUT_RETARD ===
  retard() {
    const fenetreMs = 1000 * this.demiMax / this.fe;
    const reechMs = this.reechantillonneur.retardMs;
    return {
      fenetreMs: fenetreMs,
      reechantillonneurMs: reechMs,
      totalMs: fenetreMs + reechMs
    };
  }
  // === FIN_RETARD ===

  reinitialiser() {
    this.flux.vider();
    this.detecteur.reinitialiser();
    this.anneau.fill(0);
    this.recus = 0;
    this.prochainCentre = this.demiMax;
    this.tramesProduites = 0;
  }

  description() {
    const d = this.oreille.description();
    d.entree = this.reechantillonneur.description();
    d.retard = this.retard();
    d.capaciteTrames = this.flux.capacite;
    d.tamponSecondes = this.config.tampon.secondes;
    d.octetsTampon = this.flux.octetsUtilises();
    d.octetsParSeconde = (this.config.oreille.nbBandes * 4 + 13)
      * Math.round(1000 / this.config.oreille.pasMs);
    return d;
  }
}
// === FIN_ORGANISME ===
