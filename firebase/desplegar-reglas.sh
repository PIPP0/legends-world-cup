#!/usr/bin/env bash
# Sube las reglas de seguridad de Firestore al proyecto de Firebase de Legends World Cup.
# Uso: bash firebase/desplegar-reglas.sh ID_DEL_PROYECTO
set -euo pipefail
cd "$(dirname "$0")/.."
PROYECTO="${1:-}"
[[ -n "$PROYECTO" ]] || { echo "Uso: bash firebase/desplegar-reglas.sh ID_DEL_PROYECTO"; exit 1; }
npx --yes firebase-tools@latest login --no-localhost || true
npx --yes firebase-tools@latest deploy --only firestore:rules --project "$PROYECTO"
echo "Reglas publicadas. Ahora crea el documento config/admin (ver docs/admin-nube.md, paso 5)."
