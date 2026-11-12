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

import { PLAYER_BY_ID } from '../data'
import { quimicaTrio, nivelEquipo, bonoNivelEquipo, victoriasParaSubir } from './jugada'
import { MATRIZ, ATAQUES, DEFENSAS, segundosBarra, precision, resolverJugada, eligeAtaqueMaquina, eligeDefensaMaquina, toqueMaquina, encajeAtaque, estiloJugador, disponibles as disponiblesTurno } from './jugada'
import { equipoMaquina, eligeMaquina, jugarRonda, ofertas, onceDeEjemplo, TOPE_SUPLENTE, bloqueados, aplicarPoderes, eligePoderMaquina, reemplazoMaquina, candidatos, todosLosPoderes, TIPOS_PODER, type Poder, penales, sedeDuelo, FORMACIONES, RONDAS, N_PICKS, type Equipo, type Nivel } from './duelo'
describe('duelo «Mi Once Ideal»', () => {
  it('las ofertas del draft son 3, distintas, compatibles con el puesto y repetibles con la misma semilla', () => {
    const a = ofertas('s1', '4-3-3', 0, []), b = ofertas('s1', '4-3-3', 0, [])
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id))
    expect(new Set(a.map((p) => p.id)).size).toBe(3)
    expect(a.every((p) => p.pos === 'PO')).toBe(true)
    expect(ofertas('s1', '4-3-3', 12, [a[0].id]).every((p) => p.line !== 'GK' && p.id !== a[0].id)).toBe(true)
    // nunca dos jugadores del mismo país en un sorteo; con favorita, exactamente en 3 sorteos distintos sale alguien de su país
    for (let n = 0; n < 40; n++) {
      let con = 0
      for (let paso = 0; paso < 14; paso++) {
        const o = ofertas(`f${n}`, '4-3-3', paso, [], 'bra')
        expect(new Set(o.map((p) => p.teamId)).size).toBe(o.length)
        if (o.some((p) => p.teamId === 'bra')) con++
      }
      expect(con).toBeLessThanOrEqual(3)
      expect(con).toBeGreaterThanOrEqual(2)
    }
    for (let n = 0; n < 60; n++) for (const paso of [11, 12, 13]) expect(ofertas(`t${n}`, '4-3-3', paso, []).every((p) => p.ovr <= TOPE_SUPLENTE)).toBe(true)
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

  it('poderes: impulso suma, debilitar resta, bloqueo obliga a cambiar y un poder sobre quien ya no juega se pierde', () => {
    const yo = { formacion: '4-3-3', once: onceDeEjemplo('4-3-3'), suplentes: [] as string[], creado: 1 }
    const rival = equipoMaquina('plata', 'pw1')
    const mio = { atacante: yo.once[8], defensor: yo.once[1] }, su = { atacante: rival.once[9], defensor: rival.once[2] }
    const base = jugarRonda('pw', 1, yo, rival, mio, su, undefined)
    const { ajustes, efectos } = aplicarPoderes({ tipo: 'impulso', objetivo: mio.atacante }, { tipo: 'debilitar', objetivo: mio.atacante }, mio, su)
    expect(ajustes.mio[mio.atacante]).toBe(2 - 3)
    expect(efectos.every((e) => e.aplicado)).toBe(true)
    const mejor = aplicarPoderes({ tipo: 'impulso', objetivo: mio.atacante }, undefined, mio, su)
    const con = jugarRonda('pw', 1, yo, rival, mio, su, undefined, mejor.ajustes)
    expect(con.mia.pPase).toBeGreaterThan(base.mia.pPase)
    // bloqueo: detecta el puesto bloqueado; si el jugador impulsado fue cambiado, el impulso se pierde
    expect(bloqueados({ tipo: 'bloqueo', objetivo: su.atacante }, undefined, mio, su).su).toBe('atacante')
    const cambiado = { ...mio, atacante: yo.once[7] }
    expect(aplicarPoderes({ tipo: 'impulso', objetivo: mio.atacante }, undefined, cambiado, su).efectos[0].aplicado).toBe(false)
    const rem = reemplazoMaquina('pw', 1, rival, [], 'plata', su, 'atacante', su.atacante)
    expect(rem.atacante).not.toBe(su.atacante); expect(rem.atacante).not.toBe(rem.defensor)
    expect(candidatos(rival, 1, [], [su.atacante]).includes(su.atacante)).toBe(false)
  })
  it('la máquina usa cada poder como máximo una vez y los gasta todos en una partida de 5 rondas', () => {
    for (const nivel of ['bronce', 'plata', 'oro', 'leyenda'] as const) {
      for (let n = 0; n < 20; n++) {
        const yo = { formacion: '4-3-3', once: onceDeEjemplo('4-3-3'), suplentes: [] as string[], creado: 1 }
        const rival = equipoMaquina(nivel, `m${n}`)
        const disp = todosLosPoderes(); const usados: string[] = []
        for (let ronda = 1; ronda <= 5; ronda++) {
          const pw = eligePoderMaquina(`m${n}`, ronda, nivel, disp, { atacante: rival.once[9], defensor: rival.once[2] }, { atacante: yo.once[8], defensor: yo.once[1] })
          if (pw) { expect(disp[pw.tipo]).toBe(true); disp[pw.tipo] = false; usados.push(pw.tipo) }
        }
        expect(new Set(usados).size).toBe(usados.length)
        expect(usados.length).toBe(TIPOS_PODER.length)
      }
    }
  })

  it('jugada: cada defensa frena a un ataque y sufre con otro, la barra va más lenta con mejor encaje y el centro rinde más', () => {
    for (const a of ATAQUES) expect(DEFENSAS.reduce((x, d) => x + MATRIZ[a][d], 0)).toBe(0)
    for (const d of DEFENSAS) expect(ATAQUES.reduce((x, a) => x + MATRIZ[a][d], 0)).toBe(0)
    for (const d of DEFENSAS) { const col = ATAQUES.map((a) => MATRIZ[a][d]); expect(Math.min(...col)).toBeLessThan(0); expect(Math.max(...col)).toBeGreaterThanOrEqual(0) }
    for (const a of ATAQUES) { const fila = DEFENSAS.map((d) => MATRIZ[a][d]); expect(Math.max(...fila)).toBeGreaterThan(0); expect(Math.min(...fila)).toBeLessThan(0) }
    expect(segundosBarra(95)).toBeGreaterThan(segundosBarra(80)); expect(segundosBarra(80)).toBeGreaterThan(segundosBarra(60))
    expect(precision(0.5)).toBe(1); expect(precision(0.05)).toBeLessThan(precision(0.4)); expect(precision(0)).toBe(0)
    const yo = onceDeEjemplo('4-3-3'); const rival = equipoMaquina('plata', 'j1')
    const base = { seed: 'j', turno: 1, ataca: 'mio' as const, ataque: 'contra' as const, defensa: 'presion' as const, trioA: [yo[9], yo[8], yo[10]], trioD: rival.once.slice(2, 5), ajA: {}, ajD: {}, ejecutor: yo[9], interceptor: rival.once[2], precD: 0, arquero: rival.once[0], clima: 1 }
    const centro = resolverJugada({ ...base, precA: 1 }), borde = resolverJugada({ ...base, precA: 0 })
    expect(centro.pRemate).toBeGreaterThan(borde.pRemate)
    expect(resolverJugada({ ...base, precA: 1 }).resultado).toBe(centro.resultado) // misma semilla, mismo resultado
    const sup = resolverJugada({ ...base, precA: 0.7 }), flojo = resolverJugada({ ...base, defensa: 'bloque', precA: 0.7 })
    expect(sup.nivel).toBeGreaterThan(flojo.nivel); expect(sup.pPaso).toBeGreaterThan(flojo.pPaso)
  })
  it('jugada: la máquina elige 3 jugadores distintos, sin arquero ni cansados, y estilos coherentes', () => {
    for (const nivel of ['bronce', 'plata', 'oro', 'leyenda'] as const) {
      const eq = equipoMaquina(nivel, 'jm'); const cansados = eq.once.slice(1, 4)
      const at = eligeAtaqueMaquina('jm', 2, eq, cansados, nivel, []), df = eligeDefensaMaquina('jm', 2, eq, cansados, nivel, [])
      for (const trio of [at.trio, df.trio]) { expect(new Set(trio).size).toBe(3); expect(trio.every((id) => !cansados.includes(id) && disponiblesTurno(eq, 2, cansados).includes(id))).toBe(true) }
      const x = toqueMaquina('jm', 2, nivel, 1, 'ataca'); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1)
    }
    expect(encajeAtaque(onceDeEjemplo('4-3-3')[8], 'contra')).toBeGreaterThan(0)
    expect(['veloz', 'regateador', 'fuerte', 'pasador', 'goleador', 'muro']).toContain(estiloJugador(PLAYER_BY_ID[onceDeEjemplo('4-3-3')[8]]))
  })

  it('química del trío y nivel de equipo: mismo país suma, tres iguales restan, el nivel crece de a poco y tiene tope', () => {
    const ids = (pref: string) => Object.keys(PLAYER_BY_ID).filter((k) => k.startsWith(pref))
    const bra = ids('bra-').slice(0, 3)
    expect(quimicaTrio(bra, true).razones.some((r) => r.tipo === 'pais')).toBe(true)
    expect(quimicaTrio(bra, true).total).toBeLessThanOrEqual(6)
    const mezcla = [ids('bra-')[0], ids('arg-')[0], ids('ger-')[0]]
    expect(quimicaTrio(mezcla, true).razones.every((r) => r.tipo !== 'pais')).toBe(true)
    expect(nivelEquipo(0)).toBe(1); expect(nivelEquipo(4)).toBe(3); expect(nivelEquipo(9)).toBe(4)
    expect(bonoNivelEquipo(0)).toBe(0); expect(bonoNivelEquipo(1)).toBeGreaterThan(0)
    expect(bonoNivelEquipo(4) - bonoNivelEquipo(1)).toBeLessThan(bonoNivelEquipo(1) * 2) // crece de a poco
    expect(bonoNivelEquipo(400)).toBe(3)
    expect(victoriasParaSubir(0)).toBe(1); expect(victoriasParaSubir(3)).toBe(1)
  })
})
