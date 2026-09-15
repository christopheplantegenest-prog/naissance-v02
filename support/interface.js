// === DEBUT_INTERFACE ===
// NAISSANCE V0.2 - Ecran d'observation (support navigateur).
// Assemble le support et l'organisme. Ne contient aucune logique perceptive.

import { CONFIG } from '../organisme/config.js';
import { Organisme } from '../organisme/organisme.js';
import { ouvrirMicro } from './capture.js';
import { Stockage } from './stockage.js';
import { Captures, tauxDeChangement } from './laboratoire.js';
import { SpectrogrammeDefilant, rendreTrames, dessinerTaux } from './spectrogramme.js';

const $ = (id) => document.getElementById(id);

let micro = null;
let organisme = null;
let spectro = null;
let captures = new Captures(CONFIG.observation);
let tauxValeurs = null;
let tauxMax = 1;
let dernierIndex = -1;
let indexPrecedent = -1;
let enMarche = false;
let derniereMesure = 0;
let minuterieMesures = null;
let tramesAvant = 0;
let echantillonsAvant = 0;
let derniereHeure = 0;

// === DEBUT_INTERFACE_ETAT ===
function ecrire(id, texte) {
  const e = $(id);
  if (e) { e.textContent = texte; }
}

function majEtat(texte, actif) {
  ecrire('etat', texte);
  document.body.classList.toggle('ecoute', !!actif);
}
// === FIN_INTERFACE_ETAT ===

// === DEBUT_INTERFACE_DEMARRAGE ===
async function demarrer() {
  if (enMarche) { return; }
  majEtat('ouverture du micro', false);
  try {
    micro = await ouvrirMicro(CONFIG, recevoir);
  } catch (e) {
    majEtat('micro refuse ou indisponible', false);
    ecrire('detail', String(e && e.message ? e.message : e));
    return;
  }

  organisme = new Organisme(micro.fe, CONFIG);
  const d = organisme.description();
  dernierIndex = -1;

  spectro = new SpectrogrammeDefilant($('spectro'), d.capaciteTrames, d.nbBandes);
  spectro.contraste(Number($('contrasteMin').value), Number($('contrasteMax').value));
  tauxValeurs = new Float32Array(d.capaciteTrames);
  tauxMax = 1;
  indexPrecedent = -1;

  organisme.surEvenement = surEvenement;

  ecrire('fe', micro.fe + ' Hz');
  ecrire('fft', d.nFFT + ' points, resolution ' + (d.resolutionHz).toFixed(1) + ' Hz');
  ecrire('bandes', d.nbBandes + ' bandes, ' + d.bornesHz[1].toFixed(0) + ' a ' + d.bornesHz[d.nbBandes].toFixed(0) + ' Hz');
  ecrire('cadence', 'fenetre ' + CONFIG.oreille.fenetreMs + ' ms, trame toutes les ' + CONFIG.oreille.pasMs + ' ms');
  ecrire('tampon', d.tamponSecondes + ' s (' + d.capaciteTrames + ' trames, ' + (organisme.flux.octetsUtilises() / 1024).toFixed(0) + ' Ko)');

  const r = micro.reglages || {};
  ecrire('traitements',
    'echo ' + String(r.echoCancellation) +
    ', bruit ' + String(r.noiseSuppression) +
    ', gain auto ' + String(r.autoGainControl));

  enMarche = true;
  tramesAvant = 0;
  echantillonsAvant = 0;
  derniereHeure = performance.now();
  majEtat('ecoute', true);
  $('boutonEcoute').textContent = 'Arreter l\u2019ecoute';
  boucleRendu();
  if (minuterieMesures !== null) { clearInterval(minuterieMesures); }
  minuterieMesures = setInterval(majMesures, 1000);
}

async function arreter() {
  if (!enMarche) { return; }
  enMarche = false;
  if (minuterieMesures !== null) { clearInterval(minuterieMesures); minuterieMesures = null; }
  if (micro) { await micro.fermer(); micro = null; }
  majEtat('arretee', false);
  $('boutonEcoute').textContent = 'Demarrer l\u2019ecoute';
}
// === FIN_INTERFACE_DEMARRAGE ===

// === DEBUT_INTERFACE_FLUX ===
function recevoir(bloc) {
  if (!enMarche || !organisme) { return; }
  organisme.recevoirEchantillons(bloc);
  // On lit le flux apres coup : l'interface ne s'insere pas dans la perception.
  const total = organisme.flux.total;
  while (dernierIndex < total - 1) {
    dernierIndex = dernierIndex + 1;
    const dec = organisme.flux.decalage(dernierIndex);
    const vue = organisme.flux.bandes.subarray(dec, dec + organisme.flux.nbBandes);
    spectro.ecrireColonne(vue, dernierIndex);
    // taux de changement : instrument de laboratoire, jamais relu par l'organisme
    let t = 0;
    if (indexPrecedent >= 0) {
      t = tauxDeChangement(organisme.flux, indexPrecedent, dernierIndex);
    }
    tauxValeurs[dernierIndex % tauxValeurs.length] = t;
    if (t > tauxMax) { tauxMax = t; }
    indexPrecedent = dernierIndex;
  }
}

function surEvenement(ev) {
  if (ev.type === 'debut') {
    ecrire('activite', 'activite en cours');
    return;
  }
  if (ev.type === 'abandon') {
    ecrire('activite', 'activite trop breve, ignoree (' + ev.trames + ' trames)');
    return;
  }
  const c = captures.ajouter(organisme.flux, ev.debut, ev.fin, CONFIG.oreille.pasMs);
  ecrire('activite', 'repos');
  if (c) { ajouterVignette(c); }
}
// === FIN_INTERFACE_FLUX ===

// === DEBUT_INTERFACE_VIGNETTES ===
function ajouterVignette(capture) {
  const zone = $('vignettes');
  const bloc = document.createElement('figure');
  bloc.className = 'vignette';
  const c = document.createElement('canvas');
  rendreTrames(c, capture.bandes, capture.nbTrames, capture.nbBandes,
    Number($('contrasteMin').value), Number($('contrasteMax').value));
  const legende = document.createElement('figcaption');
  legende.textContent = capture.numero + ' \u2014 ' + capture.dureeMs + ' ms';
  bloc.appendChild(c);
  bloc.appendChild(legende);
  zone.prepend(bloc);
  while (zone.children.length > CONFIG.observation.maxCaptures) {
    zone.removeChild(zone.lastChild);
  }
  ecrire('nbCaptures', String(captures.liste.length));
}

function redessinerVignettes() {
  const zone = $('vignettes');
  zone.innerHTML = '';
  for (const c of captures.liste) { ajouterVignette(c); }
}
// === FIN_INTERFACE_VIGNETTES ===

// === DEBUT_INTERFACE_RENDU ===
function boucleRendu() {
  if (!enMarche) { return; }
  const maintenant = performance.now();
  const periode = 1000 / CONFIG.affichage.imagesParSeconde;
  if (maintenant - derniereMesure >= periode) {
    derniereMesure = maintenant;
    if (spectro) { spectro.dessiner(); }
    if (tauxValeurs && $('taux')) {
      dessinerTaux($('taux'), tauxValeurs, tauxValeurs.length, dernierIndex, tauxMax);
    }
  }
  requestAnimationFrame(boucleRendu);
}
// === FIN_INTERFACE_RENDU ===

// === DEBUT_INTERFACE_MESURES ===
function majMesures() {
  if (!enMarche || !organisme || !micro) { return; }
  const m = organisme.mesurer();
  const maintenant = performance.now();
  const dt = (maintenant - derniereHeure) / 1000;
  derniereHeure = maintenant;

  const nouvellesTrames = m.tramesProduites - tramesAvant;
  tramesAvant = m.tramesProduites;
  ecrire('tramesSeconde', (nouvellesTrames / dt).toFixed(1) + ' trames/s');
  ecrire('coutTrame', (m.msParTrame * 1000).toFixed(0) + ' \u00b5s par trame');
  ecrire('charge', ((m.msParTrame * nouvellesTrames / dt) / 10).toFixed(1) + ' % d\u2019un coeur');

  const e = micro.etat();
  const attendus = micro.fe * dt;
  const recus = e.echantillonsRecus - echantillonsAvant;
  echantillonsAvant = e.echantillonsRecus;
  ecrire('fluxAudio', (100 * recus / attendus).toFixed(1) + ' % du flux attendu');

  const s = organisme.detecteur.seuils();
  ecrire('seuils', 'plancher ' + s.plancher.toFixed(4)
    + ', haut ' + s.haut.toFixed(4) + ', bas ' + s.bas.toFixed(4));
  ecrire('niveau', organisme.flux.total > 0
    ? organisme.flux.energieDe(organisme.flux.total - 1).toFixed(4)
    : '\u2014');
}
// === FIN_INTERFACE_MESURES ===

// === DEBUT_INTERFACE_EXPORT ===
async function copierDonnees() {
  if (!organisme) { return; }
  const paquet = captures.exporter(organisme.description());
  const texte = JSON.stringify(paquet);
  try {
    await navigator.clipboard.writeText(texte);
    ecrire('detail', 'donnees copiees (' + (texte.length / 1024).toFixed(0) + ' Ko)');
  } catch (e) {
    const z = $('zoneExport');
    z.value = texte;
    z.hidden = false;
    z.select();
    ecrire('detail', 'copie automatique refusee, selectionne le texte ci-dessous');
  }
}
// === FIN_INTERFACE_EXPORT ===

// === DEBUT_INTERFACE_BRANCHEMENTS ===
function brancher() {
  $('boutonEcoute').addEventListener('click', () => {
    if (enMarche) { arreter(); } else { demarrer(); }
  });
  $('boutonVider').addEventListener('click', () => {
    captures.vider();
    $('vignettes').innerHTML = '';
    ecrire('nbCaptures', '0');
    if (spectro) { spectro.effacer(); }
  });
  $('boutonCopier').addEventListener('click', copierDonnees);

  $('contrasteMin').value = CONFIG.affichage.contrasteMin;
  $('contrasteMax').value = CONFIG.affichage.contrasteMax;

  for (const id of ['contrasteMin', 'contrasteMax']) {
    $(id).addEventListener('input', () => {
      const min = Number($('contrasteMin').value);
      const max = Number($('contrasteMax').value);
      ecrire('contrasteValeurs', min.toFixed(1) + ' a ' + max.toFixed(1));
      if (spectro) { spectro.contraste(min, max); }
      redessinerVignettes();
    });
  }
  ecrire('contrasteValeurs',
    Number($('contrasteMin').value).toFixed(1) + ' a ' + Number($('contrasteMax').value).toFixed(1));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && enMarche) {
      ecrire('detail', 'onglet masque : le navigateur suspend la capture');
    }
  });

  Stockage.demanderPersistance();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

brancher();
// === FIN_INTERFACE_BRANCHEMENTS ===
// === FIN_INTERFACE ===
