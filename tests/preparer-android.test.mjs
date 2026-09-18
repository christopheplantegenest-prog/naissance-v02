import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparerManifeste } from '../outils-android/preparer.mjs';

const MANIFESTE = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="@string/app_name"></application>
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`;

test('micro et services vocaux ajoutés une seule fois', () => {
  const une = preparerManifeste(MANIFESTE);
  assert.equal((une.match(/RECORD_AUDIO/g) || []).length, 1);
  assert.match(une, /<queries>[\s\S]*android\.speech\.RecognitionService[\s\S]*android\.intent\.action\.TTS_SERVICE[\s\S]*<\/queries>\n<\/manifest>/);
  assert.equal(preparerManifeste(une), une, 'deuxième passage sans effet');
  assert.ok(une.includes('android.permission.INTERNET'));
});

test('manifeste inattendu : refus clair', () => {
  assert.throws(() => preparerManifeste('<pas-un-manifeste/>'), /manifest/);
});

import { preparerGradle, preparerMainActivity, preparerVariables, versionNdk, API_MINIMALE, VERSION_LLAMA } from '../outils-android/preparer.mjs';

const GRADLE = `apply plugin: 'com.android.application'

android {
    namespace "io.github.christopheplantegenest.naissanceia"
    defaultConfig {
        applicationId "io.github.christopheplantegenest.naissanceia"
        versionCode 7000
        versionName "0.7.0"
    }
}
`;

test('Gradle : compilation native armeabi-v7a ajoutée une seule fois, version intacte', () => {
  const g = preparerGradle(GRADLE, { ndkPath: '/sdk/ndk/29.0.14206865', ndkVersion: '29.0.14206865', llamaDir: '/p/app/src/main/cpp/llama.cpp' });
  assert.match(g, /ndkPath "\/sdk\/ndk\/29\.0\.14206865"/);
  assert.match(g, /ndkVersion "29\.0\.14206865"/, 'échec réel du 17/09 : Gradle exige ndkVersion identique au NDK utilisé');
  assert.match(g, /path "src\/main\/cpp\/CMakeLists\.txt"/);
  assert.match(g, /abiFilters 'armeabi-v7a'/);
  assert.match(g, /-DLLAMA_DIR=\/p\/app\/src\/main\/cpp\/llama\.cpp/);
  assert.match(g, /versionCode 7000/);
  assert.equal(preparerGradle(g, { ndkPath: 'a', ndkVersion: '1.2.3', llamaDir: 'b' }), g);
  assert.throws(() => preparerGradle('plugins {}', { ndkPath: 'a', ndkVersion: '1.2.3', llamaDir: 'b' }), /inattendu/);
  assert.throws(() => preparerGradle(GRADLE, { ndkPath: '', ndkVersion: '1.2.3', llamaDir: 'b' }), /NDK/);
  assert.throws(() => preparerGradle(GRADLE, { ndkPath: 'a', ndkVersion: '', llamaDir: 'b' }), /Version du NDK/);
  assert.throws(() => preparerGradle(GRADLE, { ndkPath: '/a"b', ndkVersion: '1.2.3', llamaDir: 'b' }), /Chemin/);
  assert.equal(VERSION_LLAMA, 'b6100', 'même version que le banc d’essai validé');
});

test('MainActivity : module du moteur local enregistré avant le démarrage', () => {
  const origine = 'package io.github.christopheplantegenest.naissanceia;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n';
  const a = preparerMainActivity(origine);
  assert.match(a, /^package io\.github\.christopheplantegenest\.naissanceia;/);
  assert.match(a, /registerPlugin\(MoteurLocalPlugin\.class\);\n\s+super\.onCreate\(savedInstanceState\);/);
  assert.equal(preparerMainActivity(a), a);
  assert.throws(() => preparerMainActivity('public class X {}'), /inattendue/);
  assert.throws(() => preparerMainActivity('package a;\npublic class MainActivity extends BridgeActivity { public void onCreate(Bundle b) {} }'), /personnalisée/);
});

test('version du NDK lue dans source.properties, sinon dans le nom du dossier', () => {
  const props = 'Pkg.Desc = Android NDK\nPkg.Revision = 29.0.14206865\nPkg.BaseRevision = 29.0.14206865\n';
  assert.equal(versionNdk('/usr/local/lib/android/sdk/ndk/xyz', () => props), '29.0.14206865');
  assert.equal(versionNdk('/sdk/ndk/27.3.13750724', () => { throw new Error('absent'); }), '27.3.13750724');
  assert.throws(() => versionNdk('/sdk/ndk-bundle', () => 'rien'), /introuvable/);
});

test('Android 6.0 minimum : exigé par llama.cpp (posix_madvise, échec réel du 17/09)', () => {
  const v = "ext {\n    minSdkVersion = 22\n    compileSdkVersion = 34\n}\n";
  assert.match(preparerVariables(v), /minSdkVersion = 23/);
  assert.match(preparerVariables(v), /compileSdkVersion = 34/);
  assert.equal(preparerVariables(preparerVariables(v)), preparerVariables(v));
  assert.equal(preparerVariables('ext {\n    minSdkVersion = 26\n}\n'), 'ext {\n    minSdkVersion = 26\n}\n', 'un minimum déjà plus élevé n’est pas abaissé');
  assert.throws(() => preparerVariables('ext {}'), /introuvable/);
  assert.equal(API_MINIMALE, 23);
});
