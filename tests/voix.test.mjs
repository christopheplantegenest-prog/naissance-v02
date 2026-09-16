import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteAPrononcer, decouper, traduireErreurEcoute } from '../app/voix/outils-voix.js';
import { creerVoix } from '../app/voix/voix.js';
import { lirePreferencesVoix, ecrirePreferencesVoix } from '../app/voix/preferences.js';
import { fauxStockage } from './outils.mjs';

test('texte à prononcer : sans mise en forme, liens, code ni émojis', () => {
  const t = texteAPrononcer('# Titre\n- **Point** un 😀\n1. deuxième *idée*\nVoir https://exemple.fr/page.\n```js\nlet x = 1;\n```\nfin `code`');
  assert.equal(t, 'Titre\nPoint un\ndeuxième idée\nVoir (lien)\n(bloc de code)\nfin code');
});

test('découpage : respect de la limite, phrases entières quand c’est possible', () => {
  assert.deepEqual(decouper(''), []);
  assert.deepEqual(decouper('Une phrase. Deux phrases !', 1000), ['Une phrase. Deux phrases !']);
  const long = Array.from({ length: 50 }, (_, i) => `Phrase numéro ${i} assez longue pour le test.`).join(' ');
  const m = decouper(long, 200);
  assert.ok(m.length > 5);
  assert.ok(m.every((x) => x.length <= 200));
  assert.equal(m.join(' ').replace(/\s+/g, ' '), long);
  assert.ok(decouper('x'.repeat(450), 200).every((x) => x.length <= 200));
});

test('erreurs de reconnaissance traduites (Android et navigateur)', () => {
  const c = (e) => traduireErreurEcoute(e).code;
  assert.equal(c('Insufficient permissions'), 'permission');
  assert.equal(c({ code: 'not-allowed' }), 'permission');
  assert.equal(c({ code: 'service-not-allowed' }), 'permission');
  assert.equal(c('No match'), 'rien');
  assert.equal(c("Didn't understand, please try again."), 'rien');
  assert.equal(c({ code: 'no-speech' }), 'rien');
  assert.equal(c('Client side error'), 'rien');
  assert.equal(c('Network error'), 'reseau');
  assert.equal(c('error from server'), 'reseau');
  assert.equal(c('RecognitionService busy'), 'micro');
  assert.equal(c({ code: 'audio-capture' }), 'micro');
  assert.equal(c('Speech recognition service not available'), 'service');
  assert.equal(c({ code: 'aborted' }), 'annule');
  assert.equal(c('bizarre'), 'inconnu');
});

test('préférences de voix : lecture automatique désactivée par défaut, puis mémorisée', () => {
  const s = fauxStockage();
  assert.equal(lirePreferencesVoix(s).lectureAuto, false);
  ecrirePreferencesVoix({ lectureAuto: true }, s);
  assert.equal(lirePreferencesVoix(s).lectureAuto, true);
  s.setItem('naissance-ia.voix.v1', '{abîmé');
  assert.equal(lirePreferencesVoix(s).lectureAuto, false);
});

// ---------- navigateur (PWA) ----------
function fausseFenetre({ transcript = 'bonjour Naissance', erreur = null } = {}) {
  const dits = [];
  let annules = 0;
  class Reco {
    start() {
      this.lancee = true;
      setTimeout(() => {
        if (erreur) this.onerror({ error: erreur });
        else this.onresult({ results: [[{ transcript }]] });
        this.onend();
      }, 5);
    }
    stop() {}
  }
  class Enonce { constructor(t) { this.text = t; } }
  return {
    fenetre: {
      webkitSpeechRecognition: Reco,
      SpeechSynthesisUtterance: Enonce,
      speechSynthesis: {
        getVoices: () => [{ lang: 'en-US' }, { lang: 'fr-FR', name: 'fr' }],
        speak: (u) => { dits.push(u); setTimeout(() => u.onend(), 1); },
        cancel: () => { annules++; },
      },
    },
    dits,
    annules: () => annules,
  };
}

test('navigateur : dictée rendue en texte, erreurs traduites', async () => {
  const f = fausseFenetre();
  const v = creerVoix({ fenetre: f.fenetre, natif: false });
  assert.equal(v.type, 'web');
  assert.equal(await v.ecouteDisponible(), true);
  assert.equal(await v.ecouter(), 'bonjour Naissance');
  const refus = creerVoix({ fenetre: fausseFenetre({ erreur: 'not-allowed' }).fenetre, natif: false });
  await assert.rejects(refus.ecouter(), { code: 'permission' });
  const silence = creerVoix({ fenetre: fausseFenetre({ transcript: '  ' }).fenetre, natif: false });
  await assert.rejects(silence.ecouter(), { code: 'rien' });
  const sans = creerVoix({ fenetre: {}, natif: false });
  assert.equal(await sans.ecouteDisponible(), false);
  assert.equal(await sans.lectureDisponible(), false);
});

test('navigateur : lecture en français, texte nettoyé', async () => {
  const f = fausseFenetre();
  const v = creerVoix({ fenetre: f.fenetre, natif: false });
  assert.equal(await v.lire('**Bonjour** Christophe !'), true);
  assert.equal(f.dits[0].text, 'Bonjour Christophe !');
  assert.equal(f.dits[0].lang, 'fr-FR');
  assert.equal(f.dits[0].voice.name, 'fr');
  assert.equal(v.enLecture, false);
});

// ---------- Android (APK) ----------
function fauxAndroid({ permission = 'granted', apresDemande = 'granted', resultat = { matches: ['salut toi'] }, erreurStart = null, disponible = true } = {}) {
  const appels = [];
  let lectureEnAttente = null;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    nativePromise: async (plugin, methode, options) => {
      appels.push({ plugin, methode, options });
      if (plugin === 'SpeechRecognition') {
        if (methode === 'available') return { available: disponible };
        if (methode === 'checkPermissions') return { speechRecognition: permission };
        if (methode === 'requestPermissions') return { speechRecognition: apresDemande };
        if (methode === 'start') {
          if (erreurStart && (typeof erreurStart !== 'function' || erreurStart(options))) throw new Error(typeof erreurStart === 'string' ? erreurStart : 'Speech recognition service not available');
          return resultat;
        }
        if (methode === 'stop') return {};
      }
      if (plugin === 'TextToSpeech') {
        if (methode === 'speak') {
          if (options.text.includes('LENT')) return new Promise((ok) => { lectureEnAttente = ok; });
          return {};
        }
        if (methode === 'stop') { if (lectureEnAttente) lectureEnAttente({}); return {}; }
      }
      throw new Error(`inattendu ${plugin}.${methode}`);
    },
  };
  return appels;
}

test('Android : permission déjà accordée, dictée sans fenêtre Google', async () => {
  const appels = fauxAndroid();
  const v = creerVoix({ natif: true });
  assert.equal(v.type, 'natif');
  assert.equal(await v.ecouteDisponible(), true);
  assert.equal(await v.ecouter(), 'salut toi');
  assert.deepEqual(appels.map((a) => a.methode), ['available', 'checkPermissions', 'start']);
  assert.deepEqual(appels.at(-1).options, { language: 'fr-FR', maxResults: 1, partialResults: false, popup: false, prompt: 'Parle à Naissance' });
  delete globalThis.Capacitor;
});

test('Android : permission demandée seulement au moment d’écouter, refus expliqué', async () => {
  let appels = fauxAndroid({ permission: 'prompt', apresDemande: 'granted' });
  const v = creerVoix({ natif: true });
  assert.equal(await v.ecouter(), 'salut toi');
  assert.deepEqual(appels.map((a) => a.methode), ['checkPermissions', 'requestPermissions', 'start']);
  appels = fauxAndroid({ permission: 'prompt', apresDemande: 'denied' });
  await assert.rejects(creerVoix({ natif: true }).ecouter(), { code: 'permission' });
  assert.ok(!appels.some((a) => a.methode === 'start'), 'aucune écoute sans autorisation');
  delete globalThis.Capacitor;
});

test('Android : service indisponible → fenêtre de dictée Google en dernier recours ; rien entendu', async () => {
  let appels = fauxAndroid({ erreurStart: (o) => o.popup === false });
  assert.equal(await creerVoix({ natif: true }).ecouter(), 'salut toi');
  assert.deepEqual(appels.filter((a) => a.methode === 'start').map((a) => a.options.popup), [false, true]);
  appels = fauxAndroid({ erreurStart: 'No match' });
  await assert.rejects(creerVoix({ natif: true }).ecouter(), { code: 'rien' });
  assert.equal(appels.filter((a) => a.methode === 'start').length, 1);
  fauxAndroid({ resultat: { matches: [] } });
  await assert.rejects(creerVoix({ natif: true }).ecouter(), { code: 'rien' });
  fauxAndroid({ disponible: false });
  assert.equal(await creerVoix({ natif: true }).ecouteDisponible(), false);
  delete globalThis.Capacitor;
});

test('Android : lecture découpée, en français, et interruption propre', async () => {
  const appels = fauxAndroid();
  const v = creerVoix({ natif: true });
  const long = Array.from({ length: 200 }, (_, i) => `Phrase ${i} pour tester le découpage des longues réponses.`).join(' ');
  assert.equal(await v.lire(long), true);
  const dits = appels.filter((a) => a.methode === 'speak');
  assert.ok(dits.length >= 3);
  assert.ok(dits.every((a) => a.options.text.length <= 3000 && a.options.lang === 'fr-FR'));
  const enCours = v.lire(`LENT ${'mot '.repeat(740)}. Suite qui ne doit jamais être dite.`);
  await new Promise((ok) => setTimeout(ok, 5));
  assert.equal(v.enLecture, true);
  await v.arreterLecture();
  assert.equal(await enCours, false);
  assert.ok(!appels.some((a) => a.methode === 'speak' && a.options.text.includes('Suite')));
  assert.equal(v.enLecture, false);
  delete globalThis.Capacitor;
});
