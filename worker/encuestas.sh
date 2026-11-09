#!/usr/bin/env bash
# Activa las encuestas: crea el almacén (KV) en Cloudflare, una clave de administrador, sube el Worker y conecta la web.
# Uso:  bash worker/encuestas.sh
# La clave de administrador se genera sola y se muestra UNA vez aquí en tu terminal: guárdala (con ella lees las respuestas en #/encuestas).
set -euo pipefail
cd "$(dirname "$0")"

echo "-- Iniciando sesión en Cloudflare (se abre el navegador si hace falta)"
npx --yes wrangler whoami >/dev/null 2>&1 || npx --yes wrangler login

if ! grep -q 'binding = "ENCUESTAS"' wrangler.toml; then
  echo "-- Creando el almacén de respuestas"
  SALIDA="$(npx --yes wrangler kv namespace create ENCUESTAS 2>&1 | tee /dev/stderr)"
  ID="$(printf '%s' "$SALIDA" | grep -Eo '[0-9a-f]{32}' | head -1)"
  [[ -n "$ID" ]] || { echo "No pude leer el id del almacén; cópialo de arriba"; read -r -p "id: " ID; }
  printf '\n[[kv_namespaces]]\nbinding = "ENCUESTAS"\nid = "%s"\n' "$ID" >> wrangler.toml
fi

CLAVE="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
printf '%s' "$CLAVE" | npx --yes wrangler secret put ADMIN_KEY >/dev/null
echo
echo "CLAVE DE ADMINISTRADOR (guárdala, no se vuelve a mostrar): $CLAVE"
echo

echo "-- Subiendo el Worker"
SALIDA="$(npx --yes wrangler deploy 2>&1 | tee /dev/stderr)"
URL="$(printf '%s' "$SALIDA" | grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' | head -1)"
[[ -n "$URL" ]] || { echo "No pude leer la URL del Worker; cópiala de arriba"; read -r -p "URL del Worker: " URL; }

echo "-- Conectando la web"
gh variable set ENCUESTAS_API --body "$URL"
gh workflow run Deploy >/dev/null 2>&1 && echo "Despliegue de la web lanzado." || echo "Lanza el despliegue a mano: GitHub → Actions → Deploy → Run workflow"
echo "Listo. En ~1 minuto las encuestas guardan respuestas. Léelas en  https://pipp0.github.io/legends-world-cup/#/encuestas"
