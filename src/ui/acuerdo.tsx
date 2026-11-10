import { useEffect, useMemo, useState } from 'react'
import { tr } from '../i18n'
import { leerAcuerdo, votarAcuerdo, type Acuerdo } from '../cloud/datos'
import { useLocalState } from './common'

// 👍 / 👎 sutil sobre el campeón: «¿estás de acuerdo?». Un voto por persona (se puede cambiar); los porcentajes se actualizan al instante.
export function AcuerdoCampeon() {
  const [voto, setVoto] = useLocalState<Acuerdo | null>('lwc:acuerdo', null)
  const [c, setC] = useState({ si: 0, no: 0 })
  const cargar = () => { void leerAcuerdo().then((r) => { if (r) setC(r) }) }
  useEffect(cargar, [])
  const total = c.si + c.no
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)} %` : '–')
  const elegir = async (v: Acuerdo) => {
    if (v === voto) return
    const antes = voto
    setC((p) => { const q = { ...p }; if (antes && q[antes] > 0) q[antes]--; q[v]++; return q })
    setVoto(v)
    await votarAcuerdo(v)
    cargar()
  }
  const etiqueta = useMemo(() => tr('¿Estás de acuerdo con el campeón?'), [])
  return (
    <div className="acuerdo" role="group" aria-label={etiqueta} title={etiqueta}>
      <button type="button" className={`ac-b${voto === 'si' ? ' on' : ''}`} aria-pressed={voto === 'si'} aria-label={tr('De acuerdo')} onClick={() => void elegir('si')}><span aria-hidden>👍</span><b>{pct(c.si)}</b></button>
      <button type="button" className={`ac-b${voto === 'no' ? ' on' : ''}`} aria-pressed={voto === 'no'} aria-label={tr('En desacuerdo')} onClick={() => void elegir('no')}><span aria-hidden>👎</span><b>{pct(c.no)}</b></button>
    </div>
  )
}
