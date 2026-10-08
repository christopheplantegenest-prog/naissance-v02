// SONDE AUTONOMIE 05 — d'où peut venir ce qui compte ? Quatre expériences dans le laboratoire 03/04 + rejeu de v0.20. Rien dans le dépôt.
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

import { enregistrerExperience, enregistrerAttenteSiPertinente, confronterJugementEtEnregistrer, examinerVecuEtFormerHypotheses } from '../../app/langage/connaissances.js';
import { LEXIQUE_DEPART } from '../../app/langage/bagage.js';
import { contientGabarit, representerExemple } from '../../app/langage/induction.js';
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

// ---------------------------------------------------------------------------------------------------------------------------- outils de lecture
async function lire(w) {
  const v = await w.vecu();
  const cons = consequencesDesEmissions(v.emissions, v.receptions);
  const issues = [];
  for (const a of w.attentes) { try { issues.push(issueDeLAttenteProspective(a, w.contextes.find((c) => c.id === a.idContexte), v.valeurs, v.executionsVues, v.descriptionsVues)); } catch { /* une issue par acte */ } }
  const t = w.tours.at(-1);
  const obs = await observerPossibilites({ id: t.idMessage, texte: t.texte }, { enregistrer: async (d) => ({ id: 'o', ...d }), lireExecutions: async () => v.executionsVues, descriptions: v.descriptionsVues });
  const s = applicationsSollicitables(obs.observation, v.descriptionsVues, obs.univers);
  return { v, cons, issues, options: { determinees: s.applications.map((a) => a.operation), choix: s.choixAFaire }, empreinte: JSON.stringify({ a: w.attentes.map((x) => [x.chemin, x.constat.type, /-\d{13}-|^message-|^reception-/.test(String(x.constat.valeur)) ? '<id>' : x.constat.valeur]), i: issues.map((x) => [x.statut ?? null, x.reel ? [x.reel.type, /-\d{13}-|^message-|^reception-/.test(String(x.reel.valeur)) ? '<id>' : x.reel.valeur] : null]), o: [s.applications.map((a) => a.operation), s.choixAFaire] }) };
}
// TROIS « CE QUI COMPTE » POSSIBLES, tous RELATIONNELS (aucun scalaire, aucun seuil) — chacun est une DÉCISION DE NOTRE PART, lue par universalité :
//   V0a « le monde a réagi à mes actes »          : toute émission passée a au moins une conséquence déclarée
//   V0b « le monde a fait ce que j'attendais »     : toute attente de relation posée sur l'environnement a été réalisée
//   V0c « le monde m'a rendu ce que j'ai émis »     : toute relation émis/reçu vécue est egale
const V0 = {
  V0a: (L) => L.cons.emissions.length > 0 && L.cons.emissions.every((e) => e.consequences.length > 0),
  V0b: (L) => { const rel = L.issues.filter((i) => i.structure.length === 1 && i.chemin.join('.') === 'relationValeur' && i.issue); return rel.length > 0 && rel.every((i) => i.statut === 'realisee'); },
  V0c: (L) => { const { episodes } = episodesDeTransformation(L.v.valeurs, L.v.executionsVues, L.v.descriptionsVues); const d = episodes.filter((e) => e.chemin.length === 1 && e.chemin[0].operation.startsWith('environnement:')); return d.length > 0 && d.every((e) => e.relationValeur === 'egale'); },
};

console.log('==================== E1. MÊME VÉCU, AUCUNE DIVERGENCE : deux Naissance « écho » identiques');
{
  const a = await lire(await vivreAvecProvocation('echo')); const b = await lire(await vivreAvecProvocation('echo'));
  console.log('empreintes (attentes, issues, options) identiques :', a.empreinte === b.empreinte, '; options :', JSON.stringify(a.options.determinees), a.options.choix.length, 'à choisir');
}

console.log('\n==================== E2/E3. RÉACTIONS DIFFÉRENTES, MÊMES POSSIBILITÉS ; puis trois « ce qui compte » exogènes');
const lectures = {};
for (const nom of ['echo', 'inversion', 'constante', 'silence', 'capricieux', 'intermittent']) lectures[nom] = await lire(await vivreAvecProvocation(nom));
const ref = JSON.stringify(lectures.echo.options.determinees);
for (const [nom, L] of Object.entries(lectures)) console.log(`${nom.padEnd(13)} déterminées ${JSON.stringify(L.options.determinees)} ; à choisir ${L.options.choix.length}${L.options.choix.some((o) => o.startsWith('environnement:')) ? ' (dont émettre)' : ''} ; conséquences ${L.cons.emissions.map((e) => e.consequences.length).join('')} ; attentes de relation ${L.issues.filter((i) => i.structure.length === 1 && i.chemin.join('.') === 'relationValeur').map((i) => (i.constat.valeur[0] + '→' + (i.issue ? i.statut[0] : '∅'))).join(' ')}`);
console.log('--- avec un « ce qui compte » posé par nous (vrai = « émettre vers cet environnement compte » ; faux = rien ne compte) :');
console.log('env'.padEnd(13), Object.keys(V0).join('   '));
for (const [nom, L] of Object.entries(lectures)) console.log(nom.padEnd(13), Object.values(V0).map((f) => String(f(L)).padEnd(5)).join(' '));

console.log('\n==================== E4. REJEU v0.20 : que faisait réellement correct/incorrect ?');
{
  const magasin = magasinMemoireVive();
  const vecu = [['Peux-tu voler ?', 'correct'], ['Peux-tu nager ?', 'correct'], ['Peux-tu mentir ?', 'incorrect'], ['Est-ce que tu sais mentir ?', 'incorrect']];
  for (const [texte, jugement] of vecu) {
    const e = await enregistrerExperience(magasin, { texteRecu: texte, texteRepondu: '…', date: new Date().toISOString(), source: 'sonde' });
    // attentes posées AVANT le jugement par les hypothèses existantes
    const hyps = await magasin.lireTout('hypotheses'); const posees = [];
    const representee = representerExemple(texte, LEXIQUE_DEPART);
    for (const h of hyps) { if (h.attente == null || !h.gabarit || !contientGabarit(representee, h.gabarit)) continue; await enregistrerAttenteSiPertinente(magasin, e.id, h); posees.push(`${h.id}:${h.attente}`); }
    const conf = await confronterJugementEtEnregistrer(magasin, e.id, jugement, LEXIQUE_DEPART);
    const apres = await magasin.lireTout('hypotheses');
    console.log(`« ${texte} » jugé ${jugement} | attentes posées avant : [${posees.join(', ')}] | confrontations : ${conf.map((c) => c.hypotheseId + '=' + c.resultat).join(', ') || '—'} | hypothèses : ${apres.map((h) => h.id + '(' + h.attente + ',' + h.etatHypothese + ')').join(' ')}`);
  }
  console.log('Lecture : le jugement est (1) une INFORMATION ajoutée à l\'expérience (interprétation append-only), (2) la VARIABLE PRÉDITE des hypothèses (attente = jugement univoque, null si divergence), (3) un VERDICT de confrontation (compatible/incompatible → contredite, jamais effacée). Aucune action n\'est choisie à partir de lui : aucune fonction du dépôt ne lit etatHypothese ou le jugement pour agir.');
}
