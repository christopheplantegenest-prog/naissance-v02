// Chantier « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026) -- fonctions PURES et
// ISOLÉES de app/langage/transformation.js. Aucune notion grammaticale ici : la négation ne sert que
// de banc d'essai, jamais du code spécifique au sujet/verbe/négation.
// ÉLARGI le 27/09/2026 (décision ChatGPT « DIAGNOSTIC v0.26.0, TRANSFORMATION REFUSÉE ») : le
// mécanisme n'induisait que des INSERTIONS (entrée = sous-séquence stricte de la sortie). Nouvel
// alignement par PLUS LONGUE SOUS-SÉQUENCE COMMUNE (LCS, algorithme structurel générique, aucune
// notion de grammaire) : chaque jeton d'entrée est désormais soit GARDÉ (recopié), soit SUPPRIMÉ ;
// un REMPLACEMENT s'obtient sans troisième mécanisme (suppression + insertion au même endroit).
// Rétrocompatible : une transformation persistée SANS le champ « garder » (apprise avant ce jour)
// reste interprétée comme « tout gardé », comportement inchangé. Le RÉORDONNANCEMENT véritable reste
// hors de portée (LCS respecte l'ordre relatif) -- limite distincte, non traitée ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  tokeniser, reassembler, alignerExemple, induireTransformation, appliquerTransformation, fusionnerTransformations,
  correspondSquelette, calculerAncres,
} from '../app/langage/transformation.js';

// ============================================================================ SURFACE
test('tokeniser conserve casse/accents et isole la ponctuation', () => {
  assert.deepEqual(tokeniser('Le chat dort.'), ['Le', 'chat', 'dort', '.']);
  assert.deepEqual(tokeniser("Aujourd'hui, ça va ?"), ["Aujourd'hui", ',', 'ça', 'va', '?']);
});

test('reassembler recolle sans espace avant la ponctuation finale', () => {
  assert.equal(reassembler(['Le', 'chat', 'ne', 'dort', 'pas', '.']), 'Le chat ne dort pas.');
});

// ============================================================================ ALIGNEMENT D'UN EXEMPLE
test('alignerExemple trouve les insertions quand l\'entrée est une sous-séquence de la sortie (rien à garder=false)', () => {
  const r = alignerExemple(['Je', 'mange'], ['Je', 'ne', 'mange', 'pas']);
  assert.ok(r);
  assert.deepEqual(r.insertions, [[], ['ne'], ['pas']]);
  assert.deepEqual(r.garder, [true, true]);
});

test('alignerExemple (LCS) supprime un jeton d\'entrée absent de la sortie, au lieu d\'échouer', () => {
  // « Je » n'apparaît nulle part dans la sortie : ce jeton est SUPPRIMÉ (garder=false), le reste
  // de la sortie devient une insertion -- un alignement structurel, jamais un devinage grammatical.
  const r = alignerExemple(['Je', 'mange'], ['Il', 'ne', 'mange', 'pas']);
  assert.ok(r);
  assert.deepEqual(r.garder, [false, true]);
  assert.deepEqual(r.insertions, [[], ['Il', 'ne'], ['pas']]);
});

// ============================================================================ INDUCTION
test('un seul exemple ne suffit jamais à généraliser (abstention)', () => {
  const r = induireTransformation([{ entree: 'Je mange', sortie: 'Je ne mange pas' }]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'insuffisant');
});

test('deux exemples cohérents induisent une transformation générale (négation, banc d\'essai)', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation, {
    n: 2, insertions: [[], ['ne'], ['pas']], garder: [true, true], interne: [null, null], certaine: true,
  });
});

test('application à une entrée réellement nouvelle, jamais vue dans les exemples', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const sortie = appliquerTransformation(r.transformation, 'Je cours');
  assert.equal(sortie, 'Je ne cours pas');
});

test('exemples contradictoires à la même position → abstention (conflit), jamais un choix arbitraire', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors jamais' }, // "pas" vs "jamais" à la même position
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'conflit');
});

test('arités différentes entre exemples → abstention explicite (pas de généralisation forcée)', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Le chat dort', sortie: 'Le chat ne dort pas' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'longueurs_incompatibles');
});

test('deux exemples radicalement incompatibles (l\'un garde tout, l\'autre supprime tout) → conflit, jamais devinée', () => {
  // Avant l'extension LCS, ce cas était rejeté avec 'non_alignable' (impossible d'aligner le second
  // exemple comme une pure sous-séquence). Depuis l'extension SUPPRESSION/REMPLACEMENT, le second
  // exemple s'aligne désormais structurellement (tout supprimé, tout remplacé) -- mais il CONTREDIT
  // le premier exemple à la position 0 (gardé vs supprimé) : abstention toujours garantie, avec une
  // raison plus précise.
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'complètement autre chose' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'conflit');
});

test('entrée === sortie partout → aucune transformation à apprendre', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je mange' },
    { entree: 'Je dors', sortie: 'Je dors' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aucune_transformation');
});

// ============================================================================ SUPPRESSION (v0.27)
test('SUPPRESSION — un jeton présent dans TOUS les exemples en entrée mais absent en sortie est appris comme supprimé', () => {
  const r = induireTransformation([
    { entree: 'a b c', sortie: 'a c' },
    { entree: 'x b y', sortie: 'x y' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.garder, [true, false, true]);
  assert.equal(appliquerTransformation(r.transformation, 'p b q'), 'p q');
});

// ============================================================================ REMPLACEMENT (v0.27, suppression + insertion au même endroit -- aucun 3e mécanisme)
test('REMPLACEMENT — un mot substitué par un autre mot littéral, sur une famille sans rapport avec le français', () => {
  const r = induireTransformation([
    { entree: 'alpha beta', sortie: 'alpha ZETA' },
    { entree: 'gamma beta', sortie: 'gamma ZETA' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.garder, [true, false]);
  assert.equal(appliquerTransformation(r.transformation, 'delta beta'), 'delta ZETA');
});

test('REMPLACEMENT — cas français réel (singulier → pluriel), deux substitutions dans la même transformation', () => {
  // Mis à jour au LOT 2 (v0.28, décision ChatGPT « GRAND DIAGNOSTIC ») : au moment où ce test a été
  // écrit (v0.27.0), "chat"→"chats" et "chien"→"chiens" n'étaient PAS le même remplacement littéral et
  // provoquaient un conflit -- c'était précisément la limite diagnostiquée (Cause 1, transformation
  // interne à une variable) que le Lot 2 devait lever. Depuis, un suffixe interne cohérent ("s") est
  // détecté entre les deux exemples : ce n'est plus une abstention, c'est le cas de validation même du
  // Lot 2 (chat/chien → renard dans le banc d'essai demandé).
  const r = induireTransformation([
    { entree: 'un chat', sortie: 'des chats' },
    { entree: 'un chien', sortie: 'des chiens' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(appliquerTransformation(r.transformation, 'un renard'), 'des renards');
});

// ============================================================================ RÉTROCOMPATIBILITÉ (v0.26 → v0.27)
test('une transformation persistée SANS champ garder (apprise avant ce jour) s\'applique comme avant (tout gardé)', () => {
  const ancienne = { n: 2, insertions: [[], ['ne'], ['pas']] }; // forme exacte des transformations v0.26 déjà sur le téléphone
  assert.equal(appliquerTransformation(ancienne, 'Je cours'), 'Je ne cours pas');
});

test('fusionnerTransformations compose une transformation ancienne (sans garder) avec une nouvelle (avec garder)', () => {
  const ancienne = { n: 2, insertions: [[], ['ne'], ['pas']] };
  const nouvelle = { n: 2, insertions: [['Enfin', ','], [], []], garder: [true, true] };
  const fusion = fusionnerTransformations([ancienne, nouvelle]);
  assert.equal(fusion.ok, true);
  assert.equal(appliquerTransformation(fusion.transformation, 'Je cours'), 'Enfin, Je ne cours pas');
});

// ============================================================================ LOT 1 (v0.28, décision ChatGPT « GRAND DIAGNOSTIC ») : ANTI-SUR-GÉNÉRALISATION
// Piège découvert au grand diagnostic du 27/09/2026 : quand un jeton supprimé est identique à un
// jeton réinséré ailleurs dans TOUS les exemples fournis, rien ne permet de distinguer un vrai
// littéral invariant (« ne »/« pas ») d'une VARIABLE qui n'a simplement pas encore varié dans
// l'échantillon. La transformation induite porte alors `certaine:false` -- apprise mais jamais
// appliquée telle quelle (appliquerTransformation renvoie null), tant qu'aucun exemple ne lève le doute.
test('LOT1 -- un jeton supprimé puis réinséré identique dans tous les exemples est marqué NON CERTAIN', () => {
  const r = induireTransformation([
    { entree: 'tu chantes', sortie: 'chantes tu ?' },
    { entree: 'tu arrives', sortie: 'arrives tu ?' },
  ]);
  assert.equal(r.ok, true); // toujours APPRISE (ne pas empêcher l'apprentissage)
  assert.equal(r.transformation.certaine, false);
  // MAIS jamais appliquée telle quelle -- le piège exact du diagnostic (elle chante => chante tu ?)
  // ne doit plus jamais se produire silencieusement.
  assert.equal(appliquerTransformation(r.transformation, 'elle chante'), null);
});

test('LOT1 -- même piège avec une famille ARTIFICIELLE sans rapport avec le français', () => {
  const r = induireTransformation([
    { entree: 'Q foo', sortie: 'foo Q !' },
    { entree: 'Q bar', sortie: 'bar Q !' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.transformation.certaine, false);
  assert.equal(appliquerTransformation(r.transformation, 'Q baz'), null);
});

test('LOT1 -- REVALIDATION : la négation (banc d\'essai déjà validé) reste CERTAINE (rien à confondre, aucun jeton supprimé)', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  assert.equal(r.transformation.certaine, true);
  assert.equal(appliquerTransformation(r.transformation, 'Je cours'), 'Je ne cours pas');
});

test('LOT1 -- REVALIDATION : le préfixe (deuxième famille déjà validée) reste CERTAIN', () => {
  const r = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  assert.equal(r.transformation.certaine, true);
});

test('LOT1 -- REVALIDATION : la suppression pure (Je voudrais un café => un café) reste CERTAINE', () => {
  const r = induireTransformation([
    { entree: 'Je voudrais un café', sortie: 'un café' },
    { entree: 'Je voudrais un thé', sortie: 'un thé' },
  ]);
  assert.equal(r.transformation.certaine, true);
  assert.equal(appliquerTransformation(r.transformation, 'Je voudrais un croissant'), 'un croissant');
});

test('LOT1 -- REVALIDATION : le remplacement littéral fixe (content => ravi) reste CERTAIN', () => {
  const r = induireTransformation([
    { entree: 'Le chat est content', sortie: 'Le chat est ravi' },
    { entree: 'Le chien est content', sortie: 'Le chien est ravi' },
  ]);
  assert.equal(r.transformation.certaine, true);
  assert.equal(appliquerTransformation(r.transformation, 'Le lapin est content'), 'Le lapin est ravi');
});

test('LOT1 -- REVALIDATION : composition de deux transformations certaines reste certaine et s\'applique', () => {
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  const fusion = fusionnerTransformations([neg.transformation, prefixe.transformation]);
  assert.equal(fusion.ok, true);
  assert.equal(fusion.transformation.certaine, true);
  assert.equal(appliquerTransformation(fusion.transformation, 'je chante'), 'Enfin, je ne chante pas');
});

test('LOT1 -- composer une transformation CERTAINE avec une transformation NON CERTAINE rend le tout non certain', () => {
  const surGeneralisee = induireTransformation([
    { entree: 'tu chantes', sortie: 'chantes tu ?' },
    { entree: 'tu arrives', sortie: 'arrives tu ?' },
  ]);
  const negation = induireTransformation([
    { entree: 'tu chantes', sortie: 'tu ne chantes pas' },
    { entree: 'tu arrives', sortie: 'tu ne arrives pas' },
  ]);
  const fusion = fusionnerTransformations([surGeneralisee.transformation, negation.transformation]);
  // Peu importe que la fusion structurelle réussisse ou non : si elle réussit, elle DOIT rester non
  // certaine (ne jamais s'appliquer silencieusement) puisqu'un de ses composants l'est.
  if (fusion.ok) assert.equal(fusion.transformation.certaine, false);
});

// ============================================================================ LOT 2 (v0.28) : TRANSFORMATION INTERNE À UNE VARIABLE
// Le mécanisme au niveau des MOTS ne change pas d'arité entre exemples (limite assumée, documentée).
// Au niveau des CARACTÈRES en revanche, la longueur d'un mot varie naturellement d'un exemple à
// l'autre pour la MÊME opération (chat=4, chien=5) : le mécanisme retenu reste donc volontairement
// restreint à un PRÉFIXE et/ou un SUFFIXE littéral ajouté au mot entier gardé -- pas une LCS complète
// et récursive au niveau du caractère (qui se heurterait à la même contrainte d'arité fixe). C'est le
// plus petit mécanisme trouvé qui débloque les familles testées sans coder aucune règle française.
test('LOT2 -- suffixe interne appris (singulier/pluriel, banc d\'essai), généralise à un mot jamais vu', () => {
  const r = induireTransformation([
    { entree: 'chat', sortie: 'chats' },
    { entree: 'chien', sortie: 'chiens' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.transformation.certaine, true);
  assert.deepEqual(r.transformation.interne[0], { prefixe: '', suffixe: 's' });
  assert.equal(appliquerTransformation(r.transformation, 'renard'), 'renards');
});

test('LOT2 -- suffixe interne appris (masculin/féminin, banc d\'essai), généralise à un mot jamais vu', () => {
  const r = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.interne[0], { prefixe: '', suffixe: 'e' });
  assert.equal(appliquerTransformation(r.transformation, 'lent'), 'lente');
});

test('LOT2 -- famille ARTIFICIELLE, suffixe interne (sans rapport avec le français)', () => {
  const r = induireTransformation([
    { entree: 'ab', sortie: 'abZZ' },
    { entree: 'cd', sortie: 'cdZZ' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(appliquerTransformation(r.transformation, 'ef'), 'efZZ');
});

test('LOT2 -- famille ARTIFICIELLE, préfixe interne (sans rapport avec le français)', () => {
  const r = induireTransformation([
    { entree: 'ab', sortie: 'XXab' },
    { entree: 'cd', sortie: 'XXcd' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.interne[0], { prefixe: 'XX', suffixe: '' });
  assert.equal(appliquerTransformation(r.transformation, 'ef'), 'XXef');
});

test('LOT2 -- structure de phrase + transformation interne EN MÊME TEMPS', () => {
  const r = induireTransformation([
    { entree: 'le chat est petit', sortie: 'Oui, le chat est petite' },
    { entree: 'le chien est grand', sortie: 'Oui, le chien est grande' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(appliquerTransformation(r.transformation, 'le lapin est lent'), 'Oui, le lapin est lente');
});

test('LOT2 -- une variation non réductible à un préfixe/suffixe reste une abstention honnête (pas de règle inventée)', () => {
  const r = induireTransformation([
    { entree: 'beau', sortie: 'belle' }, // vraie irrégularité, ni préfixe ni suffixe de "beau"
    { entree: 'joli', sortie: 'jolie' },
  ]);
  assert.equal(r.ok, false);
});

// ============================================================================ v0.31 -- EXTENSION GÉNÉRALE PRÉFIXE + X + SUFFIXE
// Décision ChatGPT « EXTENSION GÉNÉRALE PRÉFIXE + X + SUFFIXE » : relationPrefixeSuffixe() ne se
// limitait qu'à X=>XZ (suffixe seul) ou X=>ZX (préfixe seul) -- jamais les deux non vides en même
// temps (X=>ZXT). Élargie pour chercher X comme SOUS-CHAÎNE de la sortie, à n'importe quelle position :
// absente => irrégularité (inchangé) ; exactement une position => {prefixe, suffixe} (les deux
// éventuellement non vides) ; plusieurs positions => abstention (ambiguïté), jamais un choix arbitraire.
// AUCUN changement à `interne`/appliquerTransformation, qui acceptaient déjà les deux non vides.
test('v0.31 -- cas réel : préfixe ET suffixe simultanés (banc d\'essai artificiel « malo/turo »)', () => {
  const r = induireTransformation([
    { entree: 'malo', sortie: 'zamalotu' },
    { entree: 'turo', sortie: 'zaturotu' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.transformation.certaine, true);
  assert.deepEqual(r.transformation.interne[0], { prefixe: 'za', suffixe: 'tu' });
  assert.equal(appliquerTransformation(r.transformation, 'nera'), 'zaneratu');
});

test('v0.31 -- non-régression : X => XZ (suffixe seul) fonctionne toujours après l\'extension', () => {
  const r = induireTransformation([
    { entree: 'ab', sortie: 'abZZ' },
    { entree: 'cd', sortie: 'cdZZ' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.interne[0], { prefixe: '', suffixe: 'ZZ' });
  assert.equal(appliquerTransformation(r.transformation, 'ef'), 'efZZ');
});

test('v0.31 -- non-régression : X => ZX (préfixe seul) fonctionne toujours après l\'extension', () => {
  const r = induireTransformation([
    { entree: 'ab', sortie: 'XXab' },
    { entree: 'cd', sortie: 'XXcd' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.interne[0], { prefixe: 'XX', suffixe: '' });
  assert.equal(appliquerTransformation(r.transformation, 'ef'), 'XXef');
});

test('v0.31 -- X apparaissant PLUSIEURS FOIS dans la sortie : jamais un choix arbitraire, abstention', () => {
  // "abab" contient "ab" à deux positions distinctes (0 et 2) : impossible de savoir laquelle est la
  // variable conservée sans deviner -- abstention honnête, jamais la première occurrence par défaut.
  const r = induireTransformation([
    { entree: 'ab', sortie: 'abab' },
    { entree: 'cd', sortie: 'Xcd' }, // un deuxième exemple, cohérent par ailleurs (préfixe seul, sans ambiguïté)
  ]);
  assert.equal(r.ok, false);
});

test('v0.31 -- exemples dont les relations préfixe/suffixe divergent réellement : conflit, jamais une règle inventée', () => {
  const r = induireTransformation([
    { entree: 'malo', sortie: 'zamalotu' }, // {prefixe:'za', suffixe:'tu'}
    { entree: 'turo', sortie: 'weturoqi' }, // {prefixe:'we', suffixe:'qi'} -- ne s'accorde pas avec le premier
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'conflit');
});

test('v0.31 -- une transformation réellement irrégulière reste toujours refusée après l\'extension', () => {
  const r = induireTransformation([
    { entree: 'beau', sortie: 'belle' },
    { entree: 'joli', sortie: 'jolie' },
  ]);
  assert.equal(r.ok, false);
});

// ============================================================================ LOT 3 (v0.28) : COORDINATION ENTRE POSITIONS
// Banc d'essai imposé par la décision. Vérifie si la coordination attendue découle DÉJÀ du Lot 2
// appliqué indépendamment à chaque position (aucun mécanisme séparé), comme pressenti au diagnostic.
test('LOT3 -- plusieurs positions transformées ensemble (accord), combinaison réellement nouvelle', () => {
  const r = induireTransformation([
    { entree: 'le chat est petit', sortie: 'Les chats sont petits' },
    { entree: 'le chien est grand', sortie: 'Les chiens sont grands' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.transformation.certaine, true);
  // Combinaison jamais enseignée : l'animal ("lapin") vient d'un exemple, l'adjectif ("petit") de l'autre.
  assert.equal(appliquerTransformation(r.transformation, 'le lapin est petit'), 'Les lapins sont petits');
});

test('LOT3 -- famille ARTIFICIELLE, coordination de plusieurs positions', () => {
  const r = induireTransformation([
    { entree: 'ab cd', sortie: 'abZ cdZ' },
    { entree: 'ef gh', sortie: 'efZ ghZ' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(appliquerTransformation(r.transformation, 'ij kl'), 'ijZ klZ');
});

// ============================================================================ GÉNÉRALITÉ (deuxième famille, même mécanisme)
test('une DEUXIÈME famille de transformation (préfixe), sans aucun code spécifique, réussit avec le même mécanisme', () => {
  const r = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.insertions[0], ['Enfin', ',']);
  const sortie = appliquerTransformation(r.transformation, 'il danse');
  assert.equal(sortie, 'Enfin, il danse');
});

// ============================================================================ COMPOSITION
test('fusionnerTransformations combine deux transformations touchant des positions différentes', () => {
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  assert.equal(neg.ok, true);
  assert.equal(prefixe.ok, true);
  const fusion = fusionnerTransformations([neg.transformation, prefixe.transformation]);
  assert.equal(fusion.ok, true);
  // Cas nouveau, jamais enseigné : ni la négation seule ni le préfixe seul n'ont vu "je chante".
  const sortie = appliquerTransformation(fusion.transformation, 'je chante');
  assert.equal(sortie, 'Enfin, je ne chante pas');
});

test('fusionnerTransformations s\'abstient si deux transformations se contredisent à la même position', () => {
  const negPas = { n: 2, insertions: [[], ['ne'], ['pas']] };
  const negJamais = { n: 2, insertions: [[], ['ne'], ['jamais']] };
  const fusion = fusionnerTransformations([negPas, negJamais]);
  assert.equal(fusion.ok, false);
  assert.equal(fusion.raison, 'conflit');
});

test('fusionnerTransformations d\'une seule transformation est une identité (application inchangée)', () => {
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const fusion = fusionnerTransformations([neg.transformation]);
  assert.equal(fusion.ok, true);
  assert.equal(appliquerTransformation(fusion.transformation, 'Je cours'), 'Je ne cours pas');
});

// ============================================================================ RECONNAISSANCE DE SQUELETTE (v0.30, décision ChatGPT
// « RACCORDEMENT COMPRÉHENSION → INTENTION → TRANSFORMATION ») -- bancs d'essai ARTIFICIELS (ZFAIS/
// ZCHOSE), sans aucun rapport avec le français, pour prouver que le mécanisme est général.
test('correspondSquelette reconnaît une phrase nouvelle qui respecte littéralement les ancres apprises', () => {
  const t = {
    n: 3,
    exemples: [
      { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
      { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
    ],
  };
  assert.equal(correspondSquelette(t, 'ZFAIS gamma ZCHOSE'), true);
});

test('correspondSquelette refuse une phrase qui ne respecte pas une position ancre', () => {
  const t = {
    n: 3,
    exemples: [
      { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
      { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
    ],
  };
  assert.equal(correspondSquelette(t, 'ZDIT gamma ZCHOSE'), false);
  assert.equal(correspondSquelette(t, 'ZFAIS gamma ZAUTRECHOSE'), false);
});

test('correspondSquelette refuse une phrase sans rapport, même de même arité (aucune ancre commune)', () => {
  const t = {
    n: 3,
    exemples: [
      { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
      { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
    ],
  };
  assert.equal(correspondSquelette(t, 'un chat noir'), false);
});

test('correspondSquelette refuse par arité différente sans même comparer les ancres', () => {
  const t = {
    n: 3,
    exemples: [
      { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
      { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
    ],
  };
  assert.equal(correspondSquelette(t, 'ZFAIS gamma ZCHOSE en plus'), false);
});

test('correspondSquelette exige au moins une ancre : aucune position invariante entre les exemples => jamais un squelette', () => {
  const t = {
    n: 2,
    exemples: [
      { entree: 'alpha un', sortie: 'x' },
      { entree: 'beta deux', sortie: 'y' },
    ],
  };
  assert.equal(correspondSquelette(t, 'gamma trois'), false);
});

// v0.30.1 (décision ChatGPT « PRÉSERVER LES SQUELETTES DISTINCTS ») : calculerAncres() est désormais
// exportée pour que connaissances.js compare les SQUELETTES (pas seulement la forme) avant de fusionner
// deux enregistrements -- même notion d'ancre que correspondSquelette(), jamais une seconde définition.
test('calculerAncres renvoie les positions et jetons invariants entre tous les exemples', () => {
  assert.deepEqual(
    calculerAncres({ n: 3, exemples: [{ entree: 'ZFAIS alpha ZCHOSE' }, { entree: 'ZFAIS beta ZCHOSE' }] }),
    [{ position: 0, jeton: 'ZFAIS' }, { position: 2, jeton: 'ZCHOSE' }],
  );
});

test('calculerAncres renvoie un tableau vide sans exemples exploitables ou sans aucune ancre', () => {
  assert.deepEqual(calculerAncres({ n: 3, exemples: [] }), []);
  assert.deepEqual(
    calculerAncres({ n: 2, exemples: [{ entree: 'alpha un' }, { entree: 'beta deux' }] }),
    [],
  );
});

test('correspondSquelette reconnaît le cas réel visé (« Mets ... au féminin. »), et l\'extraction reste l\'application ordinaire de cette même transformation', () => {
  const r = induireTransformation([
    { entree: 'Mets lent au féminin .', sortie: 'lent' },
    { entree: 'Mets grand au féminin .', sortie: 'grand' },
  ]);
  assert.equal(r.ok, true);
  const t = { ...r.transformation, exemples: r.exemples };
  assert.equal(correspondSquelette(t, 'Mets petit au féminin .'), true);
  assert.equal(appliquerTransformation(t, 'Mets petit au féminin .'), 'petit');
});

// ============================================================================ GARDE-FOU STATIQUE : aucun réseau, aucun Gemini
test('GARDE-FOU — transformation.js n\'importe rien, ne connaît aucun réseau ni Gemini', () => {
  const src = readFileSync(new URL('../app/langage/transformation.js', import.meta.url), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/^import /m.test(sansCommentaires), 'ce fichier ne doit importer aucun autre module (pur et isolé)');
  assert.ok(!/gemini/i.test(sansCommentaires));
  assert.ok(!/fetch\(/.test(sansCommentaires));
});
