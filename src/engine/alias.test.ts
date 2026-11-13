import { describe, expect, it } from 'vitest'
import { aliasDeNombre, esAliasPorDefecto } from './ranking'

describe('nombre público de una cuenta', () => {
  it('nombre y primera letra del apellido', () => {
    expect(aliasDeNombre('Cristian Alegria')).toBe('Cristian A')
    expect(aliasDeNombre('Kevin Alegría')).toBe('Kevin A')
  })
  it('con apellido paterno y materno se usa el paterno', () => {
    expect(aliasDeNombre('Cristian Alegria Torres')).toBe('Cristian A')
    expect(aliasDeNombre('Juan Pablo Pérez Soto')).toBe('Juan P')
  })
  it('una sola palabra o vacío', () => {
    expect(aliasDeNombre('Cristian')).toBe('Cristian')
    expect(aliasDeNombre('   ')).toBe('')
  })
  it('detecta el nombre automático', () => {
    expect(esAliasPorDefecto('Jugador 7G9U')).toBe(true)
    expect(esAliasPorDefecto('Cris A')).toBe(false)
  })
})
