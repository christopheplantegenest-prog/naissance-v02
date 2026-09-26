// === DEBUT_TEST_PONT_INDUCTION_EXPERIENCES ===
// TESTS ROUGES SEULEMENT — aucune implémentation n'existe encore.
//
// Objectif : utiliser le vécu conservé dans B1 (table « experiences ») comme matière première du
// vrai induire() existant, SANS retaper de texte et SANS jamais déduire un négatif de l'absence de
// sélection. Une expérience non désignée par Christophe ne doit influencer ni les positifs, ni les
// négatifs — elle ne signifie rien.
//
// Fonction attendue (n'existe pas encore) : preparerEntreesInduction(magasin, { idsPositifs, idsNegatifs })
// → { positifs: [texteRecu...], negatifs: [texteRecu...] }, dans l'ordre des ids donnés, sans aucune
// transformation du texte. Emplacement proposé : app/langage/connaissances.js (colocalisée avec les
// autres fonctions B1 : enregistrerExperience, ajouterInterpretation — même table, même responsabilité
// « lire/écrire les expériences », jamais de logique d'induction dupliquée ici).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { magasinMemoireVive, enregistrerExperience } from '../app/langage/connaissances.js';
import { induire } from '../app/langage/induction.js';
import { apprendreGabaritType, chargerEsprit } from '../app/langage/esprit.js';
import { comprendre } from '../app/langage/comprendre.js';

// La fonction n'existe pas encore : cet import échouera (ou preparerEntreesInduction sera undefined),
// ce qui est le rouge attendu pour TOUTE cette phase.
let preparerEntreesInduction;
try {
  ({ preparerEntreesInduction } = await import('../app/langage/connaissances.js'));
} catch { /* import global déjà tenté ci-dessus ; conservé pour lisibilité */ }

// Famille SALUTATION (déjà validée sur téléphone lors de v0.17.6/0.17.7) : « salut » n'est
// INTERROGATIF nulle part dans le lexique, ne fait partie d'aucun gabarit VERIFICATION câblé —
// choisi précisément pour ne PAS entrer en collision avec la classification codée en dur de
// trouverType() (contrairement à « quel », déjà role INTERROGATIF, qui gagnerait avant tout
// gabaritType appris).
async function experiencesDeTest(magasin) {
  const e1 = await enregistrerExperience(magasin, {
    texteRecu: 'Salut, mon manteau est bleu.', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const e2 = await enregistrerExperience(magasin, {
    texteRecu: 'Salut, ma couleur est rouge.', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const e3 = await enregistrerExperience(magasin, {
    texteRecu: 'Mon manteau est bleu.', texteRepondu: 'Je ne sais pas.',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  const e4 = await enregistrerExperience(magasin, {
    texteRecu: 'Salut, mon vélo est cassé.', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  return { e1, e2, e3, e4 };
}

// ---------------------------------------------------------------- 1, 2 — positifs exacts
test('[ROUGE] une expérience désignée positive fournit exactement son texteRecu', async () => {
  const magasin = magasinMemoireVive();
  const { e1 } = await experiencesDeTest(magasin);
  const r = await preparerEntreesInduction(magasin, { idsPositifs: [e1.id], idsNegatifs: [] });
  assert.deepEqual(r.positifs, ['Salut, mon manteau est bleu.']);
});

test('[ROUGE] plusieurs positifs fournissent exactement leurs texteRecu, sans reconstruction', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2, e4 } = await experiencesDeTest(magasin);
  const r = await preparerEntreesInduction(magasin, { idsPositifs: [e1.id, e2.id, e4.id], idsNegatifs: [] });
  assert.deepEqual(r.positifs, ['Salut, mon manteau est bleu.', 'Salut, ma couleur est rouge.', 'Salut, mon vélo est cassé.']);
});

// ---------------------------------------------------------------- 3 — négatifs exacts
test('[ROUGE] une expérience désignée négative fournit exactement son texteRecu dans les négatifs', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e3 } = await experiencesDeTest(magasin);
  const r = await preparerEntreesInduction(magasin, { idsPositifs: [e1.id], idsNegatifs: [e3.id] });
  assert.deepEqual(r.negatifs, ['Mon manteau est bleu.']);
});

// ---------------------------------------------------------------- 4, 6 — non-sélection = rien
test('[ROUGE] une expérience non sélectionnée n\'apparaît ni dans les positifs ni dans les négatifs', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2, e3 } = await experiencesDeTest(magasin);
  // e2 n'est désignée NULLE PART : ni positif ni négatif.
  const r = await preparerEntreesInduction(magasin, { idsPositifs: [e1.id], idsNegatifs: [e3.id] });
  assert.ok(!r.positifs.includes('Salut, ma couleur est rouge.'));
  assert.ok(!r.negatifs.includes('Salut, ma couleur est rouge.'));
});

test('[ROUGE] GARDE ANTI-RÉGRESSION — aucun négatif désigné => negatifs est [], JAMAIS le complément', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2, e4 } = await experiencesDeTest(magasin);
  // e2 et e4 existent, ne sont PAS désignées comme négatifs : elles ne doivent JAMAIS s'y retrouver,
  // même si techniquement « tout le reste » du corpus. C'est le point précis que Christophe a corrigé.
  const r = await preparerEntreesInduction(magasin, { idsPositifs: [e1.id], idsNegatifs: [] });
  assert.deepEqual(r.negatifs, []);
});

// ---------------------------------------------------------------- 5, 13 — lecture seule, aucune copie
test('[ROUGE] aucune écriture nulle part : les 8 tables sont identiques avant/après', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e3 } = await experiencesDeTest(magasin);
  const avant = {};
  for (const t of ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences']) {
    avant[t] = JSON.stringify(await magasin.lireTout(t));
  }
  await preparerEntreesInduction(magasin, { idsPositifs: [e1.id], idsNegatifs: [e3.id] });
  for (const t of ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences']) {
    assert.equal(JSON.stringify(await magasin.lireTout(t)), avant[t], `la table ${t} ne doit pas avoir bougé`);
  }
});

test('[ROUGE] la source du texte reste B1 : aucune connaissance intermédiaire créée avant induction', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2 } = await experiencesDeTest(magasin);
  await preparerEntreesInduction(magasin, { idsPositifs: [e1.id, e2.id], idsNegatifs: [] });
  // Aucune nouvelle table, aucun nouvel objet « intermédiaire » : le seul effet doit être le retour
  // de la fonction, rien de plus. Vérifié par la table experiences elle-même, inchangée en nombre.
  assert.equal((await magasin.lireTout('experiences')).length, 4);
});

// ---------------------------------------------------------------- 7 — le VRAI induire(), pas de double
test('[ROUGE] le vrai induire() découvre une hypothèse à partir d\'entrées venues de B1', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2, e3 } = await experiencesDeTest(magasin);
  const { positifs, negatifs } = await preparerEntreesInduction(magasin, {
    idsPositifs: [e1.id, e2.id], idsNegatifs: [e3.id],
  });
  const rapport = induire(positifs, negatifs, {});
  assert.ok(rapport.hypotheses.length > 0, 'induire() doit trouver au moins une hypothèse sur ces entrées');
});

// ---------------------------------------------------------------- 11 — persistance normale
test('[ROUGE] la connaissance produite reste un gabaritType persistant NORMAL (mécanisme existant)', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2, e3 } = await experiencesDeTest(magasin);
  const { positifs, negatifs } = await preparerEntreesInduction(magasin, {
    idsPositifs: [e1.id, e2.id], idsNegatifs: [e3.id],
  });
  const rapport = induire(positifs, negatifs, {});
  const esprit = await chargerEsprit(magasin);
  const h = rapport.hypotheses[0];
  const res = await apprendreGabaritType(esprit, {
    candidats: h.candidats, gabarits: h.gabarits, signification: 'SALUTATION', exemples: h.couverture,
  });
  assert.equal(res.objet.statut, 'validee');
  const stocke = (await magasin.lireTout('gabaritsTypes')).find((g) => g.id === res.objet.id);
  assert.ok(stocke, 'la connaissance doit être persistée exactement comme pour tout autre gabaritType');
});

// ---------------------------------------------------------------- 12 — généralisation à du jamais-vu
test('[ROUGE] une phrase jamais vécue, jamais utilisée pour l\'induction, est reconnue via le gabarit appris', async () => {
  const magasin = magasinMemoireVive();
  const { e1, e2, e3 } = await experiencesDeTest(magasin);
  const { positifs, negatifs } = await preparerEntreesInduction(magasin, {
    idsPositifs: [e1.id, e2.id], idsNegatifs: [e3.id],
  });
  const rapport = induire(positifs, negatifs, {});
  let esprit = await chargerEsprit(magasin);
  const h = rapport.hypotheses[0];
  await apprendreGabaritType(esprit, {
    candidats: h.candidats, gabarits: h.gabarits, signification: 'SALUTATION', exemples: h.couverture,
  });
  esprit = await chargerEsprit(magasin); // relecture : gabaritsTypesAppris à jour
  const c = comprendre('Salut, mon prénom est Paul.', { lexique: esprit.lexique, gabaritsTypesAppris: esprit.gabaritsTypesAppris });
  assert.equal(c.type, 'SALUTATION');
});

// ---------------------------------------------------------------- 14 — jamais déclenché automatiquement
test('[STATIQUE-ROUGE] enregistrerExperience() ne référence ni preparerEntreesInduction ni induire', () => {
  const src = fs.readFileSync(new URL('../app/langage/connaissances.js', import.meta.url), 'utf8');
  const debut = src.indexOf('export async function enregistrerExperience');
  const fin = src.indexOf('export async function ajouterInterpretation');
  assert.ok(debut > 0 && fin > debut);
  const corps = src.slice(debut, fin);
  assert.ok(!corps.includes('induire'));
  assert.ok(!corps.includes('preparerEntreesInduction'));
});

test('[COMPORTEMENT] écrire une nouvelle expérience ne crée jamais de gabaritType tout seul', async () => {
  const magasin = magasinMemoireVive();
  await experiencesDeTest(magasin);
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
});

// ---------------------------------------------------------------- 15 — aucun regroupement automatique
test('[STATIQUE-ROUGE] la future fonction ne doit réimporter aucune primitive interne d\'induction.js', () => {
  // Garde-fou pour l'implémentation à venir : preparerEntreesInduction ne doit importer que ce qui
  // est déjà public et destiné à ça (induire, éventuellement passeFinale), jamais ngrammesDe/
  // candidatsEvalues/contientGabarit/cleGabarit — cela prouverait une réimplémentation locale de la
  // détection de régularité, pas un simple passe-plat de texte.
  const chemin = new URL('../app/langage/connaissances.js', import.meta.url);
  if (!fs.existsSync(chemin)) return;
  const src = fs.readFileSync(chemin, 'utf8');
  // « induire » lui-même est INTERDIT ici aussi (en CODE, pas dans les commentaires qui l'évoquent
  // en prose) : preparerEntreesInduction() est un pont de DONNÉES, pas un mécanisme d'induction —
  // c'est à l'appelant (le futur laboratoire) d'appeler induire(), jamais à cette fonction.
  const sansCommentaires = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const interdit of ['ngrammesDe', 'candidatsEvalues', 'contientGabarit', 'cleGabarit', 'induire', 'induction.js']) {
    assert.ok(!sansCommentaires.includes(interdit), `connaissances.js ne doit pas réimporter/réimplémenter/appeler ${interdit}`);
  }
});

// ---------------------------------------------------------------- 8, 9, 10 — fichiers garantis inchangés
// Garde-fou fort et sans ambiguïté : empreinte exacte des fichiers AVANT ce chantier. Toute
// modification, même d'une seule ligne, fera échouer ce test — qu'elle soit volontaire ou accidentelle.
const EMPREINTES_INCHANGEES = {
  // (induction.js n'est plus gardé ici : ce pin ne valait que pour la phase "tests rouges +
  // implémentation minimale de preparerEntreesInduction()", où ce fichier ne devait pas bouger.
  // Le chantier B3a ajoute précisément repererMotifs() à induction.js -- voir
  // tests/motifs-recurrents.test.mjs pour ses propres garde-fous.)
  'app/langage/comprendre.js': '97b9bb99cd52a566d1213c7713dcf689cf6ee39b0c0000cb34c1a64f48828535',
  'app/langage/esprit.js': '0d2f6c906f1a110829bfaa633ef94c1bc295009310e0bbae04a441aea7be2fe7',
  'app/main.js': '806d34f91a4c34d5da64f797f653d92c0392fbde99e26a7d08a36ecf82615f54',
  'app/langage/pont.js': 'c35b39da67b9877781a992c0f9336226f86187ba7c3923d646cddeb30acc4c74',
  // (ecran.js n'est plus gardé ici : ce pin ne valait que pour la phase "tests rouges +
  // implémentation minimale de preparerEntreesInduction()", où l'interface n'existait pas encore.
  // Le chantier suivant construit précisément cette interface dans ecran.js -- voir
  // tests/selection-induction-ecran.test.mjs pour ses propres garde-fous.)
};

for (const [chemin, empreinte] of Object.entries(EMPREINTES_INCHANGEES)) {
  test(`[GARDE] ${chemin} reste strictement inchangé pendant ce chantier`, () => {
    const contenu = fs.readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
    const reelle = crypto.createHash('sha256').update(contenu).digest('hex');
    assert.equal(reelle, empreinte, `${chemin} a été modifié -- interdit pendant ce chantier`);
  });
}
// === FIN_TEST_PONT_INDUCTION_EXPERIENCES ===
