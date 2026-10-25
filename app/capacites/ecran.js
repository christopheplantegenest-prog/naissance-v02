// === DEBUT_CAPACITES_ECRAN ===
// v0.66.6 — ATELIER 2, L1 + L2 (GO « ATELIER 2 — GO PHASE 1 », 25/10/2026) : écran « Atelier — capacités ». OUTILLAGE NON COGNITIF (D-007).
//   monterCapacites({ zone, version, stockage, fetchFn, ouvrir }) -> { rafraichir }
// Chargé seulement au toucher « Atelier — capacités » des Réglages (import dynamique dans main.js) : rien ne s'exécute au démarrage.
// L1 (lecture, SANS jeton) : chantiers de l'Atelier autonome (situation, missions, tentatives, dépense du chantier et du mois, question en
// attente), dernière version publiée comparée à la version installée.
// L2 (avec le jeton du seul dépôt, permission Issues) : demander une capacité (nouveau ticket « Atelier : … »), /stop, /reprendre (réponse
// et « périmètre + : » facultatifs), /valider. Chaque envoi s'ARME au premier toucher et part au second. Le jeton n'est jamais affiché ni
// journalisé ; il n'est lu qu'au moment d'une écriture. Les validations V4 (« Review deployments ») restent sur GitHub, inchangées.
// Aucun module cognitif, aucune mémoire, aucune table : l'écran ne connaît que les tickets du dépôt.
import { resumer, commandesPossibles, texteCommande, texteDemande, lireVersion, compareVersions, usd } from './etat.js';
import { clientGithub } from './github.js';
import { lireJeton, enregistrerJeton, effacerJeton } from './jeton.js';

const MAX_OUVERTS = 5;
const MAX_FERMES = 5;
const ICONES = { validee: '✅', 'en-cours': '🔧', 'a-faire': '⏳' };
const NOMS = { '/stop': 'Arrêter (/stop)', '/reprendre': 'Reprendre (/reprendre)', '/valider': 'Valider (/valider)' };

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function monterCapacites({ zone, version, stockage = stockageParDefaut(), fetchFn, ouvrir = (url) => globalThis.open(url, '_blank', 'noopener') }) {
  const gh = clientGithub({ fetchFn, lireJeton: () => lireJeton(stockage) });
  // État d'interface (mémoire vive seulement).
  const ui = { chargement: false, erreur: null, versions: null, ouverts: [], fermes: [], lu: false, message: null, arme: null, envoi: false, saisies: {} };
  const saisie = (k) => ui.saisies[k] ?? '';

  const el = (tag, { classe, texte, attrs } = {}, ...enfants) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    e.append(...enfants.filter(Boolean));
    return e;
  };
  const bouton = (texte, nom, action, { principal = false, actif = true } = {}) => {
    const b = el('button', { classe: principal ? 'bouton-principal' : 'bouton-secondaire', texte, attrs: { type: 'button', 'data-capacites': nom } });
    b.disabled = !actif;
    b.addEventListener('click', () => (b.disabled ? undefined : action()));
    return b;
  };
  // Envoi en deux touchers : le premier arme (texte « Confirmer… »), le second envoie ; tout autre geste désarme.
  const boutonArme = (texte, nom, action, opts = {}) => (ui.arme === nom
    ? bouton(`Confirmer : ${texte}`, nom, () => { ui.arme = null; return action(); }, { principal: true, actif: !ui.envoi })
    : bouton(texte, nom, () => { ui.arme = nom; ui.message = null; rendre(); }, { ...opts, actif: !ui.envoi && (opts.actif ?? true) }));
  const champ = (libelle, cle, { multi = false, rangs = 3, aide = '', secret = false } = {}) => {
    const entree = el(multi ? 'textarea' : 'input', { attrs: { 'data-capacites': cle, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' } });
    if (multi) entree.rows = rangs; else entree.type = secret ? 'password' : 'text';
    entree.value = secret ? '' : saisie(cle);
    entree.addEventListener('input', () => { ui.saisies[cle] = entree.value; if (ui.arme) { ui.arme = null; } });
    return el('label', { classe: 'champ' }, el('span', { texte: libelle }), entree, aide ? el('span', { classe: 'aide', texte: aide }) : null);
  };
  const message = (section) => (ui.message && ui.message.section === section
    ? el('p', { classe: `resultat ${ui.message.erreur ? 'resultat-erreur' : 'resultat-ok'}`, texte: ui.message.texte, attrs: { 'data-capacites': 'message' } }) : null);
  const dire = (section, texte, erreur = false) => { ui.message = { section, texte, erreur }; };

  async function actualiser() {
    if (ui.chargement) return;
    ui.chargement = true;
    ui.erreur = null;
    ui.arme = null;
    rendre();
    try {
      const [tickets, release] = await Promise.all([gh.chantiers(MAX_OUVERTS + MAX_FERMES + 5), gh.derniereVersion().catch(() => null)]);
      ui.versions = lireVersion(release);
      const ouverts = tickets.filter((t) => t.state === 'open').slice(0, MAX_OUVERTS);
      ui.ouverts = [];
      for (const t of ouverts) ui.ouverts.push(resumer(t, await gh.commentaires(t)));
      ui.fermes = tickets.filter((t) => t.state !== 'open').slice(0, MAX_FERMES).map((t) => resumer(t, []));
      ui.lu = true;
    } catch (e) {
      ui.erreur = e && e.name === 'ErreurGithub' ? e.message : 'Lecture impossible.';
    } finally {
      ui.chargement = false;
      rendre();
    }
  }

  async function envoyer(section, operation, reussite) {
    ui.envoi = true;
    ui.message = null;
    rendre();
    try {
      const r = await operation();
      dire(section, reussite(r));
      return true;
    } catch (e) {
      dire(section, e && e.name === 'ErreurGithub' ? e.message : 'Envoi impossible.', true);
      return false;
    } finally {
      ui.envoi = false;
      rendre();
    }
  }

  async function commander(r, commande) {
    const k = `chantier-${r.numero}`;
    const t = texteCommande(commande, commande === '/reprendre' ? { reponse: saisie(`${k}-reponse`), perimetre: saisie(`${k}-perimetre`) } : {});
    if (t.raison) { dire(k, t.raison, true); rendre(); return; }
    const ok = await envoyer(k, () => gh.commenter(r.numero, t.corps), () => `${commande} envoyé sur le ticket ${r.numero}. L'Atelier le traite en une à deux minutes : toucher « Actualiser » ensuite.`);
    if (ok) { delete ui.saisies[`${k}-reponse`]; delete ui.saisies[`${k}-perimetre`]; rendre(); }
  }

  async function demander() {
    const d = texteDemande({ titre: saisie('demande-titre'), description: saisie('demande-description') });
    if (d.raison) { dire('demande', d.raison, true); rendre(); return; }
    const ok = await envoyer('demande', () => gh.ouvrirTicket(d.titre, d.corps), (t) => `Demande envoyée : ticket ${t.numero}. L'Atelier ouvre le chantier en quelques minutes.`);
    if (ok) { delete ui.saisies['demande-titre']; delete ui.saisies['demande-description']; rendre(); }
  }

  function sectionVersions() {
    const v = ui.versions;
    const lignes = [el('p', { texte: `Version installée : ${version}`, attrs: { 'data-capacites': 'version-installee' } })];
    if (v) {
      const neuve = compareVersions(version, v.version) < 0;
      lignes.push(el('p', { texte: `Dernière version publiée : ${v.version}${v.publiee ? ` (${v.publiee.slice(0, 10)})` : ''}${neuve ? ' — plus récente que celle-ci' : ' — à jour'}`, attrs: { 'data-capacites': 'version-publiee' } }));
      if (neuve && v.apk) lignes.push(el('p', { classe: 'aide', texte: `Fichier : ${v.apk.nom}${v.apk.taille ? ` (${(v.apk.taille / 1048576).toFixed(1).replace('.', ',')} Mo)` : ''}. Installer par-dessus garde les données.` }));
      if (neuve && v.page) lignes.push(bouton('Ouvrir la page de la version', 'ouvrir-version', () => ouvrir(v.page)));
    } else if (ui.lu) lignes.push(el('p', { classe: 'aide', texte: 'Dernière version publiée : inconnue.' }));
    return el('div', { classe: 'bloc', attrs: { 'data-capacites': 'versions' } }, el('h3', { texte: 'Versions' }), ...lignes);
  }

  function carteChantier(r, jeton) {
    const k = `chantier-${r.numero}`;
    const e = r.etat;
    const enfants = [
      el('h3', { texte: `Ticket ${r.numero} — ${r.titre}` }),
      el('p', { texte: r.situation.libelle, attrs: { 'data-capacites': `${k}-situation` } }),
    ];
    if (e && e.plan) enfants.push(el('p', { classe: 'aide', texte: `Plan : ${e.plan}${e.version ? ` — version visée ${e.version}` : ''}` }));
    for (const m of e ? e.missions : []) {
      enfants.push(el('p', { texte: `${ICONES[m.etat]} ${m.id} : ${m.titre}${m.cognitive ? ' (cognitive)' : ''}${m.tentative ? ` — tentative ${m.tentative}${m.tentatives ? `/${m.tentatives}` : ''}` : ''}`, attrs: { 'data-capacites': `${k}-mission` } }));
    }
    if (e && e.depense !== null) enfants.push(el('p', { texte: `Dépense du chantier : ${usd(e.depense)}${e.plafond ? ` sur ${usd(e.plafond)}` : ''}`, attrs: { 'data-capacites': `${k}-depense` } }));
    if (e && e.bloque && e.bloque.question) enfants.push(el('p', { classe: 'resultat resultat-attente', texte: `Question de l'Atelier : ${e.bloque.question}`, attrs: { 'data-capacites': `${k}-question` } }));
    if (e && e.livraison) enfants.push(el('p', { classe: 'aide', texte: `Livraison : v${e.livraison.version}${e.livraison.conclusion ? ` (${e.livraison.conclusion})` : ' (au robot)'}` }));
    if (!e) enfants.push(el('p', { classe: 'aide', texte: 'Pas encore d\'état publié par l\'Atelier.' }));
    const cmds = commandesPossibles(r);
    if (cmds.length && jeton) {
      if (cmds.includes('/reprendre')) {
        enfants.push(champ('Réponse (facultative)', `${k}-reponse`, { multi: true, rangs: 3 }));
        enfants.push(champ('Fichiers en plus pour la mission (facultatif)', `${k}-perimetre`, { aide: 'Chemins séparés par des virgules, par exemple tests/x.test.mjs. Jamais l\'atelier ni ses protections.' }));
      }
      for (const c of cmds) enfants.push(boutonArme(NOMS[c], `${k}-${c.slice(1)}`, () => commander(r, c)));
    } else if (cmds.length) enfants.push(el('p', { classe: 'aide', texte: `Commandes possibles : ${cmds.join(', ')} (jeton nécessaire, voir plus bas).` }));
    enfants.push(message(k));
    return el('div', { classe: 'bloc', attrs: { 'data-capacites': k } }, ...enfants);
  }

  function sectionChantiers(jeton) {
    const enfants = [el('h3', { texte: 'Chantiers' })];
    if (ui.chargement) enfants.push(el('p', { classe: 'aide', texte: 'Lecture de GitHub…' }));
    if (ui.erreur) enfants.push(el('p', { classe: 'resultat resultat-erreur', texte: ui.erreur, attrs: { 'data-capacites': 'erreur' } }));
    const mois = ui.ouverts.map((r) => r.etat && r.etat.mois).find(Boolean);
    if (mois) enfants.push(el('p', { texte: `Mois ${mois.cycle} : ${usd(mois.consomme)} dépensés sur ${usd(mois.plafond)} (reste ${usd(mois.reste)})`, attrs: { 'data-capacites': 'mois' } }));
    if (ui.lu && !ui.ouverts.length) enfants.push(el('p', { classe: 'aide', texte: 'Aucun chantier ouvert.' }));
    for (const r of ui.ouverts) enfants.push(carteChantier(r, jeton));
    if (ui.fermes.length) {
      enfants.push(el('p', { classe: 'aide', texte: 'Fermés récemment :' }));
      for (const r of ui.fermes) enfants.push(el('p', { classe: 'aide', texte: `Ticket ${r.numero} — ${r.titre}`, attrs: { 'data-capacites': 'ferme' } }));
    }
    return el('div', { attrs: { 'data-capacites': 'chantiers' } }, ...enfants);
  }

  function sectionDemande(jeton) {
    if (!jeton) return null;
    return el('div', { classe: 'bloc', attrs: { 'data-capacites': 'demande' } },
      el('h3', { texte: 'Demander une capacité' }),
      champ('Titre', 'demande-titre', { aide: 'Envoyé comme « Atelier : <titre> ».' }),
      champ('Ce que Naissance doit savoir faire', 'demande-description', { multi: true, rangs: 6 }),
      boutonArme('Envoyer la demande', 'demande-envoyer', demander),
      message('demande'));
  }

  function sectionJeton(jeton) {
    const enfants = [el('h3', { texte: 'Jeton GitHub (commandes)' })];
    if (jeton) {
      enfants.push(el('p', { texte: 'Jeton enregistré sur cet appareil.', attrs: { 'data-capacites': 'jeton-present' } }));
      enfants.push(boutonArme('Effacer le jeton', 'jeton-effacer', () => { effacerJeton(stockage); dire('jeton', 'Jeton effacé de cet appareil.'); rendre(); }));
    } else {
      enfants.push(el('p', { classe: 'aide', texte: 'Lecture sans jeton. Pour demander, arrêter, reprendre ou valider : créer sur GitHub un jeton « fine-grained », dépôt naissance-v02 seulement, permission « Issues : Read and write » seulement, puis le coller ici. Il reste sur cet appareil.' }));
      enfants.push(champ('Jeton', 'jeton-saisie', { secret: true }));
      enfants.push(bouton('Enregistrer le jeton', 'jeton-enregistrer', () => {
        const r = enregistrerJeton(saisie('jeton-saisie'), stockage);
        delete ui.saisies['jeton-saisie'];
        dire('jeton', r.ok ? 'Jeton enregistré sur cet appareil.' : r.raison, !r.ok);
        rendre();
      }));
    }
    enfants.push(message('jeton'));
    return el('div', { classe: 'bloc', attrs: { 'data-capacites': 'jeton' } }, ...enfants);
  }

  function rendre() {
    const jeton = Boolean(lireJeton(stockage));
    zone.textContent = '';
    zone.append(...[
      el('p', { classe: 'aide', texte: 'Outillage de développement : un chantier n\'est jamais une acquisition de Naissance. Les livraisons gardent l\'approbation « Review deployments » sur GitHub.' }),
      bouton(ui.chargement ? 'Lecture…' : 'Actualiser', 'actualiser', actualiser, { actif: !ui.chargement }),
      sectionVersions(),
      sectionChantiers(jeton),
      sectionDemande(jeton),
      sectionJeton(jeton),
    ].filter(Boolean));
  }

  rendre();
  actualiser();
  return { rafraichir: actualiser };
}
// === FIN_CAPACITES_ECRAN ===
