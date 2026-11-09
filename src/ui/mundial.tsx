import { useMemo, useState } from 'react'
import { HOSTS, HOST_BY_ID, MONTHS, monthTemp, seasonOfMonth } from '../data/world'
import { PLAYERS, STORY_MATCHES } from '../data'
import { TEAM_BY_ID } from '../data/lookup'
import { drawGroups, newAlt, runAll } from '../engine/model'
import { startExperience } from './pending'
import { explain } from '../engine/explain'
import { MAX_PRIMES, PRIME_BOOST, adjustments, loadHistory } from '../engine/world'
import { PRICE_USD } from '../engine/payment'
import { PayBox } from './paybox'
import { Avatar, Flag, Section, useApp } from './common'
import { BracketView } from './pages4'
import { GroupResults, WorldSummary, newSeed } from './world'
import type { AltTournament, WorldConfig } from '../types'

type Climate = NonNullable<WorldConfig['climate']>
const CLIMATES: [Climate, string, string][] = [['normal', 'Normal', 'Lo típico de la época'], ['calor', 'Ola de calor', '+6 °C'], ['lluvia', 'Año lluvioso', 'El doble de lluvia'], ['frio', 'Año frío', '−6 °C']]
const STEPS = ['Sede', 'Fecha', 'Clima', 'Leyendas en su prime', 'Pagar y jugar']

export function Mundial() {
  const { params } = useApp()
  const [step, setStep] = useState(0)
  const [hostId, setHostId] = useState('')
  const [month, setMonth] = useState(6)
  const [climate, setClimate] = useState<Climate>('normal')
  const [primes, setPrimes] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'octavos' | 'completo'>('completo')
  const [seed, setSeed] = useState(newSeed)
  const [paying, setPaying] = useState(false)
  const [quick, setQuick] = useState(false)
  const host = hostId ? HOST_BY_ID[hostId] : null
  const dT = climate === 'calor' ? 6 : climate === 'frio' ? -6 : 0

  const world = (): WorldConfig => ({ hostId, season: seasonOfMonth(month, host?.south), month, climate, primes, finalVenue: host!.venues[0].id, history: loadHistory() })
  const venueRows = host ? host.venues.map((v) => ({ v, t: v.roof ? 24 : monthTemp(v, month, host.south) + dT, rain: v.roof ? 0 : Math.min(0.95, v.rain * (climate === 'lluvia' ? 2 : 1)) })) : []
  const [finalVenue, setFinalVenue] = useState('')
  const fav = useMemo(() => {
    if (!host) return null
    const w = { ...world(), finalVenue: host.venues[0].id }
    const rows = Object.keys(TEAM_BY_ID).map((id) => {
      const tot = venueRows.reduce((a, r) => a + adjustments(id, { ctx: { venueId: r.v.id, temp: r.t, rain: r.rain, roof: r.v.roof }, world: w }).total, 0) / venueRows.length
      return { id, tot }
    }).sort((a, b) => b.tot - a.tot)
    return { best: rows.slice(0, 3), worst: rows.slice(-3).reverse() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, month, climate])

  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return [...PLAYERS].filter((p) => p.starter && (!n || p.name.toLowerCase().includes(n) || TEAM_BY_ID[p.teamId].name.toLowerCase().includes(n))).sort((a, b) => b.ovr - a.ovr).slice(0, 18)
  }, [q])
  const toggle = (id: string) => setPrimes((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_PRIMES ? [...c, id] : c))

  const go = (receiptId: string) => {
    setPaying(true)
    try {
      const w = { ...world(), finalVenue: finalVenue || host!.venues[0].id, receipt: receiptId }
      const groups = mode === 'completo' ? drawGroups(seed, params, host!.teamId) : undefined
      startExperience(runAll(newAlt(seed, mode, STORY_MATCHES, params, w, groups), params))
    } finally { setPaying(false) }
  }


  const canNext = step === 0 ? !!host : true
  return (
    <>
      <Section title="Simula tu mundial" sub="Arma las condiciones del torneo: sede, fecha, clima y leyendas en su mejor momento. El campeón sale de ahí.">
        <ol className="stepper">{STEPS.map((l, i) => <li key={l} className={i === step ? 'on' : i < step ? 'ok' : ''}><button disabled={i > 0 && !host} onClick={() => setStep(i)}><i>{i + 1}</i>{l}</button></li>)}</ol>

        {step === 0 && (
          <div className="hostgrid">
            {HOSTS.map((h) => (
              <button key={h.id} className={`hostcard ${hostId === h.id ? 'on' : ''}`} onClick={() => { setHostId(h.id); setFinalVenue(h.venues[0].id) }}>
                <img className="hflag" src={`https://flagcdn.com/w160/${h.iso}.png`} alt={`Bandera de ${h.name}`} loading="lazy" />
                <b>{h.name}</b>
                <span>{h.venues.length} estadio{h.venues.length > 1 ? 's' : ''} · {h.venues.some((v) => v.alt > 1000) ? 'altura' : h.venues.some((v) => v.roof) ? 'techado' : 'nivel del mar'}</span>
                {h.teamId && <em><Flag id={h.teamId} size={14} /> juega de local</em>}
              </button>
            ))}
          </div>
        )}

        {step === 1 && host && (
          <>
            <p className="muted">¿Cuándo se juega en {host.name}? El color muestra el calor típico de ese mes.</p>
            <div className="months">
              {MONTHS.map((m, i) => {
                const t = host.venues.reduce((a, v) => a + (v.roof ? 24 : monthTemp(v, i + 1, host.south)), 0) / host.venues.length
                return <button key={m} className={month === i + 1 ? 'on' : ''} style={{ ['--heat' as string]: String(Math.max(0, Math.min(1, (t - 2) / 34))) }} onClick={() => setMonth(i + 1)}><b>{m.slice(0, 3)}</b><span>{Math.round(t)}°</span></button>
              })}
            </div>
          </>
        )}

        {step === 2 && host && (
          <>
            <p className="muted">Clima esperado en {host.name} en {MONTHS[month - 1].toLowerCase()}. Puedes elegir un año atípico.</p>
            <div className="chips">{CLIMATES.map(([k, l, d]) => <button key={k} className={`chip ${climate === k ? 'on' : ''}`} onClick={() => setClimate(k)}><b>{l}</b><span>{d}</span></button>)}</div>
            <div className="venues">
              {venueRows.map(({ v, t, rain }) => (
                <div key={v.id} className="vcard">
                  <b>{v.name}</b><span className="muted">{v.city} · {v.alt} m</span>
                  <div className="vt"><strong>{v.roof ? 'Techado' : `${Math.round(t)} °C`}</strong><span>{v.roof ? 'climatizado 24 °C' : `${Math.round(rain * 100)} % de lluvia`}</span></div>
                </div>
              ))}
            </div>
            {fav && (
              <div className="two fav">
                <div><h4 className="sub">Les favorece este clima</h4>{fav.best.map((r) => <p key={r.id}><Flag id={r.id} size={18} /> {TEAM_BY_ID[r.id].name} <b className="pos">{r.tot >= 0 ? '+' : ''}{(r.tot * 100).toFixed(1)} %</b></p>)}</div>
                <div><h4 className="sub">Les perjudica</h4>{fav.worst.map((r) => <p key={r.id}><Flag id={r.id} size={18} /> {TEAM_BY_ID[r.id].name} <b className="neg">{(r.tot * 100).toFixed(1)} %</b></p>)}</div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="muted">Opcional: elige hasta {MAX_PRIMES} leyendas que llegan en su prime (+{PRIME_BOOST} de valoración) a este mundial. Cambia el campeón más de lo que parece. <b>{primes.length}/{MAX_PRIMES}</b></p>
            {primes.length > 0 && <div className="chosen">{primes.map((id) => { const p = PLAYERS.find((x) => x.id === id)!; return <button key={id} className="pill" onClick={() => toggle(id)}><Avatar p={p} size={32} /> {p.name} ✕</button> })}</div>}
            <input className="search" placeholder="Buscar jugador o selección…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="plist">
              {list.map((p) => (
                <button key={p.id} className={`prow ${primes.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id)} disabled={!primes.includes(p.id) && primes.length >= MAX_PRIMES}>
                  <Avatar p={p} size={40} /><span><b>{p.name}</b><em>{TEAM_BY_ID[p.teamId].name} · {p.pos}</em></span><i>{p.ovr}{primes.includes(p.id) ? <u> → {p.ovr + PRIME_BOOST}</u> : ''}</i>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && host && (
          <>
            <div className="summary">
              <h4>Tu mundial</h4>
              <ul className="why">
                <li>Sede: <b>{host.name}</b>{host.teamId && ` (${TEAM_BY_ID[host.teamId].name} juega de local)`}</li>
                <li>Fecha: <b>{MONTHS[month - 1]}</b> · clima: <b>{CLIMATES.find((c) => c[0] === climate)![1]}</b></li>
                <li>Leyendas en su prime: <b>{primes.length ? primes.map((id) => PLAYERS.find((p) => p.id === id)!.name).join(', ') : 'ninguna'}</b></li>
              </ul>
            </div>
            <div className="filters">
              <label className="seed">Estadio de la final <select value={finalVenue || host.venues[0].id} onChange={(e) => setFinalVenue(e.target.value)}>{host.venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.city}</option>)}</select></label>
              <label className="seed">Formato <select value={mode} onChange={(e) => setMode(e.target.value as 'octavos' | 'completo')}><option value="completo">Mundial completo</option><option value="octavos">Desde octavos</option></select></label>
              <label className="seed">Semilla <input value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
            </div>
            <PayBox what={`Mundial en ${host.name} · ${MONTHS[month - 1]}`} onPaid={go} disabled={paying} />
          </>
        )}

        <div className="cta wiz">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</button>
          {step < 4 && <button className="btn hot" disabled={!host} onClick={() => setQuick(true)} title="Paga y simula con lo que ya elegiste">⚡ Pagar US$ {PRICE_USD}.00 y jugar ya</button>}
          {step < 4 && <button className="btn pri" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 3 && primes.length === 0 ? 'Omitir' : 'Siguiente'}</button>}
        </div>
        {step === 0 && !host && <p className="small muted center">Elige un país sede para continuar o para pagar de una vez.</p>}
      </Section>
      {quick && host && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Pago rápido simulado" onClick={() => !paying && setQuick(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pago rápido</h3>
            <ul className="why">
              <li>Sede: <b>{host.name}</b>{host.teamId && ` (${TEAM_BY_ID[host.teamId].name} juega de local)`}</li>
              <li>Fecha: <b>{MONTHS[month - 1]}</b> · clima: <b>{CLIMATES.find((c) => c[0] === climate)![1]}</b></li>
              <li>Leyendas en su prime: <b>{primes.length ? primes.map((id) => PLAYERS.find((p) => p.id === id)!.name).join(', ') : 'ninguna'}</b></li>
              <li>Total: <b>US$ {PRICE_USD}.00</b></li>
            </ul>
            <p className="small muted">Lo que no elegiste usa valores por defecto. Puedes cerrar y personalizar fecha, clima y leyendas antes de pagar.</p>
            <PayBox what={`Mundial en ${host.name} · ${MONTHS[month - 1]}`} onPaid={go} disabled={paying} />
            <div className="cta"><button className="btn ghost" disabled={paying} onClick={() => setQuick(false)}>Personalizar</button></div>
          </div>
        </div>
      )}
    </>
  )
}

export function Reveal({ t, onAgain }: { t: AltTournament; onAgain: () => void }) {
  const { params } = useApp()
  const f = t.bracket.final
  const champ = t.bracket.champion!
  const why = useMemo(() => explain(f.a!, f.b!, params, { ga: f.ga!, gb: f.gb!, goals: f.goals ?? [], et: !!f.et, pens: f.pens, winner: f.winner }, { ctx: f.ctx, world: t.world }), [t])
  return (
    <>
      <Section title="¡Tenemos campeón!">
        <div className="champ big reveal"><Flag id={champ} size={88} /><div><span className="muted">Campeón del mundial</span><b>{TEAM_BY_ID[champ].name}</b></div></div>
        <WorldSummary alt={t} />
        <p className="center">Final: <b>{TEAM_BY_ID[f.a!].name} {f.ga}–{f.gb} {TEAM_BY_ID[f.b!].name}</b>{f.pens ? ` (penales ${f.pens[0]}–${f.pens[1]})` : f.et ? ' (prórroga)' : ''}</p>
        <div className="why-box"><h4>¿Qué influyó en la final?</h4><p>{why.verdictText}</p><ul className="why">{why.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
        <div className="cta"><button className="btn pri" onClick={onAgain}>Simular otro mundial</button><a className="btn" href="#/cuadro">Ver en Eliminatorias</a></div>
      </Section>
      <Section title="Cuadro"><BracketView view="alt" /></Section>
      <GroupResults alt={t} />
    </>
  )
}
