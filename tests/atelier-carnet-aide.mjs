// v0.65.18 — AT-10.1 : données communes des tests du carnet (proposition fictive de trois missions, chantier de mission, registre).
// v0.65.19 — AT-10.2 : chantierPrepare (chantier PRÉPARÉ de la mission k, mené en AUTO jusqu'à la décision, faits J2, J4 et AT-5 fabriqués).
// OUTILLAGE NON COGNITIF — aucune acquisition. Aucun appel réseau : les montants sont fictifs, en microdollars.
import { ouvrirCarnet, appliquerCarnet, chantierDeMission } from '../app/atelier/carnet.js';
import { ouvrirChantier, appliquer } from '../app/atelier/chantier.js';
import { ouvrirRegistre, appliquerBudget } from '../app/atelier/budget.js';
import { canonique, confrontationDe, lirePieces } from '../app/atelier/journal.js';
import { proposerVersion } from '../app/atelier/parcours.js';
import { ecrireFaits } from '../app/atelier/verification.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';

export const Q = '2026-10-21T12:00:00Z';
export const BASE = Object.freeze({ sha: 'a'.repeat(40), version: '0.65.17' });
export const CARNET = 'carnet-essai';

// Appel borné : 10 000 jetons d'entrée au plus, 2 048 de sortie, tarifs fictifs de 5 $ et 25 $ par million de jetons (en microdollars).
// Coût maximal = 10000 x 5 + 2048 x 25 = 50000 + 51200 = 101200 microdollars, sous le plafond de 150 000.
export const APPEL = Object.freeze({ appels: 1, entree_max: 10000, max_tokens: 2048, modele: 'claude-opus-5-5', tarif_entree: 5000000, tarif_sortie: 25000000 });
export const DEV = Object.freeze({ effort: 'low', extraits: [], tarif_entree: 5000000, tarif_sortie: 25000000 });

export function mission(k, change = {}) {
  return {
    appel: { ...APPEL }, autorises: [`app/atelier/essai-${k}.js`, `tests/atelier-essai-${k}.test.mjs`],
    criteres: [`Le module essai-${k} rend la valeur attendue.`], decisions: [], developpement: structuredClone(DEV),
    frontieres: ['Aucun changement cognitif.'], interdits: [],
    jalon: { comportement: `Le module essai-${k} existe et son test passe.`, critere: `Test essai-${k} vert.`, id: `essai-${k}`, titre: `Essai ${k}` },
    objectif: `Mission ${k} du carnet fictif : ajouter le module essai-${k}.`, plafond: 150000, tests: [`tests/atelier-essai-${k}.test.mjs`],
    ...change,
  };
}

export function proposition(change = {}) {
  return {
    base: { ...BASE }, carnet: CARNET, limite_espace: 1000000, missions: [mission(1), mission(2), mission(3)],
    objectif: 'Carnet fictif de trois missions (recette locale AT-10.1).', plafond_total: 1000000, protocole: 'atelier-carnet-proposition-1',
    ...change,
  };
}

export const ev = (type, donnees = {}) => ({ type, quand: Q, donnees });

// Applique une suite d'événements au carnet ; lève au premier refus.
export function suite(journal, ...evs) {
  let j = journal;
  for (const e of evs) {
    const r = appliquerCarnet(j, e);
    if (!Array.isArray(r)) throw new Error(`refus inattendu (${e.type}) : ${r.raison}`);
    j = r;
  }
  return j;
}

export const sha = (c) => c.repeat(40);
export const livraison = (k, change = {}) => ({
  candidat: sha(String.fromCharCode(97 + k)), carnet: CARNET, chantier: chantierDeMission(CARNET, k), cout: 100000, k,
  main: sha(String(k)), preuve: String(k).repeat(64), version: `0.65.${17 + k}`, ...change,
});
export const baseDe = (k) => (k === 1 ? { ...BASE } : { sha: sha(String(k - 1)), version: `0.65.${16 + k}` });
export const ouverte = (k) => ev('mission-ouverte', { k, chantier: chantierDeMission(CARNET, k), base: baseDe(k) });

export function approuve(p = proposition()) {
  const j = ouvrirCarnet(p, Q);
  return { j, p };
}

// Chantier AT-1 de la mission k conforme au carnet, mené jusqu'à l'acceptation du candidat ; registre AT-2 avec un coût payé.
export function chantierMission(k, { base = baseDe(k), accepter = true, montant = 100000, payer = true, change = {}, candidat = sha(String.fromCharCode(97 + k)) } = {}) {
  const m = mission(k);
  let j = ouvrirChantier({ id: chantierDeMission(CARNET, k), objectif: m.objectif, base, plan: [{ id: m.jalon.id, titre: m.jalon.titre, critere: m.jalon.critere, tentativesMax: 1 }], ...change }, Q);
  const pas = (type, donnees) => { const r = appliquer(j, { type, quand: Q, donnees }); if (!Array.isArray(r)) throw new Error(r.raison); j = r; };
  pas('plan-approuve', {});
  pas('tentative-lancee', { jalon: m.jalon.id });
  pas('tentative-rendue', { jalon: m.jalon.id, numero: 1, reference: `atelier/x@${sha('c')}` });
  if (accepter) pas('tentative-acceptee', { jalon: m.jalon.id, numero: 1, motif: 'ok', candidat });
  let r = ouvrirRegistre({ cycle: '2026-10', plafond: 1000000, reserve: 0, plafondRun: 500000 }, Q);
  const b = (type, donnees) => { const x = appliquerBudget(r, { type, quand: Q, donnees }); if (!Array.isArray(x)) throw new Error(x.raison); r = x; };
  b('chantier-plafonne', { chantier: chantierDeMission(CARNET, k), plafond: m.plafond });
  b('engagement', { execution: `${chantierDeMission(CARNET, k)}-t1`, chantier: chantierDeMission(CARNET, k), maximum: 101200 });
  if (payer) b('cout', { execution: `${chantierDeMission(CARNET, k)}-t1`, montant, issue: 'reponse-connue' });
  return { journal: j, registre: r };
}

// ------------------------------------------------------------------------------------------------ v0.65.19 — AT-10.2
// Faits fabriqués (forme des faits réels du pilote AT-9 : J2 atelier-auto-faits-2, J4 atelier-auto-candidat-1, AT-5 atelier-faits-2),
// scellés par leur empreinte. Rien n'est appelé : ils décrivent un run fictif qui aurait produit les deux fichiers de la mission k.
const sceller = (o) => { const { empreinte, ...sans } = o; return canonique({ ...sans, empreinte: hacherSha256(canonique(sans)) }); };
const PROVENANCE = Object.freeze({ ref: 'refs/heads/main', run_attempt: '1', run_id: '40000000001', workflow_sha: 'e'.repeat(40) });
export const ETAT_LU = Object.freeze({ commit: 'd'.repeat(40), empreinte: 'f'.repeat(64) });
const fichiersDe = (m) => m.autorises.map((chemin, i) => ({ chemin, empreinte: String(i + 1).repeat(64), etat: 'cree', octets: 100 + i }));

// J2 : un appel émis, réponse connue, proposition des fichiers autorisés ; coût = usage x tarifs constatés de la mission (DEV).
export function faitsJ2(k, { t = `${chantierDeMission(CARNET, k)}/essai-${k}/1`, entree = 10000, sortie = 2000, etat = ETAT_LU } = {}) {
  const m = mission(k);
  const montant = (entree * m.developpement.tarif_entree + sortie * m.developpement.tarif_sortie) / 1000000;
  const fichiers = fichiersDe(m).map((f) => ({ ...f, remplacements: 1 }));
  return sceller({
    appel_emis: true, constat: null, cout: { montant, tarif_entree: m.developpement.tarif_entree, tarif_sortie: m.developpement.tarif_sortie },
    emission: { point_franchi: true, socket_connecte: true }, etape: 'appel', etat: { ...etat }, issue: 'reponse-connue', protocole: 'atelier-auto-faits-2',
    provenance: { ...PROVENANCE }, raison: null,
    reponse: { modele: m.appel.modele, proposition: { empreinte: '9'.repeat(64), fichiers, motif: null, question: null, statut: 'proposition' }, request_id: 'req_fictif',
      statut: 200, stop_reason: 'end_turn', texte_empreinte: '8'.repeat(64), texte_octets: 1000, type_erreur: null, usage: { entree, sortie } },
    requete: { corps_empreinte: '7'.repeat(64), corps_octets: 9000, dossier_empreinte: '6'.repeat(64), dossier_octets: 8000, effort: m.developpement.effort,
      entree_borne: m.appel.entree_max, fichiers_base: [], max_tokens: m.appel.max_tokens, modele: m.appel.modele },
    tentative: t,
  });
}
// J4 : candidat créé sur atelier/<T>, né de la base de la mission, mêmes fichiers que la proposition J2 ; demande AT-5 dérivée.
export function faitsJ4(k, { base = baseDe(k), candidat = sha(String.fromCharCode(97 + k)), t = `${chantierDeMission(CARNET, k)}/essai-${k}/1`, etat = ETAT_LU } = {}) {
  const branche = `atelier/${t}`;
  return sceller({
    candidat: { base: base.sha, branche, distant: candidat, sha: candidat },
    demande_at5: { base: base.sha, branche, candidat, version_base: base.version, version_candidat: proposerVersion(base.version) },
    etat: { ...etat }, fichiers: fichiersDe(mission(k)), protocole: 'atelier-auto-candidat-1', provenance: { ...PROVENANCE }, raison: null, statut: 'cree', tentative: t,
  });
}
// AT-5 : vérification exécutée sur la demande, tests réels comptés (echecs > 0 : non conforme).
export function faitsAt5(k, demande, { echecs = 0 } = {}) {
  return ecrireFaits({
    demande: { ...demande },
    diff: { fichiers: mission(k).autorises.map((chemin) => ({ chemin, etat: 'cree', mode: '100644' })),
      refuses: [], statut: 'etabli', tests_modifies: [], tests_supprimes: [], zones_touchees: [] },
    erreurs_techniques: [],
    execution: { code: echecs ? 1 : 0, deballer_sha256: '5'.repeat(64), delai_ms: 300000, duree_tests_ms: 1000, fichiers_injectes: ['app/sw.js', 'app/version.js'], injection_relue: true, statut: 'executee', verifier_sha256: '4'.repeat(64), version_injectee: demande.version_candidat },
    identite: { base_ancetre: true, base_est_commit: true, base_sur_main: true, base_tag: demande.base, branche_existe: true, branche_pointe: demande.candidat, branche_pointe_fin: demande.candidat, commits: 1, constats: [], est_commit: true, fusions: 0, main: demande.base, merge_base: demande.base,
      segment: { commits: 0, fichiers: [], fusions: 0, hors_outillage: [], refuses: [], statut: 'etabli' }, statut: 'etablie', tag_ancetre_base: true, tag_candidat_libre: true, version_fichier_base: demande.version_base },
    protocole: 'atelier-faits-2',
    provenance: { depot: 'christopheplantegenest-prog/naissance-v02', run_id: '40000000002', verificateur_sha: demande.base, workflow_ref: 'christopheplantegenest-prog/naissance-v02/.github/workflows/atelier-verification.yml@refs/heads/main' },
    robot: { erreurs: [], fumee: 'ok', json: 'ok', syntaxe: 'ok' },
    tests: { annules: 0, echecs, ignores: 0, reussis: 10 - echecs, statut: echecs ? 'echec' : 'executes', total: 10 },
  }, hacherSha256);
}

// Instantané AT-3 de la mission k tel que l'écran le fige au lancement (fiche = spec de la mission, AT-1 = chantier préparé).
export function instantane(k, base = baseDe(k)) {
  const m = mission(k);
  return { chantier: chantierDeMission(CARNET, k), objectif: m.objectif, base: { sha: base.sha, version: base.version }, jalon: { id: m.jalon.id, titre: m.jalon.titre, comportement: m.jalon.comportement },
    tentative: 1, criteres: [...m.criteres], tests: [...m.tests], autorises: [...m.autorises], interdits: [...m.interdits], frontieres: [...m.frontieres], decisions: m.decisions.map((d) => ({ id: d.id, texte: d.texte })) };
}

// Chantier PRÉPARÉ de la mission k (AT-10.2 : un cycle par mission, plafond = plafond de la mission, plan de la V1), mené jusqu'à
// « etape » : 'prepare' (rien de lancé), 'lance' (AUTO, engagement, instantané), 'rendu' (J2 + J4, coût réel), 'accepte' ou 'refuse'
// (faits AT-5 + décision humaine), 'inconnu' (tentative close sur une issue inconnue, régularisée). Rend { journal, registre, pieces,
// piecesDepuis: 1 }, état durable valide. « change » modifie l'ouverture AT-1 ; les autres options faussent un point à la fois.
export function chantierPrepare(k, { etape = 'accepte', base = baseDe(k), candidat = sha(String.fromCharCode(97 + k)), change = {}, cycle = {}, plafond = mission(k).plafond, engagement = 101200, lancement = {}, piece = {}, entree = 10000, sortie = 2000, echecs = 0 } = {}) {
  const m = mission(k);
  const ch = chantierDeMission(CARNET, k);
  const t = `${ch}/${m.jalon.id}/1`;
  const cle = `${m.jalon.id}/1`;
  let j = ouvrirChantier({ id: ch, objectif: m.objectif, base, plan: [{ id: m.jalon.id, titre: m.jalon.titre, critere: m.jalon.critere, tentativesMax: 1 }], ...change }, Q);
  const pas = (type, donnees) => { const r = appliquer(j, { type, quand: Q, donnees }); if (!Array.isArray(r)) throw new Error(r.raison); j = r; };
  let r = ouvrirRegistre({ cycle: ch, plafond: m.plafond, reserve: 0, plafondRun: m.plafond, ...cycle }, Q);
  const b = (type, donnees) => { const x = appliquerBudget(r, { type, quand: Q, donnees }); if (!Array.isArray(x)) throw new Error(x.raison); r = x; };
  const pieces = {};
  pas('plan-approuve', {});
  b('chantier-plafonne', { chantier: ch, plafond });
  if (etape === 'prepare') return { journal: j, registre: r, pieces, piecesDepuis: 1 };
  pas('tentative-lancee', { jalon: m.jalon.id, mode: 'AUTO', appel: { ...APPEL }, developpement: structuredClone(DEV), ...lancement });
  b('engagement', { execution: t, chantier: ch, maximum: engagement });
  pieces[cle] = { mission: { ...instantane(k, base), ...piece }, rapport: null, demande: null, faits: [] };
  if (etape === 'lance') return { journal: j, registre: r, pieces, piecesDepuis: 1 };
  const j2 = faitsJ2(k, { t, entree, sortie });
  if (etape === 'inconnu') {
    pas('tentative-annulee', { jalon: m.jalon.id, numero: 1, motif: 'issue inconnue (fictive)' });
    b('cout', { execution: t, montant: engagement, issue: 'issue-inconnue' });
    return { journal: j, registre: r, pieces, piecesDepuis: 1 };
  }
  const j4 = faitsJ4(k, { base, candidat, t });
  const o2 = JSON.parse(j2);
  const o4 = JSON.parse(j4);
  pas('tentative-rendue', { jalon: m.jalon.id, numero: 1, reference: `atelier/${t}@${candidat}`, mode: 'AUTO', faits_auto: j2, faits_auto_empreinte: o2.empreinte, faits_candidat: j4, faits_candidat_empreinte: o4.empreinte });
  pieces[cle].demande = { ...o4.demande_at5 };
  b('cout', { execution: t, montant: o2.cout.montant, issue: 'reponse-connue' });
  if (etape === 'rendu') return { journal: j, registre: r, pieces, piecesDepuis: 1 };
  const at5 = faitsAt5(k, o4.demande_at5, { echecs });
  pieces[cle].faits.push(at5);
  const lue = lirePieces(pieces, 1)[cle];
  const rendue = { donnees: j[j.length - 1].donnees };
  const verdict = confrontationDe(lue, lue.faits[0], rendue).verdict_technique;
  const f = JSON.parse(at5);
  pas(etape === 'accepte' ? 'tentative-acceptee' : 'tentative-rejetee', { jalon: m.jalon.id, numero: 1, motif: 'décision humaine (fictive)', candidat, faits: f.empreinte, verdict, run_id: f.provenance.run_id });
  return { journal: j, registre: r, pieces, piecesDepuis: 1 };
}
