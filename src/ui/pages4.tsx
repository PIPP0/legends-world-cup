import { DonateBox } from './paybox'
import { rich } from '../i18n/rich'
import { LANG, tr } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { TEAM_BY_ID, PLAYER_BY_ID } from '../data/lookup'
import { STORY_MATCHES } from '../data'
import { DECLARED_R16 } from '../data/raw'
import { emptyBracket, nextPhase, advance, runAll, newAlt, DEFAULT_PARAMS, probabilities, profile, strengthRank, championOdds, simulateMatch } from '../engine/model'
import { statsFromEvents, storyPlayerStats, storyTeamStats, teamStats, type PlayerStat } from '../engine/stats'
import { useStoryLevel, setLevel } from '../engine/storyLevel'
import { useFunciones } from '../cloud/funciones'
import { RONDAS, finalResult, phaseLabel, revealed, roundName, scoreText } from '../engine/historia'
import { makeRng } from '../engine/rng'
import { explain } from '../engine/explain'
import { validate } from '../engine/validate'
import { Avatar, Bar, Flag, Note, ProbBar, Section, Tabs, TeamLink, useApp, useLocalState } from './common'
import { Events, KoCard, KoRow } from './blocks'
import { Board, type Item } from './board'
import { BracketAnimado, BracketEstatico } from './bracketAnim'
import { STORY_KNOCKOUT } from '../data/storyKnockout'
import { newSeed } from './world'
import { loadHistory } from '../engine/world'
import { HOSTS, HOST_OF_VENUE, SEASONS, VENUE_BY_ID } from '../data/world'
import { contextFor } from '../engine/world'
import { TEAMS } from '../data'
import type { Bracket as BracketT, KoMatch, Season, Weights } from '../types'

// ---------------- Estadísticas ----------------
export function Stats() {
  const { alt } = useApp()
  const [src, setSrc] = useState<'story' | 'alt'>('story')
  const [tab, setTab] = useState<'g' | 'a' | 'ga' | 't'>('g')
  const useAlt = src === 'alt' && alt
  const level = useStoryLevel()
  const stats: PlayerStat[] = useAlt ? statsFromEvents(alt.groupMatches, alt.bracket) : storyPlayerStats(level)
  const matches = useAlt ? alt.groupMatches : STORY_MATCHES
  const ts = useAlt ? teamStats(matches) : storyTeamStats(matches, level).filter((t) => t.pj > 0)
  const players = (key: (s: PlayerStat) => number) => stats.filter((s) => key(s) > 0).sort((a, b) => key(b) - key(a) || b.goals - a.goals).slice(0, 20)
  const rowsP = (list: PlayerStat[], val: (s: PlayerStat) => number, label: string) => (
    <table className="gt"><thead><tr><th>#</th><th className="l">{tr('Jugador')}</th><th className="l">{tr('País')}</th><th>{label}</th></tr></thead>
      <tbody>{list.map((s, i) => { const p = PLAYER_BY_ID[s.playerId]; return (
        <tr key={s.playerId}><td>{i + 1}</td><td className="l"><a className="tl" href={`#/jugador/${p.id}`}><Avatar p={p} size={28} />{p.name}</a></td><td className="l"><TeamLink id={p.teamId} size={18} /></td><td><b>{val(s)}</b></td></tr>) })}</tbody></table>
  )
  const byAttack = [...ts].sort((a, b) => b.gf - a.gf).slice(0, 8)
  const byDef = [...ts].sort((a, b) => a.ga - b.ga || b.pj - a.pj).slice(0, 8)
  return (
    <Section title={tr('Estadísticas')} sub={useAlt ? tr('Torneo alternativo, calculado desde los eventos.') : tr('Historia original.')}>
      {alt && <Tabs value={src} onChange={setSrc} items={[['story', tr('Historia original')], ['alt', tr('Torneo alternativo')]]} />}
      <Tabs value={tab} onChange={setTab} items={[['g', tr('Goleadores')], ['a', tr('Asistencias')], ['ga', tr('Goles + asist.')], ['t', tr('Selecciones')]]} />
      {!useAlt && <Note tone="est">{rich('<b>Total del torneo:</b> goles de la fase de grupos (declarados por la simulación original, lista parcial) más los de las eliminatorias; asistencias <b>estimadas</b> en grupos.')} {level > 0 ? tr('Eliminatorias: calculadas desde los eventos de cada partido, hasta la fase que ya avanzaste ({f}). Los penales cuentan como empate.', { f: phaseLabel(level) }) : <>{tr('Las eliminatorias se suman a medida que avanzas fase por fase en')} <a href="#/cuadro">{tr('Eliminatorias')}</a>.</>}</Note>}
      {tab === 'g' && rowsP(players((s) => s.goals), (s) => s.goals, tr('Goles'))}
      {tab === 'a' && rowsP(players((s) => s.assists), (s) => s.assists, useAlt ? tr('Asist.') : tr('Asist. (est.)'))}
      {tab === 'ga' && rowsP(players((s) => s.goals + s.assists), (s) => s.goals + s.assists, 'G+A')}
      {tab === 't' && (
        <>
          <h3 className="sub">{tr('Mejor ataque (goles a favor)')}</h3>
          {byAttack.map((t) => <Bar key={t.teamId} label={TEAM_BY_ID[t.teamId].name} v={t.gf} min={0} max={Math.max(...ts.map((x) => x.gf))} right={`${t.gf}`} />)}
          <h3 className="sub">{tr('Mejor defensa (goles en contra)')}</h3>
          {byDef.map((t) => <Bar key={t.teamId} label={TEAM_BY_ID[t.teamId].name} v={Math.max(...ts.map((x) => x.ga)) - t.ga + 1} min={0} max={Math.max(...ts.map((x) => x.ga)) + 1} right={`${t.ga}`} />)}
          <h3 className="sub">{tr('Invictos')}</h3>
          <div className="flags">{ts.filter((t) => t.unbeaten).map((t) => <TeamLink key={t.teamId} id={t.teamId} />)}</div>
        </>
      )}
    </Section>
  )
}

// ---------------- Cuadro ----------------
// Historia oficial: los resultados de las eliminatorias son FIJOS (src/data/story-knockout.json), iguales para todas las personas.
// Lo único que cambia entre personas es hasta qué fase decidieron avanzar (se guarda en su navegador).
const ETAPAS = [
  { boton: tr('Avanzar a cuartos'), juega: tr('Octavos de final') },
  { boton: tr('Avanzar a semifinales'), juega: tr('Cuartos de final') },
  { boton: tr('Avanzar a la final'), juega: tr('Semifinales') },
  { boton: tr('Jugar la final y el tercer puesto'), juega: tr('Tercer puesto y final') },
] as const

const vacio = (m: KoMatch): KoMatch => ({ id: m.id, round: m.round })
const soloEquipos = (m: KoMatch): KoMatch => ({ id: m.id, round: m.round, a: m.a, b: m.b })
// Lo que se ve en el nivel L: resultados de las rondas anteriores a L, los cruces de la ronda L y nada de las siguientes.
export function visibleBracket(full: BracketT, nivel: number): BracketT {
  const pick = (m: KoMatch, ronda: number) => (ronda < nivel ? m : ronda === nivel ? soloEquipos(m) : vacio(m))
  return {
    r16: full.r16.map((m) => pick(m, 0)),
    qf: full.qf.map((m) => pick(m, 1)),
    sf: full.sf.map((m) => pick(m, 2)),
    third: pick(full.third, 3),
    final: pick(full.final, 3),
    champion: nivel >= 4 ? full.champion : undefined,
  }
}

export function BracketView({ view, level = 0 }: { view: 'story' | 'alt'; level?: number }) {
  const { alt } = useApp()
  const br = view === 'alt' && alt ? alt.bracket : visibleBracket(STORY_KNOCKOUT.bracket, level)
  return (
    <div className="bracket">
      <div className="bcol"><h4>{tr('Octavos')}</h4>{br.r16.map((m) => <KoCard key={m.id} m={m} />)}</div>
      <div className="bcol"><h4>{tr('Cuartos')}</h4>{br.qf.map((m) => <KoCard key={m.id} m={m} />)}</div>
      <div className="bcol"><h4>{tr('Semifinales')}</h4>{br.sf.map((m) => <KoCard key={m.id} m={m} />)}</div>
      <div className="bcol"><h4>{tr('Final')}</h4><KoCard m={br.final} /><h4>{tr('Tercer puesto')}</h4><KoCard m={br.third} />
        <h4>{tr('Campeón')}</h4>
        <div className="champ">{br.champion ? <><Flag id={br.champion} size={48} /><b>{TEAM_BY_ID[br.champion].name}</b></> : <span className="muted">Por definir</span>}</div>
      </div>
    </div>
  )
}

const toItem = (m: KoMatch, tag?: string): Item => ({ id: m.id, a: m.a!, b: m.b!, goals: m.goals ?? [], ga: m.ga!, gb: m.gb!, et: m.et, pens: m.pens, winner: m.winner, tag })

function CampeonDetalle() {
  const br = STORY_KNOCKOUT.bracket
  const { champion, runnerUp, third, fourth } = finalResult()
  const camino = [...br.r16, ...br.qf, ...br.sf, br.final].filter((m) => m.a === champion || m.b === champion)
  const scorers = new Map<string, number>()
  for (const m of [...br.r16, ...br.qf, ...br.sf, br.third, br.final]) for (const g of m.goals ?? []) scorers.set(g.scorerId, (scorers.get(g.scorerId) ?? 0) + 1)
  const top = [...scorers.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
  const f = br.final
  return (
    <Section title={tr('¡Tenemos campeón!')}>
      <div className="champ big reveal"><Flag id={champion} size={88} /><div><span className="muted">{tr('Campeón del Mundial de Leyendas')}</span><b>{TEAM_BY_ID[champion].name}</b></div></div>
      <div className="podio">
        <div><span>🥈 {tr('Subcampeón')}</span><TeamLink id={runnerUp} /></div>
        <div><span>🥉 {tr('Tercer lugar')}</span><TeamLink id={third} /></div>
        <div><span>{tr('Cuarto lugar')}</span><TeamLink id={fourth} /></div>
      </div>
      <div className="why-box">
        <h4>{tr('La final')}</h4>
        <p><b>{TEAM_BY_ID[f.a!].name} {scoreText(f)} {TEAM_BY_ID[f.b!].name}</b></p>
        <Events goals={f.goals ?? []} home={f.a!} away={f.b!} />
      </div>
      <h3 className="sub">{tr('El camino de {t}', { t: TEAM_BY_ID[champion].name })}</h3>
      <div className="list">{camino.map((m) => <KoRow key={m.id} m={m} />)}</div>
      <h3 className="sub">{tr('Goleadores de las eliminatorias (desde octavos de final)')}</h3>
      <p className="small muted">{tr('Solo cuenta los goles de octavos, cuartos, semifinales, tercer puesto y final. No incluye la fase de grupos. El total del torneo está en Estadísticas.')}</p>
      <ol className="rules">{top.map(([id, n]) => <li key={id}><a href={`#/jugador/${id}`}>{PLAYER_BY_ID[id].name}</a> ({TEAM_BY_ID[PLAYER_BY_ID[id].teamId].name}) · {n > 1 ? tr('{n} goles', { n }) : tr('{n} gol', { n })}</li>)}</ol>
      <p className="small muted">{tr('Las estadísticas, los partidos, las selecciones y los jugadores ya incluyen estos resultados. En Estadísticas, los goles son del torneo completo: fase de grupos más estas eliminatorias.')}</p>
      <DonateBox />
    </Section>
  )
}

export function Bracket() {
  const full = STORY_KNOCKOUT.bracket
  const nivel = useStoryLevel()
  const fun = useFunciones()
  const conAnim = fun.animacionCuadro
  const [jugando, setJugando] = useState(false)
  const [listo, setListo] = useState(false)
  // animación del cuadro: de qué fase a qué fase se está mostrando (null = cuadro estático)
  const visto = (() => { try { return sessionStorage.getItem('lwc:historia:anim') === '1' } catch { return false } })()
  const [anim, setAnim] = useState<{ from: number; to: number; key: number } | null>(() => (conAnim && nivel >= 4 && !visto ? { from: 0, to: 4, key: 0 } : null))
  const [skip, setSkip] = useState(0)
  const partidos = nivel === 0 ? full.r16 : nivel === 1 ? full.qf : nivel === 2 ? full.sf : [full.third, full.final]
  const items = nivel >= 4 ? [] : partidos.map((m) => toItem(m, m.id === 'F' ? tr('Gran final') : m.id === 'T' ? tr('Tercer puesto') : undefined))
  const done = useRef(() => setListo(true)).current
  const empezar = () => { setListo(false); setJugando(true); window.scrollTo(0, 0) }
  const terminar = () => { const antes = nivel; setJugando(false); setListo(false); setLevel(antes + 1); setSkip(0); setAnim(conAnim ? { from: antes, to: antes + 1, key: Date.now() } : null); window.scrollTo(0, 0) }
  const finAnim = useRef(() => { setAnim(null); try { sessionStorage.setItem('lwc:historia:anim', '1') } catch { /* sin almacenamiento */ } }).current
  const repetir = () => { if (nivel < 1 || !conAnim) return; setSkip(0); setJugando(false); setAnim({ from: 0, to: nivel, key: Date.now() }); window.scrollTo(0, 0) }
  const sub = anim ? tr('Así avanza el torneo…') : nivel >= 4 ? tr('Historia original: terminó. Estos resultados son los mismos para todas las personas y quedan guardados.')
    : nivel === 0 ? tr('Historia original: octavos definidos, aún sin resultados.') : tr('Historia original: ya se jugaron {x}.', { x: ETAPAS[nivel - 1].juega.toLowerCase() })
  return (
    <>
      <Section title={tr('Eliminatorias')} sub={sub}>
        {jugando && (
          <div className="historia-juega">
            <h3>{ETAPAS[nivel].juega}</h3>
            <Board key={`h${nivel}`} items={items} tick={nivel === 3 ? 90 : 70} onDone={done} />
            <div className="cta">
              {listo ? <button className="btn pri" onClick={terminar}>{nivel === 3 ? tr('Conocer al campeón') : tr('Continuar')}</button> : <span className="small muted">{tr('Cuando terminen los partidos aparecerá «{x}».', { x: nivel === 3 ? tr('Conocer al campeón') : tr('Continuar') })}</span>}
            </div>
          </div>
        )}
        {!jugando && !anim && nivel < 4 && (nivel < fun.nivelHistoria ? <div className="cta"><button className="btn hot" onClick={empezar}>{ETAPAS[nivel].boton}</button></div> : <p className="note">{tr('La siguiente fase de la historia todavía no está disponible. Vuelve pronto.')}</p>)}
        {!jugando && !anim && nivel >= 1 && conAnim && <div className="cta"><button className="btn ghost" onClick={repetir}>{tr('↺ Reiniciar animación')}</button></div>}
        {anim && <div className="cta"><button className="btn ghost" onClick={() => setSkip((k) => k + 1)}>{tr('Saltar animación')}</button><button className="btn ghost" onClick={repetir}>{tr('↺ Reiniciar animación')}</button></div>}
        {!jugando && (anim
          ? <BracketAnimado key={anim.key} full={full} from={anim.from} to={anim.to} speed={600} onEnd={finAnim} skipKey={skip} />
          : <BracketEstatico full={full} level={nivel} />)}
        {jugando && <BracketEstatico full={full} level={nivel} />}
        <Note>{tr('Los resultados de las eliminatorias de la historia original son fijos: se calcularon una sola vez y todas las personas ven los mismos. Cada quien decide cuándo avanzar de fase, y lo que ya reveló queda guardado en su navegador. Cuartos y semifinales siguen el orden de los octavos: ganador 1 vs ganador 2, 3 vs 4, 5 vs 6 y 7 vs 8.')}</Note>
      </Section>
      {nivel >= 4 && !jugando && !anim && <CampeonDetalle />}
    </>
  )
}

// ---------------- Simulador ----------------
export function Simulator() {
  const { params, setParams } = useApp()
  const [tab, setTab] = useState<'match' | 'model' | 'audit'>('match')
  return (
    <>
      <Section title={tr('Simulador')} sub={tr('El modo libre nunca sobrescribe los resultados de la historia original.')}>
        <Tabs value={tab} onChange={setTab} items={[['match', tr('Partido')], ['model', tr('Modelo')], ['audit', tr('Auditoría')]]} />
      </Section>
      {tab === 'match' && <FreeMatch />}
      {tab === 'model' && <><Model params={params} setParams={setParams} /><Odds /></>}
      {tab === 'audit' && <Audit />}
    </>
  )
}

function TeamSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>{[...TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
}

export function LiveReplay({ a, b, res, onSkip, onDone, winLabel }: { a: string; b: string; res: ReturnType<typeof simulateMatch>; onSkip: () => void; onDone?: () => void; winLabel?: string }) {
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
  useEffect(() => { if (done) onDone?.() }, [done]) // eslint-disable-line react-hooks/exhaustive-deps
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
      {flash && <div className="lv-goal" key={last.minute + last.scorerId}>{tr('¡GOL!')} {PLAYER_BY_ID[last.scorerId].name} · {TEAM_BY_ID[last.teamId].name} · {last.minute}'</div>}
      <Events goals={shown} home={a} away={b} />
      {done && !winLabel && res.pens && <p className="center">{tr('Penales {a}–{b} · avanza', { a: res.pens[0], b: res.pens[1] })} <b>{TEAM_BY_ID[res.winner!].name}</b></p>}
      {done && winLabel && res.winner && <p className="center">{res.pens ? tr('Penales {a}–{b} · ', { a: res.pens[0], b: res.pens[1] }) : res.et ? tr('Tras la prórroga · ') : ''}<b>{TEAM_BY_ID[res.winner].name}</b> {winLabel}</p>}
      {!done && <button className="btn ghost" onClick={() => { setMin(end); onSkip() }}>{tr('Saltar al final')}</button>}
    </div>
  )
}

function FreeMatch() {
  const { params } = useApp()
  const [a, setA] = useState('chi')
  const [b, setB] = useState('bra')
  const [ko, setKo] = useState(false)
  const [seed, setSeed] = useState(newSeed)
  const [venue, setVenue] = useState('')
  const [season, setSeason] = useState<Season>('templado')
  const [n, setN] = useState(0)
  const [res, setRes] = useState<ReturnType<typeof simulateMatch> | null>(null)
  const [live, setLive] = useState(false)
  const env = venue ? (() => { const w = { hostId: HOST_OF_VENUE[venue].id, season, finalVenue: venue, history: loadHistory() }; return { ctx: contextFor(w, seed + (n ? `#${n}` : ''), 'F'), world: w } })() : undefined
  const pr = probabilities(a, b, params, env)
  const A = profile(a, params), B = profile(b, params)
  const ex = a !== b ? explain(a, b, params, res ?? undefined, env) : null
  const comps: [string, 'quality' | 'balance' | 'attack' | 'defense' | 'experience'][] = [[tr('Calidad'), 'quality'], [tr('Equilibrio'), 'balance'], [tr('Ataque'), 'attack'], [tr('Defensa'), 'defense'], [tr('Experiencia'), 'experience']]
  const run = (s: string) => setRes(simulateMatch(a, b, makeRng(s), params, ko, env))
  const again = () => { const s = `${seed}#${n + 1}`; setN(n + 1); setLive(true); run(s) }
  return (
    <Section title={tr('Partido libre')}>
      <div className="filters"><TeamSelect value={a} onChange={(v) => { setA(v); setRes(null) }} label={tr('Selección A')} /><TeamSelect value={b} onChange={(v) => { setB(v); setRes(null) }} label={tr('Selección B')} /></div>
      <div className="filters">
        <label className="seed">{tr('Semilla')} <input value={seed} onChange={(e) => { setSeed(e.target.value); setN(0) }} /></label>
        <label className="seed">{tr('Estadio')}
          <select value={venue} onChange={(e) => { setVenue(e.target.value); setRes(null) }}>
            <option value="">{tr('Neutral (sin sede)')}</option>
            {HOSTS.map((h) => <optgroup key={h.id} label={h.name}>{h.venues.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.city}</option>)}</optgroup>)}
          </select></label>
        {venue && <label className="seed">{tr('Época')} <select value={season} onChange={(e) => { setSeason(e.target.value as Season); setRes(null) }}>{Object.entries(SEASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
        <label className="chk"><input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} /> {tr('Eliminatoria (prórroga y penales)')}</label>
      </div>
      {a === b ? <Note tone="warn">{tr('Elige dos selecciones distintas.')}</Note> : (
        <>
          <ProbBar a={a} b={b} pa={pr.win} pd={pr.draw} pb={pr.loss} />
          <div className="cmp5">{comps.map(([l, k]) => (
            <div key={k} className="cmp"><b className={A[k] >= B[k] ? 'win' : ''}>{A[k].toFixed(1)}</b><span>{l}</span><b className={B[k] >= A[k] ? 'win' : ''}>{B[k].toFixed(1)}</b></div>
          ))}</div>
          <div className="two">{[a, b].map((id) => <div key={id}><h4 className="sub"><TeamLink id={id} /></h4><ol className="xi">{TEAM_BY_ID[id].xi.map((p) => <li key={p.id}><a href={`#/jugador/${p.id}`}>{p.name}</a><b>{p.ovr}</b></li>)}</ol></div>)}</div>
          {ex && (
            <div className="predict">
              <h4>{tr('Predicción del modelo')}</h4>
              <p className="pscore"><Flag id={a} size={28} /> {TEAM_BY_ID[a].name} <b>{ex.modal.ga}–{ex.modal.gb}</b> {TEAM_BY_ID[b].name} <Flag id={b} size={28} /></p>
              <p className="small muted">{rich('Marcador más probable. Goles esperados: {a} – {b}. Favorito: <b>{f}</b> ({p} % de ganar en 90 min).', { a: ex.expected[0].toFixed(1), b: ex.expected[1].toFixed(1), f: TEAM_BY_ID[ex.favorite].name, p: Math.round(ex.favP * 100) })}</p>
              <ul className="why">{ex.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          <p className="small muted">{tr('Abajo puedes simular un partido con azar: el favorito gana más veces, pero a veces hay sorpresas, como en el fútbol real.')}</p>
          <div className="cta"><button className="btn pri" onClick={() => { setN(0); setLive(true); run(seed) }}>{tr('Ver en vivo')}</button><button className="btn" onClick={() => { setN(0); setLive(false); run(seed) }}>{tr('Resultado directo')}</button><button className="btn" onClick={again} disabled={!res}>{tr('Repetir partido')}</button></div>
          {res && live && <LiveReplay key={`${seed}-${n}-${a}-${b}`} a={a} b={b} res={res} onSkip={() => setLive(false)} />}
          {res && !live && (
            <div className="result">
              <div className="mh"><span><Flag id={a} size={40} /> {TEAM_BY_ID[a].name}</span><div className="mscore">{res.ga}<i>–</i>{res.gb}</div><span>{TEAM_BY_ID[b].name} <Flag id={b} size={40} /></span></div>
              {res.pens && <p className="center muted">{tr('Penales {a}–{b}', { a: res.pens[0], b: res.pens[1] })}</p>}
              {res.et && !res.pens && <p className="center muted">{tr('Definido en la prórroga')}</p>}
              {res.winner && <p className="center">{tr('Avanza: {n}', { n: '' })}<b>{TEAM_BY_ID[res.winner].name}</b></p>}
              <Events goals={res.goals} home={a} away={b} />
              {ex && (
                <div className="why-box">
                  <h4>{tr('¿Por qué este resultado?')} <span className={`tag ${ex.verdict}`}>{ex.verdict === 'sorpresa' ? tr('Sorpresa') : ex.verdict === 'esperado' ? tr('Esperado') : tr('Parejo')}</span></h4>
                  <p>{ex.verdictText}</p>
                  <ul className="why">{ex.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              <p className="small muted">{tr('Resultado ficticio generado por el modelo con la semilla «{s}». Las mismas semilla y parámetros dan siempre el mismo resultado.', { s: n ? `${seed}#${n}` : seed })}</p>
            </div>
          )}
        </>
      )}
    </Section>
  )
}

function Odds() {
  const { params } = useApp()
  const [odds, setOdds] = useState<Record<string, number> | null>(null)
  return (
    <Section title={tr('¿Quién gana desde octavos?')} sub={tr('Estimación con 300 torneos simulados sobre los cruces oficiales.')}>
      <button className="btn" onClick={() => setOdds(championOdds(DECLARED_R16, params, 300, 'odds'))}>{tr('Calcular probabilidades')}</button>
      {odds && Object.entries(odds).sort((a, b) => b[1] - a[1]).map(([id, v]) => <Bar key={id} label={TEAM_BY_ID[id].name} v={v * 100} min={0} max={Math.max(...Object.values(odds)) * 100} right={`${(v * 100).toFixed(1)}%`} />)}
    </Section>
  )
}

function Model({ params, setParams }: { params: ReturnType<typeof useApp>['params']; setParams: (p: ReturnType<typeof useApp>['params']) => void }) {
  const W: [keyof Weights, string][] = [['quality', tr('Calidad individual')], ['balance', tr('Equilibrio táctico')], ['attack', tr('Capacidad ofensiva')], ['defense', tr('Solidez defensiva')], ['experience', tr('Experiencia competitiva')]]
  const total = Object.values(params.weights).reduce((a, b) => a + b, 0)
  const rank = strengthRank(params).slice(0, 10)
  return (
    <>
      <Section title={tr('Ponderaciones')} sub={tr('Parámetros configurables del motor. Los cambios se guardan en este navegador.')}>
        {W.map(([k, l]) => (
          <label key={k} className="slider"><span>{l}</span><input type="range" min="0" max="50" value={Math.round(params.weights[k] * 100)} onChange={(e) => setParams({ ...params, weights: { ...params.weights, [k]: Number(e.target.value) / 100 } })} /><b>{Math.round((params.weights[k] / (total || 1)) * 100)}%</b></label>
        ))}
        <label className="slider"><span>{tr('Goles base por equipo')}</span><input type="range" min="80" max="200" value={Math.round(params.goalBase * 100)} onChange={(e) => setParams({ ...params, goalBase: Number(e.target.value) / 100 })} /><b>{params.goalBase.toFixed(2)}</b></label>
        <label className="slider"><span>{tr('Sensibilidad a la calidad')}</span><input type="range" min="0" max="100" value={Math.round(params.sensitivity * 1000)} onChange={(e) => setParams({ ...params, sensitivity: Number(e.target.value) / 1000 })} /><b>{params.sensitivity.toFixed(3)}</b></label>
        <label className="slider"><span>{tr('Incertidumbre del día')}</span><input type="range" min="0" max="40" value={Math.round(params.variance * 100)} onChange={(e) => setParams({ ...params, variance: Number(e.target.value) / 100 })} /><b>{params.variance.toFixed(2)}</b></label>
        <button className="btn ghost" onClick={() => setParams(DEFAULT_PARAMS)}>{tr('Restablecer valores del proyecto')}</button>
      </Section>
      <Section title={tr('Cómo funciona')}>
        <ul className="rules">
          <li>{tr('Calidad: promedio de valoraciones del once (estimaciones del modelo, no oficiales).')}</li>
          <li>{tr('Equilibrio: parte de 90, resta la dispersión del once y el riesgo de la formación (4-2-4 es la más arriesgada) y suma por pivote defensivo.')}</li>
          <li>{tr('Ataque / defensa: promedios ponderados según la función de cada puesto.')}</li>
          <li>{tr('Experiencia: aproximación con el promedio de los cinco mejores del once.')}</li>
          <li>{tr('Con eso se calculan goles esperados para cada equipo; el partido se sortea con distribución de Poisson, más un factor de incertidumbre. No hay ventajas para ningún país.')}</li>
          <li>{tr('Filtro de coherencia: cuando un equipo es claramente superior, el azar no produce resultados absurdos (por ejemplo, el favorito perdiendo por goleada); solo en rarísimas ocasiones tropieza.')}</li>
          <li>{tr('Leyendas en su prime: suben la valoración del jugador y dan un impulso de ataque a su selección; si llegan desde el banco, entran al once cuando superan al más flojo de su línea.')}</li>
        </ul>
        <h3 className="sub">{tr('Fuerza global (top 10 con estos parámetros)')}</h3>
        {rank.map((p) => <Bar key={p.teamId} label={TEAM_BY_ID[p.teamId].name} v={p.strength} min={78} right={p.strength.toFixed(1)} />)}
      </Section>
    </>
  )
}

function Audit() {
  const checks = validate()
  const icon = { ok: '✓', warn: '!', fail: '✕' } as const
  return (
    <Section title={tr('Auditoría de datos')} sub={tr('Validaciones automáticas sobre el torneo original.')}>
      <ul className="audit">{checks.map((c, i) => <li key={i} className={c.level}><i>{icon[c.level]}</i><div><b>{c.label}</b><span>{c.detail}</span></div></li>)}</ul>
    </Section>
  )
}
