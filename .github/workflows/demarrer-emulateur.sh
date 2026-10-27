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
sudo udevadm settle --timeout=30 || true
# La règle udev s'applique de façon asynchrone : on attend que /dev/kvm soit accessible (30 s au plus).
kvm=""
for _ in $(seq 1 30); do [ -r /dev/kvm ] && [ -w /dev/kvm ] && { kvm=1; break; }; sleep 1; done
[ -n "$kvm" ] || echec "KVM indisponible"

# Un seul emplacement pour l'appareil virtuel, imposé à avdmanager ET à l'émulateur (sur les machines GitHub, ils ne cherchaient pas
# au même endroit : « Unknown AVD name »).
export ANDROID_AVD_HOME="${RUNNER_TEMP:-/tmp}/avd"
mkdir -p "$ANDROID_AVD_HOME"
: > "$JOURNAL"
sdkm="$SDK/cmdline-tools/latest/bin/sdkmanager"
yes | timeout 300 "$sdkm" --licenses > /dev/null 2>&1 || true
timeout 1200 "$sdkm" platform-tools emulator "$IMAGE" >> "$JOURNAL" 2>&1 || echec "téléchargement du SDK et de l'image"
echo no | timeout 300 "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n essai -k "$IMAGE" -p "$ANDROID_AVD_HOME/essai.avd" --force >> "$JOURNAL" 2>&1 \
  || echec "création de l'appareil virtuel"
[ -f "$ANDROID_AVD_HOME/essai.ini" ] || echec "appareil virtuel absent après sa création"
"$SDK/emulator/emulator" -accel-check >> "$JOURNAL" 2>&1 || true

nohup "$SDK/emulator/emulator" -avd essai -no-window -no-audio -no-boot-anim -no-snapshot -accel on -gpu swiftshader_indirect >> "$JOURNAL" 2>&1 &
PID=$!
vu=""
for _ in $(seq 1 60); do
  kill -0 "$PID" 2>/dev/null || echec "émulateur arrêté avant d'être vu par adb"
  [ "$(timeout 10 "$ADB" get-state 2>/dev/null)" = "device" ] && { vu=1; break; }
  sleep 5
done
[ -n "$vu" ] || echec "appareil jamais vu par adb (5 min)"
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
