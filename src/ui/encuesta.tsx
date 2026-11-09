import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ENCUESTAS_API, enviarEncuesta, vaciarCola, type Respuesta } from '../lib/encuesta'

const TEXTOS = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', 'Excelente']

function Estrellas({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [sobre, setSobre] = useState(0)
  const activa = sobre || value
  return (
    <div className="enc-q">
      <span className="enc-l">{label}</span>
      <div className="estrellas" role="radiogroup" aria-label={label} onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${TEXTOS[n]}`}
            className={`estrella ${n <= activa ? 'on' : ''}`} onMouseEnter={() => setSobre(n)} onFocus={() => setSobre(n)} onBlur={() => setSobre(0)} onClick={() => onChange(n)}>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></svg>
          </button>
        ))}
      </div>
      <span className="small muted enc-t" aria-live="polite">{TEXTOS[activa] || 'Elige de 1 a 5 estrellas'}</span>
    </div>
  )
}

interface ModalProps { tipo: Respuesta['tipo']; titulo: string; pregunta: string; pregunta2?: string; datos?: string; pantalla?: string; onClose: () => void }
export function EncuestaModal({ tipo, titulo, pregunta, pregunta2, datos, pantalla, onClose }: ModalProps) {
  const [e1, setE1] = useState(0)
  const [e2, setE2] = useState(0)
  const [com, setCom] = useState('')
  const [estado, setEstado] = useState<'form' | 'enviando' | 'ok' | 'guardada'>('form')
  useEffect(() => { const k = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const enviar = async () => {
    if (!e1) return
    setEstado('enviando')
    const r = await enviarEncuesta({ tipo, estrellas: e1, estrellas2: pregunta2 ? e2 || undefined : undefined, comentario: com, datos, pantalla })
    setEstado(r === 'enviada' ? 'ok' : 'guardada')
  }
  // en un portal al <body>: el header tiene backdrop-filter y encerraría al modal fijo
  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={titulo} onClick={onClose}>
      <div className="modal enc" onClick={(e) => e.stopPropagation()}>
        {estado === 'ok' || estado === 'guardada' ? (
          <>
            <h3>¡Gracias!</h3>
            <p className="muted">{estado === 'ok' ? 'Recibimos tu opinión. Nos ayuda a mejorar.' : 'Guardamos tu opinión y la enviaremos en cuanto haya conexión.'}</p>
            <div className="cta"><button className="btn pri" onClick={onClose}>Cerrar</button></div>
          </>
        ) : (
          <>
            <h3>{titulo}</h3>
            <Estrellas label={pregunta} value={e1} onChange={setE1} />
            {pregunta2 && <Estrellas label={pregunta2} value={e2} onChange={setE2} />}
            <label className="enc-q"><span className="enc-l">Déjanos tus comentarios (opcional)</span>
              <textarea rows={3} maxLength={400} value={com} onChange={(e) => setCom(e.target.value)} placeholder="Lo que te gustó, lo que no, lo que te falta…" /></label>
            <div className="cta">
              <button className="btn pri" disabled={!e1 || estado === 'enviando'} onClick={() => void enviar()}>{estado === 'enviando' ? 'Enviando…' : 'Enviar'}</button>
              <button className="btn ghost" onClick={onClose}>Ahora no</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Icono en el header (persona con globo de diálogo), como el de Forma.
export function EncuestaHeader({ pantalla }: { pantalla: string }) {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { void vaciarCola() }, [])
  return (
    <>
      <button type="button" className="icon-btn" title="Cuéntanos qué te parece" aria-label="Dar tu opinión sobre Legends World Cup" onClick={() => setAbierto(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="8.5" cy="10.5" r="3" /><path d="M3 20c0-3 2.5-5.2 5.5-5.2S14 17 14 20" /><path d="M13.5 3.5h7v5.5h-3l-2.2 2.2V9h-1.8z" />
        </svg>
      </button>
      {abierto && <EncuestaModal tipo="general" titulo="¿Qué te parece Legends World Cup?" pregunta="Tu satisfacción general" pantalla={pantalla} onClose={() => setAbierto(false)} />}
    </>
  )
}

// Al terminar «Simula tu mundial»: se abre sola una vez por torneo.
export function EncuestaMundial({ seed, datos }: { seed: string; datos: string }) {
  const clave = `lwc:enc:mundial:${seed}`
  const [abierta, setAbierta] = useState(false)
  useEffect(() => {
    let hecha = false
    try { hecha = localStorage.getItem(clave) === '1' } catch { /* sin almacenamiento */ }
    if (hecha) return
    const t = setTimeout(() => setAbierta(true), 2500)
    return () => clearTimeout(t)
  }, [clave])
  const cerrar = () => { setAbierta(false); try { localStorage.setItem(clave, '1') } catch { /* sin almacenamiento */ } }
  if (!abierta) return null
  return <EncuestaModal tipo="mundial" titulo="¿Cómo estuvo tu mundial?" pregunta="¿Qué tan entretenida fue la experiencia?" pregunta2="¿Qué tan realistas te parecieron los resultados?" datos={datos} pantalla="fin-mundial" onClose={cerrar} />
}

// Vista de administración (#/encuestas): lee las respuestas con la clave de administrador (no se guarda en ningún lado).
interface Fila { t: string; e: number; e2?: number; c?: string; d?: string; p?: string; f: number }
export function EncuestasAdmin() {
  const [clave, setClave] = useState('')
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [err, setErr] = useState('')
  const cargar = async () => {
    setErr('')
    try {
      const r = await fetch(`${ENCUESTAS_API}/api/encuestas`, { headers: { Authorization: `Bearer ${clave}` } })
      if (r.status === 401) { setErr('Clave incorrecta.'); return }
      if (!r.ok) { setErr('No se pudieron leer las respuestas.'); return }
      setFilas(((await r.json()) as { respuestas: Fila[] }).respuestas)
    } catch { setErr('No se pudo conectar con el servidor.') }
  }
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '—')
  const por = (t: string) => (filas ?? []).filter((x) => x.t === t)
  return (
    <section className="sec">
      <header className="sec-h"><div><h2>Encuestas</h2><p className="muted">Respuestas del icono del header y de la encuesta al final de «Simula tu mundial».</p></div></header>
      {!ENCUESTAS_API && <p className="note warn">Las encuestas aún no están conectadas a un servidor. Ejecuta <code>bash worker/encuestas.sh</code>.</p>}
      {!filas && (
        <div className="filters">
          <label className="seed">Clave de administrador <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="off" /></label>
          <button className="btn pri" disabled={!clave || !ENCUESTAS_API} onClick={() => void cargar()}>Ver respuestas</button>
        </div>
      )}
      {err && <p className="note warn">{err}</p>}
      {filas && (
        <>
          <div className="board">
            <div className="mcard"><b>General</b><p>{por('general').length} respuestas · promedio {avg(por('general').map((x) => x.e))} ★</p></div>
            <div className="mcard"><b>Fin del mundial</b><p>{por('mundial').length} respuestas · entretenida {avg(por('mundial').map((x) => x.e))} ★ · realismo {avg(por('mundial').filter((x) => x.e2).map((x) => x.e2!))} ★</p></div>
          </div>
          <ul className="admin-enc">
            {filas.map((x, i) => (
              <li key={i}><span className="estrellas-txt">{'★'.repeat(x.e)}{'☆'.repeat(5 - x.e)}{x.e2 ? ` · realismo ${x.e2}/5` : ''}</span>
                <span className="muted small"> {x.t === 'general' ? 'General' : 'Fin del mundial'} · {new Date(x.f).toLocaleString('es-CL')}{x.d ? ` · ${x.d}` : ''}</span>
                {x.c && <p>{x.c}</p>}</li>
            ))}
            {filas.length === 0 && <li className="muted">Todavía nadie respondió.</li>}
          </ul>
        </>
      )}
    </section>
  )
}
