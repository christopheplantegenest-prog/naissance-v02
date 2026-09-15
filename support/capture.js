// === DEBUT_CAPTURE_MICRO ===
// NAISSANCE V0.2 - Support navigateur.
// Ouvre le micro et pousse des blocs d'echantillons bruts vers l'organisme.
// Tout ce qui est specifique au navigateur est ici : ce fichier sera jete
// le jour d'une migration vers Android.

export async function ouvrirMicro(config, surBloc) {

  // === DEBUT_CONTRAINTES_MICRO ===
  // On refuse explicitement les traitements automatiques du navigateur :
  // ils modifient le spectre et le volume avant que nous voyions quoi que
  // ce soit. Certains pilotes Android en appliquent malgre tout une partie.
  const contraintes = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    },
    video: false
  };
  // === FIN_CONTRAINTES_MICRO ===

  const flux = await navigator.mediaDevices.getUserMedia(contraintes);

  let contexte;
  try {
    contexte = new AudioContext({ sampleRate: config.audio.feSouhaitee });
  } catch (e) {
    contexte = new AudioContext();
  }
  if (contexte.state === 'suspended') {
    await contexte.resume();
  }

  await contexte.audioWorklet.addModule('./support/worklet-capture.js');

  const source = contexte.createMediaStreamSource(flux);
  const noeud = new AudioWorkletNode(contexte, 'capture-naissance', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    processorOptions: { taille: config.audio.tailleBlocWorklet }
  });

  let echantillonsRecus = 0;
  let blocsSansEntree = 0;

  noeud.port.onmessage = (ev) => {
    const d = ev.data;
    echantillonsRecus = echantillonsRecus + d.echantillons.length;
    blocsSansEntree = d.blocsSansEntree;
    surBloc(d.echantillons);
  };

  source.connect(noeud);

  const pisteAudio = flux.getAudioTracks()[0];
  const reglages = pisteAudio.getSettings ? pisteAudio.getSettings() : {};

  return {
    fe: contexte.sampleRate,
    reglages: reglages,
    debutMs: (typeof performance !== 'undefined') ? performance.now() : Date.now(),
    etat: () => ({
      echantillonsRecus: echantillonsRecus,
      blocsSansEntree: blocsSansEntree,
      etatContexte: contexte.state
    }),
    fermer: async () => {
      try { noeud.port.onmessage = null; } catch (e) {}
      try { source.disconnect(); } catch (e) {}
      try { noeud.disconnect(); } catch (e) {}
      for (const p of flux.getTracks()) { p.stop(); }
      try { await contexte.close(); } catch (e) {}
    }
  };
}
// === FIN_CAPTURE_MICRO ===
