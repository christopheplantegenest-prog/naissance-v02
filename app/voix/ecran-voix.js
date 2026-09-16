// === DEBUT_REGLAGES_VOIX ===
// Section « Voix » des Réglages : lecture automatique et état des services vocaux.

import { lirePreferencesVoix, ecrirePreferencesVoix } from './preferences.js';

export function monterReglagesVoix({ zone, voix }) {
  const caseLecture = zone.querySelector('[data-lecture-auto]');
  const etat = zone.querySelector('[data-etat-voix]');
  const essai = zone.querySelector('[data-essai-voix]');

  async function rafraichir() {
    caseLecture.checked = lirePreferencesVoix().lectureAuto;
    const [ecoute, lecture] = await Promise.all([voix.ecouteDisponible(), voix.lectureDisponible()]);
    etat.textContent = [
      `Dictée : ${ecoute ? 'disponible' : 'indisponible sur cet appareil'}.`,
      `Lecture à voix haute : ${lecture ? 'disponible' : 'indisponible sur cet appareil'}.`,
      ecoute ? 'La dictée passe par le service vocal du téléphone (souvent Google) ; aucun son n’est gardé par Naissance.' : '',
    ].filter(Boolean).join(' ');
    caseLecture.disabled = !lecture;
    essai.hidden = !lecture;
  }

  caseLecture.addEventListener('change', () => ecrirePreferencesVoix({ lectureAuto: caseLecture.checked }));
  essai.addEventListener('click', async () => {
    try {
      await voix.lire('Bonjour, je suis Naissance. Voici ma voix.');
    } catch (e) {
      etat.textContent = `Lecture impossible : ${e.message}`;
    }
  });

  return { rafraichir };
}
// === FIN_REGLAGES_VOIX ===
