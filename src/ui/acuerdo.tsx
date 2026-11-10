import { useEffect, useState } from 'react'
import { tr } from '../i18n'
import { escucharAcuerdo, leerMiAcuerdo, votarAcuerdo, type Acuerdo } from '../cloud/datos'
import { NUBE_ACTIVA, cuentaActual, entrarConGoogle, esperarCambiosDeSesion } from '../cloud/firebase'
import { useLocalState } from './common'

// Valores iniciales de referencia (65 a favor, 50 en contra): los votos de la gente se suman a ellos. Se muestra en porcentaje.
const INICIAL = { si: 65, no: 50 }

// 👍 / 👎 sutil sobre el campeón: «¿estás de acuerdo?». Un voto por cuenta (hay que entrar con Google); se puede cambiar y los porcentajes se actualizan al instante.
export function AcuerdoCampeon() {
  const [voto, setVoto] = useLocalState<Acuerdo | null>('lwc:acuerdo', null)
  const [real, setReal] = useState({ si: 0, no: 0 })
  const [conCuenta, setConCuenta] = useState(false)
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let off: (() => void) | undefined, offVivo: (() => void) | undefined, fuera = false
    void escucharAcuerdo(setReal).then((f) => { if (fuera) f(); else offVivo = f }) // en vivo para todos
    void (async () => {
      const c = await cuentaActual(); setConCuenta(!!c && !c.anonimo)
      off = await esperarCambiosDeSesion((cu) => {
        const ok = !!cu && !cu.anonimo
        setConCuenta(ok)
        // el voto de esta cuenta manda; si la nube aún no lo tiene (falló antes o se votó sin conexión), se guarda ahora
        if (ok) void leerMiAcuerdo().then((v) => { if (v) setVoto(v); else { const local = leerLocal(); if (local) void votarAcuerdo(local) } })
      })
    })()
    return () => { fuera = true; off?.(); offVivo?.() }
  }, [])
  const leerLocal = (): Acuerdo | null => { try { const v = localStorage.getItem('lwc:acuerdo'); return v === 'si' || v === 'no' ? v : null } catch { return null } }
  const si = INICIAL.si + real.si, no = INICIAL.no + real.no, total = si + no
  const pct = (n: number) => `${Math.round((n / total) * 100)} %`
  const registrar = async (v: Acuerdo) => {
    if (v === voto) return
    const antes = voto
    setReal((p) => { const q = { ...p }; if (antes && q[antes] > 0) q[antes]--; q[v]++; return q })
    setVoto(v)
    // cada voto se guarda; si falla (sin conexión), se reintenta al volver la conexión y al entrar de nuevo
    const ok = await votarAcuerdo(v)
    if (!ok) window.addEventListener('online', () => void votarAcuerdo(v), { once: true })
  }
  const elegir = (v: Acuerdo) => {
    if (NUBE_ACTIVA && !conCuenta) { void entrarConGoogle().then(() => registrar(v)).catch(() => undefined); return } // un voto por cuenta: primero se entra con Google
    void registrar(v)
  }
  const ayuda = `${tr('¿Estás de acuerdo con el campeón?')} · ${tr('Porcentajes iniciales de referencia; los votos de la gente se van sumando (uno por cuenta).')}`
  return (
    <div className="acuerdo" role="group" aria-label={tr('¿Estás de acuerdo con el campeón?')} title={ayuda}>
      <button type="button" className={`ac-b${voto === 'si' ? ' on' : ''}`} aria-pressed={voto === 'si'} aria-label={tr('De acuerdo')} onClick={() => elegir('si')}><span aria-hidden>👍</span><b>{pct(si)}</b></button>
      <button type="button" className={`ac-b${voto === 'no' ? ' on' : ''}`} aria-pressed={voto === 'no'} aria-label={tr('En desacuerdo')} onClick={() => elegir('no')}><span aria-hidden>👎</span><b>{pct(no)}</b></button>
    </div>
  )
}
