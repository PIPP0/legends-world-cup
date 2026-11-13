import { describe, expect, it } from 'vitest'
import { esOfensivo, nombreVisible } from './moderacion'

describe('filtro de nombres ofensivos', () => {
  it('bloquea groserías en varios idiomas, con trucos comunes', () => {
    for (const t of ['Puta madre', 'm1erda', 'fuuuck', 'F U C K', 'hdp', 'CTM', 'Hijo de puta', 'Scheiße', 'putain', 'vaffanculo', 'anjing', 'n1gger', 'Heil Hitler']) expect(esOfensivo(t)).toBe(true)
  })
  it('no bloquea nombres normales ni palabras que solo contienen letras parecidas', () => {
    for (const t of ['Cristian A', 'Kevin A', 'Analía G', 'Scunthorpe', 'Dickens', 'Cocktail', 'Pedro M', 'Putin', 'Concepción R', 'Bastián P', 'Matías', 'Jugador 7G9U', 'Hitomi K']) expect(esOfensivo(t)).toBe(false)
  })
  it('un nombre ofensivo ya guardado se muestra como Jugador + código', () => {
    expect(nombreVisible('Puta madre', 'abcd1234')).toBe('Jugador ABCD')
    expect(nombreVisible('Cristian A', 'abcd1234')).toBe('Cristian A')
  })
})
