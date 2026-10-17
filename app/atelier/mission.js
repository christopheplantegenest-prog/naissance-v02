// === DEBUT_ATELIER_MISSION ===
// v0.65.2 — AT-3 « DOSSIER DE MISSION DÉTERMINISTE + SCHÉMA DU RAPPORT DE RETOUR » (GO « AUTORISATION AT-3 », 17/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Ce module ne connaît ni le moteur, ni la mémoire, ni aucune table, ni
// les autres modules de l'atelier : il reçoit des données explicites (décisions déjà choisies et copiées) et ne lit aucun état extérieur.
//   construireMission(donnees)      -> le dossier : UNE chaîne, identique octet pour octet à données égales (invalide : TypeError)
//   verifierRapport(donnees, texte) -> { structure: 'conforme', statutAnnonce, rapport } ou { structure: 'non-conforme', raison }
// Le dossier n'a aucune autre entrée que ses données : ni transport, ni horloge, ni hasard, ni compteur. Sections dans un ordre fixe,
// LF seulement, fin « FIN DE MISSION\n », 16 000 octets UTF-8 au plus. Une donnée non canonique est REFUSÉE, jamais corrigée (pas de
// trim, pas de conversion de fin de ligne, pas de normalisation Unicode). Ensembles sans ordre (autorisés, interdits, décisions) :
// triés par unités de code UTF-16 (décisions par id) ; critères, tests et frontières : ordre fourni conservé. Doublons refusés.
// Périmètre purement syntaxique : un chemin « a/ » couvre tout ce qui commence par « a/ », sinon égalité exacte ; une interdiction
// gagne toujours sur une autorisation plus large ; les zones permanentes (comparées en minuscules, comme le robot) gagnent sur tout.
// Le rapport ne vérifie que la FORME (AT-5 vérifiera le contenu) ; « candidat » = Claude affirme un candidat contrôlable, rien de plus.
// PURETÉ : aucun import, aucune horloge, aucun hasard, aucun état, aucune entrée/sortie. NON BRANCHÉ : aucun appelant.

const MISSION = 'atelier-mission-1';
const RAPPORT = 'atelier-rapport-1';
const STATUTS = Object.freeze(['candidat', 'bloque', 'echec']);
const LIMITE_OCTETS = 16000;
const ZONES_DOSSIERS = Object.freeze(['.git', '.github', 'signature', 'android', 'node_modules']);
const ZONES_FICHIERS = Object.freeze(['version', 'etat.md', 'app/version.js', 'sw.js', 'app/sw.js']);
const REGLES = Object.freeze([
  '1. Tu es le développeur. Tu produis un CANDIDAT ISOLÉ sur la branche du candidat indiquée ci-dessus, créée depuis base.sha exact. Tu ne touches jamais à main, ni à aucun tag, release ou dépôt de colis.',
  '2. OUTILLAGE NON COGNITIF : tu ne décides jamais qu\'une acquisition de Naissance est validée. Ton rapport annonce au plus un candidat contrôlable, jamais une acceptation.',
  '3. Zones toujours interdites : .git/, .github/, signature/, android/, node_modules/, VERSION, ETAT.md, app/version.js, sw.js, app/sw.js, tout .zip à la racine.',
  '4. Tu ne crées, ne modifies et ne supprimes que des fichiers du périmètre autorisé. Une interdiction gagne toujours sur une autorisation plus large.',
  '5. Aucun secret : tu n\'en lis pas, n\'en écris pas, n\'en affiches pas.',
  '6. Tests : lance la suite complète « node --test --test-concurrency=3 » sur tests/*.test.mjs en ordre trié et donne les nombres exacts. Aucun test existant n\'est supprimé, désactivé ni affaibli. Toute mise à jour de garde porte « MISE À JOUR DÉLIBÉRÉE vX » et est justifiée.',
  '7. Ambiguïté réelle : n\'invente rien. Rends le statut bloque avec UNE question précise.',
  '8. Échec : ne relance pas en boucle. Rends le statut echec avec son motif.',
  '9. Ton rapport est UN seul objet JSON conforme au gabarit ci-dessous, sans aucune clé ajoutée.',
]);
const REGLES_RAPPORT = Object.freeze([
  'Rends uniquement l\'objet JSON ci-dessous, rempli, seul, sans autre texte. Toutes les clés sont obligatoires.',
  'statut : « candidat » (tu affirmes avoir produit un candidat contrôlable), « bloque » (question) ou « echec » (motif). Aucun autre statut.',
  'candidat : { branche, sha } si statut candidat (branche = la branche du candidat ci-dessus, sha = 40 caractères hexadécimaux minuscules), sinon null.',
  'fichiers : chemins relatifs créés, modifiés, supprimés ; sans doublon ; tous dans le périmètre.',
  'tests : { total, reussis, echecs } en entiers ; pour candidat, echecs = 0 et reussis = total ; null permis pour bloque et echec.',
  'divergences : liste de textes (tout écart par rapport à cette mission), [] si aucun.',
  'question : texte si bloque, sinon null. motif : texte si echec, sinon null.',
]);

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const RE_CHEMIN = /^[A-Za-z0-9._/-]+$/;
const RE_INTERDIT = /[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}

// Nombre d'octets UTF-8 d'une chaîne bien formée.
function octets(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}

// Clés exactes d'un objet : raison (clés triées) ou null.
function raisonCles(o, obligatoires, facultatives, lieu) {
  if (!estObjet(o)) return `${lieu} : objet attendu`;
  const inconnues = Object.keys(o).filter((k) => !obligatoires.includes(k) && !facultatives.includes(k)).sort();
  if (inconnues.length) return `${lieu} : clé inconnue ${inconnues.join(', ')}`;
  const absentes = obligatoires.filter((k) => !Object.hasOwn(o, k)).sort();
  if (absentes.length) return `${lieu} : clé absente ${absentes.join(', ')}`;
  return null;
}

// Texte canonique : non vide, sans espace au bord, sans \r, tabulation ni contrôle, NFC, aucune ligne de section.
function raisonTexte(v, lieu, max, plusieursLignes) {
  if (typeof v !== 'string' || v.length === 0) return `${lieu} : texte non vide attendu`;
  if (v.length > max) return `${lieu} : plus de ${max} caractères`;
  if (RE_INTERDIT.test(v)) return `${lieu} : caractère interdit (\\r, tabulation, contrôle, U+2028/2029 ou demi-caractère)`;
  if (!plusieursLignes && v.includes('\n')) return `${lieu} : une seule ligne attendue`;
  if (v.normalize('NFC') !== v) return `${lieu} : texte non NFC`;
  for (const l of v.split('\n')) {
    if (/^\s|\s$/.test(l) && l !== '') return `${lieu} : espace au début ou à la fin d'une ligne`;
    if (l.startsWith('== ') || l === 'FIN DE MISSION') return `${lieu} : ligne réservée au dossier « ${l} »`;
  }
  if (v.startsWith('\n') || v.endsWith('\n')) return `${lieu} : ligne vide au début ou à la fin`;
  return null;
}

// Syntaxe d'un chemin (celle du robot, plus un jeu de caractères sûr) ; un dossier finit par « / » si permis.
function raisonChemin(p, lieu, dossierPermis) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 200) return `${lieu} : chemin de 1 à 200 caractères attendu`;
  if (!RE_CHEMIN.test(p)) return `${lieu} : caractère interdit dans « ${p} » (lettres ASCII, chiffres, . _ - / seulement)`;
  if (p.endsWith('/') && !dossierPermis) return `${lieu} : « ${p} » est un dossier, un fichier est attendu`;
  const corps = p.endsWith('/') ? p.slice(0, -1) : p;
  if (corps.split('/').some((m) => m === '' || m === '.' || m === '..')) return `${lieu} : chemin irrégulier « ${p} »`;
  return null;
}

const couvre = (entree, p) => (entree.endsWith('/') ? p.startsWith(entree) : p === entree);
function enZonePermanente(p) {
  const b = p.toLowerCase();
  return ZONES_DOSSIERS.includes(b.split('/')[0]) || ZONES_FICHIERS.includes(b) || (!b.includes('/') && b.endsWith('.zip'));
}

// Liste : bornes, éléments valides, sans doublon. Rend une raison ou null.
function raisonListe(v, lieu, min, max, raisonElement, cle = (x) => x) {
  if (!Array.isArray(v)) return `${lieu} : liste attendue`;
  if (v.length < min || v.length > max) return `${lieu} : ${min} à ${max} éléments attendus`;
  const vus = new Set();
  for (let i = 0; i < v.length; i += 1) {
    const r = raisonElement(v[i], `${lieu}[${i}]`);
    if (r) return r;
    if (vus.has(cle(v[i]))) return `${lieu} : doublon « ${cle(v[i])} »`;
    vus.add(cle(v[i]));
  }
  return null;
}

// Valide les données de mission ; rend { m } (forme canonique) ou { raison }.
function lire(d) {
  let r = raisonCles(d, ['chantier', 'objectif', 'base', 'jalon', 'tentative', 'criteres', 'tests', 'autorises'], ['interdits', 'frontieres', 'decisions'], 'donnees');
  if (r) return { raison: r };
  if (typeof d.chantier !== 'string' || d.chantier.length > 40 || !RE_ID.test(d.chantier)) return { raison: 'chantier : identifiant [a-z0-9-] de 40 caractères au plus attendu' };
  if ((r = raisonTexte(d.objectif, 'objectif', 2000, true))) return { raison: r };
  if ((r = raisonCles(d.base, ['sha', 'version'], [], 'base'))) return { raison: r };
  if (typeof d.base.sha !== 'string' || !RE_SHA.test(d.base.sha)) return { raison: 'base.sha : 40 caractères hexadécimaux minuscules attendus' };
  if (typeof d.base.version !== 'string' || !RE_VERSION.test(d.base.version)) return { raison: 'base.version : X.Y.Z attendu' };
  if ((r = raisonCles(d.jalon, ['id', 'titre', 'comportement'], [], 'jalon'))) return { raison: r };
  if (typeof d.jalon.id !== 'string' || d.jalon.id.length > 40 || !RE_ID.test(d.jalon.id)) return { raison: 'jalon.id : identifiant [a-z0-9-] de 40 caractères au plus attendu' };
  if ((r = raisonTexte(d.jalon.titre, 'jalon.titre', 120, false))) return { raison: r };
  if ((r = raisonTexte(d.jalon.comportement, 'jalon.comportement', 2000, true))) return { raison: r };
  if (!Number.isSafeInteger(d.tentative) || d.tentative < 1) return { raison: 'tentative : entier >= 1 attendu' };
  const ligne = (v, lieu) => raisonTexte(v, lieu, 300, false);
  if ((r = raisonListe(d.criteres, 'criteres', 1, 20, ligne))) return { raison: r };
  if ((r = raisonListe(d.tests, 'tests', 1, 20, ligne))) return { raison: r };
  const interdits = Object.hasOwn(d, 'interdits') ? d.interdits : [];
  const frontieres = Object.hasOwn(d, 'frontieres') ? d.frontieres : [];
  const decisions = Object.hasOwn(d, 'decisions') ? d.decisions : [];
  const chemin = (v, lieu) => raisonChemin(v, lieu, true);
  if ((r = raisonListe(d.autorises, 'autorises', 1, 50, chemin))) return { raison: r };
  if ((r = raisonListe(interdits, 'interdits', 0, 50, chemin))) return { raison: r };
  for (const a of d.autorises) {
    if (enZonePermanente(a)) return { raison: `autorises : « ${a} » est dans une zone permanente interdite` };
    const i = interdits.find((x) => couvre(x, a));
    if (i !== undefined) return { raison: `autorises : « ${a} » est couvert par l'interdiction « ${i} »` };
  }
  if ((r = raisonListe(frontieres, 'frontieres', 0, 20, ligne))) return { raison: r };
  const decision = (v, lieu) => raisonCles(v, ['id', 'texte'], [], lieu)
    || (typeof v.id !== 'string' || !/^D-\d{3}$/.test(v.id) ? `${lieu}.id : D-xxx attendu` : null)
    || raisonTexte(v.texte, `${lieu}.texte`, 1500, true);
  if ((r = raisonListe(decisions, 'decisions', 0, 10, decision, (x) => x.id))) return { raison: r };
  const tri = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    m: {
      chantier: d.chantier, objectif: d.objectif, sha: d.base.sha, version: d.base.version, jalon: d.jalon.id, titre: d.jalon.titre,
      comportement: d.jalon.comportement, tentative: d.tentative, criteres: [...d.criteres], tests: [...d.tests],
      autorises: [...d.autorises].sort(tri), interdits: [...interdits].sort(tri), frontieres: [...frontieres],
      decisions: decisions.map((x) => ({ id: x.id, texte: x.texte })).sort((a, b) => tri(a.id, b.id)),
      branche: `atelier/${d.chantier}/${d.jalon.id}/${d.tentative}`,
    },
  };
}

function lireOuLever(fonction, donnees) {
  const l = lire(donnees);
  if (l.raison) throw new TypeError(`${fonction} : ${l.raison}.`);
  return l.m;
}

function gabarit(m) {
  return JSON.stringify({
    protocole: RAPPORT, chantier: m.chantier, jalon: m.jalon, tentative: m.tentative, base: { sha: m.sha, version: m.version },
    statut: 'candidat | bloque | echec', candidat: { branche: m.branche, sha: '<sha du candidat>' },
    fichiers: { crees: [], modifies: [], supprimes: [] }, tests: { total: 0, reussis: 0, echecs: 0 }, divergences: [], question: null, motif: null,
  }, null, 2);
}

export function construireMission(donnees) {
  const m = lireOuLever('construireMission', donnees);
  const numeros = (l) => l.map((x, i) => `${i + 1}. ${x}`);
  const tirets = (l, vide) => (l.length ? l.map((x) => `- ${x}`) : [vide]);
  const decisions = m.decisions.length ? m.decisions.flatMap((x, i) => [...(i ? [''] : []), `[${x.id}]`, ...x.texte.split('\n').map((l) => (l ? `  ${l}` : ''))]) : ['(aucune)'];
  const texte = [
    `MISSION ATELIER — protocole ${MISSION}`, 'OUTILLAGE NON COGNITIF — aucune acquisition de Naissance.', '',
    '== IDENTITÉ ==', `chantier : ${m.chantier}`, `jalon : ${m.jalon}`, `tentative : ${m.tentative}`, `base.sha : ${m.sha}`,
    `base.version : ${m.version}`, `branche du candidat : ${m.branche}`, '',
    '== RÈGLES PERMANENTES DE L\'ATELIER ==', ...REGLES, '',
    '== OBJECTIF DU CHANTIER ==', m.objectif, '',
    '== JALON ==', `titre : ${m.titre}`, 'comportement observable attendu :', m.comportement, '',
    '== CRITÈRES D\'ACCEPTATION ==', ...numeros(m.criteres), '',
    '== TESTS EXIGÉS ==', ...numeros(m.tests), '',
    '== PÉRIMÈTRE ==', 'autorisés :', ...tirets(m.autorises), 'interdits pour ce jalon (en plus des zones permanentes) :', ...tirets(m.interdits, '(aucun)'), '',
    '== FRONTIÈRES DU JALON ==', ...tirets(m.frontieres, '(aucune frontière propre au jalon)'), '',
    '== DÉCISIONS ACTIVES À RESPECTER ==', ...decisions, '',
    '== RAPPORT DE RETOUR ==', ...REGLES_RAPPORT, '', gabarit(m), '',
    'FIN DE MISSION',
  ].join('\n') + '\n';
  if (octets(texte) > LIMITE_OCTETS) throw new TypeError(`construireMission : dossier de ${octets(texte)} octets UTF-8, plus de ${LIMITE_OCTETS}.`);
  return texte;
}

// Première clé en double d'un texte JSON déjà reconnu valide par JSON.parse (qui, lui, garde la dernière valeur), ou null.
// Lecteur strictement structurel : il ne suit que les chaînes, les objets et les listes.
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

const texteLibre = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000;

// Forme du rapport ; rend une raison ou null.
function raisonRapport(m, texte) {
  if (typeof texte !== 'string' || texte.trim().length === 0) return 'rapport vide ou absent';
  if (octets(texte) > LIMITE_OCTETS) return `rapport de plus de ${LIMITE_OCTETS} octets UTF-8`;
  let r;
  try { r = JSON.parse(texte); } catch { return 'JSON illisible'; }
  if (!estObjet(r)) return 'la racine du rapport doit être un objet JSON';
  const double = cleEnDouble(texte);
  if (double !== null) return `clé en double « ${double} » : contenu ambigu`;
  let e = raisonCles(r, ['protocole', 'chantier', 'jalon', 'tentative', 'base', 'statut', 'candidat', 'fichiers', 'tests', 'divergences', 'question', 'motif'], [], 'rapport');
  if (e) return e;
  if (r.protocole !== RAPPORT) return `protocole : « ${RAPPORT} » attendu`;
  if (r.chantier !== m.chantier) return `chantier : « ${m.chantier} » attendu`;
  if (r.jalon !== m.jalon) return `jalon : « ${m.jalon} » attendu`;
  if (r.tentative !== m.tentative) return `tentative : ${m.tentative} attendu`;
  if ((e = raisonCles(r.base, ['sha', 'version'], [], 'base'))) return e;
  if (r.base.sha !== m.sha) return `base.sha : ${m.sha} attendu`;
  if (r.base.version !== m.version) return `base.version : ${m.version} attendu`;
  if (!STATUTS.includes(r.statut)) return `statut inconnu : ${JSON.stringify(r.statut)} (candidat, bloque ou echec)`;
  if (r.candidat !== null) {
    if ((e = raisonCles(r.candidat, ['branche', 'sha'], [], 'candidat'))) return e;
    if (typeof r.candidat.branche !== 'string') return 'candidat.branche : texte attendu';
    if (typeof r.candidat.sha !== 'string' || !RE_SHA.test(r.candidat.sha)) return 'candidat.sha : 40 caractères hexadécimaux minuscules attendus';
  }
  if ((e = raisonCles(r.fichiers, ['crees', 'modifies', 'supprimes'], [], 'fichiers'))) return e;
  const vus = new Set();
  for (const liste of ['crees', 'modifies', 'supprimes']) {
    if (!Array.isArray(r.fichiers[liste])) return `fichiers.${liste} : liste attendue`;
    for (const p of r.fichiers[liste]) {
      if ((e = raisonChemin(p, `fichiers.${liste}`, false))) return e;
      if (vus.has(p)) return `fichiers : doublon « ${p} »`;
      vus.add(p);
      if (enZonePermanente(p)) return `fichiers : « ${p} » est dans une zone permanente interdite`;
      if (m.interdits.some((x) => couvre(x, p))) return `fichiers : « ${p} » est interdit pour ce jalon`;
      if (!m.autorises.some((x) => couvre(x, p))) return `fichiers : « ${p} » hors du périmètre autorisé`;
    }
  }
  if (r.tests !== null) {
    if ((e = raisonCles(r.tests, ['total', 'reussis', 'echecs'], [], 'tests'))) return e;
    for (const k of ['total', 'reussis', 'echecs']) if (!Number.isSafeInteger(r.tests[k]) || r.tests[k] < 0) return `tests.${k} : entier >= 0 attendu`;
    if (r.tests.reussis + r.tests.echecs > r.tests.total) return 'tests : reussis + echecs > total';
  }
  if (!Array.isArray(r.divergences) || r.divergences.length > 50 || !r.divergences.every(texteLibre)) return 'divergences : liste de 50 textes non vides (2000 caractères au plus) attendue';
  for (const k of ['question', 'motif']) if (r[k] !== null && !texteLibre(r[k])) return `${k} : null ou texte non vide de 2000 caractères au plus attendu`;
  if (r.statut === 'candidat') {
    if (r.candidat === null) return 'statut candidat : « candidat » { branche, sha } attendu';
    if (r.candidat.branche !== m.branche) return `candidat.branche : « ${m.branche} » attendue`;
    if (vus.size === 0) return 'statut candidat : au moins un fichier attendu';
    if (r.tests === null || r.tests.total < 1 || r.tests.echecs !== 0 || r.tests.reussis !== r.tests.total) return 'statut candidat : tests avec total >= 1, echecs = 0 et reussis = total attendus';
    if (r.question !== null || r.motif !== null) return 'statut candidat : question et motif doivent valoir null';
  } else {
    if (r.candidat !== null) return `statut ${r.statut} : candidat doit valoir null`;
    const exige = r.statut === 'bloque' ? 'question' : 'motif';
    const nul = r.statut === 'bloque' ? 'motif' : 'question';
    if (r[exige] === null) return `statut ${r.statut} : ${exige} attendu`;
    if (r[nul] !== null) return `statut ${r.statut} : ${nul} doit valoir null`;
  }
  return null;
}

export function verifierRapport(donnees, texte) {
  const m = lireOuLever('verifierRapport', donnees);
  const raison = raisonRapport(m, texte);
  if (raison) return geler({ structure: 'non-conforme', raison });
  const rapport = JSON.parse(texte);
  return geler({ structure: 'conforme', statutAnnonce: rapport.statut, rapport });
}
// === FIN_ATELIER_MISSION ===
