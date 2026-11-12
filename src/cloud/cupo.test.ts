import { describe, expect, it } from 'vitest'
import { cupoLleno } from './firebase'

describe('cupo de cuentas', () => {
  it('sin lectura o sin tope no bloquea a nadie', () => {
    expect(cupoLleno(null)).toBe(false)
    expect(cupoLleno({ usadas: 9999, tope: 0 })).toBe(false)
  })
  it('hay cupo mientras las usadas sean menos que el tope', () => {
    expect(cupoLleno({ usadas: 499, tope: 500 })).toBe(false)
  })
  it('se llena al llegar al tope', () => {
    expect(cupoLleno({ usadas: 500, tope: 500 })).toBe(true)
    expect(cupoLleno({ usadas: 501, tope: 500 })).toBe(true)
  })
})
