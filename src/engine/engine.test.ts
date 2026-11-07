import { describe, expect, it } from 'vitest'
import { validate } from './validate'
import { DEFAULT_PARAMS, advance, championOdds, emptyBracket, newAlt, nextPhase, probabilities, runAll, simulateGroups, simulateMatch } from './model'
import { makeRng } from './rng'
import { STORY_MATCHES } from '../data'
import { DECLARED_R16 } from '../data/raw'

describe('datos e integridad', () => {
  it('no tiene fallos de validación', () => {
    const fails = validate().filter((c) => c.level === 'fail')
    expect(fails).toEqual([])
  })
  it('conserva los 48 resultados originales', () => {
    expect(STORY_MATCHES).toHaveLength(48)
    expect(STORY_MATCHES[0]).toMatchObject({ home: 'bra', away: 'eng', hg: 2, ag: 1 })
  })
})

describe('motor', () => {
  it('es reproducible con la misma semilla', () => {
    const a = simulateMatch('bra', 'arg', makeRng('x'), DEFAULT_PARAMS, true)
    const b = simulateMatch('bra', 'arg', makeRng('x'), DEFAULT_PARAMS, true)
    expect(a).toEqual(b)
  })
  it('las probabilidades suman 1', () => {
    const p = probabilities('bra', 'jpn', DEFAULT_PARAMS)
    expect(p.win + p.draw + p.loss).toBeCloseTo(1, 5)
    expect(p.win).toBeGreaterThan(p.loss)
  })
  it('las eliminatorias siempre tienen ganador', () => {
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch('chi', 'ita', makeRng('k' + i), DEFAULT_PARAMS, true)
      expect(r.winner).toBeTruthy()
    }
  })
  it('un torneo alternativo llega a campeón sin tocar la historia', () => {
    const before = JSON.stringify(STORY_MATCHES)
    const t = runAll(newAlt('s1', 'octavos', STORY_MATCHES, DEFAULT_PARAMS), DEFAULT_PARAMS)
    expect(t.bracket.champion).toBeTruthy()
    expect(JSON.stringify(STORY_MATCHES)).toBe(before)
    expect(nextPhase(t.bracket)).toBe('done')
  })
  it('simula 48 partidos de grupos', () => {
    expect(simulateGroups('g', DEFAULT_PARAMS)).toHaveLength(48)
  })
  it('sin favoritismo: el campeón varía y ningún país domina', () => {
    const odds = championOdds(DECLARED_R16, DEFAULT_PARAMS, 400, 'mc')
    const top = Math.max(...Object.values(odds))
    expect(Object.keys(odds).length).toBeGreaterThan(5)
    expect(top).toBeLessThan(0.4)
    console.log(Object.entries(odds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`).join(' '))
  })
  it('advance respeta las fases', () => {
    let b = emptyBracket(DECLARED_R16)
    b = advance(b, 's', DEFAULT_PARAMS)
    expect(b.qf[0].a).toBe(b.r16[0].winner)
  })
})
