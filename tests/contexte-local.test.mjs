import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composerContexteLocal, identiteCompacte, premierePhrase, BUDGETS_LOCAL } from '../app/esprit/contexte-local.js';
import { creerIdentite } from '../app/esprit/identite.js';
import { estimerJetons } from '../app/moteur-local/profil.js';

const identite = creerIdentite({ personne: 'Christophe', date: 'x' });
const jour = new Date('2026-09-17T10:00:00Z');
const souvenir = (id, texte, importance = 2, extra = {}) => ({ id, texte, importance, statut: 'actif', cree: id, confiance: 'probable', source: 'dit', ...extra });

test('identité compacte : Naissance, la personne, le moteur, les principes en bref', () => {
  const t = identiteCompacte({ identite, moteur: 'Moteur local — LFM2' });
  assert.match(t, /^Tu es Naissance, une IA personnelle en construction, qui vit sur le téléphone de Christophe\. Tu parles avec Christophe\./);
  assert.match(t, /petit moteur local \(Moteur local — LFM2\), qui n'est pas toi\. Tu ne peux faire aucune action\./);
  assert.match(t, /Dis quand tu ne sais pas ; N'invente jamais un souvenir ; Ne dis que tu as retenu une information que si ton action retenir a réellement réussi ; Sois honnête sur tes capacités actuelles ; Tu ne modifies jamais ton identité sans l'accord de Christophe\./);
  assert.match(t, /tu tutoies Christophe\. Réponds brièvement/);
  assert.ok(!t.includes('{personne}'));
  assert.ok(estimerJetons(t) < 260, `identité compacte : ${estimerJetons(t)} jetons`);
  assert.equal(premierePhrase('Sois honnête : blabla. Suite.'), 'Sois honnête');
});

test('préfixe identique d’un message à l’autre le même jour (cache possible)', () => {
  const souvenirs = [souvenir('a', 'Christophe habite à Marcillac-Lanville.', 3), souvenir('b', 'Christophe aime la raclette.', 2)];
  const c1 = composerContexteLocal({ identite, souvenirs, recents: [], message: 'Salut', moteur: 'M', maintenant: jour });
  const c2 = composerContexteLocal({ identite, souvenirs, recents: [{ id: 1, role: 'moi', texte: 'x' }, { id: 2, role: 'ia', texte: 'y' }], message: 'Tu aimes la raclette ?', moteur: 'M', maintenant: new Date('2026-09-17T20:00:00Z') });
  assert.equal(c1.prefixe, c2.prefixe);
  assert.match(c1.prefixe, /Nous sommes le jeudi 17 septembre 2026\./);
  assert.match(c1.prefixe, /- Christophe habite à Marcillac-Lanville\./, 'les souvenirs essentiels sont dans le préfixe');
  assert.ok(!c1.prefixe.includes('raclette'));
  const lendemain = composerContexteLocal({ identite, souvenirs, recents: [], message: 'Salut', moteur: 'M', maintenant: new Date('2026-09-18T10:00:00Z') });
  assert.notEqual(lendemain.prefixe, c1.prefixe);
  assert.match(c2.dynamique, /- Christophe aime la raclette\./, 'un souvenir pertinent passe dans la suite');
  assert.equal(c1.dynamique, '', 'rien de pertinent : suite sans souvenirs');
  assert.deepEqual(c2.souvenirsPertinents, ['b']);
});

test('jamais toute la mémoire : budgets respectés', () => {
  const beaucoup = Array.from({ length: 150 }, (_, i) => souvenir(`s${i}`, `Souvenir numéro ${i} à propos du jardin et des tomates ${'z'.repeat(60)}`, 1 + (i % 3)));
  const recents = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, role: i % 2 ? 'ia' : 'moi', texte: `message ${i} ${'x'.repeat(500)}` }));
  const c = composerContexteLocal({ identite, souvenirs: beaucoup, recents, message: 'Parle-moi du jardin et des tomates', moteur: 'M', maintenant: jour });
  assert.ok(c.estimation.prefixe <= BUDGETS_LOCAL.prefixe, `préfixe ${c.estimation.prefixe}`);
  assert.ok(c.estimation.suite <= BUDGETS_LOCAL.suite, `suite ${c.estimation.suite}`);
  assert.ok(c.estimation.prefixe + c.estimation.suite <= 700);
  assert.ok(c.historique.length <= 3, 'au plus le dernier échange + le message');
  assert.equal(c.historique.at(-1).texte, 'Parle-moi du jardin et des tomates');
  assert.ok(c.historique.slice(0, -1).every((m) => m.texte.length <= BUDGETS_LOCAL.messageHistorique));
  assert.ok(c.souvenirsUtilises.length < 10);
  assert.equal(c.tropLong, false);
});

test('dernier échange repris, message trop long signalé', () => {
  const recents = [{ id: 1, role: 'moi', texte: 'Je vais au marché' }, { id: 2, role: 'ia', texte: 'Bonne idée !' }];
  const c = composerContexteLocal({ identite, souvenirs: [], recents, message: 'Et après ?', moteur: 'M', maintenant: jour });
  assert.deepEqual(c.historique, [
    { role: 'moi', texte: 'Je vais au marché' }, { role: 'ia', texte: 'Bonne idée !' }, { role: 'moi', texte: 'Et après ?' },
  ]);
  const long = composerContexteLocal({ identite, souvenirs: [], recents, message: 'mot '.repeat(200), moteur: 'M', maintenant: jour });
  assert.equal(long.tropLong, true);
});
