import { describe, expect, it, vi, afterEach } from 'vitest'
import worker, { type Env } from './index'

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
    const r = await worker.fetch(post('/api/order'), env)
    expect((await r.json()).id).toBe('ORDER12345')
    const call = f.mock.calls.find((c) => String(c[0]).endsWith('/checkout/orders'))!
    expect(JSON.parse((call[1] as RequestInit).body as string).purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '1.00' })
  })
  it('confirma solo si PayPal capturó exactamente US$ 1.00', async () => {
    const ok = { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ status: 'COMPLETED', amount: { value: '1.00', currency_code: 'USD' } }] } }] }
    vi.stubGlobal('fetch', paypal(ok))
    const r = await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)
    const d = await r.json()
    expect(d.ok).toBe(true); expect(d.token).toContain('.')
  })
  it('rechaza montos distintos, pagos incompletos y órdenes inválidas', async () => {
    const low = { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ status: 'COMPLETED', amount: { value: '0.01', currency_code: 'USD' } }] } }] }
    vi.stubGlobal('fetch', paypal(low))
    expect((await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)).status).toBe(402)
    vi.stubGlobal('fetch', paypal({ status: 'PENDING' }))
    expect((await worker.fetch(post('/api/capture', { orderID: 'ORDER12345' }), env)).status).toBe(402)
    expect((await worker.fetch(post('/api/capture', { orderID: '../x' }), env)).status).toBe(400)
  })
  it('CORS solo para el sitio permitido', async () => {
    const r = await worker.fetch(new Request('https://w.test/api/order', { method: 'OPTIONS', headers: { Origin: 'https://malo.example' } }), env)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://pipp0.github.io')
  })
})
