import { useEffect, useMemo, useState } from 'react'
import { TEAM_BY_ID } from '../data/lookup'
import { RONDAS } from '../engine/historia'
import { Flag } from './common'
import { KoCard } from './blocks'
import type { Bracket, KoMatch } from '../types'

const vacio = (m: KoMatch): KoMatch => ({ id: m.id, round: m.round })
const loser = (m: KoMatch) => (m.winner === m.a ? m.b : m.a)

// Cuadro armado con lo que ya se reveló: rondas anteriores a `from` completas + los partidos de `revealed`.
// Cada ganador aparece en la siguiente ronda apenas termina su partido (así se ve cómo avanza el torneo).
export function maskAt(full: Bracket, from: number, revealed: Set<string>) {
  const rondaDe = (m: KoMatch) => (m.round === 'r16' ? 0 : m.round === 'qf' ? 1 : m.round === 'sf' ? 2 : 3)
  const vis = (m: KoMatch) => rondaDe(m) < from || revealed.has(m.id)
  const res = (m: KoMatch, a?: string, b?: string): KoMatch => (vis(m) ? m : { ...vacio(m), a, b })
  const w = (m: KoMatch) => (vis(m) ? m.winner : undefined)
  const l = (m: KoMatch) => (vis(m) ? loser(m) : undefined)
  return {
    r16: full.r16.map((m) => res(m, m.a, m.b)),
    qf: full.qf.map((m, i) => res(m, w(full.r16[2 * i]), w(full.r16[2 * i + 1]))),
    sf: full.sf.map((m, i) => res(m, w(full.qf[2 * i]), w(full.qf[2 * i + 1]))),
    third: res(full.third, l(full.sf[0]), l(full.sf[1])),
    final: res(full.final, w(full.sf[0]), w(full.sf[1])),
    champion: vis(full.final) ? full.champion : undefined,
  }
}

// Orden de la animación: ronda por ronda; en la última, el tercer puesto y al final la gran final.
export function secuencia(full: Bracket, from: number, to: number): KoMatch[] {
  const rondas = [full.r16, full.qf, full.sf, [full.third, full.final]]
  return rondas.slice(from, to).flat()
}

interface Props { full: Bracket; from: number; to: number; speed: number; onEnd: () => void; skipKey: number }
// Cuadro animado: va revelando partido a partido y termina con la llegada del campeón.
export function BracketAnimado({ full, from, to, speed, onEnd, skipKey }: Props) {
  const seq = useMemo(() => secuencia(full, from, to), [full, from, to])
  const [count, setCount] = useState(0)
  const finalMomento = to >= 4
  useEffect(() => { if (skipKey > 0) setCount(seq.length) }, [skipKey, seq.length])
  useEffect(() => {
    if (count >= seq.length) { const t = setTimeout(onEnd, finalMomento ? 2600 : 600); return () => clearTimeout(t) }
    // suspenso antes de la gran final
    const suspenso = finalMomento && count === seq.length - 1
    const t = setTimeout(() => setCount((c) => c + 1), suspenso ? 2600 : count === 0 ? 700 : speed)
    return () => clearTimeout(t)
  }, [count, seq.length, speed, finalMomento, onEnd])
  const revealed = useMemo(() => new Set(seq.slice(0, count).map((m) => m.id)), [seq, count])
  const br = maskAt(full, from, revealed)
  const ultimo = count > 0 ? seq[count - 1].id : ''
  const rondaActual = count >= seq.length ? null : seq[count]
  const etiqueta = rondaActual ? (rondaActual.id === 'F' ? 'Gran final' : rondaActual.id === 'T' ? 'Tercer puesto' : RONDAS[rondaActual.round === 'r16' ? 0 : rondaActual.round === 'qf' ? 1 : 2].nombre) : 'Avance completo'
  return (
    <>
      <p className="anim-estado" aria-live="polite">{count >= seq.length ? (finalMomento ? '🏆 ¡Ya hay campeón!' : 'Avance completo') : `▶ Se define: ${etiqueta}${rondaActual && rondaActual.id === 'F' ? '…' : ''}`}</p>
      <Grid br={br} ultimo={ultimo} campeonVisible={!!br.champion} camino={count >= seq.length && finalMomento ? full.champion : undefined} />
    </>
  )
}

// Cuadro estático (sin animación) con lo ya revelado en el nivel dado.
export function BracketEstatico({ full, level }: { full: Bracket; level: number }) {
  const rondaDe = (n: number) => n
  void rondaDe
  const all = new Set<string>()
  for (const [i, r] of [full.r16, full.qf, full.sf, [full.third, full.final]].entries()) if (i < level) r.forEach((m) => all.add(m.id))
  // nivel L: resultados de rondas < L; maskAt(from=L) muestra además los cruces de la ronda L
  return <Grid br={maskAt(full, level, all)} ultimo="" campeonVisible={level >= 4} camino={level >= 4 ? full.champion : undefined} />
}

function Grid({ br, ultimo, campeonVisible, camino }: { br: ReturnType<typeof maskAt>; ultimo: string; campeonVisible: boolean; camino?: string }) {
  const cell = (m: KoMatch, row: string, col: number, nombre?: string) => {
    const enCamino = camino && (m.a === camino || m.b === camino) && m.winner !== undefined
    return (
      <div key={m.id} className={`bcell c${col} ${ultimo === m.id ? 'pop' : ''} ${enCamino ? 'camino' : ''}`} style={{ gridRow: row, gridColumn: col }}>
        {nombre && <h4>{nombre}</h4>}
        <KoCard m={m} />
      </div>
    )
  }
  return (
    <div className="bgrid-wrap">
      <div className="bgrid">
        <h4 className="bh" style={{ gridColumn: 1, gridRow: 1 }}>Octavos</h4>
        <h4 className="bh" style={{ gridColumn: 2, gridRow: 1 }}>Cuartos</h4>
        <h4 className="bh" style={{ gridColumn: 3, gridRow: 1 }}>Semifinales</h4>
        <h4 className="bh" style={{ gridColumn: 4, gridRow: 1 }}>Final</h4>
        {br.r16.map((m, i) => cell(m, `${i + 2} / span 1`, 1))}
        {br.qf.map((m, i) => cell(m, `${2 * i + 2} / span 2`, 2))}
        {br.sf.map((m, i) => cell(m, `${4 * i + 2} / span 4`, 3))}
        <div className={`bcell c4 ${ultimo === 'F' ? 'pop' : ''} ${camino && br.final.winner ? 'camino' : ''}`} style={{ gridColumn: 4, gridRow: '4 / span 3' }}><KoCard m={br.final} /></div>
        <div className="bcell c4 trofeo" style={{ gridColumn: 4, gridRow: '2 / span 2' }}>
          <div className={`champ ${campeonVisible ? 'big reveal' : ''}`}>{campeonVisible && br.champion ? <><Flag id={br.champion} size={56} /><div><span>Campeón</span><b>🏆 {TEAM_BY_ID[br.champion].name}</b></div></> : <span className="muted">🏆 Campeón por definir</span>}</div>
        </div>
        <div className={`bcell c4 ${ultimo === 'T' ? 'pop' : ''}`} style={{ gridColumn: 4, gridRow: '7 / span 2' }}><h4>Tercer puesto</h4><KoCard m={br.third} /></div>
      </div>
    </div>
  )
}
