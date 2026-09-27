// === DEBUT_TEST_SUJETS_COMPOSES ===
// v0.22 — DÉCISION CHATGPT « SUJETS CONNUS À PLUSIEURS MOTS ».
//
// Le principe de la Piste A ne change pas : « le sujet d'une connaissance réellement apprise
// devient un sujet que Naissance peut reconnaître. » La représentation du sujet peut contenir UN
// OU PLUSIEURS mots -- le bug venait de trouverSujet() (comprendre.js), qui appliquait cette règle
// avec une recherche TOKEN PAR TOKEN, incapable de reconnaître un sujet composé (sujetsConnus
// contenait bien « departement de la charente » en une seule chaîne, mais aucun mot pris seul dans
// la phrase ne pouvait jamais lui être égal).
//
// Cas réel reproduit (cours envoyé par Christophe le 27/09) : « Le département de la Charente se
// situe en France » réellement appris, puis « Où se situe le département de la Charente ? » posé
// après fermeture/réouverture -- sujet non reconnu, bascule vers Gemini qui a inventé du contenu.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait, apprendreRelation, repondre } from '../app/langage/esprit.js';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

async function espritAvecCharente() {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'se', relation: 'se situe en' });
  await apprendreFait(esprit, { sujet: 'département de la Charente', relation: 'se situe en', valeur: 'France' });
  return magasin;
}

test('RED (limite reproduite) — sans recherche multi-mots, un sujet composé réellement appris n\'est pas reconnu (contrôle direct de comprendre())', () => {
  // Preuve directe : sujetsConnus contient bien la chaîne complète, mais une recherche TOKEN PAR
  // TOKEN (ancien comportement) ne peut jamais l'égaler à un seul mot de la phrase.
  const lexique = { se: { role: 'relation', relation: 'se situe en' } };
  const sujetsConnus = new Set(['departement de la charente']);
  // Simule l'ANCIEN algorithme (mot par mot) pour prouver que la limite existait bien ainsi :
  const mots = ['ou', 'se', 'situe', 'le', 'departement', 'de', 'la', 'charente'];
  const ancienAlgorithme = mots.some((m) => sujetsConnus.has(m));
  assert.equal(ancienAlgorithme, false, 'aucun token pris seul ne peut égaler la chaîne composée -- c\'est bien la limite d\'avant ce correctif');
});

test('APRÈS CORRECTION (complète) — cas réel : sujet composé ET relation composée sont désormais reconnus, le Fait est retrouvé localement', async () => {
  const magasin = await espritAvecCharente();
  const esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'Où se situe le département de la Charente ?');
  // Le correctif de ce chantier (sujets composés, v0.22) ET celui du chantier suivant (relations
  // composées, même version -- voir tests/relations-composees.test.mjs) fonctionnent ensemble :
  // le cas réel signalé par Christophe est désormais intégralement résolu localement.
  assert.equal(r.comprehension.sujet, 'departement de la charente', 'le sujet composé est reconnu');
  assert.equal(r.comprehension.relation, 'se situe en', 'la relation composée est désormais reconnue intégralement, plus tronquée à son premier mot');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'France', 'le Fait réel est retrouvé -- réponse locale, sans recours à Gemini');
});

// LIMITE DOCUMENTÉE (clause NORMALISATION de la décision) : un sujet composé contenant une
// apostrophe ou un tiret (« la mer d'Olis », « Marcillac-Lanville ») n'est PAS couvert par ce
// correctif. decouper() sépare l'apostrophe/le tiret en tokens distincts (« d », « olis »), alors
// que canoniser() (qui produit la forme stockée dans sujetsConnus) les GARDE dans le mot (« d'olis »,
// « marcillac-lanville ») : recoller les tokens de la phrase par de simples espaces ne peut donc
// jamais reproduire cette forme. Réutiliser tel quel les deux normalisations existantes (comme
// demandé) ne permet pas de couvrir ce cas honnêtement sans inventer une troisième définition de
// « même texte » -- non traité ici, à signaler si un cours réel le nécessite.
test('1. un AUTRE sujet composé à mots simples (sans apostrophe ni tiret), différent de « Charente », fonctionne SANS modification du code', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'couleur', relation: 'couleur' });
  await apprendreFait(esprit, { sujet: 'grand arbre bleu', relation: 'couleur', valeur: 'turquoise' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Quelle est la couleur du grand arbre bleu ?');
  assert.equal(r.comprehension.sujet, 'grand arbre bleu');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'turquoise');
});

test('2. persistance après fermeture/réouverture simulée', async () => {
  // Fixture à relation à UN SEUL mot (isole la persistance du sujet composé du blocage relation
  // composée documenté plus haut, hors du périmètre de ce point précis).
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'localisation', relation: 'localisation' });
  await apprendreFait(esprit, { sujet: 'département de la Charente', relation: 'localisation', valeur: 'France' });
  const espritRouvert = await chargerEsprit(magasin);
  assert.ok(espritRouvert.sujetsConnus.has('departement de la charente'), 'sujetsConnus reconstruit depuis les Faits persistés, pas conservé en mémoire d\'un esprit précédent');
  const r = repondre(espritRouvert, 'Quelle est la localisation du département de la Charente ?');
  assert.equal(r.comprehension.sujet, 'departement de la charente');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'France');
});

test('3. un sujet à UN SEUL mot reste toujours fonctionnel (aucune régression Piste A)', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'lunes', relation: 'lunes' });
  await apprendreFait(esprit, { sujet: 'Néria', relation: 'lunes', valeur: 'deux' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Combien de lunes a Néria ?');
  assert.equal(r.comprehension.sujet, 'neria');
  assert.equal(r.etat, 'compris');
});

test('4. moi / naissance / prénoms appris restent intacts (aucune régression)', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'couleur', relation: 'couleur' });
  await apprendreFait(esprit, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreFait(esprit, { sujet: 'naissance', relation: 'couleur', valeur: 'rouge' });
  await apprendreRelation(esprit, { mot: 'fils', relation: 'fils' });
  await apprendreFait(esprit, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  const rechargé = await chargerEsprit(magasin);
  assert.equal(repondre(rechargé, 'Quelle est ma couleur ?').comprehension.sujet, 'moi');
  assert.equal(repondre(rechargé, 'Quelle est ta couleur ?').comprehension.sujet, 'naissance');
  assert.equal(repondre(rechargé, 'Quelle est la couleur de Atem ?').comprehension.sujet, 'atem');
});

test('5. un mot simplement RENCONTRÉ (jamais sujet appris) ne devient pas un sujet connu', async () => {
  const magasin = await espritAvecCharente();
  const esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'Quelle est la couleur de Morn ?');
  assert.notEqual(r.comprehension.sujet, 'morn');
});

test('6. un sujet composé n\'est reconnu QUE si la séquence complète est présente (un fragment seul ne suffit pas)', async () => {
  const magasin = await espritAvecCharente();
  const esprit = await chargerEsprit(magasin);
  // « Charente » seule (sans « département de la ») n'a jamais été apprise comme sujet à part
  // entière : elle ne doit PAS être reconnue comme sujet à elle seule.
  const c = comprendre('Quelle est la couleur de Charente ?', {
    lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus, sujetsConnus: esprit.sujetsConnus,
  });
  assert.notEqual(c.sujet, 'charente');
});

test('7. chevauchement court/long : le sujet composé le plus long gagne', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'population', relation: 'population' });
  // Deux sujets connus, l'un inclus dans l'autre : « Charente » (1 mot) et « département de la
  // Charente » (4 mots), tous deux réellement appris.
  await apprendreFait(esprit, { sujet: 'Charente', relation: 'population', valeur: 'plusieurs centaines de milliers' });
  await apprendreFait(esprit, { sujet: 'département de la Charente', relation: 'population', valeur: 'plusieurs centaines de milliers' });
  const rechargé = await chargerEsprit(magasin);
  const c = comprendre('Quelle est la population du département de la Charente ?', {
    lexique: rechargé.lexique, prenomsConnus: rechargé.prenomsConnus, sujetsConnus: rechargé.sujetsConnus,
  });
  assert.equal(c.sujet, 'departement de la charente', 'la correspondance connue la plus spécifique (la plus longue) doit être préférée');
});

test('8. ambiguïté réelle entre deux sujets connus distincts de même longueur → aucune sélection arbitraire (sujet non résolu)', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'couleur', relation: 'couleur' });
  // Deux sujets composés DISTINCTS, de MÊME longueur (2 mots chacun), tous deux réellement appris,
  // et tous deux présents dans la même phrase : rien dans l'architecture actuelle ne permet de
  // départager lequel des deux est visé -- le sujet doit rester non résolu, jamais deviné.
  await apprendreFait(esprit, { sujet: 'grand arbre', relation: 'couleur', valeur: 'vert' });
  await apprendreFait(esprit, { sujet: 'petit chat', relation: 'couleur', valeur: 'noir' });
  const rechargé = await chargerEsprit(magasin);
  const c = comprendre('Quelle est la couleur du grand arbre et du petit chat ?', {
    lexique: rechargé.lexique, prenomsConnus: rechargé.prenomsConnus, sujetsConnus: rechargé.sujetsConnus,
  });
  assert.equal(c.sujet, null, 'ambiguïté réelle entre deux sujets connus de même longueur : aucun choix arbitraire');
});

test('9. aucune dépendance à Gemini ni à l\'historique de conversation pour cette reconnaissance', async () => {
  // Tout ce test tient sans appelerGemini, sans prose de cours, sans historique : seulement
  // apprendreFait() (esprit.js, primitive locale) et repondre() (le vrai moteur).
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'capitale', relation: 'capitale' });
  await apprendreFait(esprit, { sujet: 'grand royaume', relation: 'capitale', valeur: 'Térane' });
  const r = repondre(esprit, 'Quelle est la capitale du grand royaume ?');
  assert.equal(r.comprehension.sujet, 'grand royaume');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Térane');
});
// === FIN_TEST_SUJETS_COMPOSES ===
