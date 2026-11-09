#!/usr/bin/env bash
# Deja listo el cobro de US$ 1 con PayPal: sube el Worker de Cloudflare y conecta la web.
# Uso:  bash worker/configurar.sh sandbox     (pruebas, no cobra dinero real)
#       bash worker/configurar.sh live        (cobra dinero real; solo con cuenta PayPal verificada)
# El secreto de PayPal se pega AQUÍ, en tu terminal. Nunca en el chat.
set -euo pipefail
ENTORNO="${1:-sandbox}"
[[ "$ENTORNO" == "sandbox" || "$ENTORNO" == "live" ]] || { echo "Usa: sandbox o live"; exit 1; }
cd "$(dirname "$0")"

echo "== Cobro de US\$ 1 · modo: $ENTORNO =="
read -r -p "Client ID de PayPal (público, de developer.paypal.com → tu app $ENTORNO): " CLIENT_ID
[[ -n "$CLIENT_ID" ]] || { echo "Falta el Client ID"; exit 1; }

echo "-- Iniciando sesión en Cloudflare (se abre el navegador si hace falta)"
npx --yes wrangler whoami >/dev/null 2>&1 || npx --yes wrangler login

echo "-- Pega el SECRET de PayPal cuando lo pida (no se muestra ni se guarda en archivos)"
npx --yes wrangler secret put PAYPAL_SECRET

echo "-- Generando la llave de firma automáticamente"
openssl rand -base64 48 | npx --yes wrangler secret put SIGNING_KEY

echo "-- Subiendo el Worker"
SALIDA="$(npx --yes wrangler deploy --var "PAYPAL_CLIENT_ID:$CLIENT_ID" --var "PAYPAL_ENV:$ENTORNO" 2>&1 | tee /dev/stderr)"
URL="$(printf '%s' "$SALIDA" | grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' | head -1)"
[[ -n "$URL" ]] || { echo "No pude leer la URL del Worker; cópiala de la salida de arriba"; read -r -p "URL del Worker: " URL; }

echo "-- Conectando la web (variables públicas del repositorio en GitHub)"
gh variable set PAYPAL_CLIENT_ID --body "$CLIENT_ID"
gh variable set PAYMENT_API --body "$URL"
gh workflow run Deploy >/dev/null 2>&1 && echo "Despliegue de la web lanzado." || echo "Lanza el despliegue a mano: GitHub → Actions → Deploy → Run workflow"

echo "Listo. En ~1 minuto, «Simula tu mundial» mostrará los botones de PayPal ($ENTORNO)."
