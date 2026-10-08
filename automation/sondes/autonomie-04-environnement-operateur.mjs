// SONDE AUTONOMIE 04 (expérience, hors tests) — l'environnement comme opérateur vécu : sept environnements, même scénario, provocation extérieure visible (harnais). Lancer : node automation/sondes/autonomie-04-environnement-operateur.mjs
import assert from 'node:assert/strict';
import { projeterEnvironnements } from '../../app/langage/episodes-environnement.js';
import { emettreProduction } from '../../app/langage/emission.js';
import { consequencesDesEmissions } from '../../app/langage/consequences-emissions.js';
import { episodesDeTransformation } from '../../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../../app/langage/familles-episodes.js';
import { constatsParChemin } from '../../app/langage/constats-par-chemin.js';
import { contextesProspectifs } from '../../app/langage/contexte-prospectif.js';
import { attentesDuContexteProspectif } from '../../app/langage/attentes-prospectives.js';
import { issueDeLAttenteProspective } from '../../app/langage/issue-attente-prospective.js';
import { memesCouvertures } from '../../app/langage/couverture-occurrences.js';
import { applicationsSollicitables } from '../../app/langage/applications-sollicitables.js';
import { DESCRIPTIONS_OPERATIONS } from '../../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../../app/langage/pont.js';
import { observerPossibilites } from '../../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerReception } from '../../app/langage/connaissances.js';

const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const au = (cpc, chemin) => cpc.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
const texteDe = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
let compteurIds = 0;
// Un monde : la boucle réelle + un environnement + une PROVOCATION EXTÉRIEURE visible (le harnais émet, à chaque tour, la dernière production mécanique).
function monde(nom, reagir) {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const boite = []; const tours = []; const contextes = []; const attentes = []; const journal = [];
  let nEmissions = 0; const environnement = { nom, remettre: ({ emission, valeur }) => { for (const texte of reagir(valeur, tours.length, nEmissions)) boite.push({ texte, idEmission: emission.id }); nEmissions += 1; } };
  const photo = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), emissions: await magasin.lireTout('emissions'), receptions: await magasin.lireTout('receptions') });
  // le passé « vu comme opérateur » : exécutions réelles + projection des conséquences ; catalogue + descriptions des environnements
  const vecu = async () => { const p = await photo(); const proj = projeterEnvironnements(p.emissions, p.receptions, p.valeurs); return { ...p, executionsVues: [...p.executions, ...proj.executions], descriptionsVues: [...DESCRIPTIONS_OPERATIONS, ...proj.descriptions] }; };
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    let idMessage = null;
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async (m) => { idMessage = m.id; return { texte: 'ok' }; }, nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    await enregistrerReception(magasin, { environnement: nom, idDonnee: idMessage, idEmission });
    tours.push({ texte, s, idMessage });
    return s;
  }
  return {
    nom, tours, contextes, attentes, journal, magasin, photo, vecu,
    vivre: async (texte) => tour(texte),
    recevoirBoite: async () => { const lot = boite.splice(0); for (const { texte, idEmission } of lot) await tour(texte, idEmission); return lot.length; },
    // ACTION PROVOQUÉE (provenance : 'harnais', jamais Naissance) : émettre la production donnée ; AVANT l'issue, écrire contexte(s) prospectif(s) et attentes « au fil de l'eau »
    // PROVOCATION EXTÉRIEURE (harnais) : obtenir une production CHAÎNE neuve pour ce tour : symbolesDeChaine(message) puis composerCollection(…) sollicités
    produireChaine: async () => {
      const t = tours.at(-1); const { observation, univers } = t.s; const { executerApplicationSollicitee } = await import('../../app/langage/execution-sollicitee.js');
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); if (r.statut !== 'executee') throw new Error(`${operation} : ${r.statut}`); return r.execution; };
      const faits = await ex2();
      // 1. une collection de symboles non encore composée, PRÉSENTE dans l'observation de ce tour -> composerCollection (chaîne neuve)
      const R = faits.find((e) => e.operation === 'symbolesDeChaine' && observation.donneesExaminees.includes(e.id) && !faits.some((f) => f.operation === 'composerCollection' && f.liaisons[0].donnee === e.id));
      let C = null; if (R) C = await soll('composerCollection', [{ entree: 'elements', donnee: R.id }]);
      // 2. préparer le tour suivant : symbolesDeChaine sur le message de ce tour
      if (!faits.some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === t.idMessage)) { try { await soll('symbolesDeChaine', [{ entree: 'chaine', donnee: t.idMessage }]); } catch { /* déjà déterminée mécaniquement ou impossible */ } }
      return C;
    },
    emettre: async (idExecution) => {
      const v = await vecu();
      const application = { operation: `environnement:${nom}`, liaisons: [{ entree: 'emis', donnee: idExecution }] };
      const avant = contextesProspectifs(application, v.valeurs, v.executionsVues, v.descriptionsVues);
      const r = await emettreProduction({ idExecution, idObservation: tours.at(-1).s.observation.id }, { magasin, environnement });
      const designation = { id: r.emission.id, horodatage: r.emission.horodatage };
      const lignes = avant.map((c, i) => ({ id: `${r.emission.id}/c${i}`, horodatage: r.emission.horodatage, idDesignation: r.emission.id, ...c }));
      contextes.push(...lignes);
      for (const c of lignes) { try { for (const a of attentesDuContexteProspectif(c, designation, contextes, v.valeurs, v.executionsVues, v.descriptionsVues)) attentes.push({ id: `${c.id}/a${attentes.length}`, horodatage: r.emission.horodatage, ...a }); } catch (e) { journal.push({ tour: tours.length, refus: e.message.slice(0, 90) }); } }
      journal.push({ tour: tours.length, idExecution, emission: r.emission.id, provenance: 'harnais', contextes: lignes.length, attentes: attentes.filter((a) => a.idDesignation === r.emission.id).length });
      return r;
    },
  };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const ENVS = {
  echo: (v) => [texteDe(v)],
  inversion: (v) => [[...texteDe(v)].reverse().join('')],
  constante: () => ['ok'],
  silence: () => [],
  capricieux: (v, t, n) => (n < 3 ? [texteDe(v)] : [[...texteDe(v)].reverse().join('')]),
  intermittent: (v, t, n) => (n % 2 === 0 ? [texteDe(v)] : []),
  double: (v) => [texteDe(v), `${texteDe(v)} !`],
};
// vivre : à chaque tour, le harnais émet la production mécanique la plus récente, puis l'environnement répond (ou non) au tour suivant (les réponses deviennent des tours)
async function vivreAvecProvocation(nom) {
  const w = monde(nom, ENVS[nom]);
  for (const texte of SCENARIO) {
    await w.vivre(texte);
    const nouvelle = await w.produireChaine();
    if (nouvelle) await w.emettre(nouvelle.id);
    await w.recevoirBoite();
  }
  return w;
}
const resume = {};
for (const nom of Object.keys(ENVS)) {
  const w = await vivreAvecProvocation(nom);
  const v = await w.vecu();
  const cons = consequencesDesEmissions(v.emissions, v.receptions);
  const { episodes } = episodesDeTransformation(v.valeurs, v.executionsVues, v.descriptionsVues);
  const envEp = episodes.filter((e) => e.chemin.at(-1).operation === `environnement:${nom}`);
  const rel = envEp.reduce((c, e) => { c[e.relationValeur] = (c[e.relationValeur] ?? 0) + 1; return c; }, {});
  const { familles } = famillesDEpisodes(envEp);
  // attentes formées (avant l'issue) et leurs issues
  const issues = []; let refusIssues = 0; for (const a of w.attentes) { try { issues.push(issueDeLAttenteProspective(a, w.contextes.find((c) => c.id === a.idContexte), v.valeurs, v.executionsVues, v.descriptionsVues)); } catch { refusIssues += 1; } }
  const stat = issues.reduce((c, i) => { const k = i.issue ? i.statut : 'sansIssue'; c[k] = (c[k] ?? 0) + 1; return c; }, {});
  const parChemin = {}; for (const i of issues) { const k = `${i.chemin.join('.')}=${i.constat.valeur ?? '{' + i.constat.type + '}'}`; parChemin[k] = (parChemin[k] ?? 0) + 1; }
  // constats sur la famille directe (structure à une étape) : ce qui est constant
  const directe = familles.find((f) => f.structure.length === 1);
  let constants = [];
  if (directe) { const cpc = constatsParChemin(directe.episodes.map((e) => ({ chemin: [e.depart, e.arrivee], contenu: e }))); constants = cpc.chemins.filter((c) => c.constats.length === 1 && memesCouvertures(c.constats[0].couverture, cpc.universelle)).map((c) => `${c.chemin.join('.')}=${c.constats[0].valeur ?? '{' + c.constats[0].type + '}'}`).filter((k) => !/execution|vers|arrivee|depart$/.test(k.split('=')[0]) || k.startsWith('valeurs.arrivee')); }
  const directs = envEp.filter((e) => e.chemin.length === 1); const relD = directs.reduce((c, e) => { c[e.relationValeur] = (c[e.relationValeur] ?? 0) + 1; return c; }, {});
  const issuesD = issues.filter((i) => i.structure.length === 1); const relAtt = issuesD.filter((i) => i.chemin.join('.') === 'relationValeur').map((i) => `${i.constat.valeur}→${i.issue ? i.statut + '(' + (i.reel ? i.reel.valeur : '') + ')' : 'sans'}`); const valAtt = issuesD.filter((i) => i.chemin.join('.') === 'valeurs.arrivee').map((i) => `${String(i.constat.valeur).slice(0, 12)}→${i.issue ? i.statut : 'sans'}`);
  resume[nom] = { directs: directs.length, relationsDirectes: relD, attentesDirectes: issuesD.length, relationValeurAttendue: relAtt, valeursArriveeAttendue: valAtt, emissions: v.emissions.length, consequences: cons.emissions.map((e) => e.consequences.length).join(''), episodes: envEp.length, relations: rel, familles: familles.length, attentes: w.attentes.length, issues: stat, constants: constants.filter((k) => !k.startsWith('chemin') && k !== '={objet}').slice(0, 6), temoinsDirecte: directe ? directe.episodes.length : 0, refusIssues, refusAttentes: w.journal.filter((j) => j.refus).length };
  // comportement : si la description de l'environnement était présentée au calcul des possibilités, qu'est-ce qui serait déterminé ?
  const t = w.tours.at(-1); const obs = await (async () => { const m = magasinMemoireVive(); return observerPossibilites({ id: t.idMessage, texte: t.texte }, { enregistrer: async (d) => ({ id: 'o', ...d }), lireExecutions: async () => v.executionsVues, descriptions: v.descriptionsVues }); })();
  if (obs.statut === 'ecrite') { const s = applicationsSollicitables(obs.observation, v.descriptionsVues, obs.univers); const env = s.applications.filter((a) => a.operation.startsWith('environnement:')); resume[nom].comportement = { determinees: s.applications.length, determineesEnv: env.length, choix: s.choixAFaire.length, envAChoisir: s.choixAFaire.filter((o) => o.startsWith('environnement:')).length, candidatsEnv: obs.observation.possibilites.filter((p) => p.operation.startsWith('environnement:')).length }; } else resume[nom].comportement = obs.statut;
}
for (const [nom, r] of Object.entries(resume)) console.log(nom, JSON.stringify(r));
