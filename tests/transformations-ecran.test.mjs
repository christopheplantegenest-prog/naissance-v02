// Chantier « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026) -- ORCHESTRATION
// (langage/ecran.js) et PERSISTANCE (langage/connaissances.js). Bout en bout, sur le VRAI esprit
// partagé (chargerEsprit), comme tests/proposition-spontanee.test.mjs (v0.25) : preuves A, B, C, D
// demandées par la décision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { induireTransformation, appliquerTransformation } from '../app/langage/transformation.js';

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
