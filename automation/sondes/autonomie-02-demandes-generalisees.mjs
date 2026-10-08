// SONDE AUTONOMIE 02 (expérience, hors tests) — la demande vécue comme origine de l'action : trois Naissance, trois histoires, même scénario. Lancer : node automation/sondes/autonomie-02-demandes-generalisees.mjs
import assert from 'node:assert/strict';
import { decrireCandidats } from '../../app/langage/description-candidats.js';
import { episodesDeTransformation } from '../../app/langage/episodes-de-transformation.js';
import { DESCRIPTIONS_OPERATIONS } from '../../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../../app/langage/pont.js';
import { observerPossibilites } from '../../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../../app/langage/connaissances.js';

const lien = (entree, donnee) => ({ entree, donnee });
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
// CLASSE DE DESCRIPTION d'une candidate : l'ensemble (trié) des structures prospectives de ses contextes — une description de GENRE, sans identité.
const classe = (description) => JSON.stringify([...new Set(description.contextes.map((c) => sk(c.structure)))].sort());
let compteurIds = 0;
// strategie(tour, candidats) -> liste d'applications à solliciter (le « monde » : Christophe) ; candidats = { operation -> [{ application, cle }] }
async function vivre(scenario, strategie) {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const photo = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), contextes: await magasin.lireTout('contextesProspectifs'), attentes: await magasin.lireTout('attentesProspectives'), designations: await magasin.lireTout('designations') });
  const tours = [];
  for (let i = 0; i < scenario.length; i += 1) {
    const t = scenario[i];
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    const passe = await photo();
    let d;
    try { d = decrireCandidats(s.observation, s.univers, passe, DESCRIPTIONS_OPERATIONS); } catch (e) {
      const m = /« (execution-[^ »]+) », départ « ([^ »]+) »/.exec(e.message);
      const { episodes } = episodesDeTransformation(passe.valeurs, passe.executions, DESCRIPTIONS_OPERATIONS);
      const amb = episodes.filter((x) => x.arrivee === m[1] && x.depart === m[2]);
      console.log(`!! T${i + 1} ancrage .73 ambigu : ${amb.length} épisodes de ${m[2].slice(0, 30)} à ${m[1].slice(0, 30)} :`, amb.map((x) => x.chemin.map((k) => `${k.operation}[${k.execution.split('-').at(-2)}]→${k.vers.split('-').at(-2)}`).join(' > ')).join(' || '));
      d = decrireCandidats(s.observation, s.univers, { ...passe, attentes: [] }, DESCRIPTIONS_OPERATIONS); // sans historiques d'attente
    }
    const candidats = {};
    for (const c of d.choix) candidats[c.operation] = c.combinaisons.map((x) => ({ application: x.application, cle: classe(x.description) }));
    const sollicitees = [];
    for (const application of strategie(i, candidats, passe)) {
      const r = await executerApplicationSollicitee({ observation: s.observation, application, univers: s.univers }, { magasin, table: TABLE_OPERATIONS });
      assert.equal(r.statut, 'executee'); sollicitees.push({ application, cle: candidats[application.operation].find((x) => JSON.stringify(x.application) === JSON.stringify(application)).cle });
    }
    tours.push({ texte: t, candidats, sollicitees });
  }
  return tours;
}
// MÉCANISME GÉNÉRAL ESSAYÉ (règle d'universalité, aucun seuil, aucun nom) : pour une opération à choisir au tour t et une classe K présente parmi
// ses candidates : K est une DEMANDE GÉNÉRALISÉE si, dans TOUTES les situations passées où K était présente parmi les candidates de cette opération,
// une candidate de classe K a été sollicitée par l'extérieur, et si au moins une telle situation existe. Si la demande généralisée désigne UNE
// candidate, l'action est déterminée ; si elle en désigne plusieurs (indifférence), rien n'est déterminé.
function mandats(tours, t) {
  const resultat = [];
  for (const [operation, cands] of Object.entries(tours[t].candidats)) {
    const classes = [...new Set(cands.map((c) => c.cle))];
    for (const K of classes) {
      const situations = tours.slice(0, t).filter((x) => x.candidats[operation]?.some((c) => c.cle === K));
      if (situations.length === 0) { resultat.push({ operation, K, verdict: 'jamais vécue', temoins: 0 }); continue; }
      const toutes = situations.every((x) => x.sollicitees.some((s) => s.application.operation === operation && s.cle === K));
      const aucune = situations.every((x) => !x.sollicitees.some((s) => s.application.operation === operation && s.cle === K));
      const designees = cands.filter((c) => c.cle === K);
      resultat.push({ operation, K, temoins: situations.length, verdict: toutes ? (designees.length === 1 ? `DEMANDE GÉNÉRALISÉE → action déterminée : ${designees[0].application.liaisons.map((l) => l.donnee ?? '[coll]').join('+').slice(0, 40)}` : `demande généralisée mais ${designees.length} candidates indifférentes → rien`) : aucune ? 'jamais sollicitée (présente, jamais demandée)' : 'histoire mélangée → rien' });
    }
  }
  return resultat;
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'];
// Monde A (celui de la sonde) : à chaque tour, symbolesDeChaine sur le message neuf, composerCollection sur la collection neuve.
const mondeA = (i, cands, passe) => {
  const out = [];
  const msgId = passe.valeurs.at(-1).id;
  const sdc = cands.symbolesDeChaine?.find((c) => c.application.liaisons[0].donnee === msgId); if (sdc) out.push(sdc.application);
  const R = passe.executions.filter((e) => e.operation === 'symbolesDeChaine' && !passe.executions.some((f) => f.operation === 'composerCollection' && f.liaisons[0].donnee === e.id));
  for (const r of R) { const cc = cands.composerCollection?.find((c) => c.application.liaisons[0].donnee === r.id); if (cc) out.push(cc.application); }
  return out;
};
// Monde B : à chaque tour, symbolesDeChaine sur une chaîne DÉJÀ TRAVERSÉE (une production, jamais le message neuf) ; jamais composerCollection.
const mondeB = (i, cands) => {
  const anciennes = (cands.symbolesDeChaine ?? []).filter((c) => c.cle !== JSON.stringify(['symbolesDeChaine(chaine)']));
  return anciennes.length ? [anciennes[0].application] : [];
};
// Monde C : personne ne sollicite jamais (le scénario réel).
const mondeC = () => [];
for (const [nom, strategie] of [['A — demande : la chaîne neuve', mondeA], ['B — demande : une chaîne déjà traversée', mondeB], ['C — aucune demande', mondeC]]) {
  const tours = await vivre(SCENARIO, strategie);
  console.log(`\n==================== NAISSANCE ${nom}`);
  tours.forEach((t, i) => console.log(`T${i + 1} sollicité : ${t.sollicitees.map((s) => `${s.application.operation}${s.cle}`).join(' ; ') || '—'}`));
  for (const t of [4, 6]) {
    console.log(`-- au tour T${t + 1}, demandes généralisées lisibles AVANT toute action (opérations symbolesDeChaine / composerCollection seulement) :`);
    for (const m of mandats(tours, t).filter((m) => ['symbolesDeChaine', 'composerCollection'].includes(m.operation))) console.log(`   ${m.operation} classe ${m.K} : témoins ${m.temoins} → ${m.verdict}`);
    const autres = mandats(tours, t).filter((m) => !['symbolesDeChaine', 'composerCollection'].includes(m.operation));
    console.log(`   autres opérations : ${autres.length} classes, verdicts = ${JSON.stringify([...new Set(autres.map((m) => m.verdict.split(' →')[0].split(' :')[0]))])}`);
  }
}
