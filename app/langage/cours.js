// === DEBUT_LANGAGE_COURS ===
// v0.17 — LE « COURS » : une leçon GROUPÉE, enseignée puis testée par des exercices qui passent par le
// VRAI moteur de langage de Naissance (repondre), pour savoir ce qui manque réellement :
//   des DONNÉES, une capacité du MOTEUR, une AMBIGUÏTÉ — ou un problème situé plus haut, dans le
//   pont / routage de main.js, que ces exercices ne peuvent pas observer (le rapport le dit).
//
// Ce module est une ORCHESTRATION, jamais un sixième moteur d'apprentissage :
//   - l'enseignement passe par le MÊME dispatcher que le pont conversationnel et le laboratoire
//     (ecrireConnaissance de l'écran, INJECTÉ ici), donc par les cinq fonctions d'apprentissage existantes ;
//   - les exercices appellent repondre() de esprit.js — la même fonction que main.js appelle.
//
// AUCUN LLM, AUCUN RÉSEAU : ce module n'importe que des modules purs du langage (esprit, connaissances,
// lecon, comprendre, regles, bagage). Il n'existe ici aucun « appelerGemini », aucun fetch. Un test statique
// le garantit. Un exercice ne peut donc jamais être « réussi » parce qu'un modèle a répondu à sa place.
//
// LE DÉCOR est TEMPORAIRE : il n'est appliqué QU'À une copie éphémère de la base (mémoire vive), jamais au
// vrai magasin. Une photo de contrôle des six tables avant / après le prouve dans chaque rapport.
//
// FORMAT DU BLOC (une ligne par élément ; lignes vides et « # » ignorées ; puces « - » « • » « 1. » tolérées) :
//   Leçon : titre                       (facultatif)
//   Source : nom                        (facultatif)
//   <une des cinq formes d'enseignement, telle quelle : Mot / Fait / Propriété / Pour / Façon de dire>
//   Décor : <une forme d'enseignement>  TEMPORAIRE — copie de test seulement
//   Exercice : question => réponse attendue   (« → » accepté) — compté dans le verdict
//   Sonde : question                     SANS réponse attendue — observation seule, hors verdict

import { chargerEsprit, repondre, COMPRIS, signatureConditions } from './esprit.js';
import { decouper } from './comprendre.js';
import { normaliserTexte } from './regles.js';
import { magasinMemoireVive, TABLES, cleFait } from './connaissances.js';
import { extraireLecon } from './lecon.js';
import { ROLES } from './bagage.js';

export const LIMITES = Object.freeze({ enseignement: 50, exercices: 30 });
export const ORIGINE_COURS = 'apprise-cours';
export const NOTE_PONT = 'NON OBSERVÉ par ces exercices : le pont / routage de main.js (règle du « ? », marqueurs « Apprends », '
  + 'aiguillage vers un LLM). Si tous les exercices sont verts mais que la même question échoue dans la conversation, chercher de ce côté.';

const PUCE = /^(?:[-*•–—]\s+|\d+[.)]\s+)/;
const MOT_LECON = /^le[cç]on\s*:\s*(.*)$/i;
const MOT_SOURCE = /^source\s*:\s*(.*)$/i;
const MOT_DECOR = /^d[ée]cor\s*:\s*(.*)$/i;
const MOT_EXERCICE = /^exercice\s*:\s*(.*)$/i;
const MOT_SONDE = /^sonde\s*:\s*(.*)$/i;
const AVEC_ATTENDU = /^(.+?)\s*(?:=>|→)\s*(.+)$/;
const CONTIENT_SEPARATEUR = /=>|→/;

// ------------------------------------------------------------------------------------ LECTURE DU BLOC
// Renvoie { ok, erreurs:[{ligne, texte, raison}], titre, source, enseignement, decor, exercices, sondes }.
// Toute ligne non reconnue est refusée AVEC son numéro : rien n'est exécuté tant que le bloc n'est pas propre.
export function lireCours(texte) {
  const lecture = { ok: false, erreurs: [], titre: null, source: null, enseignement: [], decor: [], exercices: [], sondes: [] };
  const erreur = (ligne, brut, raison) => lecture.erreurs.push({ ligne, texte: brut, raison });
  const lignes = String(texte || '').split(/\r?\n/);
  lignes.forEach((brut, i) => {
    const ligne = i + 1;
    let t = brut.trim();
    if (!t || t.startsWith('#')) return;
    t = t.replace(PUCE, '').trim();
    if (!t) return;
    let m;
    if ((m = t.match(MOT_LECON))) {
      if (lecture.titre !== null) erreur(ligne, brut, 'Le titre « Leçon : » est déjà donné.');
      else lecture.titre = m[1].trim();
      return;
    }
    if ((m = t.match(MOT_SOURCE))) {
      if (lecture.source !== null) erreur(ligne, brut, 'La « Source : » est déjà donnée.');
      else lecture.source = m[1].trim();
      return;
    }
    if ((m = t.match(MOT_DECOR))) {
      const extrait = extraireLecon(m[1].trim());
      if (!extrait) erreur(ligne, brut, 'Après « Décor : », il faut une des cinq formes d\'enseignement (Mot / Fait / Propriété / Pour / Façon de dire).');
      else lecture.decor.push({ ligne, texte: m[1].trim(), extrait });
      return;
    }
    if ((m = t.match(MOT_EXERCICE))) {
      const e = m[1].trim().match(AVEC_ATTENDU);
      if (!e) erreur(ligne, brut, 'Un exercice s\'écrit « Exercice : question => réponse attendue » (il manque « => »).');
      else lecture.exercices.push({ ligne, question: e[1].trim(), attendu: e[2].trim() });
      return;
    }
    if ((m = t.match(MOT_SONDE))) {
      const q = m[1].trim();
      if (!q) erreur(ligne, brut, 'Une sonde doit contenir une question.');
      else if (CONTIENT_SEPARATEUR.test(q)) erreur(ligne, brut, 'Une sonde n\'a pas de réponse attendue : utilise « Exercice : … => … » pour attendre une réponse.');
      else lecture.sondes.push({ ligne, question: q });
      return;
    }
    const extrait = extraireLecon(t);
    if (extrait) lecture.enseignement.push({ ligne, texte: t, extrait });
    else erreur(ligne, brut, 'Ligne non reconnue : ni une des cinq formes d\'enseignement, ni « Leçon : », « Source : », « Décor : », « Exercice : », « Sonde : ».');
  });
  if (lecture.enseignement.length > LIMITES.enseignement) {
    erreur(lecture.enseignement[LIMITES.enseignement].ligne, '', `Trop de lignes d'enseignement (${lecture.enseignement.length} > ${LIMITES.enseignement}).`);
  }
  if (lecture.exercices.length + lecture.sondes.length > LIMITES.exercices) {
    erreur(0, '', `Trop d'exercices et de sondes (${lecture.exercices.length + lecture.sondes.length} > ${LIMITES.exercices}).`);
  }
  if (!lecture.enseignement.length && !lecture.exercices.length && !lecture.sondes.length && !lecture.erreurs.length) {
    erreur(0, '', 'Le bloc ne contient rien à enseigner ni à tester.');
  }
  lecture.erreurs.sort((a, b) => a.ligne - b.ligne);
  lecture.ok = lecture.erreurs.length === 0;
  return lecture;
}

// ------------------------------------------------------------------------------------ COPIE ET PHOTO
// Photo de contrôle : les six tables du magasin, dans un ordre stable, pour prouver « rien n'a bougé ».
export async function instantane(magasin) {
  const tables = [];
  for (const t of TABLES) tables.push((await magasin.lireTout(t)).map((o) => JSON.stringify(o)).sort());
  return JSON.stringify(tables);
}

// Copie ÉPHÉMÈRE : mêmes tables copiées dans un magasin mémoire, puis un esprit chargé dessus. Toute écriture
// faite sur cette copie (enseignement de contrôle, Décor) ne peut PAS atteindre le vrai magasin.
export async function cloner(magasin) {
  const copie = magasinMemoireVive();
  for (const t of TABLES) for (const o of await magasin.lireTout(t)) await copie.ecrire(t, JSON.parse(JSON.stringify(o)));
  return { magasin: copie, esprit: await chargerEsprit(copie) };
}

// ------------------------------------------------------------------------------------ STATUT D'UN ÉLÉMENT
// Lecture seule. → { statut: 'nouveau' | 'connu' | 'remplace', detail }
export function statutElement(esprit, { type, donnees: d }) {
  if (type === 'relation') {
    const mot = decouper(d.mot)[0];
    const rel = decouper(d.relation)[0];
    const x = esprit.lexique[mot];
    if (!x) return { statut: 'nouveau', detail: null };
    if (x.role === ROLES.RELATION && x.relation === rel) return { statut: 'connu', detail: null };
    return { statut: 'remplace', detail: { avant: x.role === ROLES.RELATION ? x.relation : `rôle ${x.role}`, apres: rel } };
  }
  if (type === 'fait') {
    const id = cleFait(d.sujet, d.relation);
    // v0.17.1 — une identité déjà EN CONFLIT (plusieurs lignes différentes en mémoire, héritées
    // d'avant cette version) doit être signalée clairement : ni « nouveau », ni « remplace », pour
    // ne jamais laisser croire qu'une écriture va simplement s'ajouter — elle serait refusée.
    if (esprit.conflitsFaits && esprit.conflitsFaits.has(id)) {
      return { statut: 'conflit', detail: { candidats: esprit.conflitsFaits.get(id).map((l) => ({ sujet: l.sujet, relation: l.relation, valeur: l.valeur })) } };
    }
    const ancien = esprit.faits.get(id);
    if (!ancien) return { statut: 'nouveau', detail: null };
    if (ancien.valeur === d.valeur) return { statut: 'connu', detail: null };
    return { statut: 'remplace', detail: { avant: ancien.valeur, apres: d.valeur } };
  }
  if (type === 'propriete') {
    const ancien = esprit.proprietes.get(decouper(d.mot)[0])?.get(decouper(d.propriete)[0]);
    const v = normaliserTexte(d.valeur);
    if (ancien === undefined) return { statut: 'nouveau', detail: null };
    if (ancien === v) return { statut: 'connu', detail: null };
    return { statut: 'remplace', detail: { avant: ancien, apres: v } };
  }
  if (type === 'regle') {
    const role = normaliserTexte(d.role);
    const signature = signatureConditions(d.conditions.map((c) => ({ propriete: normaliserTexte(c.propriete), valeur: normaliserTexte(c.valeur) })));
    const ancienne = esprit.regles.find((r) => r.statut === 'validee' && normaliserTexte(r.role) === role && signatureConditions(r.conditions) === signature);
    if (!ancienne) return { statut: 'nouveau', detail: null };
    if (ancienne.resultat === String(d.resultat).trim()) return { statut: 'connu', detail: null };
    return { statut: 'remplace', detail: { avant: ancienne.resultat, apres: String(d.resultat).trim() } };
  }
  if (type === 'patron') {
    const rel = String(d.relation).trim() === '*' ? '*' : (decouper(d.relation)[0] || String(d.relation).trim());
    const suj = decouper(d.sujet)[0] || String(d.sujet).trim();
    const g = String(d.gabarit).trim();
    return esprit.patrons.some((p) => p.relation === rel && p.sujet === suj && p.gabarit === g)
      ? { statut: 'connu', detail: null } : { statut: 'nouveau', detail: null };
  }
  return { statut: 'nouveau', detail: null };
}

export function etiquetteStatut({ statut, detail }) {
  if (statut === 'connu') return 'déjà connu (sautée)';
  if (statut === 'remplace') return `remplace « ${detail.avant} » par « ${detail.apres} »`;
  if (statut === 'conflit') return `CONFLIT — ${detail.candidats.length} réponses différentes déjà en mémoire (${detail.candidats.map((c) => `« ${c.valeur} »`).join(', ')})`;
  return 'nouveau';
}

// ------------------------------------------------------------------------------------ ENSEIGNER SUR UN ESPRIT
// Applique les éléments dans l'ordre du bloc, avec le dispatcher injecté. Un élément DÉJÀ CONNU (identique) est
// sauté : rien n'est réécrit (une règle identique réécrite créerait inutilement des versions « remplacées »).
// S'arrête à la première erreur. → { enregistrements, erreur }
async function enseigner(esprit, elements, ecrire) {
  const enregistrements = [];
  for (const el of elements) {
    const s = statutElement(esprit, el.extrait);
    const base = { ligne: el.ligne, texte: el.texte, statut: s.statut, detail: s.detail, etiquette: etiquetteStatut(s) };
    if (s.statut === 'connu') { enregistrements.push({ ...base, action: 'sautee' }); continue; }
    try {
      const r = await ecrire(esprit, el.extrait, { origine: ORIGINE_COURS, exemple: el.texte });
      enregistrements.push({ ...base, action: 'ecrite', explication: r && r.explication ? r.explication : null });
    } catch (err) {
      const erreur = { ligne: el.ligne, texte: el.texte, raison: err && err.message ? err.message : String(err) };
      enregistrements.push({ ...base, action: 'erreur', erreur: erreur.raison });
      return { enregistrements, erreur };
    }
  }
  return { enregistrements, erreur: null };
}

// ------------------------------------------------------------------------------------ 1. VÉRIFIER
// AUCUNE écriture réelle : tout est rejoué sur une copie éphémère. → { ok, erreurs, lecture, elements, comptes, ... }
export async function verifierCours(texte, { magasin, ecrire }) {
  const lecture = lireCours(texte);
  if (!lecture.ok) return { ok: false, erreurs: lecture.erreurs, lecture, inchange: true };
  const avant = await instantane(magasin);
  const resultat = await rejouerSurCopie(lecture, { magasin, ecrire });
  // Garde-fou : la vérification ne doit JAMAIS avoir touché au vrai magasin (le rapport le dénonce sinon).
  resultat.inchange = (await instantane(magasin)) === avant;
  return resultat;
}

async function rejouerSurCopie(lecture, { magasin, ecrire }) {
  const A = await cloner(magasin);
  const { enregistrements, erreur } = await enseigner(A.esprit, lecture.enseignement, ecrire);
  if (erreur) {
    return { ok: false, erreurs: [{ ligne: erreur.ligne, texte: erreur.texte, raison: `rejeu de contrôle : ${erreur.raison}` }], lecture, elements: enregistrements };
  }
  for (const d of lecture.decor) {
    try { await ecrire(A.esprit, d.extrait, { origine: `${ORIGINE_COURS}-decor`, exemple: d.texte }); } catch (err) {
      return { ok: false, erreurs: [{ ligne: d.ligne, texte: d.texte, raison: `Décor invalide : ${err.message}` }], lecture, elements: enregistrements };
    }
  }
  const comptes = { nouveaux: 0, connus: 0, remplacent: 0 };
  for (const e of enregistrements) {
    if (e.statut === 'nouveau') comptes.nouveaux++;
    else if (e.statut === 'connu') comptes.connus++;
    else comptes.remplacent++;
  }
  return {
    ok: true, erreurs: [], lecture, elements: enregistrements, comptes,
    decor: lecture.decor.length, exercices: lecture.exercices.length, sondes: lecture.sondes.length,
  };
}

// ------------------------------------------------------------------------------------ EXERCICES
// Comparaison NORMALISÉE des deux côtés : casse, accents, apostrophes ’ / ', espaces, ponctuation finale.
// Rien de plus tolérant : un mot différent échoue.
export function normaliserReponse(t) {
  return normaliserTexte(String(t ?? '').replace(/[’‘´`]/g, "'")).replace(/\s+/g, ' ').replace(/[\s.!?…]+$/u, '');
}

const motsRelations = (question, lexique) => [...new Set(decouper(question).filter((m) => lexique[m] && lexique[m].role === ROLES.RELATION))];

// Classement d'une réponse à partir des champs DÉJÀ renvoyés par repondre() — dans cet ordre.
// HEURISTIQUE : les champs bruts restent dans le rapport pour trancher.
export function classer(r, { relations = [], ok = null } = {}) {
  const c = r.comprehension;
  if (r.etat !== COMPRIS) {
    if (c.relation && !c.sujet) {
      return { code: 'SUJET_NON_REPRESENTABLE', categorie: 'MOTEUR', detail: `la relation « ${c.relation} » est trouvée mais aucun sujet n'est reconnu (seuls « moi », « naissance » et les prénoms connus sont des sujets)${c.motsInconnus.length ? ` ; mots inconnus : ${c.motsInconnus.join(', ')}` : ''}` };
    }
    if (c.motsInconnus.length) return { code: 'VOCABULAIRE', categorie: 'DONNÉES', detail: `mot(s) inconnu(s) : ${c.motsInconnus.join(', ')}` };
    return { code: 'COMPREHENSION_INCOMPLETE', categorie: 'À EXAMINER', detail: `sujet=${c.sujet}, relation=${c.relation}` };
  }
  if (r.conflit) return { code: 'CONFLIT_REGLES', categorie: 'DONNÉES', detail: 'deux règles se contredisent (données contradictoires)' };
  if (r.conflitPatron) return { code: 'CONFLIT_FACONS_DE_DIRE', categorie: 'DONNÉES', detail: 'deux façons de dire se contredisent (données contradictoires)' };
  if (r.conflitFait) {
    return { code: 'CONFLIT_FAITS', categorie: 'DONNÉES', detail: `plusieurs valeurs différentes en mémoire pour « ${c.sujet} → ${c.relation} » (${(r.candidatsFait || []).map((l) => `« ${l.valeur} »`).join(' / ')})` };
  }
  if (r.regleManquante) return { code: 'REGLE_MANQUANTE', categorie: 'DONNÉES', detail: `le fait est connu mais la propriété ou la règle du possessif manque pour « ${c.relation} »` };
  if (!r.fait) return { code: 'FAIT_MANQUANT', categorie: 'DONNÉES', detail: `aucun fait pour « ${c.sujet} → ${c.relation} »` };
  if (relations.length > 1) {
    return { code: 'AMBIGUITE', categorie: 'AMBIGUÏTÉ', detail: `plusieurs mots-relations dans la question (${relations.join(', ')}) ; le moteur a retenu « ${c.relation} »` };
  }
  if (ok === false) return { code: 'REPONSE_DIFFERENTE', categorie: 'À EXAMINER', detail: 'réponse produite différente de la réponse attendue (limite du moteur ou attente erronée)' };
  return { code: ok === true ? 'OK' : 'REPONSE_PRODUITE', categorie: ok === true ? 'CONFORME' : 'OBSERVATION', detail: '' };
}

function evaluer(esprit, item) {
  const r = repondre(esprit, item.question); // LE vrai moteur : la même fonction que main.js appelle
  const c = r.comprehension;
  const relations = motsRelations(item.question, esprit.lexique);
  const proprietes = c.relation && esprit.proprietes.get(c.relation) ? Object.fromEntries(esprit.proprietes.get(c.relation)) : {};
  const ok = item.type === 'exercice' ? normaliserReponse(r.texte) === normaliserReponse(item.attendu) : null;
  const classement = ok === true ? { code: 'OK', categorie: 'CONFORME', detail: '' } : classer(r, { relations, ok });
  return {
    ligne: item.ligne, type: item.type, question: item.question, attendu: item.type === 'exercice' ? item.attendu : null,
    produit: r.texte, ok, classement,
    brut: {
      etat: r.etat, sujet: c.sujet, relation: c.relation, motsInconnus: [...c.motsInconnus],
      fait: r.fait ? { sujet: r.fait.sujet, relation: r.fait.relation, valeur: r.fait.valeur } : null,
      patron: r.patron ? { gabarit: r.patron.gabarit, origine: r.patron.origine || null } : null,
      regleUtilisee: r.regleUtilisee ? { conditions: r.regleUtilisee.conditions, resultat: r.regleUtilisee.resultat } : null,
      conflit: !!r.conflit, conflitPatron: !!r.conflitPatron, regleManquante: !!r.regleManquante,
      conflitFait: !!r.conflitFait, candidatsFait: r.candidatsFait ? r.candidatsFait.map((l) => ({ valeur: l.valeur })) : [],
      motsRelationsDansLaQuestion: relations, proprietesDeLaRelation: proprietes,
    },
  };
}

// Copie éphémère RECHARGÉE depuis le magasin (équivaut à fermer puis rouvrir), Décor appliqué sur la copie seulement.
async function executerExercices(lecture, { magasin, ecrire }) {
  const B = await cloner(magasin);
  const decor = [];
  for (const d of lecture.decor) {
    try {
      await ecrire(B.esprit, d.extrait, { origine: `${ORIGINE_COURS}-decor`, exemple: d.texte });
      decor.push({ ligne: d.ligne, texte: d.texte });
    } catch (err) {
      return { decor, resultats: [], erreurDecor: { ligne: d.ligne, texte: d.texte, raison: err.message } };
    }
  }
  const items = [
    ...lecture.exercices.map((e) => ({ type: 'exercice', ...e })),
    ...lecture.sondes.map((s) => ({ type: 'sonde', ...s })),
  ].sort((a, b) => a.ligne - b.ligne);
  return { decor, resultats: items.map((it) => evaluer(B.esprit, it)), erreurDecor: null };
}

export function verdictDe(resultats, { partielle = false, erreurDecor = null } = {}) {
  if (partielle) return { code: 'PARTIELLE', texte: 'PARTIELLE (écriture interrompue, exercices non lancés)' };
  if (erreurDecor) return { code: 'ERREUR_DECOR', texte: 'NON EXÉCUTÉE (le Décor est invalide)' };
  const exercices = resultats.filter((r) => r.type === 'exercice');
  if (!exercices.length) return { code: 'SANS_EXERCICE', texte: 'SANS EXERCICE (rien à valider)' };
  const echecs = exercices.filter((r) => !r.ok).length;
  if (echecs) return { code: 'ECHOUEE', texte: `ÉCHOUÉE (${echecs} échec${echecs > 1 ? 's' : ''} sur ${exercices.length})` };
  return { code: 'VALIDEE', texte: `VALIDÉE (${exercices.length}/${exercices.length} exercices)` };
}

function assembler({ mode, lecture, elements, partielle, erreurEcriture, exec, integrite }) {
  const resultats = exec ? exec.resultats : [];
  const verdict = verdictDe(resultats, { partielle, erreurDecor: exec ? exec.erreurDecor : null });
  return {
    ok: true, mode, titre: lecture.titre, source: lecture.source, elements, partielle, erreurEcriture,
    decor: exec ? exec.decor : [], erreurDecor: exec ? exec.erreurDecor : null, resultats, verdict,
    integrite, compteurs: {
      exercices: resultats.filter((r) => r.type === 'exercice').length,
      reussis: resultats.filter((r) => r.type === 'exercice' && r.ok).length,
      sondes: resultats.filter((r) => r.type === 'sonde').length,
    },
  };
}

// ------------------------------------------------------------------------------------ 2. DONNER LE COURS
// UNE confirmation : enseignement réel (règles et éléments identiques sautés), puis exercices sur une copie
// rechargée depuis le vrai magasin + Décor. Vraie atomicité impossible (une transaction par écriture) : en cas
// d'erreur en cours de route, arrêt immédiat et rapport PARTIELLE exact.
export async function donnerCours(texte, { magasin, esprit, ecrire }) {
  const verif = await verifierCours(texte, { magasin, ecrire });
  if (!verif.ok) return { ok: false, mode: 'ENSEIGNEMENT + EXERCICES', erreurs: verif.erreurs, lecture: verif.lecture };
  const lecture = verif.lecture;
  const { enregistrements, erreur } = await enseigner(esprit, lecture.enseignement, ecrire);
  if (erreur) {
    const restantes = lecture.enseignement.slice(enregistrements.length).map((el) => ({ ligne: el.ligne, texte: el.texte, statut: null, detail: null, etiquette: '—', action: 'non_ecrite' }));
    return assembler({
      mode: 'ENSEIGNEMENT + EXERCICES', lecture, elements: [...enregistrements, ...restantes], partielle: true, erreurEcriture: erreur,
      exec: null, integrite: { inchange: verif.inchange ? null : false },
    });
  }
  const avant = await instantane(magasin);
  const exec = await executerExercices(lecture, { magasin, ecrire });
  const apres = await instantane(magasin);
  return assembler({
    mode: 'ENSEIGNEMENT + EXERCICES', lecture, elements: enregistrements, partielle: false, erreurEcriture: null,
    exec, integrite: { inchange: verif.inchange && avant === apres },
  });
}

// ------------------------------------------------------------------------------------ 3. TESTER SEULEMENT
// Ignore l'enseignement (les lignes restent contrôlées à la lecture) : copie éphémère de l'état réel + Décor +
// exercices. N'écrit RIEN dans le vrai magasin.
export async function testerCours(texte, { magasin, ecrire }) {
  const lecture = lireCours(texte);
  if (!lecture.ok) return { ok: false, mode: 'TEST SEULEMENT', erreurs: lecture.erreurs, lecture };
  const avant = await instantane(magasin);
  const exec = await executerExercices(lecture, { magasin, ecrire });
  const apres = await instantane(magasin);
  const ignores = lecture.enseignement.map((el) => ({ ligne: el.ligne, texte: el.texte, statut: null, detail: null, etiquette: '—', action: 'ignoree' }));
  return assembler({
    mode: 'TEST SEULEMENT', lecture, elements: ignores, partielle: false, erreurEcriture: null,
    exec, integrite: { inchange: avant === apres },
  });
}

// ------------------------------------------------------------------------------------ AFFICHAGES
export function formaterApercu(v) {
  if (!v.ok) return formaterErreurs(v.erreurs);
  const c = v.comptes;
  const lignes = [
    ...(v.inchange === false ? ['ANOMALIE : la vérification a modifié la vraie mémoire (elle ne devrait rien écrire).', ''] : []),
    `${v.elements.length} élément${v.elements.length > 1 ? 's' : ''} d'enseignement : ${c.nouveaux} nouveau${c.nouveaux > 1 ? 'x' : ''}, ${c.connus} déjà connu${c.connus > 1 ? 's' : ''}, ${c.remplacent} remplacent quelque chose.`,
    `Décor : ${v.decor} ligne${v.decor > 1 ? 's' : ''} (temporaires, jamais écrites dans sa vraie mémoire) · exercices : ${v.exercices} · sondes : ${v.sondes}.`,
    '',
    ...v.elements.map((e, i) => `${i + 1}. [${e.etiquette}] ${e.texte}`),
  ];
  return lignes.join('\n');
}

export function formaterErreurs(erreurs) {
  return ['Le bloc n\'est pas exécutable — rien n\'a été écrit :', ...erreurs.map((e) => (e.ligne ? `ligne ${e.ligne} : ${e.raison}${e.texte ? `\n    ${e.texte.trim()}` : ''}` : e.raison))].join('\n');
}

const oui = (b) => (b ? 'oui' : 'non');
const ligneBrut = (b) => [
  `état=${b.etat}`, `sujet=${b.sujet}`, `relation=${b.relation}`, `mots inconnus=[${b.motsInconnus.join(', ')}]`,
  `fait=${b.fait ? `${b.fait.sujet}→${b.fait.relation}→${b.fait.valeur}` : 'aucun'}`,
  `façon de dire=${b.patron ? `« ${b.patron.gabarit} »${b.patron.origine ? ` (${b.patron.origine})` : ''}` : 'aucune'}`,
  `règle utilisée=${b.regleUtilisee ? `${b.regleUtilisee.conditions.map((x) => `${x.propriete}=${x.valeur}`).join(', ')} → ${b.regleUtilisee.resultat}` : 'aucune'}`,
  `conflit règles=${oui(b.conflit)}`, `conflit façons de dire=${oui(b.conflitPatron)}`, `règle manquante=${oui(b.regleManquante)}`,
  `conflit faits=${b.conflitFait ? `oui (${b.candidatsFait.map((c) => `« ${c.valeur} »`).join(' / ')})` : 'non'}`,
  `mots-relations dans la question=[${b.motsRelationsDansLaQuestion.join(', ')}]`,
  `propriétés de « ${b.relation} »=${Object.entries(b.proprietesDeLaRelation).map(([k, v]) => `${k}=${v}`).join(', ') || 'aucune'}`,
].join(' ; ');

// Le rapport COPIABLE pour ChatGPT / Claude : verdict, éléments, Décor (marqué temporaire), et pour chaque
// exercice ou sonde les données BRUTES de diagnostic. Distingue DONNÉES / MOTEUR / AMBIGUÏTÉ, et rappelle
// ce que ces exercices ne voient pas (le pont).
export function formaterRapport(res, { version = '?', date = new Date().toISOString() } = {}) {
  const L = [];
  L.push(`RAPPORT DE COURS — Naissance v${version}`);
  L.push(`Date : ${date}`);
  L.push(`Mode : ${res.mode}`);
  if (!res.ok) {
    L.push('Verdict : NON EXÉCUTÉ (erreurs de lecture)');
    L.push('');
    L.push(formaterErreurs(res.erreurs));
    L.push('');
    L.push(NOTE_PONT);
    return L.join('\n');
  }
  L.push(`Leçon : ${res.titre || '(sans titre)'}${res.source ? ` · Source : ${res.source}` : ''}`);
  L.push(`Verdict : ${res.verdict.texte}`);
  L.push(`Exercices : ${res.compteurs.reussis}/${res.compteurs.exercices} réussis · Sondes : ${res.compteurs.sondes} (observation, hors verdict)`);
  L.push(`Intégrité : vrai magasin inchangé pendant le Décor et les exercices : ${res.integrite.inchange === null ? 'sans objet (exercices non lancés)' : (res.integrite.inchange ? 'oui' : 'NON — ANOMALIE, le Décor a pu contaminer la vraie mémoire')}`);
  L.push('');
  L.push(`--- ENSEIGNEMENT (${res.elements.length} élément${res.elements.length > 1 ? 's' : ''})`);
  const ACTION = { ecrite: 'écrit', sautee: 'sauté', erreur: 'ERREUR', non_ecrite: 'NON ÉCRIT', ignoree: 'ignoré (test seulement)' };
  res.elements.forEach((e, i) => L.push(`${i + 1}. [${e.etiquette}] ${ACTION[e.action] || e.action} — ligne ${e.ligne} : ${e.texte}${e.erreur ? `\n     ERREUR : ${e.erreur}` : ''}`));
  if (res.partielle && res.erreurEcriture) L.push(`ÉCRITURE INTERROMPUE ligne ${res.erreurEcriture.ligne} : ${res.erreurEcriture.raison}`);
  L.push('');
  L.push('--- DÉCOR (temporaire : appliqué à la copie de test seulement, jamais écrit dans la vraie mémoire)');
  if (!res.decor.length && !res.erreurDecor) L.push('(aucun)');
  res.decor.forEach((d) => L.push(`ligne ${d.ligne} : ${d.texte}`));
  if (res.erreurDecor) L.push(`DÉCOR INVALIDE ligne ${res.erreurDecor.ligne} : ${res.erreurDecor.raison}`);
  const bloc = (titre, type) => {
    const liste = res.resultats.filter((r) => r.type === type);
    L.push('');
    L.push(titre);
    if (!liste.length) L.push('(aucun)');
    for (const r of liste) {
      const marque = type === 'sonde' ? '👁' : (r.ok ? '✅' : '❌');
      L.push(`${marque} ligne ${r.ligne} — ${type === 'sonde' ? 'Sonde' : 'Exercice'} : ${r.question}`);
      L.push(`   attendu : ${type === 'sonde' ? '(observation, aucune réponse attendue)' : r.attendu}`);
      L.push(`   produit : ${r.produit}`);
      L.push(`   brut    : ${ligneBrut(r.brut)}`);
      L.push(`   classement : ${r.classement.categorie} — ${r.classement.code}${r.classement.detail ? ` : ${r.classement.detail}` : ''}`);
    }
  };
  bloc('--- EXERCICES', 'exercice');
  bloc('--- SONDES (observation, jamais comptées dans le verdict)', 'sonde');
  L.push('');
  L.push(NOTE_PONT);
  return L.join('\n');
}
// === FIN_LANGAGE_COURS ===
