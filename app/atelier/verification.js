// === DEBUT_ATELIER_VERIFICATION ===
// v0.65.4 — AT-5 « VÉRIFICATEUR INDÉPENDANT DES BRANCHES ATELIER » (GO « GO AT-5 v0.65.4 », 17/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Ce module ne juge ni la pertinence du code, ni un dépôt, ni une
// acquisition : il confronte la mission, le rapport de Claude et des FAITS établis hors de lui (Git et exécution réelle, par
// outils-atelier/verifier-candidat.mjs lancé depuis main). Le rapport seul ne fait jamais foi ; le diff réel fait foi.
//   lireDemande(entree)           -> { demande } ou { raison }   (branche, candidat, base, version_base, version_candidat)
//   classerDiff(texte)            -> { fichiers, refuses } ou { raison }   (sortie de « git diff --raw -z --no-renames --no-abbrev »)
//   zonePermanente(chemin)        -> booléen   (liste DUPLIQUÉE de mission.js ; identité de jugement prouvée par un test croisé)
//   jugerIdentite(demande, id)    -> raisons ([] = identité établie)
//   ecrireFaits(faits, hacherSha256) -> texte canonique avec empreinte (TypeError si le protocole n'est pas respecté)
//   lireFaits(texte, hacherSha256)   -> { faits } ou { raison }
//   confronter({ mission, rapport, faits, hacherSha256 }) -> résultat atelier-confrontation-1, gelé
// Verdicts : verification-technique-conforme | verification-technique-non-conforme | verification-impossible.
// « impossible » = faits insuffisants, invalides ou illisibles ; « non-conforme » = faits établis montrant un écart au contrat.
// L'empreinte SHA-256 protège contre l'altération ACCIDENTELLE (troncature, retouche), jamais contre une falsification volontaire.
// Hors modèle de menace : code candidat hostile falsifiant son exécution, compromission de GitHub, faits.json falsifié à la main,
// jeton de Claude aux droits excessifs sur main.
// PURETÉ : seul import ./mission.js ; hachage injecté ; aucune horloge, aucun hasard, aucun état, aucune entrée/sortie. NON BRANCHÉ.
// v0.65.5 — correction AT-5 « trois identités » (GO 17/10/2026) : T = étiquette v<version_base> (porte la version), B = base Git du
// chantier = mission.base.sha (n'est PAS une version), C = candidat. Le segment T..B est établi À PART et ne peut contenir que de
// l'outillage hors colis (.github/workflows/) ; le diff du candidat reste B..C COMPLET, rien n'en est jamais soustrait.

import { construireMission, verifierRapport } from './mission.js';

const FAITS = 'atelier-faits-2';
const FAITS_PERIMES = Object.freeze(['atelier-faits-1']);
const CONFRONTATION = 'atelier-confrontation-1';
const CONFORME = 'verification-technique-conforme';
const NON_CONFORME = 'verification-technique-non-conforme';
const IMPOSSIBLE = 'verification-impossible';
// DUPLICATION DÉLIBÉRÉE de mission.js (décision AT-5 : mission.js inchangé) ; tests/atelier-verification.test.mjs prouve l'identité.
const ZONES_DOSSIERS = Object.freeze(['.git', '.github', 'signature', 'android', 'node_modules']);
const ZONES_FICHIERS = Object.freeze(['version', 'etat.md', 'app/version.js', 'sw.js', 'app/sw.js']);
// Outillage hors colis admis dans le segment T..B : le dossier des workflows, inclus dans « .github » que le robot exclut de tout colis
// (DOSSIERS_INTERDITS de deballer.py, preuve par test). Règle de CHEMIN, jamais une liste de commits.
const OUTILLAGE = '.github/workflows/';
const MARGE_INFORMATIVE = 0.8;
const RE_BRANCHE = /^atelier\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([1-9][0-9]{0,2})$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_HEX64 = /^[0-9a-f]{64}$/;
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const RE_WORKFLOW = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/atelier-verification\.yml@refs\/heads\/main$/;
const RE_RAW = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([A-Z])$/;
const MODES = Object.freeze(['100644', '100755']);
const ETATS = Object.freeze({ A: 'cree', M: 'modifie', D: 'supprime' });
const CLES_DEMANDE = Object.freeze(['branche', 'candidat', 'base', 'version_base', 'version_candidat']);

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const tri = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const couvre = (entree, p) => (entree.endsWith('/') ? p.startsWith(entree) : p === entree);

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}

function raisonCles(o, cles, lieu) {
  if (!estObjet(o)) return `${lieu} : objet attendu`;
  const inconnues = Object.keys(o).filter((k) => !cles.includes(k)).sort();
  if (inconnues.length) return `${lieu} : clé inconnue ${inconnues.join(', ')}`;
  const absentes = cles.filter((k) => !Object.hasOwn(o, k)).sort();
  if (absentes.length) return `${lieu} : clé absente ${absentes.join(', ')}`;
  return null;
}

// Version X.Y.Z strictement plus grande (comparaison numérique, comme version_en_tuple du robot).
function plusGrande(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

// Chemin relatif tel que Git l'écrit : non vide, sans « / » initial ni segment vide, « . » ou « .. ».
const cheminGit = (p) => typeof p === 'string' && p.length > 0 && p.length <= 4096 && !p.includes('\0')
  && p.split('/').every((m) => m !== '' && m !== '.' && m !== '..');

export function zonePermanente(p) {
  const b = p.toLowerCase();
  return ZONES_DOSSIERS.includes(b.split('/')[0]) || ZONES_FICHIERS.includes(b) || (!b.includes('/') && b.endsWith('.zip'));
}

function raisonDemande(e) {
  const r = raisonCles(e, CLES_DEMANDE, 'demande');
  if (r) return r;
  const b = typeof e.branche === 'string' ? RE_BRANCHE.exec(e.branche) : null;
  if (!b || b[1].length > 40 || b[2].length > 40) return 'demande.branche : atelier/<chantier>/<jalon>/<tentative de 1 à 999> attendu ([a-z0-9-], 40 caractères au plus)';
  for (const k of ['candidat', 'base']) if (typeof e[k] !== 'string' || !RE_SHA.test(e[k])) return `demande.${k} : 40 caractères hexadécimaux minuscules attendus`;
  if (e.candidat === e.base) return 'demande : candidat et base identiques';
  for (const k of ['version_base', 'version_candidat']) if (typeof e[k] !== 'string' || !RE_VERSION.test(e[k])) return `demande.${k} : X.Y.Z attendu`;
  if (!plusGrande(e.version_candidat, e.version_base)) return 'demande.version_candidat : doit être plus grande que version_base (règle du robot)';
  return null;
}

export function lireDemande(e) {
  const r = raisonDemande(e);
  if (r) return geler({ raison: r });
  return geler({ demande: Object.fromEntries(CLES_DEMANDE.map((k) => [k, e[k]])) });
}

export function classerDiff(texte) {
  if (typeof texte !== 'string') return geler({ raison: 'diff : texte attendu' });
  const champs = texte.split('\0');
  if (champs.pop() !== '') return geler({ raison: 'diff : fin NUL attendue' });
  if (champs.length % 2) return geler({ raison: 'diff : nombre de champs impair' });
  const fichiers = [];
  const refuses = [];
  const vus = new Set();
  for (let i = 0; i < champs.length; i += 2) {
    const m = RE_RAW.exec(champs[i]);
    const chemin = champs[i + 1];
    if (!m) return geler({ raison: `diff : ligne illisible ${JSON.stringify(champs[i].slice(0, 120))}` });
    if (!cheminGit(chemin)) return geler({ raison: `diff : chemin irrégulier ${JSON.stringify(chemin.slice(0, 120))}` });
    if (vus.has(chemin)) return geler({ raison: `diff : chemin en double « ${chemin} »` });
    vus.add(chemin);
    const [, ancien, nouveau, , , s] = m;
    if (!'AMDT'.includes(s)) return geler({ raison: `diff : état ${s} inattendu (renommages désactivés)` });
    if ((s === 'A') !== (ancien === '000000') || (s === 'D') !== (nouveau === '000000')) return geler({ raison: `diff : modes ${ancien} ${nouveau} incohérents avec l'état ${s}` });
    const mode = s === 'D' ? ancien : nouveau;
    const modes = [ancien, nouveau];
    const motif = modes.includes('120000') ? 'lien symbolique'
      : modes.includes('160000') ? 'sous-module'
        : s === 'T' ? 'changement de type'
          : modes.some((x) => x !== '000000' && !MODES.includes(x)) ? `mode ${mode} inconnu` : null;
    if (motif) refuses.push({ chemin, mode, motif });
    else fichiers.push({ chemin, etat: ETATS[s], mode });
  }
  fichiers.sort((a, b) => tri(a.chemin, b.chemin));
  refuses.sort((a, b) => tri(a.chemin, b.chemin));
  return geler({ fichiers, refuses });
}

export function jugerIdentite(d, id) {
  const r = [];
  if (!id.branche_existe) r.push(`branche ${d.branche} absente du dépôt`);
  else if (id.branche_pointe !== d.candidat) r.push(`la branche pointe sur ${id.branche_pointe}, pas sur le candidat demandé ${d.candidat}`);
  if (!id.est_commit) r.push(`le candidat ${d.candidat} n'est pas un commit présent sur la branche`);
  if (!id.base_est_commit) r.push(`la base ${d.base} n'est pas un commit présent dans le dépôt`);
  if (id.base_tag === null) r.push(`étiquette v${d.version_base} absente`);
  else if (!id.tag_ancetre_base) r.push(`l'étiquette v${d.version_base} (${id.base_tag}) n'est ni la base ${d.base} ni un ancêtre de cette base`);
  if (!id.base_sur_main) r.push(`la base ${d.base} n'est ni la tête de main (${id.main}) ni un ancêtre de cette tête`);
  if (id.version_fichier_base !== d.version_base) r.push(`VERSION de la base = ${JSON.stringify(id.version_fichier_base)}, « ${d.version_base} » attendu`);
  r.push(...jugerSegment(d, id.segment));
  if (!id.base_ancetre) r.push('la base n\'est pas un ancêtre du candidat');
  if (id.merge_base !== d.base) r.push(`merge-base = ${id.merge_base}, la base ${d.base} attendue`);
  if (id.fusions !== 0) r.push(`${id.fusions} commit(s) de fusion entre la base et le candidat`);
  if (id.commits < 1) r.push('aucun commit entre la base et le candidat');
  if (!id.tag_candidat_libre) r.push(`l'étiquette v${d.version_candidat} existe déjà : le robot refuserait cette version`);
  if (id.branche_pointe_fin !== d.candidat) r.push(id.branche_pointe_fin === null ? 'branche absente à la fin de la vérification' : `branche déplacée pendant la vérification : elle pointe sur ${id.branche_pointe_fin}`);
  return r;
}

// Segment T..B (étiquette -> base) : seul de l'outillage hors colis, sans fusion, sans lien ni sous-module. Les chemins hors
// outillage sont RECALCULÉS ici depuis les fichiers établis (la liste écrite dans les faits doit leur être égale).
const horsOutillage = (sg) => [...sg.fichiers, ...sg.refuses].map((x) => x.chemin).filter((p) => !p.startsWith(OUTILLAGE)).sort(tri);
function jugerSegment(d, sg) {
  if (sg.statut !== 'etabli') return [];
  const r = [];
  const lieu = `segment v${d.version_base}..base`;
  if (sg.fusions !== 0) r.push(`${lieu} : ${sg.fusions} commit(s) de fusion`);
  for (const x of sg.refuses) r.push(`${lieu} : « ${x.chemin} » refusé (${x.motif}, mode ${x.mode})`);
  for (const p of horsOutillage(sg)) r.push(`${lieu} : « ${p} » hors de ${OUTILLAGE} (seul l'outillage hors colis y est admis)`);
  return r;
}

// ------------------------------------------------------------------------------------------- protocole atelier-faits-2
const LISTE = Symbol('liste');
const liste = (element, max) => ({ [LISTE]: element, max });
const ou = (f) => (v) => v === null || f(v);
const bool = (v) => typeof v === 'boolean';
const entier = (v) => Number.isSafeInteger(v) && v >= 0;
const parmi = (...l) => (v) => l.includes(v);
const texte = (max) => (v) => typeof v === 'string' && v.length > 0 && v.length <= max;
const motif = (re) => (v) => typeof v === 'string' && re.test(v);
const sha = motif(RE_SHA);
const hex64 = motif(RE_HEX64);
const lancee = parmi('ok', 'erreur', 'non-lancee');
const SCHEMA = {
  protocole: parmi(FAITS),
  demande: { branche: texte(200), candidat: texte(40), base: texte(40), version_base: texte(20), version_candidat: texte(20) },
  provenance: { workflow_ref: texte(300), verificateur_sha: sha, run_id: motif(/^[0-9]{1,20}$/), depot: texte(200) },
  identite: {
    statut: parmi('etablie', 'refusee', 'non-etablie'), branche_existe: bool, branche_pointe: ou(sha), est_commit: bool, base_tag: ou(sha),
    base_est_commit: bool, tag_ancetre_base: bool, base_sur_main: bool,
    version_fichier_base: ou(texte(40)), base_ancetre: bool, merge_base: ou(sha), commits: entier, fusions: entier,
    tag_candidat_libre: bool, main: ou(sha), branche_pointe_fin: ou(sha), constats: liste(texte(500), 50),
    segment: {
      statut: parmi('etabli', 'non-calcule'), commits: entier, fusions: entier,
      fichiers: liste({ chemin: cheminGit, etat: parmi('cree', 'modifie', 'supprime'), mode: parmi(...MODES) }, 5000),
      refuses: liste({ chemin: cheminGit, mode: motif(/^[0-7]{6}$/), motif: texte(100) }, 5000),
      hors_outillage: liste(cheminGit, 5000),
    },
  },
  diff: {
    statut: parmi('etabli', 'vide', 'refuse', 'non-calcule', 'non-etabli'),
    fichiers: liste({ chemin: cheminGit, etat: parmi('cree', 'modifie', 'supprime'), mode: parmi(...MODES) }, 5000),
    refuses: liste({ chemin: cheminGit, mode: motif(/^[0-7]{6}$/), motif: texte(100) }, 5000),
    zones_touchees: liste(cheminGit, 5000), tests_supprimes: liste(cheminGit, 5000),
    tests_modifies: liste({ chemin: cheminGit, marque_mise_a_jour: bool }, 5000),
  },
  execution: {
    statut: parmi('executee', 'non-lancee', 'impossible'), version_injectee: ou(texte(40)), injection_relue: bool,
    fichiers_injectes: liste(cheminGit, 100), delai_ms: ou(entier), code: ou(Number.isSafeInteger), duree_tests_ms: ou(entier),
    verifier_sha256: ou(hex64), deballer_sha256: ou(hex64),
  },
  tests: {
    statut: parmi('executes', 'echec', 'delai-depasse', 'crash', 'resume-absent', 'non-lances'),
    total: ou(entier), reussis: ou(entier), echecs: ou(entier), annules: ou(entier), ignores: ou(entier),
  },
  robot: { syntaxe: lancee, json: lancee, fumee: lancee, erreurs: liste(texte(500), 50) },
  erreurs_techniques: liste(texte(500), 50),
  empreinte: hex64,
};

function raisonSchema(v, s, lieu) {
  if (typeof s === 'function') return s(v) ? null : `${lieu} : valeur non conforme ${JSON.stringify(v)?.slice(0, 80)}`;
  if (s[LISTE]) {
    if (!Array.isArray(v) || v.length > s.max) return `${lieu} : liste de ${s.max} éléments au plus attendue`;
    for (let i = 0; i < v.length; i += 1) {
      const r = raisonSchema(v[i], s[LISTE], `${lieu}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  const r = raisonCles(v, Object.keys(s), lieu);
  if (r) return r;
  for (const k of Object.keys(s)) {
    const e = raisonSchema(v[k], s[k], `${lieu}.${k}`);
    if (e) return e;
  }
  return null;
}

const egales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Cohérence interne des faits : ce que l'outil écrit doit se recouper ; sinon les faits ne sont pas lisibles.
function raisonCoherence(f) {
  const { demande: d, identite: id, diff, execution: ex, tests: t } = f;
  const technique = f.erreurs_techniques.length > 0;
  const sg = id.segment;
  const cheminsSegment = [...sg.fichiers, ...sg.refuses].map((x) => x.chemin);
  if (new Set(cheminsSegment).size !== cheminsSegment.length) return 'identite.segment : chemin en double';
  if (!egales(sg.hors_outillage, horsOutillage(sg))) return 'identite.segment.hors_outillage : ne correspond pas aux fichiers du segment';
  if (sg.statut === 'non-calcule' && (sg.commits || sg.fusions || cheminsSegment.length)) return 'identite.segment : non calculé mais renseigné';
  if (sg.statut === 'etabli' && !(id.base_tag && id.tag_ancetre_base)) return 'identite.segment : établi sans étiquette ancêtre de la base';
  if (sg.statut === 'etabli' && sg.commits === 0 && cheminsSegment.length) return 'identite.segment : fichiers sans commit';
  if (sg.statut === 'non-calcule' && id.base_tag && id.tag_ancetre_base && !technique) return 'identite.segment : non calculé malgré une étiquette ancêtre de la base';
  if (id.statut === 'non-etablie') {
    if (!technique) return 'identite : non établie sans erreur technique';
  } else {
    if (!egales(id.constats, jugerIdentite(d, id))) return 'identite.constats : ne correspondent pas aux faits d\'identité';
    if ((id.statut === 'etablie') !== (id.constats.length === 0)) return 'identite.statut : incohérent avec les constats';
  }
  const chemins = [...diff.fichiers, ...diff.refuses].map((x) => x.chemin);
  const etabliOuPas = { etabli: diff.fichiers.length > 0 && diff.refuses.length === 0, vide: chemins.length === 0, refuse: diff.refuses.length > 0 };
  if (id.statut !== 'etablie' && !['non-calcule', 'non-etabli'].includes(diff.statut)) return 'diff : calculé sans identité établie';
  if (['non-calcule', 'non-etabli'].includes(diff.statut)) {
    if (chemins.length || diff.zones_touchees.length || diff.tests_supprimes.length || diff.tests_modifies.length) return `diff : ${diff.statut} mais des chemins sont listés`;
    if (diff.statut === 'non-etabli' && !technique) return 'diff : non établi sans erreur technique';
    if (diff.statut === 'non-calcule' && id.statut === 'etablie') return 'diff : non calculé malgré une identité établie';
  } else if (!etabliOuPas[diff.statut]) return `diff.statut : « ${diff.statut} » incohérent avec les listes`;
  if (new Set(chemins).size !== chemins.length) return 'diff : chemin en double';
  if (!egales(diff.zones_touchees, [...chemins].filter(zonePermanente).sort(tri))) return 'diff.zones_touchees : ne correspond pas au diff';
  const sousTests = (etat) => diff.fichiers.filter((x) => x.etat === etat && x.chemin.startsWith('tests/')).map((x) => x.chemin);
  if (!egales(diff.tests_supprimes, sousTests('supprime'))) return 'diff.tests_supprimes : ne correspond pas au diff';
  if (!egales(diff.tests_modifies.map((x) => x.chemin), sousTests('modifie'))) return 'diff.tests_modifies : ne correspond pas au diff';
  const executable = id.statut === 'etablie' && diff.statut === 'etabli';
  if (ex.statut === 'executee') {
    if (!executable) return 'execution : candidat exécuté sans identité et diff établis';
    if (ex.version_injectee !== d.version_candidat) return `execution.version_injectee : ${JSON.stringify(ex.version_injectee)} ≠ version demandée ${d.version_candidat} (exécution non représentative du robot)`;
    if (!ex.injection_relue || ex.delai_ms === null || ex.verifier_sha256 === null || ex.deballer_sha256 === null) return 'execution : injection non relue, délai ou empreintes du robot absents';
    if (t.statut === 'non-lances') return 'tests : non lancés malgré une exécution';
  } else {
    if (t.statut !== 'non-lances') return `tests : ${t.statut} sans exécution`;
    if (ex.statut === 'non-lancee' && executable) return 'execution : non lancée malgré une identité et un diff établis';
    if (ex.statut === 'impossible' && !technique) return 'execution : impossible sans erreur technique';
  }
  const comptes = ['total', 'reussis', 'echecs', 'annules', 'ignores'].map((k) => t[k]);
  if (['executes', 'echec'].includes(t.statut) && comptes.includes(null)) return `tests : comptes absents pour « ${t.statut} »`;
  if (t.statut === 'non-lances' && comptes.some((c) => c !== null)) return 'tests : comptes présents sans exécution';
  if (t.statut === 'executes' && (t.total < 1 || t.echecs !== 0 || t.annules !== 0)) return 'tests : « executes » avec échec, annulation ou aucun test';
  if (t.statut === 'echec' && t.echecs === 0 && t.annules === 0) return 'tests : « echec » sans échec ni annulation';
  return null;
}

function raisonFaits(f, hacherSha256) {
  if (estObjet(f) && FAITS_PERIMES.includes(f.protocole)) return `protocole ${f.protocole} périmé : ${FAITS} attendu (relancer la vérification avec le lanceur actuel)`;
  const r = raisonSchema(f, SCHEMA, 'atelier-faits');
  if (r) return r;
  const dm = raisonDemande(f.demande);
  if (dm) return dm;
  const { empreinte, ...sans } = f;
  if (hacherSha256(canonique(sans)) !== empreinte) return 'empreinte : ne correspond pas au contenu (faits altérés ou tronqués)';
  return raisonCoherence(f);
}

function canonique(v) {
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`;
  if (estObjet(v)) return `{${Object.keys(v).sort(tri).map((k) => `${JSON.stringify(k)}:${canonique(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const trie = (v) => (Array.isArray(v) ? v.map(trie) : estObjet(v) ? Object.fromEntries(Object.keys(v).sort(tri).map((k) => [k, trie(v[k])])) : v);

function verifierHachage(hacherSha256) {
  if (typeof hacherSha256 !== 'function') throw new TypeError('hacherSha256 : fonction (texte -> 64 hexadécimaux) attendue.');
}

export function ecrireFaits(faits, hacherSha256) {
  verifierHachage(hacherSha256);
  if (!estObjet(faits) || Object.hasOwn(faits, 'empreinte')) throw new TypeError('ecrireFaits : objet sans empreinte attendu.');
  const complet = { ...faits, empreinte: hacherSha256(canonique(faits)) };
  const r = raisonFaits(complet, hacherSha256);
  if (r) throw new TypeError(`ecrireFaits : ${r}.`);
  return `${JSON.stringify(trie(complet), null, 2)}\n`;
}

// Première clé en double d'un texte JSON déjà reconnu par JSON.parse (même lecteur structurel que mission.js), ou null.
function cleEnDouble(t) {
  const pile = [];
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    const cadre = pile[pile.length - 1];
    if (c === '"') {
      let j = i + 1;
      while (t[j] !== '"') j += t[j] === '\\' ? 2 : 1;
      if (cadre && cadre.cles && cadre.attendCle) {
        const cle = JSON.parse(t.slice(i, j + 1));
        if (cadre.cles.has(cle)) return cle;
        cadre.cles.add(cle);
        cadre.attendCle = false;
      }
      i = j;
    } else if (c === '{') pile.push({ cles: new Set(), attendCle: true });
    else if (c === '[') pile.push({ cles: null });
    else if (c === '}' || c === ']') pile.pop();
    else if (c === ',' && cadre && cadre.cles) cadre.attendCle = true;
  }
  return null;
}

export function lireFaits(t, hacherSha256) {
  verifierHachage(hacherSha256);
  if (typeof t !== 'string' || t.trim().length === 0) return geler({ raison: 'faits vides ou absents' });
  if (t.length > 2000000) return geler({ raison: 'faits de plus de 2 000 000 caractères' });
  let f;
  try { f = JSON.parse(t); } catch { return geler({ raison: 'JSON illisible (tronqué ?)' }); }
  if (!estObjet(f)) return geler({ raison: 'la racine des faits doit être un objet JSON' });
  const double = cleEnDouble(t);
  if (double !== null) return geler({ raison: `clé en double « ${double} »` });
  const r = raisonFaits(f, hacherSha256);
  return geler(r ? { raison: r } : { faits: f });
}

// --------------------------------------------------------------------------------------------------- confrontation
export function confronter({ mission, rapport, faits, hacherSha256 } = {}) {
  verifierHachage(hacherSha256);
  const res = {
    identite: 'non-etablie', diff: 'non-etabli', frontieres: 'non-etablies', tests: 'non-etablis', robot: 'non-etabli', rapport: 'non-confronte',
    divergences_rapport: [], a_examiner: [], raisons_non_conformite: [], raisons_impossibilite: [],
  };
  const fin = (verdict) => geler({ protocole: CONFRONTATION, verdict_technique: verdict, ...res });
  const impossible = (r) => { res.raisons_impossibilite.push(r); return fin(IMPOSSIBLE); };
  try { construireMission(mission); } catch (e) { return impossible(`mission illisible : ${e.message}`); }
  const lu = lireFaits(faits, hacherSha256);
  if (lu.raison) return impossible(`faits illisibles : ${lu.raison}`);
  const f = lu.faits;
  const d = f.demande;
  if (!RE_WORKFLOW.test(f.provenance.workflow_ref)) return impossible(`provenance non reconnue « ${f.provenance.workflow_ref} » : seul .github/workflows/atelier-verification.yml@refs/heads/main est reçu`);
  const branche = `atelier/${mission.chantier}/${mission.jalon.id}/${mission.tentative}`;
  if (d.branche !== branche) return impossible(`faits d'une autre demande : branche ${d.branche}, ${branche} attendue`);
  if (d.base !== mission.base.sha || d.version_base !== mission.base.version) return impossible(`faits d'une autre demande : base ${d.base} (${d.version_base}), ${mission.base.sha} (${mission.base.version}) attendue`);
  const nc = (r) => res.raisons_non_conformite.push(r);
  const ip = (r) => res.raisons_impossibilite.push(r);
  const vr = verifierRapport(mission, rapport);
  let r = null;
  if (vr.structure !== 'conforme') { res.rapport = 'non-conforme'; nc(`rapport non conforme au protocole : ${vr.raison}`); }
  else if (vr.statutAnnonce !== 'candidat') { res.rapport = 'non-conforme'; nc(`rapport « ${vr.statutAnnonce} » : aucun candidat annoncé, il ne peut être vérifié comme candidat`); }
  else {
    r = vr.rapport;
    if (r.candidat.sha !== d.candidat) return impossible(`faits d'une autre demande : candidat ${d.candidat}, le rapport annonce ${r.candidat.sha}`);
  }
  for (const e of f.erreurs_techniques) ip(`erreur technique : ${e}`);
  const id = f.identite;
  const sg = id.segment;
  if (sg.statut === 'etabli' && sg.commits > 0) {
    const noms = [...sg.fichiers, ...sg.refuses].map((x) => x.chemin).join(', ') || '(aucun fichier)';
    res.a_examiner.push(`segment d'outillage hors colis entre l'étiquette v${d.version_base} et la base ${d.base} : ${sg.commits} commit(s) ; fichiers : ${noms} (il n'appartient pas au candidat et n'est pas une version ; revue humaine nécessaire)`);
  }
  if (id.statut === 'etablie') res.identite = 'verifiee';
  else if (id.statut === 'refusee') { res.identite = 'non-conforme'; for (const c of id.constats) nc(`identité : ${c}`); }
  else ip('identité Git non établie');
  const diff = f.diff;
  if (diff.statut === 'etabli') res.diff = 'verifie';
  else if (diff.statut === 'vide') { res.diff = 'non-conforme'; nc('diff vide : le candidat ne change aucun fichier'); }
  else if (diff.statut === 'refuse') { res.diff = 'non-conforme'; for (const x of diff.refuses) nc(`diff : « ${x.chemin} » refusé (${x.motif}, mode ${x.mode})`); }
  else if (diff.statut === 'non-etabli') ip('diff réel non établi');
  if (['etabli', 'vide', 'refuse'].includes(diff.statut)) {
    const interdits = mission.interdits ?? [];
    const violations = [];
    for (const p of [...diff.fichiers, ...diff.refuses].map((x) => x.chemin).sort(tri)) {
      if (zonePermanente(p)) violations.push(`zone permanente touchée : « ${p} »`);
      else if (interdits.some((x) => couvre(x, p))) violations.push(`interdit pour ce jalon : « ${p} »`);
      else if (!mission.autorises.some((x) => couvre(x, p))) violations.push(`hors du périmètre autorisé : « ${p} »`);
    }
    for (const p of diff.tests_supprimes) violations.push(`test existant supprimé : « ${p} » (le protocole ne définit aucune autorisation de suppression)`);
    res.frontieres = violations.length ? 'violees' : 'respectees';
    violations.forEach(nc);
    for (const x of diff.tests_modifies) {
      res.a_examiner.push(`test existant modifié : « ${x.chemin} » ; ${x.marque_mise_a_jour ? 'ses ajouts portent' : 'AUCUN de ses ajouts ne porte'} « MISE À JOUR DÉLIBÉRÉE » (indice seulement, revue humaine nécessaire)`);
    }
  }
  const t = f.tests;
  if (t.statut === 'executes') res.tests = 'executes-sans-echec';
  else if (t.statut === 'echec') { res.tests = 'en-echec'; nc(`tests réels en échec : ${t.echecs} échec(s), ${t.annules} annulé(s) sur ${t.total}`); }
  else if (t.statut === 'delai-depasse') { res.tests = 'delai-depasse'; nc(`délai du vérificateur du robot dépassé (${f.execution.delai_ms} ms) : le robot refuserait ce candidat`); }
  else if (t.statut === 'crash') ip('exécution des tests interrompue (crash du vérificateur ou de la suite)');
  else if (t.statut === 'resume-absent') ip('résumé des tests absent : comptes réels inconnus');
  else if (f.execution.statut === 'impossible') ip('exécution du candidat impossible');
  const ex = f.execution;
  if (ex.statut === 'executee' && ex.duree_tests_ms !== null && ex.delai_ms > 0 && ex.duree_tests_ms > ex.delai_ms * MARGE_INFORMATIVE) {
    res.a_examiner.push(`marge de délai faible : durée des tests ${ex.duree_tests_ms} ms, soit ${Math.floor((ex.duree_tests_ms * 100) / ex.delai_ms)} % du délai de ${ex.delai_ms} ms du robot (information seulement)`);
  }
  if (f.execution.statut === 'executee') {
    const rb = f.robot;
    if (rb.erreurs.length || [rb.syntaxe, rb.json, rb.fumee].includes('erreur')) {
      res.robot = 'en-erreur';
      if (rb.erreurs.length) rb.erreurs.forEach((e) => nc(`vérificateur du robot : ${e}`));
      else nc('vérificateur du robot : contrôle en erreur');
    } else if ([rb.syntaxe, rb.json, rb.fumee].includes('non-lancee')) ip('contrôle du robot non lancé (syntaxe, JSON ou fumée)');
    else res.robot = 'sans-erreur';
  }
  if (r && ['etabli', 'refuse'].includes(diff.statut)) {
    const div = res.divergences_rapport;
    const declares = { cree: r.fichiers.crees, modifie: r.fichiers.modifies, supprime: r.fichiers.supprimes };
    const reels = diff.fichiers;
    const etatReel = new Map(reels.map((x) => [x.chemin, x.etat]));
    const refuse = new Set(diff.refuses.map((x) => x.chemin));
    for (const [etat, l] of Object.entries(declares)) {
      for (const p of l) {
        if (etatReel.get(p) === etat || refuse.has(p)) continue;
        div.push(etatReel.has(p) ? `« ${p} » déclaré ${etat}, Git le montre ${etatReel.get(p)}` : `« ${p} » déclaré ${etat}, absent du diff réel`);
      }
    }
    for (const x of reels) if (!declares[x.etat].includes(x.chemin) && !Object.values(declares).some((l) => l.includes(x.chemin))) div.push(`« ${x.chemin} » ${x.etat} selon Git, non déclaré par le rapport`);
    if (['executes', 'echec'].includes(t.statut)) {
      for (const [k, reel] of [['total', t.total], ['reussis', t.reussis], ['echecs', t.echecs]]) {
        if (r.tests[k] !== reel) div.push(`tests.${k} : le rapport annonce ${r.tests[k]}, l'exécution réelle compte ${reel}`);
      }
    }
    res.rapport = div.length ? 'divergent' : 'concordant';
    if (div.length) nc(`rapport divergent des faits : ${div.length} écart(s)`);
  }
  if (res.raisons_non_conformite.length) return fin(NON_CONFORME);
  if (res.raisons_impossibilite.length) return fin(IMPOSSIBLE);
  const complet = res.identite === 'verifiee' && res.diff === 'verifie' && res.frontieres === 'respectees' && res.tests === 'executes-sans-echec'
    && res.robot === 'sans-erreur' && res.rapport === 'concordant';
  return complet ? fin(CONFORME) : impossible('faits incomplets : un contrôle n\'a pas pu être établi');
}
// === FIN_ATELIER_VERIFICATION ===
