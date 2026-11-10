import { useEffect, useRef, useState } from 'react'
import { useFunciones } from '../cloud/funciones'
import { DONATE_URL, PAYMENTS_LIVE, PAYMENT_API, PAYPAL_CLIENT_ID, PRODUCTS, pay, saveReceipt, type ProductId } from '../engine/payment'

declare global { interface Window { paypal?: { Buttons: (o: unknown) => { render: (el: HTMLElement) => Promise<void>; close: () => void } } } }

let sdk: Promise<void> | null = null
const loadSdk = () => (sdk ??= new Promise<void>((res, rej) => {
  if (window.paypal) return res()
  const s = document.createElement('script')
  s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=USD&intent=capture&disable-funding=credit`
  s.onload = () => res(); s.onerror = () => { sdk = null; rej(new Error('sdk')) }
  document.head.appendChild(s)
}))

// Botón de pago: real con PayPal si está configurado; si no, pago simulado de demostración.
export function PayBox({ what, product, onPaid, disabled }: { what: string; product: ProductId; onPaid: (receiptId: string, credits: number) => void; disabled?: boolean }) {
  const prod = PRODUCTS.find((p) => p.id === product)!
  const ref = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const paid = useRef(onPaid); paid.current = onPaid

  useEffect(() => {
    if (!PAYMENTS_LIVE) return
    let btn: { close: () => void } | null = null
    let dead = false
    loadSdk().then(() => {
      if (dead || !ref.current || !window.paypal) return
      const b = window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay' },
        createOrder: async () => {
          const r = await fetch(`${PAYMENT_API}/api/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product }) })
          const d = (await r.json()) as { ok: boolean; id?: string }
          if (!d.ok || !d.id) throw new Error('order')
          return d.id
        },
        onApprove: async (data: { orderID: string }) => {
          setBusy(true)
          const r = await fetch(`${PAYMENT_API}/api/capture`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderID: data.orderID }) })
          const d = (await r.json()) as { ok: boolean; receipt?: string; credits?: number }
          setBusy(false)
          if (!d.ok || !d.receipt) { setErr('El pago no pudo confirmarse. Si PayPal te cobró, escríbenos con el número de orden: ' + data.orderID); return }
          saveReceipt(d.receipt, what, false)
          paid.current(d.receipt, d.credits ?? prod.credits)
        },
        onCancel: () => setErr('Cancelaste el pago. No se cobró nada.'),
        onError: () => setErr('No se pudo iniciar el pago. Intenta de nuevo.'),
      })
      btn = b
      void b.render(ref.current)
    }).catch(() => setErr('No se pudo cargar PayPal. Revisa tu conexión e intenta de nuevo.'))
    return () => { dead = true; btn?.close() }
  }, [what, product])

  if (!PAYMENTS_LIVE) {
    return (
      <>
        <p className="note warn">Modo de demostración: no se cobra nada ni se piden datos de tarjeta.</p>
        <button className="btn pri" disabled={busy || disabled} onClick={async () => { setBusy(true); const r = await pay(what); setBusy(false); paid.current(r.id, prod.credits) }}>
          {busy ? 'Procesando pago…' : `Pagar US$ ${prod.usd}.00 (simulado)`}
        </button>
      </>
    )
  }
  return (
    <>
      <p className="small muted">Pago seguro con PayPal (tarjeta o cuenta PayPal). Esta web no ve ni guarda tus datos de pago. Total: US$ {prod.usd}.00 por {prod.name.toLowerCase()}.</p>
      <div ref={ref} aria-busy={busy} style={{ minHeight: 48, maxWidth: 360 }} />
      {busy && <p className="small muted">Confirmando el pago…</p>}
      {err && <p className="note warn">{err}</p>}
    </>
  )
}

// Apoyo voluntario: no desbloquea nada, solo agradece. Solo se muestra si hay un enlace configurado.
export function DonateBox() {
  const f = useFunciones()
  if (!f.donaciones || !DONATE_URL || !/^https:\/\//.test(DONATE_URL)) return null
  return (
    <div className="note">
      ¿Te gustó? El mundial es gratis; si quieres, puedes <b>apoyar el proyecto</b> de forma voluntaria.{' '}
      <a className="btn" href={DONATE_URL} target="_blank" rel="noopener noreferrer">☕ Apoyar (opcional)</a>
    </div>
  )
}
