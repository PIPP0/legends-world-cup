import { describe, expect, it } from 'vitest'
import { leerRankingNube, vaciarCacheRanking } from './ranking'

// Sin nube configurada la lectura devuelve vacío sin tocar la red: sirve para comprobar que el caché y la lectura compartida no rompen nada.
describe('lectura del ranking', () => {
  it('devuelve una lista (vacía sin nube) y se puede pedir varias veces a la vez', async () => {
    vaciarCacheRanking()
    const r = await Promise.all([leerRankingNube(), leerRankingNube(), leerRankingNube()])
    expect(r.every((x) => Array.isArray(x))).toBe(true)
  })
})
