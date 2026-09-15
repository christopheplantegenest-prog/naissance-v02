// === DEBUT_LABORATOIRE ===
// NAISSANCE V0.3 - Instruments de laboratoire.
//
// CE FICHIER N'APPARTIENT PAS A L'ORGANISME.
// Il est place dans /support/ volontairement : ce qui est calcule ici est
// destine a l'humain qui observe, jamais a la creature.
//
// Rien de ce qui suit ne sert a : decider qu'un son commence ou se termine,
// segmenter le flux, creer une categorie, creer un souvenir, decider que
// deux perceptions sont identiques ou differentes, declencher un
// apprentissage. Aucun module de /organisme/ n'importe ce fichier.

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

// === DEBUT_AGITATION_PAR_GROUPE ===
// Instrument ajoute pour le test D : mesurer l'instabilite propre a chaque
// groupe de fenetres, et notamment au groupe le plus court (2,67 ms).
// Definition : moyenne, sur les dernieres trames, de l'ecart absolu moyen
// entre deux trames consecutives, calculee separement pour les bandes de
// chaque groupe. Purement descriptif ; aucun parametre n'en depend.
export class Agitation {

  constructor(groupes, indexTailleParBande, nbBandes, profondeur) {
    this.groupes = groupes;
    this.index = indexTailleParBande;
    this.nbBandes = nbBandes;
    this.profondeur = profondeur;
    this.sommes = new Float64Array(groupes.length);
    this.comptes = new Float64Array(groupes.length);
    this.precedente = new Float32Array(nbBandes);
    this.aPrecedente = false;
    this.n = 0;
    this.valeurs = new Float64Array(groupes.length);
  }

  observer(bandes) {
    if (this.aPrecedente) {
      const s = this.sommes;
      const c = this.comptes;
      for (let b = 0; b < this.nbBandes; b++) {
        const g = this.index[b];
        s[g] = s[g] + Math.abs(bandes[b] - this.precedente[b]);
        c[g] = c[g] + 1;
      }
      this.n = this.n + 1;
      if (this.n >= this.profondeur) {
        for (let g = 0; g < this.groupes.length; g++) {
          this.valeurs[g] = c[g] > 0 ? s[g] / c[g] : 0;
          s[g] = 0;
          c[g] = 0;
        }
        this.n = 0;
      }
    }
    this.precedente.set(bandes);
    this.aPrecedente = true;
  }

  lire() {
    return Array.from(this.valeurs);
  }
}
// === FIN_AGITATION_PAR_GROUPE ===

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
    while (this.liste.length > this.cfg.maxCaptures) { this.liste.shift(); }
    return capture;
  }

  vider() {
    this.liste = [];
    this.numero = 0;
  }

  // Export neutre : les trames brutes, sans aucune interpretation, et la
  // description complete de l'organe qui les a produites.
  exporter(description) {
    return {
      version: 'naissance-v0.3',
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
