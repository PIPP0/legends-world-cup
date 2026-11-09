// Servidor mínimo de pagos (Cloudflare Worker): crea el cobro en PayPal, lo captura y confirma que se pagó US$ 1.00.
// Las llaves NUNCA van en el código: PAYPAL_SECRET y SIGNING_KEY se cargan con `wrangler secret put`.
// Mínimo de KV que usamos (evita depender de @cloudflare/workers-types).
export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number; metadata?: unknown }): Promise<void>
  list(opts?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean; cursor?: string }>
}
export interface Env {
  ENCUESTAS?: KV
  ADMIN_KEY?: string // secreto para leer las respuestas
  PAYPAL_CLIENT_ID: string
  PAYPAL_SECRET: string
  PAYPAL_ENV: string // 'sandbox' | 'live'
  SIGNING_KEY: string
  ALLOWED_ORIGIN: string // p. ej. https://pipp0.github.io
}

const CURRENCY = 'USD'
// El precio de cada producto lo manda SIEMPRE el servidor (el navegador solo dice cuál quiere). Cambia aquí los precios.
export const PRODUCTS: Record<string, { usd: string; credits: number; name: string }> = {
  uno: { usd: '1.00', credits: 1, name: '1 mundial' },
  pack5: { usd: '3.00', credits: 5, name: 'Pack de 5 mundiales' },
  pack10: { usd: '5.00', credits: 10, name: 'Pack de 10 mundiales' },
}
const base = (env: Env) => (env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

const cors = (env: Env, req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin') ?? ''
  const ok = origin === env.ALLOWED_ORIGIN || /^http:\/\/localhost:\d+$/.test(origin)
  return { 'Access-Control-Allow-Origin': ok ? origin : env.ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', Vary: 'Origin' }
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
  const { product = 'uno' } = (await req.json().catch(() => ({}))) as { product?: string }
  const prod = PRODUCTS[product]
  if (!prod) return json(env, req, { ok: false, error: 'bad-product' }, 400)
  const t = await accessToken(env)
  const r = await fetch(`${base(env)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: product, description: `Legends World Cup · ${prod.name}`, amount: { currency_code: CURRENCY, value: prod.usd } }] }),
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
  const d = (await r.json()) as { status?: string; purchase_units?: { reference_id?: string; payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] }
  const cap = d.purchase_units?.[0]?.payments?.captures?.[0]
  const prod = PRODUCTS[d.purchase_units?.[0]?.reference_id ?? '']
  // solo se confirma si PayPal capturó exactamente el precio del producto
  if (!(prod && d.status === 'COMPLETED' && cap?.status === 'COMPLETED' && cap.amount?.value === prod.usd && cap.amount?.currency_code === CURRENCY)) return json(env, req, { ok: false, error: 'not-paid' }, 402)
  const token = await sign(env, { o: orderID, c: prod.credits, exp: Date.now() + 24 * 3600 * 1000 })
  return json(env, req, { ok: true, receipt: orderID, credits: prod.credits, token })
}

// ---------- Encuestas ----------
// Cada respuesta es una clave de KV; el contenido va en la metadata (≤ 1 KB) para poder listarlas todas con una sola lectura.
const TIPOS = ['general', 'mundial']
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const star = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : 0)

async function guardarEncuesta(env: Env, req: Request): Promise<Response> {
  if (!env.ENCUESTAS) return json(env, req, { ok: false, error: 'sin-almacen' }, 503)
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || !TIPOS.includes(String(b.tipo))) return json(env, req, { ok: false, error: 'bad-tipo' }, 400)
  const e = star(b.estrellas)
  if (!e) return json(env, req, { ok: false, error: 'bad-estrellas' }, 400)
  // un envío cada 60 s por conexión (anti abuso), sin guardar la IP: solo un hash
  const ip = req.headers.get('CF-Connecting-IP') ?? 'x'
  const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))).slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('')
  if (await env.ENCUESTAS.get('ip:' + h)) return json(env, req, { ok: false, error: 'espera' }, 429)
  const meta = { t: String(b.tipo), e, e2: star(b.estrellas2), c: clip(b.comentario, 400), d: clip(b.datos, 120), p: clip(b.pantalla, 40), f: Date.now() }
  await env.ENCUESTAS.put(`e:${String(meta.f).padStart(13, '0')}:${crypto.randomUUID().slice(0, 8)}`, '1', { metadata: meta })
  await env.ENCUESTAS.put('ip:' + h, '1', { expirationTtl: 60 })
  return json(env, req, { ok: true })
}

async function leerEncuestas(env: Env, req: Request): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!env.ADMIN_KEY || !env.ENCUESTAS || auth !== `Bearer ${env.ADMIN_KEY}`) return json(env, req, { ok: false, error: 'no-autorizado' }, 401)
  const out: unknown[] = []
  let cursor: string | undefined
  do {
    const r = await env.ENCUESTAS.list({ prefix: 'e:', cursor, limit: 1000 })
    out.push(...r.keys.map((k) => k.metadata))
    cursor = r.list_complete ? undefined : r.cursor
  } while (cursor && out.length < 5000)
  return json(env, req, { ok: true, respuestas: out.reverse() })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) })
    const path = new URL(req.url).pathname
    try {
      if (req.method === 'POST' && path === '/api/order') return await createOrder(env, req)
      if (req.method === 'POST' && path === '/api/capture') return await captureOrder(env, req)
      if (req.method === 'POST' && path === '/api/encuesta') return await guardarEncuesta(env, req)
      if (req.method === 'GET' && path === '/api/encuestas') return await leerEncuestas(env, req)
      return json(env, req, { ok: false, error: 'not-found' }, 404)
    } catch {
      return json(env, req, { ok: false, error: 'server' }, 500)
    }
  },
}
