import { PLAYER_BY_ID, TEAMS, findPlayerByName } from '../data'
import { DECLARED_SCORERS, ESTIMATED_ASSISTS } from '../data/raw'
import type { Bracket, Match } from '../types'
import { revealed } from './historia'

export interface PlayerStat { playerId: string; goals: number; assists: number; source: 'eventos' | 'declarado' | 'estimado' | 'mixto' }

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

// Historia original con las eliminatorias que esta persona ya reveló: grupos (declarados) + eliminatorias (por eventos).
export function storyPlayerStats(level: number): PlayerStat[] {
  const map = new Map(declaredStats().map((s) => [s.playerId, { ...s }]))
  for (const m of revealed(level)) for (const g of m.goals ?? []) {
    const sc = map.get(g.scorerId) ?? { playerId: g.scorerId, goals: 0, assists: 0, source: 'eventos' as const }
    sc.goals++; if (sc.source !== 'eventos') sc.source = 'mixto'; map.set(g.scorerId, sc)
    if (g.assistId) {
      const a = map.get(g.assistId) ?? { playerId: g.assistId, goals: 0, assists: 0, source: 'eventos' as const }
      a.assists++; if (a.source !== 'eventos') a.source = 'mixto'; map.set(g.assistId, a)
    }
  }
  return [...map.values()]
}

// Estadísticas por selección: grupos + eliminatorias reveladas. Un partido que se define por penales cuenta como empate (criterio FIFA).
export function storyTeamStats(matches: Match[], level: number): TeamStat[] {
  const base = new Map(teamStats(matches).map((t) => [t.teamId, { ...t }]))
  const get = (id: string): TeamStat => { if (!base.has(id)) base.set(id, { teamId: id, pj: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, unbeaten: true }); return base.get(id)! }
  for (const m of revealed(level)) {
    const a = get(m.a!), b = get(m.b!)
    a.pj++; b.pj++; a.gf += m.ga!; a.ga += m.gb!; b.gf += m.gb!; b.ga += m.ga!
    if (m.pens || m.ga === m.gb) { a.d++; b.d++ }
    else if (m.ga! > m.gb!) { a.w++; b.l++; b.unbeaten = false }
    else { b.w++; a.l++; a.unbeaten = false }
  }
  return [...base.values()]
}
