import { useEffect, useState } from 'react'
import { TEAM_BY_ID, PLAYER_BY_ID } from '../data/lookup'
import { STORY_MATCHES } from '../data'
import { DECLARED_R16 } from '../data/raw'
import { emptyBracket, nextPhase, advance, runAll, newAlt, DEFAULT_PARAMS, probabilities, profile, strengthRank, championOdds, simulateMatch } from '../engine/model'
import { declaredStats, statsFromEvents, teamStats, type PlayerStat } from '../engine/stats'
import { makeRng } from '../engine/rng'
import { explain } from '../engine/explain'
import { validate } from '../engine/validate'
import { Avatar, Bar, Flag, Note, ProbBar, Section, Tabs, TeamLink, useApp, useLocalState } from './common'
import { Events, KoCard } from './blocks'
import { TEAMS } from '../data'
import type { Weights } from '../types'

// ---------------- Estadísticas ----------------
export function Stats() {
  const { alt } = useApp()
  const [src, setSrc] = useState<'story' | 'alt'>('story')
  const [tab, setTab] = useState<'g' | 'a' | 'ga' | 't'>('g')
  const useAlt = src === 'alt' && alt
  const stats: PlayerStat[] = useAlt ? statsFromEvents(alt.groupMatches, alt.bracket) : declaredStats()
  const matches = useAlt ? alt.groupMatches : STORY_MATCHES
  const ts = teamStats(matches)
  const players = (key: (s: PlayerStat) => number) => stats.filter((s) => key(s) > 0).sort((a, b) => key(b) - key(a) || b.goals - a.goals).slice(0, 20)
  const rowsP = (list: PlayerStat[], val: (s: PlayerStat) => number, label: string) => (
    <table className="gt"><thead><tr><th>#</th><th className="l">Jugador</th><th className="l">País</th><th>{label}</th></tr></thead>
      <tbody>{list.map((s, i) => { const p = PLAYER_BY_ID[s.playerId]; return (
        <tr key={s.playerId}><td>{i + 1}</td><td className="l"><a className="tl" href={`#/jugador/${p.id}`}><Avatar p={p} size={28} />{p.name}</a></td><td className="l"><TeamLink id={p.teamId} size={18} /></td><td><b>{val(s)}</b></td></tr>) })}</tbody></table>
  )
  const byAttack = [...ts].sort((a, b) => b.gf - a.gf).slice(0, 8)
  const byDef = [...ts].sort((a, b) => a.ga - b.ga || b.pj - a.pj).slice(0, 8)
  return (
    <Section title="Estadísticas" sub={useAlt ? 'Torneo alternativo, calculado desde los eventos.' : 'Historia original.'}>
      {alt && <Tabs value={src} onChange={setSrc} items={[['story', 'Historia original'], ['alt', 'Torneo alternativo']]} />}
      <Tabs value={tab} onChange={setTab} items={[['g', 'Goleadores'], ['a', 'Asistencias'], ['ga', 'Goles + asist.'], ['t', 'Selecciones']]} />
      {!useAlt && <Note tone="est">Goles: declarados por la simulación original (lista de dos goles parcial). Asistencias: <b>estimación provisional</b>, no hay asistentes registrados. Las cifras se calcularán desde eventos cuando existan.</Note>}
      {tab === 'g' && rowsP(players((s) => s.goals), (s) => s.goals, 'Goles')}
      {tab === 'a' && rowsP(players((s) => s.assists), (s) => s.assists, useAlt ? 'Asist.' : 'Asist. (est.)')}
      {tab === 'ga' && rowsP(players((s) => s.goals + s.assists), (s) => s.goals + s.assists, 'G+A')}
      {tab === 't' && (
        <>
          <h3 className="sub">Mejor ataque (goles a favor)</h3>
          {byAttack.map((t) => <Bar key={t.teamId} label={TEAM_BY_ID[t.teamId].name} v={t.gf} min={0} max={Math.max(...ts.map((x) => x.gf))} right={`${t.gf}`} />)}
          <h3 className="sub">Mejor defensa (goles en contra)</h3>
          {byDef.map((t) => <Bar key={t.teamId} label={TEAM_BY_ID[t.teamId].name} v={Math.max(...ts.map((x) => x.ga)) - t.ga + 1} min={0} max={Math.max(...ts.map((x) => x.ga)) + 1} right={`${t.ga}`} />)}
          <h3 className="sub">Invictos</h3>
          <div className="flags">{ts.filter((t) => t.unbeaten).map((t) => <TeamLink key={t.teamId} id={t.teamId} />)}</div>
        </>
      )}
    </Section>
  )
}

// ---------------- Cuadro ----------------
export function BracketView({ view }: { view: 'story' | 'alt' }) {
  const { alt } = useApp()
  const br = view === 'alt' && alt ? alt.bracket : emptyBracket(DECLARED_R16)
  return (
    <div className="bracket">
      <div className="bcol"><h4>Octavos</h4>{br.r16.map((m) => <KoCard key={m.id} m={m} />)}</div>
      <div className="bcol"><h4>Cuartos</h4>{br.qf.map((m) => <KoCard key={m.id} m={m} />)}</div>
      <div className="bcol"><h4>Semifinales</h4>{br.sf.map((m) => <KoCard key={m.id} m={m} />)}</div>
      <div className="bcol"><h4>Final</h4><KoCard m={br.final} /><h4>Tercer puesto</h4><KoCard m={br.third} />
        <h4>Campeón</h4>
        <div className="champ">{br.champion ? <><Flag id={br.champion} size={48} /><b>{TEAM_BY_ID[br.champion].name}</b></> : <span className="muted">Por definir</span>}</div>
      </div>
    </div>
  )
}

export function Bracket() {
  const { alt } = useApp()
  const [view, setView] = useState<'story' | 'alt'>('story')
  return (
    <Section title="Eliminatorias" sub={view === 'story' ? 'Historia original: octavos definidos, aún sin resultados.' : 'Torneo alternativo (modo libre).'}>
      <Tabs value={view} onChange={setView} items={[['story', 'Historia original'], ['alt', 'Torneo alternativo']]} />
      {view === 'alt' && !alt && <Note>Todavía no hay torneo alternativo. <a href="#/simulador">Créalo en el simulador</a>.</Note>}
      {(view === 'story' || alt) && <BracketView view={view} />}
      {view === 'story' && <Note>Cuartos y semifinales asumen el orden de los octavos: ganador 1 vs ganador 2, 3 vs 4, 5 vs 6 y 7 vs 8. La historia continúa solo cuando tú lo decides.</Note>}
    </Section>
  )
}

// ---------------- Simulador ----------------
export function Simulator() {
  const { params, setParams, alt, setAlt } = useApp()
  const [tab, setTab] = useState<'match' | 'tour' | 'model' | 'audit'>('match')
  return (
    <>
      <Section title="Simulador" sub="El modo libre nunca sobrescribe los resultados de la historia original.">
        <Tabs value={tab} onChange={setTab} items={[['match', 'Partido'], ['tour', 'Torneo alternativo'], ['model', 'Modelo'], ['audit', 'Auditoría']]} />
      </Section>
      {tab === 'match' && <FreeMatch />}
      {tab === 'tour' && <AltTour alt={alt} setAlt={setAlt} />}
      {tab === 'model' && <Model params={params} setParams={setParams} />}
      {tab === 'audit' && <Audit />}
    </>
  )
}

function TeamSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>{[...TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
}

function LiveReplay({ a, b, res, onSkip }: { a: string; b: string; res: ReturnType<typeof simulateMatch>; onSkip: () => void }) {
  const end = res.et ? 120 : 90
  const [min, setMin] = useState(0)
  useEffect(() => {
    setMin(0)
    const t = setInterval(() => setMin((m) => { if (m >= end) { clearInterval(t); return m } return m + 1 }), 140)
    return () => clearInterval(t)
  }, [res, end])
  const shown = res.goals.filter((g) => g.minute <= min)
  const ga = shown.filter((g) => g.teamId === a).length
  const gb = shown.filter((g) => g.teamId === b).length
  const last = shown[shown.length - 1]
  const done = min >= end
  const flash = last && min - last.minute < 5 && !done
  return (
    <div className="liveb" aria-live="polite">
      <div className="lv-bar">
        <span className="lv-min">{done ? 'FIN' : `${min}'`}</span>
        <span className="lv-t"><Flag id={a} size={26} />{TEAM_BY_ID[a].name.toUpperCase()}</span>
        <b className="lv-s">{ga} – {gb}</b>
        <span className="lv-t r">{TEAM_BY_ID[b].name.toUpperCase()}<Flag id={b} size={26} /></span>
        <span className={`lv-st ${done ? '' : 'on'}`}>{done ? 'FINAL' : '● EN VIVO'}</span>
      </div>
      <div className="lv-prog"><i style={{ width: `${(min / end) * 100}%` }} /></div>
      {flash && <div className="lv-goal" key={last.minute + last.scorerId}>¡GOL! {PLAYER_BY_ID[last.scorerId].name} · {TEAM_BY_ID[last.teamId].name} · {last.minute}'</div>}
      <Events goals={shown} home={a} away={b} />
      {done && res.pens && <p className="center">Penales {res.pens[0]}–{res.pens[1]} · avanza <b>{TEAM_BY_ID[res.winner!].name}</b></p>}
      {!done && <button className="btn ghost" onClick={onSkip}>Saltar al final</button>}
    </div>
  )
}

function FreeMatch() {
  const { params } = useApp()
  const [a, setA] = useState('chi')
  const [b, setB] = useState('bra')
  const [ko, setKo] = useState(false)
  const [seed, setSeed] = useState('legends-1')
  const [n, setN] = useState(0)
  const [res, setRes] = useState<ReturnType<typeof simulateMatch> | null>(null)
  const [live, setLive] = useState(false)
  const pr = probabilities(a, b, params)
  const A = profile(a, params), B = profile(b, params)
  const ex = a !== b ? explain(a, b, params, res ?? undefined) : null
  const comps: [string, 'quality' | 'balance' | 'attack' | 'defense' | 'experience'][] = [['Calidad', 'quality'], ['Equilibrio', 'balance'], ['Ataque', 'attack'], ['Defensa', 'defense'], ['Experiencia', 'experience']]
  const run = (s: string) => setRes(simulateMatch(a, b, makeRng(s), params, ko))
  const again = () => { const s = `${seed}#${n + 1}`; setN(n + 1); setLive(true); run(s) }
  return (
    <Section title="Partido libre">
      <div className="filters"><TeamSelect value={a} onChange={(v) => { setA(v); setRes(null) }} label="Selección A" /><TeamSelect value={b} onChange={(v) => { setB(v); setRes(null) }} label="Selección B" /></div>
      <div className="filters">
        <label className="seed">Semilla <input value={seed} onChange={(e) => { setSeed(e.target.value); setN(0) }} /></label>
        <label className="chk"><input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} /> Eliminatoria (prórroga y penales)</label>
      </div>
      {a === b ? <Note tone="warn">Elige dos selecciones distintas.</Note> : (
        <>
          <ProbBar a={a} b={b} pa={pr.win} pd={pr.draw} pb={pr.loss} />
          <div className="cmp5">{comps.map(([l, k]) => (
            <div key={k} className="cmp"><b className={A[k] >= B[k] ? 'win' : ''}>{A[k].toFixed(1)}</b><span>{l}</span><b className={B[k] >= A[k] ? 'win' : ''}>{B[k].toFixed(1)}</b></div>
          ))}</div>
          <div className="two">{[a, b].map((id) => <div key={id}><h4 className="sub"><TeamLink id={id} /></h4><ol className="xi">{TEAM_BY_ID[id].xi.map((p) => <li key={p.id}><a href={`#/jugador/${p.id}`}>{p.name}</a><b>{p.ovr}</b></li>)}</ol></div>)}</div>
          {ex && (
            <div className="predict">
              <h4>Predicción del modelo</h4>
              <p className="pscore"><Flag id={a} size={28} /> {TEAM_BY_ID[a].name} <b>{ex.modal.ga}–{ex.modal.gb}</b> {TEAM_BY_ID[b].name} <Flag id={b} size={28} /></p>
              <p className="small muted">Marcador más probable. Goles esperados: {ex.expected[0].toFixed(1)} – {ex.expected[1].toFixed(1)}. Favorito: <b>{TEAM_BY_ID[ex.favorite].name}</b> ({Math.round(ex.favP * 100)} % de ganar en 90 min).</p>
              <ul className="why">{ex.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          <p className="small muted">Abajo puedes <b>simular un partido con azar</b>: el favorito gana más veces, pero a veces hay sorpresas, como en el fútbol real.</p>
          <div className="cta"><button className="btn pri" onClick={() => { setN(0); setLive(true); run(seed) }}>Ver en vivo</button><button className="btn" onClick={() => { setN(0); setLive(false); run(seed) }}>Resultado directo</button><button className="btn" onClick={again} disabled={!res}>Repetir partido</button></div>
          {res && live && <LiveReplay key={`${seed}-${n}-${a}-${b}`} a={a} b={b} res={res} onSkip={() => setLive(false)} />}
          {res && !live && (
            <div className="result">
              <div className="mh"><span><Flag id={a} size={40} /> {TEAM_BY_ID[a].name}</span><div className="mscore">{res.ga}<i>–</i>{res.gb}</div><span>{TEAM_BY_ID[b].name} <Flag id={b} size={40} /></span></div>
              {res.pens && <p className="center muted">Penales {res.pens[0]}–{res.pens[1]}</p>}
              {res.et && !res.pens && <p className="center muted">Definido en la prórroga</p>}
              {res.winner && <p className="center">Avanza: <b>{TEAM_BY_ID[res.winner].name}</b></p>}
              <Events goals={res.goals} home={a} away={b} />
              {ex && (
                <div className="why-box">
                  <h4>¿Por qué este resultado? <span className={`tag ${ex.verdict}`}>{ex.verdict === 'sorpresa' ? 'Sorpresa' : ex.verdict === 'esperado' ? 'Esperado' : 'Parejo'}</span></h4>
                  <p>{ex.verdictText}</p>
                  <ul className="why">{ex.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              <p className="small muted">Resultado ficticio generado por el modelo con la semilla «{n ? `${seed}#${n}` : seed}». Las mismas semilla y parámetros dan siempre el mismo resultado.</p>
            </div>
          )}
        </>
      )}
    </Section>
  )
}

const PHASE_LABEL = { r16: 'octavos', qf: 'cuartos', sf: 'semifinales', final: 'final y tercer puesto', done: 'terminado' } as const

function AltTour({ alt, setAlt }: { alt: ReturnType<typeof useApp>['alt']; setAlt: (a: ReturnType<typeof useApp>['alt']) => void }) {
  const { params } = useApp()
  const [seed, setSeed] = useLocalState('lwc:seed', 'torneo-1')
  const [mode, setMode] = useState<'octavos' | 'completo'>('octavos')
  const [odds, setOdds] = useState<Record<string, number> | null>(null)
  const phase = alt ? nextPhase(alt.bracket) : null
  return (
    <>
      <Section title="Torneo alternativo" sub="Se guarda solo en este navegador y es independiente de la historia.">
        <div className="filters">
          <label className="seed">Semilla <input value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'octavos' | 'completo')} aria-label="Modo">
            <option value="octavos">Desde octavos (clasificados oficiales)</option><option value="completo">Mundial completo nuevo (grupos incluidos)</option>
          </select>
        </div>
        <div className="cta">
          <button className="btn pri" onClick={() => setAlt(newAlt(seed, mode, STORY_MATCHES, params))}>{alt ? 'Reiniciar torneo' : 'Crear torneo'}</button>
          {alt && phase !== 'done' && <button className="btn" onClick={() => setAlt({ ...alt, bracket: advance(alt.bracket, alt.seed, params) })}>Simular {PHASE_LABEL[phase!]}</button>}
          {alt && phase !== 'done' && <button className="btn" onClick={() => setAlt(runAll(alt, params))}>Simular todo hasta el campeón</button>}
          {alt && <button className="btn ghost" onClick={() => setAlt(null)}>Borrar torneo alternativo</button>}
        </div>
        {alt && <p className="small muted">Semilla «{alt.seed}» · {alt.mode === 'completo' ? 'grupos simulados' : 'grupos oficiales'} · siguiente fase: {PHASE_LABEL[phase!]}.</p>}
        {alt?.bracket.champion && <div className="champ big"><Flag id={alt.bracket.champion} size={64} /><div><span className="muted">Campeón del torneo alternativo</span><b>{TEAM_BY_ID[alt.bracket.champion].name}</b></div></div>}
      </Section>
      {alt && <Section title="Cuadro"><BracketView view="alt" /></Section>}
      <Section title="¿Quién gana desde octavos?" sub="Estimación con 300 torneos simulados sobre los cruces oficiales.">
        <button className="btn" onClick={() => setOdds(championOdds(DECLARED_R16, params, 300, 'odds'))}>Calcular probabilidades</button>
        {odds && Object.entries(odds).sort((a, b) => b[1] - a[1]).map(([id, v]) => <Bar key={id} label={TEAM_BY_ID[id].name} v={v * 100} min={0} max={Math.max(...Object.values(odds)) * 100} right={`${(v * 100).toFixed(1)}%`} />)}
      </Section>
    </>
  )
}

function Model({ params, setParams }: { params: ReturnType<typeof useApp>['params']; setParams: (p: ReturnType<typeof useApp>['params']) => void }) {
  const W: [keyof Weights, string][] = [['quality', 'Calidad individual'], ['balance', 'Equilibrio táctico'], ['attack', 'Capacidad ofensiva'], ['defense', 'Solidez defensiva'], ['experience', 'Experiencia competitiva']]
  const total = Object.values(params.weights).reduce((a, b) => a + b, 0)
  const rank = strengthRank(params).slice(0, 10)
  return (
    <>
      <Section title="Ponderaciones" sub="Parámetros configurables del motor. Los cambios se guardan en este navegador.">
        {W.map(([k, l]) => (
          <label key={k} className="slider"><span>{l}</span><input type="range" min="0" max="50" value={Math.round(params.weights[k] * 100)} onChange={(e) => setParams({ ...params, weights: { ...params.weights, [k]: Number(e.target.value) / 100 } })} /><b>{Math.round((params.weights[k] / (total || 1)) * 100)}%</b></label>
        ))}
        <label className="slider"><span>Goles base por equipo</span><input type="range" min="80" max="200" value={Math.round(params.goalBase * 100)} onChange={(e) => setParams({ ...params, goalBase: Number(e.target.value) / 100 })} /><b>{params.goalBase.toFixed(2)}</b></label>
        <label className="slider"><span>Sensibilidad a la calidad</span><input type="range" min="0" max="100" value={Math.round(params.sensitivity * 1000)} onChange={(e) => setParams({ ...params, sensitivity: Number(e.target.value) / 1000 })} /><b>{params.sensitivity.toFixed(3)}</b></label>
        <label className="slider"><span>Incertidumbre del día</span><input type="range" min="0" max="40" value={Math.round(params.variance * 100)} onChange={(e) => setParams({ ...params, variance: Number(e.target.value) / 100 })} /><b>{params.variance.toFixed(2)}</b></label>
        <button className="btn ghost" onClick={() => setParams(DEFAULT_PARAMS)}>Restablecer valores del proyecto</button>
      </Section>
      <Section title="Cómo funciona">
        <ul className="rules">
          <li><b>Calidad:</b> promedio de valoraciones del once (estimaciones del modelo, no oficiales).</li>
          <li><b>Equilibrio:</b> parte de 90, resta la dispersión del once y el riesgo de la formación (4-2-4 es la más arriesgada) y suma por pivote defensivo.</li>
          <li><b>Ataque / defensa:</b> promedios ponderados según la función de cada puesto.</li>
          <li><b>Experiencia:</b> aproximación con el promedio de los cinco mejores del once.</li>
          <li>Con eso se calculan goles esperados para cada equipo; el partido se sortea con distribución de Poisson, más un factor de incertidumbre. No hay ventajas para ningún país.</li>
        </ul>
        <h3 className="sub">Fuerza global (top 10 con estos parámetros)</h3>
        {rank.map((p) => <Bar key={p.teamId} label={TEAM_BY_ID[p.teamId].name} v={p.strength} min={78} right={p.strength.toFixed(1)} />)}
      </Section>
    </>
  )
}

function Audit() {
  const checks = validate()
  const icon = { ok: '✓', warn: '!', fail: '✕' } as const
  return (
    <Section title="Auditoría de datos" sub="Validaciones automáticas sobre el torneo original.">
      <ul className="audit">{checks.map((c, i) => <li key={i} className={c.level}><i>{icon[c.level]}</i><div><b>{c.label}</b><span>{c.detail}</span></div></li>)}</ul>
    </Section>
  )
}
