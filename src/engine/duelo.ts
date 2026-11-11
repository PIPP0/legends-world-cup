// «Mi Once Ideal: Duelo» — motor del juego. Todo determinista a partir de una semilla (misma semilla = mismas ofertas y mismo duelo).
// Reglas (resumen): armas un once con 3 suplentes eligiendo 1 de 3 leyendas por puesto (el equipo ya no se cambia); el duelo son 5 rondas:
// en cada ronda eliges un atacante y un defensor (la máquina o el rival también); los usados quedan cansados la ronda siguiente; los suplentes entran desde la ronda 3.
import { PLAYERS, PLAYER_BY_ID } from '../data'
import { HOSTS, VENUE_BY_ID } from '../data/world'
import { contextFor, weatherFactor } from './world'
import { makeRng, type Rng } from './rng'
import type { MatchCtx, Player, Pos, Line } from '../types'

export interface Hueco { pos: Pos; line: Line; x: number; y: number } // x,y en % de la cancha (arco propio abajo)
const H = (pos: Pos, line: Line, x: number, y: number): Hueco => ({ pos, line, x, y })

export const FORMACIONES: Record<string, Hueco[]> = {
  '4-3-3': [H('PO', 'GK', 50, 90), H('LI', 'DEF', 14, 70), H('DFC', 'DEF', 38, 74), H('DFC', 'DEF', 62, 74), H('LD', 'DEF', 86, 70), H('MC', 'MID', 28, 50), H('MCD', 'MID', 50, 55), H('MC', 'MID', 72, 50), H('EXT', 'ATT', 18, 22), H('DC', 'ATT', 50, 14), H('EXT', 'ATT', 82, 22)],
  '4-4-2': [H('PO', 'GK', 50, 90), H('LI', 'DEF', 14, 70), H('DFC', 'DEF', 38, 74), H('DFC', 'DEF', 62, 74), H('LD', 'DEF', 86, 70), H('MI', 'MID', 14, 46), H('MC', 'MID', 38, 50), H('MC', 'MID', 62, 50), H('MD', 'MID', 86, 46), H('DC', 'ATT', 36, 18), H('DC', 'ATT', 64, 18)],
  '4-2-3-1': [H('PO', 'GK', 50, 90), H('LI', 'DEF', 14, 70), H('DFC', 'DEF', 38, 74), H('DFC', 'DEF', 62, 74), H('LD', 'DEF', 86, 70), H('MCD', 'MID', 36, 56), H('MCD', 'MID', 64, 56), H('EXT', 'ATT', 18, 34), H('MCO', 'MID', 50, 34), H('EXT', 'ATT', 82, 34), H('DC', 'ATT', 50, 14)],
}
export const NOMBRES_FORMACION = Object.keys(FORMACIONES)

// Qué jugadores se ofrecen para cada puesto (por la posición que tienen en su selección).
const COMPATIBLES: Record<Pos, Pos[]> = {
  PO: ['PO'], LD: ['LD'], LI: ['LI'], DFC: ['DFC'], MCD: ['MCD', 'MC'], MC: ['MC', 'MCD', 'MCO'], MI: ['MI', 'EXT'], MD: ['MD', 'EXT'], MCO: ['MCO', 'MC'], EXT: ['EXT', 'DC'], DC: ['DC', 'EXT'],
}

// Un once de ejemplo (los mejores de cada puesto) para mostrar cómo se ve el juego en la pantalla de inicio.
export function onceDeEjemplo(formacion = '4-3-3'): string[] {
  const usados = new Set<string>()
  return FORMACIONES[formacion].map((h) => {
    const c = PLAYERS.filter((p) => !usados.has(p.id) && COMPATIBLES[h.pos].includes(p.pos)).sort((a, b) => b.ovr - a.ovr)[0]
    usados.add(c.id); return c.id
  })
}

export interface Equipo { formacion: string; once: string[]; suplentes: string[]; creado: number }
export const N_SUPLENTES = 3
export const N_PICKS = 11 + N_SUPLENTES
export const RONDAS = 5

const barajar = <T,>(xs: T[], rng: Rng): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// Tres leyendas para el puesto n (0..10 = titulares en el orden de la formación; 11..13 = suplentes, de cualquier posición). Sin repetir a nadie ya elegido.
export function ofertas(seed: string, formacion: string, paso: number, elegidos: string[]): Player[] {
  const rng = makeRng(`${seed}:${paso}`)
  const hueco = FORMACIONES[formacion][paso]
  const usados = new Set(elegidos)
  const pool = PLAYERS.filter((p) => !usados.has(p.id) && (hueco ? COMPATIBLES[hueco.pos].includes(p.pos) : p.line !== 'GK'))
  // una oferta «de lujo» (más valoración) y dos al azar: siempre hay algo tentador y algo que decidir
  const mejores = pool.filter((p) => p.ovr >= 88)
  const ordenada = barajar(pool, rng)
  const out: Player[] = []
  if (mejores.length && rng() < 0.55) out.push(mejores[Math.floor(rng() * mejores.length)])
  for (const p of ordenada) { if (out.length >= 3) break; if (!out.includes(p)) out.push(p) }
  return barajar(out, rng).slice(0, 3)
}

// ---------- valoración de cada jugador en el duelo ----------
const attr = (p: Player, k: string): number => p.attrs.find((a) => a.k === k)?.v ?? p.ovr
const mezcla = (p: Player, pesos: [string, number][]) => pesos.reduce((s, [k, w]) => s + attr(p, k) * w, 0) / pesos.reduce((s, [, w]) => s + w, 0)

export const poderAtaque = (p: Player): number => {
  if (p.line === 'GK') return 35
  const b = p.line === 'ATT' ? mezcla(p, [['Disparo', 0.35], ['Regate', 0.25], ['Ritmo', 0.2], ['Pase', 0.2]])
    : p.line === 'MID' ? mezcla(p, [['Pase', 0.35], ['Regate', 0.25], ['Disparo', 0.2], ['Ritmo', 0.2]])
      : mezcla(p, [['Ritmo', 0.3], ['Pase', 0.3], ['Físico', 0.2], ['Disparo', 0.2]]) - 6
  return b
}
export const poderDefensa = (p: Player): number => {
  if (p.line === 'GK') return 40
  const b = p.line === 'DEF' ? mezcla(p, [['Defensa', 0.4], ['Físico', 0.25], ['Ritmo', 0.2], ['Pase', 0.15]])
    : p.line === 'MID' ? mezcla(p, [['Defensa', 0.35], ['Físico', 0.25], ['Pase', 0.25], ['Ritmo', 0.15]])
      : mezcla(p, [['Defensa', 0.3], ['Físico', 0.3], ['Ritmo', 0.25], ['Regate', 0.15]]) - 8
  return b
}
export const poderRemate = (p: Player): number => (p.line === 'GK' ? 30 : attr(p, 'Disparo'))
export const poderArquero = (p: Player): number => mezcla(p, [['Paradas', 0.4], ['Reflejos', 0.35], ['Posición', 0.25]])

// Sinergia: 3+ jugadores de un mismo país suman +1 a todos ellos; 5+ suman +2.
export function sinergias(ids: string[]): Record<string, number> {
  const porPais: Record<string, string[]> = {}
  for (const id of ids) { const p = PLAYER_BY_ID[id]; if (p) (porPais[p.teamId] ??= []).push(id) }
  const bonus: Record<string, number> = {}
  for (const grupo of Object.values(porPais)) { const b = grupo.length >= 5 ? 2 : grupo.length >= 3 ? 1 : 0; if (b) grupo.forEach((id) => { bonus[id] = b }) }
  return bonus
}
export const paisesConSinergia = (ids: string[]): { teamId: string; n: number; bonus: number }[] => {
  const m: Record<string, number> = {}
  ids.forEach((id) => { const p = PLAYER_BY_ID[id]; if (p) m[p.teamId] = (m[p.teamId] ?? 0) + 1 })
  return Object.entries(m).filter(([, n]) => n >= 3).map(([teamId, n]) => ({ teamId, n, bonus: n >= 5 ? 2 : 1 }))
}

export const valorEquipo = (e: Equipo): number => Math.round(e.once.reduce((s, id) => s + (PLAYER_BY_ID[id]?.ovr ?? 0), 0) / 11)

// ---------- rival de la máquina ----------
export type Nivel = 'bronce' | 'plata' | 'oro' | 'leyenda'
export const NIVELES: { id: Nivel; nombre: string; k: number; ruido: number }[] = [
  { id: 'bronce', nombre: 'Bronce', k: 1, ruido: 14 },
  { id: 'plata', nombre: 'Plata', k: 2, ruido: 9 },
  { id: 'oro', nombre: 'Oro', k: 3, ruido: 5 },
  { id: 'leyenda', nombre: 'Leyenda', k: 6, ruido: 1.5 },
]
export function equipoMaquina(nivel: Nivel, seed: string): Equipo {
  const cfg = NIVELES.find((n) => n.id === nivel)!
  const rng = makeRng(`${seed}:ia:${nivel}`)
  const formacion = NOMBRES_FORMACION[Math.floor(rng() * NOMBRES_FORMACION.length)]
  const elegidos: string[] = []
  for (let paso = 0; paso < N_PICKS; paso++) {
    const hueco = FORMACIONES[formacion][paso]
    const pool = PLAYERS.filter((p) => !elegidos.includes(p.id) && (hueco ? COMPATIBLES[hueco.pos].includes(p.pos) : p.line !== 'GK'))
    const cand = barajar(pool, rng).slice(0, cfg.k)
    elegidos.push(cand.sort((a, b) => b.ovr - a.ovr)[0].id) // mejor de k candidatos: a más nivel, más candidatos
  }
  return { formacion, once: elegidos.slice(0, 11), suplentes: elegidos.slice(11), creado: 0 }
}

// ---------- una ronda ----------
export interface Cambio { atacante: string; defensor: string } // ids elegidos por un equipo
export interface Jugada { atacante: string; defensor: string; arquero: string; resultado: 'gol' | 'atajada' | 'corte'; pPase: number; pGol: number }
export interface ResultadoRonda { mia: Jugada; rival: Jugada; golesMios: number; golesRival: number }

const sig = (x: number) => 1 / (1 + Math.exp(-x))
function jugada(att: Player, def: Player, gk: Player, bonusAtt: number, bonusDef: number, ctx: MatchCtx | undefined, rng: Rng): Jugada {
  const A = poderAtaque(att) + bonusAtt, D = poderDefensa(def) + bonusDef
  const pPase = sig((A - D) / 11) // gana el duelo contra el defensor
  const pGolSiPasa = Math.min(0.9, sig((poderRemate(att) + bonusAtt - poderArquero(gk)) / 10) * 0.95 * weatherFactor(ctx).goals)
  const pGol = pPase * pGolSiPasa
  const pasa = rng() < pPase
  if (!pasa) return { atacante: att.id, defensor: def.id, arquero: gk.id, resultado: 'corte', pPase, pGol }
  return { atacante: att.id, defensor: def.id, arquero: gk.id, resultado: rng() < pGolSiPasa ? 'gol' : 'atajada', pPase, pGol }
}

export function jugarRonda(seed: string, ronda: number, yo: Equipo, rival: Equipo, miEleccion: Cambio, suEleccion: Cambio, ctx: MatchCtx | undefined): ResultadoRonda {
  const rng = makeRng(`${seed}:ronda:${ronda}`)
  const sinMio = sinergias([...yo.once, ...yo.suplentes]), sinSu = sinergias([...rival.once, ...rival.suplentes])
  const P = (id: string) => PLAYER_BY_ID[id]
  const gkYo = P(yo.once[0]), gkSu = P(rival.once[0])
  const mia = jugada(P(miEleccion.atacante), P(suEleccion.defensor), gkSu, sinMio[miEleccion.atacante] ?? 0, sinSu[suEleccion.defensor] ?? 0, ctx, rng)
  const rv = jugada(P(suEleccion.atacante), P(miEleccion.defensor), gkYo, sinSu[suEleccion.atacante] ?? 0, sinMio[miEleccion.defensor] ?? 0, ctx, rng)
  return { mia, rival: rv, golesMios: mia.resultado === 'gol' ? 1 : 0, golesRival: rv.resultado === 'gol' ? 1 : 0 }
}

// Elección de la máquina: el mejor atacante y el mejor defensor disponibles, con «ruido» según el nivel (a menos nivel, peores decisiones).
export function eligeMaquina(seed: string, ronda: number, equipo: Equipo, cansados: string[], nivel: Nivel): Cambio {
  const rng = makeRng(`${seed}:ia-elige:${ronda}`)
  const cfg = NIVELES.find((n) => n.id === nivel)!
  const disponibles = [...equipo.once, ...(ronda >= 3 ? equipo.suplentes : [])].filter((id) => !cansados.includes(id) && PLAYER_BY_ID[id].line !== 'GK')
  const mejor = (f: (p: Player) => number, excluir?: string) => {
    const c = disponibles.filter((id) => id !== excluir)
    return c.sort((a, b) => (f(PLAYER_BY_ID[b]) + (rng() - 0.5) * 2 * cfg.ruido) - (f(PLAYER_BY_ID[a]) + (rng() - 0.5) * 2 * cfg.ruido))[0]
  }
  const atacante = mejor(poderAtaque)
  const defensor = mejor(poderDefensa, atacante)
  return { atacante, defensor }
}

// Penales si hay empate tras las rondas: 5 cada uno y, si sigue igual, muerte súbita.
export interface Penal { lanza: 'yo' | 'rival'; jugador: string; gol: boolean }
export function penales(seed: string, yo: Equipo, rival: Equipo): { tandas: Penal[]; yo: number; rival: number } {
  const rng = makeRng(`${seed}:penales`)
  const tiradores = (e: Equipo) => [...e.once, ...e.suplentes].filter((id) => PLAYER_BY_ID[id].line !== 'GK').sort((a, b) => poderRemate(PLAYER_BY_ID[b]) - poderRemate(PLAYER_BY_ID[a]))
  const tYo = tiradores(yo), tSu = tiradores(rival)
  const gkYo = PLAYER_BY_ID[yo.once[0]], gkSu = PLAYER_BY_ID[rival.once[0]]
  const lanzar = (id: string, gk: Player) => rng() < Math.max(0.6, Math.min(0.88, 0.76 + (poderRemate(PLAYER_BY_ID[id]) - poderArquero(gk)) * 0.003))
  const tandas: Penal[] = []
  let a = 0, b = 0
  for (let i = 0; i < 5; i++) {
    const g1 = lanzar(tYo[i], gkSu); tandas.push({ lanza: 'yo', jugador: tYo[i], gol: g1 }); if (g1) a++
    const g2 = lanzar(tSu[i], gkYo); tandas.push({ lanza: 'rival', jugador: tSu[i], gol: g2 }); if (g2) b++
  }
  let i = 5
  while (a === b && i < 12) {
    const g1 = lanzar(tYo[i % tYo.length], gkSu), g2 = lanzar(tSu[i % tSu.length], gkYo)
    tandas.push({ lanza: 'yo', jugador: tYo[i % tYo.length], gol: g1 }, { lanza: 'rival', jugador: tSu[i % tSu.length], gol: g2 })
    if (g1) a++; if (g2) b++
    i++
  }
  if (a === b) a++ // seguridad
  return { tandas, yo: a, rival: b }
}

// Sede y clima del duelo.
export function sedeDuelo(seed: string): MatchCtx {
  const rng = makeRng(`${seed}:sede`)
  const host = HOSTS[Math.floor(rng() * HOSTS.length)]
  const venue = host.venues[Math.floor(rng() * host.venues.length)]
  const month = 1 + Math.floor(rng() * 12)
  return contextFor({ hostId: host.id, season: 'templado', finalVenue: venue.id, month, history: {} }, seed, 'F')
}
export const sedeNombre = (ctx: MatchCtx) => VENUE_BY_ID[ctx.venueId]
