import { useEffect, useMemo, useState } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { PLAYERS } from '../data'
import { tr } from '../i18n'
import { leerRankingMvp, votarMvp, type VotoMvp } from '../cloud/datos'
import { Avatar, Flag, useLocalState } from './common'
import { posLabel } from '../i18n/nombres'

type Linea = 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT'
const LINEAS: [Linea, string][] = [['ALL', 'Todas las líneas'], ['GK', 'Porteros'], ['DEF', 'Defensas'], ['MID', 'Mediocampistas'], ['ATT', 'Atacantes']]

// Página «Elige MVP»: voto del jugador favorito (uno por persona, se puede cambiar) y ranking de los 10 más populares.
export function MvpPage() {
  const [voto, setVoto] = useLocalState<string | null>('lwc:mvp', null)
  const [ranking, setRanking] = useState<VotoMvp[] | null>(null)
  const [q, setQ] = useState('')
  const [linea, setLinea] = useState<Linea>('ALL')
  const [aviso, setAviso] = useState('')
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    const base = PLAYERS.filter((p) => linea === 'ALL' || p.line === linea)
    return (t.length >= 2 ? base.filter((p) => p.name.toLowerCase().includes(t)) : [...base].sort((a, b) => b.ovr - a.ovr)).slice(0, 24)
  }, [q, linea])
  const cargar = () => { void leerRankingMvp().then((r) => setRanking(r ?? [])) }
  useEffect(cargar, [])
  const elegir = async (id: string) => {
    setVoto(id); setAviso('')
    const ok = await votarMvp(id)
    if (!ok) setAviso(tr('Tu voto quedó guardado en este navegador; el ranking compartido no está disponible ahora.'))
    cargar()
  }
  const max = Math.max(1, ...(ranking ?? []).map((r) => r.n))
  const mio = voto ? PLAYER_BY_ID[voto] : undefined
  const validos = (ranking ?? []).filter((r) => PLAYER_BY_ID[r.id])
  const podio = validos.slice(0, 3), resto = validos.slice(3)
  const nVotos = (n: number) => (n === 1 ? tr('{n} voto', { n }) : tr('{n} votos', { n }))
  return (
    <div className="mvp-page">
      <a className="mvp-back" href="#/">← {tr('Volver al inicio')}</a>
      <header className="mvp-hero">
        <div>
          <p className="kicker">{tr('Los fans opinan')}</p>
          <h1>{tr('Elige MVP: tu jugador favorito')}</h1>
          <p className="muted">{tr('Elige al MVP del Mundial de Leyendas. Un voto por persona; puedes cambiarlo cuando quieras.')}</p>
        </div>
        <div className={`mvp-tu${mio ? ' on' : ''}`}>
          {mio ? (<><Avatar p={mio} size={72} /><div><span>{tr('Tu MVP: {name}', { name: '' })}</span><b>{mio.name}</b><small>{TEAM_BY_ID[mio.teamId].name}</small></div></>) : <p className="muted">{tr('Aún no has elegido a tu MVP.')}</p>}
        </div>
      </header>
      <div className="mvp-body">
        <section>
          <div className="mvp-tools">
            <input className="search" placeholder={tr('Buscar otro jugador…')} aria-label={tr('Buscar otro jugador…')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mvp-chips" role="group" aria-label={tr('Filtrar por línea')}>
              {LINEAS.map(([k, n]) => <button key={k} type="button" className={`mvp-chip${linea === k ? ' on' : ''}`} aria-pressed={linea === k} onClick={() => setLinea(k)}>{tr(n)}</button>)}
            </div>
          </div>
          {aviso && <p className="small muted">{aviso}</p>}
          {lista.length === 0 ? <p className="muted">{tr('Ningún jugador coincide.')}</p> : (
            <div className="mvp-grid">
              {lista.map((p) => (
                <button key={p.id} type="button" className={`mvp-card${voto === p.id ? ' on' : ''}`} onClick={() => void elegir(p.id)} aria-pressed={voto === p.id}>
                  <Avatar p={p} size={72} />
                  <b>{p.name}</b>
                  <span><Flag id={p.teamId} size={16} /> {TEAM_BY_ID[p.teamId].name}</span>
                  <small>{posLabel(p.pos)} · {p.ovr}</small>
                  {voto === p.id && <i className="mvp-ok">✓</i>}
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="mvp-ranking">
          <h2>{tr('Los 10 más populares')}</h2>
          {ranking === null ? <p className="muted small">…</p> : validos.length === 0 ? <p className="muted small">{tr('Aún no hay votos. ¡Sé el primero!')}</p> : (
            <>
              <div className="mvp-podio">
                {podio.map((r, i) => (
                  <div key={r.id} className={`p${i + 1}`}><span className="medal">{['🥇', '🥈', '🥉'][i]}</span><Avatar p={PLAYER_BY_ID[r.id]} size={i === 0 ? 64 : 48} /><b>{PLAYER_BY_ID[r.id].name}</b><em>{nVotos(r.n)}</em></div>
                ))}
              </div>
              {resto.length > 0 && (
                <ol className="mvp-rank" start={4}>
                  {resto.map((r, i) => (
                    <li key={r.id}><span className="n">{i + 4}</span><Avatar p={PLAYER_BY_ID[r.id]} size={36} />
                      <div><b>{PLAYER_BY_ID[r.id].name}</b><small>{TEAM_BY_ID[PLAYER_BY_ID[r.id].teamId].name}</small><i style={{ width: `${(r.n / max) * 100}%` }} /></div>
                      <em>{nVotos(r.n)}</em></li>
                  ))}
                </ol>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
