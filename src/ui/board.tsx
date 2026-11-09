import { useEffect, useRef, useState } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { Flag } from './common'
import { CtxLine } from './world'
import type { Goal, MatchCtx } from '../types'

export interface Item { id: string; a: string; b: string; goals: Goal[]; ga: number; gb: number; et?: boolean; pens?: [number, number]; winner?: string; ctx?: MatchCtx; tag?: string; pr?: [number, number, number] }
export function Board({ items, tick, onDone }: { items: Item[]; tick: number; onDone: () => void }) {
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
              {it.pr && <p className="mc-pr">Antes del partido: {TEAM_BY_ID[it.a].name} {Math.round(it.pr[0] * 100)} % · Empate {Math.round(it.pr[1] * 100)} % · {TEAM_BY_ID[it.b].name} {Math.round(it.pr[2] * 100)} %</p>}
              {fin && it.pr && ((sa > sb && it.pr[0] < 0.25) || (sb > sa && it.pr[2] < 0.25)) && <p className="mc-s">⚡ Sorpresa: ganó con solo {Math.round((sa > sb ? it.pr[0] : it.pr[2]) * 100)} % de probabilidad</p>}
              <CtxLine ctx={it.ctx} />
            </div>
          )
        })}
      </div>
      {min < end && <button className="btn ghost" onClick={() => setMin(end)}>Saltar al final</button>}
    </>
  )
}

