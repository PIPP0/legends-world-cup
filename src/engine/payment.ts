// Pagos: hay dos modos.
//  · REAL: si existen VITE_PAYPAL_CLIENT_ID y VITE_PAYMENT_API (variables públicas del build), se cobra US$ 1 con PayPal
//    (los botones de PayPal capturan los datos de pago; esta web nunca ve tarjetas) y un Worker confirma el cobro.
//  · DEMO: si faltan, `pay()` simula el pago sin cobrar nada ni pedir datos.
export const PAYPAL_CLIENT_ID = (import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined) ?? ''
export const PAYMENT_API = ((import.meta.env.VITE_PAYMENT_API as string | undefined) ?? '').replace(/\/$/, '')
export const PAYMENTS_LIVE = Boolean(PAYPAL_CLIENT_ID && PAYMENT_API)
// Productos (el servidor valida el precio real; esto es solo para mostrar). Mantén los mismos precios en worker/src/index.ts.
export const PRODUCTS = [
  { id: 'uno', credits: 1, usd: 1, name: '1 mundial' },
  { id: 'pack5', credits: 5, usd: 3, name: 'Pack de 5 mundiales' },
  { id: 'pack10', credits: 10, usd: 5, name: 'Pack de 10 mundiales' },
] as const
export type ProductId = (typeof PRODUCTS)[number]['id']
export const PRICE_USD = 1
export interface Receipt { id: string; amountUsd: number; at: string; simulated: boolean; what: string }

const KEY = 'lwc:receipts:v1'
export const loadReceipts = (): Receipt[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Receipt[] } catch { return [] } }

export async function pay(what: string): Promise<Receipt> {
  await new Promise((r) => setTimeout(r, 1400)) // simula el procesamiento
  const rec: Receipt = { id: 'SIM-' + Math.random().toString(36).slice(2, 8).toUpperCase(), amountUsd: PRICE_USD, at: new Date().toISOString(), simulated: true, what }
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...loadReceipts()].slice(0, 20))) } catch { /* sin almacenamiento */ }
  return rec
}

export function saveReceipt(id: string, what: string, simulated: boolean): Receipt {
  const rec: Receipt = { id, amountUsd: PRICE_USD, at: new Date().toISOString(), simulated, what }
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...loadReceipts()].slice(0, 20))) } catch { /* sin almacenamiento */ }
  return rec
}
