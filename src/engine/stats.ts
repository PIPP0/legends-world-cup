import { PLAYER_BY_ID, TEAMS, findPlayerByName } from '../data'
import { DECLARED_SCORERS, ESTIMATED_ASSISTS } from '../data/raw'
import type { Bracket, Match } from '../types'

export interface PlayerStat { playerId: string; goals: number; assists: number; source: 'eventos' | 'declarado' | 'estimado' }

// A partir de eventos de partido (torneo alternativo o simulación libre).
export function statsFromEvents(matches: Match[], bracket?: Bracket): PlayerStat[] {
  const map = new Map<string, PlayerStat>()
  const ensure = (id: string) => { if (!map.has(id)) map.set(id, { playerId: id, goals: 0, assists: 0, source: 'eventos' }); return map.get(id)! }
  const all = [...matches.flatMap((m) => m.goals ?? [])]
  if (bracket) all.push(...[...bracket.r16, ...bracket.qf, ...bracket.sf, bracket.third, bracket.final].flatMap((m) => m.goals ?? []))
  for (const g of all) {
    ensure(g.scorerId).goals++
    if (g.assistId) ensure(g.assistId).assists++
  }
  return [...map.values()]
}

// Historia original: goleadores declarados + asistencias estimadas.
export function declaredStats(): PlayerStat[] {
  const map = new Map<string, PlayerStat>()
  for (const s of DECLARED_SCORERS) {
    const p = findPlayerByName(s.name)
    if (p) map.set(p.id, { playerId: p.id, goals: s.goals, assists: 0, source: 'declarado' })
  }
  for (const a of ESTIMATED_ASSISTS) {
    const p = findPlayerByName(a.name)
    if (!p) continue
    const cur = map.get(p.id) ?? { playerId: p.id, goals: 0, assists: 0, source: 'estimado' as const }
    cur.assists = a.assists
    map.set(p.id, cur)
  }
  return [...map.values()]
}

export interface TeamStat {
  teamId: string; pj: number; w: number; d: number; l: number; gf: number; ga: number; unbeaten: boolean
}

export function teamStats(matches: Match[]): TeamStat[] {
  const m = new Map<string, TeamStat>()
  for (const t of TEAMS) m.set(t.id, { teamId: t.id, pj: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, unbeaten: true })
  for (const x of matches) {
    const h = m.get(x.home)!, a = m.get(x.away)!
    h.pj++; a.pj++; h.gf += x.hg; h.ga += x.ag; a.gf += x.ag; a.ga += x.hg
    if (x.hg > x.ag) { h.w++; a.l++; a.unbeaten = false }
    else if (x.hg < x.ag) { a.w++; h.l++; h.unbeaten = false }
    else { h.d++; a.d++ }
  }
  return [...m.values()].filter((t) => t.pj > 0)
}

export const nameOf = (id: string) => PLAYER_BY_ID[id]?.name ?? id
