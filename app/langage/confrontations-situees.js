// === DEBUT_LANGAGE_CONFRONTATIONS_SITUEES ===
// N3b-1 — « METTRE DEUX EXPÉRIENCES VÉCUES EN REGARD » (GO ChatGPT « N3b-1 — GO CODE », 15/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE.
// Aucune écriture, aucune table, aucune horloge, aucun hasard. Elle ne lit RIEN par elle-même : elle reçoit des expériences déjà produites
// par la relecture N3b-0 (main.js les lui passe, pour le seul panneau Diagnostic). Aucun mécanisme de décision, d'examen, de proposition,
// d'apprentissage, de besoin, de moyen, de stratégie, d'occasion ni d'initiative ne la lit (gardes : tests/confrontations-situees.test.mjs).
//
// ACQUIS (formulation maximale) : confronter deux descriptions d'expériences vécues que Naissance possède et restituer, emplacement par
// emplacement, ce qui y est égal, différent, propre à l'une ou indéterminable, en maintenant séparé ce qui appartient aux traces historiques
// de ce qui est reconstruit aujourd'hui. Elle confronte des DESCRIPTIONS ; elle ne juge pas la signification de leurs ressemblances.
//
// confronterExperiencesSituees(x1, x2) -> confrontation
//   x1, x2 : deux expériences au contrat EXACT de la sortie N3b-0 (sinon TypeError, aucun résultat partiel). Même Q des deux côtés : TypeError
//            (une expérience n'est jamais mise en regard d'elle-même).
//   confrontation = {
//     base: 'description-N3b-0',
//     identites: [identites(x1), identites(x2)]      — [{ chemin, valeur }] : clés techniques (Q, E, réponses, traces, manifestations),
//                                                      restituées pour IDENTIFIER, jamais confrontées ;
//     historique: { communs, differents, propres: { premiere, seconde }, indeterminables }  — traces persistées seulement ;
//     actuel:     { communs, differents, propres: { premiere, seconde }, indeterminables }  — reconstruit aujourd'hui : la relecture
//                                                      (déclaration courante), resultatActuel (esprit courant), l'issue « ouverte » (aucune
//                                                      ligne issue au moment de la lecture).
//   }
//   communs : [{ chemin, valeur }] ; differents : [{ chemin, premiere, seconde }] ; propres.* : [{ chemin, valeur }] ou [{ chemin, absente: true }] ;
//   indeterminables : [{ chemin, absente: 'premiere' | 'seconde' | 'les-deux' }].
//   Un CHEMIN est l'emplacement dans la description N3b-0 (tableau de clés). Il signifie seulement « les deux descriptions possèdent une donnée
//   à ce même emplacement structurel » ; il ne dit rien de l'importance de cette donnée.
//
// RÈGLES : égalité stricte (===), aucune canonisation, aucune casse ignorée ; un tableau est UNE valeur, égale seulement s'il est identique
//   élément par élément dans le même ordre, et jamais apparié élément à élément ; un null du contrat N3b-0 est toujours une donnée ABSENTE :
//   jamais une égalité (deux absences : indéterminable) ; un emplacement présent d'un seul côté est propre à cette expérience ; sortie
//   symétrique (échanger x1 et x2 échange premiere et seconde, rien d'autre) ; ordre technique (clés en ordre de code), sans signification ;
//   aucun résumé chiffré, aucun verdict.
//
// confrontationsExperiencesSituees(experiences) -> [confrontation | { identites, refus: 'meme-experience' }]
//   TOUTES les paires non ordonnées (i < j) dans l'ordre reçu, sans sélection, sans filtre, sans classement.
//
// CE QUI N'EST JAMAIS AFFIRMÉ : que deux situations se ressemblent, qu'elles forment un type, qu'une issue vaut mieux qu'une autre, qu'un
// acte en répète un autre, qu'un moyen existe ou s'applique. Les coréférences internes à une expérience ne sont pas exploitées.

const estObjet = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const estChaine = (x) => typeof x === 'string' && x.length > 0;
const memesCles = (o, cles) => estObjet(o) && Object.keys(o).length === cles.length && cles.every((c) => Object.hasOwn(o, c));
const refus = (motif) => { throw new TypeError(`Confrontation refusée : ${motif}.`); };

// ---- Contrat N3b-0 (fermé) ----
const ABSENCES = ['reponse-attendue-absente', 'question-introuvable', 'reaction-absente', 'reponse-produite-introuvable', 'obtenu-non-persiste', 'appui-incoherent'];
const ISSUES = ['ouverte', 'annulee', 'perimee', 'confirmee'];
const estFait = (f) => memesCles(f, ['sujet', 'relation', 'valeur']) && ['sujet', 'relation', 'valeur'].every((c) => typeof f[c] === 'string');
const estChaineOuNull = (x) => x === null || typeof x === 'string';
function verifierReaction(r) {
  if (r === null) return;
  if (!memesCles(r, ['idMessage', 'cible']) || !estChaine(r.idMessage)) refus('réaction hors contrat');
  if (!(memesCles(r.cible, ['idReponseLocale']) && estChaine(r.cible.idReponseLocale)) && !(memesCles(r.cible, ['idTrace']) && estChaine(r.cible.idTrace))) refus('cible de réaction hors contrat');
}
function verifierReponseProduite(p) {
  if (p === null) return;
  const cle = Object.hasOwn(p || {}, 'idTrace') ? 'idTrace' : 'idReponseLocale';
  if (!memesCles(p, ['voie', cle, 'obtenu', 'appuis']) || !estChaine(p[cle])) refus('réponse produite hors contrat');
  if (p.voie !== undefined && typeof p.voie !== 'string') refus('voie hors contrat');
  if (!(p.obtenu === null || (Array.isArray(p.obtenu) && p.obtenu.every((v) => typeof v === 'string')))) refus('obtenu hors contrat');
  if (!Array.isArray(p.appuis) || !p.appuis.every(estFait)) refus('appuis hors contrat');
}
function verifierRelecture(r) {
  if (memesCles(r, ['statut']) && r.statut === 'non-relue') return;
  if (!memesCles(r, ['statut', 'base', 'contraintes', 'delivre', 'valeurDelivree', 'porteeSurIdentite']) || r.statut !== 'relue' || typeof r.base !== 'string') refus('relecture hors contrat');
  if (!Array.isArray(r.contraintes) || !r.contraintes.every((c) => typeof c === 'string') || typeof r.delivre !== 'string' || typeof r.porteeSurIdentite !== 'string') refus('relecture hors contrat');
  if (!(r.valeurDelivree === null || typeof r.valeurDelivree === 'string')) refus('relecture hors contrat');
}
function verifierApres(a, nature) {
  if (nature !== 'confirmee') { if (!memesCles(a, ['ecritureCognitive']) || a.ecritureCognitive !== 'aucune') refus('« après » hors contrat'); return; }
  if (memesCles(a, ['manifestation', 'faitResultant', 'resultatActuel', 'absence'])) {
    if (a.manifestation !== null || a.faitResultant !== null || a.resultatActuel !== false || a.absence !== 'manifestation-introuvable') refus('« après » hors contrat');
    return;
  }
  if (!memesCles(a, ['manifestation', 'faitResultant', 'resultatActuel']) || typeof a.resultatActuel !== 'boolean' || !estFait(a.faitResultant)) refus('« après » hors contrat');
  const m = a.manifestation;
  if (!memesCles(m, ['idMessage', 'fait', 'voie']) || !estChaine(m.idMessage) || !estFait(m.fait) || !memesCles(m.voie, ['nom', 'idReponseAttendue']) || typeof m.voie.nom !== 'string' || !estChaine(m.voie.idReponseAttendue)) refus('manifestation hors contrat');
}
function verifier(x) {
  if (!memesCles(x, ['acte', 'situation', 'issue', 'apres'])) refus('expérience hors contrat N3b-0');
  const { acte, situation, issue } = x;
  if (!memesCles(acte, ['idReponseAttendue', 'idMessage', 'ancien', 'nouveau']) || !estChaine(acte.idReponseAttendue) || !estChaine(acte.idMessage) || !estFait(acte.ancien) || !estFait(acte.nouveau)) refus('acte hors contrat');
  if (!memesCles(situation, ['historique', 'relecture'])) refus('situation hors contrat');
  const h = situation.historique;
  if (!memesCles(h, ['question', 'attendu', 'reaction', 'reponseProduite', 'absences']) || !estChaineOuNull(h.question) || !estChaineOuNull(h.attendu)) refus('historique hors contrat');
  if (!Array.isArray(h.absences) || !h.absences.every((a) => ABSENCES.includes(a))) refus('absences hors contrat');
  verifierReaction(h.reaction);
  verifierReponseProduite(h.reponseProduite);
  verifierRelecture(situation.relecture);
  if (!estObjet(issue) || !ISSUES.includes(issue.nature)) refus('issue hors contrat');
  if (issue.nature === 'perimee' ? !(memesCles(issue, ['nature', 'raison']) && typeof issue.raison === 'string') : !memesCles(issue, ['nature'])) refus('issue hors contrat');
  verifierApres(x.apres, issue.nature);
}

// ---- Identités : clés techniques, retirées de la description confrontée ----
function identites(x) {
  const ids = [{ chemin: ['acte', 'idReponseAttendue'], valeur: x.acte.idReponseAttendue }, { chemin: ['acte', 'idMessage'], valeur: x.acte.idMessage }];
  const h = x.situation.historique;
  if (h.reaction) {
    ids.push({ chemin: ['situation', 'historique', 'reaction', 'idMessage'], valeur: h.reaction.idMessage });
    const [cle] = Object.keys(h.reaction.cible);
    ids.push({ chemin: ['situation', 'historique', 'reaction', 'cible', cle], valeur: h.reaction.cible[cle] });
  }
  if (h.reponseProduite) {
    const cle = Object.hasOwn(h.reponseProduite, 'idTrace') ? 'idTrace' : 'idReponseLocale';
    ids.push({ chemin: ['situation', 'historique', 'reponseProduite', cle], valeur: h.reponseProduite[cle] });
  }
  if (x.apres.manifestation) {
    ids.push({ chemin: ['apres', 'manifestation', 'idMessage'], valeur: x.apres.manifestation.idMessage });
    ids.push({ chemin: ['apres', 'manifestation', 'voie', 'idReponseAttendue'], valeur: x.apres.manifestation.voie.idReponseAttendue });
  }
  return ids;
}
const sans = (o, cles) => Object.fromEntries(Object.entries(o).filter(([c]) => !cles.includes(c)));
const copieProfonde = (v) => (Array.isArray(v) ? v.map(copieProfonde) : estObjet(v) ? Object.fromEntries(Object.entries(v).map(([c, w]) => [c, copieProfonde(w)])) : v);

// ---- Les deux compartiments, aux chemins de la description N3b-0 ----
function compartiments(x) {
  const c = copieProfonde(x);
  const h = c.situation.historique;
  const historique = { acte: { ancien: c.acte.ancien, nouveau: c.acte.nouveau }, situation: { historique: { question: h.question, attendu: h.attendu, absences: h.absences } } };
  const actuel = { situation: { relecture: c.situation.relecture } };
  // La réaction n'a que des identités (E, cible) : son emplacement reste (vide une fois les identités retirées) pour que son ABSENCE d'un
  // côté soit un indéterminable, et non une donnée propre.
  historique.situation.historique.reaction = h.reaction === null ? null : {};
  // voie non persistée (provenance absente) : donnée absente, jamais une égalité.
  if (h.reponseProduite !== null) historique.situation.historique.reponseProduite = { ...sans(h.reponseProduite, ['idReponseLocale', 'idTrace']), voie: h.reponseProduite.voie === undefined ? null : h.reponseProduite.voie };
  else historique.situation.historique.reponseProduite = null;
  if (c.issue.nature === 'ouverte') actuel.issue = c.issue; else historique.issue = c.issue;
  if (c.issue.nature === 'confirmee') {
    const a = c.apres;
    historique.apres = a.manifestation === null ? { manifestation: null, faitResultant: null, absence: a.absence } : { manifestation: { fait: a.manifestation.fait, voie: { nom: a.manifestation.voie.nom } }, faitResultant: a.faitResultant };
    if (a.manifestation !== null) actuel.apres = { resultatActuel: a.resultatActuel };
  } else historique.apres = c.apres;
  return { historique, actuel };
}

// ---- Mise en regard, emplacement par emplacement ----
function egaux(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => egaux(v, b[i]));
  if (estObjet(a) || estObjet(b)) {
    if (!estObjet(a) || !estObjet(b)) return false;
    const ka = Object.keys(a); const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && egaux(a[k], b[k]));
  }
  return a === b;
}
function feuillesPropres(v, chemin, sortie) {
  if (v === null) { sortie.push({ chemin, absente: true }); return; }
  if (estObjet(v)) { for (const k of Object.keys(v).sort()) feuillesPropres(v[k], [...chemin, k], sortie); return; }
  sortie.push({ chemin, valeur: copieProfonde(v) });
}
function mettreEnRegard(a, b, chemin, r) {
  if (a === null || b === null) { r.indeterminables.push({ chemin, absente: a === null && b === null ? 'les-deux' : a === null ? 'premiere' : 'seconde' }); return; }
  if (estObjet(a) && estObjet(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const c = [...chemin, k];
      if (!Object.hasOwn(b, k)) feuillesPropres(a[k], c, r.propres.premiere);
      else if (!Object.hasOwn(a, k)) feuillesPropres(b[k], c, r.propres.seconde);
      else mettreEnRegard(a[k], b[k], c, r);
    }
    return;
  }
  if (egaux(a, b)) r.communs.push({ chemin, valeur: copieProfonde(a) });
  else r.differents.push({ chemin, premiere: copieProfonde(a), seconde: copieProfonde(b) });
}
const regard = (a, b) => { const r = { communs: [], differents: [], propres: { premiere: [], seconde: [] }, indeterminables: [] }; mettreEnRegard(a, b, [], r); return r; };

export function confronterExperiencesSituees(x1, x2) {
  verifier(x1); verifier(x2);
  if (x1.acte.idReponseAttendue === x2.acte.idReponseAttendue) refus('même expérience (même Q) des deux côtés');
  const c1 = compartiments(x1); const c2 = compartiments(x2);
  return {
    base: 'description-N3b-0',
    identites: [identites(x1), identites(x2)],
    historique: regard(c1.historique, c2.historique),
    actuel: regard(c1.actuel, c2.actuel),
  };
}

export function confrontationsExperiencesSituees(experiences) {
  if (!Array.isArray(experiences)) refus('liste d\'expériences attendue');
  const paires = [];
  for (let i = 0; i < experiences.length; i += 1) {
    for (let j = i + 1; j < experiences.length; j += 1) {
      const [x1, x2] = [experiences[i], experiences[j]];
      verifier(x1); verifier(x2);
      if (x1.acte.idReponseAttendue === x2.acte.idReponseAttendue) paires.push({ identites: [identites(x1), identites(x2)], refus: 'meme-experience' });
      else paires.push(confronterExperiencesSituees(x1, x2));
    }
  }
  return paires;
}
// === FIN_LANGAGE_CONFRONTATIONS_SITUEES ===
