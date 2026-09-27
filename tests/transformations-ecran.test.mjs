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
