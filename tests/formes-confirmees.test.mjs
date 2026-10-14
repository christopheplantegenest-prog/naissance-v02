// v0.64.17 — « CONFIRMER UNE FORME INDUITE ET LA RENDRE ACTIVE » (GO ChatGPT « v0.64.17 », 14/10/2026), jalon E2.
// Une NOUVELLE manifestation reference-explicite rend sa famille déterminée → proposition de la RÈGLE → Confirmer (Action proposerFait validée,
// origine induite-supervisee, puis décision 'confirmee') ou Refuser (décision 'refusee'). Le chemin est REJOUÉ avec les fonctions réelles que
// main.js appelle (même patron que tests/reference-message.test.mjs) ; main.js et l'écran sont vérifiés par lecture de source et par faux DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const C = await import('../app/langage/connaissances.js');
const { identifierMessage, conserverValeurMessage } = await import('../app/langage/pont.js');
const { chargerEsprit, apprendreFait, repondre } = await import('../app/langage/esprit.js');
const { extraireLecon } = await import('../app/langage/lecon.js');
const { evaluerAction, reconnaitreActions, invoquerAction } = await import('../app/langage/action.js');
const { reconnaitreAffirmationPossessive } = await import('../app/langage/interpretation.js');
const F = await import('../app/langage/formes-confirmees.js');
const { identiteRegle, regleDeLAction } = await import('../app/langage/regle-forme.js');
const { formesSupervisees } = await import('../app/langage/formes-supervisees.js');
const { monterConversation } = await import('../app/conversation/ecran.js');
const S = await import('../app/memoire/sauvegarde.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const MAIN = sansCommentaires(lu('app', 'main.js'));
const MODULE = sansCommentaires(lu('app', 'langage', 'formes-confirmees.js'));

// --- CHEMIN RÉEL (rejoué) --------------------------------------------------------------------------------------------------------------------------
async function monde() { const magasin = C.magasinMemoireVive(); return { magasin, e: await chargerEsprit(magasin) }; }
async function recevoir(magasin, texte) {
  const message = identifierMessage(texte, { nouvelId: C.nouvelId });
  await conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// M naturel (non compris), « Répondre » sur M, L « Apprends : Fait : … », Confirmer : fait, manifestation L, manifestation M, PUIS (si M écrite)
// examinerFormeApresSupervision(M) — exactement l'ordre de onOui dans main.js (FC0 le vérifie dans la source).
async function superviser(w, texteM, texteL) {
  const M = await recevoir(w.magasin, texteM);
  const nonCompris = reconnaitreActions(w.e.actions || [], texteM).etat === 'aucune' && !reconnaitreAffirmationPossessive(texteM, { lexique: w.e.lexique }).ok;
  const L = await recevoir(w.magasin, texteL);
  const { donnees } = extraireLecon(texteL.replace(/^apprends\s*:\s*/i, '').trim());
  const r = await apprendreFait(w.e, { ...donnees, origine: 'apprise-conversation' });
  const fait = { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur };
  await C.enregistrerManifestationFait(w.magasin, { idMessage: L.id, fait, voie: { nom: 'lecon-technique' } });
  await C.enregistrerManifestationFait(w.magasin, { idMessage: M.id, fait: { ...fait }, voie: { nom: 'reference-explicite', idLecon: L.id } });
  const examen = await F.examinerFormeApresSupervision(w.magasin, M.id);
  return { M, L, nonCompris, examen };
}
async function confirmerRegle(w, proposition) {
  const r = await F.confirmerFormeSupervisee(w.magasin, proposition);
  w.e.actions = await w.magasin.lireTout('actions'); // comme main.js après Confirmer
  return r;
}
async function redemarrer(w) {
  const donnees = {};
  for (const t of C.TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = C.magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return { magasin, e: await chargerEsprit(magasin) };
}
// Proposition locale d'un fait par une forme apprise : le chemin forme-apprise de main.js (reconnaissance unique → invocation → fait).
function propositionLocale(e, texte) {
  const reco = reconnaitreActions(e.actions || [], texte);
  if (reco.etat !== 'unique') return { etat: reco.etat };
  return { etat: 'unique', idAction: reco.action.id, resultat: invoquerAction(reco.action, e, texte).resultat };
}
const MON_CHIEN = ['Mon chien porte le nom Rex.', 'Apprends : Fait : moi / chien / Rex.'];
const MON_CHAT = ['Mon chat porte le nom Milo.', 'Apprends : Fait : moi / chat / Milo.'];
const MON_FURET = ['Mon furet porte le nom Zip.', 'Apprends : Fait : moi / furet / Zip.'];

// ================================================================================================================ FC0. RACCORD (source)
test('FC0. main.js et écran : déclencheur APRÈS l\'écriture réussie de M ; proposition distincte (Refuser) ; actions relues après Confirmer ; aucune fausse leçon ; statut d\'evaluerAction jamais lu', () => {
  assert.match(MAIN, /import \{ examinerFormeApresSupervision, confirmerFormeSupervisee, refuserFormeSupervisee \} from '\.\/langage\/formes-confirmees\.js';/);
  const oui = MAIN.slice(MAIN.indexOf('onOui: async () => {'), MAIN.indexOf('onNon: async () => {'));
  const iM = oui.indexOf("voie: { nom: 'reference-explicite', idLecon: source.idMessage } });");
  const iEcrite = oui.indexOf('supervisionEcrite = true;');
  const iSi = oui.indexOf('if (supervisionEcrite) {');
  const iProp = oui.indexOf('propositionForme = await propositionDeForme(referenceMessage.idMessage);');
  assert.ok(iM > 0 && iM < iEcrite && iEcrite < iSi && iSi < iProp, 'M écrite → drapeau → seulement alors la proposition');
  assert.match(oui, /return propositionForme \? \{ texte: reponseFinale, proposition: propositionForme \} : reponseFinale;/);
  assert.equal((MAIN.match(/propositionDeForme\(/g) || []).length, 2, 'la définition + le seul déclencheur');
  const def = MAIN.slice(MAIN.indexOf('async function propositionDeForme('), MAIN.indexOf('async function traiterTour('));
  assert.match(def, /libelleNon: 'Refuser'/);
  assert.match(def, /await confirmerFormeSupervisee\(esp\.magasin, proposition\);\s*esp\.actions = await esp\.magasin\.lireTout\('actions'\);/);
  assert.match(def, /await refuserFormeSupervisee\(esp\.magasin, proposition\);/);
  assert.doesNotMatch(def, /Action :|Rôles :|proposerActionDepuisBloc|apprendreAction/, 'aucune leçon « Action : » fabriquée');
  assert.doesNotMatch(MODULE, /Action :|Rôles :|positionsDistinguees|evaluation\.statut|\.statut === 'incertaine' \? /, 'statut d\'evaluerAction jamais lu');
  assert.doesNotMatch(MODULE, /lireTout\(|'manifestationsFaits'|'valeursDonnees'|'decisionsFormes'/, 'aucune table nommée hors connaissances.js');
  const ecran = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.match(ecran, /bouton_\(options\.confirmation\.libelleNon \|\| 'Annuler', \(\) => trancher\(options\.confirmation\.onNon\)\)/);
  assert.match(ecran, /afficherMessage\('ia', suiteProposee\.texte, \{ confirmation: suiteProposee\.confirmation \}\);/);
});

// ================================================================================================================ FC1. DÉCISIF POSITIF
test('FC1. décisif positif : 2 exemples supervisés → proposition → Confirmer → Action validée induite + décision ; redémarrage → « Mon lapin porte le nom Kiwi. » proposé LOCALEMENT ; fait confirmé ; redémarrage → « mon lapin ? » → Kiwi', async () => {
  let w = await monde();
  const t1 = await superviser(w, ...MON_CHIEN);
  assert.equal(t1.nonCompris, true, 'M1 inconnu de toute forme et de J1a');
  assert.deepEqual(t1.examen, { raison: 'famille-insuffisante' }, 'un seul exemple : rien n\'est proposé');
  const t2 = await superviser(w, ...MON_CHAT);
  assert.equal(t2.nonCompris, true);
  const p = t2.examen.proposition;
  assert.ok(p, JSON.stringify(t2.examen));
  assert.equal(p.texte, [
    "J'ai remarqué une forme commune à tes exemples :",
    '« Mon chien porte le nom Rex. »',
    '« Mon chat porte le nom Milo. »',
    '',
    'Je propose de comprendre désormais :',
    '« Mon X porte le nom Y. »',
    'comme : moi → X → Y.',
    '',
    'Est-ce correct ?',
  ].join('\n'));
  assert.doesNotMatch(p.texte, /position|proposerFait|relation|valeur|sujet/, 'aucun nom interne affiché ; la constante « moi » est visible');
  assert.deepEqual(p.sources, [t1.M.id, t2.M.id].sort());
  assert.deepEqual(await w.magasin.lireTout('actions'), [], 'rien n\'est actif avant Confirmer');
  const { action, decision, echecDecision } = await confirmerRegle(w, p);
  assert.equal(echecDecision, null);
  assert.deepEqual({ operation: action.operation, statut: action.statut, origine: action.origine, roles: action.roles, constantes: action.constantes, n: action.n },
    { operation: 'proposerFait', statut: 'validee', origine: 'induite-supervisee', roles: [{ position: 1, nom: 'relation' }, { position: 5, nom: 'valeur' }], constantes: { sujet: 'moi' }, n: 7 });
  assert.deepEqual(action.exemples.map((x) => x.entree), [MON_CHIEN[0], MON_CHAT[0]]);
  assert.deepEqual(decision, { idCandidat: p.idCandidat, decision: 'confirmee', sources: p.sources, idAction: action.id });
  assert.equal(identiteRegle(regleDeLAction(action)), p.idCandidat, 'l\'Action porte exactement la règle confirmée');
  assert.equal(evaluerAction({ operation: 'proposerFait', roles: ['relation', 'valeur'], constantes: { sujet: 'moi' }, exemples: [MON_CHIEN[0], MON_CHAT[0]] }).statut, 'incertaine', 'positionsDistinguees seul aurait dit « incertaine » : il n\'est pas réimposé');
  // la même session reconnaît déjà la forme
  assert.equal(propositionLocale(w.e, 'Mon lapin porte le nom Kiwi.').etat, 'unique');
  // redémarrage
  w = await redemarrer(w);
  const loc = propositionLocale(w.e, 'Mon lapin porte le nom Kiwi.');
  assert.deepEqual(loc, { etat: 'unique', idAction: action.id, resultat: { type: 'fait', donnees: { sujet: 'moi', relation: 'lapin', valeur: 'Kiwi' } } });
  assert.equal(propositionLocale(w.e, 'Ma fille porte le nom Léa.').etat, 'aucune', 'aucune généralisation au-delà de la signature exacte');
  // Christophe confirme le fait F4 : chemin forme-apprise existant (fait + manifestation), rien d'automatique
  const m4 = await recevoir(w.magasin, 'Mon lapin porte le nom Kiwi.');
  const r4 = await apprendreFait(w.e, { ...loc.resultat.donnees, origine: 'apprise-conversation' });
  await C.enregistrerManifestationFait(w.magasin, { idMessage: m4.id, fait: { sujet: r4.objet.sujet, relation: r4.objet.relation, valeur: r4.objet.valeur }, voie: { nom: 'forme-apprise', idAction: loc.idAction } });
  w = await redemarrer(w);
  assert.equal(repondre(w.e, 'mon lapin ?').texte, 'Kiwi');
  assert.equal(repondre(w.e, 'mon lapin ?').etat, 'compris');
  // aucune reproposition, même quand un nouvel exemple rejoint la famille
  const t3 = await superviser(w, ...MON_FURET);
  assert.deepEqual(t3.examen, { raison: 'deja-decidee' });
  assert.deepEqual((await w.magasin.lireTout('decisionsFormes')).map((d) => d.sources), [p.sources], 'la provenance reste celle du moment de la décision');
});

// ================================================================================================================ FC2. DÉCISIF REFUS
test('FC2. décisif refus : Refuser → décision refusee, aucune Action ; redémarrage ; M3 de même signature → aucune reproposition ; exemples intacts ; autre signature proposable', async () => {
  let w = await monde();
  await superviser(w, ...MON_CHIEN);
  const { examen } = await superviser(w, ...MON_CHAT);
  const avantManifs = await w.magasin.lireTout('manifestationsFaits');
  const avantFaits = await w.magasin.lireTout('faits');
  const decision = await F.refuserFormeSupervisee(w.magasin, examen.proposition);
  assert.deepEqual(decision, { idCandidat: examen.proposition.idCandidat, decision: 'refusee', sources: examen.proposition.sources });
  assert.deepEqual(await w.magasin.lireTout('actions'), []);
  assert.deepEqual(await w.magasin.lireTout('manifestationsFaits'), avantManifs, 'les exemples particuliers restent vrais');
  assert.deepEqual(await w.magasin.lireTout('faits'), avantFaits);
  w = await redemarrer(w);
  const t3 = await superviser(w, ...MON_FURET);
  assert.deepEqual(t3.examen, { raison: 'deja-decidee' }, 'même règle, même idCandidat : silence');
  assert.deepEqual((await w.magasin.lireTout('decisionsFormes')).map((d) => d.sources), [examen.proposition.sources], 'le refus garde ses sources');
  assert.equal(propositionLocale(w.e, 'Mon lapin porte le nom Kiwi.').etat, 'aucune');
  // autre signature : autre règle, proposable
  await superviser(w, 'Ma fille porte le nom Léa.', 'Apprends : Fait : moi / fille / Léa.');
  const autre = await superviser(w, 'Ma voiture porte le nom Titine.', 'Apprends : Fait : moi / voiture / Titine.');
  assert.ok(autre.examen.proposition);
  assert.notEqual(autre.examen.proposition.idCandidat, examen.proposition.idCandidat);
  assert.match(autre.examen.proposition.texte, /« Ma X porte le nom Y\. »/);
});

// ================================================================================================================ FC3. IDENTITÉ
test('FC3. identité de la RÈGLE : M1+M2 puis M1+M2+M3 → même idCandidat ; = identité de l\'Action créée ; l\'ordre d\'arrivée est sans effet ; les sources ne sont que la provenance', async () => {
  const w = await monde();
  await superviser(w, ...MON_CHIEN);
  const a = (await superviser(w, ...MON_CHAT)).examen.proposition;
  const b = (await superviser(w, ...MON_FURET)).examen.proposition;
  assert.equal(a.idCandidat, b.idCandidat);
  assert.notDeepEqual(a.sources, b.sources);
  assert.match(a.idCandidat, /^forme-[0-9a-f]{64}$/);
  const w2 = await monde();
  await superviser(w2, ...MON_FURET);
  const c = (await superviser(w2, ...MON_CHAT)).examen.proposition;
  assert.equal(c.idCandidat, a.idCandidat);
  // règle canonique : rôles / ancres / constantes dans un autre ordre → même identité ; autre constante → autre identité
  const r = c.regle;
  assert.equal(identiteRegle({ ...r, roles: [...r.roles].reverse(), ancres: [...r.ancres].reverse() }), c.idCandidat);
  assert.notEqual(identiteRegle({ ...r, constantes: { sujet: 'naissance' } }), c.idCandidat);
  assert.throws(() => identiteRegle({ ...r, n: 0 }), TypeError);
});

// ================================================================================================================ FC4. COLLISIONS
async function enseignerALaMain(magasin, exemples, roles = ['relation', 'valeur']) {
  const ev = evaluerAction({ operation: 'proposerFait', roles, constantes: { sujet: 'moi' }, exemples });
  return (await C.apprendreAction(magasin, { operation: 'proposerFait', roles: ev.roles, n: ev.n, exemples: ev.exemples, statut: ev.statut, constantes: ev.constantes, origine: 'apprise-conversation' })).objet;
}
test('FC4. Action manuelle VALIDÉE de même règle : famille déjà couverte → aucune proposition, aucune décision, Action strictement inchangée ; même squelette, autre association → abstention', async () => {
  const w = await monde();
  const manuelle = await enseignerALaMain(w.magasin, ['Mon chien porte le nom Rex.', 'Mon chien porte le nom Milo.', 'Mon chat porte le nom Milo.']);
  assert.equal(manuelle.statut, 'validee');
  w.e.actions = []; // les exemples sont supervisés via Répondre (la phrase aurait pu être reconnue : Christophe a choisi d'enseigner)
  const avant = JSON.stringify(await w.magasin.lireTout('actions'));
  await superviser(w, 'Mon lapin porte le nom Kiwi.', 'Apprends : Fait : moi / lapin / Kiwi.');
  const t = await superviser(w, 'Mon poisson porte le nom Bulle.', 'Apprends : Fait : moi / poisson / Bulle.');
  assert.deepEqual(t.examen, { raison: 'deja-couverte' });
  assert.equal(JSON.stringify(await w.magasin.lireTout('actions')), avant);
  assert.deepEqual(await w.magasin.lireTout('decisionsFormes'), []);
  // même squelette, rôles INVERSÉS (autre association) : apprendreAction la remplacerait → abstention, rien d'écrit
  const w2 = await monde();
  await enseignerALaMain(w2.magasin, ['Mon chien porte le nom Rex.', 'Mon chien porte le nom Milo.', 'Mon chat porte le nom Milo.'], ['valeur', 'relation']);
  w2.e.actions = [];
  const avant2 = JSON.stringify(await w2.magasin.lireTout('actions'));
  await superviser(w2, ...MON_FURET);
  const t2 = await superviser(w2, 'Mon lapin porte le nom Kiwi.', 'Apprends : Fait : moi / lapin / Kiwi.');
  assert.deepEqual(t2.examen, { raison: 'squelette-occupe' });
  assert.equal(JSON.stringify(await w2.magasin.lireTout('actions')), avant2);
});

test('FC5. Action INACTIVE de même règle : incertaine → réactivée (même id, exemples complétés par ceux de la famille, origine historique conservée) ; remplacee → nouvelle Action, l\'ancienne reste remplacee ; jamais deux actives', async () => {
  // A. incertaine (deux exemples manuels : positionsDistinguees ne peut pas trancher)
  const w = await monde();
  const inc = await enseignerALaMain(w.magasin, ['Mon chien porte le nom Rex.', 'Mon chat porte le nom Milo.']);
  assert.equal(inc.statut, 'incertaine');
  await superviser(w, ...MON_FURET);
  const t = await superviser(w, 'Mon lapin porte le nom Kiwi.', 'Apprends : Fait : moi / lapin / Kiwi.');
  assert.ok(t.examen.proposition, 'une Action inactive n\'empêche pas la proposition');
  assert.equal(t.examen.proposition.idCandidat, identiteRegle(regleDeLAction(inc)), 'même règle');
  const { action, decision } = await confirmerRegle(w, t.examen.proposition);
  const toutes = await w.magasin.lireTout('actions');
  assert.equal(toutes.length, 1, 'aucun doublon');
  assert.equal(action.id, inc.id);
  assert.equal(action.statut, 'validee');
  assert.equal(action.origine, 'apprise-conversation', 'origine historique conservée, jamais réétiquetée ; la décision porte la provenance');
  assert.deepEqual(action.exemples.map((x) => x.entree), ['Mon chien porte le nom Rex.', 'Mon chat porte le nom Milo.', 'Mon furet porte le nom Zip.', 'Mon lapin porte le nom Kiwi.'], 'fusion documentée : exemples de la MÊME règle seulement');
  assert.deepEqual(action.roles, inc.roles); assert.deepEqual(action.constantes, inc.constantes);
  assert.deepEqual(decision, { idCandidat: t.examen.proposition.idCandidat, decision: 'confirmee', sources: t.examen.proposition.sources, idAction: inc.id });
  // B. remplacee
  const w2 = await monde();
  const vieille = await enseignerALaMain(w2.magasin, ['Mon chien porte le nom Rex.', 'Mon chien porte le nom Milo.', 'Mon chat porte le nom Milo.']);
  await w2.magasin.ecrire('actions', { ...vieille, statut: 'remplacee' });
  w2.e.actions = await w2.magasin.lireTout('actions');
  await superviser(w2, ...MON_FURET);
  const t2 = await superviser(w2, 'Mon lapin porte le nom Kiwi.', 'Apprends : Fait : moi / lapin / Kiwi.');
  assert.ok(t2.examen.proposition);
  const r2 = await confirmerRegle(w2, t2.examen.proposition);
  const toutes2 = await w2.magasin.lireTout('actions');
  assert.equal(toutes2.length, 2);
  assert.notEqual(r2.action.id, vieille.id);
  assert.equal(toutes2.find((a) => a.id === vieille.id).statut, 'remplacee', 'l\'ancienne reste archivée, inchangée');
  assert.equal(toutes2.filter((a) => a.statut === 'validee').length, 1);
  assert.equal(r2.action.origine, 'induite-supervisee');
  assert.deepEqual(r2.action.exemples.map((x) => x.entree), ['Mon furet porte le nom Zip.', 'Mon lapin porte le nom Kiwi.'], 'aucun exemple récupéré de l\'archive');
});

// ================================================================================================================ FC6. NON-PROPOSITIONS
// MISE À JOUR DÉLIBÉRÉE v0.64.18 : le cas « sujet porté » de w2 (« Le chat de Paul porte le nom Milo. ») avait sa relation PLACÉE et sa valeur variable,
// avec une signature où la relation est un rôle et le sujet aussi : il est désormais COMPATIBLE avec proposerFaitComplet (trois rôles, aucune constante)
// et reçoit une proposition. L'« incompatible » est conservé par une famille qu'AUCUNE capacité de fait n'accepte : sujet porté par le texte ET relation
// non placée constante (sujet rôle + relation constante + valeur rôle).
test('FC6. jamais de proposition : famille ambiguë, en abstention, sujet porté avec relation constante (aucune capacité compatible), aucune famille ; examiner n\'écrit rien', async () => {
  const w = await monde();
  await superviser(w, ...MON_CHIEN);
  assert.deepEqual((await superviser(w, 'Mon chien porte le nom Milo.', 'Apprends : Fait : moi / chien / Milo.')).examen, { raison: 'famille-ambigue' });
  const w2 = await monde();
  await superviser(w2, 'Paul porte le nom Milo.', 'Apprends : Fait : paul / surnom / Milo.');
  assert.deepEqual((await superviser(w2, 'Léa porte le nom Rex.', 'Apprends : Fait : léa / surnom / Rex.')).examen, { raison: 'incompatible' });
  const w3 = await monde();
  await superviser(w3, ...MON_CHIEN);
  assert.deepEqual((await superviser(w3, 'Mon chat porte le nom Milo.', 'Apprends : Fait : paul / chat / Milo.')).examen, { raison: 'famille-abstention' });
  assert.deepEqual(await F.examinerFormeApresSupervision(w3.magasin, 'message-inconnu'), { raison: 'aucune-famille' });
  for (const x of [w, w2, w3]) { assert.deepEqual(await x.magasin.lireTout('actions'), []); assert.deepEqual(await x.magasin.lireTout('decisionsFormes'), []); }
  // compatibilité : vérifiée contre les déclarations du registre
  assert.deepEqual(F.capaciteDeFaitCompatible({ etat: 'ambigue', champs: {} }), { ok: false, raison: 'famille-non-determinee' }); // MISE À JOUR DÉLIBÉRÉE v0.64.18 : compatibiliteProposerFait → capaciteDeFaitCompatible (toutes les capacités de fait déclarées)
});

// ================================================================================================================ FC7. CONTRAT DE LA DÉCISION
test('FC7. enregistrerDecisionForme : champs, sources résolubles et sans doublon, refus sans Action, confirmation avec Action validée DE CETTE règle, immuable', async () => {
  const w = await monde();
  await superviser(w, ...MON_CHIEN);
  const p = (await superviser(w, ...MON_CHAT)).examen.proposition;
  const ecrire = (e) => C.enregistrerDecisionForme(w.magasin, e);
  const base = { idCandidat: p.idCandidat, decision: 'refusee', sources: p.sources };
  await assert.rejects(ecrire({ ...base, score: 1 }), /champ étranger/);
  await assert.rejects(ecrire({ ...base, idCandidat: '' }), /idCandidat/);
  await assert.rejects(ecrire({ ...base, decision: 'peut-etre' }), /decision inconnue/);
  await assert.rejects(ecrire({ ...base, sources: [] }), /sources/);
  await assert.rejects(ecrire({ ...base, sources: [p.sources[0], p.sources[0]] }), /double/);
  await assert.rejects(ecrire({ ...base, sources: ['message-jamais'] }), /aucun message conservé/);
  await assert.rejects(ecrire({ ...base, idAction: 'action-x' }), /aucune Action/);
  const conf = { idCandidat: p.idCandidat, decision: 'confirmee', sources: p.sources };
  await assert.rejects(ecrire(conf), /idAction est obligatoire/);
  await assert.rejects(ecrire({ ...conf, idAction: 'action-inexistante' }), /aucune Action/);
  const inc = await enseignerALaMain(w.magasin, ['Mon lapin porte le nom Kiwi.', 'Mon furet porte le nom Zip.']);
  await assert.rejects(ecrire({ ...conf, idAction: inc.id }), /n'est pas validée/);
  const autre = await enseignerALaMain(w.magasin, ['Ma fille porte le nom Léa.', 'Ma fille porte le nom Zoé.', 'Ma voiture porte le nom Zoé.']);
  await assert.rejects(ecrire({ ...conf, idAction: autre.id }), /ne porte pas la règle/);
  assert.deepEqual(await w.magasin.lireTout('decisionsFormes'), [], 'aucun refus n\'écrit');
  const ok = await ecrire({ ...base, sources: [...p.sources].reverse() });
  assert.deepEqual(ok.sources, [...p.sources].sort(), 'sources canoniques');
  await assert.rejects(ecrire(base), /déjà sa décision/);
  assert.equal(C.CLE.decisionsFormes, 'idCandidat');
  assert.deepEqual([...C.DECISIONS_FORME], ['confirmee', 'refusee']);
});

// ================================================================================================================ FC8. ATOMICITÉ / INCOHÉRENCE
test('FC8. ordre Action puis décision : échec de la décision → Action active gardée, echecDecision rendu, aucune reproposition ; décision confirmée sans Action (import) : exposée, jamais recréée', async () => {
  const w = await monde();
  await superviser(w, ...MON_CHIEN);
  const p = (await superviser(w, ...MON_CHAT)).examen.proposition;
  const fragile = { ...w.magasin, ecrire: async (table, objet) => { if (table === 'decisionsFormes') throw new Error('panne simulée'); return w.magasin.ecrire(table, objet); } };
  const r = await F.confirmerFormeSupervisee(fragile, p);
  assert.equal(r.action.statut, 'validee'); assert.equal(r.decision, null); assert.match(r.echecDecision.message, /panne simulée/);
  assert.deepEqual(await w.magasin.lireTout('decisionsFormes'), []);
  const t = await superviser(w, ...MON_FURET);
  assert.deepEqual(t.examen, { raison: 'deja-couverte' }, 'l\'Action active empêche la reproposition (provenance seulement dégradée)');
  await assert.rejects(F.confirmerFormeSupervisee(w.magasin, p), /déjà connue/, 'une seconde confirmation ne change rien');
  // incohérence venue d'un import : décision confirmée dont l'Action n'existe pas
  const w2 = await monde();
  await superviser(w2, ...MON_CHIEN);
  const p2 = (await superviser(w2, ...MON_CHAT)).examen.proposition;
  await w2.magasin.ecrire('decisionsFormes', { idCandidat: p2.idCandidat, decision: 'confirmee', sources: p2.sources, idAction: 'action-disparue' });
  assert.deepEqual(F.decisionsIncoherentes(await w2.magasin.lireTout('decisionsFormes'), await w2.magasin.lireTout('actions')), [p2.idCandidat]);
  assert.deepEqual((await superviser(w2, ...MON_FURET)).examen, { raison: 'deja-decidee' });
  assert.deepEqual(await w2.magasin.lireTout('actions'), [], 'jamais recréée silencieusement');
  assert.deepEqual(F.decisionsIncoherentes([], []), []);
});

// ================================================================================================================ FC9. DETTE CONNUE
test('FC9. DETTE TOUJOURS OUVERTE (documentaire) : une leçon « Action : » manuelle ultérieure de même règle, au lot incertain, dégrade encore l\'Action induite', async () => {
  const w = await monde();
  await superviser(w, ...MON_CHIEN);
  const p = (await superviser(w, ...MON_CHAT)).examen.proposition;
  const { action } = await confirmerRegle(w, p);
  await enseignerALaMain(w.magasin, ['Mon furet porte le nom Zip.', 'Mon cheval porte le nom Zap.']);
  const apres = (await w.magasin.lireTout('actions')).find((a) => a.id === action.id);
  assert.equal(apres.statut, 'incertaine', 'dette apprendreAction non corrigée dans v0.64.17 (statut du dernier lot, non recalculé)');
  assert.deepEqual(F.decisionsIncoherentes(await w.magasin.lireTout('decisionsFormes'), await w.magasin.lireTout('actions')), [p.idCandidat], 'elle est alors exposée comme incohérence');
});

// ================================================================================================================ FC10. ÉCRAN
test('FC10. ÉCRAN : après Confirmer un fait, « J\'ai retenu » PUIS une seconde bulle de règle avec [Confirmer] [Refuser] ; Refuser appelle onNon ; une proposition de fait garde « Annuler »', async () => {
  const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const appels = [];
  const regle = { texte: 'Je propose…', confirmation: { libelleNon: 'Refuser', onOui: async () => { appels.push('regle-oui'); return 'C\'est noté.'; }, onNon: async () => { appels.push('regle-non'); return 'D\'accord.'; } } };
  const repondreFn = async () => ({ texte: 'Je vais retenir : moi → chat → Milo.', confirmation: { onOui: async () => { appels.push('fait-oui'); return { texte: "J'ai retenu : moi → chat → Milo.", proposition: regle }; }, onNon: async () => 'rien' } });
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: repondreFn, surSollicitation: null, surActe: null, surJugement: null });
  await conv.recharger();
  champ.value = 'Apprends : Fait : moi / chat / Milo.'; await formulaire.listeners.submit[0]({ preventDefault() {} });
  const ia = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const boutons = (b) => { const a = b.children.find((c) => c._cls.has('actions-message')); return a ? a.children.filter((c) => c.tag === 'button') : []; };
  const clic = (b) => Promise.all((b.listeners.click || []).map((f) => f()));
  assert.deepEqual(boutons(ia()[0]).map((b) => b.textContent), ['Confirmer', 'Annuler'], 'proposition de FAIT : libellé inchangé');
  await clic(boutons(ia()[0])[0]);
  assert.deepEqual(appels, ['fait-oui']);
  const [, retenu, propRegle] = ia();
  assert.equal(retenu.children[0].innerHTML.includes('retenu : moi'), true, 'le fait confirmé s\'affiche tel quel (texte de l\'objet rendu)');
  assert.equal(propRegle.children[0].innerHTML.includes('Je propose'), true);
  assert.deepEqual(boutons(propRegle).map((b) => b.textContent), ['Confirmer', 'Refuser']);
  await clic(boutons(propRegle)[1]);
  assert.deepEqual(appels, ['fait-oui', 'regle-non']);
  assert.equal(ia().at(-1).children[0].innerHTML.includes('accord'), true, 'la réponse au refus s\'affiche');
});

// ================================================================================================================ FC11. SCHÉMA
test('FC11. table decisionsFormes : déclarée en dernier (clé idCandidat), VERSION_BASE 26 ; migration 25 → 26 ne crée QUE cette table ; sauvegarde schéma 16 (15 complété par [], 16 sans la table = incomplet, 17 refusé)', async () => {
  assert.equal(C.TABLES.at(-1), 'decisionsFormes'); assert.equal(C.VERSION_BASE, 26); assert.equal(S.SCHEMA_SAUVEGARDE, 16); assert.equal(C.TABLES.length, 32);
  const existants = C.TABLES.filter((t) => t !== 'decisionsFormes');
  const donnees = new Map(existants.map((t) => [t, [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null;
  const fabrique = { open(n, v) { version = v; const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) }; const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  await C.ouvrirIndexedDB(fabrique);
  assert.equal(version, 26);
  assert.deepEqual(crees, [['decisionsFormes', 'idCandidat']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
  // sauvegarde
  const w = await monde();
  await superviser(w, ...MON_CHIEN);
  const p = (await superviser(w, ...MON_CHAT)).examen.proposition;
  await F.refuserFormeSupervisee(w.magasin, p);
  const { creerMemoire } = await import('../app/memoire/memoire.js');
  const { creerMagasinMemoire } = await import('../app/memoire/magasin.js');
  const memoire = creerMemoire(creerMagasinMemoire());
  const TABLES_MEMOIRE = Object.keys(await memoire.exporterDonnees());
  const fichier = await S.construireSauvegardeComplete({ memoire, magasinLangage: w.magasin, idNaissance: 'id', versionAppli: '0.64.17', maintenant: new Date('2026-10-14T18:00:00Z') });
  assert.equal(fichier.objet.schema, 16);
  const lue = await S.lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  assert.deepEqual(lue.donnees.langage.decisionsFormes, await w.magasin.lireTout('decisionsFormes'));
  const { empreinte } = await import('../app/memoire/transfert.js');
  const refaire = async (o) => JSON.stringify({ ...o, empreinte: await empreinte(JSON.stringify(o.donnees)) });
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 15; delete ancien.donnees.langage.decisionsFormes;
  const lu1 = await S.lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu1.ok, true, lu1.erreur); assert.deepEqual(lu1.donnees.langage.decisionsFormes, []);
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage.decisionsFormes;
  const lu2 = await S.lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 17;
  const lu3 = await S.lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
});

// ================================================================================================================ FC12. NON-RÉGRESSION
test('FC12. non-régression : « Apprends : Action » (v0.64.13), J1a, forme apprise, manifestations ; une décision ne touche aucun fait ; formesSupervisees reste pure', async () => {
  const w = await monde();
  const manuelle = await enseignerALaMain(w.magasin, ['Mon blurg se nomme Zok.', 'Mon blurg se nomme Pof.', 'Mon truc se nomme Pof.']);
  assert.equal(manuelle.statut, 'validee'); assert.equal(manuelle.origine, 'apprise-conversation');
  w.e.actions = await w.magasin.lireTout('actions');
  assert.deepEqual(propositionLocale(w.e, 'Mon bidule se nomme Kip.').resultat, { type: 'fait', donnees: { sujet: 'moi', relation: 'bidule', valeur: 'Kip' } });
  assert.equal(reconnaitreAffirmationPossessive("Mon chien s'appelle Rex.", { lexique: w.e.lexique }).ok, true);
  await superviser(w, ...MON_CHIEN);
  const avantFaits = JSON.stringify(await w.magasin.lireTout('faits'));
  const avantManifs = JSON.stringify(await w.magasin.lireTout('manifestationsFaits'));
  const lignes = JSON.stringify([await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees')]);
  const vue = formesSupervisees(...JSON.parse(lignes));
  const p = (await superviser(w, ...MON_CHAT)).examen.proposition;
  assert.ok(p);
  assert.equal(JSON.stringify(formesSupervisees(...JSON.parse(lignes))), JSON.stringify(vue));
  const faitsApresSupervision = JSON.stringify(await w.magasin.lireTout('faits'));
  const manifsApresSupervision = JSON.stringify(await w.magasin.lireTout('manifestationsFaits'));
  await confirmerRegle(w, p);
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faitsApresSupervision, 'confirmer la règle ne touche aucun fait');
  assert.equal(JSON.stringify(await w.magasin.lireTout('manifestationsFaits')), manifsApresSupervision, 'ni aucune manifestation');
  assert.notEqual(avantFaits, faitsApresSupervision); assert.notEqual(avantManifs, manifsApresSupervision);
});
