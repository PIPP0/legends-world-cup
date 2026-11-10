import { tr } from '../i18n'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TEAM_BY_ID } from '../data/lookup'
import { Flag } from './common'
import { KoCard } from './blocks'
import type { Bracket, KoMatch } from '../types'

const vacio = (m: KoMatch): KoMatch => ({ id: m.id, round: m.round })
const loser = (m: KoMatch) => (m.winner === m.a ? m.b : m.a)
const rondaDe = (m: KoMatch) => (m.round === 'r16' ? 0 : m.round === 'qf' ? 1 : m.round === 'sf' ? 2 : 3)
const rondasDe = (full: Bracket): KoMatch[][] => [full.r16, full.qf, full.sf, [full.third, full.final]]
const NOMBRES = [tr('Octavos de final'), tr('Cuartos de final'), tr('Semifinales'), tr('Tercer puesto y gran final')]

// Siguiente partido al que avanza el ganador (y, desde semifinales, el perdedor al tercer puesto).
const SIGUE: Record<string, string> = { O1: 'C1', O2: 'C1', O3: 'C2', O4: 'C2', O5: 'C3', O6: 'C3', O7: 'C4', O8: 'C4', C1: 'S1', C2: 'S1', C3: 'S2', C4: 'S2', S1: 'F', S2: 'F', F: 'TRO' }
const PERD: Record<string, string> = { S1: 'T', S2: 'T' }

// Cuadro con lo que ya se mostró: `revealed` = partidos con resultado marcado; `moved` = rondas cuyos ganadores ya avanzaron.
export function maskAt(full: Bracket, from: number, revealed: Set<string>, moved: Set<number>) {
  const vis = (m: KoMatch) => rondaDe(m) < from || revealed.has(m.id)
  const mv = (m: KoMatch) => rondaDe(m) < from || moved.has(rondaDe(m))
  const res = (m: KoMatch, a?: string, b?: string): KoMatch => (vis(m) ? m : { ...vacio(m), a, b })
  const w = (m: KoMatch) => (mv(m) && vis(m) ? m.winner : undefined)
  const l = (m: KoMatch) => (mv(m) && vis(m) ? loser(m) : undefined)
  return {
    r16: full.r16.map((m) => res(m, m.a, m.b)),
    qf: full.qf.map((m, i) => res(m, w(full.r16[2 * i]), w(full.r16[2 * i + 1]))),
    sf: full.sf.map((m, i) => res(m, w(full.qf[2 * i]), w(full.qf[2 * i + 1]))),
    third: res(full.third, l(full.sf[0]), l(full.sf[1])),
    final: res(full.final, w(full.sf[0]), w(full.sf[1])),
    champion: moved.has(3) || from >= 4 ? full.champion : undefined,
  }
}

interface Vista { revealed: Set<string>; moved: Set<number>; avanzan: Set<string>; hechas: Set<string>; pop: Set<string>; estado: string }
interface Props { full: Bracket; from: number; to: number; speed: number; onEnd: () => void; skipKey: number }
const copia = (v: Vista): Vista => ({ revealed: new Set(v.revealed), moved: new Set(v.moved), avanzan: new Set(v.avanzan), hechas: new Set(v.hechas), pop: new Set(v.pop), estado: v.estado })

// Línea de tiempo continua: 1) se encienden los bordes de los ganadores de la ronda; 2) una línea avanza a la siguiente ronda y los equipos llegan;
// 3) en esa ronda se enciende el borde del ganador; y así hasta la final y el campeón. Todo se calcula de antemano y se reproduce sin pausas muertas.
function construir(full: Bracket, from: number, to: number): { eventos: { t: number; v: Vista }[]; fin: number } {
  const rondas = rondasDe(full)
  const eventos: { t: number; v: Vista }[] = []
  let cur: Vista = { revealed: new Set(), moved: new Set(), avanzan: new Set(), hechas: new Set(), pop: new Set(), estado: '' }
  let t = 0
  const push = () => eventos.push({ t, v: copia(cur) })
  const marcar = (r: number) => {
    cur.pop = new Set(); cur.avanzan = new Set([...cur.avanzan].filter(() => false))
    const ms = rondas[r]
    ms.forEach((m, j) => {
      const esFinal = r === 3 && m.id === 'F'
      t += esFinal ? 2600 : j === 0 ? 600 : r === 0 ? 240 : 320 // suspenso antes de la gran final
      cur.revealed.add(m.id); cur.pop.add(m.id)
      cur.estado = esFinal ? tr('La gran final…') : tr('Ganadores de {r}', { r: NOMBRES[r].toLowerCase() })
      push()
    })
  }
  const avanzar = (r: number) => {
    t += 700
    cur.pop = new Set(); cur.moved.add(r); cur.avanzan = new Set(rondas[r].map((m) => m.id))
    cur.estado = r === 3 ? tr('El campeón llega a la cima') : tr('Los ganadores avanzan a {r}', { r: NOMBRES[r + 1].toLowerCase() })
    push()
    t += r === 3 ? 1600 : 1850 // lo que tarda la línea en dibujarse y los equipos en llegar
    cur.avanzan = new Set(); rondas[r].forEach((m) => cur.hechas.add(m.id))
  }
  for (let r = from; r < to; r++) {
    if (r === from) marcar(r)
    avanzar(r)
    if (r + 1 < to) marcar(r + 1)
  }
  cur.estado = to >= 4 ? tr('🏆 ¡Ya hay campeón!') : tr('Avance completo')
  t += 200; push()
  return { eventos, fin: t + (to >= 4 ? 2600 : 600) }
}

// Animación: se reproduce la línea de tiempo en un solo hilo de temporizadores (sin saltos entre fases).
export function BracketAnimado({ full, from, to, onEnd, skipKey }: Props) {
  const plan = useMemo(() => construir(full, from, to), [full, from, to])
  const vacia = useMemo<Vista>(() => ({ revealed: new Set(), moved: new Set(), avanzan: new Set(), hechas: new Set(), pop: new Set(), estado: tr('Preparando el cuadro…') }), [])
  const [v, setV] = useState<Vista>(vacia)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    timers.current = plan.eventos.map((e) => setTimeout(() => setV(e.v), e.t))
    timers.current.push(setTimeout(onEnd, plan.fin))
    return () => timers.current.forEach(clearTimeout)
  }, [plan, onEnd])
  useEffect(() => {
    if (skipKey > 0) { timers.current.forEach(clearTimeout); setV(plan.eventos[plan.eventos.length - 1].v); timers.current = [setTimeout(onEnd, 300)] }
  }, [skipKey, plan, onEnd])
  const br = maskAt(full, from, v.revealed, v.moved)
  const finalizado = v.estado.startsWith('🏆')
  return (
    <>
      <p className="anim-estado" aria-live="polite">{v.estado ? `▶ ${v.estado}` : ''}</p>
      <Grid br={br} pop={v.pop} avanzan={v.avanzan} hechas={v.hechas} full={full} camino={finalizado && to >= 4 ? full.champion : undefined} />
    </>
  )
}

// Cuadro estático con lo ya revelado en el nivel dado.
export function BracketEstatico({ full, level }: { full: Bracket; level: number }) {
  const rondas = rondasDe(full)
  const revealed = new Set<string>(), moved = new Set<number>(), hechas = new Set<string>()
  rondas.forEach((r, i) => { if (i < level) { r.forEach((m) => { revealed.add(m.id); hechas.add(m.id) }); moved.add(i) } })
  return <Grid br={maskAt(full, level, revealed, moved)} pop={new Set()} avanzan={new Set()} hechas={hechas} full={full} camino={level >= 4 ? full.champion : undefined} />
}

function Grid({ br, pop, avanzan, hechas, full, camino }: { br: ReturnType<typeof maskAt>; pop: Set<string>; avanzan: Set<string>; hechas: Set<string>; full: Bracket; camino?: string }) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const wrap = useRef<HTMLDivElement>(null)
  const [lineas, setLineas] = useState<{ key: string; from: string; perd: boolean; d: string }[]>([])
  const [tam, setTam] = useState({ w: 0, h: 0 })
  // las líneas se miden sobre el cuadro real: salen del lado derecho de cada partido y llegan al lado izquierdo del siguiente
  useLayoutEffect(() => {
    const medir = () => {
      const root = wrap.current; if (!root) return
      const r0 = root.getBoundingClientRect()
      const out: { key: string; from: string; perd: boolean; d: string }[] = []
      const trazar = (from: string, to: string, perd: boolean) => {
        const A = refs.current[from]?.querySelector('.kcard'), B = refs.current[to]?.querySelector('.kcard, .champ')
        if (!A || !B) return
        const a = A.getBoundingClientRect(), b = B.getBoundingClientRect()
        const x1 = a.right - r0.left, y1 = a.top + a.height / 2 - r0.top, x2 = b.left - r0.left, y2 = b.top + b.height / 2 - r0.top, xm = x1 + (x2 - x1) / 2
        out.push({ key: `${from}>${to}`, from, perd, d: `M${x1} ${y1} H${xm} V${y2} H${x2}` })
      }
      for (const [f, t] of Object.entries(SIGUE)) trazar(f, t, false)
      for (const [f, t] of Object.entries(PERD)) trazar(f, t, true)
      setLineas(out); setTam({ w: root.scrollWidth, h: root.scrollHeight })
    }
    medir()
    const ro = new ResizeObserver(medir); if (wrap.current) ro.observe(wrap.current)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [pop.size, avanzan.size, hechas.size])

  // equipos que llegan ahora a cada partido siguiente
  const llegan: Record<string, string[]> = {}
  const todos = [...full.r16, ...full.qf, ...full.sf, full.final]
  for (const m of todos) if (avanzan.has(m.id) && SIGUE[m.id]) (llegan[SIGUE[m.id]] ??= []).push(m.winner!)
  for (const id of ['S1', 'S2']) if (avanzan.has(id)) (llegan.T ??= []).push(loser(full.sf[id === 'S1' ? 0 : 1])!)
  const todosVis: KoMatch[] = [...br.r16, ...br.qf, ...br.sf, br.final]
  const cell = (m: KoMatch, row: string, col: number) => {
    return (
      <div key={m.id} ref={(el) => { refs.current[m.id] = el }} className={`bcell c${col} ${pop.has(m.id) ? 'pop' : ''}`} style={{ gridRow: row, gridColumn: col }}>
        <KoCard m={m} entra={llegan[m.id]} />
      </div>
    )
  }
  void todosVis
  return (
    <div className="bgrid-wrap">
      <div className="bgrid" ref={wrap}>
        <svg className="bconn" width={tam.w} height={tam.h} aria-hidden="true">
          {lineas.map((l) => {
            const oro = camino && !l.perd && (l.from === 'F' || [...full.r16, ...full.qf, ...full.sf].some((m) => m.id === l.from && m.winner === camino))
            return <path key={l.key} d={l.d} pathLength={1} className={`lin ${l.perd ? 'perd' : ''} ${hechas.has(l.from) ? 'hecho' : ''} ${avanzan.has(l.from) ? 'avanza' : ''} ${oro ? 'oro' : ''}`} />
          })}
        </svg>
        <h4 className="bh" style={{ gridColumn: 1, gridRow: 1 }}>{tr('Octavos')}</h4>
        <h4 className="bh" style={{ gridColumn: 2, gridRow: 1 }}>{tr('Cuartos')}</h4>
        <h4 className="bh" style={{ gridColumn: 3, gridRow: 1 }}>{tr('Semifinales')}</h4>
        <h4 className="bh" style={{ gridColumn: 4, gridRow: 1 }}>{tr('Final')}</h4>
        {br.r16.map((m, i) => cell(m, `${i + 2} / span 1`, 1))}
        {br.qf.map((m, i) => cell(m, `${2 * i + 2} / span 2`, 2))}
        {br.sf.map((m, i) => cell(m, `${4 * i + 2} / span 4`, 3))}
        <div ref={(el) => { refs.current.F = el }} className={`bcell c4 ${pop.has('F') ? 'pop' : ''}`} style={{ gridColumn: 4, gridRow: '4 / span 3' }}><KoCard m={br.final} entra={llegan.F} /></div>
        <div ref={(el) => { refs.current.TRO = el }} className="bcell c4 trofeo" style={{ gridColumn: 4, gridRow: '2 / span 2' }}>
          <div className={`champ ${br.champion ? 'big reveal' : ''}`}>{br.champion ? <><Flag id={br.champion} size={56} /><div><span>{tr('Campeón')}</span><b>🏆 {TEAM_BY_ID[br.champion].name}</b></div></> : <span className="muted">{tr('🏆 Campeón por definir')}</span>}</div>
        </div>
        <div ref={(el) => { refs.current.T = el }} className={`bcell c4 ${pop.has('T') ? 'pop' : ''}`} style={{ gridColumn: 4, gridRow: '7 / span 2' }}><h4>{tr('Tercer puesto')}</h4><KoCard m={br.third} entra={llegan.T} /></div>
      </div>
    </div>
  )
}
