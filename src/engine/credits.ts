// Saldo de mundiales comprados. Se guarda en este navegador (si se borran los datos del sitio, se pierde: guarda tu comprobante de PayPal).
const KEY = 'lwc:credits:v1'
interface Store { balance: number; orders: string[] }
const load = (): Store => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null; return s && typeof s.balance === 'number' ? s : { balance: 0, orders: [] } } catch { return { balance: 0, orders: [] } } }
const save = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* sin almacenamiento */ } }
export const getBalance = (): number => load().balance
// Cada orden de pago suma una sola vez, aunque se reintente.
export function addCredits(orderId: string, n: number): number {
  const s = load()
  if (!s.orders.includes(orderId)) { s.balance += n; s.orders = [orderId, ...s.orders].slice(0, 50); save(s) }
  return s.balance
}
export function consumeCredit(): boolean {
  const s = load()
  if (s.balance < 1) return false
  s.balance -= 1; save(s); return true
}
