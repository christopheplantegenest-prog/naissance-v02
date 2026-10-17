// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT ». Aides PARTAGÉES des tests de l'atelier AT-6 (pas un fichier de test). OUTILLAGE NON COGNITIF.
// Faits RÉELS des deux recettes AT-5 (textes exacts copiés depuis le résumé des runs), et fabrication de faits atelier-faits-2 VALIDES
// pour une autre demande : on part du vrai objet de la recette finale, on change la demande et les identités, on rescelle l'empreinte
// avec ecrireFaits (le vérificateur relit tout : schéma, cohérence, empreinte). Mission et rapport témoins du parcours MANUEL.
import assert from 'node:assert/strict';
import { ecrireFaits } from '../app/atelier/verification.js';
import { monterAtelier, CLE_ATELIER } from '../app/atelier/ecran.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { ecrireEtatDurable, texteConfirmation } from '../app/atelier/journal.js'; // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7 : aides ajoutées en fin de fichier, rien de l'existant n'est changé)

export const FAITS_RECETTE_FINALE = `{
  "demande": {
    "base": "6680c2e353388e2180e36d3d76e634feb4fd398f",
    "branche": "atelier/temoin-atelier/temoin-2/1",
    "candidat": "30a5b225bce3da0d9e4158d1be7d844b7f9f0c0a",
    "version_base": "0.65.5",
    "version_candidat": "0.65.6"
  },
  "diff": {
    "fichiers": [
      {
        "chemin": "tests/temoin-atelier.test.mjs",
        "etat": "cree",
        "mode": "100644"
      }
    ],
    "refuses": [],
    "statut": "etabli",
    "tests_modifies": [],
    "tests_supprimes": [],
    "zones_touchees": []
  },
  "empreinte": "7f8f187c8e2170ced363fea3be1b75649c7184f3ce9c18d78ced25454919b571",
  "erreurs_techniques": [],
  "execution": {
    "code": 0,
    "deballer_sha256": "d086f854ff55417377d86597a328174311945972206608b3d98a2083f8900dd2",
    "delai_ms": 300000,
    "duree_tests_ms": 110308,
    "fichiers_injectes": [
      "app/sw.js",
      "app/version.js"
    ],
    "injection_relue": true,
    "statut": "executee",
    "verifier_sha256": "1f1b9bfca02360cb299d8ba35e46559da6a539207941bf52bbc137c01217658a",
    "version_injectee": "0.65.6"
  },
  "identite": {
    "base_ancetre": true,
    "base_est_commit": true,
    "base_sur_main": true,
    "base_tag": "40a0a6f625e890a3528ed1c77ed21cea8f12f581",
    "branche_existe": true,
    "branche_pointe": "30a5b225bce3da0d9e4158d1be7d844b7f9f0c0a",
    "branche_pointe_fin": "30a5b225bce3da0d9e4158d1be7d844b7f9f0c0a",
    "commits": 1,
    "constats": [],
    "est_commit": true,
    "fusions": 0,
    "main": "6680c2e353388e2180e36d3d76e634feb4fd398f",
    "merge_base": "6680c2e353388e2180e36d3d76e634feb4fd398f",
    "segment": {
      "commits": 1,
      "fichiers": [
        {
          "chemin": ".github/workflows/LISEZMOI.md",
          "etat": "modifie",
          "mode": "100644"
        }
      ],
      "fusions": 0,
      "hors_outillage": [],
      "refuses": [],
      "statut": "etabli"
    },
    "statut": "etablie",
    "tag_ancetre_base": true,
    "tag_candidat_libre": true,
    "version_fichier_base": "0.65.5"
  },
  "protocole": "atelier-faits-2",
  "provenance": {
    "depot": "christopheplantegenest-prog/naissance-v02",
    "run_id": "39036165896",
    "verificateur_sha": "6680c2e353388e2180e36d3d76e634feb4fd398f",
    "workflow_ref": "christopheplantegenest-prog/naissance-v02/.github/workflows/atelier-verification.yml@refs/heads/main"
  },
  "robot": {
    "erreurs": [],
    "fumee": "ok",
    "json": "ok",
    "syntaxe": "ok"
  },
  "tests": {
    "annules": 0,
    "echecs": 0,
    "ignores": 0,
    "reussis": 5395,
    "statut": "executes",
    "total": 5395
  }
}
`;
export const FAITS_PREMIERE_RECETTE = `{
  "demande": {
    "base": "965704a72d600f62c2288a0dd350950a80da1a7d",
    "branche": "atelier/temoin-atelier/temoin-1/1",
    "candidat": "a61498211c03cdd275ecc6e230455eef34a1b98b",
    "version_base": "0.65.4",
    "version_candidat": "0.65.5"
  },
  "diff": {
    "fichiers": [
      {
        "chemin": "tests/temoin-atelier.test.mjs",
        "etat": "cree",
        "mode": "100644"
      }
    ],
    "refuses": [],
    "statut": "etabli",
    "tests_modifies": [],
    "tests_supprimes": [],
    "zones_touchees": []
  },
  "empreinte": "e8863de3b52e7d0ebeb0b57d0dcd136912131fc9d63034c34a7bdd5ccacad6ed",
  "erreurs_techniques": [],
  "execution": {
    "code": 0,
    "deballer_sha256": "d086f854ff55417377d86597a328174311945972206608b3d98a2083f8900dd2",
    "delai_ms": 180000,
    "duree_tests_ms": 173447,
    "fichiers_injectes": [
      "app/sw.js",
      "app/version.js"
    ],
    "injection_relue": true,
    "statut": "executee",
    "verifier_sha256": "968e9e951341bd7c415ea56e027ea1689034eb5dccd0e42f4425585d533bd604",
    "version_injectee": "0.65.5"
  },
  "identite": {
    "base_ancetre": true,
    "base_tag": "965704a72d600f62c2288a0dd350950a80da1a7d",
    "branche_existe": true,
    "branche_pointe": "a61498211c03cdd275ecc6e230455eef34a1b98b",
    "branche_pointe_fin": "a61498211c03cdd275ecc6e230455eef34a1b98b",
    "commits": 1,
    "constats": [],
    "est_commit": true,
    "fusions": 0,
    "main": "7d17e605c2432f11d09a844b48bec4c4e5d7fc71",
    "merge_base": "965704a72d600f62c2288a0dd350950a80da1a7d",
    "statut": "etablie",
    "tag_candidat_libre": true,
    "version_fichier_base": "0.65.4"
  },
  "protocole": "atelier-faits-1",
  "provenance": {
    "depot": "christopheplantegenest-prog/naissance-v02",
    "run_id": "39030831656",
    "verificateur_sha": "7d17e605c2432f11d09a844b48bec4c4e5d7fc71",
    "workflow_ref": "christopheplantegenest-prog/naissance-v02/.github/workflows/atelier-verification.yml@refs/heads/main"
  },
  "robot": {
    "erreurs": [],
    "fumee": "ok",
    "json": "ok",
    "syntaxe": "ok"
  },
  "tests": {
    "annules": 0,
    "echecs": 0,
    "ignores": 0,
    "reussis": 5384,
    "statut": "executes",
    "total": 5384
  }
}
`;

export const BASE = 'b'.repeat(40);
export const CANDIDAT = 'c'.repeat(40);
export const VERSION_BASE = '0.65.5';
export const CHANTIER = 'temoin-e2e';
export const JALON = 'temoin-1';
export const BRANCHE = (n = 1) => `atelier/${CHANTIER}/${JALON}/${n}`;

// Données de mission (instantané) du témoin AT-6.
export const MISSION = (n = 1, patch = {}) => ({
  chantier: CHANTIER, objectif: 'TÉMOIN AT-6 — parcours MANUEL de bout en bout.', base: { sha: BASE, version: VERSION_BASE },
  jalon: { id: JALON, titre: 'Jalon témoin', comportement: 'Un test témoin est ajouté.' }, tentative: n,
  criteres: ['Le test témoin passe.'], tests: ['tests/temoin-atelier.test.mjs'], autorises: ['tests/temoin-atelier.test.mjs'], interdits: [], frontieres: [], decisions: [],
  ...patch,
});
export const RAPPORT = (n = 1, patch = {}) => JSON.stringify({
  protocole: 'atelier-rapport-1', chantier: CHANTIER, jalon: JALON, tentative: n, base: { sha: BASE, version: VERSION_BASE },
  statut: 'candidat', candidat: { branche: BRANCHE(n), sha: CANDIDAT }, fichiers: { crees: ['tests/temoin-atelier.test.mjs'], modifies: [], supprimes: [] },
  tests: { total: 5395, reussis: 5395, echecs: 0 }, divergences: [], question: null, motif: null, ...patch,
});
export const RAPPORT_BLOQUE = (n = 1) => RAPPORT(n, { statut: 'bloque', candidat: null, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: null, question: 'Quel fichier ?' });
export const RAPPORT_ECHEC = (n = 1) => RAPPORT(n, { statut: 'echec', candidat: null, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: null, motif: 'Impossible.' });

export const DEMANDE = (n = 1, candidat = CANDIDAT, version = '0.65.6') => ({ branche: BRANCHE(n), candidat, base: BASE, version_base: VERSION_BASE, version_candidat: version });

// Faits valides pour une demande : « conforme » par défaut ; « non-conforme » = un test réel en échec ; « impossible » = suite interrompue.
export function FAITS({ demande = DEMANDE(), issue = 'conforme', run = '41000000001' } = {}) {
  const f = JSON.parse(FAITS_RECETTE_FINALE);
  delete f.empreinte;
  f.demande = { ...demande };
  Object.assign(f.identite, { branche_pointe: demande.candidat, branche_pointe_fin: demande.candidat, main: demande.base, merge_base: demande.base });
  f.execution.version_injectee = demande.version_candidat;
  f.provenance.run_id = run;
  f.provenance.verificateur_sha = demande.base;
  if (issue === 'non-conforme') f.tests = { annules: 0, echecs: 1, ignores: 0, reussis: 5394, statut: 'echec', total: 5395 };
  if (issue === 'impossible') f.tests = { annules: null, echecs: null, ignores: null, reussis: null, statut: 'crash', total: null };
  return ecrireFaits(f, hacherSha256);
}

// Rapport « candidat » pour un instantané de mission quelconque (celui que l'écran a réellement lancé).
export const RAPPORT_POUR = (m, patch = {}) => JSON.stringify({
  protocole: 'atelier-rapport-1', chantier: m.chantier, jalon: m.jalon.id, tentative: m.tentative, base: m.base,
  statut: 'candidat', candidat: { branche: `atelier/${m.chantier}/${m.jalon.id}/${m.tentative}`, sha: CANDIDAT },
  fichiers: { crees: [m.autorises[0]], modifies: [], supprimes: [] }, tests: { total: 5395, reussis: 5395, echecs: 0 }, divergences: [], question: null, motif: null, ...patch,
});

// DOM factice et stockage en mémoire (comme les tests AT-4) : l'écran réel, ses vrais gestes, sans navigateur.
class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this.className = ''; this._texte = ''; this.value = ''; this.disabled = false; this.open = false; this.attrs = {}; this.rows = 0; this.type = ''; this.readOnly = false; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); for (const c of this.children) c.parent = null; this.children = []; }
  append(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
}
const tous = (e, f) => [...(f(e) ? [e] : []), ...e.children.flatMap((c) => tous(c, f))];
const textes = (e) => [e._texte, ...e.children.flatMap(textes)].filter(Boolean);
export function stockageMemoire(initial = null) {
  const m = new Map(initial === null ? [] : [[CLE_ATELIER, initial]]);
  const s = { ecritures: 0, panne: false, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (s.panne) throw new Error('quota'); s.ecritures += 1; m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
  return s;
}
export function monterEcran({ version, stockage = stockageMemoire(), copier = async () => {} } = {}) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  const zone = new Faux('div');
  let t = 0;
  const copies = [];
  const ecran = monterAtelier({ zone, version, stockage, copier: (x) => { copies.push(x); return copier(x); }, maintenant: () => `2026-10-17T15:00:${String(t++ % 60).padStart(2, '0')}.000Z` });
  const trouver = (nom) => tous(zone, (e) => e.attrs['data-atelier'] === nom);
  const un = (nom) => { const l = trouver(nom); assert.equal(l.length, 1, `élément « ${nom} » attendu une fois (${l.length})`); return l[0]; };
  const cliquer = async (nom) => { const b = un(nom); for (const f of b.listeners.click) await f(); };
  const saisir = (nom, valeur) => { const e = un(nom); e.value = valeur; for (const f of e.listeners.input || []) f(); };
  const copie = () => JSON.parse(stockage.getItem(CLE_ATELIER));
  const texte = () => textes(zone).join('\n');
  const etape = () => un('prochaine-etape').textContent;
  const sectionOuverte = () => tous(zone, (e) => e.tag === 'details' && e.open).map((d) => d.attrs['data-atelier-section']);
  return { zone, stockage, ecran, trouver, un, cliquer, saisir, copie, texte, copies, etape, sectionOuverte };
}

// v0.65.7 — AT-7 (D3) : sauvegarde durable CONFIRMÉE par les vrais gestes de l'écran (préparer, coller la confirmation, enregistrer).
// La confirmation est celle que rend outils-atelier/journal-atelier.mjs : empreinte de l'état durable ACTUEL, commit de la branche journal.
export async function confirmerSauvegarde(a, commit = 'e'.repeat(40)) {
  await a.cliquer('preparer-sauvegarde');
  const { empreinte } = ecrireEtatDurable(a.copie());
  a.saisir('confirmation-sauvegarde', texteConfirmation({ chantier: a.copie().journal[0].donnees.id, empreinte, commit }));
  await a.cliquer('enregistrer-confirmation');
}

// v0.65.7 — AT-7 : chantier TÉMOIN conduit par les VRAIS gestes de l'écran jusqu'à une étape donnée (états durables et reprises).
//   'ouvert', 'en-cours', 'lancee' (non sauvegardée), 'lancee-sauvegardee', 'rendue', 'demandee', 'faits', 'decide'
// issue : faits « conforme » (décision : accepter => chantier terminé) ou « non-conforme » / « impossible » (décision : refuser / annuler).
// observer(etape, a) est appelé après chaque étape franchie : une seule conduite donne tous les états intermédiaires.
export async function conduire(jusqua, { version = VERSION_BASE, issue = 'conforme', budget = false, stockage, copier, observer = () => {} } = {}) {
  const a = monterEcran({ version, stockage, copier });
  const fin = (etape) => { observer(etape, a); return etape === jusqua; };
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  a.saisir('sha', BASE);
  await a.cliquer('ouvrir');
  if (budget) { await a.cliquer('ouvrir-cycle'); await a.cliquer('plafonner'); }
  if (fin('ouvert')) return a;
  await a.cliquer('approuver');
  if (fin('en-cours')) return a;
  await a.cliquer('generer');
  await a.cliquer('lancer');
  if (fin('lancee')) return a;
  await confirmerSauvegarde(a);
  if (fin('lancee-sauvegardee')) return a;
  const k = Object.keys(a.copie().pieces).at(-1);
  a.saisir('rapport', RAPPORT_POUR(a.copie().pieces[k].mission));
  await a.cliquer('enregistrer');
  if (fin('rendue')) return a;
  await a.cliquer('copier-demande');
  if (fin('demandee')) return a;
  a.saisir('faits-colles', FAITS({ demande: a.copie().pieces[k].demande, issue }));
  await a.cliquer('confronter');
  if (fin('faits')) return a;
  a.saisir('motif-decision', 'Décision témoin.');
  await a.cliquer(issue === 'conforme' ? 'accepter' : issue === 'non-conforme' ? 'refuser' : 'annuler');
  fin('decide');
  return a;
}
