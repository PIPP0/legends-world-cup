// Servidor mínimo de pagos (Cloudflare Worker): crea el cobro en PayPal, lo captura y confirma que se pagó US$ 1.00.
// Las llaves NUNCA van en el código: PAYPAL_SECRET y SIGNING_KEY se cargan con `wrangler secret put`.
export interface Env {
  PAYPAL_CLIENT_ID: string
  PAYPAL_SECRET: string
  PAYPAL_ENV: string // 'sandbox' | 'live'
  SIGNING_KEY: string
  ALLOWED_ORIGIN: string // p. ej. https://pipp0.github.io
}

const PRICE = '1.00'
const CURRENCY = 'USD'
const base = (env: Env) => (env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

const cors = (env: Env, req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin') ?? ''
  const ok = origin === env.ALLOWED_ORIGIN || /^http:\/\/localhost:\d+$/.test(origin)
  return { 'Access-Control-Allow-Origin': ok ? origin : env.ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
}
const json = (env: Env, req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(env, req) } })

async function accessToken(env: Env): Promise<string> {
  const r = await fetch(`${base(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error('paypal-auth')
  return ((await r.json()) as { access_token: string }).access_token
}

const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export async function sign(env: Env, payload: object): Promise<string> {
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return `${body}.${b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))}`
}

async function createOrder(env: Env, req: Request): Promise<Response> {
  const t = await accessToken(env)
  const r = await fetch(`${base(env)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ description: 'Legends World Cup · Simula tu mundial', amount: { currency_code: CURRENCY, value: PRICE } }] }),
  })
  const d = (await r.json()) as { id?: string }
  if (!r.ok || !d.id) return json(env, req, { ok: false, error: 'no-order' }, 502)
  return json(env, req, { ok: true, id: d.id })
}

async function captureOrder(env: Env, req: Request): Promise<Response> {
  const { orderID } = (await req.json().catch(() => ({}))) as { orderID?: string }
  if (!orderID || !/^[A-Z0-9]{10,30}$/.test(orderID)) return json(env, req, { ok: false, error: 'bad-order' }, 400)
  const t = await accessToken(env)
  const r = await fetch(`${base(env)}/v2/checkout/orders/${orderID}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `lwc-${orderID}` },
  })
  const d = (await r.json()) as { status?: string; purchase_units?: { payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] }
  const cap = d.purchase_units?.[0]?.payments?.captures?.[0]
  // solo se confirma si PayPal capturó exactamente US$ 1.00
  if (!(d.status === 'COMPLETED' && cap?.status === 'COMPLETED' && cap.amount?.value === PRICE && cap.amount?.currency_code === CURRENCY)) return json(env, req, { ok: false, error: 'not-paid' }, 402)
  const token = await sign(env, { o: orderID, exp: Date.now() + 24 * 3600 * 1000 })
  return json(env, req, { ok: true, receipt: orderID, token })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) })
    const path = new URL(req.url).pathname
    try {
      if (req.method === 'POST' && path === '/api/order') return await createOrder(env, req)
      if (req.method === 'POST' && path === '/api/capture') return await captureOrder(env, req)
      return json(env, req, { ok: false, error: 'not-found' }, 404)
    } catch {
      return json(env, req, { ok: false, error: 'server' }, 500)
    }
  },
}
