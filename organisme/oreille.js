// === DEBUT_ORGANE_AUDITIF ===
// NAISSANCE V0.3 - L'oreille multi-resolution.
//
// Transforme un instant du signal, observe simultanement a plusieurs
// echelles de temps, en une trame perceptive : 46 energies logarithmiques
// sur une echelle ERB, de 80 a 10500 Hz.
//
// Principe : la cochlee n'impose pas le meme compromis temps/frequence a
// toutes les hauteurs. Ses filtres graves sont lents et fins, ses filtres
// aigus rapides et larges. Chaque bande recoit donc ici la PLUS COURTE
// fenetre d'observation dont la resolution (1 / duree) suffit a la separer
// de sa voisine. L'affectation est calculee au demarrage.
//
// Elle ne compare rien, ne retient rien, ne conclut rien.
// Aucune dependance au navigateur : JavaScript pur.

// === DEBUT_ECHELLE_ERB ===
// Echelle ERB (Glasberg & Moore). Propriete de l'organe, pas connaissance
// du monde : elle decrit la largeur des filtres cochleaires.
function hzVersErb(f) { return 21.4 * Math.log10(1 + 0.00437 * f); }
function erbVersHz(e) { return (Math.pow(10, e / 21.4) - 1) / 0.00437; }
// === FIN_ECHELLE_ERB ===

// === DEBUT_ANALYSEUR_FFT ===
// Une FFT reelle pour une taille donnee. Toutes les tables sont
// precalculees ; l'analyse n'alloue rien.
class AnalyseurFFT {

  constructor(taille, fe) {
    this.taille = taille;
    this.fe = fe;
    this.dureeMs = 1000 * taille / fe;
    this.resolutionHz = fe / taille;

    this.fenetre = new Float32Array(taille);
    for (let i = 0; i < taille; i++) {
      this.fenetre[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (taille - 1));
    }

    this.re = new Float64Array(taille);
    this.im = new Float64Array(taille);
    this.puissance = new Float64Array(taille / 2 + 1);

    let bits = 0;
    while ((1 << bits) < taille) { bits++; }
    this.inverse = new Int32Array(taille);
    for (let i = 0; i < taille; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) {
        if (i & (1 << b)) { r = r | (1 << (bits - 1 - b)); }
      }
      this.inverse[i] = r;
    }

    const demi = taille / 2;
    this.cosTable = new Float64Array(demi);
    this.sinTable = new Float64Array(demi);
    for (let k = 0; k < demi; k++) {
      const a = -2 * Math.PI * k / taille;
      this.cosTable[k] = Math.cos(a);
      this.sinTable[k] = Math.sin(a);
    }
  }

  // Remplit this.puissance a partir d'echantillons. N'ALTERE PAS l'entree.
  calculer(echantillons) {
    const N = this.taille;
    const re = this.re;
    const im = this.im;
    im.fill(0);
    for (let i = 0; i < N; i++) {
      re[this.inverse[i]] = echantillons[i] * this.fenetre[i];
    }
    for (let taille = 2; taille <= N; taille = taille * 2) {
      const demi = taille / 2;
      const pas = N / taille;
      for (let debut = 0; debut < N; debut = debut + taille) {
        let it = 0;
        for (let k = 0; k < demi; k++) {
          const wr = this.cosTable[it];
          const wi = this.sinTable[it];
          it = it + pas;
          const i1 = debut + k;
          const i2 = i1 + demi;
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
    const p = this.puissance;
    for (let k = 0; k <= N / 2; k++) {
      p[k] = re[k] * re[k] + im[k] * im[k];
    }
  }
}
// === FIN_ANALYSEUR_FFT ===

export class Oreille {

  constructor(fe, cfg) {
    this.fe = fe;
    this.cfg = cfg;
    this.nbBandes = cfg.nbBandes;
    this.gainLog = cfg.gainLog;
    this.pasEchantillons = Math.max(1, Math.round(fe * cfg.pasMs / 1000));

    // === DEBUT_BANC_DE_FILTRES ===
    const fMax = Math.min(cfg.fMaxHz, 0.48 * fe);
    const fMin = cfg.fMinHz;
    const erbMin = hzVersErb(fMin);
    const erbMax = hzVersErb(fMax);
    this.pasErb = (erbMax - erbMin) / (this.nbBandes + 1);

    this.bornesHz = new Float64Array(this.nbBandes + 2);
    for (let i = 0; i < this.nbBandes + 2; i++) {
      this.bornesHz[i] = erbVersHz(erbMin + this.pasErb * i);
    }
    // === FIN_BANC_DE_FILTRES ===

    // === DEBUT_AFFECTATION_DES_FENETRES ===
    // Critere : la resolution reelle (1 / duree) doit etre au moins aussi
    // fine que l'ecart entre le centre de la bande et celui de sa voisine.
    // On retient la plus courte fenetre qui satisfait ce critere.
    const candidates = cfg.fenetresCandidates
      .slice()
      .sort((a, b) => a - b)
      .map((n) => ({ n: n, ms: 1000 * n / fe }));

    this.tailleParBande = new Int32Array(this.nbBandes);
    this.dureeRequiseMs = new Float64Array(this.nbBandes);
    for (let b = 0; b < this.nbBandes; b++) {
      const ecart = this.bornesHz[b + 1] - this.bornesHz[b];
      const requise = 1000 / ecart;
      this.dureeRequiseMs[b] = requise;
      let choisie = candidates[candidates.length - 1];
      for (const c of candidates) {
        if (c.ms >= requise) { choisie = c; break; }
      }
      this.tailleParBande[b] = choisie.n;
    }

    // tailles effectivement utilisees, de la plus longue a la plus courte
    const utilisees = [];
    for (let b = 0; b < this.nbBandes; b++) {
      if (utilisees.indexOf(this.tailleParBande[b]) < 0) {
        utilisees.push(this.tailleParBande[b]);
      }
    }
    utilisees.sort((a, b) => b - a);
    this.tailles = utilisees;
    this.analyseurs = utilisees.map((n) => new AnalyseurFFT(n, fe));
    this.indexTaille = new Int32Array(this.nbBandes);
    for (let b = 0; b < this.nbBandes; b++) {
      this.indexTaille[b] = utilisees.indexOf(this.tailleParBande[b]);
    }
    // === FIN_AFFECTATION_DES_FENETRES ===

    // === DEBUT_POIDS_DES_BANDES ===
    // Triangles bornes-centre-bornes, normalises en aire, calcules sur la
    // grille de bins propre a la fenetre de chaque bande.
    this.binDebut = new Int32Array(this.nbBandes);
    this.binFin = new Int32Array(this.nbBandes);
    this.poids = new Array(this.nbBandes);

    for (let b = 0; b < this.nbBandes; b++) {
      const taille = this.tailleParBande[b];
      const parHz = taille / fe;
      const binMax = taille / 2;
      const gauche = this.bornesHz[b];
      const centre = this.bornesHz[b + 1];
      const droite = this.bornesHz[b + 2];

      let k0 = Math.ceil(gauche * parHz);
      let k1 = Math.floor(droite * parHz);
      if (k0 < 1) { k0 = 1; }
      if (k1 > binMax) { k1 = binMax; }
      if (k1 < k0) {
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
    // === FIN_POIDS_DES_BANDES ===
  }

  // === DEBUT_ANALYSE_TRAME ===
  // fenetres : tableau parallele a this.tailles, chaque case contenant les
  //            echantillons de la fenetre correspondante, CENTREE SUR LE
  //            MEME INSTANT que toutes les autres.
  // sortie   : Float32Array de nbBandes, remplie sur place.
  analyser(fenetres, sortie) {
    for (let i = 0; i < this.analyseurs.length; i++) {
      this.analyseurs[i].calculer(fenetres[i]);
    }
    for (let b = 0; b < this.nbBandes; b++) {
      const puissance = this.analyseurs[this.indexTaille[b]].puissance;
      const p = this.poids[b];
      const k0 = this.binDebut[b];
      let e = 0;
      for (let i = 0; i < p.length; i++) {
        e = e + p[i] * puissance[k0 + i];
      }
      sortie[b] = Math.log(1 + e * this.gainLog);
    }
  }
  // === FIN_ANALYSE_TRAME ===

  // === DEBUT_DESCRIPTION_OREILLE ===
  description() {
    const groupes = this.tailles.map((n, i) => {
      const bandes = [];
      for (let b = 0; b < this.nbBandes; b++) {
        if (this.indexTaille[b] === i) { bandes.push(b); }
      }
      return {
        taille: n,
        dureeMs: 1000 * n / this.fe,
        resolutionHz: this.fe / n,
        nbBandes: bandes.length,
        premiere: bandes[0],
        derniere: bandes[bandes.length - 1],
        centreBasHz: this.bornesHz[bandes[0] + 1],
        centreHautHz: this.bornesHz[bandes[bandes.length - 1] + 1]
      };
    });

    const bandes = [];
    let minBins = 1e9;
    for (let b = 0; b < this.nbBandes; b++) {
      const nb = this.binFin[b] - this.binDebut[b] + 1;
      if (nb < minBins) { minBins = nb; }
      bandes.push({
        b: b,
        basHz: this.bornesHz[b],
        centreHz: this.bornesHz[b + 1],
        hautHz: this.bornesHz[b + 2],
        largeurHz: this.bornesHz[b + 2] - this.bornesHz[b],
        tailleFenetre: this.tailleParBande[b],
        dureeMs: 1000 * this.tailleParBande[b] / this.fe,
        resolutionHz: this.fe / this.tailleParBande[b],
        dureeRequiseMs: this.dureeRequiseMs[b],
        binDebut: this.binDebut[b],
        binFin: this.binFin[b],
        nbBins: nb
      });
    }

    // controle d'auto-verification : deux bandes ne doivent jamais lire
    // exactement les memes bins de la meme fenetre
    let doublons = 0;
    for (let b = 1; b < this.nbBandes; b++) {
      if (this.tailleParBande[b] === this.tailleParBande[b - 1]
        && this.binDebut[b] === this.binDebut[b - 1]
        && this.binFin[b] === this.binFin[b - 1]) { doublons++; }
    }

    return {
      fe: this.fe,
      nbBandes: this.nbBandes,
      fMinHz: this.bornesHz[0],
      fMaxHz: this.bornesHz[this.nbBandes + 1],
      pasErb: this.pasErb,
      pasMs: this.cfg.pasMs,
      pasEchantillons: this.pasEchantillons,
      tailles: this.tailles.slice(),
      groupes: groupes,
      bandes: bandes,
      minBins: minBins,
      doublons: doublons,
      zeroPadding: false
    };
  }
  // === FIN_DESCRIPTION_OREILLE ===
}
// === FIN_ORGANE_AUDITIF ===
