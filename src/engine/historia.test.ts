import { describe, expect, it } from 'vitest'
import { STORY_MATCHES, PLAYER_BY_ID } from '../data'
import { DECLARED_R16 } from '../data/raw'
import { STORY_KNOCKOUT } from '../data/storyKnockout'
import { hashString } from './rng'
import type { KoMatch } from '../types'

describe('historia oficial', () => {
  it('los 48 resultados de grupos no cambian (huella fija)', () => {
    const s = STORY_MATCHES.map((m) => [m.id, m.group, m.matchday, m.home, m.away, m.hg, m.ag].join(':')).join('|')
    expect(STORY_MATCHES.length).toBe(48)
    expect(hashString(s)).toBe(1236612517)
  })
})

describe('eliminatorias congeladas', () => {
  const b = STORY_KNOCKOUT.bracket
  const all: KoMatch[] = [...b.r16, ...b.qf, ...b.sf, b.third, b.final]
  it('los octavos son exactamente los cruces oficiales', () => {
    expect(b.r16.map((m) => [m.a, m.b])).toEqual(DECLARED_R16)
  })
  it('cada partido está completo y es coherente', () => {
    for (const m of all) {
      expect(m.a && m.b && m.winner).toBeTruthy()
      expect([m.a, m.b]).toContain(m.winner)
      const reg = (m.goals ?? []).filter((g) => g.phase !== 'et')
      const et = (m.goals ?? []).filter((g) => g.phase === 'et')
      expect((m.goals ?? []).length).toBe(m.ga! + m.gb!)
      expect(reg.length + et.length).toBe(m.ga! + m.gb!)
      if (m.ga === m.gb) expect(m.pens).toBeTruthy() // empate tras prórroga se define por penales
      else expect(m.winner).toBe(m.ga! > m.gb! ? m.a : m.b)
      for (const g of m.goals ?? []) expect(PLAYER_BY_ID[g.scorerId]?.teamId).toBe(g.teamId)
    }
  })
  it('el cuadro avanza bien: ganadores de una ronda son los equipos de la siguiente', () => {
    b.qf.forEach((m, i) => { expect([m.a, m.b]).toEqual([b.r16[2 * i].winner, b.r16[2 * i + 1].winner]) })
    b.sf.forEach((m, i) => { expect([m.a, m.b]).toEqual([b.qf[2 * i].winner, b.qf[2 * i + 1].winner]) })
    const loser = (m: KoMatch) => (m.winner === m.a ? m.b : m.a)
    expect([b.third.a, b.third.b]).toEqual([loser(b.sf[0]), loser(b.sf[1])])
    expect([b.final.a, b.final.b]).toEqual([b.sf[0].winner, b.sf[1].winner])
    expect(b.champion).toBe(b.final.winner)
  })
})
