// === DEBUT_VOIX ===
// La voix de l'appli : écouter (parole → texte) et lire (texte → parole).
// APK : modules natifs Android via Capacitor
//   - SpeechRecognition (@capacitor-community/speech-recognition)
//   - TextToSpeech      (@capacitor-community/text-to-speech)
// PWA : Web Speech API du navigateur (tests et développement).
// Rien n'est enregistré : l'écoute rend seulement du texte, que la personne relit avant envoi.

import { estNatif, appelNatif } from '../natif.js';
import { ErreurVoix, texteAPrononcer, decouper, traduireErreurEcoute } from './outils-voix.js';

function etatPermission(r) {
  if (!r || typeof r !== 'object') return 'prompt';
  return r.speechRecognition || r.microphone || r.record_audio || Object.values(r)[0] || 'prompt';
}

function moteurNatif(langue) {
  async function autoriser() {
    const actuel = etatPermission(await appelNatif('SpeechRecognition', 'checkPermissions'));
    if (actuel === 'granted') return;
    const reponse = etatPermission(await appelNatif('SpeechRecognition', 'requestPermissions'));
    if (reponse !== 'granted') throw traduireErreurEcoute({ code: 'permission' });
  }
  async function demarrer(popup) {
    const r = await appelNatif('SpeechRecognition', 'start', {
      language: langue, maxResults: 1, partialResults: false, popup, prompt: 'Parle à Naissance',
    });
    const texte = r && Array.isArray(r.matches) ? String(r.matches[0] || '').trim() : '';
    if (!texte) throw traduireErreurEcoute({ code: 'no-speech' });
    return texte;
  }
  return {
    type: 'natif',
    async ecouteDisponible() {
      try {
        const r = await appelNatif('SpeechRecognition', 'available');
        return !!(r && r.available);
      } catch {
        return false;
      }
    },
    lectureDisponible: async () => true,
    async ecouter() {
      await autoriser();
      try {
        return await demarrer(false);
      } catch (e) {
        const err = traduireErreurEcoute(e);
        if (err.code !== 'service') throw err;
        // Dernier recours : la fenêtre de dictée de Google.
        try { return await demarrer(true); } catch (e2) { throw traduireErreurEcoute(e2); }
      }
    },
    arreterEcoute: () => appelNatif('SpeechRecognition', 'stop').catch(() => {}),
    direMorceau: (texte) => appelNatif('TextToSpeech', 'speak', {
      text: texte, lang: langue, rate: 1.0, pitch: 1.0, volume: 1.0, queueStrategy: 0,
    }),
    taire: () => appelNatif('TextToSpeech', 'stop').catch(() => {}),
  };
}

function moteurWeb(fenetre, langue) {
  const Reconnaissance = fenetre.SpeechRecognition || fenetre.webkitSpeechRecognition;
  const synthese = fenetre.speechSynthesis;
  let ecoute = null;
  return {
    type: 'web',
    ecouteDisponible: async () => !!Reconnaissance,
    lectureDisponible: async () => !!(synthese && fenetre.SpeechSynthesisUtterance),
    ecouter() {
      if (!Reconnaissance) return Promise.reject(traduireErreurEcoute({ code: 'not supported' }));
      return new Promise((ok, ko) => {
        const r = new Reconnaissance();
        r.lang = langue;
        r.interimResults = false;
        r.maxAlternatives = 1;
        r.continuous = false;
        let texte = '';
        let echec = null;
        r.onresult = (ev) => {
          const res = ev.results && ev.results[0] && ev.results[0][0];
          texte = res ? String(res.transcript || '').trim() : '';
        };
        r.onerror = (ev) => { echec = traduireErreurEcoute({ code: ev.error, message: ev.message }); };
        r.onend = () => {
          ecoute = null;
          if (echec) ko(echec);
          else if (texte) ok(texte);
          else ko(traduireErreurEcoute({ code: 'no-speech' }));
        };
        ecoute = r;
        try { r.start(); } catch (e) { ecoute = null; ko(traduireErreurEcoute(e)); }
      });
    },
    arreterEcoute: async () => { if (ecoute) ecoute.stop(); },
    direMorceau(texte) {
      return new Promise((ok, ko) => {
        const u = new fenetre.SpeechSynthesisUtterance(texte);
        u.lang = langue;
        const voixFr = (synthese.getVoices ? synthese.getVoices() : []).find((v) => (v.lang || '').startsWith('fr'));
        if (voixFr) u.voice = voixFr;
        u.onend = () => ok();
        u.onerror = (e) => (e && /interrupted|canceled/.test(e.error) ? ok() : ko(new ErreurVoix('lecture', 'Lecture impossible.', e && e.error)));
        synthese.speak(u);
      });
    },
    taire: async () => { if (synthese) synthese.cancel(); },
  };
}

export function creerVoix({ fenetre = globalThis, natif = estNatif(), langue = 'fr-FR' } = {}) {
  const moteur = natif ? moteurNatif(langue) : moteurWeb(fenetre, langue);
  let numeroLecture = 0;
  let enLecture = false;
  return {
    type: moteur.type,
    ecouteDisponible: () => moteur.ecouteDisponible(),
    lectureDisponible: () => moteur.lectureDisponible(),
    ecouter: () => moteur.ecouter(),
    arreterEcoute: () => moteur.arreterEcoute(),
    get enLecture() { return enLecture; },
    // Lit un texte ; renvoie true s'il a été lu jusqu'au bout, false s'il a été interrompu.
    async lire(texte) {
      const numero = ++numeroLecture;
      await moteur.taire();
      const morceaux = decouper(texteAPrononcer(texte));
      enLecture = true;
      try {
        for (const m of morceaux) {
          if (numero !== numeroLecture) return false;
          await moteur.direMorceau(m);
        }
        return numero === numeroLecture;
      } catch (e) {
        throw e instanceof ErreurVoix ? e : new ErreurVoix('lecture', 'La lecture à voix haute a échoué.', String((e && e.message) || e));
      } finally {
        if (numero === numeroLecture) enLecture = false;
      }
    },
    async arreterLecture() {
      numeroLecture++;
      enLecture = false;
      await moteur.taire();
    },
  };
}
// === FIN_VOIX ===
