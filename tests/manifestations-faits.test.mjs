// v0.64.14 — « CONSERVER L'EXPÉRIENCE D'UN FAIT CONFIRMÉ » (GO ChatGPT, 14/10/2026, option A).
// Quand un fait proposé depuis un message est RÉELLEMENT accepté, une manifestation historique, persistante et immuable relie :
// message source (idMessage = message-N) ↔ fait tel qu'il a été confirmé ↔ voie structurée de la proposition.
// main.js n'est pas importable (DOM) : le raccord (message-N transmis, voies aux quatre sites d'appel, point d'écriture dans onOui) est vérifié par
// lecture de source (M0), puis le chemin est REJOUÉ avec les fonctions réelles qu'il appelle : identifierMessage + conserverValeurMessage (pont),
// reconnaissance (J1a / action apprise / leçon), apprendreFait (branche « fait » de ecrireConnaissance), puis enregistrerManifestationFait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  magasinMemoireVive, nouvelId, enregistrerValeurDonnee, apprendreAction, ouvrirIndexedDB,
  enregistrerManifestationFait, lireManifestationsFaits, VOIES_MANIFESTATION, TABLES, CLE, NOM_BASE, VERSION_BASE,
} from '../app/langage/connaissances.js';
import { identifierMessage, conserverValeurMessage } from '../app/langage/pont.js';
import { chargerEsprit, repondre, apprendreFait, apprendreRelation } from '../app/langage/esprit.js';
import { evaluerAction, reconnaitreActions, invoquerAction } from '../app/langage/action.js';
import { extraireLecon } from '../app/langage/lecon.js';
import { reconnaitreAffirmationPossessive, estEnseignementNaturel, interpreterEnseignement } from '../app/langage/interpretation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';

const RACINE = new URL('..', import.meta.url).pathname;
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const SE_NOMME = ['Mon chien se nomme Rex.', 'Mon chien se nomme Milo.', 'Mon chat se nomme Milo.'];
const MARQUEUR_APPRENTISSAGE = /^apprends\s*:\s*/i;

// --- REJEU DU CHEMIN RÉEL -------------------------------------------------------------------------------------------------------------------------
// pont.traiterTourAvecEnonce : identité du message PUIS conservation de sa valeur brute (valeursDonnees), avant tout traitement.
async function recevoir(magasin, texte) {
  const message = identifierMessage(texte, { nouvelId });
  await conserverValeurMessage(message, { enregistrerValeur: (entree) => enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// traiterTour : même ordre que main.js (marqueurs → action apprise → J1a). Rend { extrait, voie } ou null — la voie est STRUCTURÉE, fixée par le site
// d'appel qui produit la proposition, jamais déduite après coup du texte (c'est ce que M0 vérifie dans main.js).
function proposer(e, texte) {
  if (estEnseignementNaturel(texte)) {
    const r = interpreterEnseignement(texte, { lexique: e.lexique });
    return r.ok ? { extrait: r.extrait, voie: { nom: 'apprends-que' } } : null;
  }
  if (MARQUEUR_APPRENTISSAGE.test(texte)) {
    const extrait = extraireLecon(texte.replace(MARQUEUR_APPRENTISSAGE, '').trim());
    return extrait ? { extrait, voie: { nom: 'lecon-technique' } } : null;
  }
  const reco = reconnaitreActions(e.actions || [], texte);
  if (reco.etat === 'unique' && reco.action.operation === 'proposerFait') {
    const inv = invoquerAction(reco.action, e, texte);
    if (!inv.ok) return null;
    const d = inv.resultat.donnees;
    const extrait = extraireLecon(`Fait : ${d.sujet} / ${d.relation} / ${d.valeur}.`);
    return { extrait, voie: { nom: 'forme-apprise', idAction: reco.action.id } };
  }
  if (reco.etat !== 'aucune') return null;
  const a = reconnaitreAffirmationPossessive(texte, { lexique: e.lexique });
  return a.ok ? { extrait: a.extrait, voie: { nom: 'j1a' } } : null;
}
// onOui : ecrireConnaissance (même aiguillage par type que ecran.js : fait → apprendreFait, relation → apprendreRelation) ; SEULEMENT si elle rend un
// fait accepté (r.type === 'fait', aucune exception), la manifestation, copie de r.objet.
async function confirmer(e, message, proposition) {
  const { type, donnees } = proposition.extrait;
  const r = type === 'fait' ? await apprendreFait(e, { ...donnees, origine: 'apprise-conversation' }) : await apprendreRelation(e, { ...donnees, origine: 'apprise-conversation' });
  if (r && r.type === 'fait' && r.objet) {
    await enregistrerManifestationFait(e.magasin, { idMessage: message.id, fait: { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur }, voie: proposition.voie });
  }
  return r;
}
async function enseignerForme(magasin) {
  const r = evaluerAction({ operation: 'proposerFait', roles: ['relation', 'valeur'], constantes: { sujet: 'moi' }, exemples: SE_NOMME });
  assert.equal(r.statut, 'validee');
  return (await apprendreAction(magasin, { operation: 'proposerFait', roles: r.roles, n: r.n, exemples: r.exemples, statut: r.statut, constantes: r.constantes, origine: 'apprise-conversation' })).objet;
}
// « fermer / recharger » : seule la donnée sérialisée survit (aucune fermeture, aucun objet JS ancien), puis l'esprit est reconstruit depuis elle.
async function redemarrer(magasin) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await magasin.lireTout(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(donnees);
  return { magasin: neuf, esprit: await chargerEsprit(neuf) };
}
const parValeur = (ms) => Object.fromEntries(ms.map((m) => [m.fait.valeur, m]));

// --- M0 : LE RACCORD RÉEL (lecture de source) ------------------------------------------------------------------------------------------------------
test('M0. main.js : message-N transmis explicitement, quatre voies aux quatre sites d\'appel, écriture APRÈS le fait accepté dans onOui, jamais dans onNon', () => {
  const main = sansCommentaires(readFileSync(join(RACINE, 'app', 'main.js'), 'utf8'));
  assert.match(main, /traiter: \(message\) => traiterTour\(texte, options, referenceTrace, message\),/);
  assert.match(main, /async function traiterTour\(texte, options, referenceTrace, message = null\) \{/);
  assert.match(main, /return proposerLecon\(texte, r\.extrait, r\.phrase, sourceProposition\(message, \{ nom: 'apprends-que' \}\)\);/);
  // MISE À JOUR DÉLIBÉRÉE v0.64.15 (référence explicite à un message naturel) : la leçon technique transmet EN PLUS, pour un fait seulement, la référence admise ; la source L est inchangée.
  assert.match(main, /return proposerLecon\(texte, extrait, contenuLecon, sourceProposition\(message, \{ nom: 'lecon-technique' \}\), extrait\.type === 'fait' \? referenceSupervisee\(options, message\) : null\);/);
  assert.match(main, /proposerLecon\(texte, extraitFait, phraseFait, sourceProposition\(message, \{ nom: 'forme-apprise', idAction: reconnaissanceAction\.idAction \}\)\)/);
  assert.match(main, /if \(affirmation && affirmation\.ok\) return proposerLecon\(texte, affirmation\.extrait, affirmation\.phrase, sourceProposition\(message, \{ nom: 'j1a' \}\)\);/);
  assert.equal(main.match(/proposerLecon\(texte,/g).length, 5, 'la définition + quatre sites d\'appel');
  assert.equal(main.match(/proposerLecon\(texte, [\w.]+, [\w.]+, sourceProposition\(message, \{ nom: '/g).length, 4, 'les quatre sites d\'appel portent une voie');
  assert.match(main, /function sourceProposition\(message, voie\) \{\s*return message && typeof message\.id === 'string' && message\.id\.length > 0 \? \{ idMessage: message\.id, voie \} : null;/);
  const oui = main.slice(main.indexOf('onOui: async () => {'), main.indexOf('onNon: async () => {'));
  const non = main.slice(main.indexOf('onNon: async () => {'), main.indexOf('onNon: async () => {') + 400);
  const iEcrire = oui.indexOf("const r = await ecranLangage.ecrireConnaissance(e, extrait, { origine: 'apprise-conversation', exemple: contenuLecon });");
  const iGarde = oui.indexOf("if (source && r && r.type === 'fait' && r.objet) {");
  const iManif = oui.indexOf('await enregistrerManifestationFait(e.magasin, { idMessage: source.idMessage, fait: { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur }, voie: source.voie });');
  const iCatch = oui.indexOf('} catch (err) { reponseFinale = err.message; }');
  assert.ok(iEcrire > 0 && iEcrire < iGarde && iGarde < iManif && iManif < iCatch, 'ecrireConnaissance → garde « fait accepté » → manifestation, le tout avant le catch du refus');
  assert.doesNotMatch(non, /enregistrerManifestationFait/);
  assert.equal(main.match(/enregistrerManifestationFait\(/g).length, 2, 'la manifestation L, puis la seule manifestation supervisée M (même onOui)'); // MISE À JOUR DÉLIBÉRÉE v0.64.15 (était 1 : + écriture de M après L, voir tests/reference-message.test.mjs R0)
  const ecran = sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'ecran.js'), 'utf8'));
  assert.match(ecran, /operation: action\.operation, resultat: invocation\.resultat,\s*idAction: action\.id,/, 'identité réelle de l\'action reconnue, jamais recherchée');
  const pont = sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'pont.js'), 'utf8'));
  assert.match(pont, /const resultat = await traiter\(message\);/, 'le pont transmettait déjà le message : seule la fermeture de main.js l\'ignorait');
});

// --- M1 : TEST DÉCISIF ------------------------------------------------------------------------------------------------------------------------------
test('M1. décisif : Rex ✔, Milo ✔, Félix ✘ (Annuler), Pan (sans réponse), Zok ✔ (forme apprise), Zorro ✔ (leçon technique), redémarrage', async () => {
  let magasin = magasinMemoireVive();
  const action = await enseignerForme(magasin);
  let e = await chargerEsprit(magasin);
  const tours = {};
  for (const [cle, texte, geste] of [
    ['rex', "Mon chien s'appelle Rex.", 'oui'],
    ['milo', "Mon chien s'appelle Milo.", 'oui'],
    ['felix', "Mon chat s'appelle Félix.", 'non'],
    ['pan', "Mon lapin s'appelle Pan.", 'rien'],
    ['zok', 'Mon blurg se nomme Zok.', 'oui'],
    ['zorro', 'Apprends : Fait : moi / furet / Zorro.', 'oui'],
  ]) {
    const message = await recevoir(magasin, texte);
    const p = proposer(e, texte);
    assert.ok(p && p.extrait.type === 'fait', `proposition pour ${texte}`);
    tours[cle] = { message, p };
    if (geste === 'oui') await confirmer(e, message, p); // 'non' (onNon) et 'rien' n'appellent rien
  }
  assert.deepEqual(tours.zok.p.voie, { nom: 'forme-apprise', idAction: action.id });
  ({ magasin, esprit: e } = await redemarrer(magasin));
  // faits courants
  assert.deepEqual((await magasin.lireTout('faits')).map((f) => [f.sujet, f.relation, f.valeur]).sort(), [['moi', 'blurg', 'Zok'], ['moi', 'chien', 'Milo'], ['moi', 'furet', 'Zorro']]);
  assert.equal(repondre(e, "Comment s'appelle mon chien ?").texte, 'Milo');
  // manifestations
  const ms = await lireManifestationsFaits(magasin);
  assert.equal(ms.length, 4);
  const v = parValeur(ms);
  assert.deepEqual(Object.keys(v).sort(), ['Milo', 'Rex', 'Zok', 'Zorro']);
  const attendu = {
    Rex: ['rex', { sujet: 'moi', relation: 'chien', valeur: 'Rex' }, { nom: 'j1a' }],
    Milo: ['milo', { sujet: 'moi', relation: 'chien', valeur: 'Milo' }, { nom: 'j1a' }],
    Zok: ['zok', { sujet: 'moi', relation: 'blurg', valeur: 'Zok' }, { nom: 'forme-apprise', idAction: action.id }],
    Zorro: ['zorro', { sujet: 'moi', relation: 'furet', valeur: 'Zorro' }, { nom: 'lecon-technique' }],
  };
  for (const [valeur, [cle, fait, voie]] of Object.entries(attendu)) {
    assert.deepEqual(v[valeur], { idMessage: tours[cle].message.id, texte: tours[cle].message.texte, fait, voie }, valeur);
  }
  // le texte exact reste résoluble PAR L'IDENTITÉ dans valeursDonnees (aucune recherche par texte)
  const valeurs = new Map((await magasin.lireTout('valeursDonnees')).map((x) => [x.id, x.valeur]));
  assert.equal(valeurs.get(v.Rex.idMessage), "Mon chien s'appelle Rex.");
  assert.equal(valeurs.get(v.Milo.idMessage), "Mon chien s'appelle Milo.");
  // Félix et Pan : messages conservés (historique inchangé), AUCUNE manifestation
  const ids = new Set(ms.map((m) => m.idMessage));
  for (const cle of ['felix', 'pan']) {
    assert.equal(valeurs.has(tours[cle].message.id), true, `${cle} : la valeur du message reste conservée`);
    assert.equal(ids.has(tours[cle].message.id), false, `${cle} : aucune manifestation`);
  }
  // la forme source est retrouvable par l'identité conservée
  assert.equal((await magasin.lireTout('actions')).find((a) => a.id === v.Zok.voie.idAction).operation, 'proposerFait');
});

test('M2. Apprends que : même canal, voie « apprends-que » ; une leçon technique d\'un autre type (relation) ne produit aucune manifestation', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const m1 = await recevoir(magasin, 'Apprends que ma ville est Cognac.');
  const p1 = proposer(e, m1.texte);
  await confirmer(e, m1, p1);
  const m2 = await recevoir(magasin, 'Apprends : Mot : vélo désigne bicyclette.');
  const p2 = proposer(e, m2.texte);
  assert.deepEqual([p2.extrait.type, p2.voie], ['relation', { nom: 'lecon-technique' }]);
  const r2 = await confirmer(e, m2, p2);
  assert.equal(r2.type, 'relation', 'connaissance réellement apprise, mais ce n\'est pas un fait : garde non franchie');
  assert.deepEqual(await lireManifestationsFaits(magasin), [{ idMessage: m1.id, texte: 'Apprends que ma ville est Cognac.', fait: { sujet: 'moi', relation: 'ville', valeur: 'Cognac' }, voie: { nom: 'apprends-que' } }]);
});

// --- M3 : CONFLIT -----------------------------------------------------------------------------------------------------------------------------------
test('M3. conflit réel : apprendreFait refuse → aucune manifestation supplémentaire, aucun fait écrit', async () => {
  let magasin = magasinMemoireVive();
  let e = await chargerEsprit(magasin);
  const rex = await recevoir(magasin, "Mon chien s'appelle Rex.");
  await confirmer(e, rex, proposer(e, rex.texte));
  await magasin.ecrire('faits', { cle: 'autre-surface', sujet: 'moi', relation: 'chien', valeur: 'Milo', origine: 'apprise-christophe' });
  e = await chargerEsprit(magasin);
  const avantFaits = await magasin.lireTout('faits');
  const avant = await lireManifestationsFaits(magasin);
  const max = await recevoir(magasin, "Mon chien s'appelle Max.");
  const p = proposer(e, max.texte);
  assert.equal(p.voie.nom, 'j1a');
  await assert.rejects(() => confirmer(e, max, p), /plusieurs réponses différentes/);
  assert.deepEqual(await magasin.lireTout('faits'), avantFaits);
  assert.deepEqual(await lireManifestationsFaits(magasin), avant);
  assert.equal(avant.length, 1);
  ({ magasin } = await redemarrer(magasin));
  assert.equal((await lireManifestationsFaits(magasin)).some((m) => m.idMessage === max.id), false);
});

// --- M4 : IMMUTABILITÉ ------------------------------------------------------------------------------------------------------------------------------
test('M4. immuable : Rex reste moi/chien/Rex quand le fait courant change encore, quand la forme est remplacée ; aucune réécriture possible', async () => {
  let magasin = magasinMemoireVive();
  const action = await enseignerForme(magasin);
  let e = await chargerEsprit(magasin);
  const rex = await recevoir(magasin, "Mon chien s'appelle Rex.");
  await confirmer(e, rex, proposer(e, rex.texte));
  const milo = await recevoir(magasin, "Mon chien s'appelle Milo.");
  await confirmer(e, milo, proposer(e, milo.texte));
  const zok = await recevoir(magasin, 'Mon blurg se nomme Zok.');
  await confirmer(e, zok, proposer(e, zok.texte));
  const figee = JSON.parse(JSON.stringify(await magasin.lireTout('manifestationsFaits')));
  // le fait courant change encore, le lexique change, la forme est remplacée
  await apprendreFait(e, { sujet: 'moi', relation: 'chien', valeur: 'Médor', origine: 'apprise-christophe' });
  await apprendreFait(e, { sujet: 'moi', relation: 'blurg', valeur: 'Zut', origine: 'apprise-christophe' });
  await magasin.ecrire('lexique', { mot: 'chien', role: 'relation', relation: 'chien' });
  await magasin.ecrire('actions', { ...action, statut: 'remplacee' });
  // réécriture refusée, même identique, même par une autre voie
  for (const entree of [
    { idMessage: rex.id, fait: { sujet: 'moi', relation: 'chien', valeur: 'Médor' }, voie: { nom: 'j1a' } },
    { idMessage: rex.id, fait: { sujet: 'moi', relation: 'chien', valeur: 'Rex' }, voie: { nom: 'j1a' } },
    { idMessage: rex.id, fait: { sujet: 'moi', relation: 'chien', valeur: 'Rex' }, voie: { nom: 'lecon-technique' } },
  ]) await assert.rejects(() => enregistrerManifestationFait(magasin, entree), /immuable/);
  ({ magasin, esprit: e } = await redemarrer(magasin));
  assert.equal(repondre(e, "Comment s'appelle mon chien ?").texte, 'Médor');
  assert.deepEqual(await magasin.lireTout('manifestationsFaits'), figee, 'aucune ligne n\'a suivi la table faits, le lexique ni l\'action');
  const v = parValeur(await lireManifestationsFaits(magasin));
  assert.deepEqual(v.Rex.fait, { sujet: 'moi', relation: 'chien', valeur: 'Rex' });
  assert.deepEqual(v.Zok.voie, { nom: 'forme-apprise', idAction: action.id });
  // la vue est une COPIE : la modifier ne touche pas la donnée persistée
  v.Rex.fait.valeur = 'X'; v.Rex.voie.nom = 'Y';
  assert.deepEqual(await magasin.lireTout('manifestationsFaits'), figee);
});

// --- M5 : DEUX MESSAGES IDENTIQUES ------------------------------------------------------------------------------------------------------------------
test('M5. deux occurrences identiques de « Mon chien s\'appelle Rex. », confirmées : deux message-N, deux manifestations, aucune fusion', async () => {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const a = await recevoir(magasin, "Mon chien s'appelle Rex.");
  await confirmer(e, a, proposer(e, a.texte));
  const b = await recevoir(magasin, "Mon chien s'appelle Rex.");
  await confirmer(e, b, proposer(e, b.texte));
  assert.notEqual(a.id, b.id);
  const ms = await lireManifestationsFaits(magasin);
  assert.deepEqual(ms.map((m) => m.idMessage).sort(), [a.id, b.id].sort());
  for (const m of ms) assert.deepEqual([m.texte, m.fait, m.voie], ["Mon chien s'appelle Rex.", { sujet: 'moi', relation: 'chien', valeur: 'Rex' }, { nom: 'j1a' }]);
  assert.deepEqual((await magasin.lireTout('faits')).map((f) => f.valeur), ['Rex'], 'le fait courant, lui, reste unique');
});

// --- M6 : CONTRAT D'ÉCRITURE --------------------------------------------------------------------------------------------------------------------------
test('M6. contrat exact : schéma { idMessage, fait, voie } ; voies fermées ; idAction réservée à forme-apprise et réelle ; message réellement conservé', async () => {
  const magasin = magasinMemoireVive();
  const action = await enseignerForme(magasin);
  const m = await recevoir(magasin, 'Mon blurg se nomme Zok.');
  const fait = { sujet: 'moi', relation: 'blurg', valeur: 'Zok' };
  assert.deepEqual([...VOIES_MANIFESTATION], ['j1a', 'apprends-que', 'lecon-technique', 'forme-apprise', 'reference-explicite']); // MISE À JOUR DÉLIBÉRÉE v0.64.15 (cinquième voie, contrat testé dans tests/reference-message.test.mjs R5)
  for (const [entree, motif] of [
    [{ idMessage: m.id, fait, voie: { nom: 'devinee' } }, /voie\.nom inconnue/],
    [{ idMessage: m.id, fait, voie: { nom: 'forme-apprise' } }, /champ « idAction »/],
    [{ idMessage: m.id, fait, voie: { nom: 'forme-apprise', idAction: 'action-inventee' } }, /aucune action/],
    [{ idMessage: m.id, fait, voie: { nom: 'j1a', idAction: action.id } }, /n'appartient qu'à la voie forme-apprise/],
    [{ idMessage: 'message-jamais-conserve', fait, voie: { nom: 'j1a' } }, /aucun message conservé/],
    [{ idMessage: m.id, fait: { ...fait, confiance: 1 }, voie: { nom: 'j1a' } }, /champ étranger/],
    [{ idMessage: m.id, fait, voie: { nom: 'j1a' }, horodatage: 'x' }, /champ étranger/],
    [{ idMessage: m.id, fait, voie: { nom: 'j1a', score: 2 } }, /champ étranger/],
    [{ idMessage: m.id, fait: { ...fait, valeur: ' ' }, voie: { nom: 'j1a' } }, /fait\.valeur/],
    [{ idMessage: '', fait, voie: { nom: 'j1a' } }, /idMessage/],
    [{ idMessage: m.id, voie: { nom: 'j1a' } }, /champ « fait »/],
  ]) await assert.rejects(() => enregistrerManifestationFait(magasin, entree), motif, JSON.stringify(entree));
  assert.deepEqual(await magasin.lireTout('manifestationsFaits'), [], 'aucun refus n\'écrit');
  const ecrite = await enregistrerManifestationFait(magasin, { idMessage: m.id, fait, voie: { nom: 'forme-apprise', idAction: action.id } });
  assert.deepEqual(ecrite, { idMessage: m.id, fait, voie: { nom: 'forme-apprise', idAction: action.id } });
  const [ligne] = await magasin.lireTout('manifestationsFaits');
  assert.deepEqual(Object.keys(ligne), ['idMessage', 'fait', 'voie'], 'ni id second, ni horodatage, ni score, ni compteur');
  assert.equal(CLE.manifestationsFaits, 'idMessage');
});

// --- M7 : PERSISTANCE INDEXEDDB (migration 24 → 25) -------------------------------------------------------------------------------------------------
test('M7. migration additive : VERSION_BASE 25 ne crée QUE « manifestationsFaits » (clé idMessage) sur une base de version 24, sans toucher aux autres tables', async () => {
  assert.equal(VERSION_BASE, 27); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables)
  assert.equal(TABLES[TABLES.length - 3], 'manifestationsFaits'); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : base 25 → 26, schéma courant 15 → 16 (futur 16 → 17), position/tranche décalée d'un rang (+ table decisionsFormes déclarée en dernier : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : positions relatives décalées d'un rang (+ table reponsesAttendues déclarée en dernier)
  const existants = TABLES.filter((t) => t !== 'manifestationsFaits');
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) {
    nom = n; version = v;
    const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction() { throw new Error('non utilisé'); } };
    const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
    return r;
  } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 27); // MISE À JOUR DÉLIBÉRÉE v0.64.17 : base 25 → 26, schéma courant 15 → 16 (futur 16 → 17), position/tranche décalée d'un rang (+ table decisionsFormes déclarée en dernier : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables)
  assert.deepEqual(crees, [['manifestationsFaits', 'idMessage']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});

// --- M8 : NON-ADMISSION -----------------------------------------------------------------------------------------------------------------------------
test('M8. DORMANTE : l\'univers d\'observation, ses possibilités et l\'esprit sont identiques avec ou sans manifestations ; aucun autre lecteur', async () => {
  const magasin = magasinMemoireVive();
  const action = await enseignerForme(magasin);
  const e = await chargerEsprit(magasin);
  for (const texte of ["Mon chien s'appelle Rex.", "Mon chien s'appelle Milo.", 'Mon blurg se nomme Zok.', 'Apprends : Fait : moi / furet / Zorro.']) {
    const m = await recevoir(magasin, texte);
    await confirmer(e, m, proposer(e, texte));
  }
  assert.equal((await magasin.lireTout('manifestationsFaits')).length, 4);
  assert.ok(action.id);
  const observer = async (mg, message) => {
    const ecrites = [];
    const r = await observerPossibilites(message, { enregistrer: async (d) => { ecrites.push(JSON.parse(JSON.stringify(d))); return { id: 'obs', ...d }; }, lireExecutions: () => mg.lireTout('executionsOperations') });
    return { statut: r.statut ?? null, univers: JSON.parse(JSON.stringify(r.univers ?? null)), ecrites };
  };
  const message = await recevoir(magasin, 'Comment s\'appelle mon chien ?');
  const avec = await observer(magasin, message);
  const espritAvec = await chargerEsprit(magasin);
  const sans = magasinMemoireVive();
  const donnees = {};
  for (const t of TABLES) donnees[t] = t === 'manifestationsFaits' ? [] : await magasin.lireTout(t);
  await sans.remplacerTout(donnees);
  const sansObs = await observer(sans, message);
  const espritSans = await chargerEsprit(sans);
  assert.deepEqual(avec, sansObs, 'même univers, mêmes possibilités, même ligne d\'observation');
  for (const cle of Object.keys(espritAvec)) {
    if (cle === 'magasin') continue;
    assert.deepEqual(espritAvec[cle], espritSans[cle], `esprit.${cle}`);
  }
  for (const q of ["Comment s'appelle mon chien ?", 'Quel est mon blurg ?', 'Quel est mon furet ?']) assert.deepEqual(repondre(espritAvec, q), repondre(espritSans, q), q);
  // aucun autre lecteur dans l'application (hors commentaires ; l'export de sauvegarde la copie par la liste TABLES, sans la lire) : seuls connaissances.js (définition + vue pure) et main.js (unique écriture) nomment la table ou ses fonctions
  const fichiers = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (p.endsWith('.js')) fichiers.push(p); } };
  parcourir(join(RACINE, 'app'));
  const lecteurs = fichiers.filter((p) => /manifestationsFaits|ManifestationFait|ManifestationsFaits|VOIES_MANIFESTATION/.test(readFileSync(p, 'utf8').split('\n').map((l) => l.replace(/\s\/\/ .*$/, '')).filter((l) => !l.trim().startsWith('//')).join('\n'))).map((p) => p.slice(RACINE.length)).sort();
  assert.deepEqual(lecteurs, ['app/langage/connaissances.js', 'app/main.js']);
  const main = sansCommentaires(readFileSync(join(RACINE, 'app', 'main.js'), 'utf8'));
  assert.doesNotMatch(main, /lireManifestationsFaits|lireTout\('manifestationsFaits'\)/, 'main.js écrit, ne lit jamais');
  assert.match(main, /lireExecutions: async \(\) => \{\s*const e = await ecranLangage\.assurerEsprit\(\);\s*return e\.magasin\.lireTout\('executionsOperations'\);/, 'l\'univers ne lit que executionsOperations');
});
