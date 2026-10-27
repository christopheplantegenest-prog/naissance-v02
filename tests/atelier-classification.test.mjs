// v0.66.9 — ATELIER 2, L4 : CLASSIFICATION des colis par le robot de confiance (.github/workflows/classer.py) et CONTRAT du branchement de
// la porte d'essai. Mode OMBRE : la classe est calculée et affichée, jamais utilisée pour décider (V4 conservée pour toute livraison).
// Contre-épreuves volontairement dangereuses : chacune doit être REFUSÉE (protection) ou classée S (avec la règle qui la fait échouer).
// Le classement est calculé par Python, sur la seule différence base -> arbre, sans lire aucune déclaration du colis. Outillage non cognitif.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
const PY = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("classer", sys.argv[1])
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
entree = json.load(sys.stdin)
sortie = []
for cas in entree:
    avant = cas["avant"]; apres = dict(avant)
    for p, v in cas["apres"].items():
        if v is None: apres.pop(p, None)
        else: apres[p] = v
    ch = []
    for p in sorted(set(avant) | set(apres)):
        if p not in apres: ch.append({"chemin": p, "statut": "D"})
        elif p not in avant: ch.append({"chemin": p, "statut": "A"})
        elif avant[p] != apres[p]: ch.append({"chemin": p, "statut": "M"})
    la = lambda p: avant[p].encode() if p in avant else None
    lb = lambda p: apres[p].encode() if p in apres else None
    try:
        c.controler_branchement(ch, la, lb)
    except c.ContratRompu as e:
        sortie.append({"nom": cas["nom"], "refus": str(e)}); continue
    r = c.classer(ch, la, lb, lambda: sorted(apres), action=cas.get("action", "livraison"))
    sortie.append({"nom": cas["nom"], "classe": r["classe"], "motifs": r["motifs"], "examens": r["examens"]})
print(json.dumps(sortie, ensure_ascii=False))
`;
function evaluer(cas) {
  const r = spawnSync('python3', ['-I', '-B', '-c', PY, join(RACINE, '.github', 'workflows', 'classer.py')], { input: JSON.stringify(cas), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return Object.fromEntries(JSON.parse(r.stdout).map((x) => [x.nom, x]));
}

// ------------------------------------------------------------------------------------------------ base et colis types
const BASE = Object.fromEntries(['app/langage/connaissances.js', 'app/essais/registre-essais.js', 'app/main.js', 'app/index.html', 'app/styles.css', 'app/icones/icone.svg', 'app/version.js', 'tests/essais-porte.test.mjs'].map((p) => [p, lire(p)]));
const DECL = (x = {}) => ({ id: 'compte-receptions', titre: 'Compte', description: 'essai', lit: ['receptions'], effet: 'zone-essai', declencheurs: ['apres-tour'], delaiMs: 1000, maxLignes: 1, invariants: [{ type: 'champs', champs: ['n'] }], ...x });
const CAT = (...capacites) => `${JSON.stringify({ format: 'naissance-capacites-essai', v: 1, capacites }, null, 1)}\n`;
const MOD = 'export function executer(entree) {\n  const r = entree && entree.lues && Array.isArray(entree.lues.receptions) ? entree.lues.receptions : [];\n  return { lignes: [{ cle: \'n-\' + 0, donnees: { n: r.length } }] };\n}\n'.replace("'n-' + 0", "'n-1'");
const E_OK = { 'app/capacites-essai/catalogue.json': CAT(DECL()), 'app/capacites-essai/compte-receptions.js': MOD, 'tests/capacite-essai-compte-receptions.test.mjs': "import test from 'node:test';\ntest('x', () => {});\n" };
const BASE_E = { ...BASE, 'app/capacites-essai/catalogue.json': CAT(DECL(), DECL({ id: 'autre-capacite' })), 'app/capacites-essai/compte-receptions.js': MOD, 'app/capacites-essai/autre-capacite.js': MOD, 'tests/capacite-essai-autre-capacite.test.mjs': 't\n' };
const MAIN = BASE['app/main.js'];
const HTML = BASE['app/index.html'];
const CSS = BASE['app/styles.css'];
const cas = (nom, apres, { avant = BASE, action } = {}) => ({ nom, avant, apres, action });
const remplacer = (texte, a, b) => { assert.ok(texte.includes(a), a); return texte.replace(a, b); };

const CAS = [
  // ---- classes autorisables (contrôles positifs)
  cas('E : capacité livrée conforme', E_OK),
  cas('O : couleur et marges', { 'app/styles.css': `${CSS}\n.bulle-o { color: #333; margin-top: 4px; }\n` }),
  cas('O : icône SVG inerte', { 'app/icones/icone.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#123"/></svg>\n' }),
  cas('R : retrait d\'une capacité livrée', { 'app/capacites-essai/catalogue.json': CAT(DECL()), 'app/capacites-essai/autre-capacite.js': null, 'tests/capacite-essai-autre-capacite.test.mjs': null }, { avant: BASE_E }),
  cas('changement cognitif ordinaire (main.js hors branchement)', { 'app/main.js': remplacer(MAIN, "// === FIN_DEMARRAGE ===", "// v0.66.9 — note de classification\n// === FIN_DEMARRAGE ===") }),
  // ---- E : contre-épreuves (toutes en S)
  cas('E- réseau dans le module', { ...E_OK, 'app/capacites-essai/compte-receptions.js': MOD.replace('return {', 'fetch(1);\n  return {') }),
  cas('E- gabarit de texte', { ...E_OK, 'app/capacites-essai/compte-receptions.js': MOD.replace("'n-1'", '`n-${1}`') }),
  cas('E- évasion par concaténation', { ...E_OK, 'app/capacites-essai/compte-receptions.js': MOD.replace('return {', "const f = [].map['constr' + 'uctor'];\n  return {") }),
  cas('E- évasion par join', { ...E_OK, 'app/capacites-essai/compte-receptions.js': MOD.replace('return {', "const k = ['constr', 'uctor'];\n  const f = [].map[k.join('')];\n  return {") }),
  cas('E- échappement unicode', { ...E_OK, 'app/capacites-essai/compte-receptions.js': MOD.replace('return {', "const k = '\\u0063onstructor';\n  return {") }),
  cas('E- import d\'un module', { ...E_OK, 'app/capacites-essai/compte-receptions.js': `import { x } from '../essais/zone.js';\n${MOD}` }),
  cas('E- second export', { ...E_OK, 'app/capacites-essai/compte-receptions.js': `${MOD}export const y = 1;\n` }),
  cas('E- minuterie', { ...E_OK, 'app/capacites-essai/compte-receptions.js': MOD.replace('return {', 'setTimeout(executer, 1);\n  return {') }),
  cas('E- champ module dans le catalogue', { ...E_OK, 'app/capacites-essai/catalogue.json': CAT(DECL({ module: '../essais/porte.js' })) }),
  cas('E- champ module anodin dans le catalogue', { ...E_OK, 'app/capacites-essai/catalogue.json': CAT(DECL({ module: './compte-receptions.js' })) }),
  cas('E- identifiant du catalogue figé', { 'app/capacites-essai/catalogue.json': CAT(DECL({ id: 'temoin-porte' })), 'app/capacites-essai/temoin-porte.js': MOD }),
  cas('E- effet sur une réponse', { ...E_OK, 'app/capacites-essai/catalogue.json': CAT(DECL({ effet: 'reponse' })) }),
  cas('E- table inconnue', { ...E_OK, 'app/capacites-essai/catalogue.json': CAT(DECL({ lit: ['receptions', 'cles'] })) }),
  cas('E- délai hors borne', { ...E_OK, 'app/capacites-essai/catalogue.json': CAT(DECL({ delaiMs: 60000 })) }),
  cas('E- module sans entrée', { ...E_OK, 'app/capacites-essai/espion.js': MOD }),
  cas('E- fichier étranger dans le dossier', { ...E_OK, 'app/capacites-essai/LISEZMOI.md': 'x\n' }),
  cas('E- test existant modifié', { ...E_OK, 'tests/essais-porte.test.mjs': BASE['tests/essais-porte.test.mjs'].replace(/^test\(/m, 'test.skip(') }),
  cas('E- mélangé à un changement de main.js', { ...E_OK, 'app/main.js': `${MAIN}// x\n` }),
  cas('E- mélangé à un affichage', { ...E_OK, 'app/styles.css': `${CSS}\n.a { color: red; }\n` }),
  cas('E- retour (action)', E_OK, { action: 'retour' }),
  cas('E- référence aux capacités hors de la porte', { ...E_OK, 'app/outils/espion.js': "export const u = '../capacites-essai/compte-receptions.js';\n" }),
  // ---- O : contre-épreuves
  cas('O- masquer un élément', { 'app/styles.css': `${CSS}\n[data-ouvrir-essais] { display: none; }\n` }),
  cas('O- rendre transparent', { 'app/styles.css': `${CSS}\n.bandeau { opacity: 0; }\n` }),
  cas('O- ressource externe', { 'app/styles.css': `${CSS}\n.a { background-color: red; background: url(https://exemple.org/x.png); }\n` }),
  cas('O- règle existante retirée (display)', { 'app/styles.css': remplacer(CSS, '[hidden] { display: none !important; }', '[hidden] { }') }),
  cas('O- icône avec script', { 'app/icones/icone.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>\n' }),
  cas('O- icône avec gestionnaire', { 'app/icones/icone.svg': '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>\n' }),
  cas('O- icône avec lien externe', { 'app/icones/icone.svg': '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://exemple.org"><circle r="1"/></a></svg>\n' }),
  // ---- R : contre-épreuves
  cas('R- retrait + modification d\'une autre entrée', { 'app/capacites-essai/catalogue.json': CAT(DECL({ delaiMs: 2000 })), 'app/capacites-essai/autre-capacite.js': null }, { avant: BASE_E }),
  cas('R- module supprimé, entrée gardée', { 'app/capacites-essai/autre-capacite.js': null }, { avant: BASE_E }),
  cas('R- entrée retirée, module gardé', { 'app/capacites-essai/catalogue.json': CAT(DECL()) }, { avant: BASE_E }),
  cas('R- retrait + autre suppression', { 'app/capacites-essai/catalogue.json': CAT(DECL()), 'app/capacites-essai/autre-capacite.js': null, 'app/version.js': null }, { avant: BASE_E }),
  // ---- protections du branchement (refus, quelle que soit la classe)
  cas('P- branchement neutralisé dans le bloc', { 'app/main.js': remplacer(MAIN, 'function apresTourEssais(resultat) {\n  try {', 'function apresTourEssais(resultat) {\n  return resultat;\n  try {') }),
  cas('P- appel ajouté hors bloc', { 'app/main.js': remplacer(MAIN, "// === FIN_DEMARRAGE ===", "obtenirPorteEssais().then((p) => p.couper('temoin-porte'));\n// === FIN_DEMARRAGE ===") }),
  cas('P- enveloppe retirée de la conversation', { 'app/main.js': remplacer(MAIN, 'const conversation = monterConversation(avecEssaisApresTour({', 'const conversation = monterConversation(({') }),
  cas('P- balise supprimée', { 'app/main.js': remplacer(MAIN, '// === FIN_BRANCHEMENT_ESSAIS_PORTE ===\n', '') }),
  cas('P- bouton de l\'écran retiré', { 'app/index.html': remplacer(HTML, '<button type="button" class="bouton-secondaire" data-ouvrir-essais>Capacités en essai →</button>\n', '') }),
  cas('P- main.js supprimé', { 'app/main.js': null }),
  cas('P- registre des essais écrit ailleurs', { 'app/outils/espion.js': "localStorage.setItem('naissance-ia.essais.v1', '{}');\n" }),
  cas('P- zone d\'essai ouverte ailleurs', { 'app/outils/espion.js': "indexedDB.open('naissance-essais');\n" }),
  cas('P- import de la porte ailleurs', { 'app/langage/espion.js': "import { couper } from '../essais/registre-essais.js';\n" }),
];

test('classification : contrôles positifs (E, O, R reconnus ; changement ordinaire = S sans refus)', () => {
  const r = evaluer(CAS);
  assert.equal(r['E : capacité livrée conforme'].classe, 'E', JSON.stringify(r['E : capacité livrée conforme']));
  assert.equal(r['O : couleur et marges'].classe, 'O', JSON.stringify(r['O : couleur et marges']));
  assert.equal(r['O : icône SVG inerte'].classe, 'O');
  assert.equal(r['R : retrait d\'une capacité livrée'].classe, 'R', JSON.stringify(r['R : retrait d\'une capacité livrée']));
  const ordinaire = r['changement cognitif ordinaire (main.js hors branchement)'];
  assert.equal(ordinaire.classe, 'S');
  assert.equal(ordinaire.refus, undefined);
});
test('classification : contre-épreuves E, O, R — toutes en S, avec la règle qui échoue', () => {
  const r = evaluer(CAS);
  const attendus = {
    'E- réseau dans le module': /mot interdit « fetch »/, 'E- gabarit de texte': /gabarit/, 'E- évasion par concaténation': /concaténation/,
    'E- évasion par join': /mot interdit « join »/, 'E- échappement unicode': /échappement/, 'E- import d\'un module': /export|mot interdit « import »/,
    'E- second export': /un seul export/, 'E- minuterie': /setTimeout/, 'E- champ module dans le catalogue': /champ refusé \(module\)/,
    'E- champ module anodin dans le catalogue': /champ refusé \(module\)/,
    'E- identifiant du catalogue figé': /catalogue figé/, 'E- effet sur une réponse': /effet/, 'E- table inconnue': /tables lues inconnues/,
    'E- délai hors borne': /délai/, 'E- module sans entrée': /ne correspondent pas/, 'E- fichier étranger dans le dossier': /hors des règles de la classe E|fichier inattendu/,
    'E- test existant modifié': /hors des règles de la classe E/, 'E- mélangé à un changement de main.js': /hors des règles de la classe E/,
    'E- mélangé à un affichage': /hors des règles de la classe E/, 'E- retour (action)': /action « retour »/,
    'E- référence aux capacités hors de la porte': /hors des règles de la classe E|référence/,
    'O- masquer un élément': /« display »/, 'O- rendre transparent': /« opacity »/, 'O- ressource externe': /url/, 'O- règle existante retirée (display)': /« display »/,
    'O- icône avec script': /icône active/, 'O- icône avec gestionnaire': /icône active/, 'O- icône avec lien externe': /icône active/,
    'R- retrait + modification d\'une autre entrée': /ne fait pas que retirer/, 'R- module supprimé, entrée gardée': /aucune capacité retirée/,
    'R- entrée retirée, module gardé': /non supprimé/, 'R- retrait + autre suppression': /hors des règles de la classe R/,
  };
  // un module ou un catalogue livré qui nomme la porte est même REFUSÉ (accès aux essais hors de la porte), plus strict que S
  for (const nom of ['E- import d\'un module', 'E- champ module dans le catalogue']) {
    assert.match(r[nom].refus ?? '', /accès aux essais hors de la porte/, nom);
    delete attendus[nom];
  }
  for (const [nom, re] of Object.entries(attendus)) {
    const x = r[nom];
    assert.equal(x.classe, 'S', `${nom} : ${JSON.stringify(x)}`);
    assert.ok(x.motifs.some((m) => re.test(m)), `${nom} : ${x.motifs.join(' | ')}`);
  }
  // le test affaibli est signalé comme tel dans les motifs de S
  assert.ok(r['E- test existant modifié'].motifs.some((m) => /test existant modifié : tests\/essais-porte\.test\.mjs/.test(m)));
});
test('contrat du branchement : toute atteinte au branchement de la porte ou accès aux essais hors de la porte = REFUS', () => {
  const r = evaluer(CAS);
  const attendus = {
    'P- branchement neutralisé dans le bloc': /bloc BRANCHEMENT_ESSAIS_PORTE modifié/, 'P- appel ajouté hors bloc': /hors des blocs/,
    'P- enveloppe retirée de la conversation': /hors des blocs/, 'P- balise supprimée': /orpheline|bloc BRANCHEMENT_ESSAIS_PORTE modifié/,
    'P- bouton de l\'écran retiré': /BRANCHEMENT_ESSAIS_BOUTON modifié/, 'P- main.js supprimé': /supprimé/,
    'P- registre des essais écrit ailleurs': /naissance-ia/, 'P- zone d\'essai ouverte ailleurs': /naissance-essais/, 'P- import de la porte ailleurs': /essais/,
  };
  for (const [nom, re] of Object.entries(attendus)) assert.match(r[nom].refus ?? '', re, `${nom} : ${JSON.stringify(r[nom])}`);
});
test('classification : indépendante des déclarations — la description et la version du colis ne sont pas lues ; base sans balises = contrat inactif', () => {
  const src = lire('.github/workflows/classer.py');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /_livraison|\bmissions?\b|\brapports?\b/);
  assert.match(code, /^def classer\(changements, lire_avant, lire_apres, lister_apres, action="livraison"\):$/m);
  const sansBalises = { ...BASE, 'app/main.js': MAIN.replace(/\/\/ === (DEBUT|FIN)_BRANCHEMENT_ESSAIS_[A-Z_]+ ===\n/g, '') };
  const r = evaluer([cas('transition', { 'app/main.js': sansBalises['app/main.js'].replace('return resultat;\n}', 'return resultat;\n}\n// x') }, { avant: sansBalises })]);
  assert.equal(r.transition.refus, undefined, 'tant que la base n\'a pas de balise, le contrat ne s\'applique pas (transition documentée)');
});
test('robot : app/essais/ privilégié (P1), chargement dynamique toléré à une seule ligne du bac, classification calculée avant l\'injection de version et affichée en mode ombre', () => {
  const py = lire('.github/workflows/deballer.py');
  assert.match(py, /PRIVILEGIES_MOTIFS = \(re\.compile\(r"\^outils-atelier\/auto-\[\^\/\]\*\\\.mjs\$"\), re\.compile\(r"\^app\/essais\/"\)\)/);
  assert.match(py, /CHARGEMENTS_TOLERES = \{"app\/essais\/bac\.js": "try \{ mod = await import\(url\); \}/);
  const bac = lire('app/essais/bac.js');
  const ligne = py.match(/CHARGEMENTS_TOLERES = \{"app\/essais\/bac\.js": "(.*)"\}/)[1];
  assert.deepEqual(bac.split('\n').filter((l) => /\bimport\s*\(/.test(l)).map((l) => l.trim()), [ligne]);
  const i = py.indexOf('classer.controler_branchement(colis');
  assert.ok(i > 0 && i < py.indexOf('injecter_version(d["version"], journal)\n    mettre_a_l_index()\n    arbre = git_texte("write-tree")'));
  // MISE À JOUR DÉLIBÉRÉE v0.66.14 (FINALISATION) : la classification reste sans effet sur la DÉCISION de l'inventaire ; elle remplit en plus
  // e_auto / e_auto_motif, que seule l'étape « voie » (livraison_auto.py) lit pour choisir entre la voie automatique et la V4.
  assert.match(py, /Classification \(sans effet sur la décision de l'inventaire ; voie de livraison : section suivante\)/);
  // la décision ne dépend jamais de la classe
  const inv = py.slice(py.indexOf('def cmd_inventaire2'), py.indexOf('def cmd_controler'));
  assert.doesNotMatch(inv, /decision\s*=[^,\n]*classif|if [^\n]*classification/);
  // MISE À JOUR DÉLIBÉRÉE ATELIER 3 (PR P1, outillage) : + e_elargie et e_elargie_motif (admissibilité à la voie élargie, affichée et transmise
  // au choix de la voie) ; la décision de l'inventaire ne dépend toujours pas de la classe (assertion précédente inchangée).
  assert.equal((inv.match(/classification\[/g) || []).length, 7, 'la classification ne sert qu\'à remplir classe, classe_motifs, classe_examens, e_auto, e_auto_motif, e_elargie, e_elargie_motif');
  for (const p of ['app/essais/porte.js', 'app/essais/registre-essais.js', 'app/essais/sentinelle.js', 'app/essais/zone.js', 'app/essais/ecran.js', 'app/essais/analyse.js', 'app/essais/verrou.js', 'app/essais/temoin-porte.js']) {
    for (const m of lire(p).matchAll(/from '([^']+)'/g)) assert.ok(m[1].startsWith('./'), `${p} importe ${m[1]} : la fermeture P1 sortirait de app/essais/`);
  }
});

// LIMITE DÉMONTRÉE : une évasion construite pas à pas (morceaux de texte assemblés dans une boucle, accès calculé) passe les règles
// statiques de la classe E. Elle est classée E — les règles statiques ne PROUVENT pas l'innocuité. À l'exécution, le verrou du bac
// (même fonction que app/essais/bac.js, ici dans un realm node:vm) neutralise le constructeur de code : l'évasion échoue, et la porte
// coupe la capacité (exception). C'est pourquoi la classe E ne suffit pas, seule, à une livraison automatique (rapport L4, limites).
test('LIMITE : évasion assemblée à l\'exécution — classée E par les règles statiques, neutralisée par le verrou du bac', async () => {
  const vm = await import('node:vm');
  const { verrouiller } = await import('../app/essais/verrou.js');
  const EVASION = "export function executer(entree) {\n  const k = ['co', 'nstru', 'ctor'];\n  let s = '';\n  for (const p of k) s += p;\n  const f = [].map[s];\n  return { lignes: [{ cle: 'n-1', donnees: { n: f('return 7')() } }] };\n}\n";
  const r = evaluer([cas('limite', { ...E_OK, 'app/capacites-essai/compte-receptions.js': EVASION })]);
  assert.equal(r.limite.classe, 'E', JSON.stringify(r.limite));
  const sansVerrou = vm.runInContext(`(function () { ${EVASION.replace('export function', 'function')} return executer({}); })()`, vm.createContext({}));
  assert.equal(sansVerrou.lignes[0].donnees.n, 7, 'sans le verrou, l\'évasion fabrique et exécute du code');
  const avecVerrou = vm.runInContext(`(function () { const v = (${verrouiller.toString()})(globalThis); if (v.restants.length) return 'verrou'; ${EVASION.replace('export function', 'function')} try { return executer({}); } catch (e) { return 'exception : ' + e.message; } })()`, vm.createContext({}));
  assert.match(String(avecVerrou), /^exception : f is not a function$/);
});

// Règles du classement lui-même (mutations : ambiguïté acceptée, examen en échec pris pour satisfait) : examinateurs remplacés un à un.
test('classement : ambiguïté (plusieurs classes satisfaites) et examen impossible (exception) = S, jamais une classe autorisable', () => {
  const py = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("classer", sys.argv[1])
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
def boum(*a): raise RuntimeError("x")
ch = [{"chemin": "app/x.js", "statut": "A"}]
la = lambda p: None
out = {}
c.examiner_e = lambda *a: None; c.examiner_o = lambda *a: None; c.examiner_r = lambda *a: "non"
out["ambigu"] = c.classer(ch, la, la, lambda: [])
c.examiner_e = boum; c.examiner_o = lambda *a: "non"; c.examiner_r = lambda *a: "non"
out["exception"] = c.classer(ch, la, la, lambda: [])
c.examiner_e = boum; c.examiner_o = lambda *a: None; c.examiner_r = boum
out["exception-et-o"] = c.classer(ch, la, la, lambda: [])
c.examiner_e = lambda *a: None; c.examiner_o = lambda *a: None; c.examiner_r = lambda *a: None
out["retour"] = c.classer(ch, la, la, lambda: [], action="retour")
print(json.dumps(out, ensure_ascii=False))
`;
  const r = spawnSync('python3', ['-I', '-B', '-c', py, join(RACINE, '.github', 'workflows', 'classer.py')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.equal(o.ambigu.classe, 'S');
  assert.match(o.ambigu.motifs[0], /plusieurs classes satisfaites \(E, O\) : ambigu/);
  assert.equal(o.exception.classe, 'S');
  assert.match(o.exception.examens.E, /examen impossible \(RuntimeError\)/);
  assert.equal(o['exception-et-o'].classe, 'O', 'une exception ne satisfait jamais une classe : seule O reste');
  assert.equal(o.retour.classe, 'S');
});
