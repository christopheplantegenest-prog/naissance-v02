// v0.17.5 — MOTEUR D'INDUCTION (analyse uniquement). Ces tests figent les PROPRIÉTÉS démontrées par
// plusieurs prototypes jetables (hors dépôt, supprimés) — pas les détails d'un prototype précis.
// RAPPEL DU GARDE-FOU : induire() ne modifie RIEN, ne lit ni n'appelle jamais comprendre()/repondre()/
// esprit.js/connaissances.js. Aucune connaissance n'est écrite, aucun comportement de conversation
// n'est changé par ce chantier — vérifié explicitement en fin de fichier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { induire, passeFinale, representerExemple } from '../app/langage/induction.js';
import { LEXIQUE_DEPART, ROLES } from '../app/langage/bagage.js';

const LEX = {
  ...LEXIQUE_DEPART,
  manteau: { role: ROLES.RELATION, relation: 'manteau' },
};

// ============================================================================ 1. QUESTION_INFORMATION homogène : une seule famille, aucune fragmentation
test('QUESTION_INFORMATION : une famille homogène donne UNE hypothèse, jamais fragmentée', () => {
  const positifs = ['Quel est mon manteau ?', 'Quel est mon téléphone ?', 'Quel est mon prénom ?', 'Quelle est ta couleur ?', 'Quel est ton nom ?'];
  const negatifs = ['Mon manteau est bleu.', 'Mon téléphone est rouge.', 'Ta couleur est verte.', 'Ton nom est Paul.'];
  const r = induire(positifs, negatifs, { lexique: LEX });
  assert.equal(r.hypotheses.length, 1, 'une seule hypothèse attendue, pas une fragmentation artificielle');
  assert.equal(r.hypotheses[0].couverture.length, 5, 'doit couvrir les 5 positifs');
  assert.ok(r.hypotheses[0].candidats.includes('role:interrogatif'));
  assert.equal(r.conflits.length, 0);
  assert.equal(r.inexpliques.length, 0);
});

// ============================================================================ 2. AFFIRMATION : généralisation correcte malgré des candidats idiosyncrasiques (n=1 échoue, n=2 réussit)
test('AFFIRMATION : la recherche ne s’arrête pas sur un candidat n=1 faible (idiosyncrasique), trouve n=2', () => {
  const positifs = ['Mon manteau est bleu.', 'Ma couleur est rouge.', 'Mon nom est Paul.'];
  const negatifs = ['Quel est mon manteau ?', 'Quelle est ma couleur ?', "Comment s'appelle mon fils ?"];
  const r = induire(positifs, negatifs, { lexique: LEX });
  assert.equal(r.hypotheses.length, 1);
  assert.equal(r.hypotheses[0].n, 2, 'doit avoir cherché au-delà de n=1, où {possessif_moi}/{relation}/{verbe_conjugue} seuls échouent tous');
  assert.equal(r.hypotheses[0].couverture.length, 3);
  assert.equal(r.conflits.length, 0);
});

// ============================================================================ 3. VERIFICATION : les 3 sous-familles découvertes sans pré-tri
const VERIF_POSITIFS = ['Es-tu content ?', 'Est-ce que mon manteau est bleu ?', 'Mon manteau est-il bleu ?', 'Sont-ils prêts ?', 'Est-ce que ma couleur est rouge ?', "Peut-elle venir ?", 'Veux-tu partir ?'];
const VERIF_NEGATIFS = ['Mon manteau est bleu.', 'Ma couleur est rouge.', 'Tu es content.', 'Il est content.', 'Ce manteau est bleu.', 'Je sais que mon manteau est bleu.'];

test('VERIFICATION : les 3 sous-familles réelles sont découvertes, corpus mélangé, aucun pré-tri', () => {
  const r = induire(VERIF_POSITIFS, VERIF_NEGATIFS, { lexique: LEX });
  assert.equal(r.hypotheses.length, 3, 'exactement 3 hypothèses : est-ce-que, inversion-tu, inversion-il/elle/on');
  assert.equal(r.conflits.length, 0, 'aucun vrai conflit sur ce corpus');
  const couvertures = r.hypotheses.map((h) => [...h.couverture].sort());
  assert.deepEqual(couvertures.find((c) => c.length === 3), ['Mon manteau est-il bleu ?', 'Peut-elle venir ?', 'Sont-ils prêts ?']);
  assert.deepEqual(couvertures.find((c) => c.includes('Es-tu content ?')), ['Es-tu content ?', 'Veux-tu partir ?']);
  assert.deepEqual(couvertures.find((c) => c.includes('Est-ce que mon manteau est bleu ?')), ['Est-ce que ma couleur est rouge ?', 'Est-ce que mon manteau est bleu ?']);
});

// ============================================================================ 4. Les 6 permutations : résultat strictement identique
test('VERIFICATION : résultat strictement identique sur 6 permutations du même corpus', () => {
  const p = VERIF_POSITIFS;
  const permutations = [
    p,
    [...p].reverse(),
    [p[3], p[0], p[5], p[1], p[6], p[2], p[4]],
    [p[6], p[4], p[2], p[0], p[3], p[5], p[1]],
    [p[1], p[4], p[0], p[6], p[2], p[3], p[5]],
    [p[0], p[2], p[4], p[6], p[3], p[1], p[5]],
  ];
  const canon = (r) => JSON.stringify({
    hypotheses: r.hypotheses.map((h) => ({ candidats: [...h.candidats].sort(), couverture: [...h.couverture].sort() })).sort((a, b) => a.couverture.join().localeCompare(b.couverture.join())),
    conflits: r.conflits,
    inexpliques: [...r.inexpliques].sort(),
  });
  const signatures = permutations.map((ordre) => canon(induire(ordre, VERIF_NEGATIFS, { lexique: LEX })));
  for (const s of signatures) assert.equal(s, signatures[0], 'la découverte doit être indépendante de l’ordre des positifs');
});

// ============================================================================ 5. Bruit avant/après : résultat inchangé
test('VERIFICATION : robuste au bruit avant/après (mots parasites, longueur variable)', () => {
  const bruites = [
    'Alors, dis-moi, est-ce que mon manteau est bleu, s’il te plaît ?',
    'Bon, sont-ils vraiment prêts maintenant ?',
    'Es-tu content ?',
    'Mon manteau est-il bleu ?',
    'Est-ce que ma couleur est rouge ?',
    "Peut-elle venir ?",
    'Veux-tu partir ?',
  ];
  const r = induire(bruites, VERIF_NEGATIFS, { lexique: LEX });
  assert.equal(r.hypotheses.length, 3);
  assert.equal(r.inexpliques.length, 0);
  assert.equal(r.conflits.length, 0);
});

// ============================================================================ 6. Mot/relation inconnu : robustesse
test('VERIFICATION : une relation totalement inconnue ne bloque pas la découverte', () => {
  const avecInconnu = [...VERIF_POSITIFS.slice(0, 6), 'Xylophoneutron est-il disponible ?'];
  const r = induire(avecInconnu, VERIF_NEGATIFS, { lexique: LEX });
  const familleInversion = r.hypotheses.find((h) => h.couverture.length >= 3);
  assert.ok(familleInversion, 'la famille inversion-il/elle/on doit exister');
  assert.ok(familleInversion.couverture.includes('Xylophoneutron est-il disponible ?'), 'doit couvrir la phrase au mot inconnu');
});

// ============================================================================ 7. Passe finale : un exemple externe, jamais vu pendant la découverte, qui satisfait deux hypothèses est explicitement AMBIGU
test('passeFinale : un exemple externe qui satisfait deux hypothèses déjà découvertes est explicitement AMBIGU, jamais assigné en silence', () => {
  const LEXPONT = { ...LEX, xx: { role: ROLES.VERBE_CONJUGUE }, tut: { role: ROLES.PRONOM_TOI }, ill: { role: ROLES.PRONOM_3E } };
  // Découverte sur un corpus PROPRE (pas de chevauchement) : 2 familles nettement séparées.
  const positifs = ['xx tut un', 'xx tut deux', 'xx ill trois', 'xx ill quatre'];
  const negatifs = ['mon manteau xx'];
  const r = induire(positifs, negatifs, { lexique: LEXPONT, seuilCouvertureMin: 2 });
  assert.equal(r.hypotheses.length, 2, 'deux hypothèses propres attendues, aucun chevauchement sur ce corpus');
  assert.equal(r.conflits.length, 0);
  // La passe finale s'applique ensuite à un ENSEMBLE PLUS LARGE, incluant un exemple JAMAIS vu
  // pendant la découverte, qui satisfait les deux hypothèses à la fois (un « pont »).
  const pf = passeFinale([...positifs, 'xx tut ill cinq'], r.hypotheses, { lexique: LEXPONT });
  const pont = pf.find((x) => x.phrase === 'xx tut ill cinq');
  assert.equal(pont.etat, 'ambigu', 'l’exemple-pont, jamais vu pendant la découverte, doit être détecté ambigu par la passe finale');
  assert.equal(pont.hypotheses.length, 2);
  for (const nom of positifs) assert.equal(pf.find((x) => x.phrase === nom).etat, 'assigne');
});

// ============================================================================ 8. Groupes disjoints à couverture identique : coexistence, PAS conflit
test('groupes disjoints à couverture/longueur identiques coexistent (VERIFICATION : tu vs est-ce-que, couv=2 chacun)', () => {
  const r = induire(VERIF_POSITIFS, VERIF_NEGATIFS, { lexique: LEX });
  const petites = r.hypotheses.filter((h) => h.couverture.length === 2);
  assert.equal(petites.length, 2, 'les 2 familles à couverture 2 doivent coexister comme 2 hypothèses');
  assert.equal(r.conflits.length, 0, 'une simple coïncidence de couverture entre familles disjointes n’est jamais un conflit');
});

// ============================================================================ 9. Groupes réellement chevauchants : conflit explicite
test('un vrai chevauchement (même positif couvert par deux candidats concurrents) est rapporté comme conflit, jamais tranché', () => {
  const LEXSYN = { ...LEX, xx: { role: ROLES.INTERROGATIF }, yy: { role: ROLES.PRONOM_3E }, zz: { role: ROLES.POSSESSIF_MOI }, ww: { role: ROLES.POSSESSIF_TOI } };
  // S1 = 'xx yy' est couvert À LA FOIS par {role:interrogatif} (via S1,S2) et par {role:pronom_3e} (via S1,S3) : chevauchement réel sur S1.
  const positifs = ['xx yy', 'xx zz', 'ww yy'];
  const negatifs = ['zz ww']; // ne contient ni xx ni yy : ne bloque aucun des deux candidats
  const r = induire(positifs, negatifs, { lexique: LEXSYN, seuilCouvertureMin: 2 });
  assert.equal(r.hypotheses.length, 0, 'aucune hypothèse ne doit être retenue tant que le chevauchement n’est pas résolu');
  assert.equal(r.conflits.length, 1);
  assert.equal(r.conflits[0].groupes.length, 2);
  const couvre = r.conflits[0].groupes.map((g) => [...g.couvre].sort());
  assert.ok(couvre.some((c) => c.includes('xx yy') && c.includes('xx zz')));
  assert.ok(couvre.some((c) => c.includes('xx yy') && c.includes('ww yy')));
});

// ============================================================================ 10. Candidats équivalents sur les données : groupe conservé, PAS de gagnant arbitraire
test('des candidats à couverture strictement identique sur les données restent un GROUPE de synonymes, aucun n’est choisi seul', () => {
  const r = induire(VERIF_POSITIFS, VERIF_NEGATIFS, { lexique: LEX });
  const familleTu = r.hypotheses.find((h) => h.couverture.includes('Es-tu content ?'));
  assert.ok(familleTu.candidats.length > 1, 'sur ces données, plusieurs formulations couvrent exactement les mêmes exemples : aucune n’est éliminée au profit d’une autre');
});

// ============================================================================ 11. Couverture 1 : aucune règle créée
test('un candidat qui ne couvrirait qu’un seul exemple est refusé (seuil de couverture minimale)', () => {
  const positifs = ['Mon manteau est bleu.'];
  const negatifs = ['Quel est mon manteau ?'];
  const r = induire(positifs, negatifs, { lexique: LEX, seuilCouvertureMin: 2 });
  assert.equal(r.hypotheses.length, 0);
  assert.deepEqual(r.inexpliques, ['Mon manteau est bleu.']);
});

// ============================================================================ 12. Aucun candidat valable : exemple laissé inexpliqué
test('une phrase entièrement composée de mots inconnus ne génère aucun candidat : inexpliquée, jamais une erreur', () => {
  const r = induire(['Blablabla ouistiti gloubiboulga'], ['Zorglub flibuste'], { lexique: LEX });
  assert.equal(r.hypotheses.length, 0);
  assert.deepEqual(r.inexpliques, ['Blablabla ouistiti gloubiboulga']);
});

// ============================================================================ GARDE-FOU : fonction pure, aucune écriture, aucun lien avec comprendre()/repondre()
test('GARDE-FOU — induction.js ne lit ni n’appelle jamais esprit.js/connaissances.js/ecran.js', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'induction.js'), 'utf8');
  for (const interdit of ["from './esprit.js'", "from './connaissances.js'", "from './ecran.js'", "from './cours.js'"]) {
    assert.ok(!src.includes(interdit), `induction.js ne doit importer aucun mécanisme d’écriture ou de conversation (trouvé : ${interdit})`);
  }
});

test('GARDE-FOU — comprendre.js et esprit.js restent inchangés par ce chantier (ne lisent jamais induction.js)', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage');
  for (const f of ['comprendre.js', 'esprit.js']) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert.ok(!src.includes('induction.js'), `${f} ne doit pas dépendre du moteur d’induction`);
  }
});
