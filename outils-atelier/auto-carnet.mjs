// === DEBUT_ATELIER_CARNET_GIT ===
// v0.65.18 — AT-10.1 « CARNET DE TROIS MISSIONS » (GO « AT-10.1 — GO RÉALISATION LOCALE », 21/10/2026 ; D-007, décisions AT-10 D3, D8).
// v0.65.20 — AT-10.3 « RELAIS DU CYCLE AUTOMATISÉ » (GO « AT-10.3 — GO RÉALISATION LOCALE », 21/10/2026 ; DA, DB = B1, DC, DE = E1, DF, DG,
// DH) : demande-auto, demande-at5, verifier-ouverture (E1) ; livraison : version = proposerVersion(base) (L2) ; E1 aussi à la sauvegarde.
// OUTILLAGE NON COGNITIF — outil MANUEL HORS APK, lancé par Claude dans un clone du dépôt. Chemin privilégié (P1) par son nom : il ne
// change que par dépôt manuel de Christophe. Il importe app/atelier/carnet.js et outils-atelier/journal-atelier.mjs, qui entrent donc
// dans la fermeture P1 du robot (deballer.py, fermeture_privilegiee). Aucun appel Anthropic, aucun secret, aucune dépense.
//   proposer        --proposition F --sortie DOSSIER                       -> parties ATELIER-PARTIE-2 de la proposition (téléphone)
//   sauver          --depot D --partie F [--partie F …] [--distant origin]  -> confirmation ATELIER-SAUVEGARDE-1 du carnet
//   restaurer       --depot D --carnet ID --sortie DOSSIER [--distant …]    -> parties de l'état du carnet, une par message
//   sauver-chantier --depot D --carnet ID --partie F … [--distant …]        -> sauvegarde D3 du chantier de la mission OUVERTE seulement
//   livraison       --depot D --carnet ID --mission K --version X.Y.Z       -> preuve ATELIER-LIVRAISON-1 (vérifiée par git, sinon STOP)
//   demande-auto    --depot D --carnet ID                                  -> texte EXACT de texteDemandeAuto (auto.js) de la mission ouverte
//   demande-at5     --depot D --carnet ID                                  -> entrées d'atelier-verification (= J4.demande_at5) de la mission ouverte
//   verifier-ouverture --depot D --carnet ID --mission K                  -> E1 : fichiers approuvés pour K inchangés depuis la V1, sinon STOP
// RELAIS (DA) : demande-auto et demande-at5 LISENT seulement (carnet et chantier relus deux fois : tête instable = STOP). Ce qu'elles
// rendent permet à Claude de lancer atelier-auto, puis atelier-verification, dans l'autorisation écrite du carnet ; elles ne lancent
// rien elles-mêmes, et rien ne remplace V2 (environnement atelier-auto), V3 (décision au téléphone) ni V4 (environnement livraison).
// B1 : J1 inchangée ; demande-auto rejoue seulement la garde J1 (auto.js, garder) sur la même D3, comme contrôle préalable.
// AUTORISATION (D3 par carnet, D8) : n'écrire que journal-atelier/<carnet> (carnet.json seul, orpheline puis avance rapide) et, par
// délégation à journal-atelier.mjs, journal-atelier/<carnet>-m<k> de la mission k ouverte et conforme au carnet. Tout autre chantier,
// carnet absent, non approuvé, terminé, arrêté, bloqué, ou chantier divergent : refus par défaut (STOP). Un état identique n'écrit rien.
// LIVRAISON : la preuve n'est émise (et une « mission-livree » n'est sauvegardée) que si TOUT concorde : D3 du chantier terminée sur un
// candidat accepté au coût connu sous le plafond ; branche du candidat sur ce sha, née de la base ; étiquette v<version> sur un commit de
// main dont VERSION vaut la version, de grand-parent la base de la mission (dépôt du colis puis livraison du robot) ; fichiers livrés
// (hors fichiers de version) identiques, blob pour blob, aux fichiers changés du candidat. Accepter un candidat ne vaut pas livraison.
// JAMAIS : force-push, suppression, réécriture, fusion, main, étiquette, branche candidate, appel réseau autre que git vers ce distant.
// Commandes git par listes d'arguments, sans shell ; lectures par « ls-remote » et « fetch » vers des refs locales privées.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemblerParties, decouper, texteConfirmation, brancheJournal, canonique, lireEtatDurable } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { lireProposition, lireEtatCarnet, comparerCarnets, appliquerCarnet, etatCarnet, bilanChantier, comparerChantier, texteLivraison, PROTOCOLE_PROPOSITION_CARNET,
  demandeAutoMission, demandeAt5Mission, fichiersTransmisMission, ecartsTransmis, baseMission, tentativeDeMission } from '../app/atelier/carnet.js';
import { texteDemandeAuto, lireDemandeAuto, garder, nomRun, REF_MAIN } from '../app/atelier/auto.js';
import { proposerVersion } from '../app/atelier/parcours.js';
import { Stop, lireBranche, sauver as sauverChantierD3 } from './journal-atelier.mjs';

const FICHIER = 'carnet.json';
const RE_CARNET = /^carnet-[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
// Fichiers que le robot réécrit à chaque livraison (injection de version) : hors comparaison avec le candidat.
const FICHIERS_VERSION = Object.freeze(['VERSION', 'ETAT.md', 'app/version.js', 'app/sw.js', 'package.json']);

const stop = (raison) => { throw new Stop(`STOP : ${raison}`); };

function lancerGit(depot, args, env, entree) {
  const r = spawnSync('git', ['-C', depot, ...args], { encoding: 'utf8', input: entree, maxBuffer: 64 * 1024 * 1024, env: { ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
  return { code: r.status, sortie: r.stdout ?? '', erreur: `${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}
function git(depot, args, env, entree) {
  const r = lancerGit(depot, args, env, entree);
  if (r.code !== 0) stop(`git ${args[0]} a échoué : ${r.erreur}`);
  return r.sortie;
}
// Têtes distantes de références exactes (une seule lecture) : { ref: sha | null }.
function tetesDistantes(depot, distant, refs, env) {
  const lignes = git(depot, ['ls-remote', distant, ...refs], env).split('\n').filter(Boolean).map((l) => l.split('\t'));
  return Object.fromEntries(refs.map((ref) => {
    const exactes = lignes.filter(([, r]) => r === ref);
    if (exactes.length > 1 || (exactes.length === 1 && !RE_SHA.test(exactes[0][0]))) stop(`référence distante ${ref} ambiguë`);
    return [ref, exactes.length === 1 ? exactes[0][0] : null];
  }));
}
function rapatrier(depot, distant, ref, locale, sha, env) {
  if (lancerGit(depot, ['cat-file', '-e', `${sha}^{commit}`], env).code === 0) return;
  lancerGit(depot, ['update-ref', '-d', locale], env);
  git(depot, ['fetch', '--no-tags', '--quiet', distant, `${ref}:${locale}`], env);
  if (lancerGit(depot, ['cat-file', '-e', `${sha}^{commit}`], env).code !== 0) stop(`${ref} : commit ${sha} introuvable après lecture`);
}
const identifiant = (carnet) => { if (typeof carnet !== 'string' || carnet.length > 37 || !RE_CARNET.test(carnet) || /-m[0-9]+$/.test(carnet)) stop('identifiant de carnet invalide'); return carnet; };

// Lecture COMPLÈTE de journal-atelier/<carnet> : histoire linéaire orpheline, sans ancêtre commun avec main, carnet.json seul à chaque
// commit, chaque état valide, du même carnet, prolongeant strictement le précédent.
export function lireCarnet({ depot, distant = 'origin', carnet, env = process.env }) {
  identifiant(carnet);
  const ref = `refs/heads/${brancheJournal(carnet)}`;
  const tetes = tetesDistantes(depot, distant, [ref, 'refs/heads/main'], env);
  const tete = tetes[ref];
  if (tete === null) return null;
  rapatrier(depot, distant, ref, `refs/atelier-carnet/${carnet}`, tete, env);
  const lignes = git(depot, ['rev-list', '--reverse', '--parents', tete], env).split('\n').filter(Boolean).map((l) => l.split(' '));
  if (lignes.some((l) => l.length > 2)) stop(`${ref} contient une fusion`);
  if (lignes[0].length !== 1 || lignes.slice(1).some((l, i) => l[1] !== lignes[i][0])) stop(`${ref} n'est pas une histoire linéaire née d'une racine orpheline`);
  const main = tetes['refs/heads/main'];
  if (main !== null) {
    rapatrier(depot, distant, 'refs/heads/main', 'refs/atelier-carnet-main/main', main, env);
    if (lancerGit(depot, ['merge-base', tete, main], env).code === 0) stop(`${ref} a un ancêtre commun avec main`);
  }
  let precedent = null;
  let lu = null;
  for (const [commit] of lignes) {
    const arbre = git(depot, ['ls-tree', commit], env).split('\n').filter(Boolean);
    if (arbre.length !== 1 || !/^100644 blob [0-9a-f]{40}\tcarnet\.json$/.test(arbre[0])) stop(`${ref} : le commit ${commit} ne contient pas exactement ${FICHIER}`);
    const texte = git(depot, ['cat-file', 'blob', `${commit}:${FICHIER}`], env);
    lu = lireEtatCarnet(texte);
    if (lu.raison) stop(`${ref} : état du commit ${commit} invalide : ${lu.raison}`);
    if (lu.durable.carnet !== carnet) stop(`${ref} : le commit ${commit} porte le carnet « ${lu.durable.carnet} »`);
    if (precedent) {
      const c = comparerCarnets(precedent, lu.durable);
      if (c.raison) stop(`${ref} : le commit ${commit} ne prolonge pas le précédent : ${c.raison}`);
      if (c.statut === 'identique') stop(`${ref} : le commit ${commit} répète l'état précédent`);
    }
    precedent = lu.durable;
    lu = { ...lu, texte };
  }
  return { tete, texte: lu.texte, durable: lu.durable, etat: lu.etat, empreinte: lu.empreinte, commits: lignes.length };
}

// Fichiers changés entre deux commits (sans renommage) : { chemin: blob | null (supprimé) }.
function changements(depot, de, a, env) {
  const sortie = git(depot, ['diff', '--no-renames', '--raw', '-z', de, a], env);
  const morceaux = sortie.split('\0');
  const r = {};
  for (let i = 0; i + 1 < morceaux.length; i += 2) {
    const champs = morceaux[i].replace(/^:/, '').split(' ');
    r[morceaux[i + 1]] = champs[4] === 'D' ? null : `${champs[1]} ${champs[3]}`;
  }
  return r;
}

// Vérification git de la livraison de la mission k du carnet (état AVANT la livraison : mission k ouverte). Rend les champs de la
// preuve ATELIER-LIVRAISON-1, ou STOP au premier écart.
export function verifierLivraison({ depot, distant = 'origin', etat, k, version, env = process.env }) {
  const m = etat.missions[k - 1];
  if (!m) stop(`mission ${k} hors du carnet`);
  if (etat.missionCourante !== k || m.statut !== 'ouverte') stop(`mission ${k} non ouverte dans le carnet`);
  if (typeof version !== 'string' || !RE_VERSION.test(version)) stop('version X.Y.Z attendue');
  // v0.65.20 (L2, DF) : version livrée = version candidate de J4 et d'AT-5 = proposerVersion(base de la mission), strictement.
  if (version !== proposerVersion(m.base.version)) stop(`version ${version} différente de la version candidate ${proposerVersion(m.base.version)} (base ${m.base.version}, vérifiée par AT-5)`);
  // 1. D3 du chantier de la mission : terminée, candidat accepté, coût connu sous le plafond, conforme à la mission.
  const d3 = lireBranche({ depot, distant, chantier: m.chantier, env });
  if (!d3) stop(`${brancheJournal(m.chantier)} n'existe pas : aucune preuve`);
  const b = bilanChantier(d3.durable);
  if (b.statut !== 'termine' || !b.candidat) stop(`chantier ${m.chantier} non terminé sur un candidat accepté (statut ${b.statut})`);
  if (b.inconnu) stop(`chantier ${m.chantier} : coût inconnu (engagement non résolu ou régularisé) : aucune livraison déclarée`);
  if (b.cout > m.plafond) stop(`chantier ${m.chantier} : coût ${b.cout} au-dessus du plafond de la mission ${m.plafond}`);
  const divergence = comparerChantier(etat, k, d3.durable);
  if (divergence) stop(`DIVERGENCE entre le chantier et la mission ${k} : ${divergence}`);
  const C = b.candidat;
  // 2. Branche du candidat : sur ce sha exact, née de la base de la mission.
  const branche = `refs/heads/atelier/${m.chantier}/${m.spec.jalon.id}/1`;
  const tag = `refs/tags/v${version}`;
  const tetes = tetesDistantes(depot, distant, [branche, tag, 'refs/heads/main'], env);
  if (tetes[branche] !== C) stop(`branche du candidat ${branche.slice(11)} absente ou différente du candidat accepté ${C.slice(0, 8)}`);
  rapatrier(depot, distant, branche, 'refs/atelier-carnet-livraison/candidat', C, env);
  if (git(depot, ['rev-list', '--parents', '-n', '1', C], env).trim() !== `${C} ${m.base.sha}`) stop('le candidat n\'est pas un commit unique né de la base de la mission');
  // 3. Étiquette v<version> : commit L de main, VERSION = version, L^ = dépôt du colis, L^^ = base de la mission.
  if (tetes[tag] === null) stop(`étiquette v${version} absente`);
  const main = tetes['refs/heads/main'];
  if (main === null) stop('main absente');
  rapatrier(depot, distant, tag, 'refs/atelier-carnet-livraison/tag', tetes[tag], env);
  const L = git(depot, ['rev-parse', '--verify', `${tetes[tag]}^{commit}`], env).trim();
  rapatrier(depot, distant, 'refs/heads/main', 'refs/atelier-carnet-livraison/main', main, env);
  if (lancerGit(depot, ['merge-base', '--is-ancestor', L, main], env).code !== 0) stop(`v${version} n'est pas dans main`);
  if (git(depot, ['cat-file', 'blob', `${L}:VERSION`], env).trim() !== version) stop(`VERSION de v${version} différente de ${version}`);
  const parents = (c) => git(depot, ['rev-list', '--parents', '-n', '1', c], env).trim().split(' ').slice(1);
  const pl = parents(L);
  if (pl.length !== 1) stop(`v${version} : un parent attendu (dépôt du colis)`);
  const pu = parents(pl[0]);
  if (pu.length !== 1 || pu[0] !== m.base.sha) stop(`v${version} n'est pas livrée sur la base de la mission ${k} (${m.base.version}@${m.base.sha.slice(0, 8)})`);
  // 4. Fichiers livrés (hors version) = fichiers changés du candidat, blob pour blob.
  const livres = changements(depot, m.base.sha, L, env);
  for (const f of FICHIERS_VERSION) delete livres[f];
  const candidats = changements(depot, m.base.sha, C, env);
  if (Object.keys(candidats).length === 0) stop('le candidat ne change aucun fichier');
  if (canonique(livres) !== canonique(candidats)) {
    const tous = [...new Set([...Object.keys(livres), ...Object.keys(candidats)])].sort();
    stop(`fichiers livrés différents du candidat accepté : ${tous.filter((x) => livres[x] !== candidats[x]).join(', ')}`);
  }
  return { carnet: etat.id, k, chantier: m.chantier, version, main: L, candidat: C, cout: b.cout, preuve: hacherSha256(d3.texte) };
}

// Sauvegarde du carnet : parties -> état valide -> branche créée orpheline, avancée, ou laissée telle quelle si identique. Chaque
// « mission-livree » nouvelle est revérifiée par git avant toute écriture.
export function sauver({ depot, parties, distant = 'origin', env = process.env }) {
  const a = assemblerParties(parties);
  if (a.statut === 'incomplet') stop(`parties manquantes : ${a.manquantes.join(', ')} sur ${a.N}`);
  if (a.statut !== 'complet') stop(a.raison || 'aucune partie');
  const lu = lireEtatCarnet(a.contenu);
  if (lu.raison) stop(`état du carnet invalide : ${lu.raison}`);
  const carnet = identifiant(lu.durable.carnet);
  if (carnet !== a.chantier) stop('carnet des parties différent de celui de l\'état');
  const branche = brancheJournal(carnet);
  const avant = lireCarnet({ depot, distant, carnet, env });
  const resultat = (statut, commit) => ({ statut, carnet, branche, commit, empreinte: a.empreinte, confirmation: texteConfirmation({ chantier: carnet, empreinte: a.empreinte, commit }) });
  let depuis = 0;
  if (avant) {
    const c = comparerCarnets(avant.durable, lu.durable);
    if (c.raison) stop(`divergence avec ${branche} : ${c.raison}`);
    if (c.statut === 'identique') return resultat('identique', avant.tete);
    if (['termine', 'arrete'].includes(avant.etat.statut)) stop(`carnet ${avant.etat.statut} : plus aucune sauvegarde`);
    depuis = avant.durable.journal.length;
  }
  // Revérification de chaque livraison nouvelle, sur l'état rejoué juste avant elle.
  let partiel = lu.durable.journal.slice(0, Math.max(depuis, 1));
  for (const ev of lu.durable.journal.slice(Math.max(depuis, 1))) {
    if (ev.type === 'mission-livree') {
      const e = etatCarnet(partiel);
      const v = verifierLivraison({ depot, distant, etat: e, k: ev.donnees.k, version: ev.donnees.version, env });
      if (canonique(v) !== canonique(ev.donnees)) stop(`livraison de la mission ${ev.donnees.k} non conforme à la vérification git`);
    }
    // v0.65.20 (E1) : aucune ouverture de la mission k >= 2 n'est sauvegardée si un fichier approuvé pour elle a changé depuis la V1.
    if (ev.type === 'mission-ouverte' && ev.donnees.k >= 2) verifierOuverture({ depot, distant, etat: etatCarnet(partiel), k: ev.donnees.k, env });
    const r = appliquerCarnet(partiel, ev);
    if (!Array.isArray(r)) stop(`événement ${ev.n} refusé : ${r.raison}`);
    partiel = r;
  }
  const blob = git(depot, ['hash-object', '-w', '--no-filters', '--stdin'], env, a.contenu).trim();
  const arbre = git(depot, ['mktree'], env, `100644 blob ${blob}\t${FICHIER}\n`).trim();
  const parent = avant ? ['-p', avant.tete] : [];
  const commit = git(depot, ['commit-tree', arbre, ...parent, '-m', `${branche} : carnet ${a.empreinte}`], env).trim();
  if (git(depot, ['cat-file', 'blob', `${commit}:${FICHIER}`], env) !== a.contenu) stop('contenu écrit différent du contenu reconstitué');
  git(depot, ['push', '--quiet', distant, `${commit}:refs/heads/${branche}`], env);
  if (tetesDistantes(depot, distant, [`refs/heads/${branche}`], env)[`refs/heads/${branche}`] !== commit) stop(`${branche} distante différente du commit poussé`);
  return resultat(avant ? 'avancee' : 'creee', commit);
}

export function restaurer({ depot, carnet, distant = 'origin', env = process.env }) {
  const b = lireCarnet({ depot, distant, carnet, env });
  if (!b) stop(`${brancheJournal(carnet)} n'existe pas`);
  return { carnet, branche: brancheJournal(carnet), commit: b.tete, commits: b.commits, empreinte: b.empreinte, parties: decouper(b.texte, carnet) };
}

// Garde D8 : la sauvegarde D3 d'un chantier n'est permise que pour la mission ouverte du carnet sauvegardé, et seulement si le
// chantier lui est conforme. Refus par défaut ; puis délégation intégrale à journal-atelier.mjs (mêmes contrôles, même branche).
export function sauverChantier({ depot, carnet, parties, distant = 'origin', env = process.env }) {
  const c = lireCarnet({ depot, distant, carnet, env });
  if (!c) stop(`${brancheJournal(identifiant(carnet))} n'existe pas : carnet non sauvegardé`);
  const e = c.etat;
  if (e.statut !== 'en-cours' || e.missionCourante === null) stop(`carnet ${e.statut} : aucune mission ouverte`);
  const k = e.missionCourante;
  const m = e.missions[k - 1];
  if (m.statut !== 'ouverte') stop(`mission ${k} ${m.statut} : sauvegarde du chantier refusée`);
  const a = assemblerParties(parties);
  if (a.statut !== 'complet') stop(a.raison || (a.manquantes ? `parties manquantes : ${a.manquantes.join(', ')}` : 'aucune partie'));
  if (a.chantier !== m.chantier) stop(`chantier « ${a.chantier} » hors du périmètre du carnet (seul « ${m.chantier} » est permis)`);
  const lu = lireEtatDurable(a.contenu);
  if (lu.raison) stop(`état durable invalide : ${lu.raison}`);
  const divergence = comparerChantier(e, k, lu.durable);
  if (divergence) stop(`DIVERGENCE entre le chantier et la mission ${k} : ${divergence}`);
  // v0.65.20 (E1) : aucune préparation de la mission k >= 2 n'est sauvegardée sur des fichiers approuvés changés depuis la V1.
  verifierOuverture({ depot, distant, etat: e, k, env });
  return sauverChantierD3({ depot, parties, distant, env });
}

// ------------------------------------------------------------------------------------------------ v0.65.20 — AT-10.3
// E1 (DE) : les fichiers transmis à l'appel de la mission k (autorisés et extraits, fixés à la V1 sur la base du carnet) ont-ils, à la base
// de la mission k (livraison(k-1).main), EXACTEMENT les mêmes objets Git qu'à la base du carnet ? Un seul écart : STOP (nouvelle V1).
// Mission 1 : sans objet (sa base est la base du carnet). Les deux bases doivent être dans main.
export function verifierOuverture({ depot, distant = 'origin', etat, k, env = process.env }) {
  const m = etat.missions[k - 1];
  if (!m) stop(`mission ${k} hors du carnet`);
  const ch = fichiersTransmisMission(etat, k);
  if (ch.raison) stop(ch.raison);
  const base = baseMission(etat, k);
  if (!base) stop(`mission ${k - 1} non livrée : aucune base pour la mission ${k}`);
  if (k === 1) return { carnet: etat.id, k, base, chemins: ch.chemins, statut: 'sans-objet' };
  const main = tetesDistantes(depot, distant, ['refs/heads/main'], env)['refs/heads/main'];
  if (main === null) stop('main absente');
  rapatrier(depot, distant, 'refs/heads/main', 'refs/atelier-carnet-ouverture/main', main, env);
  for (const c of [etat.base.sha, base.sha]) if (lancerGit(depot, ['merge-base', '--is-ancestor', c, main], env).code !== 0) stop(`${c.slice(0, 8)} n'est pas dans main`);
  const objets = (commit) => {
    const r = {};
    for (const l of git(depot, ['ls-tree', '-r', '-z', commit, '--', ...ch.chemins], env).split('\0').filter(Boolean)) {
      const [meta, chemin] = l.split('\t');
      const [mode, , objet] = meta.split(' ');
      if (ch.chemins.includes(chemin)) r[chemin] = `${mode} ${objet}`;
    }
    return r;
  };
  const ecarts = ecartsTransmis(ch.chemins, objets(etat.base.sha), objets(base.sha));
  if (ecarts.length) stop(`E1 : fichiers approuvés pour la mission ${k} changés depuis la V1 (base du carnet ${etat.base.version} -> base de la mission ${base.version}) : ${ecarts.join(', ')} ; aucune ouverture ni préparation : un nouveau carnet (nouvelle V1) est requis`);
  return { carnet: etat.id, k, base, chemins: ch.chemins, statut: 'conforme' };
}

// Carnet et chantier de la mission ouverte, lus en entier puis relus (têtes distantes) : un mouvement entre les lectures = STOP.
function lireMissionOuverte({ depot, distant, carnet, env }) {
  const c = lireCarnet({ depot, distant, carnet, env });
  if (!c) stop(`${brancheJournal(identifiant(carnet))} n'existe pas : carnet non sauvegardé`);
  const e = c.etat;
  if (e.statut !== 'en-cours' || e.missionCourante === null) stop(`carnet ${e.statut} : aucune mission ouverte`);
  const k = e.missionCourante;
  const m = e.missions[k - 1];
  if (m.statut !== 'ouverte') stop(`mission ${k} ${m.statut} : aucune demande`);
  const d3 = lireBranche({ depot, distant, chantier: m.chantier, env });
  if (!d3) stop(`${brancheJournal(m.chantier)} n'existe pas : chantier de la mission ${k} non sauvegardé`);
  const refs = { carnet: `refs/heads/${brancheJournal(carnet)}`, chantier: `refs/heads/${brancheJournal(m.chantier)}` };
  // Relecture UNIQUE des deux têtes (carnet et chantier) : chacune doit être le SHA lu et vérifié.
  const stable = () => {
    const t = tetesDistantes(depot, distant, [refs.carnet, refs.chantier], env);
    if (t[refs.carnet] !== c.tete || t[refs.chantier] !== d3.tete) stop('tête Git instable : le carnet ou le chantier a bougé pendant la lecture');
  };
  stable();
  return { c, e, k, m, d3, stable };
}

// Demande AUTO de la mission ouverte, reconstruite EXACTEMENT (texteDemandeAuto, auto.js) depuis le carnet et la D3 authentiques du chantier.
// « maintenant » : paramètre de FONCTION réservé aux tests (aucune option de la ligne de commande ne le fournit) ; la commande utilise
// toujours l'horloge. Il ne règle que l'heure du contrôle préalable et n'entre pas dans le texte rendu.
export function demandeAuto({ depot, distant = 'origin', carnet, maintenant = new Date().toISOString(), env = process.env }) {
  const { e, k, d3, stable } = lireMissionOuverte({ depot, distant, carnet, env });
  verifierOuverture({ depot, distant, etat: e, k, env });
  const r = demandeAutoMission(e, k, d3.durable);
  if (r.raison) stop(r.raison);
  const empreinte = hacherSha256(d3.texte);
  const entrees = { chantier: r.chantier, jalon: r.jalon, numero: String(r.numero), commit: d3.tete, empreinte };
  // Contrôle préalable seulement : la garde J1 (auto.js, inchangée) rejouée sur la même D3, premier run de T, à l'heure « maintenant ».
  const g = garder({ entrees, contexte: { run_id: '1', ref: REF_MAIN, run_attempt: '1', workflow_sha: null }, historique: { total: 1, runs: [{ id: 1, display_title: nomRun(r.t), created_at: maintenant }] }, journal: { tete: d3.tete, texte: d3.texte } });
  if (!g.autorise) stop(`la garde J1 refuserait la tentative ${r.t} : ${g.raison}`);
  const texte = texteDemandeAuto({ chantier: r.chantier, jalon: r.jalon, numero: r.numero, commit: d3.tete, empreinte, developpement: true });
  const l = lireDemandeAuto(texte);
  if (l.raison || l.demande.t !== r.t || l.demande.commit !== d3.tete || l.demande.empreinte !== empreinte) stop('demande AUTO relue différente des valeurs dérivées');
  stable();
  return { carnet: e.id, k, t: r.t, commit: d3.tete, empreinte, engagement: r.engagement, plafond: r.plafond, disponible: r.disponible, texte };
}

// Demande AT-5 de la mission ouverte, depuis atelier/<T> vérifiée par git (seule branche candidate du chantier, sha stable).
export function demandeAt5({ depot, distant = 'origin', carnet, env = process.env }) {
  const { c, e, k, m, d3 } = lireMissionOuverte({ depot, distant, carnet, env });
  const branche = `atelier/${tentativeDeMission(e, k)}`;
  const ref = `refs/heads/${branche}`;
  const prefixe = `refs/heads/atelier/${m.chantier}/`;
  // UNE lecture distante de toutes les branches : têtes non ambiguës, et aucune branche candidate du chantier autre que atelier/<T>.
  const lireTetes = () => {
    const tetes = new Map();
    for (const [sha, r] of git(depot, ['ls-remote', '--heads', distant], env).split('\n').filter(Boolean).map((l) => l.split('\t'))) {
      if (tetes.has(r) || !RE_SHA.test(sha)) stop(`référence distante ${r} ambiguë`);
      tetes.set(r, sha);
    }
    const candidates = [...tetes.keys()].filter((r) => r.startsWith(prefixe));
    if (candidates.some((r) => r !== ref)) stop(`branche candidate ambiguë : ${candidates.join(', ')}`);
    return tetes;
  };
  const C = lireTetes().get(ref) ?? null;
  if (C === null) stop(`branche ${branche} absente : aucun candidat`);
  rapatrier(depot, distant, ref, 'refs/atelier-carnet-at5/candidat', C, env);
  const parents = git(depot, ['rev-list', '--parents', '-n', '1', C], env).trim().split(' ').slice(1);
  const fichiers = parents.length === 1 && parents[0] === m.base.sha ? changements(depot, m.base.sha, C, env) : {};
  const r = demandeAt5Mission(e, k, d3.durable, { branche, candidat: C, parents, fichiers });
  if (r.raison) stop(r.raison);
  // Dernière lecture, UNIQUE : carnet, chantier et candidat aux SHA vérifiés, aucune autre branche candidate apparue entre-temps.
  const fin = lireTetes();
  if (fin.get(`refs/heads/${brancheJournal(carnet)}`) !== c.tete || fin.get(`refs/heads/${brancheJournal(m.chantier)}`) !== d3.tete) stop('tête Git instable : le carnet ou le chantier a bougé pendant la lecture');
  if (fin.get(ref) !== C) stop(`tête Git instable : ${branche} a bougé pendant la lecture`);
  return { carnet: e.id, k, t: tentativeDeMission(e, k), demande: { ...r } };
}

export function proposer(texte) {
  let p;
  try { p = JSON.parse(texte); } catch { stop('proposition : JSON illisible'); }
  const l = lireProposition(p);
  if (l.raison) stop(`proposition refusée : ${l.raison}`);
  const canon = canonique(p);
  return { carnet: p.carnet, protocole: PROTOCOLE_PROPOSITION_CARNET, empreinte: hacherSha256(canon), parties: decouper(canon, p.carnet) };
}

function options(args) {
  const o = { partie: [] };
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i];
    if (!k.startsWith('--') || i + 1 >= args.length) stop(`option illisible : ${k}`);
    const nom = k.slice(2);
    if (!['depot', 'partie', 'distant', 'carnet', 'sortie', 'mission', 'version', 'proposition'].includes(nom)) stop(`option inconnue : ${k}`);
    if (nom === 'partie') o.partie.push(args[i + 1]); else o[nom] = args[i + 1];
  }
  return o;
}
function ecrireParties(sortie, parties) {
  fs.mkdirSync(sortie, { recursive: true });
  parties.forEach((p, i) => fs.writeFileSync(path.join(sortie, `partie-${i + 1}.txt`), p));
}

export function principal(argv, env = process.env) {
  const [commande, ...reste] = argv;
  const o = options(reste);
  if (commande === 'proposer') {
    if (!o.proposition || !o.sortie) stop('--proposition et --sortie attendus');
    const r = proposer(fs.readFileSync(o.proposition, 'utf8'));
    ecrireParties(o.sortie, r.parties);
    return `${JSON.stringify({ ...r, parties: r.parties.length }, null, 2)}\n`;
  }
  if (!o.depot) stop('--depot attendu');
  const lire = () => o.partie.map((f) => fs.readFileSync(f, 'utf8'));
  if (commande === 'sauver') {
    const r = sauver({ depot: o.depot, distant: o.distant, env, parties: lire() });
    return `${JSON.stringify({ ...r, confirmation: undefined }, null, 2)}\n${r.confirmation}\n`;
  }
  if (commande === 'sauver-chantier') {
    const r = sauverChantier({ depot: o.depot, distant: o.distant, carnet: o.carnet, env, parties: lire() });
    return `${JSON.stringify({ ...r, confirmation: undefined }, null, 2)}\n${r.confirmation}\n`;
  }
  if (commande === 'restaurer') {
    if (!o.sortie) stop('--sortie attendu');
    const r = restaurer({ depot: o.depot, distant: o.distant, carnet: o.carnet, env });
    ecrireParties(o.sortie, r.parties);
    return `${JSON.stringify({ ...r, parties: r.parties.length }, null, 2)}\n`;
  }
  if (commande === 'livraison') {
    if (!/^[1-3]$/.test(o.mission ?? '')) stop('--mission 1, 2 ou 3 attendu');
    const c = lireCarnet({ depot: o.depot, distant: o.distant, carnet: o.carnet, env });
    if (!c) stop(`${brancheJournal(o.carnet)} n'existe pas`);
    const v = verifierLivraison({ depot: o.depot, distant: o.distant, etat: c.etat, k: Number(o.mission), version: o.version, env });
    return `${JSON.stringify(v, null, 2)}\n${texteLivraison(v)}\n`;
  }
  if (commande === 'demande-auto') {
    const r = demandeAuto({ depot: o.depot, distant: o.distant, carnet: o.carnet, env });
    return `${JSON.stringify({ ...r, texte: undefined }, null, 2)}\n${r.texte}`;
  }
  if (commande === 'demande-at5') return `${JSON.stringify(demandeAt5({ depot: o.depot, distant: o.distant, carnet: o.carnet, env }), null, 2)}\n`;
  if (commande === 'verifier-ouverture') {
    if (!/^[1-3]$/.test(o.mission ?? '')) stop('--mission 1, 2 ou 3 attendu');
    const c = lireCarnet({ depot: o.depot, distant: o.distant, carnet: o.carnet, env });
    if (!c) stop(`${brancheJournal(o.carnet)} n'existe pas`);
    return `${JSON.stringify(verifierOuverture({ depot: o.depot, distant: o.distant, etat: c.etat, k: Number(o.mission), env }), null, 2)}\n`;
  }
  return stop(`commande inconnue : ${commande}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { process.stdout.write(principal(process.argv.slice(2))); } catch (e) {
    process.stderr.write(`${e instanceof Stop ? e.message : `STOP : ${e.message}`}\n`);
    process.exitCode = 1;
  }
}
// === FIN_ATELIER_CARNET_GIT ===
