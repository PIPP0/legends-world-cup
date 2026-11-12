// Ranking del duelo: puntos por victoria según el nivel del rival, con jugadores de demostración (ficticios y marcados como tales)
// mezclados con los resultados reales de quienes juegan.
import type { Nivel } from './duelo'

// Ganar a un rival más difícil vale más. Estos puntos se suman en silencio: la pantalla no los declara.
export const PUNTOS_VICTORIA: Record<Nivel, number> = { bronce: 2, plata: 3, oro: 4, leyenda: 6 }
export const PUNTOS_MAX = 6 // las reglas de Firestore aceptan hasta 7 por partida

export interface EntradaRanking {
  id: string
  alias: string
  pais: string // código ISO de 2 letras (aproximado) o ''
  puntos: number
  ganadas: number
  jugadas: number
  mejorRacha: number
  demo?: boolean // jugador de demostración (ficticio)
  yo?: boolean
  activo?: boolean // punto verde «jugando ahora»
}

// Jugadores de DEMOSTRACIÓN: nombres inventados y resultados ficticios, siempre marcados como tales en pantalla.
const DEMO: [string, string, number, number, number][] = [
  // alias, país, puntos, ganadas, jugadas
  ['Valentina R.', 'ar', 148, 34, 41], ['Kenji T.', 'jp', 139, 31, 39], ['Lucía M.', 'es', 131, 30, 38], ['Mateo G.', 'br', 124, 28, 37],
  ['Amara D.', 'ng', 118, 26, 35], ['Hugo L.', 'fr', 112, 25, 34], ['Sofía P.', 'mx', 107, 24, 33], ['Liam O.', 'ie', 101, 23, 33],
  ['Camila V.', 'cl', 96, 22, 32], ['Dario B.', 'it', 92, 21, 31], ['Noor A.', 'ma', 88, 20, 30], ['Tomás F.', 'uy', 84, 19, 29],
  ['Ingrid S.', 'se', 81, 19, 29], ['Rafael C.', 'pt', 77, 18, 28], ['Yuki H.', 'jp', 74, 17, 27], ['Elena K.', 'de', 71, 17, 27],
  ['Bruno Q.', 'co', 68, 16, 26], ['Ayesha N.', 'sn', 65, 15, 25], ['Joaquín E.', 'ar', 62, 15, 25], ['Marta Z.', 'pl', 59, 14, 24],
  ['Diego W.', 'pe', 56, 14, 24], ['Chloe J.', 'ca', 53, 13, 23], ['Santiago U.', 'ec', 50, 12, 22], ['Mia X.', 'us', 47, 12, 22],
  ['Omar Y.', 'eg', 44, 11, 21], ['Paula I.', 'br', 41, 10, 20], ['Nico A.', 'ch', 38, 10, 20], ['Lena B.', 'nl', 35, 9, 19],
  ['Iván R.', 'hr', 32, 8, 18], ['Zoe T.', 'au', 29, 8, 18], ['Gael M.', 'mx', 26, 7, 17], ['Rosa D.', 'bo', 23, 6, 16],
  ['Theo P.', 'be', 20, 6, 15], ['Inés L.', 'py', 17, 5, 14], ['Axel V.', 'dk', 14, 4, 13], ['Luna G.', 'cr', 11, 3, 12],
]
export const RANKING_DEMO: EntradaRanking[] = DEMO.map(([alias, pais, puntos, ganadas, jugadas], i) => ({
  id: `demo-${i}`, alias, pais, puntos, ganadas, jugadas, mejorRacha: Math.min(ganadas, 3 + ((i * 7) % 6)), demo: true,
}))

// Estadística propia (se guarda en el navegador; si hay nube también se publica en el ranking).
export interface MiRanking { puntos: number; ganadas: number; jugadas: number; racha: number; mejorRacha: number }
export const MI_RANKING0: MiRanking = { puntos: 0, ganadas: 0, jugadas: 0, racha: 0, mejorRacha: 0 }
export function sumarPartida(r: MiRanking, nivel: Nivel, gane: boolean): MiRanking {
  const racha = gane ? r.racha + 1 : 0
  return { puntos: r.puntos + (gane ? PUNTOS_VICTORIA[nivel] : 0), ganadas: r.ganadas + (gane ? 1 : 0), jugadas: r.jugadas + 1, racha, mejorRacha: Math.max(r.mejorRacha, racha) }
}

// Nombre público: solo letras, números, espacios, guion y guion bajo (sin puntos ni enlaces ni caracteres raros), máximo 20.
export function aliasLimpio(a: string): string {
  return a.normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20)
}
export const aliasPorDefecto = (semilla: string): string => `Jugador ${semilla.slice(0, 4).toUpperCase()}`

// Mezcla las entradas reales (de la nube), la propia y las de demostración; ordena por puntos y desempata por victorias.
export function armarRanking(reales: EntradaRanking[], yo: EntradaRanking | null): EntradaRanking[] {
  const sinMiNube = yo ? reales.filter((r) => r.id !== yo.id) : reales
  const todas = [...RANKING_DEMO, ...sinMiNube, ...(yo && yo.jugadas > 0 ? [{ ...yo, yo: true }] : [])]
  return todas.sort((a, b) => b.puntos - a.puntos || b.ganadas - a.ganadas || a.jugadas - b.jugadas)
}
export const posicionDe = (lista: EntradaRanking[], id: string): number => lista.findIndex((e) => e.id === id) + 1

// Quiénes de los jugadores de demostración aparecen «jugando ahora»: entre 5 y 10, y va rotando cada 25 segundos (determinista por franja de tiempo).
// Es solo mientras la comunidad es chica: cada persona real que aparece en el ranking resta un demo activo, y con 10 o más reales ya no hay ninguno.
export function demosActivos(ahoraMs: number, reales = 0): Set<string> {
  const franja = Math.floor(ahoraMs / 25000)
  const azar = (n: number) => { let x = (franja * 2654435761 + n * 40503) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0 }
  const cuantos = Math.max(0, 5 + (azar(999) % 6) - reales)
  const ids = RANKING_DEMO.map((d) => d.id).sort((a, b) => azar(Number(a.slice(5))) - azar(Number(b.slice(5))))
  return new Set(ids.slice(0, cuantos))
}
