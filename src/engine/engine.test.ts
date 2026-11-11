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

describe('anfitrión', () => {
  it('el país anfitrión siempre es primero del Grupo A y el sorteo sigue siendo válido', () => {
    for (const host of ['chi', 'mex', 'bra', 'jpn']) {
      for (const seed of ['a', 'b', 'c']) {
        const g = drawGroups(seed, DEFAULT_PARAMS, host)
        expect(g.A[0]).toBe(host)
        expect(new Set(Object.values(g).flat()).size).toBe(32)
        expect(Object.values(g).every((x) => x.length === 4)).toBe(true)
      }
    }
  })
})

import { scoreMatrix } from './model'
describe('probabilidades coherentes con la simulación', () => {
  it('la matriz de marcadores suma 1 y coincide con la frecuencia simulada', () => {
    const P0 = { ...DEFAULT_PARAMS, variance: 0 }
    const pr = probabilities('col', 'mex', P0) // pareja equilibrada: el filtro de coherencia no actúa
    expect(scoreMatrix(1.2, 1.5).flat().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    let w = 0, d = 0, l = 0
    const N = 12000
    for (let i = 0; i < N; i++) {
      const r = simulateMatch('col', 'mex', makeRng('q' + i), P0, false)
      if (r.ga > r.gb) w++; else if (r.ga === r.gb) d++; else l++
    }
    expect(Math.abs(w / N - pr.win)).toBeLessThan(0.02)
    expect(Math.abs(d / N - pr.draw)).toBeLessThan(0.02)
    expect(Math.abs(l / N - pr.loss)).toBeLessThan(0.02)
  })
  it('las goleadas de 6 o más goles son muy raras', () => {
    let big = 0
    for (let i = 0; i < 6000; i++) { const r = simulateMatch('chi', 'bra', makeRng('g' + i), DEFAULT_PARAMS, false); if (r.ga >= 6 || r.gb >= 6) big++ }
    expect(big / 6000).toBeLessThan(0.01)
  })
  it('con gran diferencia el favorito gana casi siempre y no hay resultados absurdos', () => {
    let w = 0, dogBig = 0, N = 3000
    for (let i = 0; i < N; i++) {
      const r = simulateMatch('bra', 'rou', makeRng('f' + i), DEFAULT_PARAMS, false)
      if (r.ga > r.gb) w++
      if (r.gb - r.ga >= 2) dogBig++
    }
    expect(w / N).toBeGreaterThan(0.95)
    expect(dogBig / N).toBeLessThan(0.03) // solo la rarísima «sorpresa» (4 %) puede dejarlo pasar
    // un favorito moderado (≈65 %) nunca pierde por 3 o más goles
    let absurdo = 0
    for (let i = 0; i < 6000; i++) { const r = simulateMatch('arg', 'kor', makeRng('h' + i), DEFAULT_PARAMS, false); if (r.gb - r.ga >= 3) absurdo++ }
    expect(absurdo).toBe(0)
  })
})

import oddsPortadaJson from '../data/oddsPortada.json'
describe('probabilidades de la portada', () => {
  it('el archivo guardado coincide con el cálculo actual (si falla: npx tsx scripts/odds-portada.ts)', () => {
    const vivo = championOdds(DECLARED_R16, DEFAULT_PARAMS, 300, 'home')
    for (const [k, v] of Object.entries(vivo)) expect((oddsPortadaJson as Record<string, number>)[k] ?? 0).toBeCloseTo(v, 3)
  })
})

import { equipoMaquina, eligeMaquina, jugarRonda, ofertas, penales, sedeDuelo, FORMACIONES, RONDAS, N_PICKS, type Equipo, type Nivel } from './duelo'
describe('duelo «Mi Once Ideal»', () => {
  it('las ofertas del draft son 3, distintas, compatibles con el puesto y repetibles con la misma semilla', () => {
    const a = ofertas('s1', '4-3-3', 0, []), b = ofertas('s1', '4-3-3', 0, [])
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id))
    expect(new Set(a.map((p) => p.id)).size).toBe(3)
    expect(a.every((p) => p.pos === 'PO')).toBe(true)
    expect(ofertas('s1', '4-3-3', 12, [a[0].id]).every((p) => p.line !== 'GK' && p.id !== a[0].id)).toBe(true)
  })
  it('un equipo de la máquina tiene 11 titulares y 3 suplentes sin repetir', () => {
    const e = equipoMaquina('oro', 'x')
    expect(e.once.length).toBe(11); expect(e.suplentes.length).toBe(3)
    expect(new Set([...e.once, ...e.suplentes]).size).toBe(N_PICKS)
    expect(Object.keys(FORMACIONES)).toContain(e.formacion)
  })
  it('el duelo es justo: a igual nivel ~50 %, y el nivel alto vence al bajo', () => {
    const duelo = (seed: string, a: Equipo, b: Equipo, na: Nivel, nb: Nivel) => {
      const ctx = sedeDuelo(seed); let ga = 0, gb = 0, cA: string[] = [], cB: string[] = []
      for (let r = 1; r <= RONDAS; r++) {
        const ea = eligeMaquina(seed + 'a', r, a, cA, na), eb = eligeMaquina(seed + 'b', r, b, cB, nb)
        const res = jugarRonda(seed, r, a, b, ea, eb, ctx); ga += res.golesMios; gb += res.golesRival; cA = [ea.atacante, ea.defensor]; cB = [eb.atacante, eb.defensor]
      }
      if (ga === gb) { const p = penales(seed, a, b); return p.yo > p.rival }
      return ga > gb
    }
    const gana = (na: Nivel, nb: Nivel) => { let w = 0; const N = 400; for (let i = 0; i < N; i++) { const s = 't' + i; if (duelo(s, equipoMaquina(na, s), equipoMaquina(nb, s + 'x'), na, nb)) w++ } return w / N }
    expect(Math.abs(gana('oro', 'oro') - 0.5)).toBeLessThan(0.1)
    expect(gana('leyenda', 'bronce')).toBeGreaterThan(0.72)
  })
})
