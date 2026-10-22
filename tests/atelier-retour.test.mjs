// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026 ; DI = F2, DJ, DL, DO).
// OUTILLAGE NON COGNITIF. Module pur app/atelier/retour.js : formats canoniques et SHA, annotations (absentes, tronquées, dupliquées,
// incohérentes, ordre des morceaux, limites de taille), bloc ATELIER-RETOUR-1 (lecture stricte), contrôle par les lecteurs existants
// (même T, même run, même D3, chaîne sans saut, AT-5 = demande de J4), sur les faits RÉELS du pilote AT-9 (voir atelier-retour-aide.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { annotationsFaits, lireAnnotations, texteRetour, lireRetour, controlerRetour, GENRES, MORCEAU, MAX_MORCEAUX, LIMITE_BLOC, PROTOCOLE_RETOUR } from '../app/atelier/retour.js';
import { lireFaitsAuto, lireFaitsCandidat, lireRetourAuto } from '../app/atelier/auto.js';
import { lireFaits, ecrireFaits } from '../app/atelier/verification.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { canonique, versBase64, versOctets } from '../app/atelier/journal.js';
import { T, D3, RUNS, TEXTES, J2, J4, AT5, mission, fJ1, fJ2F, fJ3, modifier, sceller, RUN_AUTO } from './atelier-retour-aide.mjs';

const h = (t) => createHash('sha256').update(t).digest('hex');
// Annotations telles que l'API REST les rend (check-runs/<job>/annotations) pour des lignes « ::notice title=...::message ».
const versApi = (lignes) => lignes.map((l) => {
  const m = /^::notice title=([^:]*)::(.*)$/.exec(l);
  assert.ok(m, `ligne d'annotation conforme : ${l.slice(0, 60)}`);
  return { path: '.github', start_line: 1, end_line: 1, annotation_level: 'notice', title: m[1], message: m[2], raw_details: null };
});
const api = (genre, texte = TEXTES[genre]) => versApi(annotationsFaits(genre, texte));
const tout = (p = {}) => ({ tentative: T, runs: RUNS, d3: D3, textes: { ...TEXTES }, ...p });
const lireBloc = (v) => { const l = lireRetour(texteRetour(v)); assert.equal(l.raison, undefined, l.raison); return l.retour; };
const ctl = (v, o = {}) => controlerRetour(lireBloc(v), { t: T, d3: D3, mission: mission(), ...o });
const sans = (o, ...g) => { const c = { ...o }; for (const x of g) delete c[x]; return c; };

test('R1 annotations : format exact, SHA-256 du texte, Base64 du texte UTF-8, morceaux de MORCEAU caractères, aller-retour exact', () => {
  for (const g of GENRES) {
    const lignes = annotationsFaits(g, TEXTES[g]);
    const b64 = versBase64(versOctets(TEXTES[g]));
    assert.equal(lignes.length, Math.ceil(b64.length / MORCEAU));
    lignes.forEach((l, i) => {
      const m = /^::notice title=ATELIER-FAITS-1 ([a-z0-9]+) ([0-9]+)\/([0-9]+) ([0-9a-f]{64}) ([0-9]+)::([A-Za-z0-9+/=]+)$/.exec(l);
      assert.ok(m);
      assert.deepEqual([m[1], Number(m[2]), Number(m[3]), m[4], Number(m[5])], [g, i + 1, lignes.length, h(TEXTES[g]), m[6].length]);
      assert.equal(m[6], b64.slice(i * MORCEAU, (i + 1) * MORCEAU));
      assert.ok(l.length < 4000 && !l.includes('%') && !l.includes('\r') && !l.slice(2).includes('\n'), 'aucun caractère à échapper pour les commandes de workflow');
    });
    assert.deepEqual(lireAnnotations(api(g), [g]), { textes: { [g]: TEXTES[g] } });
  }
  // Texte non ASCII : octets UTF-8 transportés exactement.
  const t = '{"é":"ü€"}\n';
  assert.deepEqual(lireAnnotations(versApi(annotationsFaits('j1', t)), ['j1']), { textes: { j1: t } });
  assert.throws(() => annotationsFaits('j5', 'x'), /genre inconnu/);
  assert.throws(() => annotationsFaits('j1', ''), /texte non vide/);
});

test('R2 annotations : limites de taille (MAX_MORCEAUX), marqueur trop-grand refusé (repli F1), jamais une partie des faits', () => {
  const limite = 'a'.repeat((MORCEAU * MAX_MORCEAUX / 4) * 3);
  assert.equal(annotationsFaits('j2', limite).length, MAX_MORCEAUX);
  assert.equal(lireAnnotations(versApi(annotationsFaits('j2', limite)), ['j2']).textes.j2, limite);
  const trop = `${limite}a`;
  const l = annotationsFaits('j2', trop);
  assert.equal(l.length, 1);
  assert.match(l[0], /^::notice title=ATELIER-FAITS-1 j2 0\/11 [0-9a-f]{64} 0::trop-grand$/);
  assert.match(lireAnnotations(versApi(l), ['j2']).raison, /trop grands .* copie manuelle \(F1\)/);
});

test('R3 annotations : absentes, tronquées, dupliquées, désordonnées, ambiguës, altérées, étrangères', () => {
  const a = api('j2');
  assert.equal(a.length, 2);
  assert.deepEqual(lireAnnotations([], ['j2']), { textes: {} }, 'aucune annotation : aucun fait (l\'outil exige selon les étapes)');
  assert.deepEqual(lireAnnotations([...a].reverse(), ['j2']).textes.j2, J2, 'ordre de l\'API indifférent : le numéro de morceau fait foi');
  assert.match(lireAnnotations([a[0]], ['j2']).raison, /morceau 2\/2 absent/);
  assert.match(lireAnnotations([a[1]], ['j2']).raison, /morceau 1\/2 absent/);
  assert.match(lireAnnotations([a[0], a[0], a[1]], ['j2']).raison, /morceau 1\/2 en double/);
  assert.match(lireAnnotations([...a, ...api('j2', J2.replace('pilote', 'pilotf'))], ['j2']).raison, /ambigus/);
  assert.match(lireAnnotations([{ ...a[0], message: a[0].message.slice(0, -1) }, a[1]], ['j2']).raison, /tronqué ou altéré/);
  assert.match(lireAnnotations([{ ...a[0], message: `${a[0].message.slice(0, -1)}*` }, a[1]], ['j2']).raison, /tronqué ou altéré/);
  // Altération d'un caractère Base64 valide (même longueur) : SHA-256 faux.
  const c = a[0].message[10] === 'A' ? 'B' : 'A';
  assert.match(lireAnnotations([{ ...a[0], message: `${a[0].message.slice(0, 10)}${c}${a[0].message.slice(11)}` }, a[1]], ['j2']).raison, /SHA-256 faux|non UTF-8|Base64/);
  // Morceaux intermédiaires de longueur inattendue (découpage différent, même total).
  const b64 = versBase64(versOctets(J2));
  const t2 = (i, n, m) => ({ annotation_level: 'notice', title: `ATELIER-FAITS-1 j2 ${i}/${n} ${h(J2)} ${m.length}`, message: m });
  assert.match(lireAnnotations([t2(1, 2, b64.slice(0, 2000)), t2(2, 2, b64.slice(2000))], ['j2']).raison, /longueur inattendue|trop long/);
  assert.match(lireAnnotations([t2(3, 2, b64.slice(0, MORCEAU))], ['j2']).raison, /hors bornes/);
  assert.match(lireAnnotations([{ ...a[0], annotation_level: 'warning' }, a[1]], ['j2']).raison, /niveau « warning »/);
  assert.match(lireAnnotations(a, ['j2f']).raison, /job qui ne les produit pas/);
  assert.match(lireAnnotations([{ annotation_level: 'notice', title: 'ATELIER-FAITS-2 j2 1/1', message: 'x' }], ['j2']).raison, /illisible/);
  assert.match(lireAnnotations([{ annotation_level: 'notice', title: 'ATELIER-FAITS-1 j2 01/2 x 1', message: 'x' }], ['j2']).raison, /illisible/);
  assert.deepEqual(lireAnnotations([{ annotation_level: 'notice', title: 'Autre chose', message: 'x' }, ...a], ['j2']).textes.j2, J2, 'annotations étrangères ignorées');
  assert.equal(lireAnnotations('x', ['j2']).raison, 'annotations illisibles');
  assert.equal(lireAnnotations([null], ['j2']).raison, 'annotation illisible');
  // Base64 non canonique (bits de bourrage non nuls) refusé.
  const pad = { annotation_level: 'notice', title: `ATELIER-FAITS-1 j1 1/1 ${h('a')} 4`, message: 'YR==' };
  assert.match(lireAnnotations([pad], ['j1']).raison, /Base64 invalide|SHA-256 faux/);
});

test('R4 bloc ATELIER-RETOUR-1 : forme exacte, canonique, ASCII, lignes de 76, empreinte du contenu, aller-retour', () => {
  const b = texteRetour(tout());
  const l = b.split('\n');
  assert.match(l[0], new RegExp(`^ATELIER-RETOUR-1 tentative=${T} octets=[0-9]+ empreinte=[0-9a-f]{64}$`));
  assert.equal(l.at(-1), '');
  assert.equal(l.at(-2), 'ATELIER-FIN-RETOUR');
  assert.ok(/^[\x20-\x7e\n]*$/.test(b), 'ASCII imprimable');
  assert.ok(l.slice(1, -3).every((x) => x.length === 76));
  assert.ok(b.length < LIMITE_BLOC);
  const r = lireRetour(b).retour;
  assert.equal(r.protocole, PROTOCOLE_RETOUR);
  assert.deepEqual(Object.keys(r.faits), [...GENRES].sort(), 'clés triées (forme canonique)');
  for (const g of GENRES) assert.deepEqual(r.faits[g], { empreinte: h(TEXTES[g]), texte: TEXTES[g] });
  assert.equal(r.empreinte, /empreinte=([0-9a-f]{64})/.exec(l[0])[1]);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.faits.j2));
  assert.equal(texteRetour(tout()), b, 'déterministe');
  assert.deepEqual(lireRetour(b.slice(0, -1)).retour, r, 'seule tolérance : le saut de ligne final');
});

test('R5 bloc : lecture stricte (tronqué, altéré, réordonné, non canonique, autre tentative, trop long, champs inattendus)', () => {
  const b = texteRetour(tout());
  const l = b.split('\n');
  const r = (x) => lireRetour(x).raison;
  assert.equal(r(''), 'retour vide');
  assert.match(r(b.replace('ATELIER-RETOUR-1', 'ATELIER-RETOUR-2')), /début du retour/);
  assert.match(r(l.slice(0, -2).join('\n')), /fin du retour absente/);
  assert.match(r([l[0], ...l.slice(2)].join('\n')), /Base64 invalide|longueur/);
  assert.match(r([l[0], l[2], l[1], ...l.slice(3)].join('\n')), /empreinte du retour fausse|JSON|Base64/);
  assert.match(r(b.replace(/octets=([0-9]+)/, (x, n) => `octets=${Number(n) + 1}`)), /longueur/);
  assert.match(r(b.replace(/empreinte=([0-9a-f])/, (x, c) => `empreinte=${c === 'a' ? 'b' : 'a'}`)), /empreinte du retour fausse/);
  assert.match(r(b.replace(`tentative=${T}`, `tentative=${T.replace('/1', '/2')}`)), /tentative de l'en-tête/);
  assert.match(r(b.replace('\n', '\r\n')), /début du retour/);
  assert.match(r(`${b} `), /fin du retour|Base64/);
  assert.match(r(`${b}${'x'.repeat(LIMITE_BLOC)}`), /trop long/);
  // Contenu non canonique ou incohérent, rescellé (empreinte juste) : refusé par la forme.
  const fabrique = (v, json = canonique(v)) => {
    const o = versOctets(json);
    const b64 = versBase64(o);
    const lignes = []; for (let i = 0; i < b64.length; i += 76) lignes.push(b64.slice(i, i + 76));
    return `ATELIER-RETOUR-1 tentative=${T} octets=${o.length} empreinte=${hacherSha256(json)}\n${lignes.join('\n')}\nATELIER-FIN-RETOUR\n`;
  };
  const base = JSON.parse(canonique({ d3: D3, faits: { j1: { empreinte: h(TEXTES.j1), texte: TEXTES.j1 } }, protocole: PROTOCOLE_RETOUR, runs: RUNS, tentative: T }));
  assert.equal(lireRetour(fabrique(base)).raison, undefined);
  assert.match(lireRetour(fabrique(base, JSON.stringify(base))).raison, /non canonique/);
  assert.match(lireRetour(fabrique({ ...base, extra: 1 })).raison, /clés du retour/);
  assert.match(lireRetour(fabrique({ ...base, protocole: 'atelier-retour-2' })).raison, /protocole/);
  assert.match(lireRetour(fabrique({ ...base, faits: { j1: { empreinte: h('x'), texte: TEXTES.j1 } } })).raison, /empreinte fausse/);
  assert.match(lireRetour(fabrique({ ...base, faits: { j9: base.faits.j1 } })).raison, /faits illisibles/);
  assert.match(lireRetour(fabrique({ ...base, faits: {} })).raison, /faits illisibles/);
  assert.match(lireRetour(fabrique({ ...base, runs: { ...RUNS, auto: { ...RUNS.auto, run_id: '0' } } })).raison, /runs illisibles/);
  assert.match(lireRetour(fabrique({ ...base, d3: { ...D3, commit: 'x' } })).raison, /D3 illisible/);
  assert.match(lireRetour(fabrique({ ...base, tentative: 'a/b' })).raison, /tentative illisible/);
  assert.throws(() => texteRetour(tout({ textes: { j1: 'x'.repeat(LIMITE_BLOC) } })), /copie manuelle \(F1\)/);
  assert.throws(() => texteRetour(tout({ runs: { auto: RUNS.auto } })), /runs illisibles/);
});

test('R6 contrôle : chaîne réelle complète acceptée ; fait principal j2 ; mêmes lecteurs que la copie manuelle', () => {
  const c = ctl(tout());
  assert.equal(c.raison, undefined);
  assert.equal(c.principal, 'j2');
  assert.deepEqual(c.utilises, ['j2', 'j4', 'at5']);
  assert.deepEqual(c.lus.j2, lireFaitsAuto(J2).faits);
  assert.deepEqual(c.lus.j4, lireFaitsCandidat(J4).faits);
  assert.deepEqual(c.lus.at5, lireFaits(AT5, hacherSha256).faits);
  assert.equal(lireRetourAuto({ j2Texte: J2, j4Texte: J4, t: T, mission: mission() }).raison, undefined);
  assert.equal(ctl(tout(), { d3: null, mission: null }).raison, undefined, 'contrôle Claude sans pièce : même verdict');
});

test('R7 contrôle : autre tentative, autre D3, autre run, autre essai, autre ref, autre étape : refus', () => {
  assert.match(ctl(tout(), { t: T.replace('/1', '/2') }).raison, /autre tentative/);
  assert.match(ctl(tout(), { d3: { ...D3, empreinte: 'a'.repeat(64) } }).raison, /D3 du retour différente/);
  assert.match(ctl(tout({ d3: { ...D3, commit: 'a'.repeat(40) } }), { d3: null }).raison, /faits j1 d'une autre D3/);
  assert.match(ctl(tout({ runs: { ...RUNS, auto: { ...RUNS.auto, run_id: '1' } } })).raison, /faits j1 d'un autre run/);
  assert.match(ctl(tout({ runs: { ...RUNS, auto: { ...RUNS.auto, workflow_sha: 'a'.repeat(40) } } })).raison, /faits j1 d'un autre run/);
  const prov = (k, v) => (t) => modifier(t, (o) => { o.provenance[k] = v; });
  assert.match(ctl(tout({ textes: { ...TEXTES, j2: prov('run_attempt', '2')(J2) } })).raison, /faits j2 d'un autre run/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j3: prov('ref', 'refs/heads/x')(TEXTES.j3) } })).raison, /faits j3 d'un autre run/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j4: modifier(J4, (o) => { o.etat.commit = 'b'.repeat(40); }) } })).raison, /faits j4 d'une autre D3/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j1: modifier(TEXTES.j1, (o) => { o.etat.empreinte = 'b'.repeat(64); }) } })).raison, /faits j1 d'une autre D3/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j2f: modifier(TEXTES.j2f, (o) => { o.tentative = T.replace('/1', '/3'); }) } })).raison, /faits j2f d'une autre tentative/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j1: TEXTES.j2f } })).raison, /faits j1 d'une autre étape/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j3: J2 } })).raison, /faits j3 d'une autre étape/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j2: modifier(J2, (o) => { o.cout = null; }) } })).raison, /faits j2 illisibles/);
  assert.match(ctl(tout({ textes: { ...TEXTES, j4: modifier(J4, (o) => { delete o.statut; }) } })).raison, /faits j4 illisibles/);
  assert.match(ctl(tout({ textes: { ...TEXTES, at5: AT5.replace('"', ' "') } })).raison, /faits at5 : forme différente/, 'lisible par lireFaits, mais pas le texte écrit');
  assert.match(ctl(tout({ textes: { ...TEXTES, at5: `${AT5.slice(0, -2)}x}` } })).raison, /faits at5 illisibles/);
});

test('R8 contrôle : chaîne sans saut ; aucun fait absent complété ; aucun succès déduit d\'un échec', () => {
  const T0 = TEXTES;
  assert.match(ctl(tout({ textes: sans(T0, 'j1') })).raison, /faits j1 absents/);
  assert.match(ctl(tout({ textes: sans(T0, 'j3') })).raison, /faits j3 absents/);
  assert.match(ctl(tout({ textes: sans(T0, 'j2f') })).raison, /faits j2 sans frontière franchie/);
  assert.match(ctl(tout({ textes: sans(T0, 'j2') })).raison, /faits j4 sans réponse connue/);
  assert.match(ctl(tout({ textes: sans(T0, 'j2', 'j4', 'at5'), runs: { ...RUNS, at5: null } })).raison, /faits j2 absents alors que l'appel a été exécuté/);
  assert.match(ctl(tout({ textes: sans(T0, 'at5') })).raison, /faits at5 absents/);
  assert.match(ctl(tout({ textes: sans(T0, 'j4') })).raison, /faits at5 sans candidat créé/);
  assert.match(ctl(tout({ runs: { ...RUNS, at5: null } })).raison, /run AT-5 et faits at5 incohérents/);
  assert.match(ctl(tout({ textes: sans(T0, 'j4', 'at5') })).raison, /run AT-5 et faits at5 incohérents/);
  // J1 refusée : seuls J1 et J3 (garde non franchie, issue null) ; principal j1 ; tout fait postérieur est refusé.
  const refus = fJ1({ historique: { total: 1, runs: [{ id: Number(RUN_AUTO), display_title: 'atelier-auto autre/x/1', run_attempt: 1, created_at: '2026-10-20T15:00:00Z' }] } });
  assert.equal(refus.autorise, false);
  const j3g = fJ3({ garde: 'failure', appel: 'skipped' }).texte;
  const cR = ctl(tout({ textes: { j1: refus.texte, j3: j3g }, runs: { ...RUNS, at5: null } }));
  assert.equal(cR.raison, undefined);
  assert.deepEqual([cR.principal, cR.utilises], ['j1', ['j1']]);
  assert.match(ctl(tout({ textes: { j1: refus.texte, j2f: T0.j2f, j3: j3g }, runs: { ...RUNS, at5: null } })).raison, /faits j2f sans autorisation j1/);
  assert.match(ctl(tout({ textes: { j1: refus.texte, j3: fJ3({ appel: 'skipped' }).texte }, runs: { ...RUNS, at5: null } })).raison, /incohérent avec le refus j1/);
  // Frontière arrêtée : J3 non-emis (job d'appel... étape sautée) ; principal j3 ; J2 interdit.
  const arret = fJ2F({ sonde: { code: 0, sortie: 'HTTP/2.0 200 OK' } });
  assert.equal(arret.pret, false);
  const j3n = fJ3({ etape: 'skipped' }).texte;
  const cA = ctl(tout({ textes: { j1: T0.j1, j2f: arret.texte, j3: j3n }, runs: { ...RUNS, at5: null } }));
  assert.equal(cA.raison, undefined);
  assert.deepEqual([cA.principal, cA.utilises], ['j3', ['j3']]);
  assert.match(ctl(tout({ textes: { j1: T0.j1, j2f: arret.texte, j2: J2, j3: T0.j3 }, runs: { ...RUNS, at5: null } })).raison, /faits j2 sans frontière franchie/);
  assert.match(ctl(tout({ textes: { j1: T0.j1, j2f: T0.j2f, j2: J2, j3: j3n }, runs: { ...RUNS, at5: null } })).raison, /constat j3 incohérent avec l'appel j2/);
  // Issue inconnue (J2 non lisible : absent ; J3 « état incertain ») : principal j3 issue-inconnue, jamais un succès.
  const j3i = fJ3({ etape: null }).texte;
  const cI = ctl(tout({ textes: { j1: T0.j1, j2f: T0.j2f, j3: j3i }, runs: { ...RUNS, at5: null } }));
  assert.equal(cI.raison, undefined);
  assert.equal(cI.principal, 'j3');
  assert.equal(cI.lus.j3.issue, 'issue-inconnue');
  // Réponse connue sans candidat (J4 absent : job sauté) : principal j2, sans AT-5 ; J4 refusé par J4 lui-même : pas d'AT-5.
  const sansCand = ctl(tout({ textes: sans(T0, 'j4', 'at5'), runs: { ...RUNS, at5: null } }));
  assert.equal(sansCand.raison, undefined);
  assert.deepEqual(sansCand.utilises, ['j2']);
  const j4refus = modifier(J4, (o) => { o.statut = 'refus'; o.raison = 'branche-existante'; o.candidat = null; });
  if (!lireFaitsCandidat(j4refus).raison) {
    const c4 = ctl(tout({ textes: { ...sans(T0, 'at5'), j4: j4refus }, runs: { ...RUNS, at5: null } }));
    assert.equal(c4.raison, undefined);
    assert.deepEqual(c4.utilises, ['j2', 'j4']);
  }
});

test('R9 contrôle AT-5 : provenance (run, workflow, SHA du vérificateur) et demande = J4.demande_at5, sinon refus', () => {
  const f = JSON.parse(AT5);
  const at5 = (patch) => { const { empreinte, ...x } = structuredClone(f); patch(x); return ecrireFaits(x, hacherSha256); };
  assert.equal(at5(() => {}), AT5, 'le vérificateur réécrit le même texte');
  assert.match(ctl(tout({ runs: { ...RUNS, at5: { ...RUNS.at5, run_id: '1' } } })).raison, /faits at5 d'un autre run/);
  assert.match(ctl(tout({ runs: { ...RUNS, at5: { ...RUNS.at5, workflow_sha: 'c'.repeat(40) } } })).raison, /faits at5 d'un autre run/);
  assert.match(ctl(tout({ textes: { ...TEXTES, at5: at5((x) => { x.provenance.workflow_ref = x.provenance.workflow_ref.replace('heads/main', 'heads/autre'); }) } })).raison, /faits at5 d'un autre run/);
  // Demande de J4 différente de celle vérifiée par AT-5 (J4 rescellé ; mission non fournie pour isoler ce contrôle).
  for (const k of ['base', 'branche', 'candidat', 'version_base', 'version_candidat']) {
    const j4 = modifier(J4, (o) => { o.demande_at5[k] = k.startsWith('version') ? '9.9.9' : k === 'branche' ? 'atelier/x/y/9' : 'd'.repeat(40); });
    assert.match(ctl(tout({ textes: { ...TEXTES, j4 } }), { mission: null }).raison, /faits at5 d'une autre demande que J4/, `demande.${k}`);
  }
});

test('R10 contrôle Atelier : lireRetourAuto rejoué sur la pièce de T (candidat étranger, mission étrangère)', () => {
  const m = mission();
  m.base.sha = 'e'.repeat(40);
  assert.match(ctl(tout(), { mission: m }).raison, /retour AUTO refusé : candidat-etranger/);
  const m2 = mission();
  m2.tentative = 2;
  assert.match(ctl(tout(), { mission: m2 }).raison, /retour AUTO refusé : mission-etrangere/);
});

test('R11 pureté et fermeture : retour.js n\'importe que des modules de l\'atelier, sans horloge, hasard, réseau ni entrée/sortie', () => {
  const src = readFileSync(new URL('../app/atelier/retour.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./auto.js', './empreinte.js', './journal.js', './verification.js']);
  assert.doesNotMatch(src, /Date|Math\.random|fetch\(|process\.|require\(|import\(/);
  // Entrées jamais modifiées.
  const v = tout();
  const avant = JSON.stringify(v);
  texteRetour(v);
  assert.equal(JSON.stringify(v), avant);
  const a = api('j2');
  const av = JSON.stringify(a);
  lireAnnotations(a, ['j2']);
  assert.equal(JSON.stringify(a), av);
  void sceller;
});
