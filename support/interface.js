// === DEBUT_INTERFACE ===
// NAISSANCE V0.3 - Ecran d'observation (support navigateur).
// Assemble le support et l'organisme, et CONSTRUIT LUI-MEME ses panneaux
// de mesure. index.html n'est qu'une coquille : ajouter un indicateur se
// fait ici et nulle part ailleurs.
// Aucune logique perceptive. Rien de ce qui est affiche n'est transmis a
// l'organisme.

import { CONFIG } from '../organisme/config.js';
import { Organisme } from '../organisme/organisme.js';
import { ouvrirMicro } from './capture.js';
import { Stockage } from './stockage.js';
import { Captures, Agitation, tauxDeChangement } from './laboratoire.js';
import { SpectrogrammeDefilant, rendreTrames, dessinerTaux } from './spectrogramme.js';

const VERSION = 'V0.3';

const $ = (id) => document.getElementById(id);

let micro = null;
let organisme = null;
let spectro = null;
let agitation = null;
let captures = new Captures(CONFIG.observation);
let tauxValeurs = null;
let tauxMax = 1;
let dernierIndex = -1;
let indexPrecedent = -1;
let enMarche = false;
let derniereImage = 0;
let minuterie = null;
let tramesAvant = 0;
let echantillonsAvant = 0;
let internesAvant = 0;
let derniereHeure = 0;

// === DEBUT_CONSTRUCTION_PANNEAUX ===
// Les champs sont declares ici, une fois. Pour ajouter un indicateur a
// l'avenir : une ligne dans PANNEAUX, puis ecrire('cle', valeur).
const PANNEAUX = [
  ['\u00c9tat', [
    ['etat', '\u00e9coute', 'arr\u00eat\u00e9e'],
    ['activite', 'activit\u00e9'],
    ['niveau', 'niveau'],
    ['seuils', 'seuils'],
    ['nbCaptures', 'captures', '0'],
    ['detail', 'message']
  ]],
  ['Oreille externe', [
    ['feNative', 'fr\u00e9quence native'],
    ['feInterne', 'fr\u00e9quence interne'],
    ['reech', 'r\u00e9\u00e9chantillonneur'],
    ['filtre', 'filtre'],
    ['traitements', 'traitements micro']
  ]],
  ['Oreille interne', [
    ['banc', 'banc'],
    ['cadence', 'cadence'],
    ['retard', 'retard'],
    ['tampon', 'tampon'],
    ['controle', 'contr\u00f4le']
  ]],
  ['Groupes de fen\u00eatres', []],
  ['Co\u00fbt', [
    ['tramesSeconde', 'cadence r\u00e9elle'],
    ['coutTrame', 'calcul'],
    ['charge', 'charge'],
    ['fluxAudio', 'flux natif'],
    ['fluxInterne', 'flux interne'],
    ['agitation', 'agitation par fen\u00eatre']
  ]]
];

const champs = {};
let listeGroupes = null;

function construirePanneaux() {
  const hote = $('panneaux');
  hote.innerHTML = '';
  for (const [titre, lignes] of PANNEAUX) {
    const h = document.createElement('h2');
    h.textContent = titre;
    hote.appendChild(h);
    const dl = document.createElement('dl');
    dl.className = 'mesures';
    for (const [cle, libelle, defaut] of lignes) {
      const ligne = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = libelle;
      const dd = document.createElement('dd');
      dd.className = 'long';
      dd.id = cle;
      dd.textContent = defaut !== undefined ? defaut : '\u2014';
      ligne.appendChild(dt);
      ligne.appendChild(dd);
      dl.appendChild(ligne);
      champs[cle] = dd;
    }
    if (lignes.length === 0) { listeGroupes = dl; }
    hote.appendChild(dl);
  }
}

function ecrire(cle, texte) {
  const e = champs[cle];
  if (e) { e.textContent = texte; }
}

function majEtat(texte, actif) {
  ecrire('etat', texte);
  document.body.classList.toggle('ecoute', !!actif);
}
// === FIN_CONSTRUCTION_PANNEAUX ===

// === DEBUT_INTERFACE_DEMARRAGE ===
async function demarrer() {
  if (enMarche) { return; }
  majEtat('ouverture du micro', false);
  try {
    micro = await ouvrirMicro(CONFIG, recevoir);
  } catch (e) {
    majEtat('micro refus\u00e9 ou indisponible', false);
    ecrire('detail', String(e && e.message ? e.message : e));
    return;
  }

  organisme = new Organisme(micro.fe, CONFIG);
  const d = organisme.description();
  dernierIndex = -1;
  indexPrecedent = -1;

  spectro = new SpectrogrammeDefilant($('spectro'), d.capaciteTrames, d.nbBandes);
  spectro.contraste(Number($('contrasteMin').value), Number($('contrasteMax').value));
  tauxValeurs = new Float32Array(d.capaciteTrames);
  tauxMax = 1;
  agitation = new Agitation(
    d.groupes, organisme.oreille.indexTaille, d.nbBandes,
    CONFIG.observation.tramesAgitation
  );

  organisme.surEvenement = surEvenement;
  afficherDescription(d, micro);

  enMarche = true;
  tramesAvant = 0;
  echantillonsAvant = 0;
  internesAvant = 0;
  derniereHeure = performance.now();
  majEtat('\u00e9coute', true);
  $('boutonEcoute').textContent = 'Arr\u00eater l\u2019\u00e9coute';
  boucleRendu();
  if (minuterie !== null) { clearInterval(minuterie); }
  minuterie = setInterval(majMesures, 1000);
}

async function arreter() {
  if (!enMarche) { return; }
  enMarche = false;
  if (minuterie !== null) { clearInterval(minuterie); minuterie = null; }
  if (micro) { await micro.fermer(); micro = null; }
  majEtat('arr\u00eat\u00e9e', false);
  $('boutonEcoute').textContent = 'D\u00e9marrer l\u2019\u00e9coute';
}
// === FIN_INTERFACE_DEMARRAGE ===

// === DEBUT_INTERFACE_DESCRIPTION ===
// Verification que l'organe construit est bien celui qui etait prevu.
function afficherDescription(d, micro) {
  const e = d.entree;

  ecrire('feNative', micro.fe + ' Hz');
  ecrire('feInterne', d.fe + ' Hz');
  ecrire('reech', e.actif
    ? (e.coefficients + ' coefficients, ' + e.phases + ' phases, '
      + (e.multiplicationsParSeconde / 1e6).toFixed(2) + ' M mult/s')
    : 'court-circuit\u00e9 (fr\u00e9quences identiques)');
  ecrire('filtre', e.actif
    ? ('passante 0\u2013' + e.bordPassante + ' Hz, transition ' + e.transitionHz
      + ' Hz, coup\u00e9e d\u00e8s ' + e.bordCoupee + ' Hz, ' + e.attenuationDb + ' dB')
    : '\u2014');

  ecrire('banc', d.nbBandes + ' bandes, ' + d.fMinHz.toFixed(0) + ' \u00e0 '
    + d.fMaxHz.toFixed(0) + ' Hz, espacement ' + d.pasErb.toFixed(4) + ' ERB');
  ecrire('cadence', 'trame toutes les ' + d.pasMs + ' ms ('
    + d.pasEchantillons + ' \u00e9chantillons internes)');
  ecrire('retard', d.retard.fenetreMs.toFixed(2) + ' + '
    + d.retard.reechantillonneurMs.toFixed(2) + ' = '
    + d.retard.totalMs.toFixed(2) + ' ms');
  ecrire('tampon', d.tamponSecondes + ' s (' + d.capaciteTrames + ' trames, '
    + (d.octetsTampon / 1024).toFixed(0) + ' Ko), d\u00e9bit '
    + (d.octetsParSeconde / 1024).toFixed(1) + ' Ko/s');
  ecrire('controle', 'doublons ' + d.doublons + ', bins minimum ' + d.minBins
    + ', zero-padding ' + (d.zeroPadding ? 'oui' : 'non'));

  const r = micro.reglages || {};
  ecrire('traitements', 'echo ' + String(r.echoCancellation)
    + ', bruit ' + String(r.noiseSuppression)
    + ', gain auto ' + String(r.autoGainControl));

  if (listeGroupes) {
    listeGroupes.innerHTML = '';
    for (const g of d.groupes) {
      const ligne = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = g.taille + ' \u00e9ch. / ' + g.dureeMs.toFixed(2) + ' ms';
      const dd = document.createElement('dd');
      dd.className = 'long';
      dd.textContent = g.nbBandes + ' bandes b' + g.premiere + '\u2013b' + g.derniere
        + ', ' + g.resolutionHz.toFixed(1) + ' Hz, '
        + g.centreBasHz.toFixed(0) + '\u2013' + g.centreHautHz.toFixed(0) + ' Hz';
      ligne.appendChild(dt);
      ligne.appendChild(dd);
      listeGroupes.appendChild(ligne);
    }
  }
}
// === FIN_INTERFACE_DESCRIPTION ===

// === DEBUT_INTERFACE_FLUX ===
function recevoir(bloc) {
  if (!enMarche || !organisme) { return; }
  organisme.recevoirEchantillons(bloc);
  const total = organisme.flux.total;
  while (dernierIndex < total - 1) {
    dernierIndex = dernierIndex + 1;
    const dec = organisme.flux.decalage(dernierIndex);
    const vue = organisme.flux.bandes.subarray(dec, dec + organisme.flux.nbBandes);
    spectro.ecrireColonne(vue, dernierIndex);
    agitation.observer(vue);
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
  if (ev.type === 'debut') { ecrire('activite', 'activit\u00e9 en cours'); return; }
  if (ev.type === 'abandon') {
    ecrire('activite', 'trop br\u00e8ve, ignor\u00e9e (' + ev.trames + ' trames)');
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
  $('vignettes').innerHTML = '';
  for (const c of captures.liste) { ajouterVignette(c); }
}
// === FIN_INTERFACE_VIGNETTES ===

// === DEBUT_INTERFACE_RENDU ===
function boucleRendu() {
  if (!enMarche) { return; }
  const maintenant = performance.now();
  if (maintenant - derniereImage >= 1000 / CONFIG.affichage.imagesParSeconde) {
    derniereImage = maintenant;
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

  const nouvelles = m.tramesProduites - tramesAvant;
  tramesAvant = m.tramesProduites;
  ecrire('tramesSeconde', (nouvelles / dt).toFixed(1) + ' trames/s');
  ecrire('coutTrame', (m.msParTrame * 1000).toFixed(0)
    + ' \u00b5s par trame (oreille seule)');
  ecrire('charge', ((m.msParTrame * nouvelles / dt) / 10).toFixed(1)
    + ' % d\u2019un c\u0153ur');

  const e = micro.etat();
  const recus = e.echantillonsRecus - echantillonsAvant;
  echantillonsAvant = e.echantillonsRecus;
  ecrire('fluxAudio', (100 * recus / (micro.fe * dt)).toFixed(1) + ' % du flux natif');

  const internes = m.echantillonsInternes - internesAvant;
  internesAvant = m.echantillonsInternes;
  ecrire('fluxInterne', (internes / dt).toFixed(0) + ' \u00e9ch/s ('
    + (100 * internes / (organisme.fe * dt)).toFixed(1) + ' %)');

  const s = organisme.detecteur.seuils();
  ecrire('seuils', 'plancher ' + s.plancher.toFixed(4)
    + ', haut ' + s.haut.toFixed(4) + ', bas ' + s.bas.toFixed(4));
  ecrire('niveau', organisme.flux.total > 0
    ? organisme.flux.energieDe(organisme.flux.total - 1).toFixed(4) : '\u2014');

  if (agitation) {
    const v = agitation.lire();
    const tailles = organisme.oreille.tailles;
    ecrire('agitation', v.map((x, i) =>
      (1000 * tailles[i] / organisme.fe).toFixed(1) + 'ms ' + x.toFixed(2)).join('  '));
  }
}
// === FIN_INTERFACE_MESURES ===

// === DEBUT_INTERFACE_EXPORT ===
async function copierDonnees() {
  if (!organisme) { return; }
  const texte = JSON.stringify(captures.exporter(organisme.description()));
  try {
    await navigator.clipboard.writeText(texte);
    ecrire('detail', 'donn\u00e9es copi\u00e9es (' + (texte.length / 1024).toFixed(0) + ' Ko)');
  } catch (e) {
    const z = $('zoneExport');
    z.value = texte;
    z.hidden = false;
    z.select();
    ecrire('detail', 'copie refus\u00e9e, s\u00e9lectionne le texte ci-dessous');
  }
}
// === FIN_INTERFACE_EXPORT ===

// === DEBUT_INTERFACE_BRANCHEMENTS ===
function brancher() {
  construirePanneaux();
  const v = $('version');
  if (v) { v.textContent = VERSION; }

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
      $('contrasteValeurs').textContent = min.toFixed(1) + ' \u00e0 ' + max.toFixed(1);
      if (spectro) { spectro.contraste(min, max); }
      redessinerVignettes();
    });
  }
  $('contrasteValeurs').textContent =
    Number($('contrasteMin').value).toFixed(1) + ' \u00e0 '
    + Number($('contrasteMax').value).toFixed(1);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && enMarche) {
      ecrire('detail', 'onglet masqu\u00e9 : le navigateur suspend la capture');
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
