import { tr } from '../i18n'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ENCUESTAS_API, enviarEncuesta, vaciarCola, type Respuesta } from '../lib/encuesta'
import { useFunciones } from '../cloud/funciones'
import { DONATE_URL } from '../engine/payment'
import { abrirDonacion } from './paybox'

const TEXTOS = ['', tr('Muy mal'), tr('Mal'), tr('Normal'), tr('Bien'), tr('Excelente')]

function Estrellas({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [sobre, setSobre] = useState(0)
  const activa = sobre || value
  return (
    <div className="enc-q">
      <span className="enc-l">{label}</span>
      <div className="estrellas" role="radiogroup" aria-label={label} onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? tr('estrella') : tr('estrellas')}: ${TEXTOS[n]}`}
            className={`estrella ${n <= activa ? 'on' : ''}`} onMouseEnter={() => setSobre(n)} onFocus={() => setSobre(n)} onBlur={() => setSobre(0)} onClick={() => onChange(n)}>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></svg>
          </button>
        ))}
      </div>
      <span className="small muted enc-t" aria-live="polite">{TEXTOS[activa] || tr('Elige de 1 a 5 estrellas')}</span>
    </div>
  )
}

interface ModalProps { tipo: Respuesta['tipo']; titulo: string; pregunta: string; pregunta2?: string; datos?: string; pantalla?: string; onClose: () => void }
export function EncuestaModal({ tipo, titulo, pregunta, pregunta2, datos, pantalla, onClose }: ModalProps) {
  const donaciones = useFunciones().donaciones
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
            <h3>{tr('¡Gracias!')}</h3>
            <p className="muted">{estado === 'ok' ? tr('Recibimos tu opinión. Nos ayuda a mejorar.') : tr('Guardamos tu opinión y la enviaremos en cuanto haya conexión.')}</p>
            {tipo === 'mundial' && donaciones && /^https:\/\//.test(DONATE_URL) && <p className="enc-donar small muted">{tr('Si disfrutaste la experiencia, puedes apoyar el proyecto. Es voluntario.')}</p>}
            <div className="cta">
              <button className="btn pri" onClick={onClose}>{tr('Cerrar')}</button>
              {tipo === 'mundial' && donaciones && /^https:\/\//.test(DONATE_URL) && <button className="btn ghost" onClick={() => { onClose(); abrirDonacion() }}>{tr('☕ Apoyar (opcional)')}</button>}
            </div>
          </>
        ) : (
          <>
            <h3>{titulo}</h3>
            <Estrellas label={pregunta} value={e1} onChange={setE1} />
            {pregunta2 && <Estrellas label={pregunta2} value={e2} onChange={setE2} />}
            <label className="enc-q"><span className="enc-l">{tr('Déjanos tus comentarios (opcional)')}</span>
              <textarea rows={3} maxLength={400} value={com} onChange={(e) => setCom(e.target.value)} placeholder={tr('Lo que te gustó, lo que no, lo que te falta…')} /></label>
            <div className="cta">
              <button className="btn pri" disabled={!e1 || estado === 'enviando'} onClick={() => void enviar()}>{estado === 'enviando' ? tr('Enviando…') : tr('Enviar')}</button>
              <button className="btn ghost" onClick={onClose}>{tr('Ahora no')}</button>
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
  const f = useFunciones()
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { void vaciarCola() }, [])
  if (!f.encuestas) return null
  return (
    <>
      <button type="button" className="icon-btn" title={tr('Cuéntanos qué te parece')} aria-label={tr('Dar tu opinión sobre Legends World Cup')} onClick={() => setAbierto(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="8.5" cy="10.5" r="3" /><path d="M3 20c0-3 2.5-5.2 5.5-5.2S14 17 14 20" /><path d="M13.5 3.5h7v5.5h-3l-2.2 2.2V9h-1.8z" />
        </svg>
      </button>
      {abierto && <EncuestaModal tipo="general" titulo={tr('¿Qué te parece Legends World Cup?')} pregunta={tr('Tu satisfacción general')} pantalla={pantalla} onClose={() => setAbierto(false)} />}
    </>
  )
}

// Al terminar «Simula tu mundial» no se interrumpe con ventanas: queda una tarjeta tranquila al final, y la persona responde cuando quiere.
export function EncuestaMundial({ seed, datos }: { seed: string; datos: string }) {
  const f = useFunciones()
  const [abierta, setAbierta] = useState(false)
  const [hecha, setHecha] = useState(false)
  useEffect(() => { setHecha(false); setAbierta(false) }, [seed])
  if (!f.encuestas) return null
  return (
    <>
      {!hecha && (
        <div className="note enc-card">
          <span><b>{tr('¿Cómo estuvo tu mundial?')}</b> {tr('Tu opinión toma menos de un minuto y nos ayuda a mejorar.')}</span>{' '}
          <button type="button" className="btn" onClick={() => setAbierta(true)}>{tr('Dar mi opinión')}</button>
        </div>
      )}
      {abierta && <EncuestaModal tipo="mundial" titulo={tr('¿Cómo estuvo tu mundial?')} pregunta={tr('¿Qué tan entretenida fue la experiencia?')} pregunta2={tr('¿Qué tan realistas te parecieron los resultados?')} datos={datos} pantalla="fin-mundial" onClose={() => { setAbierta(false); setHecha(true) }} />}
    </>
  )
}
