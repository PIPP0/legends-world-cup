import { useEffect, useMemo, useRef, useState } from 'react'
import { GROUPS } from '../data'
import { HOST_BY_ID } from '../data/world'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { table } from '../engine/standings'
import { recordHistory } from '../engine/world'
import { Flag, Section, useApp } from './common'
import { CtxLine } from './world'
import { LiveReplay } from './pages4'
import { Reveal } from './mundial'
import { takePending } from './pending'
import type { AltTournament, Goal, KoMatch, MatchCtx } from '../types'

const ALL = Object.keys(TEAM_BY_ID)

function Slot({ id, state }: { id: string; state: 'empty' | 'spin' | 'done' }) {
  const [r, setR] = useState(ALL[0])
  useEffect(() => {
    if (state !== 'spin') return
    const i = setInterval(() => setR(ALL[Math.floor(Math.random() * ALL.length)]), 70)
    return () => clearInterval(i)
  }, [state])
  if (state === 'empty') return <span className="slot empty">?</span>
  if (state === 'spin') return <span className="slot spin"><Flag id={r} size={22} /><b>···</b></span>
  return <span className="slot pop"><Flag id={id} size={22} /><b>{TEAM_BY_ID[id].name}</b></span>
}

function useSteps(n: number, ms: number, onDone: () => void) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (k > n) return
    const t = setTimeout(() => setK((x) => x + 1), ms)
    return () => clearTimeout(t)
  }, [k, n, ms])
  const fired = useRef(false)
  useEffect(() => { if (k > n && !fired.current) { fired.current = true; onDone() } }, [k, n, onDone])
  return [k, () => setK(n + 1)] as const
}

function DrawGroups({ groups, hostTeam, onDone }: { groups: Record<string, string[]>; hostTeam?: string; onDone: () => void }) {
  const [k, skip] = useSteps(32, 420, onDone)
  return (
    <>
      <div className="drawgrid">
        {GROUPS.map((g, gi) => (
          <div key={g} className="dgroup"><h5>Grupo {g}{g === 'A' && hostTeam && groups.A[0] === hostTeam ? ' · anfitrión' : ''}</h5>
            {[0, 1, 2, 3].map((p) => { const idx = p * 8 + gi; return <Slot key={p} id={groups[g][p]} state={idx < k ? 'done' : idx === k ? 'spin' : 'empty'} /> })}
          </div>
        ))}
      </div>
      {k <= 32 && <button className="btn ghost" onClick={skip}>Saltar sorteo</button>}
    </>
  )
}

interface Pair { a: string; b: string; ctx?: MatchCtx; label?: string }
function PairDraw({ pairs, onDone }: { pairs: Pair[]; onDone: () => void }) {
  const [k, skip] = useSteps(pairs.length, 1500, onDone)
  return (
    <>
      <div className="pairgrid">
        {pairs.map((p, i) => {
          const st = i < k ? 'done' : i === k ? 'spin' : 'empty'
          return (
            <div key={i} className="pairc">
              {p.label && <em>{p.label}</em>}
              <Slot id={p.a} state={st} /><span className="vs">VS</span><Slot id={p.b} state={st} />
              {st === 'done' && <CtxLine ctx={p.ctx} />}
            </div>
          )
        })}
      </div>
      {k <= pairs.length && <button className="btn ghost" onClick={skip}>Saltar sorteo</button>}
    </>
  )
}

interface Item { id: string; a: string; b: string; goals: Goal[]; ga: number; gb: number; et?: boolean; pens?: [number, number]; winner?: string; ctx?: MatchCtx; tag?: string }
function Board({ items, tick, onDone }: { items: Item[]; tick: number; onDone: () => void }) {
  const end = Math.max(...items.map((i) => (i.et ? 120 : 90)))
  const [min, setMin] = useState(0)
  useEffect(() => {
    if (min >= end) return
    const t = setTimeout(() => setMin((m) => m + 1), tick)
    return () => clearTimeout(t)
  }, [min, end, tick])
  const fired = useRef(false)
  useEffect(() => { if (min >= end && !fired.current) { fired.current = true; onDone() } }, [min, end, onDone])
  return (
    <>
      <div className="board">
        {items.map((it) => {
          const e = it.et ? 120 : 90
          const shown = it.goals.filter((g) => g.minute <= min)
          const sa = shown.filter((g) => g.teamId === it.a).length, sb = shown.length - sa
          const fin = min >= e
          const last = shown[shown.length - 1]
          const hot = last && min - last.minute < 4 && !fin
          return (
            <div key={it.id} className={`mcard ${hot ? 'hot' : ''}`}>
              <div className="mc-h"><span className={fin ? 'fin' : 'on'}>{fin ? 'FIN' : `${Math.min(min, e)}'`}</span>{it.tag && <em>{it.tag}</em>}</div>
              <div className={`mc-r ${fin && it.winner === it.a ? 'win' : ''}`}><Flag id={it.a} size={20} /><span>{TEAM_BY_ID[it.a].name}</span><b>{sa}</b></div>
              <div className={`mc-r ${fin && it.winner === it.b ? 'win' : ''}`}><Flag id={it.b} size={20} /><span>{TEAM_BY_ID[it.b].name}</span><b>{sb}</b></div>
              {hot && <p className="mc-g">⚽ {PLAYER_BY_ID[last.scorerId].name} {last.minute}'</p>}
              {fin && it.pens && <p className="mc-p">Penales {it.pens[0]}–{it.pens[1]}</p>}
              {fin && it.et && !it.pens && <p className="mc-p">Prórroga</p>}
              <CtxLine ctx={it.ctx} />
            </div>
          )
        })}
      </div>
      {min < end && <button className="btn ghost" onClick={() => setMin(end)}>Saltar al final</button>}
    </>
  )
}

function Tables({ t, upTo }: { t: AltTournament; upTo: number }) {
  return (
    <div className="mtables">
      {GROUPS.map((g) => {
        const rows = table(t.groups![g], t.groupMatches.filter((m) => m.group === g && m.matchday <= upTo))
        return (
          <div key={g} className="mt"><h5>Grupo {g}</h5>
            {rows.map((r, i) => <p key={r.teamId} className={i < 2 ? 'q' : ''}><Flag id={r.teamId} size={16} /><span>{TEAM_BY_ID[r.teamId].name}</span><i>{r.gd > 0 ? '+' : ''}{r.gd}</i><b>{r.pts}</b></p>)}
          </div>
        )
      })}
    </div>
  )
}

type Round = 'r16' | 'qf' | 'sf'
type Step = { kind: 'draw' } | { kind: 'md'; n: 1 | 2 | 3 } | { kind: 'pair'; r: Round | 'final' } | { kind: 'play'; r: Round } | { kind: 'third' } | { kind: 'final' } | { kind: 'end' }
const RN: Record<Round, string> = { r16: 'octavos de final', qf: 'cuartos de final', sf: 'semifinales' }
const PLAYING: Record<Round, string> = { r16: 'Se juegan los octavos de final', qf: 'Se juegan los cuartos de final', sf: 'Se juegan las semifinales' }

const toItem = (m: KoMatch, tag?: string): Item => ({ id: m.id, a: m.a!, b: m.b!, goals: m.goals ?? [], ga: m.ga!, gb: m.gb!, et: m.et, pens: m.pens, winner: m.winner, ctx: m.ctx, tag })
const toRes = (m: KoMatch) => ({ ga: m.ga!, gb: m.gb!, goals: m.goals ?? [], et: !!m.et, pens: m.pens, winner: m.winner })

export function Vivo() {
  const { setAlt } = useApp()
  const t = useMemo(() => takePending(), [])
  const steps = useMemo<Step[]>(() => {
    if (!t) return []
    const s: Step[] = []
    if (t.mode === 'completo' && t.groups) s.push({ kind: 'draw' }, { kind: 'md', n: 1 }, { kind: 'md', n: 2 }, { kind: 'md', n: 3 })
    s.push({ kind: 'pair', r: 'r16' }, { kind: 'play', r: 'r16' }, { kind: 'pair', r: 'qf' }, { kind: 'play', r: 'qf' }, { kind: 'pair', r: 'sf' }, { kind: 'play', r: 'sf' }, { kind: 'pair', r: 'final' }, { kind: 'third' }, { kind: 'final' }, { kind: 'end' })
    return s
  }, [t])
  const resThird = useMemo(() => (t ? toRes(t.bracket.third) : null), [t])
  const resFinal = useMemo(() => (t ? toRes(t.bracket.final) : null), [t])
  const [i, setI] = useState(0)
  const [ready, setReady] = useState(false)
  const saved = useRef(false)
  const step = steps[i]
  const next = () => { setReady(false); setI((x) => x + 1); window.scrollTo(0, 0) }
  const done = useRef(() => setReady(true)).current
  useEffect(() => {
    if (step?.kind === 'end' && t && !saved.current) { saved.current = true; recordHistory(t); setAlt({ ...t, recorded: true }) }
  }, [step, t, setAlt])

  if (!t) return <Section title="Sin torneo en curso"><p className="note">No hay un mundial por vivir. <a href="#/mundial">Arma uno</a> o <a href="#/simulador">ve el simulador</a>.</p></Section>
  if (step.kind === 'end') return <Reveal t={t} onAgain={() => { location.hash = '#/mundial' }} />

  const br = t.bracket
  const stageTitle = (): string => {
    switch (step.kind) {
      case 'draw': return 'Sorteo de grupos'
      case 'md': return `Resultados por grupos · fecha ${step.n}`
      case 'pair': return step.r === 'final' ? 'Emparejamientos: tercer puesto y gran final' : `Sorteo de ${RN[step.r]}`
      case 'play': return PLAYING[step.r]
      case 'third': return 'Partido por el tercer puesto'
      default: return 'La gran final'
    }
  }
  const body = () => {
    switch (step.kind) {
      case 'draw': return <DrawGroups key="d" groups={t.groups!} hostTeam={t.world ? HOST_BY_ID[t.world.hostId]?.teamId : undefined} onDone={done} />
      case 'md': {
        const ms = t.groupMatches.filter((m) => m.matchday === step.n)
        const items: Item[] = ms.map((m) => ({ id: m.id, a: m.home, b: m.away, goals: m.goals ?? [], ga: m.hg, gb: m.ag, ctx: m.ctx, tag: `Grupo ${m.group}` }))
        return <><Board key={`md${step.n}`} items={items} tick={55} onDone={done} />{ready && <><h4 className="sub">Así quedan los grupos</h4><Tables t={t} upTo={step.n} /></>}</>
      }
      case 'pair': {
        const ms = step.r === 'final' ? [br.third, br.final] : br[step.r]
        return <PairDraw key={`p${step.r}`} pairs={ms.map((m) => ({ a: m.a!, b: m.b!, ctx: m.ctx, label: m.id === 'F' ? 'Gran final' : m.id === 'T' ? 'Tercer puesto' : undefined }))} onDone={done} />
      }
      case 'play': return <Board key={`b${step.r}`} items={br[step.r].map((m) => toItem(m))} tick={60} onDone={done} />
      case 'third': return <><LiveReplay key="t" a={br.third.a!} b={br.third.b!} res={resThird!} onSkip={done} onDone={done} /><CtxLine ctx={br.third.ctx} /></>
      default: return <div className="finalbox"><p className="gf">GRAN FINAL</p><LiveReplay key="f" a={br.final.a!} b={br.final.b!} res={resFinal!} onSkip={done} onDone={done} /><CtxLine ctx={br.final.ctx} /></div>
    }
  }
  const last = step.kind === 'final'
  return (
    <Section title={`Paso ${i + 1} de ${steps.length - 1}`} sub={stageTitle()}>
      <div className="vprog"><i style={{ width: `${(i / (steps.length - 1)) * 100}%` }} /></div>
      {body()}
      <div className="cta wiz"><span />{ready && <button className="btn pri" onClick={next}>{last ? 'Conocer al campeón' : 'Continuar'}</button>}</div>
    </Section>
  )
}
