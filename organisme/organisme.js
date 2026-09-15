// === DEBUT_ORGANISME ===
// NAISSANCE V0.2 - Orchestrateur de l'organisme.
//
// Seul point de contact avec le support. Il recoit des echantillons audio
// bruts et emet des trames perceptives. Il ne connait ni le DOM, ni Web Audio,
// ni le navigateur : uniquement des nombres.
//
// Contrat :
//   entree  -> recevoirEchantillons(Float32Array)
//   sortie  -> surTrame(index, bandes, energie, tMs, actif)
//              surEvenement({type, debut, fin, trames})
//
// L'organisme percoit en continu. Il ne conclut rien.

import { Oreille } from './oreille.js';
import { FluxPerceptif } from './flux.js';
import { DetecteurActivite } from './activite.js';

export class Organisme {

  constructor(fe, config) {
    this.config = config;
    this.oreille = new Oreille(fe, config.oreille);

    const capacite = Math.max(
      1,
      Math.round(config.tampon.secondes * 1000 / config.oreille.pasMs)
    );
    this.flux = new FluxPerceptif(capacite, config.oreille.nbBandes);
    this.detecteur = new DetecteurActivite(config.activite);

    // === DEBUT_FENETRE_GLISSANTE ===
    // Anneau d'echantillons de la taille exacte d'une fenetre d'analyse,
    // plus un tampon de travail contigu. Prealloues une fois pour toutes.
    this.taille = this.oreille.tailleFenetre;
    this.pas = this.oreille.pasEchantillons;
    this.anneau = new Float32Array(this.taille);
    this.travail = new Float32Array(this.taille);
    this.ecriture = 0;
    this.recus = 0;
    this.depuisAnalyse = 0;
    // === FIN_FENETRE_GLISSANTE ===

    this.bandes = new Float32Array(config.oreille.nbBandes);

    this.surTrame = null;
    this.surEvenement = null;

    // mesures de cout, volontairement legeres
    this.tramesProduites = 0;
    this.tempsCalculTotal = 0;
    this.tempsCalculFenetre = 0;
    this.tramesFenetre = 0;
    this.horloge = (typeof performance !== 'undefined' && performance.now)
      ? () => performance.now()
      : () => Date.now();
  }

  // === DEBUT_RECEPTION_ECHANTILLONS ===
  recevoirEchantillons(bloc) {
    const n = bloc.length;
    for (let i = 0; i < n; i++) {
      this.anneau[this.ecriture] = bloc[i];
      this.ecriture = this.ecriture + 1;
      if (this.ecriture === this.taille) { this.ecriture = 0; }
      this.recus = this.recus + 1;
      this.depuisAnalyse = this.depuisAnalyse + 1;

      if (this.depuisAnalyse >= this.pas && this.recus >= this.taille) {
        this.depuisAnalyse = 0;
        this.analyserMaintenant();
      }
    }
  }
  // === FIN_RECEPTION_ECHANTILLONS ===

  // === DEBUT_PRODUCTION_TRAME ===
  analyserMaintenant() {
    const t0 = this.horloge();

    // deroulage de l'anneau vers le tampon de travail contigu
    let j = this.ecriture;
    for (let i = 0; i < this.taille; i++) {
      this.travail[i] = this.anneau[j];
      j = j + 1;
      if (j === this.taille) { j = 0; }
    }

    const energie = this.oreille.analyser(this.travail, this.bandes);
    const tMs = (this.recus - this.taille / 2) * 1000 / this.oreille.fe;

    const index = this.flux.ecrire(tMs, this.bandes, energie, this.detecteur.actif);
    const evenement = this.detecteur.observer(energie, index);
    if (evenement !== null) {
      this.flux.actif[index % this.flux.capacite] = this.detecteur.actif ? 1 : 0;
    }

    const dt = this.horloge() - t0;
    this.tramesProduites = this.tramesProduites + 1;
    this.tempsCalculTotal = this.tempsCalculTotal + dt;
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
  // Moyenne glissante du temps de calcul, remise a zero a chaque lecture.
  mesurer() {
    const moyenne = this.tramesFenetre > 0
      ? this.tempsCalculFenetre / this.tramesFenetre
      : 0;
    this.tempsCalculFenetre = 0;
    this.tramesFenetre = 0;
    return {
      tramesProduites: this.tramesProduites,
      msParTrame: moyenne,
      octetsTampon: this.flux.octetsUtilises(),
      capaciteTrames: this.flux.capacite
    };
  }
  // === FIN_MESURES_COUT ===

  reinitialiser() {
    this.flux.vider();
    this.detecteur.reinitialiser();
    this.anneau.fill(0);
    this.ecriture = 0;
    this.recus = 0;
    this.depuisAnalyse = 0;
    this.tramesProduites = 0;
    this.tempsCalculTotal = 0;
  }

  description() {
    const d = this.oreille.description();
    d.capaciteTrames = this.flux.capacite;
    d.tamponSecondes = this.config.tampon.secondes;
    return d;
  }
}
// === FIN_ORGANISME ===
