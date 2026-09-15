// === DEBUT_WORKLET_CAPTURE ===
// NAISSANCE V0.2 - Support navigateur.
// Tourne dans le thread audio isole. Doit imperativement etre un fichier
// separe et un script classique (pas un module ES).
// Il n'analyse rien : il regroupe les echantillons et les transmet.

class ProcesseurCapture extends AudioWorkletProcessor {

  constructor(options) {
    super();
    const taille = (options && options.processorOptions && options.processorOptions.taille)
      ? options.processorOptions.taille
      : 256;
    this.taille = taille;
    this.tampon = new Float32Array(taille);
    this.n = 0;
    this.blocsSansEntree = 0;
  }

  process(entrees) {
    const canal = (entrees[0] && entrees[0][0]) ? entrees[0][0] : null;
    if (canal === null) {
      this.blocsSansEntree = this.blocsSansEntree + 1;
      return true;
    }
    for (let i = 0; i < canal.length; i++) {
      this.tampon[this.n] = canal[i];
      this.n = this.n + 1;
      if (this.n === this.taille) {
        const copie = this.tampon.slice(0);
        this.port.postMessage(
          { echantillons: copie, blocsSansEntree: this.blocsSansEntree },
          [copie.buffer]
        );
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-naissance', ProcesseurCapture);
// === FIN_WORKLET_CAPTURE ===
