import { describe, expect, it } from 'vitest'
import { esHispano } from './index'

describe('idioma por defecto', () => {
  it('español si el navegador está en español', () => {
    expect(esHispano(['es-CL', 'en'], '')).toBe(true)
    expect(esHispano(['es'], 'US')).toBe(true)
  })
  it('español si la zona horaria es de un país hispanohablante aunque el navegador esté en inglés', () => {
    expect(esHispano(['en-US'], 'CL')).toBe(true)
    expect(esHispano(['en-GB'], 'MX')).toBe(true)
  })
  it('inglés fuera de esos casos', () => {
    expect(esHispano(['en-US'], 'US')).toBe(false)
    expect(esHispano(['pt-BR'], 'BR')).toBe(false)
    expect(esHispano([], '')).toBe(false)
  })
})
