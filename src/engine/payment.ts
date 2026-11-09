// PAGO SIMULADO. No se cobra nada ni se piden datos de tarjeta.
// Todo el flujo pasa por `pay()`: cuando exista un proveedor real (Stripe, Flow, etc.) solo hay que reemplazar esta función
// por una llamada al backend que cree el cobro y devuelva el comprobante.
export const PRICE_USD = 1
export interface Receipt { id: string; amountUsd: number; at: string; simulated: true; what: string }

const KEY = 'lwc:receipts:v1'
export const loadReceipts = (): Receipt[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Receipt[] } catch { return [] } }

export async function pay(what: string): Promise<Receipt> {
  await new Promise((r) => setTimeout(r, 1400)) // simula el procesamiento
  const rec: Receipt = { id: 'SIM-' + Math.random().toString(36).slice(2, 8).toUpperCase(), amountUsd: PRICE_USD, at: new Date().toISOString(), simulated: true, what }
  try { localStorage.setItem(KEY, JSON.stringify([rec, ...loadReceipts()].slice(0, 20))) } catch { /* sin almacenamiento */ }
  return rec
}
