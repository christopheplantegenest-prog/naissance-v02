// === DEBUT_ECRAN_MOTEUR_LOCAL ===
// Réglages → Moteur local (expérimental) : mode, installation du modèle, état et mesures.

import { MODES, lireReglagesLocaux, ecrireReglagesLocaux, lireMesures, resumeMesure } from './reglages-local.js';
import { VARIANTES } from '../esprit/contexte-local.js';
import { lireTraces, effacerTraces, rapportTraces } from './diagnostic.js';
import { lancerBanc, rapport as rapportBanc, PROTOCOLES } from './banc.js';

const mo = (octets) => Math.round((octets || 0) / (1024 * 1024));

export function monterEcranMoteurLocal({
  zone, moteur, essai = null, identite = async () => null, surChangement = () => {}, confirmer = (t) => window.confirm(t),
  copier = (t) => navigator.clipboard.writeText(t),
}) {
  const $ = (s) => zone.querySelector(s);
  const etatTexte = $('[data-local-etat]');
  const modes = $('[data-local-modes]');
  const progression = $('[data-local-progression]');
  const mesure = $('[data-local-mesure]');
  const bTelecharger = $('[data-local-telecharger]');
  const bAnnuler = $('[data-local-annuler]');
  const bCharger = $('[data-local-charger]');
  const bDecharger = $('[data-local-decharger]');
  const bSupprimer = $('[data-local-supprimer]');
  const bReactiver = $('[data-local-reactiver]');
  const lignesBoutons = zone.querySelectorAll('[data-local-boutons]');
  const variantes = $('[data-local-variantes]');
  const resumeDiagnostic = $('[data-diagnostic-resume]');
  const protocoleBanc = $('[data-banc-protocole]');
  const questionsBanc = $('[data-banc-questions]');
  const repetitionsBanc = $('[data-banc-repetitions]');
  const graineBanc = $('[data-banc-graine]');
  const bLancerBanc = $('[data-banc-lancer]');
  const bArreterBanc = $('[data-banc-arreter]');
  const bCopierBanc = $('[data-banc-copier]');
  const avancementBanc = $('[data-banc-avancement]');
  const rapportZone = $('[data-banc-rapport]');
  let suivi = null;
  let occupe = false;
  let bancEnCours = false;
  let arretBanc = false;
  let dernierRapport = '';

  for (const [valeur, libelle] of Object.entries(MODES)) {
    const etiquette = document.createElement('label');
    etiquette.className = 'case';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'mode-moteur';
    radio.value = valeur;
    radio.addEventListener('change', () => {
      ecrireReglagesLocaux({ mode: valeur });
      dessiner();
      surChangement();
    });
    const texte = document.createElement('span');
    texte.textContent = libelle;
    etiquette.append(radio, texte);
    modes.appendChild(etiquette);
  }

  for (const [valeur, libelle] of Object.entries(VARIANTES)) {
    const etiquette = document.createElement('label');
    etiquette.className = 'case';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'variante-contexte';
    radio.value = valeur;
    radio.addEventListener('change', () => { ecrireReglagesLocaux({ variante: valeur }); dessiner(); });
    const texte = document.createElement('span');
    texte.textContent = libelle;
    etiquette.append(radio, texte);
    variantes.appendChild(etiquette);
  }
  for (const [valeur, libelle] of Object.entries(PROTOCOLES)) {
    const option = document.createElement('option');
    option.value = valeur;
    option.textContent = libelle;
    protocoleBanc.appendChild(option);
  }
  const optionLibre = document.createElement('option');
  optionLibre.value = 'libre';
  optionLibre.textContent = 'Questions libres (ci-dessous)';
  protocoleBanc.appendChild(optionLibre);
  protocoleBanc.addEventListener('change', () => {
    questionsBanc.hidden = protocoleBanc.value !== 'libre';
    etiquetteQuestions.hidden = questionsBanc.hidden;
  });
  const etiquetteQuestions = $('[data-banc-etiquette-questions]');
  questionsBanc.hidden = true;
  etiquetteQuestions.hidden = true;

  function dessiner() {
    const e = moteur.etat();
    const r = lireReglagesLocaux();
    for (const radio of modes.querySelectorAll('input')) radio.checked = radio.value === r.mode;
    const lignes = [];
    if (!e.natif) {
      lignes.push(e.erreurNatif || "Le moteur local n'est pas disponible sur cet appareil.");
    } else {
      lignes.push(e.installe
        ? `Modèle installé : ${moteur.profil.nom} (${mo(e.taille)} Mo)${e.charge ? ', chargé en mémoire' : ''}.`
        : e.fichierPresent
          ? 'Fichier du modèle présent mais non vérifié : supprime-le et télécharge-le à nouveau.'
          : `Modèle non installé (${moteur.profil.nom}, environ ${moteur.profil.tailleApproxMo} Mo à télécharger en Wi-Fi).`);
      if (e.memoireTotale) lignes.push(`Mémoire libre du téléphone : ${mo(e.memoireLibre)} Mo sur ${mo(e.memoireTotale)} Mo.`);
    }
    if (r.suspendu) lignes.push(`⚠️ Moteur local suspendu par sécurité : ${r.raisonSuspension || 'arrêt brutal de l’appli'}.`);
    if (e.natif && e.installe && r.mode === 'externe-seul') lignes.push('Mode « Externe seulement » : le moteur local n’est pas utilisé.');
    if (e.natif && !e.installe && r.mode !== 'externe-seul') lignes.push('Tant que le modèle n’est pas installé, Naissance utilise le moteur externe.');
    etatTexte.textContent = lignes.join(' ');

    for (const l of lignesBoutons) l.hidden = !e.natif;
    bTelecharger.hidden = !e.natif || e.installe;
    bTelecharger.disabled = occupe || !!suivi;
    bAnnuler.hidden = !suivi;
    bCharger.hidden = !e.installe || e.charge;
    bDecharger.hidden = !e.charge;
    bSupprimer.hidden = !e.fichierPresent;
    for (const b of [bCharger, bDecharger, bSupprimer]) b.disabled = occupe || !!suivi;
    bReactiver.hidden = !r.suspendu;
    const m = lireMesures().at(-1);
    mesure.textContent = e.natif ? resumeMesure(m) : '';
    for (const radio of variantes.querySelectorAll('input')) radio.checked = radio.value === r.variante;
    const traces = lireTraces();
    resumeDiagnostic.textContent = traces.length
      ? `${traces.length} réponse(s) locale(s) tracée(s). La dernière : `
        + `${traces.at(-1).souvenirs.filter((x) => x.statut.startsWith('injecté')).length} souvenir(s) fourni(s), `
        + `${traces.at(-1).jetonsEstimes.total} jetons de contexte, cache « ${traces.at(-1).cache} ».`
      : 'Aucune réponse locale tracée pour l’instant.';
    bLancerBanc.disabled = bancEnCours || !essai || !e.installe;
    bArreterBanc.hidden = !bancEnCours;
    bCopierBanc.hidden = !dernierRapport;
  }

  async function rafraichir() {
    await moteur.rafraichir();
    dessiner();
  }

  async function suivreTelechargement() {
    try {
      const t = await moteur.etatTelechargement();
      if (t.etat === 'encours') {
        progression.textContent = `Téléchargement : ${mo(t.recu)} / ${t.total ? mo(t.total) : '?'} Mo`;
      } else if (t.etat === 'verification') {
        progression.textContent = 'Vérification du fichier…';
      } else {
        clearInterval(suivi);
        suivi = null;
        progression.textContent = {
          termine: 'Modèle téléchargé et vérifié. Choisis « Local d’abord » pour l’essayer.',
          annule: 'Téléchargement annulé (il reprendra où il s’est arrêté).',
          erreur: `Téléchargement interrompu : ${t.erreur} (il reprendra où il s’est arrêté).`,
        }[t.etat] || '';
        await rafraichir();
        surChangement();
      }
    } catch (e) {
      clearInterval(suivi);
      suivi = null;
      progression.textContent = `Suivi du téléchargement impossible : ${e.message}`;
      dessiner();
    }
  }

  async function action(fonction) {
    if (occupe) return;
    occupe = true;
    dessiner();
    try {
      await fonction();
    } catch (e) {
      progression.textContent = e.message || String(e);
    } finally {
      occupe = false;
      await rafraichir();
      surChangement();
    }
  }

  bTelecharger.addEventListener('click', () => action(async () => {
    await moteur.telecharger();
    progression.textContent = 'Téléchargement : démarrage…';
    suivi = setInterval(suivreTelechargement, 700);
  }));
  bAnnuler.addEventListener('click', () => moteur.annulerTelechargement().catch(() => {}));
  bCharger.addEventListener('click', () => action(async () => {
    progression.textContent = 'Chargement du modèle…';
    const r = await moteur.charger();
    progression.textContent = `Modèle chargé en ${((r.chargeEnMs || 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s.`;
  }));
  bDecharger.addEventListener('click', () => action(async () => {
    await moteur.decharger();
    progression.textContent = 'Modèle retiré de la mémoire.';
  }));
  bSupprimer.addEventListener('click', () => action(async () => {
    if (!confirmer('Supprimer le modèle local du téléphone ? Naissance, sa mémoire et sa conversation ne changent pas.')) return;
    await moteur.supprimer();
    progression.textContent = 'Modèle local supprimé. Naissance continue avec le moteur externe.';
  }));
  $('[data-diagnostic-copier]').addEventListener('click', async () => {
    await copier(rapportTraces(lireTraces()));
    resumeDiagnostic.textContent = 'Diagnostic copié dans le presse-papiers.';
  });
  $('[data-diagnostic-effacer]').addEventListener('click', () => {
    effacerTraces();
    dessiner();
  });
  bArreterBanc.addEventListener('click', () => { arretBanc = true; avancementBanc.textContent = 'Arrêt demandé…'; });
  bCopierBanc.addEventListener('click', () => copier(dernierRapport));
  bLancerBanc.addEventListener('click', async () => {
    if (bancEnCours || !essai) return;
    const questions = questionsBanc.value.split('\n').map((q) => q.trim()).filter(Boolean);
    if (protocoleBanc.value === 'libre' && !questions.length) { avancementBanc.textContent = 'Aucune question à essayer.'; return; }
    const graineTexte = graineBanc.value.trim();
    const graine = graineTexte === '' ? null : Number(graineTexte);
    bancEnCours = true;
    arretBanc = false;
    dernierRapport = '';
    rapportZone.textContent = '';
    dessiner();
    try {
      const r = await lancerBanc({
        protocole: protocoleBanc.value,
        questions: protocoleBanc.value === 'libre' ? questions : null,
        identite: await identite(),
        repetitions: Number(repetitionsBanc.value) || 1,
        variante: lireReglagesLocaux().variante,
        graine: Number.isFinite(graine) ? graine : null,
        essai,
        arret: () => arretBanc,
        surAvancement: ({ numero, total, question }) => {
          avancementBanc.textContent = `Essai ${numero} sur ${total} : « ${question} »…`;
        },
      });
      dernierRapport = rapportBanc({ ...r, graine: Number.isFinite(graine) ? graine : null });
      rapportZone.textContent = dernierRapport;
      avancementBanc.textContent = r.interrompu ? 'Banc interrompu.' : 'Banc terminé.';
    } catch (e) {
      avancementBanc.textContent = `Banc impossible : ${e.message || e}`;
    } finally {
      bancEnCours = false;
      dessiner();
    }
  });

  bReactiver.addEventListener('click', () => {
    ecrireReglagesLocaux({ suspendu: false, raisonSuspension: '' });
    progression.textContent = 'Moteur local réactivé.';
    dessiner();
    surChangement();
  });

  return { rafraichir, dessiner };
}
// === FIN_ECRAN_MOTEUR_LOCAL ===
