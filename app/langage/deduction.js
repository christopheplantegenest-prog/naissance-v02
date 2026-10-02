// === DEBUT_LANGAGE_DEDUCTION ===
// v0.42 — DÉCISION CHATGPT « DÉDUCTION DÉTERMINISTE MULTI-FAITS » (02/10).
//
// QUESTION CENTRALE POSÉE PAR CE CHANTIER : Naissance possède-t-elle déjà des connaissances qui
// décrivent QUAND plusieurs faits autorisent une nouvelle conclusion, mais manque seulement du
// mécanisme permettant de les appliquer ? RÉPONSE, après observation (regles.js, esprit.js) : OUI.
//
// appliquerRegles() (regles.js, présent depuis le tout début du prototype, v0.10) répond déjà,
// exactement et sans aucun changement nécessaire, à « plusieurs connaissances établies autorisent-
// elles une conclusion ? » : une RÈGLE est une DONNÉE enseignée explicitement (rôle, conditions,
// résultat — jamais une ressemblance probabiliste, jamais un critère arbitraire), et
// appliquerRegles() sait déjà : combiner PLUSIEURS conditions (toutes doivent être vraies, voir
// conditionsSatisfaites()) ; préférer la règle la plus spécifique (plusSpecifiques()) ; s'ABSTENIR
// explicitement, jamais un choix arbitraire, quand plusieurs règles de même spécificité se
// contredisent (conflit:true). Vérifié par un diagnostic direct avant d'écrire une seule ligne ici :
// un sujet qui ne satisfait pas une condition ne déclenche jamais la règle (jamais devinée), deux
// conditions sont bien exigées ensemble quand une règle en a deux, et deux règles contradictoires de
// même spécificité produisent bien un conflit explicite — réutilisé SANS AUCUNE modification.
//
// CE QUI MANQUAIT, et SEULEMENT CELA : appliquerRegles() n'avait jusqu'ici jamais reçu que les
// propriétés MORPHOLOGIQUES D'UN MOT (esprit.proprietes, pour remplir un gabarit dynamique — voir
// remplirGabarit(), esprit.js) comme `proprietesDuMot`. Jamais les FAITS d'un SUJET (esprit.faits).
// proprietesDe() (selection.js, v0.41) donne déjà, pour n'importe quel sujet, exactement la FORME
// attendue par appliquerRegles() (propriete → valeur) — proprietesDuSujet() ci-dessous n'est qu'une
// transformation de forme (tableau → Map), rien de plus. AUCUN changement à regles.js ni à
// esprit.js : même discipline que confrontation.js/selection.js (modules isolés, qui réutilisent
// strictement une primitive existante plutôt que de la réécrire).
//
// N'écrit JAMAIS rien en mémoire (aucun appel à esprit.magasin) : une déduction ponctuelle, jamais
// un fait dérivé permanent — même principe que resoudreChemin()/confronter()/proprietesCommunes().
//
// HORS PÉRIMÈTRE, explicitement (comme pour B2/B3 et le chantier précédent, signalé plutôt que
// bricolé) : une condition qui porterait sur les propriétés d'un AUTRE sujet atteint par une
// relation (« A possède R vers B, et B possède P » — exemple conceptuel du cadrage ChatGPT) n'est
// pas couverte ici — cela demanderait de décider COMBIEN de sauts suivre et avec quelle garantie de
// terminaison, une vraie question architecturale distincte de celle posée par ce chantier (voir le
// rapport). Ce qui est couvert : plusieurs conditions, établies par plusieurs FAITS DISTINCTS d'un
// MÊME sujet, combinées par une règle enseignée.
import { appliquerRegles } from './regles.js';
import { proprietesDe } from './selection.js';

function proprietesDuSujet(esprit, sujet) {
  return new Map(proprietesDe(esprit, sujet).map((p) => [p.relation, p.valeur]));
}

// Déduit, pour UN sujet et UN rôle de règle donnés, ce que les règles déjà enseignées en concluent à
// partir des FAITS RÉELLEMENT connus de ce sujet. Retour EXACTEMENT celui d'appliquerRegles() :
//   { resultat, regle }                          — une conclusion, sans ambiguïté.
//   { resultat: null }                           — aucune règle applicable (faits insuffisants ou
//                                                   non conformes) : à dire honnêtement, jamais deviné.
//   { resultat: null, conflit: true, candidats }  — plusieurs règles de même spécificité se
//                                                   contredisent : abstention explicite.
export function deduire(esprit, { sujet, role }) {
  return appliquerRegles(esprit.regles, { role, proprietesDuMot: proprietesDuSujet(esprit, sujet) });
}
// === FIN_LANGAGE_DEDUCTION ===
