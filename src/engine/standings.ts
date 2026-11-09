import { TEAM_BY_ID } from '../data'
import type { Match, TableRow } from '../types'

function rows(teamIds: string[], matches: Match[]): TableRow[] {
  const map: Record<string, TableRow> = {}
  for (const id of teamIds) map[id] = { teamId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
  for (const m of matches) {
    const h = map[m.home], a = map[m.away]
    if (!h || !a) continue
    h.p++; a.p++
    h.gf += m.hg; h.ga += m.ag; a.gf += m.ag; a.ga += m.hg
    if (m.hg > m.ag) { h.w++; a.l++; h.pts += 3 }
    else if (m.hg < m.ag) { a.w++; h.l++; a.pts += 3 }
    else { h.d++; a.d++; h.pts++; a.pts++ }
  }
  for (const r of Object.values(map)) r.gd = r.gf - r.ga
  return Object.values(map)
}

// Criterios: puntos, diferencia de gol, goles a favor, resultado entre los empatados, orden alfabético.
export function table(teamIds: string[], matches: Match[]): TableRow[] {
  const base = rows(teamIds, matches)
  const key = (r: TableRow) => `${r.pts}|${r.gd}|${r.gf}`
  const sorted = [...base].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  // desempate directo entre equipos con la misma clave
  const out: TableRow[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && key(sorted[j + 1]) === key(sorted[i])) j++
    const tied = sorted.slice(i, j + 1)
    if (tied.length > 1) {
      const ids = tied.map((t) => t.teamId)
      const h2h = rows(ids, matches.filter((m) => ids.includes(m.home) && ids.includes(m.away)))
      const hv = Object.fromEntries(h2h.map((r) => [r.teamId, r]))
      tied.sort((a, b) =>
        hv[b.teamId].pts - hv[a.teamId].pts || hv[b.teamId].gd - hv[a.teamId].gd ||
        TEAM_BY_ID[a.teamId].name.localeCompare(TEAM_BY_ID[b.teamId].name))
    }
    out.push(...tied)
    i = j + 1
  }
  return out
}

export function groupTable(group: string, matches: Match[], upToMatchday = 3): TableRow[] {
  const ids = Object.values(TEAM_BY_ID).filter((t) => t.group === group).map((t) => t.id)
  return table(ids, matches.filter((m) => m.group === group && m.matchday <= upToMatchday))
}

export function qualifiers(matches: Match[], groups?: Record<string, string[]>): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {}
  for (const g of 'ABCDEFGH') {
    const t = groups ? table(groups[g], matches.filter((m) => m.group === g)) : groupTable(g, matches)
    out[g] = [t[0].teamId, t[1].teamId]
  }
  return out
}

export function r16Pairs(q: Record<string, [string, string]>): [string, string][] {
  // 1A-2B, 1C-2D, 1E-2F, 1G-2H, 1B-2A, 1D-2C, 1F-2E, 1H-2G
  return [
    [q.A[0], q.B[1]], [q.C[0], q.D[1]], [q.E[0], q.F[1]], [q.G[0], q.H[1]],
    [q.B[0], q.A[1]], [q.D[0], q.C[1]], [q.F[0], q.E[1]], [q.H[0], q.G[1]],
  ]
}
