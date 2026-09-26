// === DEBUT_TEST_SAUVEGARDE_COMPLETE ===
// TESTS ROUGES D'ABORD — v0.17.15, feu vert « SAUVEGARDE COMPLÈTE DE NAISSANCE ».
//
// Objectif : un fichier de sauvegarde unique couvrant naissance-memoire ET naissance-langage,
// versionné séparément de l'ancien format (transfert.js), sans jamais le casser. Import ATOMIQUE
// par base (remplacerTout natif, tout ou rien) + filet entre les deux bases (snapshot avant/rollback
// si la seconde base échoue après que la première a déjà été remplacée).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerIdentite } from '../app/esprit/identite.js';
import {
  magasinMemoireVive, enregistrerExperience, ajouterInterpretation, TABLES as TABLES_LANGAGE,
} from '../app/langage/connaissances.js';
import {
  FORMAT_SAUVEGARDE, SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete,
  importerSauvegardeComplete, migrerDonnees,
} from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';

const sauvegardeJs = readFileSync(new URL('../app/memoire/sauvegarde.js', import.meta.url), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const connaissancesJs = readFileSync(new URL('../app/langage/connaissances.js', import.meta.url), 'utf8');
const maintenant = new Date('2026-09-26T14:00:00Z');

function trier(liste, cle) {
  return liste.slice().sort((a, b) => String(a[cle]).localeCompare(String(b[cle])));
}

function etatMemoire(m) {
  return m.exporterDonnees();
}
async function etatLangage(magasin) {
  const sortie = {};
  for (const t of TABLES_LANGAGE) sortie[t] = await magasin.lireTout(t);
  return sortie;
}

// --------------------------------------------------------------- construction d'un état A complet
async function construireEtatA() {
  const magasinMemoire = creerMagasinMemoire();
  const memoire = creerMemoire(magasinMemoire);
  await memoire.naitre(creerIdentite({ personne: 'Christophe 😀', date: 'd' }), '2026-09-16T09:00:00Z');
  await memoire.ajouterEchange({ question: 'Bibendumesque ?', reponse: 'Je ne sais pas.', moteur: 'm', dateQuestion: 'a', dateReponse: 'b' });
  await memoire.ecrireSouvenirs([{ id: 's1', texte: 'Aime le café « corsé »', statut: 'actif' }]);
  await memoire.ajouterResume({ id: 'r1', de: 1, a: 2, texte: 'résumé', cree: 'd' });
  await memoire.ajouterAction({ id: 'a1', date: 'd', messageId: 1, nom: 'retenir', parametres: {}, niveau: 1, statut: 'executee', resultat: { ok: true }, moteur: 'm' });

  const magasinLangage = magasinMemoireVive();
  await magasinLangage.ecrire('faits', { cle: 'moi|couleur', sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await magasinLangage.ecrire('lexique', { mot: 'bibendumesque', role: 'adjectif', relation: null });
  await magasinLangage.ecrire('patrons', { id: 'p1', relation: 'possession', sujet: 'moi', gabarit: ['x'], origine: 'test' });
  await magasinLangage.ecrire('journal', { id: 'j1', phrase: 'phrase incomprise', etat: 'incompris', fois: 1, derniere: 'd' });
  await magasinLangage.ecrire('proprietes', { cle: 'voiture|genre', mot: 'voiture', propriete: 'genre', valeur: 'féminin', origine: 'test' });
  await magasinLangage.ecrire('regles', { id: 'g1', role: 'r', conditions: [], resultat: 'x', origine: 'test', statut: 'actif' });
  await magasinLangage.ecrire('gabaritsTypes', { id: 't1', candidats: [], gabarits: [], signification: 'ceci signifie cela', origine: 'induction', statut: 'actif' });
  const exp = await enregistrerExperience(magasinLangage, {
    texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne sais pas.', date: '2026-09-26T10:01:00.000Z',
    source: 'laboratoire', referenceMemoire: { idQuestion: 1, idReponse: 2 },
  });
  await ajouterInterpretation(magasinLangage, exp.id, { origine: 'comprendre', donnees: { etat: 'incompris', motsInconnus: ['bibendumesque'] } });
  await ajouterInterpretation(magasinLangage, exp.id, { origine: 'induction', donnees: { motif: 'mot:bibendumesque' } });

  return { memoire, magasinMemoire, magasinLangage };
}

// --------------------------------------------------------------------- 1 — état A -> B, égalité
test('[ROUGE] état A -> export complet -> environnement neuf -> import -> état B, égal table par table', async () => {
  const { memoire, magasinLangage } = await construireEtatA();
  const avantMemoire = await etatMemoire(memoire);
  const avantLangage = await etatLangage(magasinLangage);

  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true);

  const memoireNeuve = creerMemoire(creerMagasinMemoire());
  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: memoireNeuve, magasinLangage: langageNeuf, donnees: lu.donnees });

  const apresMemoire = await etatMemoire(memoireNeuve);
  const apresLangage = await etatLangage(langageNeuf);
  for (const t of TABLES_MEMOIRE) assert.deepEqual(trier(apresMemoire[t], TABLES_MEMOIRE_CLE(t)), trier(avantMemoire[t], TABLES_MEMOIRE_CLE(t)), `naissance-memoire/${t}`);
  for (const t of TABLES_LANGAGE) assert.deepEqual(trier(apresLangage[t], TABLES_LANGAGE_CLE(t)), trier(avantLangage[t], TABLES_LANGAGE_CLE(t)), `naissance-langage/${t}`);
});

function TABLES_MEMOIRE_CLE(t) { return { journal: 'id', souvenirs: 'id', resumes: 'id', cles: 'cle', actions: 'id' }[t]; }
function TABLES_LANGAGE_CLE(t) { return { faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id', experiences: 'id' }[t]; }

// --------------------------------------------------------------------- 2 — TEST FONDAMENTAL B1
test('[ROUGE][FONDAMENTAL] une expérience B1 et TOUTES ses interprétations survivent exactement à export puis import dans un magasin neuf', async () => {
  const magasinLangage = magasinMemoireVive();
  const exp = await enregistrerExperience(magasinLangage, {
    texteRecu: 'Quelle est ma bibendumesque ?', texteRepondu: 'Je ne sais pas encore.',
    date: '2026-09-26T10:04:00.000Z', source: 'laboratoire', referenceMemoire: { idQuestion: 3, idReponse: 4 },
  });
  await ajouterInterpretation(magasinLangage, exp.id, { origine: 'comprendre', donnees: { etat: 'partiel', motsInconnus: ['bibendumesque'] } });
  await ajouterInterpretation(magasinLangage, exp.id, { origine: 'induction', donnees: { motif: 'mot:bibendumesque', couverture: 2 } });
  const avant = (await magasinLangage.lireTout('experiences')).find((e) => e.id === exp.id);
  assert.equal(avant.interpretations.length, 2, 'fixture : deux interprétations avant export');

  const memoire = creerMemoire(creerMagasinMemoire());
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });

  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: langageNeuf, donnees: lu.donnees });
  const apres = (await langageNeuf.lireTout('experiences')).find((e) => e.id === exp.id);
  assert.deepEqual(apres, avant, "l'expérience B1 ET ses deux interprétations doivent être strictement identiques après le cycle export/import");
});

// --------------------------------------------------------------------- 3 — sauvegarde vide
test('[ROUGE] sauvegarde vide : export puis import sans erreur, tout reste vide', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true);
  const memoireNeuve = creerMemoire(creerMagasinMemoire());
  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: memoireNeuve, magasinLangage: langageNeuf, donnees: lu.donnees });
  assert.equal(await memoireNeuve.compterMessages(), 0);
  for (const t of TABLES_LANGAGE) assert.deepEqual(await langageNeuf.lireTout(t), []);
});

// --------------------------------------------------------------------- 4 — Unicode préservé
test('[ROUGE] les caractères Unicode (emoji, accents, guillemets) survivent exactement au cycle complet', async () => {
  const { memoire, magasinLangage } = await construireEtatA();
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  const memoireNeuve = creerMemoire(creerMagasinMemoire());
  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: memoireNeuve, magasinLangage: langageNeuf, donnees: lu.donnees });
  const identite = await memoireNeuve.identite();
  assert.equal(identite.noyau.personne, 'Christophe 😀');
  const souvenir = (await memoireNeuve.souvenirs()).find((s) => s.id === 's1');
  assert.equal(souvenir.texte, 'Aime le café « corsé »');
  const propriete = (await langageNeuf.lireTout('proprietes')).find((p) => p.cle === 'voiture|genre');
  assert.equal(propriete.valeur, 'féminin');
});

// --------------------------------------------------------------------- 5 — mécanisme de migration (générique, prouvé indépendamment)
test('[ROUGE] migrerDonnees complète les tables absentes par des tableaux vides SANS toucher aux tables présentes (mécanisme prêt pour une vraie version antérieure future -- aucune n\'existe encore réellement, schéma courant = 1)', () => {
  const partiel = { faits: [{ cle: 'x' }] };
  const complete = migrerDonnees(partiel, TABLES_LANGAGE, 0);
  assert.deepEqual(complete.faits, [{ cle: 'x' }], 'la table présente ne doit jamais être modifiée par la migration');
  for (const t of TABLES_LANGAGE) if (t !== 'faits') assert.deepEqual(complete[t], [], `table absente « ${t} » doit être complétée par un tableau vide, jamais inventée`);
});
test('[ROUGE] migrerDonnees ne touche à RIEN pour le schéma COURANT (une table manquante y reste manquante, ce n\'est pas une migration légitime)', () => {
  const partiel = { faits: [{ cle: 'x' }] };
  const resultat = migrerDonnees(partiel, TABLES_LANGAGE, SCHEMA_SAUVEGARDE);
  assert.deepEqual(Object.keys(resultat), ['faits'], 'pour le schéma courant, aucune complétion : un fichier incomplet doit être un refus, pas une invention');
});

// --------------------------------------------------------------------- 6 — refus : format invalide / corrompu / futur
test('[ROUGE] refus propre : pas du JSON, mauvais format, schéma futur, empreinte falsifiée, table manquante', async () => {
  const { memoire, magasinLangage } = await construireEtatA();
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });

  assert.match((await lireSauvegardeComplete('pas du json {{{', { tablesMemoire: TABLES_MEMOIRE })).erreur, /pas un fichier JSON/);
  assert.match((await lireSauvegardeComplete('{"format":"naissance"}', { tablesMemoire: TABLES_MEMOIRE })).erreur, /pas une sauvegarde complète/);
  assert.match((await lireSauvegardeComplete({ ...fichier.objet, schema: 99 }, { tablesMemoire: TABLES_MEMOIRE })).erreur, /plus récente/);

  const abime = JSON.parse(fichier.contenu);
  abime.donnees.langage.experiences = [];
  assert.match((await lireSauvegardeComplete(abime, { tablesMemoire: TABLES_MEMOIRE })).erreur, /empreinte/);

  const incomplet = JSON.parse(JSON.stringify(fichier.objet));
  delete incomplet.donnees.langage.gabaritsTypes;
  incomplet.empreinte = await empreinte(JSON.stringify(incomplet.donnees)); // empreinte recalculée pour isoler le SEUL cas testé ici : une table manquante, pas une empreinte falsifiée (déjà testé juste au-dessus)
  assert.match((await lireSauvegardeComplete(incomplet, { tablesMemoire: TABLES_MEMOIRE })).erreur, /incomplet/);
});

// --------------------------------------------------------------------- 7 — échec volontaire AU MILIEU + restauration
test('[ROUGE] un échec du remplacement de naissance-memoire APRÈS celui de naissance-langage restaure naissance-langage à son état précédent -- naissance-memoire n\'est jamais touchée', async () => {
  const { memoire, magasinLangage } = await construireEtatA();
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });

  // Cible du test : un AUTRE couple mémoire/langage, dont le langage a un vécu DIFFÉRENT de celui du
  // fichier importé -- pour prouver sans ambiguïté qu'il est restauré à SON état à lui, pas à celui
  // du fichier ni laissé dans l'état intermédiaire (déjà remplacé, jamais annulé).
  const memoireCible = creerMemoire(creerMagasinMemoire());
  const langageCible = magasinMemoireVive();
  await langageCible.ecrire('faits', { cle: 'avant|test', sujet: 'avant', relation: 'test', valeur: 'present-avant-import' });
  const langageAvant = await etatLangage(langageCible);

  // Espion qui délègue réellement à langageCible mais ENREGISTRE chaque appel à remplacerTout, pour
  // prouver que langage a bien été ÉCRIT UNE PREMIÈRE FOIS (nouvelles données) puis RESTAURÉ (état
  // précédent) -- et non pas simplement jamais touché parce que l'échec serait survenu AVANT elle
  // (ce qui donnerait le même état final sans prouver aucun rollback réel).
  const appelsRemplacerTout = [];
  const langageEspion = {
    ...langageCible,
    remplacerTout: async (d) => { appelsRemplacerTout.push(d); return langageCible.remplacerTout(d); },
  };

  let appele = false;
  const memoireEspion = {
    exporterDonnees: () => memoireCible.exporterDonnees(),
    remplacerDonnees: async () => { appele = true; throw new Error('échec volontaire de test au milieu de l\'import'); },
  };

  await assert.rejects(
    importerSauvegardeComplete({ memoire: memoireEspion, magasinLangage: langageEspion, donnees: lu.donnees }),
    /échec volontaire de test/,
  );
  assert.equal(appele, true, 'le second remplacement (naissance-memoire) doit bien avoir été tenté');
  assert.equal(appelsRemplacerTout.length, 2, 'naissance-langage doit être remplacée UNE PREMIÈRE FOIS (nouvelles données) PUIS restaurée (rollback) -- deux appels réels, jamais zéro ni un seul');
  assert.deepEqual(appelsRemplacerTout[0], lu.donnees.langage, 'le premier appel doit écrire les NOUVELLES données du fichier importé');
  assert.deepEqual(appelsRemplacerTout[1], langageAvant, 'le second appel (rollback) doit restaurer EXACTEMENT l\'état précédent capturé avant tout import');
  const langageApres = await etatLangage(langageCible);
  assert.deepEqual(langageApres, langageAvant, 'naissance-langage doit être revenue à SON état précédent, pas laissée avec les données du fichier importé');
  assert.equal((await memoireCible.compterMessages()), 0, 'naissance-memoire réelle ne doit jamais avoir été touchée : l\'échec a eu lieu avant toute écriture réelle');
});

// --------------------------------------------------------------------- 8 — aucune clé API / donnée sensible
test('[ROUGE] le module de sauvegarde ne lit ni ne référence jamais reglages/stockage.js, localStorage ou une clé API', () => {
  const corps = sansCommentaires(sauvegardeJs);
  for (const interdit of ['reglages/stockage', 'localStorage', "'cle'", 'fournisseur', 'gemini']) {
    assert.ok(!corps.includes(interdit), `sauvegarde.js ne doit jamais référencer (hors commentaires) : ${interdit}`);
  }
});
test('[ROUGE] le fichier produit ne contient QUE memoire et langage, aucune autre clé (donc jamais de réglages)', async () => {
  const { memoire, magasinLangage } = await construireEtatA();
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  assert.deepEqual(Object.keys(fichier.objet.donnees).sort(), ['langage', 'memoire']);
});

// --------------------------------------------------------------------- 9 — export ne mute pas les sources ; import n'invente rien
test('[ROUGE] construireSauvegardeComplete ne modifie jamais les magasins sources', async () => {
  const { memoire, magasinLangage } = await construireEtatA();
  const avantMemoire = await etatMemoire(memoire);
  const avantLangage = await etatLangage(magasinLangage);
  const meta = await memoire.meta();
  await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  assert.deepEqual(await etatMemoire(memoire), avantMemoire);
  assert.deepEqual(await etatLangage(magasinLangage), avantLangage);
});
test('[ROUGE] importerSauvegardeComplete n\'ajoute aucun champ historique fabriqué (pas de date de restauration injectée dans une ligne)', async () => {
  const magasinLangage = magasinMemoireVive();
  const exp = await enregistrerExperience(magasinLangage, {
    texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne sais pas.', date: '2026-09-26T10:01:00.000Z', source: 'laboratoire',
  });
  await ajouterInterpretation(magasinLangage, exp.id, { origine: 'comprendre', donnees: { etat: 'incompris' } });
  const avant = (await magasinLangage.lireTout('experiences'))[0];
  const memoire = creerMemoire(creerMagasinMemoire());
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: '0.17.15', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: langageNeuf, donnees: lu.donnees });
  const apres = (await langageNeuf.lireTout('experiences'))[0];
  assert.deepEqual(apres, avant, "aucun champ ne doit être ajouté, retiré ou daté différemment par l'import");
});

// --------------------------------------------------------------------- 10 — atomicité native par base (remplacerTout ajouté à connaissances.js)
test('[STATIQUE] remplacerTout() de naissance-langage (IndexedDB) utilise UNE SEULE transaction sur TOUTES les tables (atomicité native, comme magasin.js)', () => {
  const debut = connaissancesJs.indexOf('async remplacerTout(donnees) {');
  assert.ok(debut > 0, 'remplacerTout doit être défini dans connaissances.js (magasin IndexedDB)');
  const fin = connaissancesJs.indexOf('},', debut);
  const corps = connaissancesJs.slice(debut, fin);
  assert.match(corps, /db\.transaction\(TABLES, 'readwrite'\)/, 'une seule transaction couvrant TOUTES les tables, pas une par table');
});

// --------------------------------------------------------------------- garde-fous : fichiers non censés changer dans ce chantier
const EMPREINTES_INCHANGEES = {
  'app/langage/induction.js': '63f968839efc77dee854e3f2f9eff65a9c257855ec1e76fd81e3bd2cd67306ff',
  'app/memoire/magasin.js': 'c2ff6d68f0d5734cd0afc3615324754ae634bb9b2434394805ee2686a80ccf77',
  'app/memoire/transfert.js': '9d2397cfb42276334d71d808ac4276489cdc4b254ea814a473fd7aa4acabaf8f',
  'app/langage/esprit.js': '0d2f6c906f1a110829bfaa633ef94c1bc295009310e0bbae04a441aea7be2fe7',
  'app/langage/comprendre.js': '97b9bb99cd52a566d1213c7713dcf689cf6ee39b0c0000cb34c1a64f48828535',
};
for (const [chemin, empreinte] of Object.entries(EMPREINTES_INCHANGEES)) {
  test(`[GARDE] ${chemin} reste strictement inchangé pendant ce chantier`, () => {
    const contenu = readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
    const reelle = crypto.createHash('sha256').update(contenu).digest('hex');
    assert.equal(reelle, empreinte, `${chemin} a été modifié -- interdit pendant ce chantier`);
  });
}

// Contenu EXACT des fonctions de connaissances.js qui existaient AVANT ce chantier : jamais touchées,
// seule une NOUVELLE méthode (remplacerTout) a été ajoutée aux magasins.
test('[GARDE] enregistrerExperience() et ajouterInterpretation() restent un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attenduEnregistrer = `export async function enregistrerExperience(magasin, { texteRecu, texteRepondu, date, source, referenceMemoire = null }) {
  const objet = {
    id: \`experience-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`,
    texteRecu: String(texteRecu),
    texteRepondu: String(texteRepondu),
    date,
    source,
    referenceMemoire: referenceMemoire
      ? { idQuestion: referenceMemoire.idQuestion, idReponse: referenceMemoire.idReponse }
      : null,
    interpretations: [],
  };
  await magasin.ecrire('experiences', objet);
  return objet;
}`;
  assert.ok(connaissancesJs.includes(attenduEnregistrer));
  const attenduInterpreter = `export async function ajouterInterpretation(magasin, idExperience, { origine, donnees }) {
  const toutes = await magasin.lireTout('experiences');
  const experience = toutes.find((e) => e.id === idExperience);
  if (!experience) throw new Error(\`Aucune expérience « \${idExperience} » à interpréter.\`);
  const interpretation = {
    id: \`interpretation-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`,
    dateInterpretation: new Date().toISOString(),
    origine,
    donnees,
  };
  const miseAJour = { ...experience, interpretations: [...experience.interpretations, interpretation] };
  await magasin.ecrire('experiences', miseAJour);
  return miseAJour;
}`;
  assert.ok(connaissancesJs.includes(attenduInterpreter));
});
// === FIN_TEST_SAUVEGARDE_COMPLETE ===
