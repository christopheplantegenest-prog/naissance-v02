// === DEBUT_ORGANE_AUDITIF ===
// NAISSANCE V0.2 - L'oreille.
// Transforme une fenetre d'echantillons en une trame perceptive :
//   64 energies logarithmiques sur une echelle ERB, plus l'energie globale.
// Elle ne compare rien, ne retient rien, ne conclut rien. Elle transmet.
//
// Aucune dependance au navigateur : ce module est du JavaScript pur.

// === DEBUT_ECHELLE_ERB ===
// Echelle ERB (Glasberg & Moore). Propriete de l'organe, pas connaissance
// du monde : elle decrit la largeur des filtres cochleaires.
function hzVersErb(f) {
  return 21.4 * Math.log10(1 + 0.00437 * f);
}
function erbVersHz(e) {
  return (Math.pow(10, e / 21.4) - 1) / 0.00437;
}
// === FIN_ECHELLE_ERB ===

export class Oreille {

  constructor(fe, cfgOreille) {
    this.fe = fe;
    this.cfg = cfgOreille;

    this.tailleFenetre = Math.max(16, Math.round(fe * cfgOreille.fenetreMs / 1000));
    this.pasEchantillons = Math.max(1, Math.round(fe * cfgOreille.pasMs / 1000));

    let n = 1;
    while (n < this.tailleFenetre) { n = n * 2; }
    this.nFFT = n;

    this.nbBandes = cfgOreille.nbBandes;
    this.gainLog = cfgOreille.gainLog;

    // --- fenetre de Hann, preallouee
    this.fenetre = new Float32Array(this.tailleFenetre);
    for (let i = 0; i < this.tailleFenetre; i++) {
      this.fenetre[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.tailleFenetre - 1));
    }

    // === DEBUT_TABLES_FFT ===
    this.re = new Float64Array(this.nFFT);
    this.im = new Float64Array(this.nFFT);
    this.puissance = new Float64Array(this.nFFT / 2 + 1);

    this.inverse = new Int32Array(this.nFFT);
    let bits = 0;
    while ((1 << bits) < this.nFFT) { bits++; }
    for (let i = 0; i < this.nFFT; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) {
        if (i & (1 << b)) { r = r | (1 << (bits - 1 - b)); }
      }
      this.inverse[i] = r;
    }

    const demi = this.nFFT / 2;
    this.cosTable = new Float64Array(demi);
    this.sinTable = new Float64Array(demi);
    for (let k = 0; k < demi; k++) {
      const a = -2 * Math.PI * k / this.nFFT;
      this.cosTable[k] = Math.cos(a);
      this.sinTable[k] = Math.sin(a);
    }
    // === FIN_TABLES_FFT ===

    // === DEBUT_BANC_DE_FILTRES ===
    const fMax = Math.min(cfgOreille.fMaxHz, cfgOreille.ratioNyquist * fe);
    const fMin = Math.min(cfgOreille.fMinHz, fMax / 2);
    const erbMin = hzVersErb(fMin);
    const erbMax = hzVersErb(fMax);

    // nbBandes + 2 bornes : chaque bande est un triangle borne-centre-borne
    this.bornesHz = new Float64Array(this.nbBandes + 2);
    for (let i = 0; i < this.nbBandes + 2; i++) {
      const e = erbMin + (erbMax - erbMin) * i / (this.nbBandes + 1);
      this.bornesHz[i] = erbVersHz(e);
    }

    this.binDebut = new Int32Array(this.nbBandes);
    this.binFin = new Int32Array(this.nbBandes);
    this.poids = new Array(this.nbBandes);

    const binMax = this.nFFT / 2;
    const parHz = this.nFFT / fe;

    for (let b = 0; b < this.nbBandes; b++) {
      const gauche = this.bornesHz[b];
      const centre = this.bornesHz[b + 1];
      const droite = this.bornesHz[b + 2];

      let k0 = Math.ceil(gauche * parHz);
      let k1 = Math.floor(droite * parHz);
      if (k0 < 1) { k0 = 1; }
      if (k1 > binMax) { k1 = binMax; }

      if (k1 < k0) {
        // bande plus etroite qu'un bin : on prend le bin le plus proche
        let kc = Math.round(centre * parHz);
        if (kc < 1) { kc = 1; }
        if (kc > binMax) { kc = binMax; }
        k0 = kc;
        k1 = kc;
      }

      const p = new Float64Array(k1 - k0 + 1);
      let somme = 0;
      for (let k = k0; k <= k1; k++) {
        const hz = k / parHz;
        let v;
        if (hz <= centre) {
          v = (centre > gauche) ? (hz - gauche) / (centre - gauche) : 1;
        } else {
          v = (droite > centre) ? (droite - hz) / (droite - centre) : 1;
        }
        if (v < 0) { v = 0; }
        p[k - k0] = v;
        somme = somme + v;
      }
      if (somme > 0) {
        for (let i = 0; i < p.length; i++) { p[i] = p[i] / somme; }
      } else {
        p[0] = 1;
      }
      this.binDebut[b] = k0;
      this.binFin[b] = k1;
      this.poids[b] = p;
    }
    // === FIN_BANC_DE_FILTRES ===
  }

  // === DEBUT_ANALYSE_TRAME ===
  // echantillons : Float32Array de longueur tailleFenetre
  // sortieBandes : Float32Array de longueur nbBandes, remplie sur place
  // retourne l'energie globale (RMS) de la fenetre, non transformee
  analyser(echantillons, sortieBandes) {
    const N = this.nFFT;
    const L = this.tailleFenetre;
    const re = this.re;
    const im = this.im;

    let sommeCarres = 0;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < L; i++) {
      const x = echantillons[i];
      sommeCarres = sommeCarres + x * x;
      re[this.inverse[i]] = x * this.fenetre[i];
    }
    // les echantillons au dela de L restent a zero (completion par des zeros)

    // --- FFT iterative, entrees deja rangees en ordre binaire inverse
    for (let taille = 2; taille <= N; taille = taille * 2) {
      const demiTaille = taille / 2;
      const pas = N / taille;
      for (let debut = 0; debut < N; debut = debut + taille) {
        let indiceTable = 0;
        for (let k = 0; k < demiTaille; k++) {
          const wr = this.cosTable[indiceTable];
          const wi = this.sinTable[indiceTable];
          indiceTable = indiceTable + pas;
          const i1 = debut + k;
          const i2 = i1 + demiTaille;
          const pr = re[i2];
          const pi = im[i2];
          const vr = pr * wr - pi * wi;
          const vi = pr * wi + pi * wr;
          const ur = re[i1];
          const ui = im[i1];
          re[i1] = ur + vr;
          im[i1] = ui + vi;
          re[i2] = ur - vr;
          im[i2] = ui - vi;
        }
      }
    }

    const puissance = this.puissance;
    for (let k = 0; k <= N / 2; k++) {
      puissance[k] = re[k] * re[k] + im[k] * im[k];
    }

    for (let b = 0; b < this.nbBandes; b++) {
      const p = this.poids[b];
      const k0 = this.binDebut[b];
      let e = 0;
      for (let i = 0; i < p.length; i++) {
        e = e + p[i] * puissance[k0 + i];
      }
      sortieBandes[b] = Math.log(1 + e * this.gainLog);
    }

    return Math.sqrt(sommeCarres / L);
  }
  // === FIN_ANALYSE_TRAME ===

  // Description de l'oreille, pour l'affichage et les exports.
  description() {
    return {
      fe: this.fe,
      nFFT: this.nFFT,
      tailleFenetre: this.tailleFenetre,
      pasEchantillons: this.pasEchantillons,
      nbBandes: this.nbBandes,
      bornesHz: Array.from(this.bornesHz),
      resolutionHz: this.fe / this.nFFT
    };
  }
}
// === FIN_ORGANE_AUDITIF ===
