// === DEBUT_ATELIER_AUTO_APPEL ===
// v0.65.10 — AT-8.2 « TÉMOIN À BLANC » (GO « AT-8.2 — GO IMPLÉMENTATION À BLANC », 18/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — outil HORS APK, lancé par le job J2 (environnement atelier-auto, approuvé par Christophe), APRÈS la
// frontière. C'est le SEUL fichier de l'atelier qui contient une mécanique réseau : UNE requête node:https, sans SDK, sans agent
// (agent: false : ni réserve de connexions, ni keep-alive), sans flux, sans redirection suivie, sans boucle, sans reconnexion, sans
// nouvelle tentative, délai total <= 60 s.
// POINT D'ÉMISSION (défini ici et nulle part ailleurs) : l'instant où requete(...) est invoquée. AVANT : frontière, témoin, corps,
// cible, clé, délai sont vérifiés ; tout refus est « non-emis » (aucune requête n'existe). À PARTIR de cet instant, l'émission est
// POSSIBLE : exception, refus de connexion, coupure, délai, réponse tronquée ou trop longue, JSON illisible, erreur HTTP, usage absent
// sont « issue-inconnue » (auto.js, classerObservation et faitsAppel) ; rien ne revient jamais à « non-emis ».
// Modes de la ligne de commande (le workflow seul les emploie) :
//   --preparer   frontière + témoin + corps, sans clé : résumé « préparation » (aucune requête) ; sortie 0 = prêt, 1 = arrêt
//   --reel       l'appel réel vers CIBLE_ANTHROPIC, seulement si la clé ATELIER_TEMOIN_CLE est présente (secret d'environnement) ;
//                sans clé : non-emis « cle-absente ». Faits atelier-auto-faits-2 dans D/faits-appel.json et le résumé du run.
// Sans --reel ni --preparer : non-emis « appel-reel-non-active ». La recette à blanc emploie executer() en mode « essai », qui
// n'accepte QUE http://127.0.0.1 (faux serveur local) : elle ne peut joindre aucun autre hôte.
// v0.65.13 — AT-9.1 « APPEL DE DÉVELOPPEMENT À BLANC » (GO 20/10/2026 ; D-007) : pour une tentative portant un développement, la même
// unique requête transmet le dossier préparé par auto.js à partir des fichiers de la base déposés par auto-dossier.mjs
// (fichiers-base.json) ; bornes propres (réponse <= 8 Mio, délai <= 20 min) ; sonde TCP de maintien de la connexion toutes les 30 s
// (setKeepAlive : la connexion reste UNIQUE et n'est jamais réutilisée ; elle évite qu'un équipement réseau coupe une longue attente
// silencieuse). Réponse connue ET proposition valide : contenus validés écrits dans D/proposition.json (relu par le job J4). Les
// contenus ne sont jamais dans les faits ni dans le résumé.
// La clé ne va que dans l'en-tête de la requête : jamais dans le corps, les faits, le résumé, la sortie, ni un fichier.
// v0.65.21 — AT-10.4 (D-007) : les faits de l'appel (--reel) sont aussi écrits sur la sortie en annotations ATELIER-FAITS-1 j2 (retour.js), relues par Claude.

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparerAppel, classerObservation, faitsAppel, texteProposition, BORNES_TEMOIN, BORNES_DEVELOPPEMENT } from '../app/atelier/auto.js';
import { lireVariables, entreesDe, contexteDe, lireFichier, lireJournal } from './auto-garde.mjs';
import { annotationsFaits } from '../app/atelier/retour.js';

export const CIBLE_ANTHROPIC = Object.freeze({ protocole: 'https:', hote: 'api.anthropic.com', port: 443, chemin: '/v1/messages' });
export const VERSION_API = '2023-06-01';
const RE_CLE = /^[!-~]{1,512}$/;

function lireJson(dossier, nom) {
  const t = lireFichier(dossier, nom);
  try { return t === null ? null : JSON.parse(t); } catch { return null; }
}
function lireSondeDeposee(dossier) {
  const code = (lireFichier(dossier, 'sonde-code.txt') || '').trim();
  const sortie = lireFichier(dossier, 'sonde-sortie.txt');
  return /^[0-9]{1,3}$/.test(code) && sortie !== null ? { code: Number(code), sortie } : null;
}
// Cible admise : l'API réelle en mode « reel » (avec node:https), ou le faux serveur local http://127.0.0.1 en mode « essai ».
function cibleAdmise(mode, cible, requete) {
  if (mode === 'reel') return cible === CIBLE_ANTHROPIC && requete === https.request;
  return mode === 'essai' && cible !== null && typeof cible === 'object' && cible.protocole === 'http:' && cible.hote === '127.0.0.1' && Number.isInteger(cible.port) && cible.chemin === CIBLE_ANTHROPIC.chemin;
}
const codeTransport = (e) => ({ ECONNREFUSED: 'connexion-impossible', ENOTFOUND: 'resolution-impossible', EAI_AGAIN: 'resolution-impossible', ECONNRESET: 'connexion-coupee', EPIPE: 'connexion-coupee' })[e && e.code] || 'erreur-transport';

// L'UNIQUE émission. requete(...) est invoquée UNE fois ; tout se termine par UN seul « finir » (les suivants sont ignorés).
export function emettre({ requete, cible, cle, corps, delaiMs, limiteOctets = BORNES_TEMOIN.reponse_octets }) {
  return new Promise((resoudre) => {
    const obs = { echec: null, socket_connecte: false, statut: null, request_id: null, corps: null, complet: false };
    let fini = false;
    let req = null;
    const finir = (echec) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      if (echec) obs.echec = echec;
      if (req) req.destroy();
      resoudre(obs);
    };
    const minuteur = setTimeout(() => finir('delai-depasse'), delaiMs);
    const options = {
      protocol: cible.protocole, hostname: cible.hote, port: cible.port, path: cible.chemin, method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(corps), 'anthropic-version': VERSION_API, 'x-api-key': cle },
    };
    try {
      req = requete(options, (res) => {
        obs.statut = res.statusCode;
        const rid = res.headers['request-id'];
        obs.request_id = typeof rid === 'string' ? rid : null;
        const morceaux = [];
        let taille = 0;
        res.on('data', (m) => {
          taille += m.length;
          if (taille > limiteOctets) { finir('reponse-trop-longue'); return; }
          morceaux.push(m);
        });
        res.on('end', () => {
          if (fini) return;
          obs.complet = res.complete === true;
          obs.corps = Buffer.concat(morceaux).toString('utf8');
          finir(obs.complet ? null : 'reponse-tronquee');
        });
        res.on('aborted', () => finir('reponse-tronquee'));
        res.on('error', () => finir('reponse-tronquee'));
        res.on('close', () => finir('reponse-tronquee'));
      });
    } catch {
      finir('exception-requete');
      return;
    }
    req.on('socket', (s) => { s.setKeepAlive(true, 30000); s.on('connect', () => { obs.socket_connecte = true; }); });
    req.on('error', (e) => finir(codeTransport(e)));
    req.on('close', () => finir('connexion-coupee'));
    req.end(corps);
  });
}

function resume(titre, issue, raison, texte) {
  const avertir = issue === 'issue-inconnue' ? '\n**ISSUE INCONNUE : un appel a pu avoir lieu. Coût non établi. Engagement maintenu. Aucune relance. Régularisation humaine obligatoire.**\n' : '';
  return `## ${titre} : ${issue.toUpperCase()}\n${avertir}\n${raison ? `Raison : \`${raison}\`\n\n` : ''}Faits à copier tels quels :\n\n\`\`\`json\n${texte}\`\`\`\n`;
}

// Exécution de l'étape. mode : 'preparer' | 'reel' | 'essai' ; cible, requete : fournies par l'appelant (aucune valeur par défaut).
export async function executer({ env, dossier, mode, cible = null, requete = null, delaiMs = null }) {
  const v = lireVariables(env);
  const entrees = entreesDe(v);
  const contexte = contexteDe(v);
  const prep = preparerAppel({ entrees, contexte, journal: lireJournal(dossier), approbations: lireJson(dossier, 'approbations.json'), sonde: lireSondeDeposee(dossier), fichiers: lireJson(dossier, 'fichiers-base.json') });
  const dev = prep.mode === 'developpement';
  const bornes = dev ? BORNES_DEVELOPPEMENT : BORNES_TEMOIN;
  const delai = delaiMs === null ? bornes.delai_ms : delaiMs;
  if (mode === 'preparer') {
    const ligne = prep.emettre ? 'PREPARATION_OK' : `ARRET ${prep.raison}`;
    if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, `## Atelier AUTO — préparation de l'appel : ${ligne}\n\n${prep.emettre ? `Requête prévue (aucune émise) : modèle \`${prep.requete.modele}\`, max_tokens ${prep.requete.max_tokens}, corps ${prep.requete.corps_octets} octets, empreinte \`${prep.requete.corps_empreinte}\`.\n${dev ? `\nAppel de développement : effort \`${prep.requete.effort}\`, borne d'entrée ${prep.requete.entree_borne} jetons (entrée max ${prep.appel.entree_max}), fichiers transmis : ${prep.requete.fichiers_base.map((f) => `\`${f.chemin}\` (${f.etat}, ${f.modifiable ? 'modifiable' : 'lecture seule'}, extraits ${f.extraits.map((x) => x.join('-')).join(' ') || 'aucun'})`).join(', ')}.\n` : ''}` : 'Aucune requête ne sera émise.\n'}`);
    return { code: prep.emettre ? 0 : 1, ligne, prep, requetes: 0, annotations: [] };
  }
  const cle = typeof env.ATELIER_TEMOIN_CLE === 'string' ? env.ATELIER_TEMOIN_CLE : '';
  let refus = prep.emettre ? null : prep.raison;
  if (!refus && mode !== 'reel' && mode !== 'essai') refus = 'appel-reel-non-active';
  if (!refus && !cibleAdmise(mode, cible, requete)) refus = 'cible-refusee';
  if (!refus && cle === '') refus = 'cle-absente';
  if (!refus && !RE_CLE.test(cle)) refus = 'cle-invalide';
  if (!refus && (!Number.isInteger(delai) || delai < 1 || delai > bornes.delai_ms)) refus = 'delai-invalide';
  let emission = { point_franchi: false, socket_connecte: false };
  let resultat = { raison: refus };
  if (!refus) {
    emission = { point_franchi: true, socket_connecte: false }; // POINT D'ÉMISSION : à partir d'ici, jamais « non-emis »
    let obs = null;
    try { obs = await emettre({ requete, cible, cle, corps: prep.corps, delaiMs: delai, limiteOctets: bornes.reponse_octets }); } catch { obs = null; }
    emission.socket_connecte = !!obs && obs.socket_connecte === true;
    try { resultat = obs ? classerObservation(obs, prep) : { issue: 'issue-inconnue', raison: 'exception-emission' }; } catch { resultat = { issue: 'issue-inconnue', raison: 'exception-classement' }; }
  }
  // AT-9.1/AT-9.2 : proposition valide => remplacements validés dans D/proposition.json ; écriture impossible ou clé recopiée : aucun candidat.
  if (dev && resultat.issue === 'reponse-connue' && resultat.raison === null) {
    let raison = null;
    try {
      const tp = texteProposition(prep, resultat);
      if (cle.length >= 8 && tp.includes(cle)) raison = 'proposition-retenue';
      else fs.writeFileSync(path.join(dossier, 'proposition.json'), tp);
    } catch { raison = 'proposition-non-ecrite'; }
    if (raison) resultat = { ...resultat, raison, proposition: null };
  }
  let r = faitsAppel({ entrees, contexte, prep, emission, resultat });
  if (cle.length >= 8 && r.texte.includes(cle)) r = faitsAppel({ entrees, contexte, prep, emission, resultat: { issue: 'issue-inconnue', raison: 'faits-retenus' } });
  fs.writeFileSync(path.join(dossier, 'faits-appel.json'), r.texte);
  if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, resume('Atelier AUTO — J2 appel', r.faits.issue, r.faits.raison, r.texte));
  const ok = r.faits.issue === 'reponse-connue' && r.faits.raison === null;
  return { code: ok ? 0 : 1, ligne: `${r.faits.issue.toUpperCase()}${r.faits.raison ? ` ${r.faits.raison}` : ''}`, ...r, annotations: annotationsFaits('j2', r.texte) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  if (i < 0 || !process.argv[i + 1]) { process.stderr.write('usage : node outils-atelier/auto-appel.mjs --dossier D [--preparer | --reel]\n'); process.exit(2); }
  const mode = process.argv.includes('--preparer') ? 'preparer' : process.argv.includes('--reel') ? 'reel' : 'aucun';
  const r = await executer({ env: process.env, dossier: process.argv[i + 1], mode, cible: mode === 'reel' ? CIBLE_ANTHROPIC : null, requete: mode === 'reel' ? https.request : null });
  process.stdout.write(`${r.annotations.map((l) => `${l}\n`).join('')}${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_APPEL ===
