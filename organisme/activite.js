// === DEBUT_DETECTION_ACTIVITE ===
// NAISSANCE V0.2 - Detection d'activite acoustique.
//
// Ce module distingue le repos de l'activite a partir de la seule energie
// globale. Il sert UNIQUEMENT a baliser le flux pour l'observation :
//   - il ne cree aucun souvenir ;
//   - il ne categorise rien ;
//   - il ne decide d'aucune ressemblance ;
//   - il n'interrompt jamais la perception, qui reste continue.
// Le flux perceptif est produit en permanence, actif ou non.
//
// Differences assumees avec V0.1 :
//   - le plancher de bruit continue de s'adapter, tres lentement, pendant
//     l'activite (en V0.1 il etait gele, ce qui pouvait bloquer un evenement) ;
//   - il n'existe plus aucune coupure dure : un son long reste un son long.

export class DetecteurActivite {

  constructor(cfg) {
    this.cfg = cfg;
    this.plancher = cfg.plancherInitial;
    this.actif = false;
    this.tramesActives = 0;
    this.tramesSilence = 0;
    this.debutIndex = -1;
  }

  // === DEBUT_ACTIVITE_OBSERVER ===
  // energie : RMS de la trame courante
  // index   : index absolu de la trame dans le flux
  // retourne null, { type: 'debut' } ou { type: 'fin', debut, fin, trames }
  observer(energie, index) {
    const c = this.cfg;

    const lissage = this.actif ? c.lissageActivite : c.lissageRepos;
    let p = this.plancher * (1 - lissage) + energie * lissage;
    if (p < c.plancherMin) { p = c.plancherMin; }
    this.plancher = p;

    const seuilHaut = this.plancher * c.facteurHaut + c.offsetHaut;
    const seuilBas = this.plancher * c.facteurBas + c.offsetBas;

    if (!this.actif) {
      if (energie > seuilHaut) {
        this.actif = true;
        this.tramesActives = 1;
        this.tramesSilence = 0;
        this.debutIndex = index;
        return { type: 'debut', debut: index };
      }
      return null;
    }

    this.tramesActives = this.tramesActives + 1;
    if (energie < seuilBas) {
      this.tramesSilence = this.tramesSilence + 1;
    } else {
      this.tramesSilence = 0;
    }

    if (this.tramesSilence >= c.tramesSilenceFin) {
      this.actif = false;
      const debut = this.debutIndex;
      const fin = index - this.tramesSilence;
      const utiles = fin - debut;
      this.debutIndex = -1;
      if (utiles < c.tramesMinActivite) {
        return { type: 'abandon', debut: debut, fin: fin, trames: utiles };
      }
      return { type: 'fin', debut: debut, fin: fin, trames: utiles };
    }
    return null;
  }
  // === FIN_ACTIVITE_OBSERVER ===

  seuils() {
    return {
      plancher: this.plancher,
      haut: this.plancher * this.cfg.facteurHaut + this.cfg.offsetHaut,
      bas: this.plancher * this.cfg.facteurBas + this.cfg.offsetBas
    };
  }

  reinitialiser() {
    this.plancher = this.cfg.plancherInitial;
    this.actif = false;
    this.tramesActives = 0;
    this.tramesSilence = 0;
    this.debutIndex = -1;
  }
}
// === FIN_DETECTION_ACTIVITE ===
