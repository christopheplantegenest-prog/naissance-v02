// Chantier « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026) -- ORCHESTRATION
// (langage/ecran.js) et PERSISTANCE (langage/connaissances.js). Bout en bout, sur le VRAI esprit
// partagé (chargerEsprit), comme tests/proposition-spontanee.test.mjs (v0.25) : preuves A, B, C, D
// demandées par la décision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { induireTransformation, appliquerTransformation, fusionnerTransformations } from '../app/langage/transformation.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

function monter(magasin = magasinMemoireVive()) {
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { magasin, ecran };
}

// ============================================================================ A. TRANSFORMATION
test('A. deux exemples cohérents (négation, banc d\'essai) → candidat induit, RIEN écrit avant confirmation', async () => {
  const { magasin } = monter();
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(await magasin.lireTout('transformations'), []);
});

test('A. un seul exemple insuffisant ne provoque pas une généralisation abusive', () => {
  const r = induireTransformation([{ entree: 'Je mange', sortie: 'Je ne mange pas' }]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'insuffisant');
});

test('A. exemples contradictoires/ambigus → abstention', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors jamais' },
  ]);
  assert.equal(r.ok, false);
});

test('A. après confirmation explicite, application correcte à une entrée réellement nouvelle, moteur local', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const conf = await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  assert.match(conf.explication, /J'ai appris/);
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Je ne cours pas');
});

test('A. persistance après redémarrage/rechargement (nouvel esprit sur le même magasin)', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const { ecran: ecranRedemarre } = monter(magasin); // même magasin, nouvel écran = équivaut à fermer/rouvrir
  const application = await ecranRedemarre.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Je ne cours pas');
});

test('A. aucun Gemini nécessaire : appliquerTransformationLocale ne prend aucun professeur externe', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  // monterEcranLangage ci-dessus a été monté SANS appelerGemini (null) -- la réussite de l'application
  // prouve qu'aucun accès réseau n'a été nécessaire.
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.texte, 'Je ne cours pas');
});

// ============================================================================ B. GÉNÉRALITÉ
test('B. le même mécanisme réussit une DEUXIÈME famille (préfixe), sans code spécifique aux deux', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  assert.equal(r.ok, true);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const application = await ecran.appliquerTransformationLocale('il danse');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Enfin, il danse');
});

// ============================================================================ C. COMPOSITION
test('C. deux transformations apprises séparément se combinent sur un cas nouveau jamais enseigné', async () => {
  const { ecran } = monter();
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  await ecran.confirmerTransformation({ ...neg.transformation, exemples: neg.exemples });
  await ecran.confirmerTransformation({ ...prefixe.transformation, exemples: prefixe.exemples });
  // "je chante" : n'a jamais servi d'exemple ni pour neg ni pour prefixe.
  const application = await ecran.appliquerTransformationLocale('je chante');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Enfin, je ne chante pas');
});

test('C. si plusieurs transformations de même arité se contredisent, abstention -- jamais un choix arbitraire', async () => {
  const { ecran } = monter();
  const negPas = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  await ecran.confirmerTransformation({ ...negPas.transformation, exemples: negPas.exemples });
  // Une SECONDE transformation, de même arité, apprise séparément mais contradictoire à la même
  // position (« jamais » au lieu de « pas ») -- une divergence de vécu bien réelle (deux leçons
  // données à des moments différents), pas un artefact du test.
  const negJamais = induireTransformation([
    { entree: 'Il parle', sortie: 'Il ne parle jamais' },
    { entree: 'Il rit', sortie: 'Il ne rit jamais' },
  ]);
  await ecran.confirmerTransformation({ ...negJamais.transformation, exemples: negJamais.exemples });
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, false);
  assert.equal(application.raison, 'conflit');
});

test('C. persistance de la composition après redémarrage', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  await ecran.confirmerTransformation({ ...neg.transformation, exemples: neg.exemples });
  await ecran.confirmerTransformation({ ...prefixe.transformation, exemples: prefixe.exemples });
  const { ecran: ecranRedemarre } = monter(magasin);
  const application = await ecranRedemarre.appliquerTransformationLocale('je chante');
  assert.equal(application.texte, 'Enfin, je ne chante pas');
});

// ============================================================================ Application sans transformation apprise
test('aucune transformation validée pour cette arité → abstention explicite, jamais devinée', async () => {
  const { ecran } = monter();
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, false);
  assert.equal(application.raison, 'aucune');
});

// ============================================================================ SUPPRESSION/REMPLACEMENT (v0.27, décision ChatGPT « DIAGNOSTIC v0.26.0 »)
test('v0.27. une transformation avec SUPPRESSION s\'apprend, se persiste et s\'applique via le vrai écran', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'a b c', sortie: 'a c' },
    { entree: 'x b y', sortie: 'x y' },
  ]);
  assert.equal(r.ok, true);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const application = await ecran.appliquerTransformationLocale('p b q');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'p q');
});

test('v0.27. persistance d\'une transformation avec SUPPRESSION après redémarrage', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const r = induireTransformation([
    { entree: 'a b c', sortie: 'a c' },
    { entree: 'x b y', sortie: 'x y' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const { ecran: ecranRedemarre } = monter(magasin);
  const application = await ecranRedemarre.appliquerTransformationLocale('p b q');
  assert.equal(application.texte, 'p q');
});

test('v0.27. une transformation SANS champ garder, persistée avant l\'extension (v0.26), s\'applique toujours comme avant', async () => {
  // Simule une ligne persistée AVANT le 27/09/2026 (aucun champ « garder » dans le magasin), écrite
  // directement pour reproduire fidèlement ce qui existe déjà sur le téléphone de Christophe.
  const magasin = magasinMemoireVive();
  await magasin.ecrire('transformations', {
    id: 'transformation-ancienne', n: 2, insertions: [[], ['ne'], ['pas']],
    exemples: [], origine: 'apprise-conversation', statut: 'validee',
  });
  const { ecran } = monter(magasin);
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Je ne cours pas');
});

// ============================================================================ Réapprentissage identique (pas de doublon)
test('réapprendre exactement la même transformation ajoute les exemples sans dupliquer la ligne', async () => {
  const { ecran, magasin } = monter();
  const neg1 = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  await ecran.confirmerTransformation({ ...neg1.transformation, exemples: neg1.exemples });
  const neg2 = induireTransformation([
    { entree: 'Je cours', sortie: 'Je ne cours pas' },
    { entree: 'Je parle', sortie: 'Je ne parle pas' },
  ]);
  await ecran.confirmerTransformation({ ...neg2.transformation, exemples: neg2.exemples });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.length, 1, 'la même transformation (mêmes insertions) ne doit pas créer une seconde ligne');
  assert.equal(toutes[0].exemples.length, 4);
});

// ============================================================================ LOT 1 (v0.28, décision ChatGPT « GRAND DIAGNOSTIC ») : ANTI-SUR-GÉNÉRALISATION, BOUT EN BOUT
test('LOT1. une transformation NON CERTAINE (piège tu chantes/chantes tu ?) est APPRISE et PERSISTÉE, mais JAMAIS appliquée', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const r = induireTransformation([
    { entree: 'tu chantes', sortie: 'chantes tu ?' },
    { entree: 'tu arrives', sortie: 'arrives tu ?' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.transformation.certaine, false);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  // Bien apprise et persistée (pas de perte de l'apprentissage), y compris après redémarrage.
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.length, 1);
  assert.equal(toutes[0].certaine, false);
  // Mais JAMAIS appliquée : « elle chante » ne doit surtout pas devenir « chante tu ? » (le piège du
  // diagnostic v0.26.0) -- abstention honnête et explicite, pas un texte vide confondu avec un succès.
  // Depuis le correctif v0.28.1 (décision ChatGPT « STOP ARCHITECTURAL »), une transformation non
  // certaine est exclue AVANT même la fusion (elle ne participe à aucune composition) : seule
  // transformation connue de cette arité ici, l'ensemble transmis à la fusion est donc vide -- raison
  // « aucune », pas « incertaine » (qui ne peut plus se produire qu'en théorie, comme filet de sécurité
  // dans transformation.js/ecran.js, jamais observable ici).
  const { ecran: ecranRedemarre } = monter(magasin);
  const application = await ecranRedemarre.appliquerTransformationLocale('elle chante');
  assert.equal(application.ok, false);
  assert.equal(application.raison, 'aucune');
});

// ============================================================================ v0.28.1 (décision ChatGPT « STOP ARCHITECTURAL : LOT 1 CASSE UNE COMPOSITION DÉJÀ VALIDÉE ») : CORRECTIF
test('v0.28.1. une transformation non certaine ne s\'applique toujours pas seule', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'tu chantes', sortie: 'chantes tu ?' },
    { entree: 'tu arrives', sortie: 'arrives tu ?' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const application = await ecran.appliquerTransformationLocale('elle chante');
  assert.equal(application.ok, false);
});

test('v0.28.1. une transformation non certaine ne bloque plus deux transformations certaines compatibles de même arité (composition négation + préfixe revalidée)', async () => {
  const { ecran } = monter();
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  const piege = induireTransformation([
    { entree: 'tu chantes', sortie: 'chantes tu ?' },
    { entree: 'tu arrives', sortie: 'arrives tu ?' },
  ]);
  assert.equal(piege.transformation.certaine, false);
  await ecran.confirmerTransformation({ ...neg.transformation, exemples: neg.exemples });
  await ecran.confirmerTransformation({ ...prefixe.transformation, exemples: prefixe.exemples });
  await ecran.confirmerTransformation({ ...piege.transformation, exemples: piege.exemples });
  // Les trois transformations sont de MÊME arité (n=2) ; avant le correctif, la coexistence du piège
  // (non certain) suffisait à faire échouer la fusion des deux autres (conflit de « garder »). Depuis
  // le correctif, le piège est exclu AVANT la fusion : négation + préfixe se combinent normalement.
  const application = await ecran.appliquerTransformationLocale('je chante');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Enfin, je ne chante pas');
});

test('v0.28.1. deux transformations CERTAINES réellement contradictoires provoquent toujours l\'abstention (le correctif ne les fait pas coexister à tort)', async () => {
  const { ecran } = monter();
  const negPas = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const negJamais = induireTransformation([
    { entree: 'Il parle', sortie: 'Il ne parle jamais' },
    { entree: 'Il rit', sortie: 'Il ne rit jamais' },
  ]);
  assert.equal(negPas.transformation.certaine, true);
  assert.equal(negJamais.transformation.certaine, true);
  await ecran.confirmerTransformation({ ...negPas.transformation, exemples: negPas.exemples });
  await ecran.confirmerTransformation({ ...negJamais.transformation, exemples: negJamais.exemples });
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, false);
  assert.equal(application.raison, 'conflit');
});

// ============================================================================ LOT 2 (v0.28) : TRANSFORMATION INTERNE, BOUT EN BOUT
test('LOT2. transformation interne (suffixe) apprise, persistée, et généralisée à un mot jamais vu après redémarrage', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const r = induireTransformation([
    { entree: 'un chat', sortie: 'des chats' },
    { entree: 'un chien', sortie: 'des chiens' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.transformation.certaine, true);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const { ecran: ecranRedemarre } = monter(magasin);
  const application = await ecranRedemarre.appliquerTransformationLocale('un renard');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'des renards');
});

// ============================================================================ LOT 3 (v0.28) : COORDINATION ENTRE POSITIONS, BOUT EN BOUT
test('LOT3. coordination de plusieurs positions (accord), apprise et appliquée à une combinaison réellement nouvelle, via le vrai écran', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'Le chat est petit', sortie: 'Les chats sont petits' },
    { entree: 'Le chien est grand', sortie: 'Les chiens sont grands' },
  ]);
  assert.equal(r.ok, true);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const application = await ecran.appliquerTransformationLocale('Le lapin est petit');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Les lapins sont petits');
});

// ============================================================================ RÉTROCOMPATIBILITÉ (v0.27 → v0.28, LOT 1/2)
test('v0.28. une transformation persistée SANS champs interne/certaine (apprise avant ce chantier) s\'applique toujours comme avant', async () => {
  // Reproduit fidèlement une ligne v0.27.0 déjà sur le téléphone de Christophe (garder présent, mais
  // ni « interne » ni « certaine » -- ces deux champs n'existaient pas encore).
  const magasin = magasinMemoireVive();
  await magasin.ecrire('transformations', {
    id: 'transformation-v027',
    n: 2,
    insertions: [[], ['un', 'seul'], []],
    garder: [true, false],
    exemples: [],
    origine: 'apprise-conversation',
    statut: 'validee',
  });
  const { ecran } = monter(magasin);
  const application = await ecran.appliquerTransformationLocale('a b');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'a un seul');
});

test('v0.28. apprendreTransformation() normalise interne/certaine absents (rétrocompatibilité de la fonction de persistance elle-même)', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  // Un candidat « à l'ancienne » (comme en produirait un main.js pas encore mis à jour) : ni interne,
  // ni certaine.
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const candidatAncien = { n: r.transformation.n, insertions: r.transformation.insertions, garder: r.transformation.garder, exemples: r.exemples };
  await ecran.confirmerTransformation(candidatAncien);
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.length, 1);
  assert.deepEqual(toutes[0].interne, [null, null]);
  assert.equal(toutes[0].certaine, true);
});

test('v0.28. appliquerTransformation (pur) renvoie null pour une transformation persistée NON CERTAINE, jamais un résultat partiel', () => {
  const transformationIncertaine = {
    n: 2, insertions: [[], ['chantes', 'tu', '?'], []], garder: [false, false], certaine: false,
  };
  assert.equal(appliquerTransformation(transformationIncertaine, 'elle chante'), null);
});

// ============================================================================ v0.29 (décision ChatGPT « SÉLECTION CONTEXTUELLE PAR INTENTION »)
// A. Deux transformations incompatibles d'arité 1, sous deux intentions ARTIFICIELLES.
test('A. deux transformations incompatibles de même arité, sous deux intentions différentes, se sélectionnent chacune par leur nom', async () => {
  const { ecran } = monter();
  const zA = induireTransformation([
    { entree: 'ab', sortie: 'abZ' },
    { entree: 'cd', sortie: 'cdZ' },
  ]);
  const zB = induireTransformation([
    { entree: 'ab', sortie: 'Zab' },
    { entree: 'cd', sortie: 'Zcd' },
  ]);
  await ecran.confirmerTransformation({ ...zA.transformation, exemples: zA.exemples, intention: 'ZINTENTION-A' });
  await ecran.confirmerTransformation({ ...zB.transformation, exemples: zB.exemples, intention: 'ZINTENTION-B' });
  const appA = await ecran.appliquerTransformationLocale('ij', 'ZINTENTION-A');
  assert.equal(appA.ok, true);
  assert.equal(appA.texte, 'ijZ');
  const appB = await ecran.appliquerTransformationLocale('ij', 'ZINTENTION-B');
  assert.equal(appB.ok, true);
  assert.equal(appB.texte, 'Zij');
  // Sans intention précisée : comportement actuel inchangé -- les deux transformations, de même arité,
  // se contredisent (l'une insère avant, l'autre après) -- abstention.
  const sansIntention = await ecran.appliquerTransformationLocale('ij');
  assert.equal(sansIntention.ok, false);
  assert.equal(sansIntention.raison, 'conflit');
  // Intention demandée mais inconnue : abstention DISTINCTE, jamais un repli silencieux.
  const inconnue = await ecran.appliquerTransformationLocale('ij', 'ZINTENTION-INCONNUE');
  assert.equal(inconnue.ok, false);
  assert.equal(inconnue.raison, 'intention_inconnue');
});

// B. Cas réel d'enseignement : féminin.
test('B. intention « féminin » enseignée, appliquée à un mot jamais vu, moteur local', async () => {
  const { ecran } = monter();
  const feminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  await ecran.confirmerTransformation({ ...feminin.transformation, exemples: feminin.exemples, intention: 'feminin' });
  const application = await ecran.appliquerTransformationLocale('lent', 'feminin');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'lente');
});

// C. Une autre intention incompatible sur la même arité ne bloque pas B.
test('C. une seconde intention (pluriel), incompatible avec féminin sur la même arité, ne bloque pas féminin', async () => {
  const { ecran } = monter();
  const feminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  const pluriel = induireTransformation([
    { entree: 'petit', sortie: 'petits' },
    { entree: 'grand', sortie: 'grands' },
  ]);
  await ecran.confirmerTransformation({ ...feminin.transformation, exemples: feminin.exemples, intention: 'feminin' });
  await ecran.confirmerTransformation({ ...pluriel.transformation, exemples: pluriel.exemples, intention: 'pluriel' });
  const appFeminin = await ecran.appliquerTransformationLocale('lent', 'feminin');
  assert.equal(appFeminin.ok, true);
  assert.equal(appFeminin.texte, 'lente');
  const appPluriel = await ecran.appliquerTransformationLocale('lent', 'pluriel');
  assert.equal(appPluriel.ok, true);
  assert.equal(appPluriel.texte, 'lents');
  // Sans intention : les deux se contredisent (même arité, littéraux différents) -- comportement actuel.
  const sansIntention = await ecran.appliquerTransformationLocale('lent');
  assert.equal(sansIntention.ok, false);
});

// D. Deux transformations compatibles sous une même intention doivent encore se composer.
test('D. deux transformations compatibles sous une MÊME intention se composent toujours', async () => {
  const { ecran } = monter();
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  await ecran.confirmerTransformation({ ...neg.transformation, exemples: neg.exemples, intention: 'renforce' });
  await ecran.confirmerTransformation({ ...prefixe.transformation, exemples: prefixe.exemples, intention: 'renforce' });
  const application = await ecran.appliquerTransformationLocale('je chante', 'renforce');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Enfin, je ne chante pas');
});

// E. Deux transformations CONTRADICTOIRES sous la MÊME intention doivent encore s'abstenir.
test('E. deux transformations réellement contradictoires sous la MÊME intention provoquent toujours l\'abstention', async () => {
  const { ecran } = monter();
  const negPas = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const negJamais = induireTransformation([
    { entree: 'Il parle', sortie: 'Il ne parle jamais' },
    { entree: 'Il rit', sortie: 'Il ne rit jamais' },
  ]);
  await ecran.confirmerTransformation({ ...negPas.transformation, exemples: negPas.exemples, intention: 'negation' });
  await ecran.confirmerTransformation({ ...negJamais.transformation, exemples: negJamais.exemples, intention: 'negation' });
  const application = await ecran.appliquerTransformationLocale('Je cours', 'negation');
  assert.equal(application.ok, false);
  assert.equal(application.raison, 'conflit');
});

// F. Persistance après rechargement.
test('F. une transformation étiquetée par une intention reste sélectionnable après redémarrage', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const feminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  await ecran.confirmerTransformation({ ...feminin.transformation, exemples: feminin.exemples, intention: 'feminin' });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes[0].intention, 'feminin');
  const { ecran: ecranRedemarre } = monter(magasin);
  const application = await ecranRedemarre.appliquerTransformationLocale('lent', 'feminin');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'lente');
});

// G. Rétrocompatibilité complète des transformations SANS intention.
test('G. une transformation SANS intention (apprise avant ce chantier, ou enseignée sans en préciser une) continue de s\'appliquer sans intention demandée', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('transformations', {
    id: 'transformation-sans-intention', n: 2, insertions: [[], ['ne'], ['pas']],
    garder: [true, true], exemples: [], origine: 'apprise-conversation', statut: 'validee',
  });
  const { ecran } = monter(magasin);
  const application = await ecran.appliquerTransformationLocale('Je cours');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'Je ne cours pas');
  // Demander une intention qu'elle ne porte pas : abstention distincte, jamais un repli silencieux.
  const avecIntention = await ecran.appliquerTransformationLocale('Je cours', 'negation');
  assert.equal(avecIntention.ok, false);
  assert.equal(avecIntention.raison, 'intention_inconnue');
});

test('v0.29. apprendreTransformation() normalise une intention absente ou vide à null (rétrocompatibilité)', async () => {
  const { ecran, magasin } = monter();
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes[0].intention, null);
});

test('v0.29. réapprendre la même transformation sous une intention DIFFÉRENTE crée une connaissance distincte, pas un doublon fusionné', async () => {
  const { ecran, magasin } = monter();
  const feminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  await ecran.confirmerTransformation({ ...feminin.transformation, exemples: feminin.exemples, intention: 'feminin' });
  // Mêmes insertions/garder/interne/certaine, mais une intention DIFFÉRENTE : ce n'est pas la même
  // connaissance (une seule chaîne littérale ne peut pas signifier deux choses à la fois ici -- mais
  // le principe testé est que la signature de dédoublonnage distingue bien les intentions).
  await ecran.confirmerTransformation({ ...feminin.transformation, exemples: feminin.exemples, intention: 'autre-intention' });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.length, 2);
});

// ============================================================================ v0.30 (décision ChatGPT « RACCORDEMENT COMPRÉHENSION →
// INTENTION → TRANSFORMATION ») -- tenterReconnaissanceTransformation() : une phrase ENTIÈRE, jamais
// tapée avant, SANS marqueur « Applique : », doit être reconnue si (et seulement si) elle correspond
// littéralement au squelette d'une transformation déjà enseignée avec une intention. Bancs d'essai
// ARTIFICIELS (ZFAIS/ZCHOSE...) exigés par la décision, plus le cas réel « féminin » visé.

// Preuve exacte demandée par la décision (point 5) : enseigner le squelette ZFAMILLE (extraction, deux
// formulations) PUIS la transformation réelle ZFAMILLE (arité 1, appliquée à la valeur extraite).
test('v0.30. A. ZFAMILLE : phrase nouvelle → intention reconnue, valeur extraite, transformation ZFAMILLE appliquée', async () => {
  const { ecran } = monter();
  const squelette = induireTransformation([
    { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
    { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
  ]);
  assert.equal(squelette.ok, true);
  await ecran.confirmerTransformation({ ...squelette.transformation, exemples: squelette.exemples, intention: 'ZFAMILLE' });
  const motZFamille = induireTransformation([
    { entree: 'alpha', sortie: 'alphaZ' },
    { entree: 'beta', sortie: 'betaZ' },
  ]);
  assert.equal(motZFamille.ok, true);
  await ecran.confirmerTransformation({ ...motZFamille.transformation, exemples: motZFamille.exemples, intention: 'ZFAMILLE' });
  // « ZFAIS gamma ZCHOSE » : jamais tapée avant, ni comme squelette ni comme mot.
  const r = await ecran.tenterReconnaissanceTransformation('ZFAIS gamma ZCHOSE');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'gammaZ');
});

// Une deuxième intention, même arité de squelette, squelette DIFFÉRENT (ancres différentes) : les deux
// doivent coexister sans interférence.
test('v0.30. B. une deuxième intention/squelette de même arité coexiste sans interférence', async () => {
  const { ecran } = monter();
  const squeletteA = induireTransformation([
    { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
    { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteA.transformation, exemples: squeletteA.exemples, intention: 'ZFAMILLE' });
  const motA = induireTransformation([
    { entree: 'alpha', sortie: 'alphaZ' },
    { entree: 'beta', sortie: 'betaZ' },
  ]);
  await ecran.confirmerTransformation({ ...motA.transformation, exemples: motA.exemples, intention: 'ZFAMILLE' });
  const squeletteB = induireTransformation([
    { entree: 'ZVEUX ancre1 ZFIN', sortie: 'ancre1' },
    { entree: 'ZVEUX ancre2 ZFIN', sortie: 'ancre2' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteB.transformation, exemples: squeletteB.exemples, intention: 'ZAUTRE' });
  const motB = induireTransformation([
    { entree: 'ancre1', sortie: 'Wancre1' },
    { entree: 'ancre2', sortie: 'Wancre2' },
  ]);
  await ecran.confirmerTransformation({ ...motB.transformation, exemples: motB.exemples, intention: 'ZAUTRE' });
  const rA = await ecran.tenterReconnaissanceTransformation('ZFAIS gamma ZCHOSE');
  assert.equal(rA.ok, true);
  assert.equal(rA.texte, 'gammaZ');
  const rB = await ecran.tenterReconnaissanceTransformation('ZVEUX ancre3 ZFIN');
  assert.equal(rB.ok, true);
  assert.equal(rB.texte, 'Wancre3');
});

// Une phrase sans rapport, même arité, n'est jamais reconnue -- ce n'est jamais une erreur : l'appelant
// (main.js) doit continuer exactement le pipeline conversationnel habituel.
test('v0.30. C. une phrase sans rapport, même de même arité, n\'est jamais reconnue (continue le pipeline habituel)', async () => {
  const { ecran } = monter();
  const squelette = induireTransformation([
    { entree: 'ZFAIS alpha ZCHOSE', sortie: 'alpha' },
    { entree: 'ZFAIS beta ZCHOSE', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...squelette.transformation, exemples: squelette.exemples, intention: 'ZFAMILLE' });
  const r = await ecran.tenterReconnaissanceTransformation('un chat noir');
  assert.deepEqual(r, { reconnu: false });
});

// Deux squelettes qui correspondent LITTÉRALEMENT à la même phrase mais portent des intentions
// DIFFÉRENTES : jamais un choix arbitraire -- abstention explicite, sans recours à Gemini.
test('v0.30. D. deux squelettes correspondant à la même phrase sous des intentions différentes → abstention explicite', async () => {
  const { ecran } = monter();
  const squeletteI1 = induireTransformation([
    { entree: 'ZX un ZY', sortie: 'un' },
    { entree: 'ZX deux ZY', sortie: 'deux' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteI1.transformation, exemples: squeletteI1.exemples, intention: 'ZI1' });
  const squeletteI2 = induireTransformation([
    { entree: 'ZX trois ZY', sortie: 'trois' },
    { entree: 'ZX quatre ZY', sortie: 'quatre' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteI2.transformation, exemples: squeletteI2.exemples, intention: 'ZI2' });
  const r = await ecran.tenterReconnaissanceTransformation('ZX cinq ZY');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'ambigu');
});

// Plusieurs formulations DIFFÉRENTES apprises séparément pour une MÊME intention : légitime, aucune
// ambiguïté -- exactement le point 6 de la décision « MESSAGE POUR CLAUDE ». Ici, deux squelettes de
// FORME différente (arité différente : n=3 et n=2), donc jamais fusionnés par le dédoublonnage
// existant de connaissances.js (voir test suivant pour le cas où la forme est identique).
test('v0.30. E. plusieurs formulations différentes (de forme différente) apprises pour la même intention fonctionnent chacune', async () => {
  const { ecran } = monter();
  const formulation1 = induireTransformation([
    { entree: 'ZDIS un ZFIN', sortie: 'un' },
    { entree: 'ZDIS deux ZFIN', sortie: 'deux' },
  ]);
  await ecran.confirmerTransformation({ ...formulation1.transformation, exemples: formulation1.exemples, intention: 'ZMULTI' });
  const formulation2 = induireTransformation([
    { entree: 'ZVITE un', sortie: 'un' },
    { entree: 'ZVITE deux', sortie: 'deux' },
  ]);
  await ecran.confirmerTransformation({ ...formulation2.transformation, exemples: formulation2.exemples, intention: 'ZMULTI' });
  const motZMulti = induireTransformation([
    { entree: 'un', sortie: 'unZ' },
    { entree: 'deux', sortie: 'deuxZ' },
  ]);
  await ecran.confirmerTransformation({ ...motZMulti.transformation, exemples: motZMulti.exemples, intention: 'ZMULTI' });
  const r1 = await ecran.tenterReconnaissanceTransformation('ZDIS trois ZFIN');
  assert.equal(r1.ok, true);
  assert.equal(r1.texte, 'troisZ');
  const r2 = await ecran.tenterReconnaissanceTransformation('ZVITE quatre');
  assert.equal(r2.ok, true);
  assert.equal(r2.texte, 'quatreZ');
});

// LIMITE DÉCOUVERTE (diagnostic, non corrigée dans ce chantier -- voir rapport de continuité) : deux
// formulations de MÊME FORME (mêmes garder/insertions, seuls les jetons-ancres littéraux diffèrent,
// ex. « ZDIS X ZFIN » vs « ZPARLE X ZTERMINE ») sont fusionnées par le dédoublonnage de
// apprendreTransformation() (connaissances.js), qui ignore le contenu des exemples et ne compare que
// la FORME (insertions/garder/interne/certaine/intention). Leurs exemples sont alors regroupés dans UN
// SEUL enregistrement, et correspondSquelette() -- qui exige l'accord de TOUS les exemples d'un même
// enregistrement sur une position pour la retenir comme ancre -- ne trouve alors PLUS AUCUNE ancre
// commune (« ZDIS »/« ZPARLE » ne s'accordent pas, ni « ZFIN »/« ZTERMINE ») : aucune des deux
// formulations n'est plus reconnaissable. Ce test documente ce comportement actuel tel quel (pas un
// bug caché) : ni un succès à faire semblant, ni un échec de suite silencieusement toléré.
// v0.30.1 (décision ChatGPT « PRÉSERVER LES SQUELETTES DISTINCTS ») : CORRIGE la limite E-bis
// découverte en v0.30.0 -- deux formulations enseignées séparément, de MÊME FORME (mêmes
// garder/insertions) mais de SQUELETTES différents (ancres différentes), sont désormais persistées
// comme deux connaissances DISTINCTES, jamais fusionnées : chacune reste reconnaissable.
test('v0.30.1. E-bis. deux formulations de MÊME FORME mais de SQUELETTES différents restent DISTINCTES et toutes deux reconnaissables', async () => {
  const { ecran, magasin } = monter();
  const formulation1 = induireTransformation([
    { entree: 'ZDIS alpha ZFIN', sortie: 'alpha' },
    { entree: 'ZDIS beta ZFIN', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...formulation1.transformation, exemples: formulation1.exemples, intention: 'ZINTENTION' });
  const formulation2 = induireTransformation([
    { entree: 'ZPARLE alpha ZTERMINE', sortie: 'alpha' },
    { entree: 'ZPARLE beta ZTERMINE', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...formulation2.transformation, exemples: formulation2.exemples, intention: 'ZINTENTION' });
  // La transformation RÉELLE (arité 1), appliquée à la valeur extraite -- même mécanisme que le cas
  // ZFAMILLE/féminin plus haut.
  const motZIntention = induireTransformation([
    { entree: 'alpha', sortie: 'alphaW' },
    { entree: 'beta', sortie: 'betaW' },
  ]);
  await ecran.confirmerTransformation({ ...motZIntention.transformation, exemples: motZIntention.exemples, intention: 'ZINTENTION' });
  const toutes = await magasin.lireTout('transformations');
  // Les deux SQUELETTES enseignés restent DEUX enregistrements distincts (leurs ancres diffèrent),
  // malgré une forme garder/insertions identique -- plus la transformation réelle, trois au total.
  assert.equal(toutes.filter((t) => t.intention === 'ZINTENTION').length, 3);
  const r1 = await ecran.tenterReconnaissanceTransformation('ZDIS gamma ZFIN');
  const r2 = await ecran.tenterReconnaissanceTransformation('ZPARLE gamma ZTERMINE');
  assert.equal(r1.reconnu, true);
  assert.equal(r1.ok, true);
  assert.equal(r1.texte, 'gammaW');
  assert.equal(r2.reconnu, true);
  assert.equal(r2.ok, true);
  assert.equal(r2.texte, 'gammaW');
});

test('v0.30.1. réenseigner EXACTEMENT le même squelette (mêmes exemples) sous la même intention ne crée pas de doublon', async () => {
  const { ecran, magasin } = monter();
  const formulation = induireTransformation([
    { entree: 'ZDIS alpha ZFIN', sortie: 'alpha' },
    { entree: 'ZDIS beta ZFIN', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...formulation.transformation, exemples: formulation.exemples, intention: 'ZINTENTION' });
  // Même squelette (mêmes ancres ZDIS/ZFIN), réenseigné séparément (un nouvel exemple, même famille).
  const memeSquelette = induireTransformation([
    { entree: 'ZDIS gamma ZFIN', sortie: 'gamma' },
    { entree: 'ZDIS delta ZFIN', sortie: 'delta' },
  ]);
  await ecran.confirmerTransformation({ ...memeSquelette.transformation, exemples: memeSquelette.exemples, intention: 'ZINTENTION' });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.filter((t) => t.intention === 'ZINTENTION').length, 1);
});

test('v0.30.1. même forme mais intentions DIFFÉRENTES : comportement v0.29/v0.30 préservé (jamais fusionnées, quel que soit le squelette)', async () => {
  const { ecran, magasin } = monter();
  const formulation1 = induireTransformation([
    { entree: 'ZDIS alpha ZFIN', sortie: 'alpha' },
    { entree: 'ZDIS beta ZFIN', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...formulation1.transformation, exemples: formulation1.exemples, intention: 'ZI1' });
  // Même squelette EXACT (mêmes ancres), mais une intention différente : deux connaissances distinctes
  // (déjà garanti par v0.29, non affecté par le nouveau critère de squelette).
  await ecran.confirmerTransformation({ ...formulation1.transformation, exemples: formulation1.exemples, intention: 'ZI2' });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.filter((t) => t.intention === 'ZI1' || t.intention === 'ZI2').length, 2);
});

test('v0.30.1. transformations SANS intention : dédoublonnage historique strictement inchangé', async () => {
  const { ecran, magasin } = monter();
  const neg1 = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  await ecran.confirmerTransformation({ ...neg1.transformation, exemples: neg1.exemples });
  // Même forme, exemples DIFFÉRENTS, toujours sans intention : fusion attendue (comportement historique,
  // jamais affecté par le critère de squelette puisqu'aucune intention n'est présente).
  const neg2 = induireTransformation([
    { entree: 'Tu chantes', sortie: 'Tu ne chantes pas' },
    { entree: 'Tu danses', sortie: 'Tu ne danses pas' },
  ]);
  await ecran.confirmerTransformation({ ...neg2.transformation, exemples: neg2.exemples });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.filter((t) => t.intention == null).length, 1);
});

test('v0.30.1. persistance après redémarrage : les deux squelettes distincts restent reconnaissables', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const formulation1 = induireTransformation([
    { entree: 'ZDIS alpha ZFIN', sortie: 'alpha' },
    { entree: 'ZDIS beta ZFIN', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...formulation1.transformation, exemples: formulation1.exemples, intention: 'ZINTENTION' });
  const formulation2 = induireTransformation([
    { entree: 'ZPARLE alpha ZTERMINE', sortie: 'alpha' },
    { entree: 'ZPARLE beta ZTERMINE', sortie: 'beta' },
  ]);
  await ecran.confirmerTransformation({ ...formulation2.transformation, exemples: formulation2.exemples, intention: 'ZINTENTION' });
  const motZIntention = induireTransformation([
    { entree: 'alpha', sortie: 'alphaW' },
    { entree: 'beta', sortie: 'betaW' },
  ]);
  await ecran.confirmerTransformation({ ...motZIntention.transformation, exemples: motZIntention.exemples, intention: 'ZINTENTION' });
  const { ecran: ecranRedemarre } = monter(magasin);
  const r1 = await ecranRedemarre.tenterReconnaissanceTransformation('ZDIS gamma ZFIN');
  const r2 = await ecranRedemarre.tenterReconnaissanceTransformation('ZPARLE gamma ZTERMINE');
  assert.equal(r1.ok, true);
  assert.equal(r1.texte, 'gammaW');
  assert.equal(r2.ok, true);
  assert.equal(r2.texte, 'gammaW');
});

// VALIDATION FINALE VISÉE (décision, point 6) : cas réel, sans Gemini/LFM2, preuve moteur local.
test('v0.30. F. cas réel : « Mets lent au féminin. » reconnu → « lente », moteur local, aucun marqueur Applique', async () => {
  const { ecran } = monter();
  const squeletteFeminin = induireTransformation([
    { entree: 'Mets petit au féminin .', sortie: 'petit' },
    { entree: 'Mets grand au féminin .', sortie: 'grand' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteFeminin.transformation, exemples: squeletteFeminin.exemples, intention: 'feminin' });
  const motFeminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  await ecran.confirmerTransformation({ ...motFeminin.transformation, exemples: motFeminin.exemples, intention: 'feminin' });
  // « lent » n'a jamais été vu dans le squelette, seulement comme mot isolé -- ici la phrase entière,
  // jamais tapée non plus, doit suffire.
  const r = await ecran.tenterReconnaissanceTransformation('Mets lent au féminin .');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'lente');
});

// Non-régression v0.29 : « Applique : » explicite reste inchangé, sans lien avec la reconnaissance.
test('v0.30. G. non-régression : appliquerTransformationLocale() explicite reste inchangé', async () => {
  const { ecran } = monter();
  const squeletteFeminin = induireTransformation([
    { entree: 'Mets petit au féminin .', sortie: 'petit' },
    { entree: 'Mets grand au féminin .', sortie: 'grand' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteFeminin.transformation, exemples: squeletteFeminin.exemples, intention: 'feminin' });
  const motFeminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  await ecran.confirmerTransformation({ ...motFeminin.transformation, exemples: motFeminin.exemples, intention: 'feminin' });
  const explicite = await ecran.appliquerTransformationLocale('lent', 'feminin');
  assert.equal(explicite.ok, true);
  assert.equal(explicite.texte, 'lente');
});

// Persistance après redémarrage (nouvel esprit sur le même magasin) : la reconnaissance ne dépend que
// des transformations persistées, jamais d'un état en mémoire propre à une session.
test('v0.30. H. persistance après redémarrage/rechargement (nouvel esprit sur le même magasin)', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const squeletteFeminin = induireTransformation([
    { entree: 'Mets petit au féminin .', sortie: 'petit' },
    { entree: 'Mets grand au féminin .', sortie: 'grand' },
  ]);
  await ecran.confirmerTransformation({ ...squeletteFeminin.transformation, exemples: squeletteFeminin.exemples, intention: 'feminin' });
  const motFeminin = induireTransformation([
    { entree: 'petit', sortie: 'petite' },
    { entree: 'grand', sortie: 'grande' },
  ]);
  await ecran.confirmerTransformation({ ...motFeminin.transformation, exemples: motFeminin.exemples, intention: 'feminin' });
  const { ecran: ecranRedemarre } = monter(magasin);
  const r = await ecranRedemarre.tenterReconnaissanceTransformation('Mets lent au féminin .');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'lente');
});

// ============================================================================ v0.32 -- APPRENTISSAGE DU RETRAIT D'AFFIXES
// Reprend exactement l'expérience réelle qui a échoué (intention « retirez », zamalotu=>malo /
// zaturotu=>turo), bout en bout via appliquerTransformationLocale() (le chemin réel « Applique : »).
test('v0.32. A. cas réel : intention "retirez", zamalotu=>malo / zaturotu=>turo, appliquée à un mot jamais vu (moteur local)', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'zamalotu', sortie: 'malo' },
    { entree: 'zaturotu', sortie: 'turo' },
  ]);
  assert.equal(r.ok, true);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples, intention: 'retirez' });
  const application = await ecran.appliquerTransformationLocale('zaneratu', 'retirez');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'nera');
});

// Une entrée qui ne respecte pas les affixes appris (ne commence pas par "za" ou ne finit pas par
// "tu") doit provoquer une ABSTENTION EXPLICITE, jamais un découpage aveugle par simple longueur.
test('v0.32. B. application d\'un retrait à une entrée qui ne respecte pas le préfixe/suffixe appris : abstention explicite', async () => {
  const { ecran } = monter();
  const r = induireTransformation([
    { entree: 'zamalotu', sortie: 'malo' },
    { entree: 'zaturotu', sortie: 'turo' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples, intention: 'retirez' });
  const sansPrefixe = await ecran.appliquerTransformationLocale('bonera', 'retirez');
  assert.equal(sansPrefixe.ok, false);
  assert.equal(sansPrefixe.raison, 'retrait_incompatible');
  const sansSuffixe = await ecran.appliquerTransformationLocale('zanerabo', 'retirez');
  assert.equal(sansSuffixe.ok, false);
  assert.equal(sansSuffixe.raison, 'retrait_incompatible');
});

test('v0.32. C. persistance après redémarrage d\'une transformation de type retrait', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const r = induireTransformation([
    { entree: 'zamalotu', sortie: 'malo' },
    { entree: 'zaturotu', sortie: 'turo' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples, intention: 'retirez' });
  const { ecran: ecranRedemarre } = monter(magasin);
  const application = await ecranRedemarre.appliquerTransformationLocale('zaneratu', 'retirez');
  assert.equal(application.ok, true);
  assert.equal(application.texte, 'nera');
});

test('v0.32. D. dédoublonnage : réenseigner à l\'identique une transformation retrait ne crée pas de doublon', async () => {
  const { ecran, magasin } = monter();
  const r = induireTransformation([
    { entree: 'zamalotu', sortie: 'malo' },
    { entree: 'zaturotu', sortie: 'turo' },
  ]);
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples, intention: 'retirez' });
  await ecran.confirmerTransformation({ ...r.transformation, exemples: r.exemples, intention: 'retirez' });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.filter((t) => t.intention === 'retirez').length, 1);
});

// Composition : une transformation de type « retrait » doit se fusionner trivialement avec
// elle-même (identité), exactement comme n'importe quelle autre transformation (déjà garanti pour
// « ajout » depuis le Lot 2, v0.28) -- aucun traitement particulier requis pour le nouveau type.
test('v0.32. E. composition : une transformation retrait se fusionne trivialement avec elle-même (identité)', () => {
  const retrait = induireTransformation([
    { entree: 'zamalotu', sortie: 'malo' },
    { entree: 'zaturotu', sortie: 'turo' },
  ]);
  assert.equal(retrait.ok, true);
  const fusion = fusionnerTransformations([retrait.transformation]);
  assert.equal(fusion.ok, true);
  assert.equal(appliquerTransformation(fusion.transformation, 'zaneratu'), 'nera');
});

// LIMITE PRÉ-EXISTANTE DÉCOUVERTE (SANS RAPPORT AVEC `type: retrait` -- voir rapport de continuité) :
// fusionnerTransformations() (Lot 2, v0.28) exige une égalité STRICTE de `interne[i]` entre TOUTES les
// transformations composées à chaque position -- y compris quand une seule d'entre elles porte un
// `interne` à cette position et que l'autre vaut simplement null (aucune opinion sur cette position).
// Ce test prouve que la limite est IDENTIQUE pour `ajout` (déjà là depuis le Lot 2, jamais testée
// jusqu'ici) et pour `retrait` (ce chantier) -- elle n'est donc PAS causée par `type: retrait` et ne
// déclenche pas la condition de STOP de la décision, mais elle est documentée ici tel quel plutôt que
// dissimulée par un test conçu pour l'éviter.
test('v0.32. LIMITE PRÉ-EXISTANTE (documentée, non corrigée) : composer une transformation portant `interne` à une position avec une autre qui laisse cette position à null échoue, pour ajout COMME pour retrait', () => {
  const retraitPhrase = induireTransformation([
    { entree: 'le zamalotu dort', sortie: 'le malo dort' },
    { entree: 'le zaturotu dort', sortie: 'le turo dort' },
  ]);
  const ajoutPhrase = induireTransformation([
    { entree: 'le malo dort', sortie: 'le maloZ dort' },
    { entree: 'le turo dort', sortie: 'le turoZ dort' },
  ]);
  const negation = induireTransformation([
    { entree: 'le malo dort', sortie: 'le malo ne dort pas' },
    { entree: 'le turo dort', sortie: 'le turo ne dort pas' },
  ]);
  assert.equal(retraitPhrase.ok, true);
  assert.equal(ajoutPhrase.ok, true);
  assert.equal(negation.ok, true);
  // Les DEUX échouent de la même façon (même raison, même position) : la limite est structurelle à
  // fusionnerTransformations(), pas une régression de ce chantier.
  const fusionRetrait = fusionnerTransformations([retraitPhrase.transformation, negation.transformation]);
  const fusionAjout = fusionnerTransformations([ajoutPhrase.transformation, negation.transformation]);
  assert.equal(fusionRetrait.ok, false);
  assert.equal(fusionAjout.ok, false);
  assert.equal(fusionRetrait.raison, fusionAjout.raison);
  assert.equal(fusionRetrait.position, fusionAjout.position);
});
