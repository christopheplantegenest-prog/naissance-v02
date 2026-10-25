// === DEBUT_ESSAIS_PORTE ===
// v0.66.8 — ATELIER 2, L3 (GO « ATELIER 2 — GO CONSTRUCTION L3 », 25/10/2026) : PORTE D'ESSAI des capacités expérimentales. Mécanisme
// technique, non cognitif ; protégé (app/essais/) : l'Atelier autonome ne peut pas le modifier. Chargé seulement si une capacité est active
// (ou à l'ouverture de l'écran « Capacités en essai ») : sinon rien de la porte ne s'exécute, l'application est exactement l'ancienne.
//
// Ce qu'une capacité en essai PEUT faire : lire une COPIE des tables qu'elle déclare, calculer de façon synchrone dans un bac isolé (Worker
// verrouillé, terminé après chaque exécution), et rendre des lignes que la porte AJOUTE, avec leur provenance, dans la zone d'essai.
// Ce qu'elle NE PEUT PAS faire : écrire dans la base de Naissance, changer une réponse ou une décision existante, garder un effet en vie après
// son exécution (minuterie, promesse, réseau), toucher au stockage, au DOM ou à l'état de l'application.
// Détection et coupure AUTOMATIQUE (première anomalie, seuil strict : l'essai n'est pas acquis) : exception, délai dépassé, résultat
// asynchrone ou de forme invalide, invariant violé (avant écriture ou à la relecture), écriture refusée, bac non verrouillable, nouvelle
// version dont le code est refusé ; sentinelles de démarrage et d'exécution (sentinelle.js). Coupure manuelle à tout instant.
// Couper : inscrit la coupure (synchrone) PUIS termine le bac en cours ; un résultat qui arrive après est écarté. Seule une écriture DÉJÀ
// ENGAGÉE dans sa transaction se termine (tout ou rien) : ses lignes restent, marquées par leur provenance, et le journal le dit.
// v0.66.9 — ATELIER 2, L4 : catalogue = figé (témoin) + catalogue LIVRÉ (app/capacites-essai/, classe E du robot), lu à la création de la
// porte de l'application ; une capacité active absente du catalogue de cette version (retirée, classe R) est coupée à la création de la
// porte ; tables : liste des tables lisibles (fournie par l'application), contrôlée à la vérification.
import { CATALOGUE, LIGNES_MAX, RE_CLE, DOSSIER_CAPACITES, FICHIER_CATALOGUE, declaration, declarationsLivrees, validerDeclaration, lireRegistre, ecrireRegistre, etatDe, essaisActifs, activer as activerR, couper as couperR,
  journaliser, noterExecution, noterVerification, violationInvariants } from './registre-essais.js';
import { marquerExecution, leverExecution } from './sentinelle.js';
import { ligneValide, ouvrirZone, zoneMemoireVive } from './zone.js';
import { analyserModule } from './analyse.js';

export const TAILLE_DONNEES_MAX = 2000;
export const LIGNES_LUES_MAX = 5000;
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const canon = (v) => JSON.stringify(v, (k, x) => (objetSimple(x) ? Object.fromEntries(Object.keys(x).sort().map((c) => [c, x[c]])) : x));

const MOTIFS = {
  exception: (r) => `exception : ${r.message}`,
  delai: () => 'délai dépassé (bac terminé)',
  asynchrone: () => 'résultat asynchrone refusé (rien ne doit survivre à l\'exécution)',
  forme: (r) => `résultat invalide : ${r.message}`,
  verrou: (r) => `bac non verrouillable (${(r.restants || []).join(', ')}) : isolation impossible`,
  erreur: (r) => `bac en erreur : ${r.message}`,
};
export function motifReponse(r) {
  if (!objetSimple(r) || typeof r.type !== 'string') return 'réponse du bac illisible';
  return (MOTIFS[r.type] || (() => `réponse du bac inattendue (${r.type})`))(r);
}

// Sortie du bac -> { lignes: [{ cle, donnees }] } ou { motif }.
export function validerSortie(sortie, decl) {
  if (!objetSimple(sortie) || !Array.isArray(sortie.lignes)) return { motif: 'résultat invalide : { lignes: [...] } attendu' };
  if (sortie.lignes.length > Math.min(decl.maxLignes, LIGNES_MAX)) return { motif: `résultat invalide : ${sortie.lignes.length} lignes (au plus ${decl.maxLignes})` };
  const cles = new Set();
  const lignes = [];
  for (const l of sortie.lignes) {
    if (!objetSimple(l) || typeof l.cle !== 'string' || !RE_CLE.test(l.cle)) return { motif: 'résultat invalide : clé de ligne refusée' };
    if (cles.has(l.cle)) return { motif: `résultat invalide : clé en double (${l.cle})` };
    cles.add(l.cle);
    if (!objetSimple(l.donnees)) return { motif: 'résultat invalide : données d\'une ligne non objet' };
    let texte;
    try { texte = canon(l.donnees); } catch { return { motif: 'résultat invalide : données non sérialisables' }; }
    if (texte.length > TAILLE_DONNEES_MAX) return { motif: `résultat invalide : données trop longues (${texte.length} > ${TAILLE_DONNEES_MAX})` };
    // Seule la forme JSON est conservée (une valeur non représentable, comme une date ou une fonction, n'entre pas telle quelle).
    const relu = JSON.parse(texte);
    if (!objetSimple(relu)) return { motif: 'résultat invalide : données hors JSON' };
    lignes.push({ cle: l.cle, donnees: relu });
  }
  return { lignes };
}

// Dépendances injectées (tests) ; creerPorteApplication fournit celles de l'application.
//   stockage : localStorage ; obtenirZone() -> Promise<zone> ; lireTable(nom) -> Promise<lignes> (LECTURE seule de la base de Naissance) ;
//   bac : { disponible, executer({ module, entree, delaiMs }) -> { promesse, annuler } } ; analyser(decl) -> Promise<{ refus }> ;
//   maintenant() -> ISO ; planifier(fn) : exécution différée (après le tour en cours).
export function creerPorte({ stockage, obtenirZone, lireTable, version, bac, analyser, maintenant = () => new Date().toISOString(), planifier = (fn) => setTimeout(fn, 0), catalogue = CATALOGUE, tables = null }) {
  let file = Promise.resolve();
  let compteur = 0;
  const enCours = new Map();
  const engagees = new Set();
  let zoneP = null;
  const zone = () => { if (!zoneP) zoneP = Promise.resolve().then(obtenirZone).catch(() => zoneMemoireVive({ persistante: false })); return zoneP; };
  const lire = () => lireRegistre(stockage);
  const ecrire = (r) => ecrireRegistre(r, stockage);
  const couperAuto = (id, motif) => couper(id, motif, true);

  function couper(id, motif = 'coupée à la main', auto = false) {
    const r = lire();
    if (etatDe(r, id) !== 'actif') return false;
    ecrire(couperR(r, id, maintenant(), motif, auto));
    const t = enCours.get(id);
    if (t) { try { t.annuler(); } catch { /* bac déjà fini */ } }
    return true;
  }

  async function verifier(id) {
    const decl = declaration(id, catalogue);
    if (!decl) return { ok: false, motif: 'capacité inconnue du registre' };
    const refusDecl = validerDeclaration(decl, tables);
    if (refusDecl) return { ok: false, motif: `déclaration refusée : ${refusDecl}` };
    if (!bac || !bac.disponible) return { ok: false, motif: 'bac isolé indisponible sur cet appareil (Worker) : isolation impossible' };
    const z = await zone();
    if (!z.persistante) return { ok: false, motif: 'zone d\'essai indisponible (IndexedDB) : la provenance ne pourrait pas être conservée' };
    let a;
    try { a = await analyser(decl); } catch { a = { refus: ['analyse impossible'] }; }
    if (!a || !Array.isArray(a.refus)) return { ok: false, motif: 'analyse impossible' };
    if (a.refus.length) return { ok: false, motif: `code refusé : ${a.refus.slice(0, 5).join(' ; ')}` };
    return { ok: true, motif: null };
  }

  async function activer(id) {
    if (etatDe(lire(), id) === 'actif') return { ok: true, motif: null };
    const v = await verifier(id);
    if (!v.ok) { ecrire(journaliser(lire(), maintenant(), id, 'refus', v.motif)); return v; }
    ecrire(activerR(lire(), id, maintenant(), version));
    return v;
  }

  async function executerUne(id, declencheur, epreuve = null) {
    const decl = declaration(id, catalogue);
    let r = lire();
    if (!decl || etatDe(r, id) !== 'actif' || !decl.declencheurs.includes(declencheur)) return { statut: 'ignore' };
    if (r.essais[id].verifie !== version) {
      const v = await verifier(id);
      if (!v.ok) { couperAuto(id, `version ${version} refusée : ${v.motif}`); return { statut: 'coupe', motif: v.motif }; }
      ecrire(noterVerification(lire(), id, version));
    }
    const z = await zone();
    const lues = {};
    for (const t of decl.lit) {
      const lignes = await lireTable(t);
      if (!Array.isArray(lignes) || lignes.length > LIGNES_LUES_MAX) {
        ecrire(journaliser(lire(), maintenant(), id, 'saut', `lecture de ${t} impossible ou trop grande : exécution sautée`));
        return { statut: 'saute' };
      }
      lues[t] = structuredClone(lignes);
    }
    const miennes = await z.lire(id);
    const quand = maintenant();
    compteur += 1;
    const execution = `${id}/${quand}/${compteur}`;
    const entree = { lues, miennes: structuredClone(miennes), epreuve: decl.epreuves && decl.epreuves.includes(epreuve) ? epreuve : null, contexte: { version, horodatage: quand, declencheur } };
    if (etatDe(lire(), id) !== 'actif') return { statut: 'ecarte' };
    marquerExecution(stockage, id, quand);
    let reponse;
    try {
      const tache = bac.executer({ module: decl.module, entree, delaiMs: decl.delaiMs });
      enCours.set(id, tache);
      reponse = await tache.promesse;
    } catch (e) {
      reponse = { type: 'erreur', message: String(e && e.message ? e.message : e).slice(0, 160) };
    } finally {
      enCours.delete(id);
      leverExecution(stockage);
    }
    if (etatDe(lire(), id) !== 'actif') {
      ecrire(journaliser(lire(), maintenant(), id, 'ecarte', 'résultat écarté : capacité coupée pendant son exécution (rien n\'est écrit)'));
      return { statut: 'ecarte' };
    }
    if (!objetSimple(reponse) || reponse.type !== 'resultat') { const motif = motifReponse(reponse); couperAuto(id, motif); return { statut: 'coupe', motif }; }
    const v = validerSortie(reponse.sortie, decl);
    if (v.motif) { couperAuto(id, v.motif); return { statut: 'coupe', motif: v.motif }; }
    const nouvelles = v.lignes.map(({ cle, donnees }) => ({ id: `${id}/${cle}`, essai: id, cle, version, provenance: `${id}@${version}`, horodatage: quand, declencheur, execution, donnees }));
    r = lire();
    const violation = violationInvariants(decl, r.essais[id], miennes, nouvelles);
    if (violation) { couperAuto(id, violation); return { statut: 'coupe', motif: violation }; }
    // Dernier contrôle, synchrone, juste avant d'engager l'écriture.
    if (etatDe(lire(), id) !== 'actif') {
      ecrire(journaliser(lire(), maintenant(), id, 'ecarte', 'résultat écarté : capacité coupée avant l\'écriture (rien n\'est écrit)'));
      return { statut: 'ecarte' };
    }
    engagees.add(id);
    try {
      await z.ajouter(nouvelles);
    } catch (e) {
      const motif = `écriture refusée : ${String(e && e.message ? e.message : e).slice(0, 160)}`;
      couperAuto(id, motif);
      return { statut: 'coupe', motif };
    } finally {
      engagees.delete(id);
    }
    r = noterExecution(lire(), id, quand, nouvelles.length);
    if (etatDe(r, id) !== 'actif' && nouvelles.length) r = journaliser(r, maintenant(), id, 'ecriture-engagee', `${nouvelles.length} ligne(s) déjà engagée(s) avant la coupure : conservées, marquées ${id}@${version}`);
    ecrire(r);
    return { statut: 'ecrit', lignes: nouvelles.length };
  }

  // Capacités actives que ce catalogue ne connaît plus (retirées) : coupées dès la création de la porte, rien d'elles ne s'exécute.
  for (const id of essaisActifs(lire())) if (!declaration(id, catalogue)) couperAuto(id, 'capacité absente du catalogue de cette version (retirée)');

  const enFile = (fn) => { const p = file.then(fn, fn); file = p.catch(() => {}); return p; };
  // Une exécution qui lève dans la porte elle-même coupe la capacité (prudence) ; rien ne remonte à l'appelant.
  const executerSur = (id, declencheur, epreuve) => enFile(() => executerUne(id, declencheur, epreuve).catch((e) => {
    const motif = `défaut de la porte : ${String(e && e.message ? e.message : e).slice(0, 160)}`;
    couperAuto(id, motif);
    return { statut: 'coupe', motif };
  }));

  return {
    version,
    catalogue,
    liste() {
      const r = lire();
      return catalogue.map((d) => ({ declaration: d, etat: etatDe(r, d.id), detail: r.essais[d.id] || null }));
    },
    journal: () => lire().journal,
    verifier,
    activer,
    couper: (id, motif) => couper(id, motif, false),
    // Après un tour : AUCUN effet si rien n'est actif ; sinon les exécutions partent APRÈS le tour (planifier), une à la fois.
    apresTour() {
      try {
        const actifs = essaisActifs(lire(), catalogue);
        if (!actifs.length) return false;
        planifier(() => { for (const id of actifs) executerSur(id, 'apres-tour'); });
        return true;
      } catch {
        return false;
      }
    },
    executerMaintenant: (id, { epreuve = null } = {}) => executerSur(id, 'manuel', epreuve),
    async lignes(id) { return (await zone()).lire(id); },
    async relire(id) {
      const decl = declaration(id, catalogue);
      const r = lire();
      if (!decl || etatDe(r, id) !== 'actif') return { statut: 'ignore' };
      const lignes = await (await zone()).lire(id);
      const invalide = lignes.find((l) => !ligneValide(l) || l.essai !== id);
      const motif = invalide ? `ligne de zone invalide à la relecture (${invalide.id})` : violationInvariants(decl, r.essais[id], lignes, []);
      if (motif) { couperAuto(id, `relecture : ${motif}`); return { statut: 'coupe', motif }; }
      return { statut: 'conforme', lignes: lignes.length };
    },
    async relireTout() { const sorties = {}; for (const id of essaisActifs(lire(), catalogue)) sorties[id] = await this.relire(id); return sorties; },
    attendre: () => file,
    enCours: (id) => enCours.has(id),
    engagee: (id) => engagees.has(id),
    zone,
  };
}

// ------------------------------------------------------------------------------------------------ application réelle
export function bacWorker({ urlBac = new URL('./bac.js', import.meta.url), Fabrique = globalThis.Worker } = {}) {
  return {
    disponible: typeof Fabrique === 'function',
    executer({ module, entree, delaiMs }) {
      let w = null;
      let minuterie = null;
      let fini = null;
      let fait = false;
      const promesse = new Promise((ok) => {
        fini = (x) => {
          if (fait) return;
          fait = true;
          clearTimeout(minuterie);
          try { if (w) w.terminate(); } catch { /* déjà terminé */ }
          ok(x);
        };
      });
      try { w = new Fabrique(urlBac, { type: 'module' }); } catch (e) { fini({ type: 'erreur', message: `bac impossible : ${e && e.message ? e.message : e}` }); return { promesse, annuler() {} }; }
      w.onmessage = (ev) => fini(ev && ev.data && typeof ev.data.type === 'string' ? ev.data : { type: 'forme', message: 'réponse du bac illisible' });
      w.onerror = (ev) => { try { ev.preventDefault(); } catch { /* sans effet */ } fini({ type: 'erreur', message: (ev && ev.message) || 'erreur du bac' }); };
      w.onmessageerror = () => fini({ type: 'forme', message: 'réponse du bac non transmissible' });
      minuterie = setTimeout(() => fini({ type: 'delai' }), delaiMs);
      try { w.postMessage({ module, entree }); } catch (e) { fini({ type: 'forme', message: `entrée non transmissible : ${e && e.message ? e.message : e}` }); }
      return { promesse, annuler: () => fini({ type: 'annule' }) };
    },
  };
}

export function analyseurApplication({ base = new URL('./', import.meta.url).href, racine = new URL('../', import.meta.url).href, fetchFn = (...a) => globalThis.fetch(...a) } = {}) {
  const lireSource = async (u) => {
    const r = await fetchFn(u, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  };
  return (decl) => analyserModule(new URL(decl.module, base).href, { racine, lireSource });
}

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
// Catalogue livré : app/capacites-essai/catalogue.json (absent = aucune capacité livrée). -> { declarations, refus }
export async function lireCatalogueLivre({ url = new URL(`${DOSSIER_CAPACITES}${FICHIER_CATALOGUE}`, import.meta.url).href, fetchFn = (...a) => globalThis.fetch(...a), tables = null } = {}) {
  let r;
  try { r = await fetchFn(url, { cache: 'no-store' }); } catch { return { declarations: [], refus: [] }; }
  if (!r || r.status === 404) return { declarations: [], refus: [] };
  if (!r.ok) return { declarations: [], refus: [`catalogue livré illisible (HTTP ${r.status})`] };
  let objet;
  try { objet = JSON.parse(await r.text()); } catch { return { declarations: [], refus: ['catalogue livré illisible (JSON)'] }; }
  return declarationsLivrees(objet, { tables });
}
export async function creerPorteApplication({ version, lireTable, tables = null, stockage = stockageParDefaut(), maintenant = () => new Date().toISOString() }) {
  const livre = await lireCatalogueLivre({ tables });
  if (livre.refus.length) ecrireRegistre(journaliser(lireRegistre(stockage), maintenant(), 'catalogue', 'refus', livre.refus.slice(0, 5).join(' ; ')), stockage);
  return creerPorte({ stockage, obtenirZone: () => ouvrirZone(), lireTable, version, bac: bacWorker(), analyser: analyseurApplication(), catalogue: [...CATALOGUE, ...livre.declarations], tables, maintenant });
}
// === FIN_ESSAIS_PORTE ===
