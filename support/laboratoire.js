// === DEBUT_LABORATOIRE ===
// NAISSANCE V0.2 - Instruments de laboratoire.
//
// CE FICHIER N'APPARTIENT PAS A L'ORGANISME.
// Il est place dans /support/ volontairement : ce qui est calcule ici est
// destine a l'humain qui observe, jamais a la creature.
//
// Le taux de changement mesure la distance entre deux trames consecutives.
// Il ne sert JAMAIS a : decider qu'un son commence ou se termine, segmenter
// le flux, creer une categorie, creer un souvenir, decider que deux
// perceptions sont identiques ou differentes, declencher un apprentissage.
// Aucun module de /organisme/ n'importe ce fichier.

// === DEBUT_TAUX_DE_CHANGEMENT ===
export function tauxDeChangement(flux, indexA, indexB) {
  if (!flux.disponible(indexA) || !flux.disponible(indexB)) { return 0; }
  const da = flux.decalage(indexA);
  const db = flux.decalage(indexB);
  let somme = 0;
  for (let i = 0; i < flux.nbBandes; i++) {
    const d = flux.bandes[db + i] - flux.bandes[da + i];
    somme = somme + d * d;
  }
  return Math.sqrt(somme);
}
// === FIN_TAUX_DE_CHANGEMENT ===

// === DEBUT_CAPTURES_OBSERVATION ===
// Copie des trames d'un evenement, pour affichage et export.
// Ces captures ne sont lues par aucun mecanisme de l'organisme.
export class Captures {

  constructor(cfgObservation) {
    this.cfg = cfgObservation;
    this.liste = [];
    this.numero = 0;
  }

  ajouter(flux, debut, fin, pasMs) {
    let d = debut;
    if (d < flux.premierDisponible()) { d = flux.premierDisponible(); }
    let nb = fin - d;
    if (nb <= 0) { return null; }
    if (nb > this.cfg.tramesMaxParCapture) { nb = this.cfg.tramesMaxParCapture; }

    const donnees = new Float32Array(nb * flux.nbBandes);
    const energies = new Float32Array(nb);
    for (let i = 0; i < nb; i++) {
      const idx = d + i;
      if (!flux.disponible(idx)) { continue; }
      const dec = flux.decalage(idx);
      donnees.set(flux.bandes.subarray(dec, dec + flux.nbBandes), i * flux.nbBandes);
      energies[i] = flux.energieDe(idx);
    }

    this.numero = this.numero + 1;
    const capture = {
      numero: this.numero,
      nbTrames: nb,
      nbBandes: flux.nbBandes,
      dureeMs: nb * pasMs,
      bandes: donnees,
      energies: energies
    };
    this.liste.push(capture);
    while (this.liste.length > this.cfg.maxCaptures) {
      this.liste.shift();
    }
    return capture;
  }

  vider() {
    this.liste = [];
    this.numero = 0;
  }

  // Export neutre : les trames brutes, sans aucune interpretation.
  exporter(description) {
    return {
      version: 'naissance-v0.2',
      oreille: description,
      captures: this.liste.map((c) => ({
        numero: c.numero,
        nbTrames: c.nbTrames,
        nbBandes: c.nbBandes,
        dureeMs: c.dureeMs,
        energies: Array.from(c.energies, (v) => Number(v.toFixed(5))),
        trames: Array.from({ length: c.nbTrames }, (_, i) =>
          Array.from(
            c.bandes.subarray(i * c.nbBandes, (i + 1) * c.nbBandes),
            (v) => Number(v.toFixed(3))
          )
        )
      }))
    };
  }
}
// === FIN_CAPTURES_OBSERVATION ===
// === FIN_LABORATOIRE ===
