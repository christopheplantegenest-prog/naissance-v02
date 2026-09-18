// === DEBUT_PREPARATION_ANDROID ===
// Appelé par le robot après la création du projet Android, avant la compilation :
//   node outils-android/preparer.mjs <dossier android>
// 1. Manifeste : permission du micro + déclaration des services vocaux (v0.5).
// 2. Moteur local (v0.7) :
//    - récupère llama.cpp (version figée, validée par le banc d'essai banc-llm) ;
//    - copie le code natif et le module Java du moteur local ;
//    - demande à Gradle de compiler la bibliothèque native (armeabi-v7a uniquement) ;
//    - relève le minimum Android à 6.0 (API 23), exigé par llama.cpp (posix_madvise) ;
//    - enregistre le module dans MainActivity.
// Tout est sans doublon : relancer le préparateur ne change plus rien.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PERMISSIONS = ['android.permission.RECORD_AUDIO'];
export const SERVICES = ['android.speech.RecognitionService', 'android.intent.action.TTS_SERVICE'];
export const VERSION_LLAMA = 'b6100';
export const DEPOT_LLAMA = 'https://github.com/ggml-org/llama.cpp';
export const PAQUET_JAVA = 'fr/naissance/moteurlocal';
const MARQUE_GRADLE = '// naissance: moteur local';

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

// Android 6.0 minimum : llama.cpp utilise posix_madvise, absent avant l'API 23.
export const API_MINIMALE = 23;

export function preparerVariables(texte, minimum = API_MINIMALE) {
  if (typeof texte !== 'string') throw new Error('variables.gradle illisible.');
  const m = texte.match(/minSdkVersion\s*=\s*(\d+)/);
  if (!m) throw new Error('variables.gradle inattendu : minSdkVersion introuvable.');
  if (Number(m[1]) >= minimum) return texte;
  return texte.replace(m[0], `minSdkVersion = ${minimum}`);
}

// Version du NDK installé (Gradle exige ndkVersion identique à celle du dossier ndkPath).
export function versionNdk(ndkPath, lire = (f) => fs.readFileSync(f, 'utf8')) {
  try {
    const m = lire(path.join(ndkPath, 'source.properties')).match(/^\s*Pkg\.Revision\s*=\s*([\d.]+)/m);
    if (m) return m[1];
  } catch {
    // on se rabat sur le nom du dossier
  }
  const nom = path.basename(ndkPath);
  if (/^\d+\.\d+\.\d+$/.test(nom)) return nom;
  throw new Error(`Version du NDK introuvable dans ${ndkPath}.`);
}

// Ajoute la compilation native au build.gradle du module app.
export function preparerGradle(gradle, { ndkPath, ndkVersion, llamaDir }) {
  if (typeof gradle !== 'string') throw new Error('build.gradle illisible.');
  if (gradle.includes(MARQUE_GRADLE)) return gradle;
  if (!ndkPath || !llamaDir) throw new Error('NDK ou llama.cpp introuvable.');
  if (!/^\d+\.\d+\.\d+$/.test(ndkVersion || '')) throw new Error('Version du NDK invalide.');
  if (/["\\]/.test(ndkPath + llamaDir)) throw new Error('Chemin inattendu pour le NDK ou llama.cpp.');
  const android = /^android\s*\{/m;
  const defaultConfig = /defaultConfig\s*\{/;
  if (!android.test(gradle) || !defaultConfig.test(gradle)) {
    throw new Error('build.gradle inattendu : blocs android / defaultConfig introuvables.');
  }
  let g = gradle.replace(android, [
    'android {',
    `    ${MARQUE_GRADLE}`,
    `    ndkVersion "${ndkVersion}"`,
    `    ndkPath "${ndkPath}"`,
    '    externalNativeBuild {',
    '        cmake {',
    '            path "src/main/cpp/CMakeLists.txt"',
    '        }',
    '    }',
  ].join('\n'));
  g = g.replace(defaultConfig, [
    'defaultConfig {',
    '        ndk {',
    "            abiFilters 'armeabi-v7a'",
    '        }',
    '        externalNativeBuild {',
    '            cmake {',
    `                arguments "-DLLAMA_DIR=${llamaDir}", "-DANDROID_STL=c++_static", "-DANDROID_ARM_NEON=ON"`,
    '            }',
    '        }',
  ].join('\n'));
  return g;
}

// Enregistre le module du moteur local dans l'activité principale générée par Capacitor.
export function preparerMainActivity(source) {
  if (typeof source !== 'string') throw new Error('MainActivity illisible.');
  if (source.includes('MoteurLocalPlugin')) return source;
  const paquet = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  if (!paquet || !/extends\s+BridgeActivity/.test(source)) {
    throw new Error('MainActivity inattendue : paquet ou BridgeActivity introuvable.');
  }
  if (/onCreate\s*\(/.test(source)) {
    throw new Error('MainActivity déjà personnalisée : modification automatique refusée.');
  }
  return [
    `package ${paquet[1]};`,
    '',
    'import android.os.Bundle;',
    'import com.getcapacitor.BridgeActivity;',
    'import fr.naissance.moteurlocal.MoteurLocalPlugin;',
    '',
    'public class MainActivity extends BridgeActivity {',
    '    @Override',
    '    public void onCreate(Bundle savedInstanceState) {',
    '        registerPlugin(MoteurLocalPlugin.class);',
    '        super.onCreate(savedInstanceState);',
    '    }',
    '}',
    '',
  ].join('\n');
}

export function trouverFichier(dossier, nom) {
  if (!fs.existsSync(dossier)) return null;
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) {
      const t = trouverFichier(p, nom);
      if (t) return t;
    } else if (e.name === nom) {
      return p;
    }
  }
  return null;
}

function installerMoteurLocal(dossierAndroid) {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const sources = path.join(ici, 'moteur-local');
  const app = path.join(dossierAndroid, 'app');
  const cpp = path.join(app, 'src', 'main', 'cpp');
  fs.mkdirSync(cpp, { recursive: true });

  const llamaDir = path.join(cpp, 'llama.cpp');
  if (!fs.existsSync(path.join(llamaDir, 'CMakeLists.txt'))) {
    execFileSync('git', ['clone', '--depth', '1', '--branch', VERSION_LLAMA, DEPOT_LLAMA, llamaDir], {
      stdio: 'inherit', timeout: 240000,
    });
  }
  fs.copyFileSync(path.join(sources, 'CMakeLists.txt'), path.join(cpp, 'CMakeLists.txt'));
  fs.copyFileSync(path.join(sources, 'naissance_llm.cpp'), path.join(cpp, 'naissance_llm.cpp'));

  const java = path.join(app, 'src', 'main', 'java', ...PAQUET_JAVA.split('/'));
  fs.mkdirSync(java, { recursive: true });
  for (const f of ['Natif.java', 'MoteurLocalPlugin.java']) {
    fs.copyFileSync(path.join(sources, f), path.join(java, f));
  }

  const ndkPath = process.env.ANDROID_NDK_LATEST_HOME || process.env.ANDROID_NDK_HOME || process.env.ANDROID_NDK_ROOT;
  if (!ndkPath) throw new Error('NDK Android introuvable sur la machine du robot.');
  const gradle = path.join(app, 'build.gradle');
  const variables = path.join(dossierAndroid, 'variables.gradle');
  fs.writeFileSync(variables, preparerVariables(fs.readFileSync(variables, 'utf8')));
  const ndkVersion = versionNdk(ndkPath);
  fs.writeFileSync(gradle, preparerGradle(fs.readFileSync(gradle, 'utf8'), { ndkPath, ndkVersion, llamaDir }));

  const activite = trouverFichier(path.join(app, 'src', 'main', 'java'), 'MainActivity.java');
  if (!activite) throw new Error('MainActivity.java introuvable.');
  fs.writeFileSync(activite, preparerMainActivity(fs.readFileSync(activite, 'utf8')));
  console.log(`Moteur local installé : llama.cpp ${VERSION_LLAMA}, NDK ${ndkVersion} (${ndkPath}), Android ${API_MINIMALE} minimum`);
}

function principal() {
  const dossier = process.argv[2];
  if (!dossier) throw new Error('Usage : node preparer.mjs <dossier android>');
  const manifeste = path.join(dossier, 'app', 'src', 'main', 'AndroidManifest.xml');
  fs.writeFileSync(manifeste, preparerManifeste(fs.readFileSync(manifeste, 'utf8')));
  console.log('Manifeste Android préparé : micro et services vocaux déclarés.');
  installerMoteurLocal(dossier);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  principal();
}
// === FIN_PREPARATION_ANDROID ===
