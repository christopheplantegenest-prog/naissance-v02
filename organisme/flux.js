// === DEBUT_FLUX_PERCEPTIF ===
// NAISSANCE V0.2 - Le present perceptif.
//
// ATTENTION : ce tampon circulaire n'est PAS une memoire a court terme.
// C'est un dispositif technique de gestation qui conserve momentanement les
// dernieres trames pour que l'experimentateur puisse les observer. Rien n'en
// sort automatiquement, rien n'y est consolide, rien n'y est renforce.
// Sa duree est un parametre experimental (voir CONFIG.tampon.secondes) et ne
// constitue aucune hypothese sur la future memoire de la creature.
//
// Tout est prealloue une fois : aucune allocation par trame.

export class FluxPerceptif {

  constructor(capacite, nbBandes) {
    this.capacite = capacite;
    this.nbBandes = nbBandes;
    this.bandes = new Float32Array(capacite * nbBandes);
    this.energie = new Float32Array(capacite);
    this.temps = new Float64Array(capacite);
    this.actif = new Uint8Array(capacite);
    this.total = 0; // nombre total de trames ecrites depuis le debut
  }

  // === DEBUT_FLUX_ECRITURE ===
  ecrire(tMs, bandesTrame, energie, actif) {
    const pos = this.total % this.capacite;
    this.bandes.set(bandesTrame, pos * this.nbBandes);
    this.energie[pos] = energie;
    this.temps[pos] = tMs;
    this.actif[pos] = actif ? 1 : 0;
    this.total = this.total + 1;
    return this.total - 1; // index absolu de la trame ecrite
  }
  // === FIN_FLUX_ECRITURE ===

  // === DEBUT_FLUX_LECTURE ===
  disponible(indexAbsolu) {
    return indexAbsolu >= 0
      && indexAbsolu < this.total
      && indexAbsolu >= this.total - this.capacite;
  }

  // Decalage de la trame dans le tableau this.bandes (lecture sans copie)
  decalage(indexAbsolu) {
    return (indexAbsolu % this.capacite) * this.nbBandes;
  }

  energieDe(indexAbsolu) {
    return this.energie[indexAbsolu % this.capacite];
  }

  tempsDe(indexAbsolu) {
    return this.temps[indexAbsolu % this.capacite];
  }

  actifDe(indexAbsolu) {
    return this.actif[indexAbsolu % this.capacite] === 1;
  }

  // Copie des bandes d'une trame vers un tableau fourni par l'appelant.
  copierBandes(indexAbsolu, sortie) {
    const d = this.decalage(indexAbsolu);
    for (let i = 0; i < this.nbBandes; i++) {
      sortie[i] = this.bandes[d + i];
    }
    return sortie;
  }

  premierDisponible() {
    const p = this.total - this.capacite;
    return p > 0 ? p : 0;
  }

  octetsUtilises() {
    return this.bandes.byteLength + this.energie.byteLength
      + this.temps.byteLength + this.actif.byteLength;
  }
  // === FIN_FLUX_LECTURE ===

  vider() {
    this.total = 0;
  }
}
// === FIN_FLUX_PERCEPTIF ===
