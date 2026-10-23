// v0.65.23 — R1 « RÉGULARISATION SUR PREUVE FINALE » (GO « R1 — CONCEPTION B ACCEPTÉE », 23/10/2026 ; N2 obligatoire, carnet fermé, UX 9).
// OUTILLAGE NON COGNITIF. Données RÉELLES de la recette R1 (tests/atelier-regularisation-aide.mjs) ; commentaire N2 FICTIF.
// Modèle pur (retour.js) : preuve finale, autorisation N2, décision, chaque refus. Écran (ecran.js, section 11) : geste complet sur R1
// restauré, écriture unique et atomique, J3 historique conservé, double clôture impossible, Console fermée après B, carnet fermé, autres
// tentatives AUTO inchangées, UX 9 (libellé explicite, absence réelle dite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { monterEcran, stockageMemoire } from './atelier-aide.mjs';
import { decouper, texteConfirmation, lireEtatDurable, ecrireEtatDurable, canonique } from '../app/atelier/journal.js';
import { appliquer, etatDe } from '../app/atelier/chantier.js';
import { appliquerBudget, etatBudget } from '../app/atelier/budget.js';
import { bilanChantier } from '../app/atelier/carnet.js';
import {
  lirePreuve, controlerPreuve, texteBlocPreuve, lireAutorisation, controlerAutorisation, texteBlocAutorisation, texteAutorisation,
  decisionRegularisation, regularisationsDuJournal, PROTOCOLE_REGULARISATION,
} from '../app/atelier/retour.js';
import {
  CH, T, CHANTIER, J1, J3, D3, COMMIT, RUN, RUN_ID, SHA_RUN, V2, JOBS, APPROBATIONS, ISSUE, COMMENTAIRE_ID, GITHUB,
  valeurPreuve, blocPreuve, preuveLue, commentaire, valeurAutorisation, blocAutorisation, autorisationLue, resceller,
} from './atelier-regularisation-aide.mjs';

const VERSION = '0.65.23';
const h = (t) => createHash('sha256').update(t).digest('hex');
const SRC = readFileSync(new URL('../app/atelier/ecran.js', import.meta.url), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const P = preuveLue();
const A = autorisationLue({ preuve: P });
const BASE = { preuve: P, autorisation: A, t: T, d3: D3, vivante: true, engagement: 'engagee', carnet: false, deja: { preuves: [], commentaires: [] }, decideur: V2.login, montant: '0', motif: 'Régularisation R1 sur preuve finale.' };
const decision = (o = {}) => decisionRegularisation({ ...BASE, ...o });
const raison = (o) => decision(o).raison;
const jobs = (f) => { const j = structuredClone(JOBS); f(j); return j; };
const jobNomme = (j, nom) => j.find((x) => x.name === nom);
const etapeAppel = (j) => jobNomme(j, 'J2 frontière et appel').steps.find((x) => x.name === 'Appel (une seule requête)');

// ------------------------------------------------------------------------------------------------ modèle pur
test('R1 réel : preuve finale lisible et contrôlée (appel non exécuté), V2 réelle, constat final exact', () => {
  assert.equal(h(J3), '7b48bf9f42305bfdb9abcde665df99f65337762149ab958ad9a3fe1feb1b54e0', 'J3 historique réel');
  assert.equal(D3.empreinte, 'aaeaa3620e7c743e11d7c8835a95a23c154610490f285538887d0f46f276dcef');
  const c = controlerPreuve(P, { t: T, d3: D3 });
  assert.equal(c.raison, undefined);
  assert.deepEqual(c.v2, V2);
  assert.deepEqual({ ...c.constat }, { garde: 'completed/success', appel: 'completed/failure', etape_appel: 'completed/skipped', candidat: 'completed/skipped', constat: 'completed/failure', conclusion: 'appel-non-execute', lu_le: '2026-10-23T09:00:00.000Z' });
  assert.equal(c.j3.issue, 'issue-inconnue');
  assert.equal(c.j3.raison, 'etat-appel-incertain');
});

test('décision nominale R1 : coût 0, J3 tel quel, N0 / N1 / N2 distincts, contenu probant et références conservés', () => {
  const d = decision();
  assert.equal(d.raison, undefined);
  assert.equal(d.faits_auto, J3, 'texte exact du J3 historique');
  assert.equal(d.faits_auto_empreinte, JSON.parse(J3).empreinte);
  const r = d.regularisation;
  assert.ok(Object.isFrozen(r));
  assert.equal(r.protocole, PROTOCOLE_REGULARISATION);
  assert.equal(r.nature, 'preuve-finale');
  assert.equal(r.cout, 0);
  assert.deepEqual({ ...r.run }, { id: RUN_ID, run_attempt: 1, head_sha: SHA_RUN });
  assert.equal(r.j3_empreinte_texte, h(J3));
  assert.equal(r.constat_final.conclusion, 'appel-non-execute');
  assert.equal(r.preuve.empreinte, P.empreinte);
  const { empreinte, ...contenu } = P;
  assert.deepEqual(JSON.parse(JSON.stringify(r.preuve.contenu)), JSON.parse(JSON.stringify(contenu)), 'contenu probant intégral');
  assert.equal(r.preuve.contenu.j3, J3);
  assert.equal(r.identite.declaree, V2.login);
  assert.deepEqual({ ...r.identite.approbation_v2 }, { user_id: V2.user_id, login: V2.login, etat: 'approved', environnement: 'atelier-auto', source: 'api-github-lue-par-claude' });
  const n2 = r.identite.autorisation;
  assert.equal(n2.source, 'commentaire-github');
  assert.equal(n2.bloc_empreinte, A.empreinte);
  assert.deepEqual([n2.depot, n2.issue, n2.comment_id, n2.user_id, n2.login, n2.association], [GITHUB, ISSUE, COMMENTAIRE_ID, V2.user_id, V2.login, 'OWNER']);
  assert.equal(n2.url, `https://github.com/${GITHUB}/issues/${ISSUE}#issuecomment-${COMMENTAIRE_ID}`);
  assert.equal(n2.texte, texteAutorisation({ tentative: T, run: RUN_ID, preuve: P.empreinte }));
  assert.equal(n2.texte_empreinte, h(n2.texte));
  assert.equal(n2.modifiable_sur_github, true, 'un commentaire GitHub n\'est jamais présenté comme immuable');
  assert.deepEqual([n2.cree_le, n2.modifie_le, n2.lu_le], ['2026-10-23T09:10:00Z', '2026-10-23T09:10:00Z', '2026-10-23T09:12:00.000Z']);
});

test('texte d\'autorisation : modèle exact ASCII de cinq lignes lié à T, au run et à F ; arguments invalides refusés', () => {
  const m = texteAutorisation({ tentative: T, run: RUN_ID, preuve: P.empreinte });
  assert.equal(m, `AUTORISATION REGULARISATION ATELIER-REGULARISATION-1\ntentative=${T} run=${RUN_ID} essai=1\npreuve=${P.empreinte}\ncout=0 USD conclusion=appel-non-execute\nJ'autorise la regularisation a 0 de cette tentative sur cette preuve. Rien d'autre.`);
  assert.match(m, /^[\x20-\x7e\n]+$/);
  for (const a of [{ tentative: 'x', run: RUN_ID, preuve: P.empreinte }, { tentative: T, run: 'abc', preuve: P.empreinte }, { tentative: T, run: RUN_ID, preuve: 'abc' }, {}]) assert.throws(() => texteAutorisation(a), TypeError);
});

test('blocs : aller-retour exact ; altération, troncature, autre genre, protocole et clés inattendus refusés', () => {
  const b = blocPreuve();
  assert.match(b, new RegExp(`^ATELIER-PREUVE-1 tentative=${T} octets=\\d+ empreinte=[0-9a-f]{64}\\n`));
  assert.ok(b.endsWith('ATELIER-FIN-PREUVE\n'));
  assert.equal(texteBlocPreuve(valeurPreuve()), b, 'déterministe');
  assert.equal(lirePreuve(b).preuve.empreinte, P.empreinte);
  assert.equal(lirePreuve(b.replace('\r', '')).preuve.empreinte, P.empreinte);
  const lignes = b.split('\n');
  const altere = [...lignes]; altere[1] = altere[1].slice(0, 10) + (altere[1][10] === 'A' ? 'B' : 'A') + altere[1].slice(11);
  for (const x of [altere.join('\n'), lignes.slice(0, 3).join('\n'), lignes.filter((_, i) => i !== 2).join('\n'), b.replace(/empreinte=[0-9a-f]{64}/, `empreinte=${'0'.repeat(64)}`), blocAutorisation(), '', 'rien']) assert.ok(lirePreuve(x).raison, x.slice(0, 40));
  assert.ok(lireAutorisation(b).raison, 'une preuve n\'est pas une autorisation');
  assert.equal(lireAutorisation(blocAutorisation()).autorisation.empreinte, A.empreinte);
  assert.throws(() => texteBlocPreuve({ ...valeurPreuve(), protocole: 'autre' }));
  assert.throws(() => texteBlocPreuve({ ...valeurPreuve(), autre: 1 }));
  assert.throws(() => texteBlocAutorisation({ ...valeurAutorisation(), source: 'declaration' }));
  assert.throws(() => texteBlocAutorisation(valeurAutorisation({ modifier: (v) => ({ ...v, commentaire: { ...v.commentaire, url: v.commentaire.url.replace(`#issuecomment-${COMMENTAIRE_ID}`, '#issuecomment-1') } }) })));
});

test('preuve : chaque refus (tentative, J3, run, état lu, issue, appel exécuté, jobs, étapes, candidat, approbations)', () => {
  const p = (o) => lirePreuve(blocPreuve(o)).preuve;
  const j3 = (f) => resceller(J3, f);
  const cas = [
    [p({ tentative: `${CH}/blanc-1/2` }), 'tentative-differente'],
    [p({ j3: J3.slice(0, -1) }), 'j3-illisible'],
    [p({ j3: J1 }), 'j3-illisible'],
    [p({ j3: J3.replace('etat-appel-incertain', 'etat-appel-incertaine') }), 'j3-illisible'],
    [p({ j3: j3((o) => { o.tentative = `${CH}/blanc-1/2`; }) }), 'tentative-differente'],
    [p({ run: { ...RUN, run_attempt: 2 } }), 'run-different'],
    [p({ run: { ...RUN, id: 39799596192 } }), 'run-different'],
    [p({ run: { ...RUN, head_sha: 'a'.repeat(40) } }), 'run-different'],
    [p({ j3: j3((o) => { o.provenance.run_attempt = '2'; }) }), 'run-different'],
    [p({ j3: j3((o) => { o.provenance.ref = 'refs/heads/autre'; }) }), 'run-different'],
    [p({ j3: j3((o) => { o.etat.commit = 'b'.repeat(40); }) }), 'etat-different'],
    [p({ j3: j3((o) => { o.issue = 'non-emis'; o.raison = 'etape-appel-sautee'; o.appel_emis = false; }) }), 'regularisation-inutile'],
    [p({ j3: j3((o) => { o.raison = 'appel-execute-voir-faits-j2'; }) }), 'appel-execute'],
    [p({ jobs: JOBS.filter((x) => x.name !== 'J4 candidat') }), 'job-absent'],
    [p({ jobs: JOBS.filter((x) => x.name !== 'J1 garde') }), 'job-absent'],
    [p({ jobs: jobs((j) => { jobNomme(j, 'J3 constat').status = 'in_progress'; }) }), 'preuve-contradictoire'],
    [p({ jobs: jobs((j) => { jobNomme(j, 'J2 frontière et appel').conclusion = null; }) }), 'preuve-contradictoire'],
    [p({ jobs: jobs((j) => { jobNomme(j, 'J1 garde').conclusion = 'failure'; }) }), 'preuve-contradictoire'],
    [p({ jobs: jobs((j) => { etapeAppel(j).status = 'in_progress'; }) }), 'etat-appel-incertain'],
    [p({ jobs: jobs((j) => { etapeAppel(j).conclusion = null; }) }), 'etat-appel-incertain'],
    [p({ jobs: jobs((j) => { const a = jobNomme(j, 'J2 frontière et appel'); a.steps = a.steps.filter((x) => x.name !== 'Appel (une seule requête)'); }) }), 'etat-appel-incertain'],
    [p({ jobs: jobs((j) => { const a = jobNomme(j, 'J2 frontière et appel'); a.steps.push({ ...etapeAppel(j) }); }) }), 'etat-appel-incertain'],
    [p({ jobs: jobs((j) => { etapeAppel(j).conclusion = 'failure'; }) }), 'appel-execute'],
    [p({ jobs: jobs((j) => { etapeAppel(j).conclusion = 'success'; }) }), 'appel-execute'],
    [p({ jobs: jobs((j) => { etapeAppel(j).conclusion = 'cancelled'; }) }), 'appel-execute'],
    [p({ jobs: jobs((j) => { jobNomme(j, 'J2 frontière et appel').conclusion = 'skipped'; etapeAppel(j).conclusion = 'failure'; }) }), 'preuve-contradictoire'],
    [p({ jobs: jobs((j) => { jobNomme(j, 'J4 candidat').conclusion = 'success'; }) }), 'preuve-contradictoire'],
    [p({ approbations: [{ ...APPROBATIONS[0], state: 'rejected' }] }), 'preuve-contradictoire'],
    [p({ approbations: [] }), 'v2-absente'],
    [p({ approbations: [{ ...APPROBATIONS[0], environments: [{ name: 'livraison' }] }] }), 'v2-absente'],
    [p({ approbations: [APPROBATIONS[0], { ...APPROBATIONS[0], user: { login: 'autre', id: 1 } }] }), 'preuve-contradictoire'],
    [p({ approbations: [APPROBATIONS[0], { ...APPROBATIONS[0], user: { login: 'autre', id: V2.user_id } }] }), 'preuve-contradictoire'],
  ];
  for (const [preuve, r] of cas) assert.equal(controlerPreuve(preuve, { t: T, d3: D3 }).raison, r, r);
  assert.equal(controlerPreuve(P, { t: T, d3: { ...D3, commit: 'c'.repeat(40) } }).raison, 'etat-different');
  assert.equal(controlerPreuve(P, { t: T, d3: { ...D3, empreinte: 'c'.repeat(64) } }).raison, 'etat-different');
  assert.equal(controlerPreuve(P, { t: T, d3: null }).raison, 'etat-different');
  assert.equal(controlerPreuve(P, { t: `${CH}/blanc-1/2`, d3: D3 }).raison, 'tentative-differente');
  assert.equal(controlerPreuve(null, { t: T, d3: D3 }).raison, 'preuve-absente');
  // J2 sauté en entier (toutes étapes sautées) : appel non exécuté, accepté.
  const saute = p({ jobs: jobs((j) => { const a = jobNomme(j, 'J2 frontière et appel'); a.conclusion = 'skipped'; for (const s of a.steps) s.conclusion = 'skipped'; }) });
  assert.equal(controlerPreuve(saute, { t: T, d3: D3 }).constat.etape_appel, 'completed/skipped');
});

test('autorisation N2 : chaque refus (tentative, preuve, run, texte, compte, propriétaire, modification, dates)', () => {
  const ctl = (a, preuve = P) => controlerAutorisation(a, { t: T, preuve, v2: V2 }).raison;
  const avec = (o) => autorisationLue({ preuve: P, c: commentaire({ preuve: P, ...o }) });
  assert.equal(ctl(A), undefined);
  assert.equal(ctl(avec({ texte: `${texteAutorisation({ tentative: T, run: RUN_ID, preuve: P.empreinte }).replaceAll('\n', '\r\n')}  \r\n` })), undefined, 'CRLF et blancs finaux tolérés');
  const autre = preuveLue({ luLe: '2026-10-23T09:01:00.000Z' });
  const cas = [
    [autorisationLue({ preuve: P, tentative: `${CH}/blanc-1/2` }), 'autorisation-autre-tentative'],
    [autorisationLue({ preuve: P, empreinte: autre.empreinte }), 'autorisation-autre-preuve'],
    [autorisationLue({ preuve: P, run: '39799596192' }), 'autorisation-autre-run'],
    [avec({ texte: texteAutorisation({ tentative: T, run: RUN_ID, preuve: P.empreinte }).replace('a 0', 'a 1') }), 'autorisation-texte'],
    [avec({ texte: texteAutorisation({ tentative: T, run: RUN_ID, preuve: autre.empreinte }) }), 'autorisation-texte'],
    [avec({ texte: ` ${texteAutorisation({ tentative: T, run: RUN_ID, preuve: P.empreinte })}` }), 'autorisation-texte'],
    [avec({ texte: 'J\'autorise.' }), 'autorisation-texte'],
    [avec({ id: 1 }), 'autorisation-autre-compte'],
    [avec({ login: 'quelqu-un' }), 'autorisation-autre-compte'],
    [avec({ association: 'COLLABORATOR' }), 'autorisation-non-proprietaire'],
    [avec({ association: 'MEMBER' }), 'autorisation-non-proprietaire'],
    [avec({ modifieLe: '2026-10-23T09:11:00Z' }), 'autorisation-modifiee'],
    [avec({ creeLe: '2026-10-22T15:04:17Z' }), 'autorisation-anterieure'],
    [avec({ creeLe: '2026-10-22T15:00:00Z' }), 'autorisation-anterieure'],
    [avec({ creeLe: '2026-10-23T08:59:59Z' }), 'autorisation-anterieure'],
    [avec({ creeLe: '2026-10-23T09:00:00Z' }), 'autorisation-anterieure'],
    [autorisationLue({ preuve: P, luLe: '2026-10-23T09:09:59.000Z' }), 'autorisation-illisible'],
    [null, 'autorisation-absente'],
  ];
  for (const [a, r] of cas) assert.equal(ctl(a), r, r);
  assert.equal(controlerAutorisation(A, { t: T, preuve: P, v2: null }).raison, 'preuve-absente');
  // Côté outil (heure de lecture de la preuve inconnue) : seule la fin du run borne la date du commentaire.
  assert.equal(ctl(avec({ creeLe: '2026-10-23T08:59:59Z' }), { empreinte: P.empreinte, run: { id: RUN_ID, updated_at: RUN.updated_at }, lu_le: null }), undefined);
  assert.equal(ctl(avec({ creeLe: RUN.updated_at }), { empreinte: P.empreinte, run: { id: RUN_ID, updated_at: RUN.updated_at }, lu_le: null }), 'autorisation-anterieure', 'égalité avec la fin du run : antérieure');
});

test('décision : ordre des gardes et chaque refus (carnet, vivante, engagement, réutilisations, décideur, montant, motif)', () => {
  assert.equal(raison({ carnet: true }), 'carnet-ferme');
  assert.equal(raison({ carnet: undefined }), 'carnet-ferme');
  assert.equal(raison({ carnet: true, vivante: false, preuve: null }), 'carnet-ferme', 'le carnet est refusé avant tout');
  assert.equal(raison({ vivante: false }), 'tentative-close');
  assert.equal(raison({ vivante: 'oui' }), 'tentative-close');
  assert.equal(raison({ engagement: 'payee' }), 'engagement-deja-solde');
  assert.equal(raison({ engagement: null }), 'engagement-deja-solde');
  assert.equal(raison({ preuve: null }), 'preuve-absente');
  assert.equal(raison({ d3: { ...D3, commit: 'c'.repeat(40) } }), 'etat-different');
  assert.equal(raison({ deja: { preuves: [P.empreinte], commentaires: [] } }), 'preuve-deja-utilisee');
  assert.equal(raison({ deja: { preuves: [], commentaires: [COMMENTAIRE_ID] } }), 'autorisation-deja-utilisee');
  assert.equal(raison({ autorisation: null }), 'autorisation-absente');
  for (const decideur of [undefined, '', '   ']) assert.equal(raison({ decideur }), 'decideur-absent');
  assert.equal(raison({ decideur: 'quelqu-un' }), 'decideur-different');
  assert.equal(raison({ decideur: ` ${V2.login} ` }), undefined, 'blancs autour du décideur tolérés');
  for (const montant of [undefined, '', '0,00', '0.0', '00', '-0', '1', 'zéro', 0]) assert.equal(raison({ montant }), 'montant-different-de-0', String(montant));
  assert.equal(raison({ montant: ' 0 ' }), undefined);
  for (const motif of [undefined, '', '  \n ']) assert.equal(raison({ motif }), 'motif-absent');
});

test('regularisationsDuJournal : preuves et commentaires déjà utilisés relus du journal ; rien sans régularisation', () => {
  assert.deepEqual(regularisationsDuJournal([]), { preuves: [], commentaires: [] });
  assert.deepEqual(regularisationsDuJournal(null), { preuves: [], commentaires: [] });
  const r = decision().regularisation;
  const j = [{ n: 1, type: 'ouvert', donnees: {} }, { n: 2, type: 'tentative-annulee', donnees: { regularisation: r } }, { n: 3, type: 'tentative-annulee', donnees: { issue: 'non-emis' } }];
  assert.deepEqual(regularisationsDuJournal(j), { preuves: [P.empreinte], commentaires: [COMMENTAIRE_ID] });
});

// ------------------------------------------------------------------------------------------------ écran (section 11)
// R1 restauré depuis sa D3 réelle (8e5e3ece), mode AUTO, confirmation de sauvegarde recollée ; J3 collé dans les faits AUTO.
async function pret({ chantier = CHANTIER, ch = CH, commit = COMMIT, confirmer = true, j3 = J3, stockage } = {}) {
  const a = monterEcran({ version: VERSION, stockage });
  await a.cliquer('mode-manuel');
  for (const p of decouper(chantier, ch)) { a.saisir('partie-restauration', p); await a.cliquer('ajouter-partie'); }
  await a.cliquer('confirmer-restauration');
  await a.cliquer('mode-auto');
  if (confirmer) {
    a.saisir('confirmation-sauvegarde', texteConfirmation({ chantier: ch, empreinte: h(chantier), commit }));
    await a.cliquer('enregistrer-confirmation');
  }
  if (j3) { a.saisir('faits-auto', j3); a.ecran.rafraichir(); } // la saisie seule ne redessine pas (dette UX 8-b)
  return a;
}
const messages = (a) => a.trouver('message').map((m) => m.textContent);
async function remplir(a, { preuve = blocPreuve(), autorisation = blocAutorisation(), decideur = V2.login, montant = '0', motif = 'Régularisation R1 sur preuve finale (GO 08:38).' } = {}) {
  a.saisir('preuve-regul', preuve);
  await a.cliquer('lire-preuve');
  if (a.trouver('autorisation-regul').length === 0) return;
  a.saisir('autorisation-regul', autorisation);
  a.saisir('decideur-regul', decideur);
  a.saisir('montant-regul-0', montant);
  a.saisir('motif-regul-preuve', motif);
}

test('écran R1 : geste complet, lectures sans écriture, UNE écriture (journal + registre), J3 historique intact, ligne d\'historique', async () => {
  const a = await pret();
  assert.match(a.un('auto-issue-blanc').textContent, /^⚠ ISSUE INCONNUE/);
  assert.equal(a.un('clore-auto').disabled, true);
  assert.match(a.un('regul-portee').textContent, /commentaire GitHub public/);
  assert.equal(a.trouver('autorisation-regul').length, 0, 'rien avant la lecture de la preuve');
  const avant = a.stockage.ecritures;
  const copieAvant = a.stockage.getItem('naissance-ia.atelier.v1');
  a.saisir('preuve-regul', blocPreuve());
  await a.cliquer('lire-preuve');
  assert.match(a.un('preuve-lue').textContent, new RegExp(`^PREUVE FINALE LISIBLE — T = ${T} — run ${RUN_ID}, essai 1 — approbation V2 : ${V2.login} \\(${V2.user_id}\\) — garde completed/success, appel completed/failure \\(étape completed/skipped\\), candidat completed/skipped — J3 ${JSON.parse(J3).empreinte.slice(0, 16)}… — empreinte de la preuve ${P.empreinte.slice(0, 16)}…$`));
  await a.cliquer('copier-autorisation');
  assert.equal(a.copies.at(-1), texteAutorisation({ tentative: T, run: RUN_ID, preuve: P.empreinte }));
  await remplir(a);
  assert.equal(a.un('regulariser-preuve').disabled, true, 'contrôle d\'abord');
  await a.cliquer('controler-regul');
  assert.match(a.un('regul-controlee').textContent, new RegExp(`^AUTORISATION VÉRIFIÉE — ticket n° ${ISSUE}, commentaire ${COMMENTAIRE_ID} de ${V2.login} \\(${V2.user_id}\\).*Un commentaire GitHub reste modifiable : son texte exact est conservé ici\\.$`));
  assert.equal(a.stockage.ecritures, avant, 'lire, copier et contrôler n\'écrivent rien');
  assert.equal(a.stockage.getItem('naissance-ia.atelier.v1'), copieAvant);
  assert.equal(a.un('regulariser-preuve').disabled, false);
  await a.cliquer('regulariser-preuve');
  assert.equal(a.stockage.ecritures, avant + 1, 'UNE écriture');
  assert.match(messages(a).at(-1), /AUTO régularisée à coût réel 0 sur preuve finale \(ISSUE INCONNUE historique conservée, engagement soldé une fois\)/);
  const c = a.copie();
  const ev = c.journal.at(-1);
  assert.equal(c.journal.length, 4);
  assert.deepEqual([ev.type, ev.donnees.jalon, ev.donnees.numero, ev.donnees.mode, ev.donnees.issue], ['tentative-annulee', 'blanc-1', 1, 'AUTO', 'issue-inconnue']);
  assert.equal(ev.donnees.faits_auto, J3, 'J3 historique conservé octet pour octet');
  assert.equal(h(ev.donnees.faits_auto), '7b48bf9f42305bfdb9abcde665df99f65337762149ab958ad9a3fe1feb1b54e0');
  assert.equal(ev.donnees.regularisation.identite.autorisation.comment_id, COMMENTAIRE_ID);
  assert.equal(ev.donnees.regularisation.preuve.empreinte, P.empreinte);
  assert.equal(ev.donnees.motif, 'Régularisation R1 sur preuve finale (GO 08:38).');
  const cout = c.registre.at(-1);
  assert.deepEqual([cout.type, cout.donnees], ['cout', { execution: T, montant: 0, issue: 'issue-inconnue', regularisation: 'preuve-finale' }]);
  assert.equal(c.registre.length, 4);
  const b = etatBudget(c.registre);
  assert.deepEqual([b.executions[T].statut, b.executions[T].montant, b.engageCycle, b.consommeCycle, b.chantiers[CH].engage], ['payee', 0, 0, 0, 0]);
  assert.equal(etatDe(c.journal).plan[0].tentatives[0].statut, 'annulee');
  assert.match(a.un('auto-regularisee-blanc-1-1').textContent, new RegExp(`^Tentative blanc-1/1 AUTO : ISSUE INCONNUE historique \\(etat-appel-incertain, J3 conservé tel quel.*RÉGULARISÉE à coût réel 0 sur preuve finale ${P.empreinte.slice(0, 16)}… \\(run ${RUN_ID}, essai 1, appel-non-execute\\) — autorisation GitHub : ticket n° ${ISSUE}, commentaire ${COMMENTAIRE_ID} de ${V2.login} \\(modifiable sur GitHub ; texte conservé ici\\)\\.$`));
  assert.equal(a.trouver('auto-close-blanc-1-1').length, 0, 'plus d\'alerte « coût non établi » pour cette tentative');
  // Engagement soldé : la Console n'est plus proposée, aucun lancement n'est bloqué, le geste B a disparu (double clôture impossible).
  assert.equal(a.trouver('regulariser').length, 0);
  assert.equal(a.trouver('auto-bloque').length, 0);
  assert.equal(a.trouver('regulariser-preuve').length, 0);
  assert.equal(a.trouver('preuve-regul').length, 0);
  assert.equal(a.trouver('faits-auto').length, 0);
});

test('écran : double clôture et Console refusées par les modules purs sur l\'état régularisé (aucun second coût, aucune seconde annulation)', async () => {
  const a = await pret();
  await remplir(a);
  await a.cliquer('controler-regul');
  await a.cliquer('regulariser-preuve');
  const c = a.copie();
  const ev = c.journal.at(-1);
  assert.equal(Array.isArray(appliquer(c.journal, { type: ev.type, quand: ev.quand, donnees: ev.donnees })), false);
  for (const donnees of [{ execution: T, montant: 0, issue: 'issue-inconnue', regularisation: 'preuve-finale' }, { execution: T, montant: 25000, issue: 'issue-inconnue', regularisation: 'console' }]) {
    const r = appliquerBudget(c.registre, { type: 'cout', quand: '2026-10-23T10:00:00Z', donnees });
    assert.equal(r.limite, 'doublon');
  }
  assert.equal(decisionRegularisation({ ...BASE, vivante: false, engagement: 'payee', deja: regularisationsDuJournal(c.journal) }).raison, 'tentative-close');
  assert.equal(decisionRegularisation({ ...BASE, deja: regularisationsDuJournal(c.journal) }).raison, 'preuve-deja-utilisee');
});

test('écran : bilan du carnet prudent sur l\'état régularisé (inconnu, coût null) ; état durable relu et restauré sans perte', async () => {
  const a = await pret();
  await remplir(a);
  await a.cliquer('controler-regul');
  await a.cliquer('regulariser-preuve');
  const c = a.copie();
  const { texte, empreinte } = ecrireEtatDurable(c);
  const relu = lireEtatDurable(texte);
  assert.equal(relu.raison, undefined);
  assert.equal(canonique(relu.durable), texte, 'état durable relu octet pour octet');
  assert.deepEqual(relu.durable.journal.at(-1).donnees.regularisation, c.journal.at(-1).donnees.regularisation);
  // Restauration sur un appareil vide, puis nouvelle écriture : même texte, même empreinte (aucune perte silencieuse).
  const b = monterEcran({ version: VERSION });
  await b.cliquer('mode-manuel');
  for (const p of decouper(texte, CH)) { b.saisir('partie-restauration', p); await b.cliquer('ajouter-partie'); }
  await b.cliquer('confirmer-restauration');
  assert.deepEqual([ecrireEtatDurable(b.copie()).texte, ecrireEtatDurable(b.copie()).empreinte], [texte, empreinte]);
  const bc = bilanChantier({ journal: relu.durable.journal, registre: relu.durable.registre });
  assert.equal(bc.inconnu, true);
  assert.equal(bc.cout, null);
  assert.equal(bc.candidat, null);
});

test('écran : refus visibles, rien n\'est écrit (sans sauvegarde, état non lu par le run, montant, décideur, motif, autorisation, champ changé)', async () => {
  const sans = await pret({ confirmer: false });
  sans.saisir('preuve-regul', blocPreuve());
  await sans.cliquer('lire-preuve');
  assert.match(messages(sans).at(-1), /^Preuve finale refusée : sauvegarde durable confirmée À JOUR requise/);
  const autre = await pret({ commit: 'a'.repeat(40) });
  autre.saisir('preuve-regul', blocPreuve());
  await autre.cliquer('lire-preuve');
  assert.match(messages(autre).at(-1), /^Preuve finale refusée : le run n'a pas lu l'état sauvegardé de cet appareil\. Rien n'est conservé\.$/);
  const essais = [
    [{ montant: '0,00' }, /montant : saisis exactement 0/],
    [{ montant: '' }, /montant : saisis exactement 0/],
    [{ decideur: 'quelqu-un' }, /décideur différent de l'auteur du commentaire/],
    [{ decideur: '' }, /décideur absent/],
    [{ motif: ' ' }, /motif obligatoire/],
    [{ autorisation: blocAutorisation({ c: commentaire({ association: 'CONTRIBUTOR' }) }) }, /compte non propriétaire/],
    [{ autorisation: blocAutorisation({ c: commentaire({ modifieLe: '2026-10-23T09:30:00Z' }) }) }, /modifié après sa création/],
    [{ autorisation: blocAutorisation({ c: commentaire({ id: 42 }) }) }, /autre compte que celui de l'approbation V2/],
    [{ autorisation: blocAutorisation().replace('ATELIER-FIN-AUTORISATION', 'ATELIER-FIN') }, /autorisation illisible/],
    [{ autorisation: blocPreuve() }, /autorisation illisible/],
  ];
  for (const [o, motif] of essais) {
    const a = await pret();
    await remplir(a, o);
    const avant = a.stockage.ecritures;
    await a.cliquer('controler-regul');
    assert.match(messages(a).at(-1), motif);
    assert.match(messages(a).at(-1), /^Régularisation refusée : .* Rien n'est écrit\.$/);
    assert.equal(a.un('regulariser-preuve').disabled, true);
    await a.cliquer('regulariser-preuve');
    assert.equal(a.stockage.ecritures, avant, String(motif));
    assert.equal(a.copie().journal.length, 3);
  }
  // Preuve refusée : rien au-delà de la lecture.
  const p = await pret();
  p.saisir('preuve-regul', blocPreuve({ jobs: jobs((j) => { etapeAppel(j).conclusion = 'failure'; }) }));
  await p.cliquer('lire-preuve');
  assert.match(messages(p).at(-1), /^Preuve finale refusée : l'étape d'appel s'est exécutée : pas de régularisation à 0\./);
  assert.equal(p.trouver('autorisation-regul').length, 0);
  // Preuve illisible (bloc altéré) : raison de lecture dite.
  const g = await pret();
  g.saisir('preuve-regul', blocPreuve().replace('ATELIER-FIN-PREUVE', 'FIN'));
  await g.cliquer('lire-preuve');
  assert.match(messages(g).at(-1), /^Preuve finale refusée : preuve illisible : fin du bloc absente/);
  // Preuve changée sans redessin (la saisie seule ne redessine pas) : copier et contrôler refusent l'ancienne lecture.
  const s = await pret();
  await remplir(s);
  s.saisir('preuve-regul', blocPreuve({ luLe: '2026-10-23T09:05:00.000Z' }));
  const nCopies = s.copies.length;
  await s.cliquer('copier-autorisation');
  assert.match(messages(s).at(-1), /^Copie impossible : lis d'abord la preuve finale\.$/);
  assert.equal(s.copies.length, nCopies);
  const s2 = await pret();
  await remplir(s2);
  s2.saisir('preuve-regul', blocPreuve({ luLe: '2026-10-23T09:05:00.000Z' }));
  await s2.cliquer('controler-regul');
  assert.match(messages(s2).at(-1), /^Régularisation refusée : lis d'abord la preuve finale\./);
  const s3 = await pret();
  await remplir(s3);
  await s3.cliquer('controler-regul');
  s3.saisir('preuve-regul', blocPreuve({ luLe: '2026-10-23T09:05:00.000Z' }));
  await s3.cliquer('regulariser-preuve');
  assert.match(messages(s3).at(-1), /^Régularisation impossible : lis d'abord la preuve finale\./);
  assert.equal(s3.copie().journal.length, 3);
  // Un champ changé après le contrôle : bouton désactivé et refus si l'on force l'écriture.
  const m = await pret();
  await remplir(m);
  await m.cliquer('controler-regul');
  m.saisir('motif-regul-preuve', 'Autre motif.');
  m.ecran.rafraichir();
  assert.equal(m.un('regulariser-preuve').disabled, true);
  const avant = m.stockage.ecritures;
  m.un('regulariser-preuve').disabled = false;
  await m.cliquer('regulariser-preuve');
  assert.match(messages(m).at(-1), /^Régularisation impossible : contrôle d'abord la régularisation/);
  assert.equal(m.stockage.ecritures, avant);
  // Preuve changée après sa lecture : la lecture ne vaut plus.
  const q = await pret();
  await remplir(q);
  q.saisir('preuve-regul', blocPreuve({ luLe: '2026-10-23T09:05:00.000Z' }));
  q.ecran.rafraichir();
  assert.equal(q.trouver('autorisation-regul').length, 0);
});

test('écran : atomicité — enregistrement impossible : ni journal ni registre ne changent, la tentative reste vivante, puis réussite', async () => {
  const stockage = stockageMemoire();
  const a = await pret({ stockage });
  await remplir(a);
  await a.cliquer('controler-regul');
  const avant = stockage.getItem('naissance-ia.atelier.v1');
  stockage.panne = true;
  await a.cliquer('regulariser-preuve');
  stockage.panne = false;
  assert.match(messages(a).at(-1), /^Régularisation impossible : Copie locale non enregistrée sur cet appareil : rien n'est fait\.. Rien n'est écrit\.$/);
  assert.equal(stockage.getItem('naissance-ia.atelier.v1'), avant);
  assert.equal(a.un('regulariser-preuve').disabled, false, 'tentative toujours vivante, geste toujours possible');
  await a.cliquer('regulariser-preuve');
  assert.equal(a.copie().journal.at(-1).donnees.issue, 'issue-inconnue');
  assert.equal(a.copie().registre.at(-1).donnees.regularisation, 'preuve-finale');
});

test('écran : atomicité — coût 0 refusé par le registre (engagement déjà soldé dans la copie) : aucune annulation écrite', async () => {
  // État R1 dont le registre porte DÉJÀ un coût pour T (copie ancienne incohérente avec le journal) : la décision le refuse avant tout.
  const d = JSON.parse(CHANTIER);
  d.registre = appliquerBudget(d.registre, { type: 'cout', quand: '2026-10-22T16:00:00Z', donnees: { execution: T, montant: 25000, issue: 'issue-inconnue', regularisation: 'console' } });
  const chantier = canonique(d);
  const j3 = resceller(J3, (o) => { o.etat = { commit: COMMIT, empreinte: h(chantier) }; });
  const a = await pret({ chantier, j3 });
  await remplir(a, { preuve: blocPreuve({ j3 }), autorisation: blocAutorisation({ preuve: preuveLue({ j3 }) }) });
  await a.cliquer('controler-regul');
  assert.match(messages(a).at(-1), /engagement de cette tentative déjà soldé/);
  assert.equal(a.copie().journal.length, 3);
});

test('écran : chantier de carnet — geste FERMÉ, aucune saisie proposée (le carnet garde l\'issue inconnue)', async () => {
  const ch = 'carnet-recette-r1-m1';
  const chantier = CHANTIER.replaceAll(`"${CH}"`, `"${ch}"`).replaceAll(`${CH}/`, `${ch}/`);
  const j3 = resceller(J3, (o) => { o.tentative = `${ch}/blanc-1/1`; o.etat = { commit: COMMIT, empreinte: h(chantier) }; });
  const a = await pret({ chantier, ch, j3 });
  assert.match(a.un('auto-issue-blanc').textContent, /^⚠ ISSUE INCONNUE/);
  assert.match(a.un('regul-carnet-ferme').textContent, /^Chantier d'une mission de carnet : la régularisation sur preuve finale y est FERMÉE/);
  for (const nom of ['preuve-regul', 'lire-preuve', 'autorisation-regul', 'regulariser-preuve']) assert.equal(a.trouver(nom).length, 0, nom);
});

test('écran : autres tentatives AUTO inchangées (NON ÉMIS, appel exécuté) ; aucune saisie de régularisation hors ISSUE INCONNUE', async () => {
  const nonEmis = resceller(J3, (o) => { o.issue = 'non-emis'; o.raison = 'etape-appel-sautee'; o.appel_emis = false; });
  const a = await pret({ j3: nonEmis });
  assert.equal(a.un('clore-auto').textContent, 'Clore la tentative 1 AUTO : NON ÉMIS (coût réel 0)');
  assert.equal(a.trouver('preuve-regul').length, 0);
  const execute = resceller(J3, (o) => { o.raison = 'appel-execute-voir-faits-j2'; });
  const b = await pret({ j3: execute });
  assert.match(b.un('auto-issue-blanc').textContent, /appel-execute-voir-faits-j2/);
  assert.equal(b.trouver('preuve-regul').length, 0, 'appel exécuté : aucune régularisation à 0 proposée');
  const c = await pret({ j3: '' });
  assert.equal(c.trouver('preuve-regul').length, 0, 'sans faits collés : rien');
});

test('UX 9 : clôture à blanc par un constat J3 NON ÉMIS — libellé explicite (message et historique), jamais « undefined »', async () => {
  const nonEmis = resceller(J3, (o) => { o.issue = 'non-emis'; o.raison = 'etape-appel-sautee'; o.appel_emis = false; });
  const a = await pret({ j3: nonEmis });
  a.saisir('motif-auto', 'Clôture NON ÉMIS.');
  await a.cliquer('clore-auto');
  assert.match(messages(a).at(-1), /^Tentative 1 AUTO close : constat NON ÉMIS \(etape-appel-sautee\), aucun appel, coût réel 0 inscrit\./);
  assert.match(a.un('auto-close-blanc-1-1').textContent, /^Tentative blanc-1\/1 AUTO close : constat NON ÉMIS \(etape-appel-sautee\) — run 39799596191 — empreinte /);
  assert.doesNotMatch(a.texte(), /undefined/);
});

test('UX 9 : faits de garde (protocole 1) — leur résultat ; constat sans issue — « issue non établie », jamais déguisé en NON ÉMIS', async () => {
  // Historique restauré : tentative close par des faits J1 (résultat « autorise »), puis une seconde close par un constat d'issue null.
  const d = JSON.parse(CHANTIER);
  const j1 = { ...JSON.parse(J1) };
  assert.equal(j1.resultat, 'autorise');
  d.journal = appliquer(d.journal, { type: 'tentative-annulee', quand: '2026-10-22T16:00:00Z', donnees: { jalon: 'blanc-1', numero: 1, motif: 'm', mode: 'AUTO', faits_auto: J1, faits_auto_empreinte: j1.empreinte } });
  d.registre = appliquerBudget(d.registre, { type: 'cout', quand: '2026-10-22T16:00:00Z', donnees: { execution: T, montant: 0 } });
  const a = await pret({ chantier: canonique(d), j3: '' });
  assert.match(a.un('auto-close-blanc-1-1').textContent, /^Tentative blanc-1\/1 AUTO close : garde autorise — run /);
  const sansIssue = resceller(J3, (o) => { o.issue = null; o.raison = 'constat-sans-objet'; o.tentative = `${CH}/blanc-1/1`; });
  const e = JSON.parse(CHANTIER);
  e.journal = appliquer(e.journal, { type: 'tentative-annulee', quand: '2026-10-22T16:00:00Z', donnees: { jalon: 'blanc-1', numero: 1, motif: 'm', mode: 'AUTO', faits_auto: sansIssue, faits_auto_empreinte: JSON.parse(sansIssue).empreinte } });
  e.registre = appliquerBudget(e.registre, { type: 'cout', quand: '2026-10-22T16:00:00Z', donnees: { execution: T, montant: 0 } });
  const b = await pret({ chantier: canonique(e), j3: '' });
  assert.match(b.un('auto-close-blanc-1-1').textContent, /^Tentative blanc-1\/1 AUTO close : constat issue non établie \(constat-sans-objet\) — run /);
  assert.doesNotMatch(b.texte(), /undefined|constat NON ÉMIS/);
});

test('statique ecran.js v0.65.23 : forme exacte de l\'écriture B (une annulation + un coût 0 « preuve-finale ») ; aucun repli non authentifié', () => {
  assert.match(CODE, /engager\(avecEvenement\('tentative-annulee', \{ jalon: k\.v\.j\.id, numero: k\.v\.t\.numero, motif: ui\.motifRegulPreuve, mode: 'AUTO', issue: 'issue-inconnue', faits_auto: d\.faits_auto, faits_auto_empreinte: d\.faits_auto_empreinte, regularisation: structuredClone\(d\.regularisation\) \}, \(c\) => \{/);
  assert.match(CODE, /type: 'cout', quand: maintenant\(\), donnees: \{ execution: k\.t, montant: 0, issue: 'issue-inconnue', regularisation: 'preuve-finale' \}/);
  assert.equal((CODE.match(/decisionRegularisation\(/g) || []).length, 1, 'une seule décision, celle du modèle pur');
  assert.equal((CODE.match(/regularisation: 'preuve-finale'/g) || []).length, 1);
  assert.doesNotMatch(CODE, /montant\s*[<>]=?\s*0[^,]|montant === 0 \|\|/);
});

test('forme stricte de la preuve : chaque champ illisible refusé à l\'écriture du bloc et au contrôle (preuve-illisible)', () => {
  const muter = (f) => { const v = structuredClone(valeurPreuve()); f(v); return v; };
  const cas = [
    [(v) => { v.autre = 1; }, 'clés de la preuve inattendues', false],
    [(v) => { delete v.lu_le; }, 'clés de la preuve inattendues', false],
    [(v) => { v.protocole = 'atelier-preuve-finale-2'; }, 'protocole de la preuve inconnu'],
    [(v) => { v.tentative = 'Recette/blanc-1/1'; }, 'tentative illisible'],
    [(v) => { v.tentative = `${CH}/blanc-1/0`; }, 'tentative illisible'],
    [(v) => { v.run.autre = 1; }, 'run de la preuve illisible'],
    [(v) => { v.run.id = 39799596191; }, 'run de la preuve illisible'],
    [(v) => { v.run.run_attempt = '1'; }, 'run de la preuve illisible'],
    [(v) => { v.run.head_sha = 'D1D2'; }, 'run de la preuve illisible'],
    [(v) => { v.run.created_at = 'hier'; }, 'run de la preuve illisible'],
    [(v) => { v.run.updated_at = '2026-13-01T00:00:00Z'; }, 'run de la preuve illisible'],
    [(v) => { v.run.conclusion = 'Échec'; }, 'run de la preuve illisible'],
    [(v) => { v.approbations = {}; }, 'approbations illisibles'],
    [(v) => { v.approbations = Array.from({ length: 21 }, () => v.approbations[0]); }, 'approbations illisibles'],
    [(v) => { v.approbations[0].autre = 1; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].user_id = 0; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].user_id = '308310970'; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].login = '-x'; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].login = 1; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].etat = 'Approved'; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].environnements = 'atelier-auto'; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].environnements = Array.from({ length: 21 }, () => 'atelier-auto'); }, 'approbations illisibles'],
    [(v) => { v.approbations[0].environnements = ['x'.repeat(101)]; }, 'approbations illisibles'],
    [(v) => { v.approbations[0].environnements = [1]; }, 'approbations illisibles'],
    [(v) => { v.jobs.autre = null; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs = null; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.garde = { status: 'completed' }; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.constat = { status: 'Completed', conclusion: null }; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.candidat = { status: 'completed', conclusion: 'skipped', etapes: [] }; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.appel = { status: 'completed', conclusion: 'failure' }; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.appel.etapes = Array.from({ length: 11 }, () => ({ status: 'completed', conclusion: 'skipped' })); }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.appel.etapes = [{ status: 'completed', conclusion: 'skipped', nom: 'x' }]; }, 'jobs de la preuve illisibles'],
    [(v) => { v.jobs.appel.conclusion = 'FAIL'; }, 'jobs de la preuve illisibles'],
    [(v) => { v.j3 = ''; }, 'texte J3 de la preuve illisible'],
    [(v) => { v.j3 = 'x'.repeat(20001); }, 'texte J3 de la preuve illisible'],
    [(v) => { v.j3 = null; }, 'texte J3 de la preuve illisible'],
    [(v) => { v.lu_le = '2026-10-23 09:00'; }, 'heure de lecture de la preuve illisible'],
  ];
  for (const [f, motif, controle = true] of cas) {
    const v = muter(f);
    assert.throws(() => texteBlocPreuve(v), (e) => e instanceof TypeError && e.message.includes(motif), motif);
    if (controle) assert.equal(controlerPreuve(v, { t: T, d3: D3 }).raison, v.tentative === T ? 'preuve-illisible' : 'preuve-illisible', motif);
  }
  // Valeurs limites acceptées : 20 approbations, 10 étapes, J3 de 20000 caractères (illisible ensuite comme J3, pas comme forme).
  assert.doesNotThrow(() => texteBlocPreuve(muter((v) => { v.approbations = Array.from({ length: 20 }, () => v.approbations[0]); })));
  assert.doesNotThrow(() => texteBlocPreuve(muter((v) => { v.run.conclusion = null; })));
});

test('forme stricte de l\'autorisation : chaque champ illisible refusé à l\'écriture du bloc et au contrôle (autorisation-illisible)', () => {
  const muter = (f) => { const v = structuredClone(valeurAutorisation()); f(v); return v; };
  const cas = [
    [(v) => { v.autre = 1; }, 'clés de l\'autorisation inattendues', false],
    [(v) => { v.protocole = 'atelier-autorisation-2'; }, 'protocole de l\'autorisation inconnu'],
    [(v) => { v.source = 'declaration'; }, 'source de l\'autorisation inconnue'],
    [(v) => { v.tentative = 'x/y'; }, 'tentative illisible'],
    [(v) => { v.run = 39799596191; }, 'run de l\'autorisation illisible'],
    [(v) => { v.run = '0123'; }, 'run de l\'autorisation illisible'],
    [(v) => { v.preuve = P.empreinte.toUpperCase(); }, 'empreinte de preuve de l\'autorisation illisible'],
    [(v) => { v.depot = 'naissance-v02'; }, 'dépôt de l\'autorisation illisible'],
    [(v) => { v.depot = 1; }, 'dépôt de l\'autorisation illisible'],
    [(v) => { v.lu_le = 'maintenant'; }, 'heure de lecture de l\'autorisation illisible'],
    [(v) => { v.commentaire = null; }, 'commentaire illisible'],
    [(v) => { v.commentaire.autre = 1; }, 'commentaire illisible'],
    [(v) => { v.commentaire.id = 4000000001; }, 'identifiants du commentaire illisibles'],
    [(v) => { v.commentaire.id = '0'; }, 'identifiants du commentaire illisibles'],
    [(v) => { v.commentaire.issue = '9'; }, 'identifiants du commentaire illisibles'],
    [(v) => { v.commentaire.user_id = -1; }, 'identifiants du commentaire illisibles'],
    [(v) => { v.commentaire.login = 'a b'; }, 'auteur du commentaire illisible'],
    [(v) => { v.commentaire.login = null; }, 'auteur du commentaire illisible'],
    [(v) => { v.commentaire.association = 'X'.repeat(41); }, 'auteur du commentaire illisible'],
    [(v) => { v.commentaire.association = 1; }, 'auteur du commentaire illisible'],
    [(v) => { v.commentaire.cree_le = '23/10/2026'; }, 'dates du commentaire illisibles'],
    [(v) => { v.commentaire.modifie_le = null; }, 'dates du commentaire illisibles'],
    [(v) => { v.commentaire.texte = ''; }, 'texte du commentaire illisible'],
    [(v) => { v.commentaire.texte = 'x'.repeat(2001); }, 'texte du commentaire illisible'],
    [(v) => { v.commentaire.texte = 1; }, 'texte du commentaire illisible'],
    [(v) => { v.commentaire.url = `https://github.com/autre/depot/issues/${ISSUE}#issuecomment-${COMMENTAIRE_ID}`; }, 'adresse du commentaire incohérente'],
    [(v) => { v.commentaire.url = `https://github.com/${GITHUB}/issues/${ISSUE}#issuecomment-${COMMENTAIRE_ID}`.padStart(301, 'h'); }, 'adresse du commentaire incohérente'],
    [(v) => { v.commentaire.url = 1; }, 'adresse du commentaire incohérente'],
  ];
  for (const [f, motif, controle = true] of cas) {
    const v = muter(f);
    assert.throws(() => texteBlocAutorisation(v), (e) => e instanceof TypeError && e.message.includes(motif), motif);
    if (controle) assert.equal(controlerAutorisation(v, { t: T, preuve: P, v2: V2 }).raison, 'autorisation-illisible', motif);
  }
});

test('bloc : en-tête et contenu cohérents (tentative de l\'en-tête, forme canonique, longueur annoncée, taille maximale)', () => {
  const b = blocPreuve();
  const autreT = b.replace(`tentative=${T} `, `tentative=${CH}/blanc-1/2 `);
  assert.match(lirePreuve(autreT).raison, /tentative de l'en-tête différente du contenu/);
  assert.match(lirePreuve(b.replace(/octets=(\d+)/, (m, n) => `octets=${Number(n) + 1}`)).raison, /longueur du bloc différente/);
  // Contenu non canonique (espaces) mais d'empreinte juste : refusé.
  const v = valeurPreuve();
  const charge = JSON.stringify(v, null, 1);
  const o = Buffer.from(charge, 'utf8');
  const corps = o.toString('base64').match(/.{1,76}/g).join('\n');
  const nc = `ATELIER-PREUVE-1 tentative=${T} octets=${o.length} empreinte=${h(charge)}\n${corps}\nATELIER-FIN-PREUVE\n`;
  assert.match(lirePreuve(nc).raison, /forme du bloc non canonique/);
  const gros = (x) => ({ ...x, approbations: Array.from({ length: 20 }, () => ({ ...x.approbations[0], environnements: Array.from({ length: 20 }, () => 'e'.repeat(100)) })) });
  assert.throws(() => texteBlocPreuve(valeurPreuve({ modifier: gros })), /au plus 30000/);
});

test('lecture stricte des blocs : raison précise pour chaque défaut (vide, taille, début, fin, Base64, longueur, UTF-8, empreinte, JSON)', () => {
  const b = blocPreuve();
  const [tete, ...reste] = b.slice(0, -1).split('\n');
  const corps = reste.slice(0, -1);
  const avec = (c, t = tete) => `${t}\n${c.join('\n')}\nATELIER-FIN-PREUVE\n`;
  const charge = (texte) => { const o = Buffer.from(texte, 'utf8'); return avec(o.toString('base64').match(/.{1,76}/g), `ATELIER-PREUVE-1 tentative=${T} octets=${o.length} empreinte=${h(texte)}`); };
  const cas = [
    ['', /^preuve vide$/], ['  \n ', /^preuve vide$/], [null, /^preuve vide$/],
    [`${b}${'A'.repeat(30001)}`, /^preuve trop long \(au plus 30000 caractères\)$/],
    [b.replace('ATELIER-PREUVE-1', 'ATELIER-PREUVE-2'), /^début du bloc absent ou invalide \(ATELIER-PREUVE-1 attendu\)$/],
    [b.replace(/octets=\d+/, 'octets=0'), /^début du bloc absent/],
    [`${tete}\nATELIER-FIN-PREUVE\n`, /^fin du bloc absente/],
    [b.replace('ATELIER-FIN-PREUVE', 'ATELIER-FIN'), /^fin du bloc absente/],
    [avec([corps[0].slice(0, 75), ...corps.slice(1)]), /^Base64 invalide \(lignes de 76 caractères attendues\)$/],
    [avec([`${corps[0].slice(0, 75)}*`, ...corps.slice(1)]), /^Base64 invalide \(lignes de 76 caractères attendues\)$/],
    [avec([...corps.slice(0, -1), `${corps.at(-1)}=`.replace(/^(.{0,})$/, (x) => (x.length % 4 === 1 ? `${x}==` : x))]), /^Base64 invalide|longueur du bloc|empreinte du bloc fausse/],
    [avec(corps, tete.replace(/octets=(\d+)/, (m, n) => `octets=${Number(n) - 1}`)), /^longueur du bloc différente de l'annonce$/],
    [avec(Buffer.from([0xff, 0xfe, 0x41]).toString('base64').match(/.{1,76}/g), `ATELIER-PREUVE-1 tentative=${T} octets=3 empreinte=${'0'.repeat(64)}`), /^octets du bloc non UTF-8$/],
    [b.replace(/empreinte=[0-9a-f]{64}/, `empreinte=${'1'.repeat(64)}`), /^empreinte du bloc fausse$/],
    [charge('{"a":'), /^JSON du bloc illisible$/],
    [charge(canonique({ a: 1 })), /^clés de la preuve inattendues$/],
  ];
  for (const [texte, motif] of cas) assert.match(String(lirePreuve(texte).raison), motif, String(texte).slice(0, 50));
  assert.match(lireAutorisation('').raison, /^autorisation vide$/);
});
