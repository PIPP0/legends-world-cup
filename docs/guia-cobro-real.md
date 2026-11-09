# Cobro real de US$ 1 (PayPal + Cloudflare Worker)

La web funciona hoy en **modo demostración** (pago simulado). Pasa a cobro real cuando se cargan dos variables públicas en GitHub.
Esta guía NO es asesoría legal ni tributaria: confirma los pasos con el SII o un contador.

## 1) Legal en Chile (hazlo antes de cobrar de verdad)
1. **Inicio de actividades en el SII** (gratis, online con Clave Única/ClaveSII): giro de desarrollo de software o servicios web.
2. **Boletas electrónicas**: el SII ofrece un emisor gratuito; hay que emitir boleta por cada venta. Consulta con tu contador el IVA (19 %) y cómo declarar ingresos en dólares.
3. **PayPal Business** a tu nombre (mismos datos que en el SII), con verificación de identidad completada.
4. **Textos legales en el sitio** (Ley del Consumidor y Ley 19.628 de datos personales): datos del proveedor (nombre o razón social, RUT, correo de contacto), precio con impuestos, qué incluye el producto, política de reembolso/retracto, y política de privacidad. Pide a un abogado que los revise.

## 2) PayPal (pruebas primero)
1. En developer.paypal.com crea una app en **Sandbox** y copia el *Client ID* (público) y el *Secret* (secreto).
2. Cuentas de prueba (comprador y vendedor) las crea PayPal en el mismo panel.

## 3) Worker de Cloudflare
Desde la carpeta `worker/`:
- `npx wrangler login`
- Edita `wrangler.toml`: pon tu `PAYPAL_CLIENT_ID` (público).
- `npx wrangler secret put PAYPAL_SECRET`  (pégalo cuando lo pida la terminal, no en el chat)
- `npx wrangler secret put SIGNING_KEY`    (una frase larga al azar)
- `npx wrangler deploy`  → te entrega una URL tipo `https://legends-pagos.<tu-cuenta>.workers.dev`

## 4) Conectar la web (GitHub → Settings → Secrets and variables → Actions → Variables)
- `PAYPAL_CLIENT_ID` = el Client ID
- `PAYMENT_API` = la URL del Worker
Luego relanza el despliegue (Actions → Deploy → Run workflow). Prueba con una cuenta compradora sandbox.

## 5) Pasar a dinero real
Con la cuenta verificada: crea la app **Live** en PayPal, cambia `PAYPAL_ENV = "live"`, el `PAYPAL_CLIENT_ID` y el secreto (`wrangler secret put PAYPAL_SECRET`), redeploy del Worker y actualiza la variable `PAYPAL_CLIENT_ID` en GitHub.

## Limitación honesta
La simulación corre en el navegador (sitio estático). El pago se confirma en el servidor, pero alguien con conocimientos podría saltarse el cobro modificando el código en su equipo. Para cerrar eso del todo habría que ejecutar la simulación en el servidor.
Además, con US$ 1 las comisiones fijas de PayPal se llevan una parte grande del cobro.
