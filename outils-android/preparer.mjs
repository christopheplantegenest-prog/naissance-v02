// === DEBUT_PREPARATION_ANDROID ===
// Appelé par le robot après la création du projet Android, avant la compilation :
//   node outils-android/preparer.mjs <dossier android>
// Ajoute au manifeste, sans doublon :
//  - la permission du micro (demandée à la personne seulement quand elle appuie sur le micro) ;
//  - la déclaration des services vocaux d'Android (obligatoire depuis Android 11 pour les trouver).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PERMISSIONS = ['android.permission.RECORD_AUDIO'];
export const SERVICES = ['android.speech.RecognitionService', 'android.intent.action.TTS_SERVICE'];

export function preparerManifeste(xml) {
  if (typeof xml !== 'string' || !xml.includes('</manifest>')) {
    throw new Error('AndroidManifest.xml inattendu : balise </manifest> introuvable.');
  }
  const ajouts = [];
  for (const p of PERMISSIONS) {
    if (!xml.includes(`android:name="${p}"`)) ajouts.push(`    <uses-permission android:name="${p}" />`);
  }
  const manquants = SERVICES.filter((s) => !xml.includes(`android:name="${s}"`));
  if (manquants.length) {
    ajouts.push('    <queries>');
    for (const s of manquants) {
      ajouts.push('        <intent>', `            <action android:name="${s}" />`, '        </intent>');
    }
    ajouts.push('    </queries>');
  }
  if (!ajouts.length) return xml;
  const i = xml.lastIndexOf('</manifest>');
  return `${xml.slice(0, i)}${ajouts.join('\n')}\n${xml.slice(i)}`;
}

function principal() {
  const dossier = process.argv[2];
  if (!dossier) throw new Error('Usage : node preparer.mjs <dossier android>');
  const chemin = path.join(dossier, 'app', 'src', 'main', 'AndroidManifest.xml');
  const avant = fs.readFileSync(chemin, 'utf8');
  fs.writeFileSync(chemin, preparerManifeste(avant));
  console.log('Manifeste Android préparé : micro et services vocaux déclarés.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  principal();
}
// === FIN_PREPARATION_ANDROID ===
