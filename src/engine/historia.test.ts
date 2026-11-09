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
  it('octavos editados por el autor: Argentina 1-0 Inglaterra y España 2-1 Bélgica', () => {
    const o5 = b.r16[4], o7 = b.r16[6]
    expect([o5.a, o5.b, o5.ga, o5.gb, o5.winner]).toEqual(['arg', 'eng', 1, 0, 'arg'])
    expect([o7.a, o7.b, o7.ga, o7.gb, o7.winner, o7.et, o7.pens]).toEqual(['esp', 'bel', 2, 1, 'esp', false, undefined])
  })
  it('cuartos definidos por el autor', () => {
    const q = b.qf.map((m) => [m.a, m.b, m.ga, m.gb, m.winner, m.pens ?? null])
    expect(q).toEqual([
      ['bra', 'ita', 2, 1, 'bra', null],
      ['fra', 'ned', 2, 2, 'fra', [4, 3]],
      ['arg', 'hun', 3, 1, 'arg', null],
      ['esp', 'por', 3, 3, 'esp', [5, 4]],
    ])
  })
  it('semifinal 1 definida por el autor: Brasil 2-1 Francia; el cuadro sigue coherente', () => {
    const s1 = b.sf[0]
    expect([s1.a, s1.b, s1.ga, s1.gb, s1.winner]).toEqual(['bra', 'fra', 2, 1, 'bra'])
    expect([b.final.a, b.final.b]).toEqual(['bra', 'esp'])
    expect([b.third.a, b.third.b, b.third.ga, b.third.gb, b.third.winner, b.third.pens]).toEqual(['fra', 'arg', 2, 2, 'arg', [4, 5]])
    expect(b.third.goals?.filter((g) => g.teamId === 'arg').map((g) => g.scorerId)).toEqual(['arg-lionel-messi', 'arg-diego-maradona'])
    expect([b.final.ga, b.final.gb, b.final.winner, b.final.pens ?? null]).toEqual([1, 0, 'bra', null])
    expect(b.final.goals?.map((g) => g.scorerId)).toEqual(['bra-pele'])
    expect(b.champion).toBe('bra')
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

import { storyPlayerStats, storyTeamStats } from './stats'
import { revealed, teamStatus } from './historia'
describe('estadísticas con eliminatorias reveladas', () => {
  it('sin avanzar no suman nada; al avanzar suman goles y partidos', () => {
    expect(revealed(0).length).toBe(0)
    expect(revealed(1).length).toBe(8)
    expect(revealed(4).length).toBe(16)
    const g = (lvl: number) => storyPlayerStats(lvl).reduce((a, s) => a + s.goals, 0)
    const ko = (lvl: number) => revealed(lvl).reduce((a, m) => a + m.ga! + m.gb!, 0)
    expect(g(4) - g(0)).toBe(ko(4))
  })
  it('los penales cuentan como empate y las selecciones suman partidos', () => {
    const t = storyTeamStats(STORY_MATCHES, 4)
    const bra = t.find((x) => x.teamId === 'bra')!
    expect(bra.pj).toBe(7)
    const fra = t.find((x) => x.teamId === 'fra')!
    expect(fra.d).toBeGreaterThan(0)
  })
  it('estado de una selección en el cuadro', () => {
    expect(teamStatus('eng', 1).text).toContain('Eliminada en octavos')
    expect(teamStatus('bra', 4).text).toContain('Campeona')
    expect(teamStatus('arg', 1).next?.opp).toBe('hun')
  })
})
