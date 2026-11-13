import { describe, expect, it } from 'vitest'
import { fusionarDuelo, type StatsDuelo } from './duelo'
import type { Equipo } from '../engine/duelo'

const eq = (creado: number, id = 'x'): Equipo => ({ formacion: '4-4-2', once: Array.from({ length: 11 }, (_, i) => `${id}${i}`), suplentes: [], creado })
const st = (jugados: number): StatsDuelo => ({ jugados, ganados: 0, perdidos: 0, racha: 0, mejorRacha: 0 })

describe('sincronización del duelo', () => {
  it('si este dispositivo no tiene equipo, se usa el de la nube', () => {
    expect(fusionarDuelo({ equipo: null, stats: null }, { equipo: eq(5, 'n'), stats: st(3) })).toEqual({ equipo: eq(5, 'n'), stats: st(3) })
  })
  it('si la nube no tiene nada, se conserva lo local', () => {
    expect(fusionarDuelo({ equipo: eq(5), stats: st(2) }, { equipo: null, stats: null })).toEqual({ equipo: eq(5), stats: st(2) })
  })
  it('con dos equipos gana el más reciente', () => {
    expect(fusionarDuelo({ equipo: eq(10, 'l'), stats: null }, { equipo: eq(5, 'n'), stats: null }).equipo?.creado).toBe(10)
    expect(fusionarDuelo({ equipo: eq(4, 'l'), stats: null }, { equipo: eq(5, 'n'), stats: null }).equipo?.creado).toBe(5)
  })
  it('con dos estadísticas gana la que lleva más partidos y nunca se pierde una con más historial', () => {
    expect(fusionarDuelo({ equipo: null, stats: st(9) }, { equipo: null, stats: st(4) }).stats?.jugados).toBe(9)
    expect(fusionarDuelo({ equipo: null, stats: st(1) }, { equipo: null, stats: st(4) }).stats?.jugados).toBe(4)
  })
})
