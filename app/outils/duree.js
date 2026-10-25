// Module non cognitif : mise en forme lisible d'une durée exprimée en millisecondes.
// Pur et dormant : aucune dépendance, aucune horloge, aucun hasard, aucun réseau,
// aucun stockage. Il n'est branché nulle part dans l'application.
//
// formaterDuree(ms) :
// - ms doit être de type number, fini, positif ou nul (aucune conversion implicite) ;
// - la durée est ramenée en secondes entières par troncature vers le bas ;
// - elle est décomposée en heures (sans limite, pas d'unité jour), minutes (0 à 59)
//   et secondes (0 à 59) ;
// - seules les unités non nulles sont rendues, dans l'ordre h, min, s, séparées par
//   une espace ordinaire ; une durée inférieure à une seconde rend « 0 s ».

export function formaterDuree(ms) {
  if (typeof ms !== 'number') {
    throw new TypeError(`formaterDuree : la durée doit être un nombre de millisecondes (type reçu : ${typeof ms}).`);
  }
  if (!Number.isFinite(ms)) {
    throw new TypeError('formaterDuree : la durée doit être un nombre fini de millisecondes.');
  }
  if (ms < 0) {
    throw new RangeError('formaterDuree : la durée ne peut pas être négative.');
  }
  const total = Math.floor(ms / 1000);
  if (total === 0) return '0 s';
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondes = total % 60;
  const parties = [];
  if (heures > 0) parties.push(`${heures} h`);
  if (minutes > 0) parties.push(`${minutes} min`);
  if (secondes > 0) parties.push(`${secondes} s`);
  return parties.join(' ');
}
