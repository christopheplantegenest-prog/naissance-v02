// === DEBUT_SPECTROGRAMME ===
// NAISSANCE V0.2 - Instrument d'observation (support navigateur).
// Rendu du flux perceptif. N'interprete rien : il montre des nombres.
// Le rendu est plafonne en images par seconde et reste independant de la
// cadence perceptive.

// === DEBUT_PALETTE ===
// Encre sur papier, comme un releve de sonographe.
const PAPIER = [233, 234, 228];
const MEDIAN = [86, 118, 114];
const ENCRE = [21, 27, 26];

function couleur(u, sortie) {
  if (u < 0) { u = 0; }
  if (u > 1) { u = 1; }
  if (u < 0.55) {
    const k = u / 0.55;
    sortie[0] = PAPIER[0] + (MEDIAN[0] - PAPIER[0]) * k;
    sortie[1] = PAPIER[1] + (MEDIAN[1] - PAPIER[1]) * k;
    sortie[2] = PAPIER[2] + (MEDIAN[2] - PAPIER[2]) * k;
  } else {
    const k = (u - 0.55) / 0.45;
    sortie[0] = MEDIAN[0] + (ENCRE[0] - MEDIAN[0]) * k;
    sortie[1] = MEDIAN[1] + (ENCRE[1] - MEDIAN[1]) * k;
    sortie[2] = MEDIAN[2] + (ENCRE[2] - MEDIAN[2]) * k;
  }
}
// === FIN_PALETTE ===

// === DEBUT_RENDU_BLOC ===
// Dessine un ensemble de trames contigues dans un canvas hors ecran.
// bandes : Float32Array de nbTrames * nbBandes
export function rendreTrames(canvas, bandes, nbTrames, nbBandes, min, max) {
  canvas.width = Math.max(1, nbTrames);
  canvas.height = nbBandes;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, nbBandes);
  const d = image.data;
  const c = [0, 0, 0];
  const etendue = (max - min) > 0.0001 ? (max - min) : 1;

  for (let x = 0; x < nbTrames; x++) {
    for (let b = 0; b < nbBandes; b++) {
      couleur((bandes[x * nbBandes + b] - min) / etendue, c);
      const y = nbBandes - 1 - b;
      const p = (y * canvas.width + x) * 4;
      d[p] = c[0];
      d[p + 1] = c[1];
      d[p + 2] = c[2];
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
// === FIN_RENDU_BLOC ===

// === DEBUT_SPECTROGRAMME_DEFILANT ===
export class SpectrogrammeDefilant {

  constructor(canvasVisible, capacite, nbBandes) {
    this.visible = canvasVisible;
    this.ctx = canvasVisible.getContext('2d');
    this.capacite = capacite;
    this.nbBandes = nbBandes;

    this.horsEcran = document.createElement('canvas');
    this.horsEcran.width = capacite;
    this.horsEcran.height = nbBandes;
    this.ctxHorsEcran = this.horsEcran.getContext('2d');
    this.ctxHorsEcran.fillStyle = 'rgb(' + PAPIER[0] + ',' + PAPIER[1] + ',' + PAPIER[2] + ')';
    this.ctxHorsEcran.fillRect(0, 0, capacite, nbBandes);

    this.colonne = this.ctxHorsEcran.createImageData(1, nbBandes);
    this.derniereColonne = 0;
    this.min = 0;
    this.max = 12;
  }

  contraste(min, max) {
    this.min = min;
    this.max = max;
  }

  // Une colonne par trame. Appelee 100 fois par seconde : aucune allocation.
  ecrireColonne(bandes, indexAbsolu) {
    const x = indexAbsolu % this.capacite;
    const d = this.colonne.data;
    const c = [0, 0, 0];
    const etendue = (this.max - this.min) > 0.0001 ? (this.max - this.min) : 1;
    for (let b = 0; b < this.nbBandes; b++) {
      couleur((bandes[b] - this.min) / etendue, c);
      const y = this.nbBandes - 1 - b;
      const p = y * 4;
      d[p] = c[0];
      d[p + 1] = c[1];
      d[p + 2] = c[2];
      d[p + 3] = 255;
    }
    this.ctxHorsEcran.putImageData(this.colonne, x, 0);
    this.derniereColonne = x;
  }

  // Deux blits pour derouler l'anneau : le plus ancien a gauche.
  dessiner() {
    const L = this.visible.width;
    const H = this.visible.height;
    const coupe = (this.derniereColonne + 1) % this.capacite;
    const largeurDroite = this.capacite - coupe;
    const ratio = L / this.capacite;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.horsEcran, coupe, 0, largeurDroite, this.nbBandes,
      0, 0, largeurDroite * ratio, H
    );
    if (coupe > 0) {
      this.ctx.drawImage(
        this.horsEcran, 0, 0, coupe, this.nbBandes,
        largeurDroite * ratio, 0, coupe * ratio, H
      );
    }
  }

  effacer() {
    this.ctxHorsEcran.fillStyle = 'rgb(' + PAPIER[0] + ',' + PAPIER[1] + ',' + PAPIER[2] + ')';
    this.ctxHorsEcran.fillRect(0, 0, this.capacite, this.nbBandes);
    this.ctx.clearRect(0, 0, this.visible.width, this.visible.height);
  }
}
// === FIN_SPECTROGRAMME_DEFILANT ===

// === DEBUT_TRACE_TAUX ===
// Trace du taux de changement. Instrument destine a l'humain uniquement.
export function dessinerTaux(canvas, valeurs, capacite, dernier, maximum) {
  const ctx = canvas.getContext('2d');
  const L = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, L, H);
  ctx.strokeStyle = '#15564E';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const coupe = (dernier + 1) % capacite;
  const echelle = maximum > 0.0001 ? maximum : 1;
  for (let i = 0; i < capacite; i++) {
    const idx = (coupe + i) % capacite;
    const x = i * L / capacite;
    let v = valeurs[idx] / echelle;
    if (v > 1) { v = 1; }
    const y = H - v * H;
    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
  }
  ctx.stroke();
}
// === FIN_TRACE_TAUX ===
// === FIN_SPECTROGRAMME ===
