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
  '4-3-3': [H('PO', 'GK', 50, 91), H('LI', 'DEF', 10, 69), H('DFC', 'DEF', 36, 71), H('DFC', 'DEF', 64, 71), H('LD', 'DEF', 90, 69), H('MC', 'MID', 28, 41), H('MCD', 'MID', 50, 47), H('MC', 'MID', 72, 41), H('EXT', 'ATT', 18, 17), H('DC', 'ATT', 50, 11), H('EXT', 'ATT', 82, 17)],
  '4-4-2': [H('PO', 'GK', 50, 91), H('LI', 'DEF', 10, 69), H('DFC', 'DEF', 36, 71), H('DFC', 'DEF', 64, 71), H('LD', 'DEF', 90, 69), H('MI', 'MID', 14, 38), H('MC', 'MID', 38, 43), H('MC', 'MID', 62, 43), H('MD', 'MID', 86, 38), H('DC', 'ATT', 36, 14), H('DC', 'ATT', 64, 14)],
  '4-2-3-1': [H('PO', 'GK', 50, 91), H('LI', 'DEF', 10, 69), H('DFC', 'DEF', 36, 71), H('DFC', 'DEF', 64, 71), H('LD', 'DEF', 90, 69), H('MCD', 'MID', 36, 50), H('MCD', 'MID', 64, 50), H('EXT', 'ATT', 18, 29), H('MCO', 'MID', 50, 29), H('EXT', 'ATT', 82, 29), H('DC', 'ATT', 50, 11)],
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
// Tope de los suplentes: una estrella en la banca superaría a los titulares, así que ahí no salen leyendas (ni la oferta «de lujo»).
export const TOPE_SUPLENTE = 87
export const MAX_FAVORITA = 3
// En cuántos sorteos (de 14) aparece un jugador de la selección favorita: 3 puestos distintos, fijos para esa semilla.
export const pasosFavorita = (seed: string): number[] => barajar(Array.from({ length: N_PICKS }, (_, i) => i), makeRng(`${seed}:fav`)).slice(0, MAX_FAVORITA)

// Reglas: nunca dos jugadores del mismo país entre las 3 opciones; si la persona tiene selección favorita, en 3 sorteos distintos
// una de las opciones es de su país (si hay alguien disponible para ese puesto). Sin favorita, todo sigue igual.
export function ofertas(seed: string, formacion: string, paso: number, elegidos: string[], favorita = ''): Player[] {
  const rng = makeRng(`${seed}:${paso}`)
  const hueco = FORMACIONES[formacion][paso]
  const usados = new Set(elegidos)
  const pool = PLAYERS.filter((p) => !usados.has(p.id) && (hueco ? COMPATIBLES[hueco.pos].includes(p.pos) : p.line !== 'GK' && p.ovr <= TOPE_SUPLENTE))
  const out: Player[] = []
  const ajeno = (p: Player) => !favorita || p.teamId !== favorita // fuera de sus 3 sorteos, la favorita no aparece por azar: el máximo es 3
  const hayPais = (p: Player) => out.some((o) => o.teamId === p.teamId)
  const ordenada = barajar(pool, rng)
  // 1) una de la selección favorita, solo en los 3 sorteos que le tocan
  if (favorita && pasosFavorita(seed).includes(paso)) { const f = ordenada.find((p) => p.teamId === favorita); if (f) out.push(f) }
  // 2) una «de lujo» (88+), siempre hay algo tentador y algo que decidir
  const mejores = hueco ? pool.filter((p) => p.ovr >= 88 && !hayPais(p) && ajeno(p)) : []
  if (mejores.length && rng() < 0.55) out.push(mejores[Math.floor(rng() * mejores.length)])
  // 3) el resto al azar, de países distintos
  for (const p of ordenada) { if (out.length >= 3) break; if (!out.includes(p) && !hayPais(p) && ajeno(p)) out.push(p) }
  for (const p of ordenada) { if (out.length >= 3) break; if (!out.includes(p) && ajeno(p)) out.push(p) } // por si faltaran países distintos
  return barajar(out, rng).slice(0, 3)
}

// ---------- valoración de cada jugador en el duelo ----------
const attr = (p: Player, k: string): number => p.attrs.find((a) => a.k === k)?.v ?? p.ovr
const mezcla = (p: Player, pesos: [string, number][]) => pesos.reduce((s, [k, w]) => s + attr(p, k) * w, 0) / pesos.reduce((s, [, w]) => s + w, 0)

// Los mejores delanteros rondan 93 de ataque y los mejores defensas 90 de defensa: este ajuste los iguala para que elegir defensas importe tanto como elegir delanteros.
export const AJUSTE_DEFENSAS = 3
// Cómo se calcula el poder de cada jugador: mezcla de atributos según su línea (y un ajuste si juega fuera de lo suyo).
export interface Formula { pesos: [string, number][]; ajuste: number }
export const formulaAtaque = (p: Player): Formula | null => {
  if (p.line === 'GK') return null
  if (p.line === 'ATT') return { pesos: [['Disparo', 0.35], ['Regate', 0.25], ['Ritmo', 0.2], ['Pase', 0.2]], ajuste: 0 }
  if (p.line === 'MID') return { pesos: [['Pase', 0.35], ['Regate', 0.25], ['Disparo', 0.2], ['Ritmo', 0.2]], ajuste: 0 }
  return { pesos: [['Ritmo', 0.3], ['Pase', 0.3], ['Físico', 0.2], ['Disparo', 0.2]], ajuste: -6 }
}
export const formulaDefensa = (p: Player): Formula | null => {
  if (p.line === 'GK') return null
  if (p.line === 'DEF') return { pesos: [['Defensa', 0.4], ['Físico', 0.25], ['Ritmo', 0.2], ['Pase', 0.15]], ajuste: AJUSTE_DEFENSAS }
  if (p.line === 'MID') return { pesos: [['Defensa', 0.35], ['Físico', 0.25], ['Pase', 0.25], ['Ritmo', 0.15]], ajuste: 0 }
  return { pesos: [['Defensa', 0.3], ['Físico', 0.3], ['Ritmo', 0.25], ['Regate', 0.15]], ajuste: -8 }
}
const aplica = (p: Player, f: Formula | null, fijo: number) => (f ? mezcla(p, f.pesos) + f.ajuste : fijo)
export const poderAtaque = (p: Player): number => aplica(p, formulaAtaque(p), 35)
export const poderDefensa = (p: Player): number => aplica(p, formulaDefensa(p), 40)
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
// Los campos opcionales (por qué salió así) se guardan para explicarlo en pantalla; las partidas guardadas antes de existir no los tienen.
export interface Jugada { atacante: string; defensor: string; arquero: string; resultado: 'gol' | 'atajada' | 'corte'; pPase: number; pGol: number; pA?: number; pD?: number; rem?: number; arq?: number; pTiro?: number; clima?: number; t1?: number; t2?: number }
export interface ResultadoRonda { mia: Jugada; rival: Jugada; golesMios: number; golesRival: number }

// Con defensas más fuertes caían pocos goles: este factor, junto a las escalas, deja ~3,6 goles por partida.
export const FACTOR_REMATE = 1.2
// Cuánto pesa la ventaja: cuanto más chica la escala, más seguro es que gane el mejor (menos suerte). Con 5, +7 de ventaja da ~80 % y +13 da ~93 %.
export const ESCALA_DUELO = 5
export const ESCALA_TIRO = 5
const sig = (x: number) => 1 / (1 + Math.exp(-x))
function jugada(att: Player, def: Player, gk: Player, bonusAtt: number, bonusDef: number, ctx: MatchCtx | undefined, rng: Rng): Jugada {
  const A = poderAtaque(att) + bonusAtt, D = poderDefensa(def) + bonusDef
  const pPase = sig((A - D) / ESCALA_DUELO) // gana el duelo contra el defensor
  const pGolSiPasa = Math.min(0.9, sig((poderRemate(att) + bonusAtt - poderArquero(gk)) / ESCALA_TIRO) * FACTOR_REMATE * weatherFactor(ctx).goals)
  const pGol = pPase * pGolSiPasa
  const detalle = { pA: A, pD: D, rem: poderRemate(att) + bonusAtt, arq: poderArquero(gk), pTiro: pGolSiPasa, clima: weatherFactor(ctx).goals }
  const t1 = rng() // el «dado» del duelo con el defensor: se supera si sale menos que pPase
  if (t1 >= pPase) return { atacante: att.id, defensor: def.id, arquero: gk.id, resultado: 'corte', pPase, pGol, ...detalle, t1 }
  const t2 = rng() // el «dado» del remate: gol si sale menos que pGolSiPasa
  return { atacante: att.id, defensor: def.id, arquero: gk.id, resultado: t2 < pGolSiPasa ? 'gol' : 'atajada', pPase, pGol, ...detalle, t1, t2 }
}

export function jugarRonda(seed: string, ronda: number, yo: Equipo, rival: Equipo, miEleccion: Cambio, suEleccion: Cambio, ctx: MatchCtx | undefined, aj?: Ajustes): ResultadoRonda {
  const aM = (id: string) => aj?.mio[id] ?? 0, aS = (id: string) => aj?.su[id] ?? 0
  const rng = makeRng(`${seed}:ronda:${ronda}`)
  const sinMio = sinergias([...yo.once, ...yo.suplentes]), sinSu = sinergias([...rival.once, ...rival.suplentes])
  const P = (id: string) => PLAYER_BY_ID[id]
  const gkYo = P(yo.once[0]), gkSu = P(rival.once[0])
  const mia = jugada(P(miEleccion.atacante), P(suEleccion.defensor), gkSu, (sinMio[miEleccion.atacante] ?? 0) + aM(miEleccion.atacante), (sinSu[suEleccion.defensor] ?? 0) + aS(suEleccion.defensor), ctx, rng)
  const rv = jugada(P(suEleccion.atacante), P(miEleccion.defensor), gkYo, (sinSu[suEleccion.atacante] ?? 0) + aS(suEleccion.atacante), (sinMio[miEleccion.defensor] ?? 0) + aM(miEleccion.defensor), ctx, rng)
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
// ---------- poderes: una vez por partida cada uno, jugados en secreto tras ver los jugadores rivales ----------
export type TipoPoder = 'impulso' | 'debilitar' | 'bloqueo'
export const TIPOS_PODER: TipoPoder[] = ['impulso', 'debilitar', 'bloqueo']
export const BONO_IMPULSO = 2
export const CASTIGO_DEBILITAR = 3
export type Rol = 'atacante' | 'defensor'
export interface Poder { tipo: TipoPoder; objetivo: string } // objetivo: jugador propio (impulso) o rival (debilitar, bloqueo)
export type Disponibles = Record<TipoPoder, boolean>
export const todosLosPoderes = (): Disponibles => ({ impulso: true, debilitar: true, bloqueo: true })
export interface Ajustes { mio: Record<string, number>; su: Record<string, number> }
export interface Efecto { de: 'mio' | 'su'; tipo: TipoPoder; objetivo: string; aplicado: boolean }

const rolDe = (c: Cambio, id: string): Rol | undefined => (c.atacante === id ? 'atacante' : c.defensor === id ? 'defensor' : undefined)
// Qué jugador de cada equipo queda bloqueado (y en qué puesto) por el poder del otro.
export function bloqueados(pm: Poder | undefined, ps: Poder | undefined, mio: Cambio, su: Cambio): { mio?: Rol; su?: Rol } {
  return { su: pm?.tipo === 'bloqueo' ? rolDe(su, pm.objetivo) : undefined, mio: ps?.tipo === 'bloqueo' ? rolDe(mio, ps.objetivo) : undefined }
}
// Jugadores que un equipo puede poner en la cancha esta ronda (sin cansados, sin arquero, desde la ronda 3 también suplentes).
export function candidatos(equipo: Equipo, ronda: number, cansados: string[], excluir: string[] = []): string[] {
  return [...equipo.once, ...(ronda >= 3 ? equipo.suplentes : [])].filter((id) => !cansados.includes(id) && !excluir.includes(id) && PLAYER_BY_ID[id].line !== 'GK')
}
// Quién reemplaza al jugador bloqueado de la máquina: el mejor disponible para ese puesto.
export function reemplazoMaquina(seed: string, ronda: number, equipo: Equipo, cansados: string[], nivel: Nivel, eleccion: Cambio, rol: Rol, bloqueado: string): Cambio {
  const rng = makeRng(`${seed}:ia-reemplazo:${ronda}`)
  const cfg = NIVELES.find((n) => n.id === nivel)!
  const otro = rol === 'atacante' ? eleccion.defensor : eleccion.atacante
  const f = rol === 'atacante' ? poderAtaque : poderDefensa
  const c = candidatos(equipo, ronda, cansados, [bloqueado, otro])
  if (!c.length) return eleccion // sin nadie más: se queda como estaba
  const nuevo = c.sort((a, b) => (f(PLAYER_BY_ID[b]) + (rng() - 0.5) * 2 * cfg.ruido) - (f(PLAYER_BY_ID[a]) + (rng() - 0.5) * 2 * cfg.ruido))[0]
  return rol === 'atacante' ? { atacante: nuevo, defensor: eleccion.defensor } : { atacante: eleccion.atacante, defensor: nuevo }
}
// Efectos de los poderes sobre los jugadores que finalmente juegan. Si el jugador objetivo ya no juega (fue bloqueado y cambiado), el poder se pierde.
export function aplicarPoderes(pm: Poder | undefined, ps: Poder | undefined, mio: Cambio, su: Cambio): { ajustes: Ajustes; efectos: Efecto[] } {
  const ajustes: Ajustes = { mio: {}, su: {} }
  const efectos: Efecto[] = []
  const juega = (c: Cambio, id: string) => c.atacante === id || c.defensor === id
  const uno = (de: 'mio' | 'su', pw: Poder | undefined) => {
    if (!pw) return
    const propio = de === 'mio' ? mio : su, ajeno = de === 'mio' ? su : mio
    const aj = de === 'mio' ? ajustes : { mio: ajustes.su, su: ajustes.mio }
    if (pw.tipo === 'impulso') { const ok = juega(propio, pw.objetivo); if (ok) aj.mio[pw.objetivo] = (aj.mio[pw.objetivo] ?? 0) + BONO_IMPULSO; efectos.push({ de, tipo: pw.tipo, objetivo: pw.objetivo, aplicado: ok }) }
    else if (pw.tipo === 'debilitar') { const ok = juega(ajeno, pw.objetivo); if (ok) aj.su[pw.objetivo] = (aj.su[pw.objetivo] ?? 0) - CASTIGO_DEBILITAR; efectos.push({ de, tipo: pw.tipo, objetivo: pw.objetivo, aplicado: ok }) }
    else efectos.push({ de, tipo: pw.tipo, objetivo: pw.objetivo, aplicado: !juega(ajeno, pw.objetivo) }) // bloqueo: surtió efecto si el rival tuvo que cambiarlo
  }
  uno('mio', pm); uno('su', ps)
  return { ajustes, efectos }
}
// La máquina decide en secreto si juega un poder y cuál. Más nivel = lo usa donde más pesa; todos los niveles terminan usando sus poderes.
export function eligePoderMaquina(seed: string, ronda: number, nivel: Nivel, disp: Disponibles, su: Cambio, mio: Cambio): Poder | undefined {
  const rng = makeRng(`${seed}:ia-poder:${ronda}`)
  const libres = TIPOS_PODER.filter((t) => disp[t])
  if (!libres.length) return undefined
  const restantes = RONDAS - ronda + 1
  const base = { bronce: 0.3, plata: 0.4, oro: 0.5, leyenda: 0.55 }[nivel]
  const prob = libres.length >= restantes ? 1 : ronda >= 4 ? Math.max(base, 0.8) : base
  if (rng() > prob) return undefined
  const P = (id: string) => PLAYER_BY_ID[id]
  // en qué duelo va peor la máquina: ahí un poder cambia más
  const mAtk = poderAtaque(P(su.atacante)) - poderDefensa(P(mio.defensor)), mDef = poderDefensa(P(su.defensor)) - poderAtaque(P(mio.atacante))
  const ataca = nivel === 'bronce' ? rng() < 0.5 : mAtk <= mDef
  const tipo = nivel === 'leyenda' && libres.length > 1 ? (mAtk < 0 || mDef < 0 ? (libres.includes('bloqueo') ? 'bloqueo' : libres[0]) : libres.includes('impulso') ? 'impulso' : libres[0]) : libres[Math.floor(rng() * libres.length)]
  if (tipo === 'impulso') return { tipo, objetivo: ataca ? su.atacante : su.defensor }
  return { tipo, objetivo: ataca ? mio.defensor : mio.atacante } // si su atacante va peor, frena al defensor que lo enfrenta (y viceversa)
}

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
