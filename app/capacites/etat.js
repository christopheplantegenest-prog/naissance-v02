// === DEBUT_CAPACITES_ETAT ===
// v0.66.6 — ATELIER 2, L1 (GO « ATELIER 2 — GO PHASE 1 », 25/10/2026) : lecture des chantiers de l'Atelier autonome pour l'écran
// « Atelier — capacités ». OUTILLAGE NON COGNITIF (D-007) : aucune acquisition, aucune mémoire, aucune table de Naissance.
// Module PUR : aucun import, aucun réseau, aucun stockage. Il lit ce que l'Atelier publie dans ses tickets GitHub :
//  - le commentaire d'état du bot (première ligne « <!-- atelier-autonome-etat situation=… --> ») ;
//  - depuis v0.66.6, les données jointes « <!-- atelier-autonome-donnees {json} --> » ; à défaut (commentaires plus anciens), le texte.
// Le ticket et le commentaire ne font jamais autorité sur Naissance : ils décrivent un chantier, rien de plus.

export const DEPOT = 'christopheplantegenest-prog/naissance-v02';
export const PROPRIETAIRE = 'christopheplantegenest-prog';
export const PROPRIETAIRE_ID = 308310970;
export const BOT = 'github-actions[bot]';
export const MARQUE_ETAT = '<!-- atelier-autonome-etat';
export const MARQUE_DONNEES = '<!-- atelier-autonome-donnees ';
export const PREFIXE_TITRE = 'Atelier : ';
const RE_TITRE = /^\s*atelier\s*:/i;
const RE_VERSION = /^\d+\.\d+\.\d+$/;
const objet = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const texte = (x, max = 2000) => (typeof x === 'string' ? x.slice(0, max) : null);
const entier = (x) => (Number.isSafeInteger(x) && x >= 0 ? x : null);

// Ticket « Atelier : … » ouvert par Christophe (identifiant numérique, jamais le nom), hors demandes de fusion.
export const estChantier = (t) => objet(t) && objet(t.user) && t.user.id === PROPRIETAIRE_ID && typeof t.title === 'string' && RE_TITRE.test(t.title) && !t.pull_request;

// Données jointes au commentaire d'état -> objet vérifié, ou null (absentes, illisibles ou d'une autre forme).
export function lireDonnees(corps) {
  if (typeof corps !== 'string') return null;
  const i = corps.lastIndexOf(MARQUE_DONNEES);
  if (i < 0) return null;
  const fin = corps.indexOf(' -->', i);
  if (fin < 0) return null;
  let d;
  try { d = JSON.parse(corps.slice(i + MARQUE_DONNEES.length, fin)); } catch { return null; }
  if (!objet(d) || d.v !== 1 || !Number.isSafeInteger(d.ticket) || typeof d.etape !== 'string' || !Array.isArray(d.missions)) return null;
  return {
    etape: d.etape.slice(0, 40), raison: texte(d.raison, 40), mission: texte(d.mission, 200), tentative: entier(d.tentative),
    plan: texte(d.plan, 500), version: RE_VERSION.test(d.version ?? '') ? d.version : null,
    missions: d.missions.slice(0, 12).filter(objet).map((m) => ({ id: texte(m.id, 200) ?? '?', titre: texte(m.titre, 300) ?? '', cognitive: m.cognitive === true, etat: ['validee', 'en-cours', 'a-faire'].includes(m.etat) ? m.etat : 'a-faire', tentative: entier(m.tentative) ?? 0, tentatives: entier(m.tentatives) })),
    bloque: objet(d.bloque) ? { raison: texte(d.bloque.raison, 60) ?? '?', question: texte(d.bloque.question) } : null,
    depense: entier(d.depense), plafond: entier(d.plafond),
    mois: objet(d.mois) ? { cycle: texte(d.mois.cycle, 7), consomme: entier(d.mois.consomme), reste: entier(d.mois.reste), plafond: entier(d.mois.plafond) } : null,
    livraison: objet(d.livraison) && RE_VERSION.test(d.livraison.version ?? '') ? { version: d.livraison.version, conclusion: texte(d.livraison.conclusion, 20) } : null,
  };
}

const usdVersMicro = (t) => (t === undefined ? null : Math.round(Number(t) * 1_000_000));
// Commentaire d'état d'avant v0.66.6 (texte seul) -> même forme que lireDonnees, au mieux ; jamais d'invention.
export function lireTexte(corps) {
  if (typeof corps !== 'string' || !corps.startsWith(MARQUE_ETAT)) return null;
  const situation = /situation=(\S*)/.exec(corps)?.[1] ?? '';
  const [raisonSituation] = situation.split(':');
  const missions = [...corps.matchAll(/^- (✅|🔧|⏳) ([^ ]+) : (.*?)(?: — tentative (\d+)\/(\d+))?(?: — périmètre \+ : .*)?$/gmu)].slice(0, 12)
    .map((m) => ({ id: m[2], titre: m[3].replace(/ \(cognitive : validation de Christophe\)$/, ''), cognitive: m[3].includes('(cognitive'), etat: { '✅': 'validee', '🔧': 'en-cours', '⏳': 'a-faire' }[m[1]], tentative: m[4] ? Number(m[4]) : 0, tentatives: m[5] ? Number(m[5]) : null }));
  const dep = /Dépense du chantier : ([\d.]+) \$(?: sur ([\d.]+) \$)?(?: — mois (\d{4}-\d{2}) : ([\d.]+) \$ consommés, [\d.]+ \$ réservés, ([\d.]+) \$ restants sur ([\d.]+) \$)?/.exec(corps);
  const bloc = /⛔ Bloqué \(([^)]+)\)\.(?: Question : ([\s\S]*?))? Répondre en écrivant/.exec(corps);
  const livre = /🏁 Livré : v(\d+\.\d+\.\d+)/.exec(corps);
  const plan = /^Plan : (.*) — version visée v(\d+\.\d+\.\d+)$/m.exec(corps);
  let etape = 'inconnue';
  if (/^Étape suivante : /m.test(corps)) etape = 'travail';
  if (['bloque', 'arret', 'attente-validation', 'attente-livraison', 'termine'].includes(raisonSituation)) etape = 'aucune';
  if (livre && etape === 'inconnue') etape = 'aucune';
  return {
    etape, raison: etape === 'aucune' ? (livre && !raisonSituation ? 'termine' : raisonSituation) : null, mission: null, tentative: null,
    plan: plan ? plan[1] : null, version: plan ? plan[2] : null, missions,
    bloque: bloc ? { raison: bloc[1], question: bloc[2] ?? null } : null,
    depense: dep ? usdVersMicro(dep[1]) : null, plafond: dep && dep[2] ? usdVersMicro(dep[2]) : null,
    mois: dep && dep[3] ? { cycle: dep[3], consomme: usdVersMicro(dep[4]), reste: usdVersMicro(dep[5]), plafond: usdVersMicro(dep[6]) } : null,
    livraison: livre ? { version: livre[1], conclusion: 'livre' } : null,
  };
}

// Dernier commentaire d'état du bot parmi les commentaires d'un ticket (dans l'ordre de GitHub), ou null.
export function dernierEtat(commentaires) {
  const miens = (Array.isArray(commentaires) ? commentaires : []).filter((c) => objet(c) && typeof c.body === 'string' && c.body.startsWith(MARQUE_ETAT) && objet(c.user) && c.user.login === BOT);
  return miens.length ? miens[miens.length - 1] : null;
}

// Situation affichée d'un chantier : { code, libelle }. code : travail, bloque, arret, attente-validation, attente-livraison, livre,
// ferme, inconnu.
const LIBELLES = {
  travail: 'En cours', bloque: 'Bloqué : réponse attendue', arret: 'Arrêté', 'attente-validation': 'Validation attendue (/valider)',
  'attente-livraison': 'Colis au robot : approbation V4 attendue', livre: 'Livré', ferme: 'Fermé', inconnu: 'État inconnu',
};
export function situation({ ouvert, etat }) {
  let code = 'inconnu';
  if (etat) {
    if (etat.etape !== 'aucune' && etat.etape !== 'inconnue') code = 'travail';
    else if (etat.raison === 'tour-en-cours') code = 'travail';
    else if (etat.raison === 'termine' || etat.etape === 'terminer') code = 'livre';
    else if (LIBELLES[etat.raison]) code = etat.raison;
  }
  if (!ouvert && code !== 'livre') code = 'ferme';
  return { code, libelle: LIBELLES[code] };
}

// Résumé d'un chantier pour l'écran : ticket GitHub + ses commentaires.
export function resumer(ticket, commentaires) {
  const c = dernierEtat(commentaires);
  const etat = c ? (lireDonnees(c.body) ?? lireTexte(c.body)) : null;
  const r = {
    numero: ticket.number, titre: String(ticket.title).replace(RE_TITRE, '').trim().slice(0, 200) || '(sans titre)',
    ouvert: ticket.state === 'open', cree: texte(ticket.created_at, 40), maj: c ? texte(c.updated_at ?? c.created_at, 40) : null,
    source: c ? (lireDonnees(c.body) ? 'donnees' : 'texte') : null, etat,
  };
  r.situation = situation(r);
  return r;
}

// Commandes que l'écran propose selon la situation (le workflow « commande » reste seul juge).
// v0.66.7 : /stop aussi sur un chantier arrêté — sans effet sur le journal ni dépense (le workflow ne fait que rafraîchir l'état) ;
// c'est la commande réelle gratuite qui prouve le jeton, le workflow « commande » et l'affichage.
export function commandesPossibles(r) {
  return {
    travail: ['/stop'], bloque: ['/reprendre', '/stop'], arret: ['/reprendre', '/stop'], 'attente-validation': ['/valider', '/stop'],
  }[r?.situation?.code] ?? [];
}

// Texte d'un commentaire de commande : la commande seule sur la première ligne, puis la réponse et le périmètre éventuels.
// -> { corps } ou { raison }.
export function texteCommande(commande, { reponse = '', perimetre = '' } = {}) {
  if (!['/stop', '/reprendre', '/valider'].includes(commande)) return { raison: 'commande inconnue' };
  const rep = String(reponse ?? '').replace(/\r\n?/g, '\n').trim();
  const per = String(perimetre ?? '').split(/[\s,;]+/).filter(Boolean);
  if (commande !== '/reprendre' && (rep || per.length)) return { raison: 'seul /reprendre porte une réponse' };
  if (rep.length > 1400) return { raison: 'réponse trop longue (1400 caractères au plus)' };
  if (per.length > 20) return { raison: 'périmètre : 20 chemins au plus' };
  if (per.some((p) => !/^[A-Za-z0-9_][A-Za-z0-9_./-]{0,199}$/.test(p) || p.split('/').includes('..'))) return { raison: 'périmètre : chemin irrégulier' };
  const lignes = [commande];
  if (rep) lignes.push(rep);
  if (per.length) lignes.push(`périmètre + : ${per.join(', ')}`);
  return { corps: lignes.join('\n') };
}

// Demande d'une capacité -> { titre, corps } du ticket, ou { raison }.
export function texteDemande({ titre, description }) {
  const t = String(titre ?? '').replace(/\s+/g, ' ').trim().replace(RE_TITRE, '').trim();
  const d = String(description ?? '').replace(/\r\n?/g, '\n').trim();
  if (t.length < 3 || t.length > 120) return { raison: 'titre de 3 à 120 caractères attendu' };
  if (d.length < 10) return { raison: 'décrire la capacité attendue (10 caractères au moins)' };
  if (d.length > 6000) return { raison: 'description trop longue (6000 caractères au plus)' };
  if (/^\s*\//m.test(d.split('\n')[0])) return { raison: 'la description ne commence pas par une commande' };
  return { titre: `${PREFIXE_TITRE}${t}`, corps: d };
}

// Versions : installée sur l'appareil, et dernière publiée (release « latest » du dépôt) -> résumé affichable, ou null.
export function lireVersion(release) {
  if (!objet(release) || typeof release.tag_name !== 'string') return null;
  const v = release.tag_name.replace(/^v/, '');
  if (!RE_VERSION.test(v)) return null;
  const apk = (Array.isArray(release.assets) ? release.assets : []).find((a) => objet(a) && typeof a.name === 'string' && a.name.endsWith('.apk'));
  return {
    version: v, publiee: texte(release.published_at, 40), page: typeof release.html_url === 'string' && release.html_url.startsWith(`https://github.com/${DEPOT}/`) ? release.html_url : null,
    apk: apk ? { nom: apk.name.slice(0, 120), taille: entier(apk.size) } : null,
  };
}
export function compareVersions(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  return 0;
}

// Montant en micro-USD -> « 8,57 $ ».
export const usd = (micro) => (Number.isSafeInteger(micro) ? `${(micro / 1_000_000).toFixed(2).replace('.', ',')} $` : '?');
// === FIN_CAPACITES_ETAT ===
