#!/usr/bin/env bash
# ÉMULATEUR ANDROID DU ROBOT (ATELIER 3) — partagé par robot.yml (job « acceptation ») et atelier-3-preuve.yml.
# Machine GitHub ubuntu-24.04, KVM ; aucune donnée ni aucun secret. Chaque phase est BORNÉE dans le temps ; un échec publie une
# annotation ::error (phase + fin du journal de l'émulateur), lisible par l'API même quand les journaux ne le sont pas.
# Usage : bash .github/workflows/demarrer-emulateur.sh DOSSIER_JOURNAL   (ajoute platform-tools au PATH des étapes suivantes)
set -uo pipefail
JOURNAL="${1:?dossier du journal}/emulateur.log"
SDK="${ANDROID_HOME:?ANDROID_HOME absent}"
ADB="$SDK/platform-tools/adb"
IMAGE='system-images;android-34;google_apis;x86_64'

echec() {
  local phase="$1" detail
  detail="$( { echo "phase : $phase"; ls -l /dev/kvm 2>&1; tail -n 40 "$JOURNAL" 2>/dev/null; } | sed -e 's/%/%25/g' -e 's/\r/%0D/g' | awk 'BEGIN{ORS="%0A"} {print}')"
  echo "::error title=Émulateur Android (${phase})::${detail}"
  exit 1
}

echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules > /dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger --name-match=kvm
[ -r /dev/kvm ] && [ -w /dev/kvm ] || echec "KVM indisponible"

sdkm="$SDK/cmdline-tools/latest/bin/sdkmanager"
yes | timeout 300 "$sdkm" --licenses > /dev/null 2>&1 || true
timeout 1200 "$sdkm" platform-tools emulator "$IMAGE" > /dev/null 2>&1 || echec "téléchargement du SDK et de l'image"
echo no | timeout 300 "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n essai -k "$IMAGE" --force > /dev/null 2>&1 || echec "création de l'appareil virtuel"
"$SDK/emulator/emulator" -accel-check > "$JOURNAL" 2>&1 || true

nohup "$SDK/emulator/emulator" -avd essai -no-window -no-audio -no-boot-anim -no-snapshot -accel on -gpu swiftshader_indirect >> "$JOURNAL" 2>&1 &
PID=$!
timeout 300 "$ADB" wait-for-device || echec "appareil jamais vu par adb (5 min)"
demarre=""
for _ in $(seq 1 120); do
  kill -0 "$PID" 2>/dev/null || echec "émulateur arrêté pendant le démarrage"
  [ "$(timeout 20 "$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && { demarre=1; break; }
  sleep 5
done
[ -n "$demarre" ] || echec "démarrage d'Android non terminé (10 min)"
timeout 30 "$ADB" shell input keyevent 82 || true
echo "$SDK/platform-tools" >> "${GITHUB_PATH:-/dev/null}"
echo "émulateur prêt"
