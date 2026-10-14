// v0.64.13 — « UNE FORME APPRISE PEUT PROPOSER UN FAIT » (autorisation ChatGPT « v0.64.13 », 14/10/2026).
// Une ACTION apprise (squelette + rôles par position) de capacité proposerFait, avec la constante persistée sujet = moi, reconnaît une phrase
// NOUVELLE et produit une STRUCTURE de fait proposée, sans rien écrire ; seule la confirmation (bouton, apprendreFait) écrit le fait.
// main.js n'est pas importable (DOM) : son raccord est vérifié par lecture de source (gardes S*), le reste sur le moteur réel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPACITES } from '../app/langage/registre.js';
import { evaluerAction, invoquerAction, reconnaitreActions } from '../app/langage/action.js';
import { magasinMemoireVive, apprendreAction } from '../app/langage/connaissances.js';
import { chargerEsprit, repondre, apprendreFait } from '../app/langage/esprit.js';
import { extraireLecon, apercuLecon } from '../app/langage/lecon.js';
import { reconnaitreAffirmationPossessive } from '../app/langage/interpretation.js';

const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const SE_NOMME = ['Mon chien se nomme Rex.', 'Mon chien se nomme Milo.', 'Mon chat se nomme Milo.'];
const S_APPELLE = ["Mon chien s'appelle Rex.", "Mon chien s'appelle Milo.", "Mon chat s'appelle Milo."];
const FORME = (exemples) => ({ operation: 'proposerFait', roles: ['relation', 'valeur'], constantes: { sujet: 'moi' }, exemples });

// Reproduit EXACTEMENT ce que main.js fait de la structure (garde S2) : aller-retour extraireLecon, sinon aucune proposition.
function propositionDeLecon(proposition) {
  const d = proposition && proposition.type === 'fait' ? proposition.donnees : null;
  if (!d) return null;
  const phrase = `Fait : ${d.sujet} / ${d.relation} / ${d.valeur}.`;
  const extrait = extraireLecon(phrase);
  if (!extrait || extrait.donnees.sujet !== d.sujet || extrait.donnees.relation !== d.relation || extrait.donnees.valeur !== d.valeur) return null;
  return { phrase, extrait, apercu: apercuLecon(extrait) };
}
async function enseigner(magasin, forme) {
  const r = evaluerAction(forme);
  assert.equal(r.ok, true, JSON.stringify(r));
  return apprendreAction(magasin, { operation: forme.operation, roles: r.roles, n: r.n, exemples: r.exemples, statut: r.statut, constantes: r.constantes, origine: 'apprise-conversation' });
}

test('F1. proposerFait est PURE : structure { type: fait, donnees } ; n\'accède jamais à l\'esprit ; structure incomplète → null', () => {
  const espritPiege = new Proxy({}, { get() { throw new Error('esprit lu'); }, set() { throw new Error('esprit modifié'); } });
  assert.deepEqual(CAPACITES.proposerFait.invoquer(espritPiege, { sujet: 'moi', relation: 'blurg', valeur: 'Zok' }), { type: 'fait', donnees: { sujet: 'moi', relation: 'blurg', valeur: 'Zok' } });
  for (const args of [{ relation: 'blurg', valeur: 'Zok' }, { sujet: 'moi', valeur: 'Zok' }, { sujet: 'moi', relation: ' ', valeur: 'Zok' }, {}, undefined]) {
    assert.equal(CAPACITES.proposerFait.invoquer(espritPiege, args), null, JSON.stringify(args));
  }
  assert.match(CAPACITES.proposerFait.representer({ type: 'fait', donnees: { sujet: 'moi', relation: 'blurg', valeur: 'Zok' } }), /moi → blurg → Zok/);
  const src = sansCommentaires(readFileSync(new URL('../app/langage/registre.js', import.meta.url), 'utf8'));
  const bloc = src.slice(src.indexOf('proposerFait: Object.freeze('));
  assert.doesNotMatch(bloc, /apprendreFait|ecrire|magasin|'moi'|"moi"/, 'aucune écriture, aucun sujet codé dans la capacité');
});

test('F2. evaluerAction : contrat EXACT des constantes ; capacités historiques strictement inchangées', () => {
  const ok = evaluerAction(FORME(SE_NOMME));
  assert.equal(ok.ok, true);
  assert.equal(ok.statut, 'validee');
  assert.deepEqual(ok.constantes, { sujet: 'moi' });
  assert.deepEqual(ok.roles, [{ position: 1, nom: 'relation' }, { position: 4, nom: 'valeur' }]);
  const sans = evaluerAction({ operation: 'proposerFait', roles: ['relation', 'valeur'], exemples: SE_NOMME });
  assert.equal(sans.raison, 'constantes_manquantes');
  assert.equal(evaluerAction({ ...FORME(SE_NOMME), constantes: {} }).raison, 'constantes_incorrectes', 'clé manquante');
  assert.equal(evaluerAction({ ...FORME(SE_NOMME), constantes: { sujet: 'moi', autre: 'x' } }).raison, 'constantes_incorrectes', 'clé supplémentaire');
  assert.equal(evaluerAction({ ...FORME(SE_NOMME), constantes: { sujet: '' } }).raison, 'constantes_incorrectes', 'valeur vide');
  const historique = evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: SE_NOMME });
  assert.equal(historique.ok, true);
  assert.equal(Object.hasOwn(historique, 'constantes'), false, 'aucun champ ajouté au résultat historique');
  assert.equal(evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: SE_NOMME, constantes: { sujet: 'moi' } }).raison, 'constantes_inattendues');
});

test('F3. un seul exemple : insuffisant ; deux positions qui varient ensemble : incertaine (jamais reconnue) ; trois exemples distinguant les positions : validée', () => {
  assert.equal(evaluerAction(FORME(SE_NOMME.slice(0, 1))).raison, 'insuffisant');
  const incertaine = evaluerAction(FORME(['Mon chien se nomme Rex.', 'Mon blurg se nomme Zok.']));
  assert.equal(incertaine.statut, 'incertaine');
  assert.deepEqual(reconnaitreActions([{ ...incertaine, operation: 'proposerFait' }], 'Mon chat se nomme Félix.'), { etat: 'aucune' });
  assert.equal(evaluerAction(FORME(SE_NOMME)).statut, 'validee');
  assert.equal(evaluerAction(FORME(["Mon chien s'appelle Rex.", "Ma tortue s'appelle Caroline.", "Mon blurg s'appelle Zok."])).raison, 'arite_roles_incompatible', 'Mon / Ma : limite conservée');
});

test('F4. apprendreAction : constantes persistées ; lignes historiques sans constantes inchangées ; fusion et remplacement versionné selon la signature', async () => {
  const magasin = magasinMemoireVive();
  const { objet } = await enseigner(magasin, FORME(SE_NOMME));
  assert.deepEqual(objet.constantes, { sujet: 'moi' });
  const hist = evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: ['zq zchien est zRex', 'zq zchien est zMilo', 'zq zchat est zMilo'] });
  const { objet: ancienne } = await apprendreAction(magasin, { operation: 'recherche', roles: hist.roles, n: hist.n, exemples: hist.exemples, statut: hist.statut });
  assert.equal(Object.hasOwn(ancienne, 'constantes'), false, 'aucune constante ajoutée à une action historique');
  // même squelette, même association (constantes comprises) → les exemples fusionnent
  const r2 = await enseigner(magasin, FORME([...SE_NOMME, 'Mon furet se nomme Zorro.']));
  assert.equal(r2.objet.id, objet.id);
  assert.equal(r2.objet.exemples.length, 4);
  // même squelette, constante DIFFÉRENTE → remplacement versionné (jamais deux formes actives concurrentes de même squelette)
  const r3 = await enseigner(magasin, { ...FORME(SE_NOMME), constantes: { sujet: 'naissance' } });
  assert.notEqual(r3.objet.id, objet.id);
  assert.equal(r3.objet.precedent, objet.id);
  const lignes = await magasin.lireTout('actions');
  assert.equal(lignes.find((a) => a.id === objet.id).statut, 'remplacee');
});

test('F5. invoquerAction : constantes ajoutées aux arguments (jamais des positions) ; constantes incorrectes → aucune invocation', () => {
  const forme = { ...evaluerAction(FORME(SE_NOMME)), operation: 'proposerFait' };
  const inv = invoquerAction(forme, {}, 'Mon blurg se nomme Zok.');
  assert.equal(inv.ok, true);
  assert.deepEqual(inv.arguments, { relation: 'blurg', valeur: 'Zok', sujet: 'moi' });
  assert.deepEqual(inv.provenancePositions, { relation: 1, valeur: 4 });
  assert.deepEqual(inv.resultat, { type: 'fait', donnees: { sujet: 'moi', relation: 'blurg', valeur: 'Zok' } });
  assert.equal(invoquerAction({ ...forme, constantes: undefined }, {}, 'Mon blurg se nomme Zok.').raison, 'constantes_incorrectes');
  assert.equal(invoquerAction({ ...forme, constantes: { sujet: 'moi', x: 'y' } }, {}, 'Mon blurg se nomme Zok.').raison, 'constantes_incorrectes');
});

test('F6. ABLATION « se nomme » + PERSISTANCE : forme enseignée, rechargement, phrase NOUVELLE → proposition moi → blurg → Zok, sans J1a ; confirmation ; rechargement ; « mon blurg ? » → Zok', async () => {
  const magasin = magasinMemoireVive();
  await enseigner(magasin, FORME(SE_NOMME)); // A + B : forme enseignée et validée (persistée dans « actions »)
  let e = await chargerEsprit(magasin); // C : rechargement réel
  assert.equal(e.actions.length, 1);
  assert.deepEqual(e.actions[0].constantes, { sujet: 'moi' }, 'persistance de la FORME');
  const phrase = 'Mon blurg se nomme Zok.';
  assert.equal(SE_NOMME.includes(phrase), false, 'phrase jamais vue');
  assert.deepEqual(reconnaitreAffirmationPossessive(phrase, { lexique: e.lexique }), { ok: false, motif: 'hors cadre' }, 'J1a REFUSE cette phrase');
  const reco = reconnaitreActions(e.actions, phrase); // D
  assert.equal(reco.etat, 'unique');
  const inv = invoquerAction(reco.action, e, phrase);
  const prop = propositionDeLecon(inv.resultat);
  assert.equal(prop.apercu, "J'ai compris : moi → blurg → Zok. C'est correct ?"); // E
  assert.deepEqual(await magasin.lireTout('faits'), [], 'aucune écriture avant confirmation');
  await apprendreFait(e, { ...prop.extrait.donnees, origine: 'apprise-conversation' }); // F : bouton Confirmer
  e = await chargerEsprit(magasin); // G
  assert.deepEqual((await magasin.lireTout('faits')).map((f) => [f.sujet, f.relation, f.valeur]), [['moi', 'blurg', 'Zok']], 'persistance du FAIT');
  assert.equal((await magasin.lireTout('actions')).length, 1, 'la forme reste distincte du fait');
  const r = repondre(e, 'mon blurg ?'); // H
  assert.equal(r.texte, 'Zok'); // I
});

test('F7. cas J1 : une forme apprise « s\'appelle » reconnaît « Mon blurg s\'appelle Zok. » (chemin forme, avant J1a)', async () => {
  const magasin = magasinMemoireVive();
  await enseigner(magasin, FORME(S_APPELLE));
  const e = await chargerEsprit(magasin);
  const reco = reconnaitreActions(e.actions, "Mon blurg s'appelle Zok.");
  assert.equal(reco.etat, 'unique');
  assert.equal(reco.action.operation, 'proposerFait');
  const prop = propositionDeLecon(invoquerAction(reco.action, e, "Mon blurg s'appelle Zok.").resultat);
  assert.equal(prop.phrase, 'Fait : moi / blurg / Zok.');
});

test('F8. AMBIGUÏTÉ : deux formes validées distinctes reconnaissent la même phrase → abstention, aucune invocation, aucune proposition, aucune écriture', async () => {
  const magasin = magasinMemoireVive();
  await enseigner(magasin, FORME(SE_NOMME));
  // seconde forme, squelette DIFFÉRENT (le possessif varie aussi), capacité historique à trois rôles
  const autre = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: ['Mon chien se nomme Rex.', 'Ton chien se nomme Rex.', 'Mon chat se nomme Rex.', 'Mon chien se nomme Milo.'] });
  assert.equal(autre.statut, 'validee');
  await apprendreAction(magasin, { operation: 'confrontation', roles: autre.roles, n: autre.n, exemples: autre.exemples, statut: autre.statut });
  const e = await chargerEsprit(magasin);
  assert.equal(e.actions.filter((a) => a.statut === 'validee').length, 2);
  const reco = reconnaitreActions(e.actions, 'Mon blurg se nomme Zok.');
  assert.equal(reco.etat, 'ambigu');
  assert.deepEqual(await magasin.lireTout('faits'), []);
});

test('S1. main.js : leçon « Action : » avec ligne facultative « Constantes : » ; constantes transmises au candidat puis à la persistance', () => {
  const main = sansCommentaires(readFileSync(new URL('../app/main.js', import.meta.url), 'utf8'));
  const ecran = sansCommentaires(readFileSync(new URL('../app/langage/ecran.js', import.meta.url), 'utf8'));
  assert.match(main, /const MOT_CONSTANTES_ACTION = \/\^constantes\\s\*:\\s\*\(\.\+\)\$\/i;/);
  assert.match(main, /evaluerAction\(\{ operation, roles, exemples, \.\.\.\(constantes !== undefined \? \{ constantes \} : \{\}\) \}\)/);
  assert.match(ecran, /\.\.\.\(candidat\.constantes !== undefined \? \{ constantes: candidat\.constantes \} : \{\}\)/);
});

test('S2. main.js : raccord proposerFait → aller-retour extraireLecon → proposerLecon, sans écriture, AVANT J1a ; l\'ambiguïté garde son abstention', () => {
  const main = sansCommentaires(readFileSync(new URL('../app/main.js', import.meta.url), 'utf8'));
  const corps = main.slice(main.indexOf('async function traiterTour('));
  const iForme = corps.indexOf("if (reconnaissanceAction.reconnu && reconnaissanceAction.ok && reconnaissanceAction.operation === 'proposerFait')");
  const iAbstention = corps.indexOf('if (reconnaissanceAction.reconnu) {');
  const iJ1a = corps.indexOf('reconnaitreAffirmationPossessive(texte,');
  assert.ok(iForme > 0 && iForme < iAbstention && iAbstention < iJ1a, 'forme apprise, puis abstention existante, puis J1a');
  const bloc = corps.slice(iForme, iAbstention);
  assert.match(bloc, /reconnaissanceAction\.reconnu && reconnaissanceAction\.ok && reconnaissanceAction\.operation === 'proposerFait'/);
  assert.match(bloc, /extraireLecon\(phraseFait\)/);
  assert.match(bloc, /proposerLecon\(texte, extraitFait, phraseFait, sourceProposition\(message, \{ nom: 'forme-apprise', idAction: reconnaissanceAction\.idAction \}\)\)/); // MISE À JOUR DÉLIBÉRÉE v0.64.14 : + source structurée (message-N, voie forme-apprise, identité de l'action)
  assert.doesNotMatch(bloc, /apprendreFait\(|ecrireConnaissance\(|esprit\.repondre\(/);
});

test('S3. ecran.js : une capacité à constantes n\'est jamais rejouée (traces écartées avant le calcul des possibilités, garde défensive)', () => {
  const ecran = sansCommentaires(readFileSync(new URL('../app/langage/ecran.js', import.meta.url), 'utf8'));
  assert.match(ecran, /possibilitesRejeuAdmissibles\(tracesRejouables, texte\)/);
  assert.match(ecran, /if \(Array\.isArray\(capacite\.constantes\) && capacite\.constantes\.length\) return \{ reconnu: false \};/);
  assert.match(ecran, /operation: action\.operation, resultat: invocation\.resultat,/);
});
