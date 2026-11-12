import { tr } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFunciones } from '../cloud/funciones'
import { NUBE_ACTIVA, cuentaActual, esperarCambiosDeSesion, type Cuenta } from '../cloud/firebase'
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

// ---------- ventana de apoyo: una sola, simple y rápida (un botón y listo) ----------
const EVENTO_DONAR = 'lwc-donar'
export const abrirDonacion = () => window.dispatchEvent(new Event(EVENTO_DONAR))
const hayEnlace = () => !!DONATE_URL && /^https:\/\//.test(DONATE_URL)

// Se monta una sola vez (en App): escucha el evento y muestra la ventana encima de todo.
// El pago se abre en una ventana emergente pequeña: la página queda abierta detrás. Si el navegador la bloquea (o en el celular), cae al comportamiento normal de nueva pestaña.
function abrirVentanaPago(e: React.MouseEvent<HTMLAnchorElement>) {
  try {
    const an = 480, al = 760
    const izq = Math.max(0, Math.round(window.screenX + (window.outerWidth - an) / 2)), arr = Math.max(0, Math.round(window.screenY + (window.outerHeight - al) / 2))
    const w = window.open(DONATE_URL, 'lwc-paypal', `popup=yes,width=${an},height=${al},left=${izq},top=${arr},scrollbars=yes,resizable=yes`)
    if (w) { e.preventDefault(); try { w.opener = null } catch { /* nada */ } }
  } catch { /* se usa el enlace normal */ }
}


// Donar sin salir de la página: montos + botones oficiales de PayPal dentro del modal (solo necesita el Client ID público; el cobro lo hace PayPal).
type AccionesPaypal = { order: { create: (o: unknown) => Promise<string>; capture: () => Promise<unknown> } }
function DonarEnModal({ alTerminar }: { alTerminar: () => void }) {
  const [monto, setMonto] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const poner = (v: string) => { setTexto(v); const n = Math.round(parseFloat(v) * 100) / 100; setMonto(n >= 1 && n <= 500 ? n : null) }
  const cambiar = (n: number) => { const c = Math.min(500, Math.max(1, Math.round(n))); setTexto(String(c)); setMonto(c) }
  const [gracias, setGracias] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  // los botones de PayPal se dibujan UNA sola vez; el monto se lee en el instante de pagar (así no parpadean al sumar o restar)
  // el formulario de tarjeta lo dibuja PayPal con texto oscuro y fondo transparente: al desplegarse se le da un fondo claro para que se lea
  const [formAbierto, setFormAbierto] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setFormAbierto(el.getBoundingClientRect().height > 200))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const cuentaPago = useRef<Cuenta | null>(null)
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let off: (() => void) | undefined; let vivo = true
    void (async () => { cuentaPago.current = await cuentaActual(); const f = await esperarCambiosDeSesion((c) => { cuentaPago.current = c }); if (vivo) off = f; else f() })()
    return () => { vivo = false; off?.() }
  }, [])
  const montoActual = useRef<number | null>(monto)
  montoActual.current = monto
  useEffect(() => {
    let btn: { close: () => void } | null = null; let dead = false
    loadSdk().then(() => {
      if (dead || !ref.current || !window.paypal) return
      const b = window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'donate', height: 42 },
        createOrder: (_d: unknown, a: AccionesPaypal) => {
          const m = montoActual.current
          if (m === null) return Promise.reject(new Error('monto'))
          const base = { intent: 'CAPTURE', purchase_units: [{ description: 'Apoyo voluntario', amount: { currency_code: 'USD', value: m.toFixed(2) } }], application_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', brand_name: 'Legends World Cup' } }
          // si la persona entró con Google, PayPal recibe su correo y nombre ya escritos (menos campos que llenar); si PayPal los rechazara, se crea igual sin ellos
          const c = cuentaPago.current
          if (c && !c.anonimo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
            const [nombre, ...resto] = (c.nombre || '').trim().split(/\s+/).filter(Boolean)
            const payer = { email_address: c.email, ...(nombre ? { name: { given_name: nombre, ...(resto.length ? { surname: resto.join(' ') } : {}) } } : {}) }
            return a.order.create({ ...base, payer }).catch(() => a.order.create(base))
          }
          return a.order.create(base)
        },
        onApprove: (_d: unknown, a: AccionesPaypal) => a.order.capture().then(() => setGracias(true)),
        onCancel: () => setErr(tr('Cancelaste el pago. No se cobró nada.')),
        onError: () => setErr(tr('No se pudo iniciar el pago. Intenta de nuevo.')),
      })
      btn = b; void b.render(ref.current)
    }).catch(() => setErr(tr('No se pudo cargar PayPal. Revisa tu conexión e intenta de nuevo.')))
    return () => { dead = true; btn?.close() }
  }, [])
  if (gracias) return <><p className="donar-gracias">{tr('¡Gracias por tu apoyo! Recibimos tu aporte.')}</p><button type="button" className="btn pri" onClick={alTerminar}>{tr('Cerrar')}</button></>
  return (
    <>
      <div className="donar-libre">
        <span className="donar-lbl" id="donar-lbl">{tr('Elige cuánto quieres aportar')}</span>
        <div className="donar-monto" role="group" aria-labelledby="donar-lbl">
          <button type="button" className="donar-paso" aria-label="−" disabled={formAbierto || (monto !== null && monto <= 1)} onClick={() => cambiar((monto ?? 2) - 1)}>−</button>
          <label className="donar-campo"><b aria-hidden>US$</b>
            <input type="number" inputMode="decimal" min={1} max={500} step="1" placeholder="0" disabled={formAbierto} value={texto} onChange={(e) => poner(e.target.value)} aria-label={tr('Elige cuánto quieres aportar') + ' (USD)'} />
            <i aria-hidden>USD</i>
          </label>
          <button type="button" className="donar-paso" aria-label="+" disabled={formAbierto || (monto !== null && monto >= 500)} onClick={() => cambiar((monto ?? 0) + 1)}>+</button>
        </div>
      </div>
      {formAbierto && <p className="small muted">{tr('Para cambiar el monto, cierra el formulario de tarjeta (✕).')}</p>}
      {monto === null && <p className="small muted">{tr('Escribe un monto entre 1 y 500.')}</p>}
      <div ref={ref} className={`donar-paypal${formAbierto ? ' abierto' : ''}${monto === null ? ' apagado' : ''}`} aria-disabled={monto === null} />
      {err && <p className="note warn">{err}</p>}
    </>
  )
}

export function DonateModalHost() {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLAnchorElement>(null)
  useEffect(() => { const f = () => setAbierto(true); window.addEventListener(EVENTO_DONAR, f); return () => window.removeEventListener(EVENTO_DONAR, f) }, [])
  useEffect(() => {
    if (!abierto) return
    const prev = document.activeElement as HTMLElement | null
    boton.current?.focus()
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', f)
    return () => { window.removeEventListener('keydown', f); prev?.focus?.() }
  }, [abierto])
  if (!abierto || !hayEnlace()) return null
  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={tr('Apoya el proyecto')} onClick={() => setAbierto(false)}>
      <div className="modal donar-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="donar-modal-x" aria-label={tr('Cerrar')} onClick={() => setAbierto(false)}>✕</button>
        <span className="donar-ic" aria-hidden>☕</span>
        <h3>{tr('Apoya el proyecto')}</h3>
        <p>{tr('Nos ayudas a crecer y seguir mejorando. Es voluntario y no desbloquea nada.')}</p>
        {PAYPAL_CLIENT_ID ? <DonarEnModal alTerminar={() => setAbierto(false)} /> : (
          <a ref={boton} className="btn pri donar-ir" href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={(e) => { ocultar(); setAbierto(false); abrirVentanaPago(e) }}>{tr('Donar con PayPal')} →</a>
        )}
        <button type="button" className="donar-no" onClick={() => setAbierto(false)}>{tr('Ahora no')}</button>
        <small className="muted">{tr('Pago seguro en PayPal: tú eliges el monto. Aquí no guardamos tus datos de pago.')}</small>
        <p className="donar-pie">{tr('💙 ¡Gracias por ser parte de esto! Cada aporte nos ayuda a seguir mejorando.')}</p>
      </div>
    </div>, document.body)
}

// Enlace discreto de apoyo (pie de página, etc.): una sola línea de texto, sin ventanas ni avisos. Solo aparece si hay enlace configurado y la función está activa.
export function DonateLink() {
  const f = useFunciones()
  if (!f.donaciones || !DONATE_URL || !/^https:\/\//.test(DONATE_URL)) return null
  return <button type="button" className="donate-link" onClick={abrirDonacion}>{tr('☕ Apoyar (opcional)')}</button>
}

// Ícono de taza en el encabezado (escritorio): mismo tamaño que los otros íconos; el texto sale al pasar el mouse.
export function DonateIcon() {
  const f = useFunciones()
  if (!f.donaciones || !DONATE_URL || !/^https:\/\//.test(DONATE_URL)) return null
  return <button type="button" className="icon-btn donate-ic" onClick={abrirDonacion} title={tr('☕ Apoyar (opcional)')} aria-label={tr('☕ Apoyar (opcional)')}><span aria-hidden>☕</span></button>
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
      <button type="button" className="btn" onClick={abrirDonacion}>{tr('☕ Apoyar (opcional)')}</button>
      <button type="button" className="donar-x" aria-label={tr('Cerrar')} title={tr('Cerrar')} onClick={() => { ocultar(); setVisible(false) }}>✕</button>
    </div>
  )
}
