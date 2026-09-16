// === DEBUT_CONSOLIDATION ===
// Le « sommeil » de Naissance : résumer l'histoire ancienne et tenir ses souvenirs à jour.
// Fonctions pures : décider, préparer la demande, valider la réponse, appliquer.
// La consolidation agit sur la MÉMOIRE uniquement, jamais sur l'identité.
//
// Souvenir :
// { id, texte, categorie, importance 1-3, confiance: certain|probable|incertain,
//   source: dit|deduit|manuel (origine, jamais modifiée), statut: actif|archive,
//   cree, modifie, dernierRappel, nbRappels, origine: { de, a }, historique: [...] }

export const REGLES = Object.freeze({
  garderRecents: 16,        // derniers messages jamais résumés
  seuilResume: 36,          // messages après le fil avant de résumer
  seuilExtraction: 12,      // messages non analysés avant d'extraire
  absenceMs: 30 * 60 * 1000,
  attenteApresEchecMs: 5 * 60 * 1000,
  maxTranche: 40,
  maxOperations: 15,
  maxSouvenirsActifs: 200,
  maxTexteSouvenir: 300,
  maxResume: 1500,
});

export const CATEGORIES = Object.freeze({
  personne: 'La personne',
  preference: 'Préférence',
  projet: 'Projet',
  proches: 'Proches',
  naissance: 'Naissance',
  autre: 'Autre',
});

const NIVEAUX = ['incertain', 'probable', 'certain'];
const ACTIONS = new Set(['ajouter', 'corriger', 'oublier', 'confirmer']);

const sansAccents = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const normaliserTexte = (t) => sansAccents(t).replace(/[^a-z0-9]+/g, ' ').trim();

export function decider({ nbApresFil, nbNonAnalyses, absence, force, meta, maintenant }) {
  if (!force && meta.echecConsolidation
      && maintenant - Date.parse(meta.echecConsolidation) < REGLES.attenteApresEchecMs) {
    return { resumer: false, extraire: false };
  }
  const resumer = nbApresFil > REGLES.seuilResume;
  const extraire = nbNonAnalyses >= REGLES.seuilExtraction
    || (!!absence && nbNonAnalyses >= 2)
    || (!!force && nbNonAnalyses >= 1);
  return { resumer, extraire };
}

function ligneMessage(m, personne) {
  const qui = m.role === 'moi' ? personne : 'Naissance';
  const texte = m.texte.length > 2000 ? `${m.texte.slice(0, 1999)}…` : m.texte;
  return `[${m.id}] ${qui} : ${texte}`;
}

export function construireDemande({ identite, fil, souvenirs, aResumer, aAnalyser }) {
  const personne = identite.noyau.personne;
  const instructions = [
    `Tu es le processus de consolidation de la mémoire de Naissance, l'IA personnelle de ${personne}.`,
    'Tu ne parles à personne. Tu réponds UNIQUEMENT par un objet JSON de cette forme :',
    '{"resume": "texte" ou null, "souvenirs": [opérations]}',
    '',
    'RÉSUMÉ',
    `- Si la partie A_RESUMER n'est pas vide, réécris le résumé de l'histoire en intégrant l'ancien résumé et ces échanges, en ${REGLES.maxResume - 300} caractères au plus : faits, événements, décisions, sans style.`,
    '- Si A_RESUMER est vide, "resume" vaut null.',
    '',
    'SOUVENIRS (seulement à partir de la partie A_ANALYSER)',
    `- Retiens uniquement des informations durables et utiles plus tard : sur ${personne}, ses préférences, ses projets, ses proches, et ce que ${personne} dit à propos de Naissance.`,
    '- Ignore les banalités, les informations passagères et le contenu des réponses de Naissance que la personne n\'a pas confirmé.',
    `- "source" vaut "dit" si ${personne} l'a dit clairement, "deduit" sinon.`,
    '- Ne recrée jamais un souvenir existant : utilise "confirmer".',
    '- Si une information nouvelle contredit ou précise un souvenir existant : "corriger".',
    '- Si un souvenir est devenu faux ou inutile : "oublier".',
    '- Deux souvenirs qui disent la même chose : "corriger" l\'un, "oublier" l\'autre.',
    `- N'invente rien. Au plus ${REGLES.maxOperations} opérations. Liste vide s'il n'y a rien à retenir.`,
    '- Tu ne modifies jamais l\'identité ni la personnalité de Naissance.',
    '',
    'OPÉRATIONS POSSIBLES',
    '{"action":"ajouter","texte":"…","categorie":"personne|preference|projet|proches|naissance|autre","importance":1|2|3,"source":"dit|deduit"}',
    '{"action":"corriger","id":"…","texte":"…","source":"dit|deduit"}',
    '{"action":"oublier","id":"…","raison":"…"}',
    '{"action":"confirmer","id":"…"}',
    'importance : 3 = essentiel et durable, 2 = utile, 1 = détail.',
  ].join('\n');

  const actifs = souvenirs.filter((s) => s.statut !== 'archive');
  const entree = [
    'ANCIEN_RESUME :',
    (fil && fil.texte) || '(aucun)',
    '',
    'SOUVENIRS_EXISTANTS :',
    ...(actifs.length
      ? actifs.map((s) => `[${s.id}] (${s.categorie}, importance ${s.importance}, ${s.confiance}) ${s.texte}`)
      : ['(aucun)']),
    '',
    'A_RESUMER :',
    ...(aResumer.length ? aResumer.map((m) => ligneMessage(m, personne)) : ['(vide)']),
    '',
    'A_ANALYSER :',
    ...(aAnalyser.length ? aAnalyser.map((m) => ligneMessage(m, personne)) : ['(vide)']),
  ].join('\n');
  return { instructions, entree };
}

function texteValide(t, max) {
  if (typeof t !== 'string') return null;
  const propre = t.replace(/\s+/g, ' ').trim();
  if (propre.length < 3) return null;
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
}

function categorieValide(c) {
  const k = sansAccents(c);
  return Object.hasOwn(CATEGORIES, k) ? k : 'autre';
}

function importanceValide(i, defaut = 2) {
  const n = Number.parseInt(i, 10);
  return Number.isFinite(n) ? Math.min(3, Math.max(1, n)) : defaut;
}

// Nettoie la réponse du moteur : rien de ce qu'il renvoie n'est appliqué sans contrôle.
export function validerReponse(reponse, idsExistants, { resumeAttendu }) {
  const ids = new Set(idsExistants);
  const sortie = { resume: null, operations: [], rejetees: 0 };
  if (!reponse || typeof reponse !== 'object') return sortie;
  if (resumeAttendu && typeof reponse.resume === 'string' && reponse.resume.trim()) {
    const r = reponse.resume.trim();
    sortie.resume = r.length > REGLES.maxResume ? `${r.slice(0, REGLES.maxResume - 1)}…` : r;
  }
  const vus = new Set();
  for (const op of Array.isArray(reponse.souvenirs) ? reponse.souvenirs : []) {
    if (sortie.operations.length >= REGLES.maxOperations) { sortie.rejetees++; continue; }
    if (!op || !ACTIONS.has(op.action)) { sortie.rejetees++; continue; }
    const source = op.source === 'dit' ? 'dit' : 'deduit';
    if (op.action === 'ajouter') {
      const texte = texteValide(op.texte, REGLES.maxTexteSouvenir);
      if (!texte) { sortie.rejetees++; continue; }
      sortie.operations.push({
        action: 'ajouter', texte, source,
        categorie: categorieValide(op.categorie),
        importance: importanceValide(op.importance),
      });
      continue;
    }
    if (typeof op.id !== 'string' || !ids.has(op.id) || vus.has(op.id)) { sortie.rejetees++; continue; }
    if (op.action === 'corriger') {
      const texte = texteValide(op.texte, REGLES.maxTexteSouvenir);
      if (!texte) { sortie.rejetees++; continue; }
      sortie.operations.push({ action: 'corriger', id: op.id, texte, source });
    } else if (op.action === 'oublier') {
      sortie.operations.push({ action: 'oublier', id: op.id, raison: texteValide(op.raison, 200) || '' });
    } else {
      sortie.operations.push({ action: 'confirmer', id: op.id });
    }
    vus.add(op.id);
  }
  return sortie;
}

export function niveauSuperieur(confiance) {
  const i = NIVEAUX.indexOf(confiance);
  return NIVEAUX[Math.min(NIVEAUX.length - 1, Math.max(0, i) + 1)];
}

function scoreConservation(s) {
  return (s.importance || 1) * 100
    + (s.confiance === 'certain' ? 60 : 0)
    + (s.source === 'manuel' ? 200 : 0)
    + Math.min(s.nbRappels || 0, 50)
    + (Date.parse(s.dernierRappel || s.modifie || s.cree || 0) || 0) / 1e12;
}

// Applique les opérations validées sur les souvenirs relus juste avant.
// « versions » = { id: modifie } lus au moment de la demande : si la personne a modifié
// un souvenir entre-temps, l'opération sur ce souvenir est ignorée.
export function appliquerOperations({ souvenirs, operations, versions, maintenant, origine, nouvelId }) {
  const date = maintenant.toISOString();
  const parId = new Map(souvenirs.map((s) => [s.id, structuredClone(s)]));
  const modifies = new Set();
  const stats = { ajoutes: 0, corriges: 0, oublies: 0, confirmes: 0, ignores: 0, archivesPourPlace: 0 };

  const confirmer = (s) => {
    s.confiance = niveauSuperieur(s.confiance);
    s.modifie = date;
    s.historique = [...(s.historique || []), { date, action: 'confirmé par Naissance' }];
    modifies.add(s.id);
    stats.confirmes++;
  };

  for (const op of operations) {
    if (op.action === 'ajouter') {
      const cle = normaliserTexte(op.texte);
      const doublon = [...parId.values()].find((s) => s.statut !== 'archive' && normaliserTexte(s.texte) === cle);
      if (doublon) { confirmer(doublon); continue; }
      const s = {
        id: nouvelId(),
        texte: op.texte,
        categorie: op.categorie,
        importance: op.importance,
        confiance: op.source === 'dit' ? 'probable' : 'incertain',
        source: op.source,
        statut: 'actif',
        cree: date,
        modifie: date,
        dernierRappel: null,
        nbRappels: 0,
        origine,
        historique: [],
      };
      parId.set(s.id, s);
      modifies.add(s.id);
      stats.ajoutes++;
      continue;
    }
    const s = parId.get(op.id);
    if (!s || s.statut === 'archive' || (versions && versions[op.id] !== s.modifie)) { stats.ignores++; continue; }
    if (op.action === 'corriger') {
      s.historique = [...(s.historique || []), { date, action: 'corrigé par Naissance', ancienTexte: s.texte }];
      s.texte = op.texte;
      s.confiance = op.source === 'dit' ? 'probable' : 'incertain';
      s.modifie = date;
      modifies.add(s.id);
      stats.corriges++;
    } else if (op.action === 'oublier') {
      s.statut = 'archive';
      s.modifie = date;
      s.historique = [...(s.historique || []), { date, action: 'archivé par Naissance', raison: op.raison }];
      modifies.add(s.id);
      stats.oublies++;
    } else if (op.action === 'confirmer') {
      confirmer(s);
    }
  }

  const actifs = [...parId.values()].filter((s) => s.statut !== 'archive');
  if (actifs.length > REGLES.maxSouvenirsActifs) {
    const enTrop = actifs.sort((a, b) => scoreConservation(a) - scoreConservation(b))
      .slice(0, actifs.length - REGLES.maxSouvenirsActifs);
    for (const s of enTrop) {
      s.statut = 'archive';
      s.modifie = date;
      s.historique = [...(s.historique || []), { date, action: 'archivé pour faire de la place' }];
      modifies.add(s.id);
      stats.archivesPourPlace++;
    }
  }
  return { aEcrire: [...modifies].map((id) => parId.get(id)), stats };
}
// === FIN_CONSOLIDATION ===
