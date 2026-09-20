import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMOIRE_TEST, QUESTIONS, chercherFait, GRAINE_COMPARAISON } from '../app/moteur-local/solutions-memoire.js';
import { APPROCHES, preparerApproche } from '../app/moteur-local/solutions-approches.js';
import { executerEssai, planComplet, rapportComparatif, verifierAjouts, mesurer } from '../app/moteur-local/solutions-banc.js';

test('mémoire de test : isolée, 12 faits contrôlés, tous les types demandés', () => {
  assert.equal(MEMOIRE_TEST.length, 12);
  const relations = MEMOIRE_TEST.map((f) => f.relation);
  for (const attendu of ['prenom', 'nom_ia', 'ville', 'couleur_preferee', 'nombre_enfants', 'prenom_fils', 'plat_prefere', 'evenement_recent']) {
    assert.ok(relations.includes(attendu), `type ${attendu} présent`);
  }
  // Deux faits volontairement proches, pour permettre une confusion observable.
  const couleurs = MEMOIRE_TEST.filter((f) => f.relation === 'couleur_preferee');
  assert.equal(couleurs.length, 3);
  assert.deepEqual(couleurs.map((f) => f.valeur).sort(), ['bleu', 'rouge', 'vert']);
  assert.equal(chercherFait('Christophe', 'couleur_preferee').valeur, 'bleu');
  assert.equal(chercherFait('Levana', 'couleur_preferee').valeur, 'vert');
  assert.equal(chercherFait('Christophe', 'pointure'), null, 'information absente : introuvable, déterministe');
});

test('questions : neuf catégories, trois personnes grammaticales, trois sans réponse', () => {
  assert.equal(QUESTIONS.length, 12);
  assert.equal(QUESTIONS.filter((q) => q.categorie === 'absente').length, 3);
  for (const p of ['premiere', 'deuxieme', 'troisieme']) {
    assert.ok(QUESTIONS.some((q) => q.personne === p), `${p} présente`);
  }
  assert.ok(QUESTIONS.every((q) => q.sujet && q.relation), 'chaque question dit quoi chercher, sans inférence');
});

test('les sept approches sont bien distinctes dans ce qu’elles envoient au modèle', () => {
  const q = QUESTIONS.find((x) => x.id === 'couleur-1re');
  const invites = {};
  for (const a of Object.keys(APPROCHES)) {
    const p = preparerApproche(a, q, MEMOIRE_TEST);
    invites[a] = p.etapes.map((e) => e.elements.map((x) => x.texte).join('|')).join('||');
  }
  assert.match(invites.temoin, /Informations vraies sur Christophe/);
  assert.match(invites.preparation, /INTERLOCUTEUR : Christophe[\s\S]*SUJET DE LA QUESTION : Christophe[\s\S]*FAIT DISPONIBLE : bleu/);
  assert.match(invites.contrainte, /UNIQUEMENT par la valeur demandée/);
  assert.match(invites.representation, /SUJET=Christophe[\s\S]*RELATION=couleur_preferee[\s\S]*VALEUR=bleu/);
  assert.match(invites.protege, /Valeur exacte à transmettre.*« bleu »/);
  assert.equal(preparerApproche('etapes', q, MEMOIRE_TEST).etapes.length, 3, 'A3 : trois petites inférences');
  for (const a of ['temoin', 'preparation', 'contrainte', 'verification', 'protege', 'representation']) {
    assert.equal(preparerApproche(a, q, MEMOIRE_TEST).etapes.length, 1, `${a} : une seule inférence`);
  }
  // A1 et A6 sont deux variantes d'écriture : vérifions qu'elles diffèrent réellement dans le texte.
  assert.notEqual(invites.preparation, invites.representation);
});

test('information absente : quatre approches refusent SANS appeler le modèle', async () => {
  const absente = QUESTIONS.find((q) => q.id === 'absente-pointure');
  const evite = [];
  for (const a of Object.keys(APPROCHES)) {
    const p = preparerApproche(a, absente, MEMOIRE_TEST);
    if (p.refusAvantModele) evite.push(a);
  }
  assert.deepEqual(evite.sort(), ['contrainte', 'preparation', 'protege', 'representation'].sort(),
    'seules les approches où Naissance cherche le fait AVANT peuvent empêcher l’invention en amont');
  // Et à l'exécution, aucun appel n'est réellement fait.
  let appels = 0;
  const essai = async () => { appels++; return { texte: 'inventé' }; };
  const r = await executerEssai({ approche: 'preparation', q: absente, essai });
  assert.equal(appels, 0);
  assert.equal(r.appelEvite, true);
  assert.equal(r.mesures.appels, 0);
  assert.equal(r.mesures.absenceReconnue, true);
});

test('approche 5 : une valeur altérée par le modèle est remplacée par la phrase de Naissance', async () => {
  const q = QUESTIONS.find((x) => x.id === 'couleur-1re');
  const menteur = async () => ({ texte: 'Ta couleur préférée est le rouge.' }); // mauvaise valeur
  const r = await executerEssai({ approche: 'protege', q, essai: menteur });
  assert.equal(r.secoursUtilise, true);
  assert.equal(r.reponseBrute, 'Ta couleur préférée est bleu.');
  assert.equal(r.mesures.faitCorrect, true, 'la valeur protégée est garantie par construction');
  const honnete = async () => ({ texte: 'Ta couleur préférée est bleu.' });
  const r2 = await executerEssai({ approche: 'protege', q, essai: honnete });
  assert.equal(r2.secoursUtilise, false, 'si le modèle respecte la valeur, on garde sa formulation');
});

test('approche 4 : la vérification repère les ajouts non autorisés, sans réécrire la réponse', async () => {
  const q = QUESTIONS.find((x) => x.id === 'lieu-1re');
  const inventeur = async () => ({ texte: 'Tu habites à Marcillac-Lanville, en Bourgogne.' });
  const r = await executerEssai({ approche: 'verification', q, essai: inventeur });
  assert.equal(r.verification.accepte, false);
  assert.ok(r.verification.ajouts.includes('Bourgogne'));
  assert.equal(r.reponseBrute, 'Tu habites à Marcillac-Lanville, en Bourgogne.', 'la réponse brute est conservée telle quelle');
  const propre = async () => ({ texte: 'Tu habites à Marcillac-Lanville.' });
  assert.equal((await executerEssai({ approche: 'verification', q, essai: propre })).verification.accepte, true);
  assert.deepEqual(verifierAjouts('Tu habites à Marcillac-Lanville.', 'Christophe habite à Marcillac-Lanville.'), []);
});

test('approche 3 : les sorties intermédiaires sont toutes conservées', async () => {
  const q = QUESTIONS.find((x) => x.id === 'lieu-1re');
  let n = 0;
  const essai = async () => { n++; return { texte: `sortie ${n}` }; };
  const r = await executerEssai({ approche: 'etapes', q, essai });
  assert.equal(r.mesures.appels, 3);
  assert.deepEqual(r.sorties.map((s) => s.etape), ['qui', 'quoi', 'reponse']);
  assert.deepEqual(r.sorties.map((s) => s.texte), ['sortie 1', 'sortie 2', 'sortie 3']);
  assert.equal(r.reponseBrute, 'sortie 3', 'la réponse finale est celle de la dernière étape');
});

test('mesures : les huit critères demandés, dont le coût en appels', () => {
  const q = QUESTIONS.find((x) => x.id === 'lieu-1re');
  const fait = chercherFait('Christophe', 'ville');
  const bonne = mesurer({ q, fait, reponse: 'Tu habites à Marcillac-Lanville.', autorise: fait.phrase, appels: 1, dureeMs: 4000, formatAttendu: 'libre' });
  assert.equal(bonne.faitCorrect, true);
  assert.equal(bonne.referentCorrect, true);
  assert.equal(bonne.aucuneInvention, true);
  const mauvaise = mesurer({ q, fait, reponse: "Je suis Naissance de Christophe, donc j'habite à Marcillac-Lanville, en Bourgogne.", autorise: fait.phrase, appels: 1, dureeMs: 4000, formatAttendu: 'libre' });
  assert.equal(mauvaise.faitCorrect, true, 'le fait est bien là…');
  assert.equal(mauvaise.referentCorrect, false, '…mais le référent est faux');
  assert.equal(mauvaise.aucuneInvention, false);
  assert.ok(mauvaise.ajouts.includes('Bourgogne'));
  // Format : la contrainte « valeur seule » n'est respectée que par une réponse très courte.
  assert.equal(mesurer({ q, fait, reponse: 'Marcillac-Lanville', autorise: fait.phrase, appels: 1, dureeMs: 1, formatAttendu: 'valeur-seule' }).formatRespecte, true);
  assert.equal(mesurer({ q, fait, reponse: 'Tu habites à Marcillac-Lanville, une jolie commune.', autorise: fait.phrase, appels: 1, dureeMs: 1, formatAttendu: 'valeur-seule' }).formatRespecte, false);
});

test('plan comparatif : mêmes questions pour toutes les approches, même graine', async () => {
  const plan = planComplet();
  assert.equal(plan.length, Object.keys(APPROCHES).length * QUESTIONS.length);
  for (const a of Object.keys(APPROCHES)) {
    const pour = plan.filter((x) => x.approche === a).map((x) => x.q.id).sort();
    assert.deepEqual(pour, QUESTIONS.map((q) => q.id).sort(), `${a} reçoit exactement les mêmes questions`);
  }
  const graines = [];
  const essai = async ({ seed }) => { graines.push(seed); return { texte: 'x' }; };
  await executerEssai({ approche: 'temoin', q: QUESTIONS[0], essai });
  assert.deepEqual(graines, [GRAINE_COMPARAISON], 'graine fixe pour la comparaison principale');
});

test('rapport comparatif : une section par approche, coût en appels visible, réponses brutes conservées', async () => {
  const q = QUESTIONS.find((x) => x.id === 'lieu-1re');
  const essai = async () => ({ texte: 'Tu habites à Marcillac-Lanville, en Bourgogne.' });
  const essais = [];
  for (const a of ['temoin', 'etapes']) essais.push(await executerEssai({ approche: a, q, essai }));
  const texte = rapportComparatif(essais);
  assert.match(texte, /Témoin — comportement actuel/);
  assert.match(texte, /A3 — plusieurs petites inférences/);
  assert.match(texte, /Appels LFM2\s+: 1 pour 1 questions/);
  assert.match(texte, /Appels LFM2\s+: 3 pour 1 questions/, 'le coût de A3 est visible, jamais présenté comme équivalent');
  assert.match(texte, /Tu habites à Marcillac-Lanville, en Bourgogne\./, 'réponse brute conservée');
});
