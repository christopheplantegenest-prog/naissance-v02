// === DEBUT_LANGAGE_COUVERTURE_OCCURRENCES ===
// v0.63.6 — ÉTAPE 6 : « COUVERTURE PURE D'OCCURRENCES » (décision ChatGPT, 04/10/2026, suite au diagnostic « QUELLE EST L'UNITÉ
// MINIMALE FAIT -> COUVERTURE ? »). PRIMITIVE PURE, GÉNÉRALE, DORMANTE. Elle répond à UNE seule question :
//
//   « ce tableau de chemins est-il une couverture valide, et deux couvertures désignent-elles le même ensemble ? »
//
// Elle ne connaît RIEN : ni la raison pour laquelle des occurrences vont ensemble, ni le générateur qui les a regroupées, ni la
// structure parcourue, ni l'univers dont elles viennent, ni Naissance. Elle ne choisit rien, ne classe rien, ne combine rien.
//
// COUVERTURE : un ensemble fini de chemins typés appartenant conceptuellement à UN même univers de parcours (la sortie d'un
// parcours de structure). Représentation : un tableau de chemins. Un chemin est un tableau dont chaque segment est une
// chaîne OU un entier >= 0 ; le chemin vide est valide, la couverture vide aussi. Rien n'est transformé : 0 reste un nombre,
// "0" reste une chaîne. Un chemin n'est JAMAIS encodé en chaîne : aucune jonction, aucune sérialisation, aucune clé texte.
//
// ÉGALITÉ DE CHEMINS : même longueur ET, à chaque position, segments égaux par identité primitive. Donc [0] != ["0"],
// [] != [""], ["a/b"] != ["a","b"], ["a,b"] != ["a","b"].
//
// DOUBLON = TypeError. Deux chemins égaux dans une même couverture la rendent invalide : dans l'univers d'un parcours deux
// occurrences n'ont jamais le même chemin, un doublon signale donc une entrée incorrecte. Il n'est ni conservé, ni compté, ni
// supprimé en silence.
//
// normaliserCouverture(chemins) : valide strictement, rejette les doublons, rend un NOUVEAU tableau de NOUVEAUX chemins (aucune
// référence partagée avec l'entrée, que ni son ordre ni son contenu ne changent), dans un ordre déterministe qui ne dépend pas de
// l'ordre d'entrée. ORDRE DE REPRÉSENTATION (convention, sans aucune signification) : comparaison lexicographique des chemins ;
// entre deux segments différents, les nombres précèdent les chaînes, les nombres se comparent numériquement, les chaînes par
// unités de code ; si tous les segments communs sont égaux, le chemin le plus court précède.
//
// memesCouvertures(a, b) : vrai si et seulement si a et b représentent exactement le même ensemble de chemins. Les deux sont
// validées comme normaliserCouverture (TypeError si l'une est invalide ou contient un doublon). L'ordre d'entrée est sans effet.
//
// UNIVERS : une couverture n'est comparable sémantiquement qu'à une autre couverture du MÊME univers. Ce module ne reçoit pas
// l'univers et ne peut pas vérifier cette condition ; comparer deux couvertures de deux univers différents est hors contrat.
// La validité structurelle d'une couverture et son appartenance à un univers sont deux questions différentes.
//
// NON FOURNI VOLONTAIREMENT (dérivable, ou appartenant à une étape ultérieure) : toute description de ce qui rassemble les
// occurrences, tout générateur, toute combinaison de couvertures, tout identifiant.
//
// INDÉPENDANCE : ce fichier n'importe RIEN. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique).

function estSegment(segment) {
  return typeof segment === 'string' || (typeof segment === 'number' && Number.isInteger(segment) && segment >= 0);
}

function ordreSegments(a, b) {
  const aNombre = typeof a === 'number';
  const bNombre = typeof b === 'number';
  if (aNombre !== bNombre) return aNombre ? -1 : 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function ordreChemins(a, b) {
  const commun = Math.min(a.length, b.length);
  for (let i = 0; i < commun; i += 1) {
    const ordre = ordreSegments(a[i], b[i]);
    if (ordre !== 0) return ordre;
  }
  return a.length - b.length;
}

function copierChemin(chemin, nom, rang) {
  if (!Array.isArray(chemin)) throw new TypeError(`${nom}[${rang}] doit être un chemin (tableau de segments).`);
  const copie = [];
  for (let i = 0; i < chemin.length; i += 1) {
    const segment = chemin[i];
    if (!estSegment(segment)) throw new TypeError(`${nom}[${rang}][${i}] doit être une chaîne ou un entier >= 0.`);
    copie.push(segment);
  }
  return copie;
}

function normaliser(chemins, nom) {
  if (!Array.isArray(chemins)) throw new TypeError(`${nom} doit être un tableau de chemins.`);
  const lignes = [];
  for (let rang = 0; rang < chemins.length; rang += 1) lignes.push({ chemin: copierChemin(chemins[rang], nom, rang), rang });
  lignes.sort((x, y) => ordreChemins(x.chemin, y.chemin));
  for (let i = 1; i < lignes.length; i += 1) {
    if (ordreChemins(lignes[i - 1].chemin, lignes[i].chemin) === 0) {
      throw new TypeError(`${nom} contient deux chemins égaux (rangs ${lignes[i - 1].rang} et ${lignes[i].rang}) : un doublon est refusé.`);
    }
  }
  return lignes.map((ligne) => ligne.chemin);
}

export function normaliserCouverture(chemins) {
  return normaliser(chemins, 'couverture');
}

export function memesCouvertures(a, b) {
  const gauche = normaliser(a, 'couverture a');
  const droite = normaliser(b, 'couverture b');
  if (gauche.length !== droite.length) return false;
  for (let i = 0; i < gauche.length; i += 1) {
    if (ordreChemins(gauche[i], droite[i]) !== 0) return false;
  }
  return true;
}
// === FIN_LANGAGE_COUVERTURE_OCCURRENCES ===
