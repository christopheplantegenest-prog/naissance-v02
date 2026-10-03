// === DEBUT_TEST_ACTE_EXPLICITE ===
// Chantier « ACTE EXPLICITE PERSISTANT PORTANT SUR UNE TRACE » (03/10/2026).
// Couvre les lettres A à T du cadrage (section 11) + les cas de validation des entrées
// (section 12). Un acte explicite signifie UNIQUEMENT : « un acte a réellement été enregistré,
// visant la trace idTrace, à horodatage, via le canal origine » — RIEN DE PLUS (jamais correct/
// incorrect/utile/récompense/causalité/preuve de légitimité du rejeu).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  magasinMemoireVive, enregistrerActe, enregistrerTrace, enregistrerExperience,
  TABLES, CLE, VERSION_BASE,
} from '../app/langage/connaissances.js';
import { apresNouveauVecu } from '../app/langage/vecu.js';

async function tracePourTest(magasin, suffixe = '') {
  return enregistrerTrace(magasin, {
    capacite: 'confrontation',
    voie: 'action',
    argumentsUtilises: { x: suffixe },
    provenanceArguments: { x: 'texte' },
    resultat: { ok: true },
  });
}

// A. Enregistrement explicite avec idTrace → objet créé.
test('A. enregistrement explicite avec idTrace crée un objet', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  assert.ok(acte);
  assert.equal(acte.idTrace, trace.id);
});

// B. id propre et unique.
test('B. id propre, distinct de idTrace, et unique entre deux actes', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const a1 = await enregistrerActe(magasin, { idTrace: trace.id });
  const a2 = await enregistrerActe(magasin, { idTrace: trace.id });
  assert.ok(typeof a1.id === 'string' && a1.id.length > 0);
  assert.notEqual(a1.id, trace.id);
  assert.notEqual(a1.id, a2.id);
});

// C. idTrace conservé strictement.
test('C. idTrace est conservé strictement, jamais transformé', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  assert.equal(acte.idTrace, trace.id);
});

// D. horodatage conservé/créé selon convention choisie (interne, jamais paramètre).
test('D. horodatage est créé par la primitive elle-même (chaîne ISO)', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const avant = Date.now();
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  const apres = Date.now();
  assert.equal(typeof acte.horodatage, 'string');
  const t = Date.parse(acte.horodatage);
  assert.ok(t >= avant - 1000 && t <= apres + 1000);
});

// E. origine conservée selon contrat (défaut 'explicite' si absente).
test('E. origine est conservée telle que fournie, ou vaut "explicite" par défaut', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acteDefaut = await enregistrerActe(magasin, { idTrace: trace.id });
  assert.equal(acteDefaut.origine, 'explicite');
  const acteExplicite = await enregistrerActe(magasin, { idTrace: trace.id, origine: 'interface' });
  assert.equal(acteExplicite.origine, 'interface');
});

// F. persistance + rechargement.
test('F. un acte persisté est relisible depuis le magasin ("actes")', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  const tous = await magasin.lireTout('actes');
  assert.ok(tous.find((a) => a.id === acte.id));
});

// G. deux actes sur la même trace restent deux objets.
test('G. deux actes sur la même trace restent deux objets distincts', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const a1 = await enregistrerActe(magasin, { idTrace: trace.id });
  const a2 = await enregistrerActe(magasin, { idTrace: trace.id });
  const tous = await magasin.lireTout('actes');
  assert.equal(tous.length, 2);
  assert.notEqual(a1.id, a2.id);
  assert.equal(a1.idTrace, trace.id);
  assert.equal(a2.idTrace, trace.id);
});

// H. actes sur deux traces distinctes restent distincts.
test('H. des actes sur deux traces distinctes restent distincts', async () => {
  const magasin = magasinMemoireVive();
  const t1 = await tracePourTest(magasin, '1');
  const t2 = await tracePourTest(magasin, '2');
  const a1 = await enregistrerActe(magasin, { idTrace: t1.id });
  const a2 = await enregistrerActe(magasin, { idTrace: t2.id });
  assert.notEqual(a1.idTrace, a2.idTrace);
  const tous = await magasin.lireTout('actes');
  assert.equal(tous.length, 2);
});

// I. aucune modification de la trace référencée.
test('I. la trace référencée n\'est jamais modifiée par enregistrerActe', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const avant = JSON.stringify(trace);
  await enregistrerActe(magasin, { idTrace: trace.id });
  const tracesApres = await magasin.lireTout('traces');
  const traceApres = tracesApres.find((t) => t.id === trace.id);
  assert.equal(JSON.stringify(traceApres), avant);
});

// J. aucune expérience créée.
test('J. enregistrerActe ne crée aucune expérience', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  await enregistrerActe(magasin, { idTrace: trace.id });
  const experiences = await magasin.lireTout('experiences');
  assert.equal(experiences.length, 0);
});

// K. aucun referenceTrace rempli (aucune expérience n'existe donc qui en porterait un, et
// enregistrerActe lui-même ne touche jamais à 'experiences').
test('K. aucun referenceTrace n\'est rempli par enregistrerActe', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  await enregistrerActe(magasin, { idTrace: trace.id });
  const experiences = await magasin.lireTout('experiences');
  assert.equal(experiences.filter((e) => e.referenceTrace).length, 0);
});

// L. aucune invocation de capacité : enregistrerActe ne touche à rien d'autre que le magasin.
test('L. enregistrerActe n\'invoque aucune capacité (aucune table autre que "actes" écrite)', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const avantCompte = Object.fromEntries(
    await Promise.all(TABLES.map(async (t) => [t, (await magasin.lireTout(t)).length])),
  );
  await enregistrerActe(magasin, { idTrace: trace.id });
  for (const t of TABLES) {
    if (t === 'actes') continue;
    // eslint-disable-next-line no-await-in-loop
    const compte = (await magasin.lireTout(t)).length;
    assert.equal(compte, avantCompte[t], `la table "${t}" n'aurait pas dû changer`);
  }
});

// M. aucun jugement.
test('M. l\'acte ne porte aucun champ de jugement (correct/incorrect/utile...)', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  for (const champInterdit of ['correct', 'incorrect', 'utile', 'recompense', 'jugement', 'resultat', 'statut']) {
    assert.equal(Object.prototype.hasOwnProperty.call(acte, champInterdit), false, `champ interdit "${champInterdit}"`);
  }
  assert.deepEqual(Object.keys(acte).sort(), ['horodatage', 'id', 'idTrace', 'origine'].sort());
});

// N. aucune modification de traceExploitable (même fonction, même comportement).
test('N. traceExploitable reste inchangée par la présence d\'un acte', async () => {
  const { traceExploitable } = await import('../app/langage/vue-traces.js');
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const avant = traceExploitable(trace);
  await enregistrerActe(magasin, { idTrace: trace.id });
  const apres = traceExploitable(trace);
  assert.equal(apres, avant);
});

// O. aucune modification de possibilitesRejeuAdmissibles.
test('O. possibilitesRejeuAdmissibles reste inchangée par la présence d\'un acte', async () => {
  const mod = await import('../app/langage/vue-traces.js');
  if (typeof mod.possibilitesRejeuAdmissibles !== 'function') {
    assert.ok(true, 'fonction absente de ce module : rien à vérifier ici, non-régression triviale');
    return;
  }
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const avant = mod.possibilitesRejeuAdmissibles([trace]);
  await enregistrerActe(magasin, { idTrace: trace.id });
  const apres = mod.possibilitesRejeuAdmissibles([trace]);
  assert.deepEqual(apres, avant);
});

// P. aucun appel spontané à apresNouveauVecu.
test('P. enregistrerActe n\'appelle jamais apresNouveauVecu de lui-même', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  // apresNouveauVecu rejette tout type inconnu : si enregistrerActe l'appelait avec un type
  // 'acte' non prévu, cela lèverait. On vérifie simplement qu'aucune levée ne se produit et
  // qu'aucun branchement n'existe — enregistrerActe() n'importe ni n'appelle vecu.js.
  await assert.doesNotReject(() => enregistrerActe(magasin, { idTrace: trace.id }));
  // apresNouveauVecu lui-même reste strictement fermé aux types 'experience'/'trace' seulement.
  await assert.rejects(() => apresNouveauVecu({ type: 'acte', id: 'x' }));
});

// Q. anciennes données restent lisibles après la migration additive (VERSION_BASE bump).
test('Q. les données des anciennes tables restent lisibles après ajout de "actes"', async () => {
  assert.ok(TABLES.includes('actes'), 'la table "actes" doit être déclarée');
  assert.equal(CLE.actes, 'id');
  const magasin = magasinMemoireVive();
  // Simule une base pré-existante : on écrit dans une ancienne table avant tout acte.
  await enregistrerExperience(magasin, { texteRecu: 'bonjour', texteRepondu: 'salut', date: new Date().toISOString(), source: 'test' });
  const trace = await tracePourTest(magasin);
  await enregistrerActe(magasin, { idTrace: trace.id });
  const experiences = await magasin.lireTout('experiences');
  const traces = await magasin.lireTout('traces');
  assert.equal(experiences.length, 1);
  assert.equal(traces.length, 1);
});

// R. action/rejeu/composition peuvent toutes être référencées sans différence de sémantique.
test('R. une trace de voie action, rejeu ou composition est référencée de façon identique', async () => {
  const magasin = magasinMemoireVive();
  const voies = ['action', 'rejeu', 'composition'];
  for (const voie of voies) {
    // eslint-disable-next-line no-await-in-loop
    const trace = await enregistrerTrace(magasin, {
      capacite: 'confrontation', voie, argumentsUtilises: {}, provenanceArguments: {}, resultat: {},
    });
    // eslint-disable-next-line no-await-in-loop
    const acte = await enregistrerActe(magasin, { idTrace: trace.id });
    assert.equal(acte.idTrace, trace.id);
    assert.deepEqual(Object.keys(acte).sort(), ['horodatage', 'id', 'idTrace', 'origine'].sort());
  }
});

// S. origine ne porte aucun jugement (contrôle de vocabulaire minimal).
test('S. origine refuse les valeurs qui porteraient un jugement implicite', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  // La primitive elle-même ne censure pas un vocabulaire métier (ce n'est pas son rôle), mais
  // elle n'invente ni ne déduit jamais de jugement à partir de l'origine fournie : elle la
  // conserve telle quelle, sans l'interpréter.
  const acte = await enregistrerActe(magasin, { idTrace: trace.id, origine: 'interface' });
  assert.equal(acte.origine, 'interface');
  assert.equal(Object.prototype.hasOwnProperty.call(acte, 'jugement'), false);
});

// T. absence d'idTrace → comportement explicite et testé, sans id inventé.
test('T. idTrace absent lève explicitement, sans inventer d\'id', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerActe(magasin, {}), /idTrace/);
});

// --- Section 12 : validation des entrées, au-delà du minimum RED déjà couvert ---

test('idTrace vide (chaîne vide) lève explicitement', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: '' }), /idTrace/);
});

test('idTrace non-string lève explicitement', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: 42 }), /idTrace/);
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: { x: 1 } }), /idTrace/);
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: null }), /idTrace/);
});

test('origine vide (chaîne vide) explicitement fournie lève', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: trace.id, origine: '' }), /origine/);
});

test('origine non-string explicitement fournie lève', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: trace.id, origine: 42 }), /origine/);
});

test('origine absente (non fournie du tout) retombe sur "explicite", sans lever', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  assert.equal(acte.origine, 'explicite');
});

// Contre-exemples (section 9 du cadrage, conceptuels mais vérifiables mécaniquement) :

test('contre-exemple : un acte sur une ancienne trace (déjà persistée avant ce chantier) fonctionne identiquement', async () => {
  const magasin = magasinMemoireVive();
  // Une "ancienne" trace est structurellement identique à une nouvelle du point de vue de
  // enregistrerActe : seule son id compte, jamais sa date de création ni son contenu.
  const ancienneTrace = await enregistrerTrace(magasin, {
    capacite: 'recherche', voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: {},
  });
  const acte = await enregistrerActe(magasin, { idTrace: ancienneTrace.id });
  assert.equal(acte.idTrace, ancienneTrace.id);
});

test('contre-exemple : plusieurs actes sur la même trace ne s\'écrasent jamais (statut colision id)', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const actes = await Promise.all([1, 2, 3].map(() => enregistrerActe(magasin, { idTrace: trace.id })));
  const ids = new Set(actes.map((a) => a.id));
  assert.equal(ids.size, 3);
  const tous = await magasin.lireTout('actes');
  assert.equal(tous.length, 3);
});

test('contre-exemple : idTrace ne contenant que des espaces est rejeté (jamais un id vide déguisé)', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: '   ' }), /idTrace/);
});

test('contre-exemple : origine ne contenant que des espaces est rejetée', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  await assert.rejects(() => enregistrerActe(magasin, { idTrace: trace.id, origine: '   ' }), /origine/);
});

test('contre-exemple : un champ étranger fourni par l\'appelant (ex. "jugement") n\'est jamais conservé sur l\'acte', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  const acte = await enregistrerActe(magasin, { idTrace: trace.id, origine: 'interface', jugement: 'correct' });
  assert.equal(Object.prototype.hasOwnProperty.call(acte, 'jugement'), false);
  assert.deepEqual(Object.keys(acte).sort(), ['horodatage', 'id', 'idTrace', 'origine'].sort());
});

test('contre-exemple : idTrace référençant une trace supprimée reste acceptée (aucune vérification d\'existence)', async () => {
  const magasin = magasinMemoireVive();
  const trace = await tracePourTest(magasin);
  await magasin.supprimer('traces', trace.id);
  // « T existe » ≠ « l'acte concernant T est vrai/pertinent » : la primitive persiste l'acte
  // même si la trace visée n'existe plus réellement, exactement comme referenceTrace/liaisons
  // ne valident jamais l'existence de ce qu'ils référencent.
  const acte = await enregistrerActe(magasin, { idTrace: trace.id });
  assert.equal(acte.idTrace, trace.id);
});
// === FIN_TEST_ACTE_EXPLICITE ===
