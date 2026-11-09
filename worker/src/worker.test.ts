import { describe, expect, it, vi, afterEach } from 'vitest'
import worker, { type Env, type KV } from './index'

const env: Env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 's', PAYPAL_ENV: 'sandbox', SIGNING_KEY: 'k', ALLOWED_ORIGIN: 'https://pipp0.github.io' }
const post = (path: string, body?: unknown) => new Request('https://w.test' + path, { method: 'POST', headers: { Origin: 'https://pipp0.github.io', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
const paypal = (capture: object | null, orderId = 'ORDER12345') =>
  vi.fn(async (url: string) => {
    if (url.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 't' }))
    if (url.endsWith('/checkout/orders')) return new Response(JSON.stringify({ id: orderId }))
    return new Response(JSON.stringify(capture))
  })
afterEach(() => vi.unstubAllGlobals())

describe('worker de pagos', () => {
  it('crea una orden de US$ 1.00', async () => {
    const f = paypal(null); vi.stubGlobal('fetch', f)
    const r = await worker.fetch(post('/api/order', { product: 'uno' }), env)
    expect((await r.json()).id).toBe('ORDER12345')
    const call = f.mock.calls.find((c) => String(c[0]).endsWith('/checkout/orders'))!
    expect(JSON.parse((call[1] as RequestInit).body as string).purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '1.00' })
  })
  it('confirma solo si PayPal capturó exactamente US$ 1.00', async () => {
    const ok = { status: 'COMPLETED', purchase_units: [{ reference_id: 'uno', payments: { captures: [{ status: 'COMPLETED', amount: { value: '1.00', currency_code: 'USD' } }] } }] }
    vi.stubGlobal('fetch', paypal(ok))
    const r = await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)
    const d = await r.json()
    expect(d.ok).toBe(true); expect(d.token).toContain('.'); expect(d.credits).toBe(1)
  })
  it('rechaza montos distintos, pagos incompletos y órdenes inválidas', async () => {
    const low = { status: 'COMPLETED', purchase_units: [{ reference_id: 'uno', payments: { captures: [{ status: 'COMPLETED', amount: { value: '0.01', currency_code: 'USD' } }] } }] }
    vi.stubGlobal('fetch', paypal(low))
    expect((await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)).status).toBe(402)
    vi.stubGlobal('fetch', paypal({ status: 'PENDING' }))
    expect((await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)).status).toBe(402)
    expect((await worker.fetch(post('/api/capture', { orderID: '../x' }), env)).status).toBe(400)
  })
  it('los paquetes validan su precio y entregan sus mundiales', async () => {
    const cap = (value: string) => ({ status: 'COMPLETED', purchase_units: [{ reference_id: 'pack5', payments: { captures: [{ status: 'COMPLETED', amount: { value, currency_code: 'USD' } }] } }] })
    vi.stubGlobal('fetch', paypal(cap('3.00')))
    const ok = await (await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)).json()
    expect(ok.ok).toBe(true); expect(ok.credits).toBe(5)
    vi.stubGlobal('fetch', paypal(cap('1.00')))
    expect((await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)).status).toBe(402)
    expect((await worker.fetch(post('/api/order', { product: 'gratis' }), env)).status).toBe(400)
  })
  it('CORS solo para el sitio permitido', async () => {
    const r = await worker.fetch(new Request('https://w.test/api/order', { method: 'OPTIONS', headers: { Origin: 'https://malo.example' } }), env)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://pipp0.github.io')
  })
})

const memKV = (): KV & { data: Map<string, { v: string; m?: unknown }> } => {
  const data = new Map<string, { v: string; m?: unknown }>()
  return { data, get: async (k) => data.get(k)?.v ?? null, put: async (k, v, o) => { data.set(k, { v, m: o?.metadata }) }, list: async (o) => ({ keys: [...data.entries()].filter(([k]) => k.startsWith(o?.prefix ?? '')).map(([name, x]) => ({ name, metadata: x.m })), list_complete: true }) }
}
describe('encuestas', () => {
  const e2: Env = { ...env, ENCUESTAS: memKV(), ADMIN_KEY: 'admin-secreta' }
  const enviar = (body: unknown, ip = '1.1.1.1') => worker.fetch(new Request('https://w.test/api/encuesta', { method: 'POST', headers: { Origin: 'https://pipp0.github.io', 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), e2)
  it('guarda una respuesta válida y limita a una por minuto por conexión', async () => {
    expect((await enviar({ tipo: 'general', estrellas: 5, comentario: 'Muy bueno' })).status).toBe(200)
    expect((await enviar({ tipo: 'general', estrellas: 4 })).status).toBe(429)
    expect((await enviar({ tipo: 'mundial', estrellas: 4, estrellas2: 3, datos: 'Chile · junio' }, '2.2.2.2')).status).toBe(200)
  })
  it('rechaza datos inválidos', async () => {
    expect((await enviar({ tipo: 'otra', estrellas: 5 }, '3.3.3.3')).status).toBe(400)
    expect((await enviar({ tipo: 'general', estrellas: 9 }, '4.4.4.4')).status).toBe(400)
  })
  it('solo el administrador puede leer las respuestas', async () => {
    const leer = (k?: string) => worker.fetch(new Request('https://w.test/api/encuestas', { headers: k ? { Authorization: `Bearer ${k}`, Origin: 'https://pipp0.github.io' } : {} }), e2)
    expect((await leer()).status).toBe(401)
    expect((await leer('mala')).status).toBe(401)
    const ok = await (await leer('admin-secreta')).json()
    expect(ok.respuestas.length).toBe(2)
    expect(ok.respuestas[0].t).toBeDefined()
  })
})
