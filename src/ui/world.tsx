import { useState } from 'react'
import { HOSTS, HOST_BY_ID, HOST_OF_VENUE, MONTHS, SEASONS, VENUE_BY_ID } from '../data/world'
import { STORY_MATCHES } from '../data'
import { newAlt } from '../engine/model'
import { loadHistory } from '../engine/world'
import { PRICE_USD, loadReceipts, pay } from '../engine/payment'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { Flag, Section, useApp } from './common'
import type { AltTournament, MatchCtx, Season, WorldConfig } from '../types'

export function CtxLine({ ctx }: { ctx?: MatchCtx }) {
  if (!ctx) return null
  const v = VENUE_BY_ID[ctx.venueId]
  return (
    <span className="ctx" title={`${v.name}, ${v.city} · ${v.alt} m`}>
      🏟 {v.name} · {ctx.roof ? 'techado' : `${Math.round(ctx.temp)} °C${ctx.rain > 0 ? (ctx.rain > 0.66 ? ' · lluvia fuerte' : ' · lluvia') : ''}`}
    </span>
  )
}

export const newSeed = () => 'mundo-' + Math.random().toString(36).slice(2, 7)

type Step = 'config' | 'pay' | 'processing'

export function WorldBuilder({ setAlt }: { setAlt: (a: AltTournament | null) => void }) {
  const { params } = useApp()
  const [hostId, setHostId] = useState('mex')
  const host = HOST_BY_ID[hostId]
  const [season, setSeason] = useState<Season>('verano')
  const [finalVenue, setFinalVenue] = useState(host.venues[0].id)
  const [mode, setMode] = useState<'octavos' | 'completo'>('completo')
  const [seed, setSeed] = useState(newSeed)
  const [step, setStep] = useState<Step>('config')
  const [err, setErr] = useState('')
  const receipts = loadReceipts()
  const hist = Object.keys(loadHistory()).length

  const create = async () => {
    setStep('processing'); setErr('')
    try {
      const rec = await pay(`Mundial en ${host.name}`)
      const world: WorldConfig = { hostId, season, finalVenue, history: loadHistory(), receipt: rec.id }
      setAlt(newAlt(seed, mode, STORY_MATCHES, params, world))
      setSeed(newSeed())
      setStep('config')
    } catch { setErr('No se pudo completar el pago simulado. Intenta de nuevo.'); setStep('pay') }
  }
  const v0 = host.venues.find((x) => x.id === finalVenue) ?? host.venues[0]
  return (
    <Section title="Mundial personalizado" sub={`Elige sede, época y estadio de la final. Cada mundial cuesta US$ ${PRICE_USD}.00 (pago simulado).`}>
      <div className="filters">
        <label className="seed">País sede
          <select value={hostId} onChange={(e) => { setHostId(e.target.value); setFinalVenue(HOST_BY_ID[e.target.value].venues[0].id) }}>
            {HOSTS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select></label>
        <label className="seed">Época
          <select value={season} onChange={(e) => setSeason(e.target.value as Season)}>{Object.entries(SEASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="seed">Estadio de la final
          <select value={v0.id} onChange={(e) => setFinalVenue(e.target.value)}>{host.venues.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.city}</option>)}</select></label>
      </div>
      <div className="filters">
        <label className="seed">Formato
          <select value={mode} onChange={(e) => setMode(e.target.value as 'octavos' | 'completo')}>
            <option value="completo">Mundial completo (grupos y eliminatorias)</option><option value="octavos">Desde octavos (clasificados oficiales)</option></select></label>
        <label className="seed">Semilla <input value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
        <button className="btn" onClick={() => setSeed(newSeed())}>Nueva semilla al azar</button>
      </div>
      <p className="small muted">
        Efecto sobre los resultados: {host.teamId ? <><Flag id={host.teamId} size={16} /> {TEAM_BY_ID[host.teamId].name} juega de local. </> : `${host.name} no tiene selección en este torneo. `}
        Los estadios se reparten según la semilla; el clima se sortea por partido según la época; cada equipo rinde mejor en climas y altitudes parecidos a los suyos
        {hist ? `, y pesa el historial de los equipos en cada estadio (${hist} registros guardados en este navegador)` : ' (el historial por estadio se va acumulando a medida que terminas mundiales)'}.
        Son supuestos del modelo, no datos oficiales.
      </p>
      <div className="cta"><button className="btn pri" onClick={() => setStep('pay')}>Simular mundial — US$ {PRICE_USD}.00</button></div>
      {receipts.length > 0 && <p className="small muted">Pagos simulados anteriores: {receipts.map((r) => r.id).join(', ')}</p>}
      {step !== 'config' && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Pago simulado" onClick={() => step === 'pay' && setStep('config')}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pago simulado</h3>
            <p className="note warn">Modo de demostración: no se cobra nada ni se piden datos de tarjeta.</p>
            <ul className="why">
              <li>Producto: mundial en <b>{host.name}</b> · {SEASONS[season]}</li>
              <li>Final en {v0.name} ({v0.city}) · {mode === 'completo' ? 'mundial completo' : 'desde octavos'} · semilla «{seed}»</li>
              <li>Total: <b>US$ {PRICE_USD}.00</b></li>
            </ul>
            {err && <p className="note warn">{err}</p>}
            <div className="cta">
              <button className="btn pri" disabled={step === 'processing'} onClick={create}>{step === 'processing' ? 'Procesando pago…' : `Pagar US$ ${PRICE_USD}.00 (simulado)`}</button>
              <button className="btn ghost" disabled={step === 'processing'} onClick={() => setStep('config')}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

export function WorldSummary({ alt }: { alt: AltTournament }) {
  const w = alt.world
  if (!w) return null
  const h = HOST_BY_ID[w.hostId]
  return (
    <p className="small muted">
      Mundial en <b>{h.name}</b> · {w.month ? MONTHS[w.month - 1] : SEASONS[w.season]}{w.climate && w.climate !== 'normal' ? ` (${w.climate === 'calor' ? 'ola de calor' : w.climate === 'lluvia' ? 'año lluvioso' : 'año frío'})` : ''}{w.primes?.length ? ` · en su prime: ${w.primes.map((id) => PLAYER_BY_ID[id].name).join(', ')}` : ''} · final en {VENUE_BY_ID[w.finalVenue].name}{w.receipt ? ` · comprobante simulado ${w.receipt}` : ''}.
    </p>
  )
}

export function GroupResults({ alt }: { alt: AltTournament }) {
  if (alt.mode !== 'completo') return null
  return (
    <Section title="Fase de grupos" sub="Resultados simulados con sede y clima de cada partido.">
      <ul className="glist">
        {alt.groupMatches.map((m) => (
          <li key={m.id}><span className="gid">{m.group}</span><span className="gt"><Flag id={m.home} size={18} /> {TEAM_BY_ID[m.home].name}</span><b>{m.hg} – {m.ag}</b><span className="gt r">{TEAM_BY_ID[m.away].name} <Flag id={m.away} size={18} /></span><CtxLine ctx={m.ctx} /></li>
        ))}
      </ul>
    </Section>
  )
}
export { HOST_OF_VENUE }
