// === DEBUT_ECRAN_MOTEUR_LOCAL ===
// Réglages → Moteur local (expérimental) : mode, installation du modèle, état et mesures.

import { MODES, lireReglagesLocaux, ecrireReglagesLocaux, lireMesures, resumeMesure } from './reglages-local.js';

const mo = (octets) => Math.round((octets || 0) / (1024 * 1024));

export function monterEcranMoteurLocal({ zone, moteur, surChangement = () => {}, confirmer = (t) => window.confirm(t) }) {
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
  let suivi = null;
  let occupe = false;

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
  bReactiver.addEventListener('click', () => {
    ecrireReglagesLocaux({ suspendu: false, raisonSuspension: '' });
    progression.textContent = 'Moteur local réactivé.';
    dessiner();
    surChangement();
  });

  return { rafraichir, dessiner };
}
// === FIN_ECRAN_MOTEUR_LOCAL ===
