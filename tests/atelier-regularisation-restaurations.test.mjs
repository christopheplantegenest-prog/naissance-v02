// v0.65.23 — R1 « RÉGULARISATION SUR PREUVE FINALE » : restaurations des états RÉELS R1, R2 et E-T2 avec l'écran v0.65.23 (GO « R1 — GO
// PRÉPARATION LOCALE v0.65.23 », 23/10/2026, exigence 5). OUTILLAGE NON COGNITIF, aucun réseau.
// Données = fichiers des branches journal-atelier réelles, octet pour octet (empreintes git des blobs vérifiées) :
//   R2   : journal-atelier/recette-at104-r2 @ dd6b4357, chantier.json (empreinte 9ddb2f0a), tentative close NON ÉMIS, coût 0 ;
//   E-T2 : journal-atelier/carnet-recette-et2 @ 4fc3150b, carnet.json (298fb887, carnet BLOQUÉ, mission 1 close) et
//          journal-atelier/carnet-recette-et2-m1 @ 592d997c, chantier.json (2c83347f, tentative close NON ÉMIS, coût 0) ;
//   R1   : journal-atelier/recette-at104 @ 8e5e3ece (aide des tests de la régularisation), tentative AUTO vivante, ISSUE INCONNUE.
// Attendu : chaque état est restauré puis réécrit à l'identique ; la régularisation B n'est proposée QUE pour R1 (R2 : tentative close ;
// E-T2 : chantier de carnet, tentative close) ; les modules purs refusent B pour R2 (tentative-close) et pour E-T2 (carnet-ferme).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { monterEcran } from './atelier-aide.mjs';
import { CLE_CARNET } from '../app/atelier/ecran.js';
import { decouper, texteConfirmation, lireEtatDurable, ecrireEtatDurable, canonique, preparerRestauration } from '../app/atelier/journal.js';
import { etatDe } from '../app/atelier/chantier.js';
import { etatBudget } from '../app/atelier/budget.js';
import { lireEtatCarnet, etatDurableCarnet } from '../app/atelier/carnet.js';
import { decisionRegularisation } from '../app/atelier/retour.js';
import { CH, T, CHANTIER, COMMIT, J3, D3, V2, preuveLue, autorisationLue } from './atelier-regularisation-aide.mjs';

const VERSION = '0.65.23';
const h = (t) => createHash('sha256').update(t).digest('hex');
const blobGit = (t) => { const b = Buffer.from(t, 'utf8'); return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex'); };
const fx = (x) => gunzipSync(Buffer.from(x, 'base64')).toString('utf8');
const REEL = Object.freeze({
  r2: { id: 'recette-at104-r2', commit: 'dd6b4357d007b301cd24c6a8fba01c17b8600f70', blob: '5d555d98b7714fa27999b1aa77d17fa176f4b16c', empreinte: '9ddb2f0a0275cfd69e39f2caeae72aca3bbef59f5164a1be651d78efda46b9ac', texte: fx('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') },
  m1: { id: 'carnet-recette-et2-m1', commit: '592d997c', blob: 'e2cdd7a1d9676a9481cd3e50169b42dd486164d8', empreinte: '2c83347fea54ec14ec05de366fdd105bb0959a1bb3b02842ed387df0c97e474a', texte: fx('H4sIAAAAAAAC/71XW2/bNhR+z68g9LQCkUNSV+atwPqwYm2BLntZXBgUeZQosSVXotIMhf/7DklJlp0mabNuQdLaPOS5fuf29YQE6lrWpoI2OMfPsq3BhC0oMAZCMDzcsOAUb900fVvLNV66PCHkK/6RQDd1DdDhmftOgkJ2MH0jQXctLVNRRnmqYiYirXiqOcuLiGWZBpC5ZILHWrAyy8DKce/uoO2qprZv6SJNFpwHjrLzF4JKP6mrvdIUN6BMVdqL76rOsiOMaCDDdfImvODkF9mrviZyu4X1KXFfgOhlTymILdQdvFqMDLdrWQ/GEzJaiEq0lYHWGh1cQGfIXBtG0BAzcpj0Hq+wPcFAbaSp7qB7J+/xDttTKuO5fxz0Zt4VZOf++3QyuSWop4fB517WThanPA0ZDXl0QbNzLs5juhAR/8uLDszfW8e86a2mlrPj9SC6Mwn8ZRKs+0L0c2tFPS7I+9rFY4Yj972b+SVAf7UAq43zFqf4M1LwaGWaWwyevU95PBEaDWuni1rLXkN4LavbPkzCZMKdkW1Vrjxv95rOOXtq17SYLEhNPPUAmBruYN2gthtkMjMAyhKfWdnr5sskDu5NKytjFb389KQOT6pwoMGNXPvEOUaZs98SXv958SE4gk30ZFDj7DzKFujl46BOsA0xugqejWtprV3J3jT29ddlTZY+tivYVN0SD0u57uDUEVRTd8jdntb9ej0e9kcn9qXNbntqOeLRtqlqsypb1Om6OuCKxK5Rt2BWyuqmDExkpO5GjtsWkIOjLYOEZYUUVGle4k8kBS9UnimaAaiElhFlqlSKa5YJyjORFQnoNJWCxYwpodJlMLA1cjuwdDbPzs1MedVsNpXx9yiLozSiuoxloVLJFGQqLUSZUKGTkhcJKzmNQXlWD1Vnaa6wsJZxHnMst2WqQQnBUsHzCBK0ooREyjLFg1RIlSDXWGsNUcEixopyGey9gl7uB7Z1U4c+YJ6ESW0a1axH6wyssZ2ENs6hC3nIZ1fvoLZgmZncQulf4ofu7Bqk7s42sqons9q+XkkE82Y7OIYdkCrtTyMhOBWxwAYz0b807W2JSbfCXuRvfW83mhuPadp5iGGA1hDKogPn5YEMWwQrHAKzhc89GDgIbbvtVsfwUgnkSipgkRY05YkSUaojiV+YBIutlGcsUhleE7nIhCziLNcyjVKqEs0nSz33BjFtXCplcZINJN1gikB7LJqxJI9oFmegZETzmGpIBY1UyQqpmUaZtFBxnuYWgpDrLMmBikiminIqmZ5Ej/xnwtGSEZOu9nmJGIg9Vn0JLxrs4pbKcs7pQCsrzFwcAlZ2oLDES3vu/ehsvUb8DfEw2Ha7sxF0B/13YWmLzc2AVPIgRcZoecqQiIhgF975o6FSL32pHo+xpFZlJQuPfNP2MJH2rrAy3OnO/vtpsHDfppZjnxoIrk2NUDtsVHNITrV3uPqtYehsagJnzL5FDcZusC/Fe1TYovxvq93I35ULy3AsFsGPNajpbJjhPs7HtnPylpP3H96TN+9++4PMEnIY6MCeDfMc6UC1YF6dkoO2MPSEceYbMviUvI3wc33XVICke+LchNKQEJMO3TWxHWZG25DwBawJnUbFut9Aa1scO2qz8RNtNj/H34gtsjx+vM3KGtE09NkTYmeGYFuhZ8YeG8wCPrZdHEo2KA9GuJ9M4d/PHcHQRGcjGCKjrTrH+XKcPr4j0/x0Okwz/9c+8F0bzGxanxv1OxCrO/mmWQTuqw5hBYZsZdfB4tA8bKeVVWw+wQVl2zhlDqS8dpixel652RBxc1VXiO1pOzhG+AxlBAHaQSuJX0wwVkd62ORt9eEkOSXa6HwcLLZYiMfR1Bo+lFm7Fj3rg72ij2wxj64qu/9qJZvyYr8ZeIy+DLOzZG1RvB/Ybcr4bNvts+1X2PbVuI/sxx9r2ChpWJe9e9BZV+hD550ntmf1txoWlKcwjJtU2bj6Md8NxuOPfX1MQSRC65xEf8626PQMn9sZfzA1j806UvWFa+coPvTsa/hp+sI9qN4MVenZ7jv1M3lfbfqNNShhnL5oDcuPjYT6Svqy8px1L1P60V6+wUonXTWhL+l0gj0IF3bTsbmd7E7+ARZYhF2eEgAA') },
  carnet: { id: 'carnet-recette-et2', commit: '4fc3150b', blob: '3c3fb81b400095e2a84f6e2ecbd0c37a3d4eb6f4', empreinte: '298fb887827208b8156a9c286e53f5213efda62baa35b93d9bc101da0fe520da', texte: fx('H4sIAAAAAAAC/+1XTW/bOBC9+1cQPG0BSyuR+rB8K9DeupdF0EN3i4CmRg0TmVRJqk1R5L+XpCxbtmM7WRSLHGLAgM0Zjt57M3wQf84Q5kxLsHg5/oo0cLAWIrAEz13Creq1ZK3L+GeG0E/3RbhWUgIYtxb+I7xiBrb/EDY3zFesGrooeJZWtOakqEm6WNG0LGsAtmBpRbK6SpuyBP+csO8baCOU9HuTuMhjQnCIPAwJF8H6nFashYVrMB3jHhNN/GcTXAvjH2A2bBAaISPMug7aHYdxxaem8+0aSKsBrtfs3q2TXeVQnN1fW3UHoXyakGwSUjW0EIC3rK8humHiro/yKMe7JMu0aK6HJ4QKyX79IW6UtsLH8yG+CT/Mt0R6q7QwMCHpN4Ox5k9moRWgp7pFaexj8frW4E32520trp2W+qDUB0B+B3q0GIJ7YSwgsKhjxkB8XLQGLrZdmC5/g1Y5zddOgr1GQNM40l69Vn2fCAb3VjNh9+uc0PGCjEcqNlpJl3DI/W3Pe4n4DZNfAk7E1RcprGjiCa6/B0HQ++iKoCViYU+YJiQBGdAM/dsnCVRuHB/RR0ineX3IC9+yNhyNnS5crTtHYxTMN6YR/MahRvUTejSFvGm0r3Ll9+3nu3Npp9mi9oljTjqdYWGHKqMGKT6SVq1ugTvJfNpfw4FEqUesp7r9MZFtPmgIqB5069wZgzc7RLhrWaNkfdTtYez/+0GY7UF/9QryO72CvHrFi/cK8kyvIBe8gpzzCvI0ryAvwCvIq1dckoj+Tq+gr17x4r2CPtMr6AWvoOe8gj7NK+gL8Ap60itmkwbtwT/o9DuK9IAQ2hY8peH+E06D75RBH9PoI5mjS+RGbiMzZyw2XO72rkmdVlZxNTjLSGlz5XKxThk3mkpGw8vd0AEst46Gv/YsiIZJQoooTSJCr5JymWTLvIqLrPw0oMD2RweT25zq/UD4mqHkibsmrDsNfpbDTlImiyZhpKqSRQkrStISeJYlKWVlVucrUi9I1WRktSqqMmdkUbAk5UVCSZVxzg8JkPME8mVWxFlyioDTXXsSlyj8X9dlZyfeax6/MEfr8cUd3/nWHShBzypByDKr4iw/UmJzw9708qISXPXeYsbBc5v7UMYwadzEyVrUzJ6DmZ2BuVimrmfE6UJOweStMgPIWTiIZ0ffjfvD7Bea6o0zNREAAA==') },
});
const P = preuveLue();
const BASE = { preuve: P, autorisation: autorisationLue({ preuve: P }), t: T, d3: D3, vivante: true, engagement: 'engagee', carnet: false, deja: { preuves: [], commentaires: [] }, decideur: V2.login, montant: '0', motif: 'm' };
const RIEN_DE_B = ['preuve-regul', 'lire-preuve', 'autorisation-regul', 'controler-regul', 'regulariser-preuve', 'faits-auto'];

async function restaurerChantier(a, texte, id) {
  for (const p of decouper(texte, id)) { a.saisir('partie-restauration', p); await a.cliquer('ajouter-partie'); }
  await a.cliquer('confirmer-restauration');
}
async function restaurerCarnet(a, texte, id) {
  for (const p of decouper(texte, id)) { a.saisir('partie-carnet', p); await a.cliquer('ajouter-partie-carnet'); }
  await a.cliquer('installer-carnet');
}
const aller = (texte, id) => {
  const l = lireEtatDurable(texte);
  assert.equal(l.raison, undefined);
  assert.equal(ecrireEtatDurable(l.durable).texte, texte, 'relu puis réécrit à l\'identique');
  const parties = decouper(texte, id);
  for (const ordre of [parties, [...parties].reverse()]) {
    const r = preparerRestauration(ordre);
    assert.equal(r.statut, 'pret', r.raison);
    assert.equal(ecrireEtatDurable(structuredClone(r.lu.durable)).texte, texte, 'parties k/N restaurées puis réécrites à l\'identique');
  }
  return l;
};

test('données réelles : blobs git et empreintes des branches journal-atelier R2 et E-T2', () => {
  for (const x of Object.values(REEL)) {
    assert.equal(blobGit(x.texte), x.blob, x.id);
    assert.equal(h(x.texte), x.empreinte, x.id);
  }
});

test('R2 réel (dd6b4357) : restauré et réécrit à l\'identique (pur et écran) ; aucune régularisation proposée ; B refusé (tentative-close)', async () => {
  const x = REEL.r2;
  const l = aller(x.texte, x.id);
  const e = etatDe(l.durable.journal);
  assert.deepEqual([e.id, e.statut, e.plan[0].tentatives[0].statut], [x.id, 'bloque', 'annulee']);
  const b = etatBudget(l.durable.registre).executions[`${x.id}/blanc-1/1`];
  assert.deepEqual([b.statut, b.montant], ['payee', 0]);
  const a = monterEcran({ version: VERSION });
  await a.cliquer('mode-manuel');
  await restaurerChantier(a, x.texte, x.id);
  assert.equal(ecrireEtatDurable(a.copie()).texte, x.texte, 'écran : copie restaurée = chantier.json réel');
  await a.cliquer('mode-auto');
  a.saisir('confirmation-sauvegarde', texteConfirmation({ chantier: x.id, empreinte: x.empreinte, commit: x.commit }));
  await a.cliquer('enregistrer-confirmation');
  for (const nom of RIEN_DE_B) assert.equal(a.trouver(nom).length, 0, nom);
  assert.equal(ecrireEtatDurable(a.copie()).texte, x.texte, 'confirmation recollée : état durable inchangé');
  assert.equal(decisionRegularisation({ ...BASE, t: `${x.id}/blanc-1/1`, vivante: false, engagement: 'payee' }).raison, 'tentative-close');
});

test('E-T2 réel (4fc3150b + 592d997c) : carnet BLOQUÉ et chantier m1 restaurés et réécrits à l\'identique ; B fermé (carnet-ferme)', async () => {
  const c = REEL.carnet;
  const lc = lireEtatCarnet(c.texte);
  assert.equal(lc.raison, undefined);
  assert.equal(canonique(lc.durable), c.texte, 'carnet relu octet pour octet');
  assert.deepEqual([lc.etat.statut, ...lc.etat.missions.map((m) => m.statut)], ['bloque', 'close', 'a-venir', 'a-venir']);
  const x = REEL.m1;
  const l = aller(x.texte, x.id);
  assert.deepEqual([etatDe(l.durable.journal).statut, etatDe(l.durable.journal).plan[0].tentatives[0].statut], ['bloque', 'annulee']);
  const b = etatBudget(l.durable.registre).executions[`${x.id}/recette-1/1`];
  assert.deepEqual([b.statut, b.montant], ['payee', 0]);
  const a = monterEcran({ version: VERSION });
  await a.cliquer('mode-manuel');
  await restaurerCarnet(a, c.texte, c.id);
  assert.equal(canonique(etatDurableCarnet(JSON.parse(a.stockage.getItem(CLE_CARNET)).journal)), c.texte, 'écran : carnet restauré = carnet.json réel');
  await restaurerChantier(a, x.texte, x.id);
  assert.equal(ecrireEtatDurable(a.copie()).texte, x.texte, 'écran : chantier m1 restauré = chantier.json réel');
  await a.cliquer('mode-auto');
  for (const nom of RIEN_DE_B) assert.equal(a.trouver(nom).length, 0, nom);
  assert.equal(canonique(etatDurableCarnet(JSON.parse(a.stockage.getItem(CLE_CARNET)).journal)), c.texte, 'carnet inchangé');
  assert.equal(ecrireEtatDurable(a.copie()).texte, x.texte, 'chantier inchangé');
  assert.equal(decisionRegularisation({ ...BASE, carnet: true }).raison, 'carnet-ferme');
});

test('R1 réel (8e5e3ece) : restauré et réécrit à l\'identique ; seul état où la régularisation B est proposée', async () => {
  aller(CHANTIER, CH);
  const a = monterEcran({ version: VERSION });
  await a.cliquer('mode-manuel');
  await restaurerChantier(a, CHANTIER, CH);
  assert.equal(ecrireEtatDurable(a.copie()).texte, CHANTIER);
  await a.cliquer('mode-auto');
  a.saisir('confirmation-sauvegarde', texteConfirmation({ chantier: CH, empreinte: h(CHANTIER), commit: COMMIT }));
  await a.cliquer('enregistrer-confirmation');
  a.saisir('faits-auto', J3); a.ecran.rafraichir(); // la saisie seule ne redessine pas (dette UX 8-b)
  assert.match(a.un('auto-issue-blanc').textContent, /^⚠ ISSUE INCONNUE/);
  assert.equal(a.trouver('preuve-regul').length, 1, 'geste B proposé pour R1');
  assert.equal(ecrireEtatDurable(a.copie()).texte, CHANTIER, 'rien n\'est écrit dans l\'état durable avant le geste');
  assert.equal(decisionRegularisation(BASE).raison, undefined);
});
