// === DEBUT_REECHANTILLONNEUR ===
// NAISSANCE V0.3 - Oreille externe.
//
// CE MODULE APPARTIENT A L'ORGANISME, PAS AU SUPPORT.
// Il definit ce que la creature entend reellement : il doit donc migrer
// avec elle, a l'identique, vers n'importe quel support futur.
//
// Role : convertir le flux audio de la frequence NATIVE de l'appareil vers
// la frequence SENSORIELLE INTERNE FIXE de l'organisme. Sans lui, un
// changement de telephone ou de navigateur modifierait silencieusement les
// proprietes temporelles et frequentielles de sa perception.
//
// Methode : sinus cardinal fenetre par une fenetre de Kaiser, a rapport
// quelconque, avec table de phases precalculee. Aucune dependance externe.
//
// Dimensionnement du filtre anti-repliement (demontre, non postule) :
//   apres decimation vers fs, la sortie a la frequence f0 recoit l'entree
//   aux frequences f0 + k*fs et k*fs - f0. Pour f0 dans la bande utile
//   [0, fMax] et k = 1, la seule contribution existante est
//   f = fs - f0, soit l'intervalle [fs - fMax, fs/2_entree].
//   La bande a supprimer est donc exactement [fs - fMax, feEntree/2].
//   L'intervalle [fMax, fs - fMax] se replie au-dessus de fMax : aucune
//   bande du banc ne le lit, une attenuation partielle y est sans effet.

// === DEBUT_FENETRE_KAISER ===
function bessel0(x) {
  let somme = 1;
  let terme = 1;
  for (let k = 1; k < 40; k++) {
    const r = x / (2 * k);
    terme = terme * r * r;
    somme = somme + terme;
    if (terme < 1e-14 * somme) { break; }
  }
  return somme;
}

function sinc(x) {
  if (Math.abs(x) < 1e-9) { return 1; }
  const p = Math.PI * x;
  return Math.sin(p) / p;
}
// === FIN_FENETRE_KAISER ===

export class Reechantillonneur {

  // feEntree : frequence native de l'appareil
  // feSortie : frequence sensorielle interne de l'organisme
  // cfg      : { fMaxHz, attenuationDb, phases, tailleBlocMax }
  constructor(feEntree, feSortie, cfg) {
    this.feEntree = feEntree;
    this.feSortie = feSortie;
    this.actif = (feEntree !== feSortie);

    this.fMax = cfg.fMaxHz;
    this.attenuationDb = cfg.attenuationDb;
    this.phases = cfg.phases;

    // --- dimensionnement
    this.bordPassante = cfg.fMaxHz;
    this.bordCoupee = feSortie - cfg.fMaxHz;
    this.transitionHz = this.bordCoupee - this.bordPassante;
    this.coupureHz = (this.bordPassante + this.bordCoupee) / 2; // = feSortie / 2

    this.sortie = new Float32Array(cfg.tailleBlocMax * 4 + 64);

    if (!this.actif) {
      this.N = 0;
      this.M = 0;
      this.retardMs = 0;
      this.pasEntree = 1;
      return;
    }

    // === DEBUT_DIMENSIONNEMENT_FILTRE ===
    const A = this.attenuationDb;
    const domega = 2 * Math.PI * this.transitionHz / feEntree;
    let N = Math.ceil((A - 8) / (2.285 * domega));
    if (N < 9) { N = 9; }
    if (N % 2 === 0) { N = N + 1; }
    this.N = N;
    this.M = (N - 1) / 2;

    let beta;
    if (A > 50) { beta = 0.1102 * (A - 8.7); }
    else if (A >= 21) { beta = 0.5842 * Math.pow(A - 21, 0.4) + 0.07886 * (A - 21); }
    else { beta = 0; }
    this.beta = beta;
    // === FIN_DIMENSIONNEMENT_FILTRE ===

    // === DEBUT_TABLE_DE_PHASES ===
    // Une rangee de N coefficients par phase fractionnaire. La phase est
    // quantifiee sur cfg.phases valeurs : l'erreur de datation vaut au pire
    // un demi-pas de phase, soit une fraction negligeable d'echantillon.
    const fcn = this.coupureHz / feEntree; // coupure normalisee a l'entree
    const i0beta = bessel0(beta);
    this.table = new Float32Array(this.phases * N);
    for (let p = 0; p < this.phases; p++) {
      const frac = p / this.phases;
      let somme = 0;
      for (let j = 0; j < N; j++) {
        const t = (j - this.M) - frac;
        let r = t / (this.M + 1);
        if (r > 1) { r = 1; }
        if (r < -1) { r = -1; }
        const fen = bessel0(beta * Math.sqrt(1 - r * r)) / i0beta;
        const h = 2 * fcn * sinc(2 * fcn * t) * fen;
        this.table[p * N + j] = h;
        somme = somme + h;
      }
      // normalisation a gain unite en continu, phase par phase
      if (somme !== 0) {
        for (let j = 0; j < N; j++) { this.table[p * N + j] = this.table[p * N + j] / somme; }
      }
    }
    // === FIN_TABLE_DE_PHASES ===

    this.pasEntree = feEntree / feSortie; // avance en echantillons d'entree
    this.reserve = new Float32Array(N + cfg.tailleBlocMax + 8);
    this.nReserve = 0;
    this.position = this.M; // premiere sortie alignee sur l'echantillon M
    this.retardMs = 1000 * this.M / feEntree;
  }

  // === DEBUT_TRAITEMENT ===
  // Retourne une vue (sous-tableau) des echantillons produits a feSortie.
  // La vue est reutilisee a chaque appel : la consommer immediatement.
  traiter(bloc) {
    if (!this.actif) { return bloc; }

    const n = bloc.length;
    if (this.nReserve + n > this.reserve.length) {
      // securite : ne devrait pas arriver, tailleBlocMax est dimensionne
      this.nReserve = 0;
      this.position = this.M;
    }
    this.reserve.set(bloc, this.nReserve);
    this.nReserve = this.nReserve + n;

    let nSortie = 0;
    const N = this.N;
    const M = this.M;
    while (true) {
      const n0 = Math.floor(this.position);
      if (n0 + M >= this.nReserve) { break; }
      if (n0 - M < 0) { this.position = this.position + this.pasEntree; continue; }
      const frac = this.position - n0;
      let p = Math.round(frac * this.phases);
      if (p >= this.phases) { p = this.phases - 1; }
      const base = p * N;
      const debut = n0 - M;
      let acc = 0;
      for (let j = 0; j < N; j++) {
        acc = acc + this.table[base + j] * this.reserve[debut + j];
      }
      this.sortie[nSortie] = acc;
      nSortie = nSortie + 1;
      this.position = this.position + this.pasEntree;
    }

    // on ne conserve que ce qui reste necessaire
    const jeter = Math.floor(this.position) - M;
    if (jeter > 0) {
      this.reserve.copyWithin(0, jeter, this.nReserve);
      this.nReserve = this.nReserve - jeter;
      this.position = this.position - jeter;
    }

    return this.sortie.subarray(0, nSortie);
  }
  // === FIN_TRAITEMENT ===

  description() {
    return {
      actif: this.actif,
      feEntree: this.feEntree,
      feSortie: this.feSortie,
      coefficients: this.N,
      bordPassante: this.bordPassante,
      bordCoupee: this.bordCoupee,
      transitionHz: this.transitionHz,
      coupureHz: this.coupureHz,
      attenuationDb: this.attenuationDb,
      beta: this.beta,
      phases: this.phases,
      retardMs: this.retardMs,
      multiplicationsParSeconde: this.actif ? this.feSortie * this.N : 0
    };
  }
}
// === FIN_REECHANTILLONNEUR ===
