import { tr } from '../i18n'
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
          if (!d.ok || !d.receipt) { setErr(tr('El pago no pudo confirmarse. Si PayPal te cobró, escríbenos con el número de orden: ') + data.orderID); return }
          saveReceipt(d.receipt, what, false)
          paid.current(d.receipt, d.credits ?? prod.credits)
        },
        onCancel: () => setErr(tr('Cancelaste el pago. No se cobró nada.')),
        onError: () => setErr(tr('No se pudo iniciar el pago. Intenta de nuevo.')),
      })
      btn = b
      void b.render(ref.current)
    }).catch(() => setErr(tr('No se pudo cargar PayPal. Revisa tu conexión e intenta de nuevo.')))
    return () => { dead = true; btn?.close() }
  }, [what, product])

  if (!PAYMENTS_LIVE) {
    return (
      <>
        <p className="note warn">{tr('Modo de demostración: no se cobra nada ni se piden datos de tarjeta.')}</p>
        <button className="btn pri" disabled={busy || disabled} onClick={async () => { setBusy(true); const r = await pay(what); setBusy(false); paid.current(r.id, prod.credits) }}>
          {busy ? tr('Procesando pago…') : tr('Pagar US$ {u}.00 (simulado)', { u: prod.usd })}
        </button>
      </>
    )
  }
  return (
    <>
      <p className="small muted">{tr('Pago seguro con PayPal (tarjeta o cuenta PayPal). Esta web no ve ni guarda tus datos de pago. Total: US$ {u}.00 por {n}.', { u: prod.usd, n: prod.name.toLowerCase() })}</p>
      <div ref={ref} aria-busy={busy} style={{ minHeight: 48, maxWidth: 360 }} />
      {busy && <p className="small muted">{tr('Confirmando el pago…')}</p>}
      {err && <p className="note warn">{err}</p>}
    </>
  )
}

// Enlace discreto de apoyo (pie de página, etc.): una sola línea de texto, sin ventanas ni avisos. Solo aparece si hay enlace configurado y la función está activa.
export function DonateLink() {
  const f = useFunciones()
  if (!f.donaciones || !DONATE_URL || !/^https:\/\//.test(DONATE_URL)) return null
  return <a className="donate-link" href={DONATE_URL} target="_blank" rel="noopener noreferrer">{tr('☕ Apoyar (opcional)')}</a>
}

// Ícono de taza en el encabezado (escritorio): mismo tamaño que los otros íconos; el texto sale al pasar el mouse.
export function DonateIcon() {
  const f = useFunciones()
  if (!f.donaciones || !DONATE_URL || !/^https:\/\//.test(DONATE_URL)) return null
  return <a className="icon-btn donate-ic" href={DONATE_URL} target="_blank" rel="noopener noreferrer" title={tr('☕ Apoyar (opcional)')} aria-label={tr('☕ Apoyar (opcional)')}><span aria-hidden>☕</span></a>
}

// Apoyo voluntario: no desbloquea nada, solo agradece. Solo se muestra si hay un enlace configurado.
// Invitación de apoyo con mensaje según el momento. Reglas para no ser invasiva:
//  · los momentos de alegría (campeón, fin de tu mundial) siempre pueden mostrarla; los demás, solo si no se mostró ya otra en esta visita;
//  · si la persona la cierra o hace clic, no se le vuelve a mostrar por 30 días (queda el enlace pequeño del pie de página);
//  · nunca bloquea nada ni muestra montos.
type MomentoDonar = 'general' | 'mundial' | 'campeon'
const OCULTAR_DIAS = 30
const leerOculta = (): boolean => { try { const t = Number(localStorage.getItem('lwc:donar:oculta')); return t > 0 && Date.now() - t < OCULTAR_DIAS * 86_400_000 } catch { return false } }
const ocultar = () => { try { localStorage.setItem('lwc:donar:oculta', String(Date.now())) } catch { /* sin almacenamiento */ } }
let mostradaEnVisita = false

export function DonateBox({ momento = 'general' }: { momento?: MomentoDonar }) {
  const f = useFunciones()
  const [visible, setVisible] = useState(() => {
    if (leerOculta()) return false
    return momento !== 'general' || !mostradaEnVisita
  })
  useEffect(() => { if (visible) mostradaEnVisita = true }, [visible])
  if (!visible || !f.donaciones || !DONATE_URL || !/^https:\/\//.test(DONATE_URL)) return null
  const texto = momento === 'mundial'
    ? tr('¿Disfrutaste tu mundial? Nos ayudas a crecer y seguir mejorando con un apoyo voluntario.')
    : momento === 'campeon'
      ? tr('Esta historia sigue creciendo gracias a ti. Nos ayudas a crecer y seguir mejorando con un apoyo voluntario.')
      : tr('Nos ayudas a crecer y seguir mejorando. Si te gusta el proyecto, puedes apoyarlo de forma voluntaria.')
  return (
    <div className="note donar-box">
      <span>{texto}</span>{' '}
      <a className="btn" href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={ocultar}>{tr('☕ Apoyar (opcional)')}</a>
      <button type="button" className="donar-x" aria-label={tr('Cerrar')} title={tr('Cerrar')} onClick={() => { ocultar(); setVisible(false) }}>✕</button>
    </div>
  )
}
