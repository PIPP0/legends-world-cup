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

import { lambdas } from './model'
import { contextFor } from './world'
import type { WorldConfig } from '../types'

describe('mundial personalizado', () => {
  const w = (hostId: string, finalVenue: string): WorldConfig => ({ hostId, season: 'verano', finalVenue, history: {} })
  it('el local gana ventaja y el visitante en altura la pierde', () => {
    const ctx = { venueId: 'azteca', temp: 22, rain: 0 }
    const [neutral] = lambdas('mex', 'bra', DEFAULT_PARAMS)
    const [casa] = lambdas('mex', 'bra', DEFAULT_PARAMS, { ctx, world: w('mex', 'azteca') })
    expect(casa).toBeGreaterThan(neutral)
    const [, brNeutral] = lambdas('mex', 'bra', DEFAULT_PARAMS)
    const [, brAltura] = lambdas('mex', 'bra', DEFAULT_PARAMS, { ctx, world: w('mex', 'azteca') })
    expect(brAltura).toBeLessThan(brNeutral)
  })
  it('la lluvia baja los goles esperados', () => {
    const base = { venueId: 'wembley', temp: 15, rain: 0 }
    const [x] = lambdas('eng', 'ger', DEFAULT_PARAMS, { ctx: base })
    const [y] = lambdas('eng', 'ger', DEFAULT_PARAMS, { ctx: { ...base, rain: 1 } })
    expect(y).toBeLessThan(x)
  })
  it('estadio y clima son deterministas por semilla y distintos entre semillas', () => {
    const world = w('bra', 'maracana')
    expect(contextFor(world, 's1', 'A1')).toEqual(contextFor(world, 's1', 'A1'))
    expect(contextFor(world, 's1', 'F').venueId).toBe('maracana')
    const g1 = simulateGroups('s1', DEFAULT_PARAMS, world).map((m) => `${m.hg}${m.ag}`).join()
    const g2 = simulateGroups('s2', DEFAULT_PARAMS, world).map((m) => `${m.hg}${m.ag}`).join()
    expect(g1).not.toBe(g2)
  })
})

describe('prime y fecha', () => {
  it('un jugador en su prime sube la fuerza de su equipo', () => {
    const w: WorldConfig = { hostId: 'bra', season: 'verano', finalVenue: 'maracana', history: {}, primes: ['chi-elias-figueroa'] }
    const base = lambdas('chi', 'bra', DEFAULT_PARAMS)[0]
    const prime = lambdas('chi', 'bra', DEFAULT_PARAMS, { world: w })[0]
    expect(prime).toBeGreaterThan(base)
  })
  it('el mes cambia la temperatura (hemisferio sur invertido)', () => {
    const jan = contextFor({ hostId: 'chi', season: 'verano', month: 1, finalVenue: 'nacional', history: {} }, 'x', 'A1')
    const jul = contextFor({ hostId: 'chi', season: 'verano', month: 7, finalVenue: 'nacional', history: {} }, 'x', 'A1')
    expect(jan.temp).toBeGreaterThan(jul.temp)
  })
})

import { drawGroups } from './model'
describe('sorteo', () => {
  it('reparte 32 equipos en 8 grupos de 4, uno por bombo, y es reproducible', () => {
    const g = drawGroups('s1')
    const all = Object.values(g).flat()
    expect(new Set(all).size).toBe(32)
    expect(Object.values(g).every((x) => x.length === 4)).toBe(true)
    expect(drawGroups('s1')).toEqual(g)
    expect(drawGroups('s2')).not.toEqual(g)
  })
  it('un mundial con grupos sorteados llega a campeón', () => {
    const g = drawGroups('z')
    const t = runAll(newAlt('z', 'completo', [], DEFAULT_PARAMS, undefined, g), DEFAULT_PARAMS)
    expect(t.bracket.champion).toBeTruthy()
    expect(t.groupMatches.length).toBe(48)
  })
})

import { TEAMS } from '../data'
describe('planteles de 23', () => {
  it('cada selección tiene 11 titulares, 12 suplentes y al menos 3 arqueros', () => {
    for (const t of TEAMS) {
      expect(t.xi.length).toBe(11)
      expect(t.bench.length).toBe(12)
      expect(t.squad.length).toBe(23)
      expect(t.squad.filter((p) => p.pos === 'PO').length).toBeGreaterThanOrEqual(3)
      expect(t.xi.every((p) => p.starter)).toBe(true)
      expect(t.bench.every((p) => !p.starter)).toBe(true)
    }
  })
})
