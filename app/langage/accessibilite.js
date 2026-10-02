// === DEBUT_LANGAGE_ACCESSIBILITE ===
// v0.44 — DÉCISION CHATGPT « COMPARATEUR LOGIQUE GÉNÉRAL / ACCESSIBILITÉ TRANSITIVE » (02/10).
// ARCHITECTURE X retenue explicitement : une capacité SÉPARÉE du registre fermé, jamais une
// modification de confrontation.js. Raison donnée par ChatGPT, reprise ici : l'égalité canonique
// (confrontation.js) est une comparaison INTRINSÈQUE de deux valeurs, tandis que l'accessibilité
// dépend de l'ÉTAT DES CONNAISSANCES de Naissance (esprit.faits) — deux opérations de nature
// différente, qui restent séparées dans l'architecture.
//
// QUESTION GÉNÉRALE posée par ce fichier, et RIEN D'AUTRE : « en suivant uniquement UNE relation
// donnée (« operateur »), répétée autant de fois que nécessaire, A permet-il d'atteindre B ? ».
// Le rôle « operateur » reste ENTIÈREMENT LIBRE — ce fichier ne connaît, ne code et ne suppose
// AUCUNE liste de relations particulières (ni « plus-grand-que », ni « avant », ni « parent-de »,
// ni aucune autre) : n'importe quelle relation déjà enseignée comme un fait ordinaire peut servir
// d'« operateur ». Le mécanisme d'accessibilité est codé ; la relation et sa signification restent
// entièrement des CONNAISSANCES APPRISES (de simples faits, voir apprendreFait()/esprit.js),
// jamais ce fichier — exactement le principe central demandé par ce chantier.
//
// ISOLÉ, DÉLIBÉRÉMENT, de resoudreChemin() (esprit.js) : ce dernier enchaîne une liste FINIE et
// EXPLICITE de relations DISTINCTES fournie par l'appelant, sans détection de cycle (inutile pour
// cet usage : la liste est finie et chaque relation n'y figure qu'une fois en pratique) — une
// architecture différente de celle nécessaire ici, où la MÊME relation est répétée un nombre NON
// BORNÉ de fois, avec un risque réel de cycle (voir les tests dédiés). Généraliser/refactorer
// resoudreChemin() pour ajouter une détection de cycle à un mécanisme central déjà éprouvé et
// chargé de garanties documentées, pour épargner quelques lignes dupliquées, a été jugé un risque
// disproportionné (décision ChatGPT explicite). Ce module lit esprit.faits directement, exactement
// comme selection.js (même précédent, même discipline : aucune écriture, aucun appel à
// esprit.magasin, une résolution ponctuelle jamais un fait dérivé permanent).
//
// INCONNU ≠ FAUX, respecté explicitement (décision ChatGPT, « ne jamais transformer l'absence de
// chemin en négation certaine si l'état des connaissances ne permet pas cette conclusion ») :
//   - la relation donnée (« operateur ») n'apparaît NULLE PART dans esprit.faits (pour QUI que ce
//     soit) : le concept même n'a jamais été enseigné → abstention (INCONNU), jamais INACCESSIBLE,
//     qui laisserait croire à une conclusion établie sur une relation dont rien n'est connu.
//   - la relation EST par ailleurs connue, mais sujetA n'a lui-même AUCUN fait sortant pour elle
//     (aucune chaîne ne peut même commencer) : abstention également (INCONNU) — même principe que
//     confrontation.js (absence de fait pour l'identité interrogée), on ne peut rien conclure sur
//     la position de A faute du moindre point de départ.
//   - un conflit de faits rencontré PENDANT l'exploration (esprit.conflitsFaits) abstient
//     immédiatement (INCONNU), jamais un choix arbitraire parmi des valeurs en conflit — même
//     principe que resoudreChemin()/confrontation.js.
//   - A et B canoniquement identiques sans qu'aucun hop réel ne le confirme : JAMAIS traité comme
//     ACCESSIBLE par simple réflexivité — seul un chemin RÉELLEMENT suivi (au moins un hop) compte
//     comme preuve, pour ne jamais inventer une conclusion qu'aucune connaissance n'a établie.
//   - si, et seulement si, au moins une chaîne part réellement de A et que l'exploration EXHAUSTIVE
//     (tous les faits actuellement connus pour cette relation, cycles inclus — jamais de boucle
//     infinie, un ensemble de sujets déjà visités l'empêche) n'atteint jamais B : conclusion
//     POSITIVE et confiante, INACCESSIBLE — même légitimité que sujetsAvec() (selection.js), dont
//     l'énumération complète d'un « aucun résultat » est déjà traitée comme une réponse à part
//     entière, jamais une incompréhension.
import { cleFait } from './connaissances.js';
import { canoniser } from './canon.js';

export const ACCESSIBLE = 'accessible';
export const INACCESSIBLE = 'inaccessible';
export const INCONNU = 'inconnu';

// Le concept même d'« operateur » a-t-il déjà été enseigné, pour QUI que ce soit ? Une simple
// énumération de esprit.faits (même primitive que tousLesFaits()/selection.js), jamais une
// structure dédiée : ce fichier ne maintient aucun index propre, pour rester aussi pauvre que
// possible et ne jamais dupliquer la source de vérité (esprit.faits).
function relationDejaEnseignee(esprit, relationCanon) {
  for (const f of esprit.faits.values()) {
    if (canoniser(f.relation) === relationCanon) return true;
  }
  return false;
}

export function estAccessible(esprit, { sujetA, operateur, sujetB }) {
  const relationCanon = canoniser(operateur);
  const cibleCanon = canoniser(sujetB);

  if (!relationDejaEnseignee(esprit, relationCanon)) return { etat: INCONNU };

  const departCanon = canoniser(sujetA);
  const idDepart = cleFait(departCanon, relationCanon);
  if (esprit.conflitsFaits && esprit.conflitsFaits.has(idDepart)) return { etat: INCONNU };
  const faitDepart = esprit.faits.get(idDepart);
  if (!faitDepart) return { etat: INCONNU };

  // Parcours en largeur, un seul passage par sujet (visites), donc toujours terminé même si la
  // relation enseignée referme un cycle (A → B → A) : jamais de boucle infinie.
  const visites = new Set([departCanon]);
  let frontiere = [faitDepart.valeur];
  while (frontiere.length) {
    const suivante = [];
    for (const candidat of frontiere) {
      const candidatCanon = canoniser(candidat);
      if (candidatCanon === cibleCanon) return { etat: ACCESSIBLE };
      if (visites.has(candidatCanon)) continue;
      visites.add(candidatCanon);
      const id = cleFait(candidatCanon, relationCanon);
      if (esprit.conflitsFaits && esprit.conflitsFaits.has(id)) return { etat: INCONNU };
      const fait = esprit.faits.get(id);
      if (fait) suivante.push(fait.valeur);
    }
    frontiere = suivante;
  }
  return { etat: INACCESSIBLE };
}
// === FIN_LANGAGE_ACCESSIBILITE ===
