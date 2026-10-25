// v0.66.8 — ATELIER 2, L3 (P1) : la porte d'essai des capacités expérimentales (app/essais/) et ses tests (tests/essais-*) sont protégés
// dans le noyau de l'Atelier autonome comme l'atelier lui-même : aucune mission ne peut les écrire, aucun « périmètre + : » ne peut les
// ouvrir, aucun candidat qui les touche ne passe les gardes statiques. OUTILLAGE NON COGNITIF (D-007). Aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';

test('L3 : app/essais/ et tests/essais-* sont des chemins protégés de l\'atelier (écriture, périmètre, gardes statiques, interdits de mission)', () => {
  for (const p of ['app/essais/porte.js', 'app/essais/registre.js', 'app/essais/verrou.js', 'app/essais/nouvelle.js', 'tests/essais-porte.test.mjs', 'tests/essais-nouveau.test.mjs', 'tests/atelier-essais-protection.test.mjs']) {
    assert.equal(N.raisonCheminEcriture(p, [p, 'app/essais/', 'tests/']), 'chemin protégé de l\'atelier', p);
    assert.ok(N.gardesStatiques([{ chemin: p, etat: 'modifie', avant: 'a', apres: 'b' }]).objections.some((o) => o.includes('protégé')), p);
    assert.ok(N.gardesStatiques([{ chemin: p, etat: 'ajoute', avant: null, apres: 'b' }]).objections.some((o) => o.includes('protégé')), p);
  }
  assert.equal(N.raisonAjoutPerimetre('app/essais/'), 'chemin protégé de l\'atelier');
  assert.equal(N.raisonAjoutPerimetre('app/essais/porte.js'), 'chemin protégé de l\'atelier');
  assert.equal(N.raisonAjoutPerimetre('tests/essais-porte.test.mjs'), 'chemin protégé de l\'atelier');
  assert.ok(N.INTERDITS_MISSION.includes('app/essais/'));
  // Le reste de l'application et des tests reste ouvert aux missions (sous les gardes existantes).
  assert.equal(N.raisonCheminEcriture('app/langage/nouveau.js', ['app/langage/nouveau.js']), null);
  assert.equal(N.raisonCheminEcriture('tests/nouveau.test.mjs', ['tests/']), null);
});
