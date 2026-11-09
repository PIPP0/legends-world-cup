import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TEAM_BY_ID } from '../data/lookup'
import { Flag } from './common'
import { KoCard } from './blocks'
import type { Bracket, KoMatch } from '../types'

const vacio = (m: KoMatch): KoMatch => ({ id: m.id, round: m.round })
const loser = (m: KoMatch) => (m.winner === m.a ? m.b : m.a)
const rondaDe = (m: KoMatch) => (m.round === 'r16' ? 0 : m.round === 'qf' ? 1 : m.round === 'sf' ? 2 : 3)
const rondasDe = (full: Bracket): KoMatch[][] => [full.r16, full.qf, full.sf, [full.third, full.final]]
const NOMBRES = ['Octavos de final', 'Cuartos de final', 'Semifinales', 'Tercer puesto y gran final']

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

interface Paso { t: 'm' | 'a'; r: number }
interface Props { full: Bracket; from: number; to: number; speed: number; onEnd: () => void; skipKey: number }

// Animación por fases: 1) se marcan los ganadores de la ronda, 2) las líneas avanzan y los equipos llegan a la siguiente ronda.
export function BracketAnimado({ full, from, to, speed, onEnd, skipKey }: Props) {
  const rondas = useMemo(() => rondasDe(full), [full])
  const pasos = useMemo<Paso[]>(() => { const p: Paso[] = []; for (let r = from; r < to; r++) p.push({ t: 'm', r }, { t: 'a', r }); return p }, [from, to])
  const [paso, setPaso] = useState(0)
  const [k, setK] = useState(0) // partidos ya marcados dentro de la fase de marcar
  const finalMomento = to >= 4
  useEffect(() => { if (skipKey > 0) { setPaso(pasos.length); setK(0) } }, [skipKey, pasos.length])
  useEffect(() => {
    if (paso >= pasos.length) { const t = setTimeout(onEnd, finalMomento ? 2800 : 700); return () => clearTimeout(t) }
    const s = pasos[paso], ms = rondas[s.r]
    let t: ReturnType<typeof setTimeout>
    if (s.t === 'm') {
      if (k < ms.length) {
        const suspenso = s.r === 3 && k === ms.length - 1 && finalMomento
        t = setTimeout(() => setK((x) => x + 1), suspenso ? 2800 : k === 0 ? 800 : speed)
      } else t = setTimeout(() => { setPaso((p) => p + 1); setK(0) }, 1100) // pausa con todos los ganadores marcados
    } else t = setTimeout(() => { setPaso((p) => p + 1); setK(0) }, s.r === 3 ? 3400 : 2900) // la línea avanza y los equipos llegan
    return () => clearTimeout(t)
  }, [paso, k, pasos, rondas, speed, finalMomento, onEnd])

  const actual = paso < pasos.length ? pasos[paso] : null
  const revealed = new Set<string>(), moved = new Set<number>(), hechas = new Set<string>()
  pasos.forEach((s, i) => {
    if (i < paso) { if (s.t === 'm') rondas[s.r].forEach((m) => revealed.add(m.id)); else { moved.add(s.r); rondas[s.r].forEach((m) => hechas.add(m.id)) } }
  })
  const pop = new Set<string>(), avanzan = new Set<string>()
  if (actual?.t === 'm') rondas[actual.r].slice(0, k).forEach((m) => { revealed.add(m.id); pop.add(m.id) }) // todos los marcados en esta fase conservan su animación
  if (actual?.t === 'a') { rondas[actual.r].forEach((m) => { revealed.add(m.id); avanzan.add(m.id) }); moved.add(actual.r) }
  const br = maskAt(full, from, revealed, moved)
  const estado = !actual ? (finalMomento ? '🏆 ¡Ya hay campeón!' : 'Avance completo')
    : actual.t === 'm' ? `▶ Se marcan los ganadores: ${NOMBRES[actual.r]}${actual.r === 3 && k >= rondas[3].length - 1 ? '…' : ''}`
      : actual.r === 3 ? '▶ El campeón llega a la cima…' : `▶ Los ganadores avanzan a ${NOMBRES[actual.r + 1].toLowerCase()}`
  return (
    <>
      <p className="anim-estado" aria-live="polite">{estado}</p>
      <Grid br={br} pop={pop} avanzan={avanzan} hechas={hechas} full={full} camino={!actual && finalMomento ? full.champion : undefined} />
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
        <h4 className="bh" style={{ gridColumn: 1, gridRow: 1 }}>Octavos</h4>
        <h4 className="bh" style={{ gridColumn: 2, gridRow: 1 }}>Cuartos</h4>
        <h4 className="bh" style={{ gridColumn: 3, gridRow: 1 }}>Semifinales</h4>
        <h4 className="bh" style={{ gridColumn: 4, gridRow: 1 }}>Final</h4>
        {br.r16.map((m, i) => cell(m, `${i + 2} / span 1`, 1))}
        {br.qf.map((m, i) => cell(m, `${2 * i + 2} / span 2`, 2))}
        {br.sf.map((m, i) => cell(m, `${4 * i + 2} / span 4`, 3))}
        <div ref={(el) => { refs.current.F = el }} className={`bcell c4 ${pop.has('F') ? 'pop' : ''}`} style={{ gridColumn: 4, gridRow: '4 / span 3' }}><KoCard m={br.final} entra={llegan.F} /></div>
        <div ref={(el) => { refs.current.TRO = el }} className="bcell c4 trofeo" style={{ gridColumn: 4, gridRow: '2 / span 2' }}>
          <div className={`champ ${br.champion ? 'big reveal' : ''}`}>{br.champion ? <><Flag id={br.champion} size={56} /><div><span>Campeón</span><b>🏆 {TEAM_BY_ID[br.champion].name}</b></div></> : <span className="muted">🏆 Campeón por definir</span>}</div>
        </div>
        <div ref={(el) => { refs.current.T = el }} className={`bcell c4 ${pop.has('T') ? 'pop' : ''}`} style={{ gridColumn: 4, gridRow: '7 / span 2' }}><h4>Tercer puesto</h4><KoCard m={br.third} entra={llegan.T} /></div>
      </div>
    </div>
  )
}
