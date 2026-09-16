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
