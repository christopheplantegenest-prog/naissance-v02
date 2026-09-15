// === DEBUT_CAPTURE_MICRO ===
// NAISSANCE V0.3 - Support navigateur.
// Ouvre le micro et pousse des blocs d'echantillons BRUTS, a la frequence
// NATIVE de l'appareil, vers l'organisme. La conversion vers la frequence
// sensorielle interne appartient a l'organisme, pas au support.
// Ce fichier sera jete le jour d'une migration vers Android.

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

  // === DEBUT_FREQUENCE_NATIVE ===
  // Aucune frequence n'est imposee : on constate celle de l'appareil.
  // C'est l'organisme qui convertit, avec son propre filtre, identique
  // partout. Demander 24000 ici reviendrait a laisser le reechantillonneur
  // du navigateur - different d'un navigateur a l'autre - definir ce que
  // la creature entend.
  const contexte = new AudioContext();
  if (contexte.state === 'suspended') {
    await contexte.resume();
  }
  // === FIN_FREQUENCE_NATIVE ===

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

  const piste = flux.getAudioTracks()[0];
  const reglages = piste.getSettings ? piste.getSettings() : {};

  return {
    fe: contexte.sampleRate,
    reglages: reglages,
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
